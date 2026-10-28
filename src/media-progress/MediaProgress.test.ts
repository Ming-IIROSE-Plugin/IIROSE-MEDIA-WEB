import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import { IMCInit } from "../page";
import { Socket } from "../iirose_func/Socket";
import type { MediaHost } from "./HostMediaBridge";
import {
  MEDIA_PROGRESS_POSITION_KEY,
  readMediaProgressPosition,
  saveMediaProgressPosition,
} from "./PositionStorage";

vi.mock("../page/MainAppControlLayer", () => ({
  MainAppControlLayer: () => null,
}));
const send = vi.fn();
const chat = { moveinputDo: vi.fn(), msgfetch: vi.fn(), getcontents: vi.fn() };

let range: HTMLInputElement;
let resizePanel: () => void;
const entry = () => document.getElementById("imw-media-progress-entry")!;
const panel = () => document.getElementById("imw-media-progress");
/** 头部行（拖动手柄）：关闭钮所在行，而非移动端拖拽条。 */
const headerRow = (floating: HTMLElement) =>
  floating.querySelector<HTMLElement>('[aria-label="关闭播放进度"]')!
    .parentElement!;
function key(value: string, repeat = false) {
  act(() => {
    range.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: value,
        repeat,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}
function value(type: "input" | "change", target: number) {
  act(() => {
    range.value = String(target);
    range.dispatchEvent(new Event(type, { bubbles: true }));
  });
}
function pointer(type: string, x = 40) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: x,
  });
  act(() => {
    range.dispatchEvent(event);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  send.mockClear();
  localStorage.removeItem(MEDIA_PROGRESS_POSITION_KEY);
  for (const method of Object.values(chat)) method.mockClear();
  vi.spyOn(Socket.prototype, "sendMessage");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizePanel = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, "scrollX", {
    configurable: true,
    value: 0,
  });
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: 0,
  });
  Object.assign(window, {
    shareMediaCurrentTime: 80,
    shareMediaDuration: 300,
    socket: { readyState: 1, send },
    rank: "0",
    myself: "",
    Probe: { admin: { blockPubChat: 0 } },
    roomnFull: "component-room",
    Info: { room: { identity: 1 } },
    ...chat,
    shareMedia: () => {},
    Utils: {
      service: {
        isShareMediaPlaying: () => true,
        seekDemandMedia: vi.fn((time: number) => {
          window.shareMediaCurrentTime = time;
        }),
        ...chat,
      },
    },
  });
  document.body.innerHTML =
    '<div id="mainContainer"></div><div id="functionHolder"><div id="functionHolderExtBox"><div class="functionButtonExt"><div id="shareMediaBox"></div></div></div></div>';
  act(() => {
    IMCInit.init(document.getElementById("mainContainer") as HTMLDivElement);
  });
  vi.spyOn(entry(), "getClientRects").mockReturnValue([
    new DOMRect(0, 0, 100, 44),
  ] as unknown as DOMRectList);
  act(() => {
    entry().click();
  });
  range = document.querySelector("#imw-media-progress input")!;
  range.setPointerCapture = vi.fn();
  vi.spyOn(range, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 100, 44),
  );
});
afterEach(() => {
  act(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false }),
    );
  });
  expect(Socket.prototype.sendMessage).not.toHaveBeenCalled();
  for (const method of Object.values(chat))
    expect(method).not.toHaveBeenCalled();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("浮窗原生交互与页面生命周期", () => {
  it("本人通道允许操作，等待和回执均保留房间发言提示，禁言后禁用", () => {
    const host = window as unknown as MediaHost;
    const ownerSend = vi.fn();
    host.myself = "测试账号";
    host.Info!.room!.identity = 0;
    host.Utils!.service!.moveinputDo = ownerSend;
    const owner = document.createElement("div");
    owner.id = "shareMediaUserName";
    owner.title = "测试账号";
    document.body.append(owner);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    const notice = "本人点播模式：调整会在房间发送快进/快退消息";
    expect(range.disabled).toBe(false);
    expect(panel()!.textContent).toContain(notice);
    const control = panel()!.querySelector<HTMLButtonElement>(
      '[aria-label="快进1秒"]',
    )!;
    expect(control.disabled).toBe(false);
    act(() => control.click());
    expect(ownerSend).toHaveBeenCalledExactlyOnceWith("快进1s");
    expect(send).not.toHaveBeenCalled();
    expect(panel()!.textContent).toContain(notice);
    expect(panel()!.textContent).toContain("等待宿站更新");
    expect(range.disabled).toBe(true);
    act(() => {
      host.Utils!.service!.seekDemandMedia!(81);
    });
    expect(range.disabled).toBe(false);
    expect(control.disabled).toBe(false);
    expect(panel()!.textContent).toContain(notice);
    expect(panel()!.textContent).toContain("宿站进度已更新");
    host.Probe!.admin!.blockPubChat = 1;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(range.disabled).toBe(true);
    expect(control.disabled).toBe(true);
    expect(panel()!.textContent).toContain("当前被禁止公聊");
  });
  it("普通身份即时禁用滑块和四个按钮，但仍显示媒体资料与权限原因", () => {
    const host = window as typeof window & {
      Info: { room: { identity: unknown } };
      rank: unknown;
    };
    host.Info.room.identity = 0;
    host.rank = "4";
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(range.disabled).toBe(true);
    expect(
      [
        ...document.querySelectorAll<HTMLButtonElement>(
          "#imw-media-progress button",
        ),
      ]
        .filter(
          (button) =>
            button !== document.querySelector('[aria-label="关闭播放进度"]'),
        )
        .every((button) => button.disabled),
    ).toBe(true);
    expect(panel()!.textContent).toContain("当前房间无媒体管理权限");
    expect(panel()!.textContent).toContain("未命名媒体");
    act(() => {
      range.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(send).not.toHaveBeenCalled();
  });
  it("0.8缩放下标题栏拖动与视口收缩保持浮窗和关闭按钮可达", () => {
    const viewport = Object.assign(new EventTarget(), {
      width: 400,
      height: 640,
    });
    vi.stubGlobal("visualViewport", viewport);
    act(() => {
      document
        .querySelector<HTMLButtonElement>('[aria-label="关闭播放进度"]')!
        .click();
    });
    act(() => {
      entry().click();
    });
    const floating = panel()!;
    const scale = 0.8;
    // jsdom 不布局：按固定卡片尺寸与实际 max-* 样式模拟缩放布局。
    Object.defineProperties(floating, {
      offsetWidth: {
        get: () => Math.min(320, parseFloat(floating.style.maxWidth) || 320),
      },
      offsetHeight: {
        get: () => Math.min(270, parseFloat(floating.style.maxHeight) || 270),
      },
    });
    vi.spyOn(floating, "getBoundingClientRect").mockImplementation(
      () =>
        new DOMRect(
          parseFloat(floating.style.left) * scale,
          parseFloat(floating.style.top) * scale,
          floating.offsetWidth * scale,
          floating.offsetHeight * scale,
        ),
    );
    act(() => {
      resizePanel();
    });
    expect(floating.style.maxWidth).toBe("476px");
    expect(floating.style.maxHeight).toBe("776px");
    const title = headerRow(floating);
    title.setPointerCapture = vi.fn();
    const drag = (type: string, x: number, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, {
        pointerId: 7,
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
      });
      act(() => {
        title.dispatchEvent(event);
      });
    };
    drag("pointerdown", 20, 80);
    drag("pointermove", 100, 120);
    expect(title.setPointerCapture).toHaveBeenCalledWith(7);
    expect([floating.style.left, floating.style.top]).toEqual([
      "112px",
      "130px",
    ]);
    drag("pointermove", 1000, 1000);
    drag("pointerup", 1000, 1000);
    expect([floating.style.left, floating.style.top]).toEqual([
      "168px",
      "518px",
    ]);
    viewport.width = 240;
    viewport.height = 200;
    act(() => {
      viewport.dispatchEvent(new Event("resize"));
    });
    act(() => {
      resizePanel();
    });
    expect([floating.style.maxWidth, floating.style.maxHeight]).toEqual([
      "276px",
      "226px",
    ]);
    expect([floating.style.left, floating.style.top]).toEqual(["12px", "12px"]);
    const rect = floating.getBoundingClientRect();
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(viewport.width);
    expect(rect.bottom).toBeLessThanOrEqual(viewport.height);
    const close = floating.querySelector<HTMLButtonElement>(
      '[aria-label="关闭播放进度"]',
    )!;
    act(() => {
      close.focus();
    });
    expect(document.activeElement).toBe(close);
    act(() => {
      close.click();
    });
    expect(panel()).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
  it("关闭后重开及页面重新初始化都恢复本地位置", () => {
    const floating = panel()!;
    Object.defineProperties(floating, {
      offsetWidth: { configurable: true, get: () => 320 },
      offsetHeight: { configurable: true, get: () => 250 },
    });
    vi.spyOn(floating, "getBoundingClientRect").mockImplementation(
      () =>
        new DOMRect(
          parseFloat(floating.style.left) || 0,
          parseFloat(floating.style.top) || 0,
          floating.offsetWidth,
          floating.offsetHeight,
        ),
    );
    const title = headerRow(floating);
    title.setPointerCapture = vi.fn();
    const drag = (type: string, x: number, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, {
        pointerId: 8,
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
      });
      act(() => {
        title.dispatchEvent(event);
      });
    };
    drag("pointerdown", 20, 90);
    drag("pointermove", 308, 290);
    drag("pointerup", 308, 290);
    const saved = [floating.style.left, floating.style.top];
    act(() => {
      floating
        .querySelector<HTMLButtonElement>('[aria-label="关闭播放进度"]')!
        .click();
      entry().click();
    });
    expect([panel()!.style.left, panel()!.style.top]).toEqual(saved);
    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: false }),
      );
      IMCInit.init(document.getElementById("mainContainer") as HTMLDivElement);
      document.getElementById("imw-media-progress-entry")!.click();
    });
    expect([panel()!.style.left, panel()!.style.top]).toEqual(saved);
  });
  it("关闭期间视口缩小，重开时把记忆位置收敛到可见范围", () => {
    const floating = panel()!;
    Object.defineProperties(floating, {
      offsetWidth: { configurable: true, get: () => 320 },
      offsetHeight: { configurable: true, get: () => 250 },
    });
    vi.spyOn(floating, "getBoundingClientRect").mockImplementation(
      () =>
        new DOMRect(
          parseFloat(floating.style.left) || 0,
          parseFloat(floating.style.top) || 0,
          floating.offsetWidth * 0.8,
          floating.offsetHeight * 0.8,
        ),
    );
    const title = headerRow(floating);
    title.setPointerCapture = vi.fn();
    const down = new Event("pointerdown", { bubbles: true, cancelable: true });
    Object.assign(down, {
      pointerId: 9,
      isPrimary: true,
      button: 0,
      clientX: 20,
      clientY: 90,
    });
    const move = new Event("pointermove", { bubbles: true, cancelable: true });
    Object.assign(move, {
      pointerId: 9,
      isPrimary: true,
      button: 0,
      clientX: 900,
      clientY: 700,
    });
    act(() => {
      title.dispatchEvent(down);
      title.dispatchEvent(move);
      title.dispatchEvent(
        Object.assign(new Event("pointerup", { bubbles: true }), {
          pointerId: 9,
          isPrimary: true,
          button: 0,
          clientX: 900,
          clientY: 700,
        }),
      );
      floating
        .querySelector<HTMLButtonElement>('[aria-label="关闭播放进度"]')!
        .click();
    });
    const viewport = Object.assign(new EventTarget(), {
      width: 240,
      height: 200,
      offsetLeft: 0,
      offsetTop: 0,
    });
    vi.stubGlobal("visualViewport", viewport);
    act(() => entry().click());
    const reopened = panel()!;
    Object.defineProperties(reopened, {
      offsetWidth: { configurable: true, get: () => 320 },
      offsetHeight: { configurable: true, get: () => 250 },
    });
    vi.spyOn(reopened, "getBoundingClientRect").mockImplementation(
      () =>
        new DOMRect(
          parseFloat(reopened.style.left) || 0,
          parseFloat(reopened.style.top) || 0,
          reopened.offsetWidth * 0.8,
          reopened.offsetHeight * 0.8,
        ),
    );
    act(() => resizePanel());
    expect([reopened.style.left, reopened.style.top]).toEqual(["12px", "12px"]);
    expect([reopened.style.maxWidth, reopened.style.maxHeight]).toEqual([
      "276px",
      "226px",
    ]);
  });
  it("visualViewport平移和页面滚动也会把浮窗校正到当前可见区域", () => {
    const floating = panel()!;
    Object.defineProperties(floating, {
      offsetWidth: { configurable: true, get: () => 320 },
      offsetHeight: { configurable: true, get: () => 250 },
    });
    vi.spyOn(floating, "getBoundingClientRect").mockImplementation(
      () =>
        new DOMRect(
          parseFloat(floating.style.left) || 0,
          parseFloat(floating.style.top) || 0,
          floating.offsetWidth * 0.8,
          floating.offsetHeight * 0.8,
        ),
    );
    const viewport = Object.assign(new EventTarget(), {
      width: 400,
      height: 640,
      offsetLeft: 80,
      offsetTop: 40,
    });
    vi.stubGlobal("visualViewport", viewport);
    Object.defineProperty(window, "scrollX", {
      configurable: true,
      value: 24,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 16,
    });
    act(() => resizePanel());
    expect([floating.style.left, floating.style.top]).toEqual([
      "142px",
      "82px",
    ]);
  });
  it("内容高度变化重新校正位置，视口变化取消拖动锚点", () => {
    const floating = panel()!;
    let height = 250;
    Object.defineProperties(floating, {
      offsetWidth: { configurable: true, get: () => 320 },
      offsetHeight: { configurable: true, get: () => height },
    });
    vi.spyOn(floating, "getBoundingClientRect").mockImplementation(
      () =>
        new DOMRect(
          parseFloat(floating.style.left) || 0,
          parseFloat(floating.style.top) || 0,
          floating.offsetWidth * 0.8,
          floating.offsetHeight * 0.8,
        ),
    );
    const title = headerRow(floating);
    title.setPointerCapture = vi.fn();
    const drag = (type: string, x: number, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, {
        pointerId: 10,
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
      });
      act(() => {
        title.dispatchEvent(event);
      });
    };
    drag("pointerdown", 20, 90);
    drag("pointermove", 300, 500);
    drag("pointerup", 300, 500);
    height = 700;
    act(() => resizePanel());
    expect(parseFloat(floating.style.top)).toBe(
      window.innerHeight / 0.8 - 700 - 12,
    );
    drag("pointerdown", 20, 90);
    const beforeResize = [floating.style.left, floating.style.top];
    act(() => {
      window.dispatchEvent(new Event("resize"));
      resizePanel();
    });
    drag("pointermove", 300, 500);
    expect([floating.style.left, floating.style.top]).toEqual(beforeResize);
  });
  it("视口监听会在浮窗卸载时移除", () => {
    act(() => {
      document
        .querySelector<HTMLButtonElement>('[aria-label="关闭播放进度"]')!
        .click();
    });
    const viewport = Object.assign(new EventTarget(), {
      width: 400,
      height: 640,
    });
    vi.stubGlobal("visualViewport", viewport);
    const add = vi.spyOn(viewport, "addEventListener");
    const remove = vi.spyOn(viewport, "removeEventListener");
    act(() => entry().click());
    expect(add).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(add).toHaveBeenCalledWith("scroll", expect.any(Function));
    act(() => {
      document
        .querySelector<HTMLButtonElement>('[aria-label="关闭播放进度"]')!
        .click();
    });
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
  it.each([
    ["快进1秒", '!15[">","1s"]'],
    ["快退1秒", '!15["<","1s"]'],
    ["快进1分钟", '!15[">","1m"]'],
    ["快退1分钟", '!15["<","1m"]'],
  ])("%s 按钮仅发送 %s，5秒无回执显示未确认", (label, command) => {
    act(() => {
      document
        .querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!
        .click();
    });
    expect(send.mock.calls).toEqual([[command]]);
    expect(panel()!.textContent).toContain("等待宿站更新");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(panel()!.textContent).toContain("未收到调整确认，请稍后重试");
    expect(panel()!.textContent).not.toContain("宿站进度已更新");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("授权操作同步定位回读立即确认并恢复控件，5秒后不超时或重发", () => {
    const host = window as unknown as MediaHost;
    send.mockImplementationOnce(() => {
      host.Utils!.service!.seekDemandMedia!(140);
    });
    const controls = ["快退1分钟", "快退1秒", "快进1秒", "快进1分钟"].map(
      (label) =>
        panel()!.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!,
    );
    act(() => {
      controls[3].click();
    });
    expect(send).toHaveBeenCalledExactlyOnceWith('!15[">","1m"]');
    expect(host.shareMediaCurrentTime).toBe(140);
    expect(range.value).toBe("140");
    expect(panel()!.textContent).toContain("宿站进度已更新");
    expect(panel()!.textContent).not.toContain("等待宿站更新");
    expect(range.disabled).toBe(false);
    for (const control of controls) expect(control.disabled).toBe(false);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(panel()!.textContent).toContain("宿站进度已更新");
    expect(panel()!.textContent).not.toContain("未收到调整确认");
    expect(range.disabled).toBe(false);
    for (const control of controls) expect(control.disabled).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it.each([
    [300.8, 300],
    [0.8, 0],
  ])("时长%s按End预览并发送合法末尾%s", (duration, target) => {
    const host = window as unknown as MediaHost;
    host.shareMediaDuration = duration;
    host.shareMediaCurrentTime = 0;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    key("End");
    expect(range.value).toBe(String(target));
    expect(send).not.toHaveBeenCalled();
    key("Enter");
    expect(send).toHaveBeenCalledExactlyOnceWith(`!16["${target}s"]`);
    act(() => {
      host.Utils!.service!.seekDemandMedia!(target);
    });
    expect(range.disabled).toBe(false);
    expect(panel()!.textContent).toContain("宿站进度已更新");
  });
  it("取消后明确的新键盘或指针手势可立即开始", () => {
    key("ArrowRight");
    key("Escape");
    pointer("pointerdown");
    pointer("pointercancel");
    key("ArrowRight");
    key("Enter");
    expect(send).toHaveBeenCalledExactlyOnceWith('!16["81s"]');
  });
  it("原生 input 保持预览，change 只提交一次", () => {
    value("input", 120);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(range.value).toBe("120");
    expect(send).not.toHaveBeenCalled();
    value("change", 120);
    value("change", 120);
    expect(send.mock.calls).toEqual([['!16["120s"]']]);
  });
  it("原生预览 Escape 取消后晚到的 change 不提交，后续 input 可重新操作", () => {
    value("input", 120);
    key("Escape");
    value("change", 120);
    expect(send).not.toHaveBeenCalled();
    expect(panel()).not.toBeNull();
    value("input", 140);
    value("change", 140);
    expect(send.mock.calls).toEqual([['!16["140s"]']]);
  });
  it("辅助技术仅 change 也能提交", () => {
    value("change", 140);
    expect(send.mock.calls).toEqual([['!16["140s"]']]);
  });
  it("键盘仍需 Enter，原生事件不重复提交", () => {
    key("ArrowRight");
    key("ArrowRight");
    value("input", 90);
    value("change", 90);
    expect(send).not.toHaveBeenCalled();
    key("Enter");
    value("change", 82);
    expect(send.mock.calls).toEqual([['!16["82s"]']]);
  });
  it("指针释放提交一次，原生 change 不提前提交", () => {
    pointer("pointerdown");
    value("input", 180);
    value("change", 180);
    expect(send).not.toHaveBeenCalled();
    pointer("pointerup");
    value("change", 120);
    expect(send.mock.calls).toEqual([['!16["120s"]']]);
  });
  it.each(["keyboard", "pointer"])(
    "%s 提交确认后，下一轮 change-only 可提交且同轮尾随事件去重",
    (source) => {
      const host = window as unknown as MediaHost;
      // 同步确认也不能让同一轮尾随 change 重新发送。
      send.mockImplementationOnce(() =>
        host.Utils!.service!.seekDemandMedia!(source === "keyboard" ? 81 : 120),
      );
      if (source === "keyboard") {
        key("ArrowRight");
        key("Enter");
      } else {
        pointer("pointerdown");
        pointer("pointerup");
      }
      value("change", 140);
      expect(send).toHaveBeenCalledOnce();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      value("change", 140);
      value("change", 140);
      expect(send.mock.calls).toEqual([
        [source === "keyboard" ? '!16["81s"]' : '!16["120s"]'],
        ['!16["140s"]'],
      ]);
    },
  );
  it.each([
    ["keyboard", "Escape"],
    ["keyboard", "blur"],
    ["keyboard", "window-blur"],
    ["pointer", "Escape"],
    ["pointer", "pointercancel"],
    ["pointer", "lostpointercapture"],
    ["pointer", "blur"],
    ["pointer", "window-blur"],
    ["native", "Escape"],
  ])(
    "%s 经%s取消后抑制尾随 change，下一轮独立 change 有效",
    (source, cancellation) => {
      if (source === "keyboard") key("ArrowRight");
      else if (source === "pointer") pointer("pointerdown");
      else value("input", 120);
      if (cancellation === "Escape") key("Escape");
      else if (cancellation === "window-blur")
        act(() => {
          window.dispatchEvent(new Event("blur"));
        });
      else if (cancellation === "blur")
        act(() => {
          range.dispatchEvent(new FocusEvent("blur"));
        });
      else pointer(cancellation);
      value("change", 120);
      expect(send).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      value("change", 140);
      expect(send).toHaveBeenCalledExactlyOnceWith('!16["140s"]');
    },
  );
  it("权限变更取消手势后恢复，可使用 change-only 发起新操作", () => {
    const host = window as unknown as MediaHost;
    key("ArrowRight");
    host.Info!.room!.identity = 0;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    value("change", 120);
    expect(send).not.toHaveBeenCalled();
    host.Info!.room!.identity = 1;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    value("change", 140);
    expect(send).toHaveBeenCalledExactlyOnceWith('!16["140s"]');
  });
  it("相对请求三秒后回读143恢复UI，五秒后不覆盖确认", () => {
    const host = window as unknown as MediaHost;
    act(() => {
      panel()!
        .querySelector<HTMLButtonElement>('[aria-label="快进1分钟"]')!
        .click();
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(range.disabled).toBe(true);
    act(() => {
      host.Utils!.service!.seekDemandMedia!(143);
    });
    expect(range.disabled).toBe(false);
    expect(range.value).toBe("143");
    expect(panel()!.textContent).toContain("宿站进度已更新");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(panel()!.textContent).toContain("宿站进度已更新");
    expect(send).toHaveBeenCalledExactlyOnceWith('!15[">","1m"]');
  });
  it("取消指针后晚到的 change 不发送", () => {
    pointer("pointerdown");
    pointer("pointercancel");
    value("change", 120);
    expect(send).not.toHaveBeenCalled();
  });
  it("Escape 先取消预览，再关闭；长按不误关闭，焦点回到可见入口", () => {
    key("ArrowRight");
    key("Escape");
    key("Escape", true);
    expect(panel()).not.toBeNull();
    expect(send).not.toHaveBeenCalled();
    key("Escape");
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(entry());
  });
  it("关闭按钮恢复焦点，但隐藏入口不抢焦点", () => {
    act(() => {
      document
        .querySelector<HTMLButtonElement>('[aria-label="关闭播放进度"]')!
        .click();
    });
    expect(document.activeElement).toBe(entry());
    act(() => {
      entry().click();
    });
    vi.mocked(entry().getClientRects).mockReturnValue(
      [] as unknown as DOMRectList,
    );
    const focus = vi.spyOn(entry(), "focus");
    act(() => {
      document
        .querySelector<HTMLButtonElement>('[aria-label="关闭播放进度"]')!
        .click();
    });
    expect(focus).not.toHaveBeenCalled();
  });
  it("bfcache pagehide/pageshow 保留唯一可用实例，离开页面清理监听", () => {
    const original = panel();
    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      );
    });
    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );
    });
    expect(panel()).toBe(original);
    expect(document.querySelectorAll("#imw-media-progress-root")).toHaveLength(
      1,
    );
    value("change", 120);
    expect(send).toHaveBeenCalledOnce();
    const remove = vi.spyOn(window, "removeEventListener");
    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: false }),
      );
    });
    expect(document.getElementById("imw-media-progress-root")).toBeNull();
    expect(remove).toHaveBeenCalledWith("pagehide", expect.any(Function));
    // Preact 已排队的渲染调度可在卸载后完成；业务超时与轮询不得继续。
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(send).toHaveBeenCalledOnce();
  });

  it("重复注入时后注入者接管：行、入口与订阅始终只有一份", async () => {
    const container = document.getElementById(
      "mainContainer",
    ) as HTMLDivElement;
    const first = document.getElementById("imw-playback-controls")!;
    // 收藏候选是异步读取的：先让首帧的异步查询落地，再取定时器基线。
    const flush = async () => {
      for (let index = 0; index < 8; index++) await Promise.resolve();
      // 收藏库是 IndexedDB：让挂起的 0ms 定时器落地，避免把瞬时定时器算进基线。
      await vi.advanceTimersByTimeAsync(0);
    };
    await flush();
    // 每份控制器各持一个 250ms 轮询定时器：接管必须同时换掉旧定时器。
    const timers = vi.getTimerCount();
    // 同一份 bundle 内重复初始化（热更新/多入口）。
    act(() => IMCInit.init(container));
    await flush();
    expect(document.querySelectorAll("#imw-playback-controls")).toHaveLength(1);
    expect(first.isConnected).toBe(false);
    const second = document.getElementById("imw-playback-controls")!;
    expect(second).not.toBe(first);
    expect(vi.getTimerCount()).toBe(timers);
    // 另一份 bundle 实例：模块级标记是全新的，只能靠页面级单例键接管。
    vi.resetModules();
    const reloaded = await import("../page");
    act(() => reloaded.IMCInit.init(container));
    await flush();
    expect(document.querySelectorAll("#imw-playback-controls")).toHaveLength(1);
    expect(document.querySelectorAll("#imw-media-progress-entry")).toHaveLength(
      1,
    );
    expect(document.querySelectorAll("#imw-media-progress-root")).toHaveLength(
      1,
    );
    // 旧实例的轮询必须随接管停掉，否则同页会有两份发布。
    expect(vi.getTimerCount()).toBe(timers);
    const third = document.getElementById("imw-playback-controls")!;
    expect(third).not.toBe(second);
    expect(second.isConnected).toBe(false);
    // 新实例的接线完整：快照与媒体存在性都接通后才能点亮。
    const loop = third.querySelector<HTMLButtonElement>("#imw-toggle-loop")!;
    act(() => loop.click());
    expect(loop.getAttribute("aria-pressed")).toBe("true");
  });

  it("组合根装配开关行：媒体消失只灰化循环，卸载后移除且无遗留定时器", async () => {
    const host = window as unknown as MediaHost;
    const alert = vi.fn();
    Object.assign(window, { _alert: alert });
    const row = document.getElementById("imw-playback-controls")!;
    expect(row.closest("#functionHolderExtBox")).not.toBeNull();
    const buttons = [...row.querySelectorAll("button")];
    const attrs = (name: string) =>
      buttons.map((item) => item.getAttribute(name));
    expect(buttons.map((item) => item.id)).toEqual([
      "imw-toggle-loop",
      "imw-toggle-shuffle",
    ]);
    expect(attrs("aria-disabled")).toEqual(["false", "false"]);
    expect(attrs("aria-pressed")).toEqual(["false", "false"]);
    // 点亮循环：只有 onMediaChange/setMediaPresent 与快照都接通时才可能成功。
    buttons[0].click();
    expect(attrs("aria-pressed")).toEqual(["true", "false"]);
    // 媒体行消失（时长与连接都还在）：第四个实参漏接时按钮会一直亮着可点。
    const card = document.getElementById("shareMediaBox")!.parentElement!;
    card.remove();
    for (let index = 0; index < 5; index++) await Promise.resolve();
    expect(host.shareMediaDuration).toBe(300);
    expect(host.socket!.readyState).toBe(1);
    // 媒体消失只影响循环；收藏随机不依赖当前媒体，仍可开启。
    expect(attrs("aria-disabled")).toEqual(["true", "false"]);
    expect(attrs("aria-pressed")).toEqual(["false", "false"]);
    expect(
      document.getElementById("functionHolderExtBox")!.lastElementChild,
    ).toBe(row);
    // 夹具里的曲目不是本人点播：亲手点亮即进入待命，当场说明一次。
    expect(alert.mock.calls).toEqual([
      ["当前曲目由他人点播，暂不自动续播"],
      ["直播或时间未知，无法使用"],
    ]);
    // 媒体回来后重新可用，可继续验证 bridge.subscribe 这根线。
    document.getElementById("functionHolderExtBox")!.append(card);
    for (let index = 0; index < 5; index++) await Promise.resolve();
    expect(attrs("aria-disabled")).toEqual(["false", "false"]);
    host.socket!.readyState = 3;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(attrs("aria-disabled")).toEqual(["true", "true"]);
    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: false }),
      );
    });
    expect(document.getElementById("imw-playback-controls")).toBeNull();
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(vi.getTimerCount()).toBe(0);
    delete (window as { _alert?: unknown })._alert;
  });
});

