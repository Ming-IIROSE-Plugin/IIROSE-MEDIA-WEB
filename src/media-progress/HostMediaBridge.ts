import {
  coverUrl,
  finiteTime,
  isAbsoluteSeekCommand,
  isSeekCommand,
  mediaPermission,
  mediaPermissionReason,
  MediaControlMode,
  MediaSnapshot,
  ownMediaOf,
  roomIdentifier,
  unavailableReason,
} from "./model";

type HostFunction = (...args: unknown[]) => unknown;
interface RoomInfo {
  identity?: unknown;
}

export interface MediaHost {
  shareMediaCurrentTime?: unknown;
  shareMediaDuration?: unknown;
  shareMedia?: HostFunction;
  socket?: { readyState: number; send?: (command: string) => void };
  mediaShareRoom?: boolean;
  theme?: unknown;
  myself?: unknown;
  rank?: unknown;
  roomnFull?: unknown;
  Info?: { room?: RoomInfo };
  Probe?: { admin?: { blockPubChat?: unknown } };
  Utils?: {
    service?: {
      isShareMediaPlaying?: () => boolean;
      seekDemandMedia?: HostFunction;
      moveinputDo?: HostFunction;
    };
  };
}

// 包装仅观察宿站已发生的行为；不主动调用播放器或定位函数。
/** 面板 / 浮窗 / 已点亮模式下的刷新节奏。 */
const ACTIVE_POLL_MS = 250;
/** 无人观察时的刷新节奏：再慢就会让侧栏按钮的可用性明显落后。 */
const IDLE_POLL_MS = 1000;

export class HostMediaBridge {
  private instance = 0;
  private roomKey: string | null = null;
  private roomKeyInitialized = false;
  private seekVersion = 0;
  private listeners = new Set<(snapshot: MediaSnapshot) => void>();
  /** 需要 250ms 节奏的场景（面板 / 浮窗 / 已点亮的模式）；为空时退到 1s。 */
  private activeTags = new Set<string>();
  /** 当前定时器的间隔，0 表示没起表。 */
  private intervalMs = 0;
  private poking = false;
  private restorers: (() => void)[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private hooked = new Map<
    string,
    { owner: object; wrapper: HostFunction; invalidate: () => void }
  >();

  constructor(
    private host: MediaHost = window as unknown as MediaHost,
    private doc: Document = document,
    private sendControl: (command: string) => void = (command) => {
      const socket = this.host.socket;
      if (typeof socket?.send !== "function")
        throw new Error("宿站进度控制不可用");
      socket.send(command);
    },
  ) {}

  get controlUnavailable(): boolean {
    return (
      this.host.mediaShareRoom === false ||
      typeof this.host.socket?.send !== "function"
    );
  }

  get controlUnavailableMessage(): string {
    return this.host.mediaShareRoom === false
      ? "当前房间不支持媒体进度控制"
      : "宿站进度控制不可用，请刷新页面后重试";
  }

  private readRoom() {
    const room = this.host.Info?.room;
    // 房间标识只用于「换房」判定；instance 另有语义，不复用这个值。
    const roomKey = roomIdentifier(this.host.roomnFull);
    if (this.roomKeyInitialized && roomKey !== this.roomKey) this.instance++;
    this.roomKey = roomKey;
    this.roomKeyInitialized = true;
    return room;
  }

  read(): MediaSnapshot {
    let playing = false;
    try {
      playing = this.host.Utils?.service?.isShareMediaPlaying?.() === true;
    } catch {
      /* 宿站初始化过程中暂缺节点 */
    }
    const room = this.readRoom();
    const permission = mediaPermission(room?.identity, this.host.rank);
    const mediaUser =
      this.doc.getElementById("shareMediaUserName")?.getAttribute("title") ||
      "";
    // 点播者昵称与归属判定同源：同一个 title 只读一次，trim 后写进 owner。
    const owner = mediaUser.trim();
    const ownMedia = ownMediaOf(mediaUser, this.host.myself);
    const controlMode: MediaControlMode =
      permission === "allowed"
        ? "silent"
        : playing && ownMedia
          ? "owner"
          : "unavailable";
    const controlReason = this.controlUnavailable
      ? this.controlUnavailableMessage
      : controlMode === "owner"
        ? this.host.Probe?.admin?.blockPubChat
          ? "当前被禁止公聊，无法使用本人点播模式"
          : typeof this.host.Utils?.service?.moveinputDo !== "function"
            ? "宿站本人点播控制不可用，请刷新页面后重试"
            : ""
        : "";
    const rawDuration = finiteTime(this.host.shareMediaDuration);
    const current = finiteTime(this.host.shareMediaCurrentTime);
    return {
      instance: this.instance,
      title:
        this.doc.getElementById("shareMediaSongName")?.textContent?.trim() ||
        "未命名媒体",
      cover: coverUrl(
        this.doc
          .querySelector<HTMLImageElement>("#shareMediaAvatar img")
          ?.getAttribute("src") || "",
      ),
      current,
      duration: rawDuration && rawDuration > 0 ? rawDuration : null,
      playing,
      connected: this.host.socket?.readyState === 1,
      owner,
      ownMedia,
      roomKey: this.roomKey,
      seekVersion: this.seekVersion,
      dark: !this.host.theme,
      permission,
      permissionReason: mediaPermissionReason(permission),
      controlMode,
      controlNotice:
        controlMode === "owner"
          ? "本人点播模式：调整会在房间发送快进/快退消息"
          : controlMode === "silent"
            ? "媒体管理模式：静默调整播放进度"
            : "",
      controlReason,
    };
  }

  subscribe(listener: (snapshot: MediaSnapshot) => void): () => void {
    this.listeners.add(listener);
    this.retune();
    listener(this.read());
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.stop();
    };
  }

