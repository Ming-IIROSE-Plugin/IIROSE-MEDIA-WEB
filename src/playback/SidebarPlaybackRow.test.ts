import { afterEach, describe, expect, it, vi } from "vitest";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { Socket } from "../iirose_func/Socket";
import { snapshot } from "./fixtures";
import { PlaybackMode } from "./PlaybackMode";
import { SidebarPlaybackRow } from "./SidebarPlaybackRow";

vi.mock("../iirose_func/ShowMessage", () => ({
  ShowMessage: { show: vi.fn() },
}));
const show = ShowMessage.show as unknown as ReturnType<typeof vi.fn>;

const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
const pressed = (id: string) => button(id).getAttribute("aria-pressed");
const disabled = (id: string) => button(id).getAttribute("aria-disabled");
const status = () =>
  document.querySelector("#imw-playback-controls [role='status']")!.textContent;

function setup() {
  const mode = new PlaybackMode();
  mode.setMediaPresent(true);
  mode.applySnapshot(snapshot());
  const row = new SidebarPlaybackRow(mode);
  document.body.append(row.element);
  return { mode, row };
}

afterEach(() => {
  document.body.innerHTML = "";
  show.mockClear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("侧栏播放模式开关行", () => {
  it("渲染一行两枚熄灭按钮与自包含图标", () => {
    const { row } = setup();
    expect(row.element.id).toBe("imw-playback-controls");
    expect(row.element.getAttribute("role")).toBe("group");
    expect(row.element.getAttribute("aria-label")).toBe("播放模式");
    expect(row.element.querySelectorAll("button")).toHaveLength(2);
    expect(button("imw-toggle-loop").textContent).toBe("单曲循环");
    expect(button("imw-toggle-shuffle").textContent).toBe("收藏随机");
    for (const id of ["imw-toggle-loop", "imw-toggle-shuffle"]) {
      expect(pressed(id)).toBe("false");
      expect(disabled(id)).toBe("false");
      expect(button(id).title).toBe(
        id === "imw-toggle-loop" ? "单曲循环" : "收藏随机",
      );
      const icon = button(id).querySelector("svg")!;
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(icon.querySelector("path")!.getAttribute("d")).toBeTruthy();
    }
  });

  it("点击互斥点亮，两枚按钮的 aria-pressed 同步更新", () => {
    setup();
    button("imw-toggle-loop").click();
    expect(pressed("imw-toggle-loop")).toBe("true");
    expect(pressed("imw-toggle-shuffle")).toBe("false");
    button("imw-toggle-shuffle").click();
    expect(pressed("imw-toggle-loop")).toBe("false");
    expect(pressed("imw-toggle-shuffle")).toBe("true");
    button("imw-toggle-shuffle").click();
    expect(pressed("imw-toggle-shuffle")).toBe("false");
    expect(show).not.toHaveBeenCalled();
  });

  it("点击只改状态与外观，不构造 socket 也不发任何报文", () => {
    const send = vi.fn();
    vi.stubGlobal("socket", { readyState: 1, send });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const socketSend = vi.spyOn(Socket.prototype, "sendMessage");
    const { mode } = setup();
    button("imw-toggle-loop").click();
    button("imw-toggle-shuffle").click();
    expect(mode.mode).toBe("shuffle");
    expect(send).not.toHaveBeenCalled();
    expect(socketSend).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("无当前媒体时只有循环灰化，收藏随机仍可开启", () => {
    const { mode } = setup();
    mode.setMediaPresent(false);
    expect(disabled("imw-toggle-loop")).toBe("true");
    expect(button("imw-toggle-loop").title).toBe("直播或时间未知，无法使用");
    // 收藏随机不依赖当前媒体：空闲也能直接开始
    expect(disabled("imw-toggle-shuffle")).toBe("false");
    button("imw-toggle-loop").click();
    expect(show).toHaveBeenCalledExactlyOnceWith("直播或时间未知，无法使用");
    expect(pressed("imw-toggle-loop")).toBe("false");
    expect(mode.mode).toBe("none");
    button("imw-toggle-shuffle").click();
    expect(pressed("imw-toggle-shuffle")).toBe("true");
  });

  it("灰化按钮仍可聚焦，Enter 触发同样的原因提示", () => {
    const { mode } = setup();
    mode.setMediaPresent(false);
    const loop = button("imw-toggle-loop");
    loop.focus();
    expect(document.activeElement).toBe(loop);
    loop.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(show).toHaveBeenCalledExactlyOnceWith("直播或时间未知，无法使用");
    expect(pressed("imw-toggle-loop")).toBe("false");
    expect(mode.mode).toBe("none");
    // 读屏用的原因文本同步写入状态区。
    expect(
      document.querySelector("#imw-playback-controls [role='status']")!
        .textContent,
    ).toBe("直播或时间未知，无法使用");
  });

  it("连点灰化按钮同一原因 10 秒内只提示一次", () => {
    vi.useFakeTimers();
    const { mode } = setup();
    mode.applySnapshot(snapshot({ connected: false }));
    const reason = "连接未就绪或已断开，暂时无法调整";
    button("imw-toggle-loop").click();
    button("imw-toggle-loop").click();
    expect(show).toHaveBeenCalledExactlyOnceWith(reason);
    vi.advanceTimersByTime(5000);
    button("imw-toggle-loop").click();
    expect(show).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(5001);
    button("imw-toggle-loop").click();
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("点亮后转为不可用即熄灭并提示一次原因", () => {
    vi.useFakeTimers();
    const { mode } = setup();
    button("imw-toggle-loop").click();
    expect(pressed("imw-toggle-loop")).toBe("true");
    mode.applySnapshot(snapshot({ duration: null }));
    expect(pressed("imw-toggle-loop")).toBe("false");
    expect(disabled("imw-toggle-loop")).toBe("true");
    expect(button("imw-toggle-loop").title).toBe("直播或时间未知，无法使用");
    expect(show).toHaveBeenCalledExactlyOnceWith("直播或时间未知，无法使用");
    // 同一个原因在 10 秒窗口内不再重复（含用户点击灰化按钮）。
    button("imw-toggle-loop").click();
    mode.applySnapshot(snapshot());
    button("imw-toggle-loop").click();
    mode.applySnapshot(snapshot({ duration: 0 }));
    expect(show).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10001);
    mode.applySnapshot(snapshot());
    button("imw-toggle-loop").click();
    mode.applySnapshot(snapshot({ duration: 0 }));
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("未知 data-imw-mode 点击直接忽略，不抛错也不改状态", () => {
    const { mode, row } = setup();
    const stray = document.createElement("button");
    stray.dataset.imwMode = "repeat-all";
    row.element.append(stray);
    expect(() => stray.click()).not.toThrow();
    const plain = document.createElement("button");
    row.element.append(plain);
    expect(() => plain.click()).not.toThrow();
    expect(mode.mode).toBe("none");
    expect(show).not.toHaveBeenCalled();
  });

  it("dispose 移除容器并停止响应状态变化", () => {
    const { mode, row } = setup();
    const loop = button("imw-toggle-loop");
    loop.click();
    row.dispose();
    expect(document.getElementById("imw-playback-controls")).toBeNull();
    mode.toggle("shuffle");
    expect(loop.getAttribute("aria-pressed")).toBe("true");
    // 卸载后游离节点上的点击也不得再改状态或提示。
    loop.click();
    expect(mode.mode).toBe("shuffle");
    expect(show).not.toHaveBeenCalled();
    row.dispose();
  });
});

describe("开关行的点播归属与生命周期", () => {
  const STANDBY = "当前曲目由他人点播，暂不自动续播";
  const ROOM_CHANGED = "已切换房间，播放模式已关闭";

  it("他人点播：仍点亮、不灰化，只以 title 与读屏文本说明", () => {
    const { mode } = setup();
    button("imw-toggle-loop").click();
    mode.applySnapshot(snapshot({ ownMedia: false }));
    expect(pressed("imw-toggle-loop")).toBe("true");
    expect(disabled("imw-toggle-loop")).toBe("false");
    expect(button("imw-toggle-loop").title).toBe(STANDBY);
    expect(status()).toBe(STANDBY);
    // 未点亮的另一枚不显示待命原因，也不承担待命语义。
    expect(button("imw-toggle-shuffle").title).toBe("收藏随机");
    // 待命不弹提示，避免别人每点一首就刷屏。
    expect(show).not.toHaveBeenCalled();
  });

  it("本人重新点播立即退出待命，title 与读屏文本恢复", () => {
    const { mode } = setup();
    button("imw-toggle-loop").click();
    mode.applySnapshot(snapshot({ ownMedia: false }));
    expect(status()).toBe(STANDBY);
    mode.applySnapshot(snapshot({ ownMedia: true }));
    expect(pressed("imw-toggle-loop")).toBe("true");
    expect(button("imw-toggle-loop").title).toBe("单曲循环");
    expect(status()).toBe("");
    expect(show).not.toHaveBeenCalled();
  });

  it("换房熄灭并只提示一次原因，按钮不灰化", () => {
    const { mode } = setup();
    button("imw-toggle-loop").click();
    mode.applySnapshot(snapshot({ roomKey: "another-room" }));
    expect(pressed("imw-toggle-loop")).toBe("false");
    expect(disabled("imw-toggle-loop")).toBe("false");
    expect(button("imw-toggle-loop").title).toBe("单曲循环");
    expect(show).toHaveBeenCalledExactlyOnceWith(ROOM_CHANGED);
    expect(status()).toBe(ROOM_CHANGED);
    // 同一房间的后续快照（250ms 轮询）不再重复提示。
    mode.applySnapshot(snapshot({ roomKey: "another-room" }));
    expect(show).toHaveBeenCalledOnce();
  });

  it("换房同时断线时只提示房间原因一次", () => {
    const { mode } = setup();
    button("imw-toggle-loop").click();
    mode.applySnapshot(snapshot({ roomKey: "another-room", connected: false }));
    expect(show).toHaveBeenCalledExactlyOnceWith(ROOM_CHANGED);
    expect(status()).toBe(ROOM_CHANGED);
  });

  it("待命后关闭开关即清除读屏文本，不影响后续原因提示", () => {
    const { mode } = setup();
    button("imw-toggle-loop").click();
    mode.applySnapshot(snapshot({ ownMedia: false }));
    expect(status()).toBe(STANDBY);
    button("imw-toggle-loop").click();
    expect(status()).toBe("");
    expect(button("imw-toggle-loop").title).toBe("单曲循环");
    mode.setMediaPresent(false);
    button("imw-toggle-loop").click();
    expect(status()).toBe("直播或时间未知，无法使用");
    expect(show).toHaveBeenCalledExactlyOnceWith("直播或时间未知，无法使用");
  });

  it("退出待命不清掉后到的原因提示", () => {
    const { mode } = setup();
    button("imw-toggle-loop").click();
    mode.applySnapshot(snapshot({ ownMedia: false }));
    expect(status()).toBe(STANDBY);
    // 待命期间另一枚按钮因模式自身原因灰化，点击写入新的提示文本。
    mode.setAvailability("shuffle", {
      enabled: false,
      reason: "当前页面没有收藏",
    });
    button("imw-toggle-shuffle").click();
    expect(status()).toBe("当前页面没有收藏");
    expect(show).toHaveBeenCalledExactlyOnceWith("当前页面没有收藏");
    // 此时退出待命（关闭循环）只清待命文案，不覆盖已经写入的原因提示。
    button("imw-toggle-loop").click();
    expect(pressed("imw-toggle-loop")).toBe("false");
    expect(status()).toBe("当前页面没有收藏");
    expect(show).toHaveBeenCalledOnce();
  });

  it("两次换房各提示一次，不被同因 10 秒去重吞掉", () => {
    const { mode } = setup();
    button("imw-toggle-loop").click();
    mode.applySnapshot(snapshot({ roomKey: "room-b" }));
    expect(show).toHaveBeenCalledExactlyOnceWith(ROOM_CHANGED);
    mode.toggle("loop");
    expect(pressed("imw-toggle-loop")).toBe("true");
    mode.applySnapshot(snapshot({ roomKey: "room-c" }));
    expect(show).toHaveBeenCalledTimes(2);
    expect(show.mock.calls).toEqual([[ROOM_CHANGED], [ROOM_CHANGED]]);
    expect(pressed("imw-toggle-loop")).toBe("false");
  });
});
