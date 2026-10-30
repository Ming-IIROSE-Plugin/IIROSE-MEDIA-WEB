import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closePanelTier,
  dismissTopOverlay,
  hasOverlayLayers,
  pushOverlayLayer,
  setPanelBackHandler,
} from "./overlayLayers";

// 层级栈（CAP-14）：LIFO、每次只关一层、面板内三层互斥、`Esc` 装 / 卸、
// 外来浮层根放行、宿站返回键包装只装一次 / 无层交还。

type HostWindow = Window & {
  Utils?: { backward?: (...args: unknown[]) => unknown };
};
/** 宿站的 `Utils` 在全局有完整类型声明：测试按无类型对象读写。 */
const hostWindow = () => window as unknown as Record<string, unknown>;
const setBackward = (fn: (...args: unknown[]) => unknown) => {
  hostWindow().Utils = { backward: fn };
};
const callBack = () =>
  (
    (hostWindow().Utils as { backward: () => unknown })
      .backward as () => unknown
  )();

const releases: (() => void)[] = [];
const layer = (kind: "sheet" | "deck" | "order" | "inner") => {
  const dismiss = vi.fn();
  releases.push(pushOverlayLayer(kind, dismiss));
  return dismiss;
};

const escape = (target: EventTarget = document, init = {}) => {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  while (releases.length) releases.pop()!();
  setPanelBackHandler(null);
  delete hostWindow().Utils;
  delete (window as unknown as Record<string, unknown>)
    .__imwOverlayBackDispatch;
  delete (window as unknown as Record<string, unknown>).__imwShufflePickerBack;
});

describe("栈的 LIFO 与注销", () => {
  it("每次只关最上一层，关到空后不再动作", () => {
    const first = layer("inner");
    const second = layer("order");
    expect(hasOverlayLayers()).toBe(true);

    expect(dismissTopOverlay()).toBe(true);
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();

    expect(dismissTopOverlay()).toBe(true);
    expect(first).toHaveBeenCalledOnce();
    expect(hasOverlayLayers()).toBe(false);

    expect(dismissTopOverlay()).toBe(false);
    expect(first).toHaveBeenCalledOnce();
    // 栈空了就卸下监听：Esc 不再被拦
    const handled = escape(document);
    expect(handled.defaultPrevented).toBe(false);
  });

  it("注销函数幂等：自己的层已关掉后不再误删别人的层", () => {
    const a = layer("inner");
    const releaseB = pushOverlayLayer("sheet", () => {});

    // 关掉最上层（b）后，b 的注销是空操作
    dismissTopOverlay();
    releaseB();
    expect(dismissTopOverlay()).toBe(true);
    expect(a).toHaveBeenCalledOnce();
    // 再注销一次不抛错
    releaseB();
  });

  it("面板内三层互斥：收起别的面板层，内页不受影响", () => {
    const sheet = layer("sheet");
    const deck = layer("deck");
    const inner = layer("inner");

    closePanelTier("order");
    expect(sheet).toHaveBeenCalledOnce();
    expect(deck).toHaveBeenCalledOnce();
    expect(inner).not.toHaveBeenCalled();

    // 内页仍在栈上：下一次 Esc 关的是它
    const next = vi.fn();
    releases.push(pushOverlayLayer("order", next));
    dismissTopOverlay();
    expect(next).toHaveBeenCalledOnce();
    expect(inner).not.toHaveBeenCalled();
  });

  it("closePanelTier 不碰同名的层（打开顺序菜单不会关掉自己）", () => {
    const order = layer("order");
    const deck = layer("deck");
    closePanelTier("order");
    expect(deck).toHaveBeenCalledOnce();
    expect(order).not.toHaveBeenCalled();
  });
});

describe("Esc 监听", () => {
  it("栈空时不装监听（不吞宿站的 Esc），有层时关顶层", () => {
    const event = escape(document);
    expect(event.defaultPrevented).toBe(false);

    const dismiss = layer("sheet");
    const handled = escape(document);
    expect(dismiss).toHaveBeenCalledOnce();
    expect(handled.defaultPrevented).toBe(true);
  });

  it("连按只关一层（组件还没注销也不会二次落到同一层）", () => {
    const dismiss = layer("sheet");
    escape(document);
    escape(document);
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("外来浮层根放行：随机面板与播放进度浮窗里的 Esc 不被面板内的层吃掉", () => {
    for (const id of ["imw-shuffle-picker-root", "imw-media-progress-root"]) {
      const root = document.createElement("div");
      root.id = id;
      const inner = document.createElement("button");
      root.append(inner);
      document.body.append(root);

      const dismiss = layer("inner");
      const event = escape(inner);
      expect(dismiss).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);

      root.remove();
      while (releases.length) releases.pop()!();
    }
  });

  it("组合输入中的 Esc 不算关闭手势", () => {
    const dismiss = layer("sheet");
    escape(document, { isComposing: true });
    expect(dismiss).not.toHaveBeenCalled();
  });
});

describe("宿站返回键", () => {
  let hostBackward: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

  beforeEach(() => {
    hostBackward = vi.fn<(...args: unknown[]) => unknown>();
    setBackward(hostBackward);
  });

  it("面板开着且层非空：只关层，宿站不执行返回", () => {
    const closePanel = vi.fn();
    setPanelBackHandler(closePanel);
    const dismiss = layer("sheet");

    callBack();

    expect(dismiss).toHaveBeenCalledOnce();
    expect(closePanel).not.toHaveBeenCalled();
    expect(hostBackward).not.toHaveBeenCalled();
  });

  it("无层时关面板；面板关着时原样交还宿站", () => {
    const closePanel = vi.fn();
    setPanelBackHandler(closePanel);
    callBack();
    expect(closePanel).toHaveBeenCalledOnce();
    expect(hostBackward).not.toHaveBeenCalled();

    setPanelBackHandler(null);
    callBack();
    expect(hostBackward).toHaveBeenCalledOnce();
  });

  it("包装只装一次：重复登记复用同一个函数对象", () => {
    setPanelBackHandler(vi.fn());
    const wrapped = (hostWindow().Utils as { backward: unknown }).backward;
    setPanelBackHandler(vi.fn());
    expect((hostWindow().Utils as { backward: unknown }).backward).toBe(
      wrapped,
    );
  });

  it("随机面板开着时交给它自己的包装（返回先关它）", () => {
    setPanelBackHandler(vi.fn());
    const dismiss = layer("sheet");
    hostWindow().__imwShufflePickerBack = () => {};

    callBack();

    expect(dismiss).not.toHaveBeenCalled();
    expect(hostBackward).toHaveBeenCalledOnce();
  });

  it("宿站没有 Utils.backward 时照常可用", () => {
    delete hostWindow().Utils;
    const closePanel = vi.fn();
    setPanelBackHandler(closePanel);
    const dismiss = layer("sheet");
    // 不抛错：Esc 仍能关层
    escape(document);
    expect(dismiss).toHaveBeenCalledOnce();
    void closePanel;
  });
});
