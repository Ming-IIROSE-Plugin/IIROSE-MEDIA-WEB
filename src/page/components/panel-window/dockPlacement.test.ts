import { describe, expect, it } from "vitest";
import { dockFlight, dockPosition } from "./dockPlacement";

const size = { width: 120, height: 36 };
const viewport = { width: 1600, height: 900, offsetX: 0, offsetY: 0 };
const anchor = { left: 300, top: 800, right: 1400, bottom: 850 };

describe("dockPosition", () => {
  it("右缘对齐输入框右缘，底缘在输入框上方、不压住它", () => {
    const { x, y } = dockPosition(anchor, size, viewport);
    expect(x + size.width).toBe(anchor.right);
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

  it("输入框比胶囊窄、贴在左边：不超出视口", () => {
    const narrow = { left: 0, top: 800, right: 50, bottom: 850 };
    expect(dockPosition(narrow, size, viewport).x).toBe(0);
  });

  it("可视视口平移（键盘、捏合）：跟着偏移", () => {
    const shifted = { ...viewport, offsetX: 20, offsetY: 30 };
    expect(dockPosition(null, size, shifted)).toEqual({ x: 760, y: 882 });
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
