import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import {
  PANEL_WINDOW_RECT_KEY,
  PanelWindowPlacement,
  type PanelWindowHandle,
} from "./PanelWindowPlacement";

// jsdom 视口默认 1024×768、缩放比例按 1 算，这里按需改 innerWidth / innerHeight。
let element: HTMLDivElement;
let placement: PanelWindowPlacement;
let onChange: Mock<(windowed: boolean) => void>;

const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
};
const resizeViewport = (width: number, height: number) => {
  setViewport(width, height);
  window.dispatchEvent(new Event("resize"));
};
const shown = () => ({
  x: parseFloat(element.style.left),
  y: parseFloat(element.style.top),
  width: parseFloat(element.style.width),
  height: parseFloat(element.style.height),
});
const stored = () =>
  JSON.parse(localStorage.getItem(PANEL_WINDOW_RECT_KEY) ?? "null");
const seed = (rect: unknown) =>
  localStorage.setItem(PANEL_WINDOW_RECT_KEY, JSON.stringify(rect));

const pointer = (clientX: number, clientY: number, extra: object = {}) =>
  ({
    isPrimary: true,
    button: 0,
    pointerId: 1,
    clientX,
    clientY,
    target: element,
    currentTarget: element,
    ...extra,
  }) as unknown as Parameters<PanelWindowHandle["onPointerDown"]>[0];

const begin = (enabled = true) => {
  placement = new PanelWindowPlacement(element, onChange);
  placement.start(enabled);
};

beforeEach(() => {
  localStorage.clear();
  setViewport(1600, 900);
  element = document.createElement("div");
  document.body.append(element);
  onChange = vi.fn<(windowed: boolean) => void>();
});

