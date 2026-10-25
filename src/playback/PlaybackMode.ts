import type { MediaSnapshot } from "../media-progress/model";

export type PlaybackModeKind = "loop" | "shuffle";
export type PlaybackModeName = "none" | PlaybackModeKind;

export interface PlaybackModeAvailability {
  enabled: boolean;
  reason: string;
}

// 守卫触发的外部熄灭：令牌变化才提示，250ms 轮询同一原因不重复刷屏。
export interface PlaybackModeClear {
  id: number;
  reason: string;
}

export interface PlaybackModeState {
  mode: PlaybackModeName;
  loop: PlaybackModeAvailability;
  shuffle: PlaybackModeAvailability;
  // 当前曲目非本人点播：保留点亮但不动作，视觉与生效态相同。
  standby: boolean;
  standbyReason: string;
  // 最近一次「已点亮被守卫清灭」（如换房）的原因；消费方按 id 消费一次即可。
  cleared: PlaybackModeClear | null;
}

// 文案取自 sidebar-controls.md 的不可用原因表。
const MEDIA_UNAVAILABLE = "直播或时间未知，无法使用";
const DISCONNECTED = "连接未就绪或已断开，暂时无法调整";
const NOT_PLAYING = "暂无播放内容，无法开启自动播放";
const STANDBY_REASON = "当前曲目由他人点播，暂不自动续播";
const ROOM_CHANGED_REASON = "已切换房间，播放模式已关闭";

const available = (): PlaybackModeAvailability => ({
  enabled: true,
  reason: "",
});

// 开关状态只存内存：互斥单选、不可用即熄灭、刷新即失。
export class PlaybackMode {
  private current: PlaybackModeName = "none";
  // 首次适配（SidebarMediaEntry 的 onMediaChange）到来前不承诺可用。
  private present = false;
  private connected = true;
  // 未收到任何快照前按「时长未知」处理：不承诺可用。
  private duration: number | null = null;
  // 归属与房间标识只来自快照，不缓存判定结果（快照本身就是每 250ms 重读）。
  private ownMedia = false;
  private playing = false;
  private roomKey: string | null = null;
  private cleared: PlaybackModeClear | null = null;
  private clearedId = 0;
  private extras: Record<PlaybackModeKind, PlaybackModeAvailability> = {
    loop: available(),
    shuffle: available(),
  };
  private listeners = new Set<(state: PlaybackModeState) => void>();
  private disposed = false;
  private signature: string;

  constructor() {
    this.signature = this.signatureOf(this.state);
  }

  get mode(): PlaybackModeName {
    return this.current;
  }

  get state(): PlaybackModeState {
    // 待命只对已点亮的模式成立：熄灭时没有「等待恢复」的对象。
    // 待命只在「有媒体在播但不是我点的」时成立；空闲态没有等待对象。
    const standby = this.current !== "none" && this.playing && !this.ownMedia;
    return {
      mode: this.current,
      loop: { ...this.availability("loop") },
      shuffle: { ...this.availability("shuffle") },
      standby,
      standbyReason: standby ? STANDBY_REASON : "",
      cleared: this.cleared ? { ...this.cleared } : null,
    };
  }

  // 派生顺序：媒体不存在 → 连接未就绪/断开 → 时长未知 → 单个模式自身原因。
  // 前三种是更根本的原因，优先于模式自身（如收藏为空）。
  // 归属不参与可用性：他人点播只是待命，按钮保持可点、不灰化。
  private availability(kind: PlaybackModeKind): PlaybackModeAvailability {
    // 收藏随机不依赖当前媒体：没在播时也能开启并立即点播一首。
    if (kind === "shuffle")
      return this.connected
        ? this.extras.shuffle
        : { enabled: false, reason: DISCONNECTED };
    if (!this.present) return { enabled: false, reason: MEDIA_UNAVAILABLE };
    if (!this.connected) return { enabled: false, reason: DISCONNECTED };
    if (this.duration === null || this.duration <= 0)
      return { enabled: false, reason: MEDIA_UNAVAILABLE };
    // 没在播时不允许再点亮；已经点亮的那一个保持（cut 后要靠它自动重播）。
    if (!this.playing && this.current !== kind)
      return { enabled: false, reason: NOT_PLAYING };
    return this.extras[kind];
  }

  // 不可用或无变化时静默拒绝；调用方不需要返回值（关闭与拒绝语义不同，不可混用布尔）。
  toggle(kind: PlaybackModeKind): void {
    if (this.disposed || !this.availability(kind).enabled) return;
    this.current = this.current === kind ? "none" : kind;
    this.publish();
  }

  // 媒体存在性来自侧栏 DOM（#shareMediaBox），快照里的时长无法代替它。
  setMediaPresent(present: boolean): void {
    if (this.disposed) return;
    this.present = present;
    this.settle();
    this.publish();
  }

  applySnapshot(snapshot: MediaSnapshot): void {
    if (this.disposed) return;
    this.connected = snapshot.connected;
    this.duration = snapshot.duration;
    this.ownMedia = snapshot.ownMedia;
    this.playing = snapshot.playing;
    // 无房间标识（null）视为未变化：换房瞬间宿站可能读不到 roomnFull，
    // 而桥接那边的 null 会参与 instance 失效（instance 只影响「同一播放实例」判定，
    // 这里若跟着熄灭就会把「标识短暂缺失」误判成换房）。两处刻意不一致。
    if (snapshot.roomKey !== null) {
      if (this.roomKey !== null && this.roomKey !== snapshot.roomKey)
        this.extinguish(ROOM_CHANGED_REASON);
      this.roomKey = snapshot.roomKey;
    }
    this.settle();
    this.publish();
  }

  setAvailability(
    kind: PlaybackModeKind,
    value: PlaybackModeAvailability,
  ): void {
    if (this.disposed) return;
    this.extras[kind] = { enabled: value.enabled, reason: value.reason || "" };
    this.settle();
    this.publish();
  }

  subscribe(listener: (state: PlaybackModeState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  /** 守卫/动作侧主动熄灭（如循环失败）：已点亮时熄灭并留一次性原因给行提示。 */
  stop(reason: string): void {
    if (this.disposed) return;
    this.extinguish(reason);
    this.publish();
  }

  // 不可用即清零点亮态；恢复可用也不自动重新点亮。
  private settle(): void {
    if (this.current !== "none" && !this.availability(this.current).enabled)
      this.current = "none";
  }

  // 守卫清灭：与 settle 的区别是留一条一次性原因给行提示（如换房）。
  private extinguish(reason: string): void {
    if (this.current === "none") return;
    this.current = "none";
    this.cleared = { id: ++this.clearedId, reason };
  }

  // 按状态签名去重：250ms 轮询同一快照不重复渲染。
  private publish(): void {
    const state = this.state;
    const signature = this.signatureOf(state);
    if (signature === this.signature) return;
    this.signature = signature;
    for (const listener of [...this.listeners]) listener(state);
  }

  private signatureOf(state: PlaybackModeState): string {
    return [
      state.mode,
      state.loop.enabled,
      state.loop.reason,
      state.shuffle.enabled,
      state.shuffle.reason,
      state.standby,
      state.standbyReason,
      state.cleared?.id ?? "",
      state.cleared?.reason ?? "",
    ].join("\u0000");
  }
}