describe("浮窗外观与收藏随机统一（CAP-6）", () => {
  const classes = (element: Element) => element.className.split(/\s+/);
  const reopen = () => {
    act(() => {
      document
        .querySelector<HTMLButtonElement>('[aria-label="关闭播放进度"]')!
        .click();
    });
    act(() => {
      entry().click();
    });
  };
  const steps = () =>
    ["快退1分钟", "快退1秒", "快进1秒", "快进1分钟"].map((label) =>
      panel()!.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!,
    );

  it("头部为拖拽条 + SVG 图标、15px 标题、SVG 关闭钮，与收藏随机一样不加分隔线", () => {
    const [grip, header, content] = Array.from(panel()!.children);
    expect(grip.getAttribute("aria-hidden")).toBe("true");
    expect(classes(grip)).toEqual(
      expect.arrayContaining(["hidden", "max-[768px]:flex", "cursor-grab"]),
    );
    expect(classes(header)).toEqual(
      expect.arrayContaining(["h-12", "pl-4", "cursor-grab", "touch-none"]),
    );
    const [icon, title, close] = Array.from(header.children);
    expect(icon.className).toContain("text-sky-500");
    expect(icon.querySelector("svg")).not.toBeNull();
    expect(title.textContent).toBe("播放进度");
    expect(classes(title)).toEqual(
      expect.arrayContaining(["text-[15px]", "font-semibold"]),
    );
    expect(close.getAttribute("aria-label")).toBe("关闭播放进度");
    expect(classes(close)).toEqual(
      expect.arrayContaining(["h-11", "w-11", "ml-auto"]),
    );
    expect(close.querySelector("svg")).not.toBeNull();
    expect(close.textContent).toBe("");
    expect(panel()!.textContent).not.toContain("⠿");
    expect(panel()!.textContent).not.toContain("×");
    expect(panel()!.querySelector("#imw-progress-icon")).toBeNull();
    expect(panel()!.children).toHaveLength(3);
    expect(classes(content)).toEqual(expect.arrayContaining(["px-4"]));
    expect(classes(content)).not.toContain("border-t");
    expect(classes(panel()!)).not.toContain("p-3");
    expect(panel()!.getAttribute("aria-labelledby")).toBe(title.id);
    expect(panel()!.hasAttribute("aria-label")).toBe(false);
  });

  it("拖拽条与头部行都能拖动，在关闭钮上按下不拖动", () => {
    const floating = panel()!;
    Object.defineProperties(floating, {
      offsetWidth: { get: () => 320 },
      offsetHeight: { get: () => 270 },
    });
    const [grip, header] = Array.from(floating.children) as HTMLElement[];
    const close = header.querySelector("button")!;
    const drag = (target: HTMLElement, type: string, x: number, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, {
        pointerId: 3,
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
      });
      act(() => {
        target.dispatchEvent(event);
      });
    };
    for (const handle of [grip, header]) handle.setPointerCapture = vi.fn();
    const start = [floating.style.left, floating.style.top];
    drag(close, "pointerdown", 300, 20);
    drag(header, "pointermove", 340, 60);
    expect(header.setPointerCapture).not.toHaveBeenCalled();
    expect([floating.style.left, floating.style.top]).toEqual(start);
    drag(header, "pointerup", 340, 60);
    for (const handle of [grip, header]) {
      const before = [
        parseFloat(floating.style.left),
        parseFloat(floating.style.top),
      ];
      drag(handle, "pointerdown", 50, 20);
      drag(handle, "pointermove", 60, 30);
      drag(handle, "pointerup", 60, 30);
      expect(handle.setPointerCapture).toHaveBeenCalledWith(3);
      expect([
        parseFloat(floating.style.left),
        parseFloat(floating.style.top),
      ]).toEqual([before[0] + 10, before[1] + 10]);
    }
    expect(readMediaProgressPosition()).toEqual({
      x: parseFloat(floating.style.left),
      y: parseFloat(floating.style.top),
    });
  });

  it("快进快退为描边次要按钮，深浅主题各取对应描边与底色", () => {
    for (const button of steps())
      expect(classes(button)).toEqual(
        expect.arrayContaining([
          "rounded-lg",
          "border",
          "bg-transparent",
          "border-white/15",
          "hov:hover:bg-sky-500/8",
          "active:bg-sky-500/15",
          "min-h-[44px]",
          "disabled:opacity-35",
        ]),
      );
    expect(classes(panel()!)).toEqual(
      expect.arrayContaining(["rounded-2xl", "bg-[#242a34]"]),
    );
    Object.assign(window, { theme: 1 });
    try {
      reopen();
      for (const button of steps()) {
        expect(classes(button)).toContain("border-black/10");
        expect(classes(button)).not.toContain("bg-black/5");
      }
      expect(classes(panel()!)).toContain("bg-[#fafbfe]");
    } finally {
      delete (window as { theme?: unknown }).theme;
    }
  });

  it("浮窗上的鼠标按下/抬起与触摸不冒泡到宿站，且不 preventDefault", () => {
    const floating = panel()!;
    const mouse = vi.fn();
    const touch = vi.fn();
    const mouseNames = ["mousedown", "mouseup"];
    const touchNames = ["touchstart", "touchmove", "touchend"];
    for (const name of mouseNames) document.addEventListener(name, mouse);
    for (const name of touchNames) window.addEventListener(name, touch);
    const targets = [
      headerRow(floating),
      floating.querySelector<HTMLElement>('[aria-label="关闭播放进度"]')!,
      range,
      floating,
    ];
    const events: Event[] = [];
    try {
      for (const target of targets)
        for (const name of [...mouseNames, ...touchNames]) {
          const event = new Event(name, { bubbles: true, cancelable: true });
          events.push(event);
          act(() => {
            target.dispatchEvent(event);
          });
        }
    } finally {
      for (const name of mouseNames) document.removeEventListener(name, mouse);
      for (const name of touchNames) window.removeEventListener(name, touch);
    }
    expect(mouse).not.toHaveBeenCalled();
    expect(touch).not.toHaveBeenCalled();
    expect(events.some((event) => event.defaultPrevented)).toBe(false);
    // 浮窗外的鼠标事件照常到达宿站。
    const outside = vi.fn();
    document.addEventListener("mousedown", outside);
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    document.removeEventListener("mousedown", outside);
    expect(outside).toHaveBeenCalledOnce();
  });

  it("同属性 Tailwind 类不在同一按钮上并存", () => {
    for (const button of steps()) {
      const list = classes(button);
      for (const prefix of [/^px-/, /^text-\[/, /^rounded-/, /^bg-/])
        expect(list.filter((name) => prefix.test(name))).toHaveLength(1);
    }
  });
});