afterEach(() => {
  placement.dispose();
  element.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("摆放与存档", () => {
  it("设置关闭：不写几何，不回调", () => {
    begin(false);
    expect(element.style.left).toBe("");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("首次使用：1000×680 居中，且不写盘", () => {
    begin();
    expect(shown()).toEqual({ x: 300, y: 110, width: 1000, height: 680 });
    expect(onChange).toHaveBeenCalledWith(true);
    expect(stored()).toBeNull();
  });

  it("存档损坏按首次使用处理，不抛错", () => {
    localStorage.setItem(PANEL_WINDOW_RECT_KEY, "{broken");
    begin();
    expect(shown().width).toBe(1000);

    placement.dispose();
    seed({ x: 1, y: 2, width: 100, height: 100 });
    begin();
    expect(shown()).toEqual({ x: 300, y: 110, width: 1000, height: 680 });
  });

  it("有存档时回到存档的位置和大小", () => {
    seed({ x: 40, y: 50, width: 900, height: 600 });
    begin();
    expect(shown()).toEqual({ x: 40, y: 50, width: 900, height: 600 });
  });

  it("关掉开关清内联几何，重新打开回到存档", () => {
    seed({ x: 40, y: 50, width: 900, height: 600 });
    begin();
    placement.setEnabled(false);
    expect(element.style.width).toBe("");
    expect(onChange).toHaveBeenLastCalledWith(false);
    placement.setEnabled(true);
    expect(shown()).toEqual({ x: 40, y: 50, width: 900, height: 600 });
    expect(onChange).toHaveBeenLastCalledWith(true);
  });
});

describe("视口变化只改显示", () => {
  const saved = { x: 500, y: 200, width: 1000, height: 680 };

  it("变小时收回视口，存档不变；变大后复原", () => {
    seed(saved);
    begin();
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    resizeViewport(1000, 700);
    expect(shown()).toEqual({ x: 12, y: 8 + 4, width: 976, height: 676 });

    resizeViewport(1600, 900);
    expect(shown()).toEqual(saved);

    expect(setItem).not.toHaveBeenCalled();
    expect(stored()).toEqual(saved);
    setItem.mockRestore();
  });

  it("放不下最小尺寸：退回全屏，存档不变；恢复后回窗口", () => {
    seed(saved);
    begin();
    onChange.mockClear();

    resizeViewport(823, 900);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(element.style.left).toBe("");
    expect(stored()).toEqual(saved);

    resizeViewport(1600, 900);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(shown()).toEqual(saved);
  });

  it("≤768px 算手机：宽度和高度够也全屏", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(max-width: 768px)",
    }));
    begin();
    expect(onChange).not.toHaveBeenCalled();
    expect(element.style.left).toBe("");
  });

  it("窗口态不变时不重复回调", () => {
    begin();
    onChange.mockClear();
    resizeViewport(1400, 800);
    resizeViewport(1500, 850);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("手势", () => {
  it("拖动：跟手、不回调，松手才写盘", () => {
    begin();
    onChange.mockClear();
    const { moveHandle } = placement;
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    moveHandle.onPointerDown(pointer(400, 120));
    moveHandle.onPointerMove(pointer(450, 150));
    expect(shown()).toMatchObject({ x: 350, y: 140 });
    moveHandle.onPointerMove(pointer(460, 170));
    expect(shown()).toMatchObject({ x: 360, y: 160 });
    expect(setItem).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    moveHandle.onPointerUp(pointer(460, 170));
    expect(stored()).toEqual({ x: 360, y: 160, width: 1000, height: 680 });
    setItem.mockRestore();
  });

  it("只点标题栏不写盘", () => {
    begin();
    const { moveHandle } = placement;
    moveHandle.onPointerDown(pointer(400, 120));
    moveHandle.onPointerUp(pointer(400, 120));
    expect(stored()).toBeNull();
  });

  it("从关闭钮按下不开始拖动", () => {
    begin();
    const before = shown();
    const button = document.createElement("button");
    element.append(button);
    const { moveHandle } = placement;
    moveHandle.onPointerDown(pointer(400, 120, { target: button }));
    moveHandle.onPointerMove(pointer(500, 200));
    moveHandle.onPointerUp(pointer(500, 200));
    expect(shown()).toEqual(before);
    expect(stored()).toBeNull();
  });

  it("非主键和非主指针不开始手势", () => {
    begin();
    const before = shown();
    const { moveHandle } = placement;
    moveHandle.onPointerDown(pointer(400, 120, { button: 2 }));
    moveHandle.onPointerMove(pointer(500, 200));
    moveHandle.onPointerDown(pointer(400, 120, { isPrimary: false }));
    moveHandle.onPointerMove(pointer(500, 200));
    expect(shown()).toEqual(before);
  });

  it("缩放：左上角拖动时右下角不动，松手写盘", () => {
    begin();
    const before = shown();
    const handle = placement.resizeHandle("nw");
    handle.onPointerDown(pointer(300, 110));
    handle.onPointerMove(pointer(260, 90));
    const after = shown();
    expect(after.x + after.width).toBe(before.x + before.width);
    expect(after.y + after.height).toBe(before.y + before.height);
    expect(after.width).toBe(1040);
    handle.onPointerUp(pointer(260, 90));
    expect(stored()).toEqual(after);
  });

  it("失焦结束手势并保存已移动的结果", () => {
    begin();
    const { moveHandle } = placement;
    moveHandle.onPointerDown(pointer(400, 120));
    moveHandle.onPointerMove(pointer(450, 120));
    window.dispatchEvent(new Event("blur"));
    expect(stored()).toMatchObject({ x: 350 });
    moveHandle.onPointerMove(pointer(900, 120));
    expect(shown().x).toBe(350);
  });

  it("手势中退回全屏：作废，不写盘", () => {
    begin();
    const { moveHandle } = placement;
    moveHandle.onPointerDown(pointer(400, 120));
    moveHandle.onPointerMove(pointer(450, 120));
    resizeViewport(700, 900);
    moveHandle.onPointerUp(pointer(450, 120));
    expect(stored()).toBeNull();
  });

  it("写盘失败不抛错，本次会话仍停在新位置", () => {
    begin();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    const { moveHandle } = placement;
    moveHandle.onPointerDown(pointer(400, 120));
    moveHandle.onPointerMove(pointer(450, 120));
    expect(() => moveHandle.onPointerUp(pointer(450, 120))).not.toThrow();
    expect(shown().x).toBe(350);
    setItem.mockRestore();
  });
});
