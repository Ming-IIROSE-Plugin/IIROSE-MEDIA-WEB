import { describe, expect, it, vi } from "vitest";
import { CutWatcher } from "./CutWatcher";

function hostSocket(send = vi.fn()) {
  return { send: send as unknown as (data: string) => void } as {
    send: (data: string) => void;
    __imwCutPatched?: boolean;
  };
}

const chat = (text: string) =>
  JSON.stringify({ m: text, mc: "008000", i: String(Date.now()) });

describe("自己喊 cut 的检测", () => {
  it("包装宿站 socket 后能识别本端发出的 cut 指令", () => {
    const socket = hostSocket();
    let clock = 1000;
    const watcher = new CutWatcher(
      () => socket,
      () => clock,
    );
    watcher.tick();
    expect(socket.__imwCutPatched).toBe(true);
    expect(watcher.recent()).toBe(false);
    socket.send(chat("cut"));
    expect(watcher.recent()).toBe(true);
    clock += 9000;
    expect(watcher.recent()).toBe(false);
  });

  it("普通聊天与大小写变体不会误判，非 JSON 报文忽略", () => {
    const socket = hostSocket();
    const watcher = new CutWatcher(
      () => socket,
      () => 1000,
    );
    watcher.tick();
    socket.send(chat("我要 cut 一下"));
    socket.send(chat("recut"));
    socket.send("&1{}");
    socket.send("not json");
    expect(watcher.recent()).toBe(false);
    socket.send(chat(" CUT "));
    expect(watcher.recent()).toBe(true);
  });

  it("consume 后不再命中，重复 tick 不会二次包装", () => {
    const socket = hostSocket();
    const watcher = new CutWatcher(
      () => socket,
      () => 1000,
    );
    watcher.tick();
    const patched = socket.send;
    watcher.tick();
    expect(socket.send).toBe(patched);
    socket.send(chat("cut"));
    watcher.consume();
    expect(watcher.recent()).toBe(false);
  });
});
