import { describe, expect, it } from "vitest";
import {
  clampDockPoint,
  dockFlight,
  dockPosition,
  normalizeStoredDock,
  snapDockEdge,
} from "./dockPlacement";

const size = { width: 120, height: 36 };
const viewport = { width: 1600, height: 900, offsetX: 0, offsetY: 0 };
const anchor = { left: 300, top: 800, right: 1400, bottom: 850 };

describe("dockPosition", () => {
  it("在输入框左上方，左边留 12px，底缘在输入框上方、不压住它", () => {
    const { x, y } = dockPosition(anchor, size, viewport);
    expect(x).toBe(anchor.left + 12);
    expect(y + size.height).toBeLessThan(anchor.top);
  });

  it("没有输入框：视口底部居中，留 12px", () => {
    expect(dockPosition(null, size, viewport)).toEqual({ x: 740, y: 852 });
  });

  it("输入框尺寸为 0（`#mainHolder` 隐藏）：按缺失处理", () => {
    const hidden = { left: 0, top: 0, right: 0, bottom: 0 };
    expect(dockPosition(hidden, size, viewport)).toEqual({ x: 740, y: 852 });
  });

  it("输入框在视口外（聊天区滑走）：按缺失处理", () => {
    const away = { left: -1500, top: 800, right: -100, bottom: 850 };
    expect(dockPosition(away, size, viewport)).toEqual({ x: 740, y: 852 });
  });

  it("输入框上方放不下：不压住它，退回底部居中", () => {
    const top = { left: 300, top: 10, right: 1400, bottom: 60 };
    expect(dockPosition(top, size, viewport)).toEqual({ x: 740, y: 852 });
  });

  it("输入框左缘伸到视口外：从视口左缘量起", () => {
    const pushed = { left: -140, top: 800, right: 1260, bottom: 850 };
    expect(dockPosition(pushed, size, viewport).x).toBe(12);
  });

  it("输入框贴着视口右边：胶囊不超出视口", () => {
    const narrow = { left: 1590, top: 800, right: 1600, bottom: 850 };
    expect(dockPosition(narrow, size, viewport).x).toBe(1480);
  });

  it("可视视口平移（键盘、捏合）：跟着偏移", () => {
    const shifted = { ...viewport, offsetX: 20, offsetY: 30 };
    expect(dockPosition(null, size, shifted)).toEqual({ x: 760, y: 882 });
  });
});

describe("拖动范围与存档", () => {
  it("存档优先于默认位置", () => {
    expect(dockPosition(anchor, size, viewport, { x: 500, y: 300 })).toEqual({
      x: 500,
      y: 300,
    });
  });

  it("不能进入或越过输入框：底缘停在顶边上方 6px", () => {
    for (const y of [770, 900, 5000])
      expect(clampDockPoint({ x: 500, y }, anchor, size, viewport).y).toBe(758);
  });

  it("不能拖出视口", () => {
    expect(clampDockPoint({ x: -50, y: -50 }, anchor, size, viewport)).toEqual({
      x: 0,
      y: 0,
    });
    expect(clampDockPoint({ x: 5000, y: 10 }, anchor, size, viewport).x).toBe(
      1480,
    );
  });

  it("没有输入框：只限制在视口内", () => {
    expect(clampDockPoint({ x: 10, y: 5000 }, null, size, viewport).y).toBe(
      864,
    );
  });

  it("坏存档按没有处理", () => {
    expect(normalizeStoredDock(null)).toBeNull();
    expect(normalizeStoredDock({ x: 1 })).toBeNull();
    expect(normalizeStoredDock({ x: "1", y: 2 })).toBeNull();
    expect(normalizeStoredDock({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
  });
});

describe("边缘吸附", () => {
  it("离左右边缘不到 24px 才吸附", () => {
    expect(snapDockEdge({ x: 23, y: 0 }, size, viewport)).toBe("left");
    expect(snapDockEdge({ x: 24, y: 0 }, size, viewport)).toBeNull();
    expect(snapDockEdge({ x: 1457, y: 0 }, size, viewport)).toBe("right");
    expect(snapDockEdge({ x: 1456, y: 0 }, size, viewport)).toBeNull();
  });

  it("吸附的存档贴着边，视口变化也不离开；纵向限制仍生效", () => {
    const stored = { x: 0, y: 5000, edge: "right" as const };
    expect(dockPosition(anchor, size, viewport, stored)).toEqual({
      x: 1480,
      y: 758,
    });
    expect(
      dockPosition(anchor, size, { ...viewport, width: 1800 }, stored).x,
    ).toBe(1680);
  });

  it("存档的 edge 非法就忽略", () => {
    expect(normalizeStoredDock({ x: 1, y: 2, edge: "top" })).toEqual({
      x: 1,
      y: 2,
    });
    expect(normalizeStoredDock({ x: 1, y: 2, edge: "left" })).toEqual({
      x: 1,
      y: 2,
      edge: "left",
    });
  });
});

describe("dockFlight", () => {
  it("窗口中心到胶囊中心的位移", () => {
    const rect = { x: 100, y: 100, width: 1000, height: 600 };
    expect(dockFlight(rect, { x: 1280, y: 758 }, size)).toEqual({
      x: 1340 - 600,
      y: 776 - 400,
    });
  });
});
