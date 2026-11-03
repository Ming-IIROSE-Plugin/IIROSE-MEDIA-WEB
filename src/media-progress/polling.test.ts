import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HostMediaBridge, type MediaHost } from "./HostMediaBridge";

function fixture() {
  const host = {} as MediaHost;
  document.body.innerHTML =
    '<div id="shareMediaSongName">同名媒体</div><div id="shareMediaUserName"></div>';
  return new HostMediaBridge(host, document, vi.fn());
}

describe("媒体轮询节奏", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("没有活跃场景时按 1s 轮询", () => {
    const bridge = fixture();
    const listener = vi.fn();
    const off = bridge.subscribe(listener);
    listener.mockClear();

    vi.advanceTimersByTime(250);
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(750);
    expect(listener).toHaveBeenCalledTimes(1);

    off();
  });

  it("标记活跃场景后切到 250ms，释放后退回 1s", () => {
    const bridge = fixture();
    const listener = vi.fn();
    const off = bridge.subscribe(listener);

    bridge.setActive("panel", true);
    listener.mockClear();
    vi.advanceTimersByTime(250);
    expect(listener).toHaveBeenCalledTimes(1);

    bridge.setActive("panel", false);
    listener.mockClear();
    vi.advanceTimersByTime(250);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(750);
    expect(listener).toHaveBeenCalledTimes(1);

    off();
  });

  it("多个活跃场景互相独立：最后一个释放才降频", () => {
    const bridge = fixture();
    const listener = vi.fn();
    const off = bridge.subscribe(listener);

    bridge.setActive("panel", true);
    bridge.setActive("loop", true);
    bridge.setActive("panel", false);
    listener.mockClear();
    vi.advanceTimersByTime(250);
    expect(listener).toHaveBeenCalledTimes(1);

    bridge.setActive("loop", false);
    listener.mockClear();
    vi.advanceTimersByTime(250);
    expect(listener).not.toHaveBeenCalled();

    off();
  });

  it("poke 立即刷新一次，不改变已有节奏", () => {
    const bridge = fixture();
    const listener = vi.fn();
    const off = bridge.subscribe(listener);

    listener.mockClear();
    bridge.poke();
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(250);
    expect(listener).toHaveBeenCalledTimes(1);

    off();
  });

  it("最后一个订阅者退订后停表，重新订阅按当前活跃标记起表", () => {
    const bridge = fixture();
    const first = vi.fn();
    const off = bridge.subscribe(first);
    bridge.setActive("panel", true);
    off();

    first.mockClear();
    vi.advanceTimersByTime(2000);
    expect(first).not.toHaveBeenCalled();

    const second = vi.fn();
    const off2 = bridge.subscribe(second);
    expect(second).toHaveBeenCalledTimes(1); // 订阅时立即回读一次
    second.mockClear();
    // 活跃标记还在：重新起表按 250ms。
    vi.advanceTimersByTime(250);
    expect(second).toHaveBeenCalledTimes(1);
    off2();
  });
});
