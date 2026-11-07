import { describe, expect, it } from "vitest";
import { roundedLg } from "../floating-panel/tokens";
import {
  PANEL_WINDOW_RADIUS,
  defaultRect,
  dragRect,
  fitRect,
  normalizeStoredRect,
  resizeRect,
  viewportFitsWindow,
  type PanelRect,
  type PanelViewport,
} from "./geometry";

const viewport: PanelViewport = {
  width: 1600,
  height: 900,
  offsetX: 0,
  offsetY: 0,
};
const rect: PanelRect = { x: 300, y: 100, width: 1000, height: 680 };
const right = (r: PanelRect) => r.x + r.width;
const bottom = (r: PanelRect) => r.y + r.height;

describe("viewportFitsWindow", () => {
  it("最小尺寸 + 两侧 12px 留白是门槛", () => {
    const of = (width: number, height: number) =>
      viewportFitsWindow({ ...viewport, width, height });
    expect(of(824, 544)).toBe(true);
    expect(of(823, 544)).toBe(false);
    expect(of(824, 543)).toBe(false);
  });
});

describe("defaultRect", () => {
  it("1000×680 在视口居中", () => {
    expect(defaultRect(viewport)).toEqual({
      x: 300,
      y: 110,
      width: 1000,
      height: 680,
    });
  });

  it("视口比默认尺寸小时先收窄，仍然居中且留白", () => {
    expect(defaultRect({ ...viewport, width: 900, height: 600 })).toEqual({
      x: 12,
      y: 12,
      width: 876,
      height: 576,
    });
  });

  it("计入视口偏移", () => {
    expect(
      defaultRect({ ...viewport, offsetX: 50, offsetY: 20 }),
    ).toMatchObject({ x: 350, y: 130 });
  });
});

describe("fitRect", () => {
  it("放得下的矩形原样返回", () => {
    expect(fitRect(rect, viewport)).toEqual(rect);
  });

  it("视口变小：先缩尺寸再挪位置，都留 12px", () => {
    expect(fitRect(rect, { ...viewport, width: 900, height: 600 })).toEqual({
      x: 12,
      y: 12,
      width: 876,
      height: 576,
    });
  });

  it("不会缩到最小尺寸以下", () => {
    const fitted = fitRect({ x: 0, y: 0, width: 500, height: 300 }, viewport);
    expect(fitted.width).toBe(800);
    expect(fitted.height).toBe(520);
  });
});

describe("dragRect", () => {
  it("尺寸不变，跟随位移", () => {
    expect(dragRect(rect, 40, -30, viewport)).toEqual({
      ...rect,
      x: 340,
      y: 70,
    });
  });

  it("拖不出视口", () => {
    const farAway = dragRect(rect, 9999, 9999, viewport);
    expect(right(farAway)).toBe(1588);
    expect(bottom(farAway)).toBe(888);
    expect(dragRect(rect, -9999, -9999, viewport)).toMatchObject({
      x: 12,
      y: 12,
    });
  });
});

describe("resizeRect：八向都是对边或对角不动", () => {
  it.each([
    ["e", 50, 0, { width: 1050 }],
    ["s", 0, 50, { height: 730 }],
    ["w", -50, 0, { x: 250, width: 1050 }],
    ["n", 0, -50, { y: 50, height: 730 }],
    ["se", 50, 60, { width: 1050, height: 740 }],
    ["ne", 50, -60, { y: 40, width: 1050, height: 740 }],
    ["sw", -50, 60, { x: 250, width: 1050, height: 740 }],
    ["nw", -50, -60, { x: 250, y: 40, width: 1050, height: 740 }],
  ] as const)("%s", (edge, dx, dy, expected) => {
    const next = resizeRect(rect, edge, dx, dy, viewport);
    expect(next).toEqual({ ...rect, ...expected });
    if (edge.includes("w")) expect(right(next)).toBe(right(rect));
    if (edge.includes("e")) expect(next.x).toBe(rect.x);
    if (edge.includes("n")) expect(bottom(next)).toBe(bottom(rect));
    if (edge.includes("s")) expect(next.y).toBe(rect.y);
  });

  it("只缩边时另一轴不变", () => {
    const next = resizeRect(rect, "e", 10, 99, viewport);
    expect(next.height).toBe(rect.height);
    expect(next.y).toBe(rect.y);
  });

  it("不小于最小尺寸，且对边仍然不动", () => {
    const shrunk = resizeRect(rect, "nw", 9999, 9999, viewport);
    expect(shrunk.width).toBe(800);
    expect(shrunk.height).toBe(520);
    expect(right(shrunk)).toBe(right(rect));
    expect(bottom(shrunk)).toBe(bottom(rect));
  });

  it("不超出视口（留 12px）", () => {
    const grown = resizeRect(rect, "se", 9999, 9999, viewport);
    expect(right(grown)).toBe(1588);
    expect(bottom(grown)).toBe(888);
    expect(resizeRect(rect, "nw", -9999, -9999, viewport)).toMatchObject({
      x: 12,
      y: 12,
    });
  });
});

describe("normalizeStoredRect", () => {
  it("合法存档原样读出", () => {
    expect(normalizeStoredRect(rect)).toEqual(rect);
  });

  it.each([
    ["null", null],
    ["字符串", "oops"],
    ["缺字段", { x: 1, y: 2, width: 1000 }],
    ["非数字", { ...rect, x: "1" }],
    ["NaN", { ...rect, y: Number.NaN }],
    ["过窄", { ...rect, width: 799 }],
    ["过矮", { ...rect, height: 519 }],
  ])("%s 按没有存档处理", (_name, raw) => {
    expect(normalizeStoredRect(raw)).toBeNull();
  });
});

describe("窗口圆角", () => {
  it("开合动画收尾用的圆角和窗口自己的圆角是同一个数", () => {
    expect(roundedLg).toBe(`rounded-[${PANEL_WINDOW_RADIUS}px]`);
  });
});
