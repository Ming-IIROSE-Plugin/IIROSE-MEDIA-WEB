import { afterEach, describe, expect, it, vi } from "vitest";
import { CutWatcher } from "./CutWatcher";

function hostSocket(send = vi.fn()) {
  return { send: send as unknown as (data: string) => void } as {
    send: (data: string) => void;
    __imwCutPatched?: boolean;
  };
}

const chat = (text: string) =>
  JSON.stringify({ m: text, mc: "008000", i: String(Date.now()) });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("自己喊 cut 的检测", () => {
  it("socket 报文命中：本端发出的 cut 指令", () => {
    const socket = hostSocket();
    let clock = 1000;
    const watcher = new CutWatcher(
      () => socket,
      () => clock,
      () => "铭铭280",
    );
    watcher.tick();
    expect(watcher.recent()).toBe(false);
    socket.send(chat("cut"));
    expect(watcher.recent()).toBe(true);
    clock += 9000;
    expect(watcher.recent()).toBe(false);
    watcher.dispose();
  });

  it("聊天区消息命中：含本人昵称且带 cut", () => {
    let clock = 1000;
    const watcher = new CutWatcher(
      () => undefined,
      () => clock,
      () => "铭铭280",
    );
    watcher.feedMessage("铭铭280 cut");
    expect(watcher.recent()).toBe(true);
    watcher.consume();
    watcher.feedMessage("北城空 cut");
    expect(watcher.recent()).toBe(false);
    watcher.feedMessage("铭铭280 我要 cut 一下");
    expect(watcher.recent()).toBe(false);
    watcher.feedMessage("铭铭280 recut");
    expect(watcher.recent()).toBe(false);
    watcher.consume();
    watcher.feedMessage("铭铭280 CUT");
    expect(watcher.recent()).toBe(true);
    watcher.consume();
    watcher.feedMessage("铭铭280：cut");
    expect(watcher.recent()).toBe(true);
    watcher.consume();
    watcher.feedMessage("12:34 铭铭280 cut");
    expect(watcher.recent()).toBe(true);
    watcher.consume();
    watcher.feedMessage("铭铭280 说我 cut");
    expect(watcher.recent()).toBe(true);
    watcher.dispose();
  });

  it("观察器把新增聊天节点喂进判定", async () => {
    const watcher = new CutWatcher(
      () => undefined,
      () => 1000,
      () => "铭铭280",
      document,
    );
    watcher.tick();
    const box = document.createElement("div");
    box.className = "msgholderBox";
    document.body.append(box);
    const msg = document.createElement("div");
    msg.className = "msg";
    msg.textContent = "铭铭280 cut";
    box.append(msg);
    await Promise.resolve();
    expect(watcher.recent()).toBe(true);
    watcher.dispose();
  });

  it("consume 后不再命中，重复 tick 不会二次包装", () => {
    const socket = hostSocket();
    const watcher = new CutWatcher(
      () => socket,
      () => 1000,
      () => "铭铭280",
    );
    watcher.tick();
    const patched = socket.send;
    watcher.tick();
    expect(socket.send).toBe(patched);
    socket.send(chat("cut"));
    watcher.consume();
    expect(watcher.recent()).toBe(false);
    watcher.dispose();
  });
});