  /**
   * 标记「有人正在看」的场景（面板打开 / 浮窗打开 / 循环或随机已点亮）。
   * 有任一标记时 250ms，全为空时 1s：宿站没有媒体事件，只靠轮询发现别人点歌、
   * 切歌与播放结束，所以不能完全停表。
   */
  /** 事件驱动的立即刷新（如插件自己发了报文、侧栏媒体卡增删）：不改变轮询节奏。 */
  poke(): void {
    // 监听器里可能再次触发（例如重播又发一次报文）：同一次 emit 内不重入。
    if (!this.listeners.size || this.poking) return;
    this.poking = true;
    try {
      this.emit();
    } finally {
      this.poking = false;
    }
  }

  setActive(tag: string, on: boolean): void {
    const size = this.activeTags.size;
    if (on) this.activeTags.add(tag);
    else this.activeTags.delete(tag);
    if (this.activeTags.size !== size) this.retune();
  }

  private retune() {
    if (!this.listeners.size) {
      this.stop();
      return;
    }
    const wanted = this.activeTags.size ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    if (this.timer && this.intervalMs === wanted) return;
    clearInterval(this.timer);
    this.installHooks();
    this.intervalMs = wanted;
    this.timer = setInterval(() => {
      this.installHooks();
      this.emit();
    }, wanted);
  }

  send(
    command: string,
    instance: number,
    controlMode: MediaControlMode,
  ): boolean {
    const media = this.read();
    const relative = isSeekCommand(command);
    const absolute = isAbsoluteSeekCommand(command);
    let absoluteTarget: number | null = null;
    if (absolute) {
      try {
        const [position] = JSON.parse(command.slice(3)) as [string];
        absoluteTarget = Number(position.slice(0, -1));
      } catch {
        return false;
      }
    }
    if (
      (!relative && !absolute) ||
      (absolute &&
        (controlMode !== "silent" ||
          media.duration === null ||
          absoluteTarget === null ||
          absoluteTarget > media.duration)) ||
      media.instance !== instance ||
      media.controlMode !== controlMode ||
      unavailableReason(media)
    )
      return false;
    try {
      if (controlMode === "silent") this.sendControl(command);
      else if (controlMode === "owner" && relative) this.sendOwner(command);
      else return false;
      return true;
    } catch {
      return false;
    }
  }

  private sendOwner(command: string) {
    // send 已校验白名单；只把方向与时间转换为宿站原生本人点播指令。
    const [direction, amount] = JSON.parse(command.slice(3)) as [
      string,
      string,
    ];
    const service = this.host.Utils?.service;
    if (typeof service?.moveinputDo !== "function")
      throw new Error("宿站本人点播控制不可用");
    const draft = this.doc.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >("input#moveinput, textarea#moveinput");
    const saved = draft
      ? {
          value: draft.value,
          start: draft.selectionStart,
          end: draft.selectionEnd,
          direction: draft.selectionDirection,
        }
      : null;
    try {
      // 隔离私聊等现存草稿；不触发输入事件，不走输入框的私聊发送逻辑。
      if (draft) draft.value = "";
      service.moveinputDo.call(
        service,
        `${direction === ">" ? "快进" : "快退"}${amount}`,
      );
    } finally {
      if (draft && saved) {
        draft.value = saved.value;
        if (saved.start !== null && saved.end !== null)
          draft.setSelectionRange(
            saved.start,
            saved.end,
            saved.direction || "none",
          );
      }
    }
  }

  private emit() {
    const media = this.read();
    this.listeners.forEach((listener) => listener(media));
  }

  private observe(owner: object, key: string, after: () => void) {
    const target = owner as Record<string, unknown>;
    const original = target[key];
    if (typeof original !== "function") return;
    const previous = this.hooked.get(key);
    if (previous?.owner === owner && previous.wrapper === original) return;
    previous?.invalidate();
    let active = true;
    const invalidate = () => {
      active = false;
    };
    const wrapper = function (this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args);
      if (active) after();
      return result;
    };
    target[key] = wrapper;
    this.hooked.set(key, { owner, wrapper, invalidate });
    this.restorers.push(() => {
      invalidate();
      // 不覆盖其他插件后来安装的钩子；嵌套旧包装仍转发，但不再通知。
      if (target[key] === wrapper) target[key] = original;
    });
  }

  private installHooks() {
    this.observe(this.host, "shareMedia", () => {
      this.instance++;
      this.emit();
    });
    const service = this.host.Utils?.service;
    if (service)
      this.observe(service, "seekDemandMedia", () => {
        this.seekVersion++;
        this.emit();
      });
  }

  private stop() {
    clearInterval(this.timer);
    this.timer = undefined;
    this.intervalMs = 0;
    this.restorers.reverse().forEach((restore) => restore());
    this.restorers = [];
    this.hooked.clear();
  }

  dispose() {
    this.listeners.clear();
    this.activeTags.clear();
    this.stop();
  }
}
