import { describe, expect, it } from "vitest";
import {
  DOCK_DETACH_PULL,
  isStickyEdge,
  nearbyWall,
  neckPath,
  rubberDistance,
  stretchScale,
  stuckPoint,
  stuckPull,
  wallBumpPath,
  wallOf,
} from "./dockLiquid";

describe("拉动", () => {
  it("下边不粘，其余三边粘", () => {
    expect(isStickyEdge("left")).toBe(true);
    expect(isStickyEdge("right")).toBe(true);
    expect(isStickyEdge("top")).toBe(true);
    expect(isStickyEdge("bottom")).toBe(false);
    expect(isStickyEdge(null)).toBe(false);
  });

  it("拉出距离按边的方向算", () => {
    const docked = { x: 100, y: 100 };
    const raw = { x: 130, y: 150 };
    expect(stuckPull("left", docked, raw)).toBe(30);
    expect(stuckPull("right", docked, raw)).toBe(-30);
    expect(stuckPull("top", docked, raw)).toBe(50);
  });

  it("越拉越费劲：不超过手指，增量递减；往边缘里按不动", () => {
    expect(rubberDistance(-10)).toBe(0);
    const near = rubberDistance(20);
    const far = rubberDistance(40);
    expect(near).toBeLessThan(20);
    expect(far - near).toBeLessThan(near);
    expect(rubberDistance(DOCK_DETACH_PULL)).toBeLessThan(44);
  });

  it("垂直于边缘走阻尼，沿着边缘跟手", () => {
    const docked = { x: 100, y: 100 };
    const raw = { x: 170, y: 160 };
    expect(stuckPoint("left", docked, raw, 20)).toEqual({ x: 120, y: 160 });
    expect(stuckPoint("right", docked, raw, 20)).toEqual({ x: 80, y: 160 });
    expect(stuckPoint("top", docked, raw, 20)).toEqual({ x: 170, y: 120 });
  });

  it("沿拉动方向变长、另一个方向变窄", () => {
    expect(stretchScale("left", 0)).toBe("1.000 1.000");
    const [alongX, acrossY] = stretchScale("right", 44).split(" ").map(Number);
    expect(alongX).toBeGreaterThan(1);
    expect(acrossY).toBeLessThan(1);
    const [acrossX, alongY] = stretchScale("top", 44).split(" ").map(Number);
    expect(acrossX).toBeLessThan(1);
    expect(alongY).toBeGreaterThan(1);
  });
});

describe("颈的形状", () => {
  const numbers = (path: string) =>
    (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  /** 路径里出现过的所有 x（点按 x y 成对）。 */
  const xs = (path: string) => numbers(path).filter((_, i) => i % 2 === 0);
  const ys = (path: string) => numbers(path).filter((_, i) => i % 2 === 1);

  it("从边缘出发，朝内伸；边缘处比胶囊宽（弯月面）", () => {
    const left = neckPath("left", 0, 100, 0, 38);
    expect(Math.min(...xs(left))).toBe(0);
    expect(Math.max(...xs(left))).toBe(19);
    expect(Math.min(...ys(left))).toBe(100 - 27);
    expect(Math.max(...ys(left))).toBe(100 + 27);
    const right = neckPath("right", 500, 100, 0, 38);
    expect(Math.max(...xs(right))).toBe(500);
    expect(Math.min(...xs(right))).toBe(481);
  });

  it("上边是同一个形状转过来", () => {
    const top = neckPath("top", 0, 300, 10, 38);
    expect(Math.min(...ys(top))).toBe(0);
    expect(Math.max(...ys(top))).toBe(29);
    // 拉开后根部收窄，但仍比颈宽
    expect(Math.min(...xs(top))).toBeLessThan(300 - 19);
    expect(Math.min(...xs(top))).toBeGreaterThan(300 - 27);
  });

  it("拉得越远，中间越细", () => {
    // 第二段的终点是颈最细处：取 M 之后第 3 个点的沿边偏移
    const waist = (distance: number) =>
      Math.abs(numbers(neckPath("left", 0, 0, distance, 38))[7]);
    expect(waist(10)).toBeLessThan(waist(0));
    expect(waist(30)).toBeLessThan(waist(10));
    expect(waist(44)).toBeGreaterThan(0);
  });

  it("曲线在边缘处相切：第一个控制点贴着边缘", () => {
    expect(numbers(neckPath("left", 0, 0, 20, 38))[2]).toBe(0);
  });

  it("断开后留在边缘的一团：越短越窄，太短就不画", () => {
    const wide = Math.max(...ys(wallBumpPath("left", 0, 0, 30, 38)));
    const narrow = Math.max(...ys(wallBumpPath("left", 0, 0, 3, 38)));
    expect(narrow).toBeLessThan(wide);
    expect(wallBumpPath("left", 0, 0, 0.2, 38)).toBe("");
  });
});

describe("边缘", () => {
  const bounds = { minX: 10, minY: 20, maxX: 900 };

  it("边缘坐标：右边是胶囊贴边时的右缘", () => {
    expect(wallOf("left", bounds, 87)).toBe(10);
    expect(wallOf("top", bounds, 87)).toBe(20);
    expect(wallOf("right", bounds, 87)).toBe(987);
  });

  it("24px 内才算靠近；左右优先", () => {
    expect(nearbyWall({ x: 400, y: 400 }, bounds)).toBeNull();
    expect(nearbyWall({ x: 20, y: 400 }, bounds)).toEqual({
      edge: "left",
      gap: 10,
    });
    expect(nearbyWall({ x: 890, y: 400 }, bounds)).toEqual({
      edge: "right",
      gap: 10,
    });
    expect(nearbyWall({ x: 400, y: 30 }, bounds)).toEqual({
      edge: "top",
      gap: 10,
    });
    expect(nearbyWall({ x: 20, y: 30 }, bounds)?.edge).toBe("left");
  });
});
