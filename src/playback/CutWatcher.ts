/**
 * 「自己喊 cut」的检测。
 *
 * 宿站 cut 是公屏指令：本人点播的曲目被自己 cut 会立即结束播放；
 * 他人点播或投票 cut 也会结束，但那不该被插件自动重播（等于对抗房间决议）。
 *
 * 两条信号同时收：
 * 1. 本端 socket 发出的聊天报文（m === "cut"）；
 * 2. 聊天区新增的消息节点（内容含 cut 且含本人昵称）。
 * 任意一条命中都算 self-cut，8 秒内有效。
 */

const CHAT_CUT = /^cut$/i;
const CUT_WINDOW_MS = 8000;

interface HostSocket {
  send?: (data: string) => void;
  __imwCutPatched?: boolean;
}

export class CutWatcher {
  private cutAt = 0;
  private socket?: HostSocket;
  private observer?: MutationObserver;

  constructor(
    private host: () => HostSocket | undefined = () =>
      typeof window === "undefined"
        ? undefined
        : (window.socket as unknown as HostSocket | undefined),
    private now: () => number = () => Date.now(),
    private myself: () => string = () =>
      typeof window === "undefined" ? "" : String(window.myself ?? ""),
    private doc: Document | undefined = typeof document === "undefined"
      ? undefined
      : document,
  ) {}

  /** 每次快照调用：socket 与聊天区都可能晚于插件就绪，这里做幂等安装。 */
  tick(): void {
    this.patchSocket();
    this.observeChat();
  }

  /** 最近一次「自己喊 cut」是否落在窗口内。 */
  recent(): boolean {
    return this.cutAt > 0 && this.now() - this.cutAt <= CUT_WINDOW_MS;
  }

  /** 消费掉这次 cut，避免同一次操作触发多轮重播。 */
  consume(): void {
    this.cutAt = 0;
  }

  /** 聊天区文本判定（测试与观察器共用）：内容里有 cut 且是本人发的。 */
  feedMessage(text: string): void {
    const me = this.myself().trim();
    if (!me) return;
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return;
    // 宿站渲染是「内容 + 昵称 + 标签」，例如 `cut铭铭280 人工智能`：
    // 取昵称之前的部分当正文，正文去掉空白/冒号后必须正好是 cut。
    const at = normalized.indexOf(me);
    if (at < 0) return;
    const body = normalized
      .slice(0, at)
      .replace(/[\s:：,，·\-—|]+$/g, "")
      .trim();
    const rest = normalized
      .slice(at + me.length)
      .replace(/^[\s:：,，·\-—|]+/g, "")
      .trim();
    if (!/^cut$/i.test(body) && !/^cut$/i.test(rest)) return;
    this.cutAt = this.now();
  }

  dispose(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  private patchSocket(): void {
    const socket = this.host();
    if (!socket || typeof socket.send !== "function") return;
    if (this.socket === socket && socket.__imwCutPatched) return;
    const original = socket.send.bind(socket);
    socket.send = (data: string) => {
      if (this.isCutMessage(data)) this.cutAt = this.now();
      return original(data);
    };
    socket.__imwCutPatched = true;
    this.socket = socket;
  }

  private observeChat(): void {
    const doc = this.doc;
    if (!doc || this.observer || typeof MutationObserver === "undefined")
      return;
    this.observer = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          const blocks = node.matches(".msg")
            ? [node]
            : Array.from(node.querySelectorAll(".msg"));
          for (const block of blocks) this.feedMessage(block.textContent || "");
        }
    });
    this.observer.observe(doc.body, { childList: true, subtree: true });
  }

  private isCutMessage(data: string): boolean {
    if (!data.startsWith("{")) return false;
    try {
      const parsed = JSON.parse(data) as { m?: unknown };
      return typeof parsed.m === "string" && CHAT_CUT.test(parsed.m.trim());
    } catch {
      return false;
    }
  }
}