describe("本地播放进度浮窗位置存储", () => {
  it.each([
    ["非法 JSON", "{"],
    ["null", "null"],
    ["数组", "[1,2]"],
    ["缺少 y", '{"x":1}'],
    ["字符串坐标", '{"x":"1","y":2}'],
    ["负数坐标", '{"x":-1,"y":2}'],
    ["NaN", '{"x":null,"y":2}'],
  ])("拒绝非法 %s", (_label, raw) => {
    localStorage.setItem(MEDIA_PROGRESS_POSITION_KEY, raw);
    expect(readMediaProgressPosition()).toBeUndefined();
  });

  it("读取有限的大坐标并在保存时只克隆 x/y", () => {
    localStorage.setItem(
      MEDIA_PROGRESS_POSITION_KEY,
      JSON.stringify({ x: 1e300, y: 2e300, extra: "ignored" }),
    );
    expect(readMediaProgressPosition()).toEqual({ x: 1e300, y: 2e300 });

    const position = { x: 12, y: 34 };
    saveMediaProgressPosition(position);
    position.x = 99;
    expect(localStorage.getItem(MEDIA_PROGRESS_POSITION_KEY)).toBe(
      '{"x":12,"y":34}',
    );
  });

  it("localStorage 读写异常时降级且不抛错", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
    expect(readMediaProgressPosition()).toBeUndefined();
    getItem.mockRestore();

    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    expect(() => saveMediaProgressPosition({ x: 12, y: 34 })).not.toThrow();
  });
});
