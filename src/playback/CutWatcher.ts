/**
 * 「自己喊 cut」的检测。
 *
 * 宿站 cut 是公屏指令：本人点播的曲目被自己 cut 会立即结束播放；
 * 他人点播或投票 cut 也会结束，但那不该被插件自动重播（等于对抗房间决议）。
 * 因此只把「本端刚刚发出过 m === "cut" 的聊天报文」记为 self-cut。
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

  constructor(
    private host: () => HostSocket | undefined = () =>
      typeof window === "undefined"
        ? undefined
        : (window.socket as unknown as HostSocket | undefined),
    private now: () => number = () => Date.now(),
  ) {}

  /** 每次快照调用：宿站 socket 可能晚于插件就绪，这里做一次幂等包装。 */
  tick(): void {
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

  /** 最近一次「自己喊 cut」是否落在窗口内。 */
  recent(): boolean {
    return this.cutAt > 0 && this.now() - this.cutAt <= CUT_WINDOW_MS;
  }

  /** 消费掉这次 cut，避免同一次操作触发多轮重播。 */
  consume(): void {
    this.cutAt = 0;
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
