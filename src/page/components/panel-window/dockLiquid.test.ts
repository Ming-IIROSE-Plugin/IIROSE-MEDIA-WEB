import { describe, expect, it } from "vitest";
import {
  DOCK_DETACH_PULL,
  isStickyEdge,
  nearbyWall,
  neckPath,
  pillTailPath,
  stretchScale,
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

  it("沿拉动方向变长、另一个方向变窄", () => {
    expect(stretchScale("left", 0)).toBe("1.000 1.000");
    const [alongX, acrossY] = stretchScale("right", DOCK_DETACH_PULL)
      .split(" ")
      .map(Number);
    expect(alongX).toBeGreaterThan(1);
    expect(acrossY).toBeLessThan(1);
    const [acrossX, alongY] = stretchScale("top", DOCK_DETACH_PULL)
      .split(" ")
      .map(Number);
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

  it("丝先粗后急细：前半段还很粗，快断时才变细", () => {
    const waist = (distance: number) =>
      Math.abs(numbers(neckPath("left", 0, 0, distance, 38))[7]);
    expect(waist(28)).toBeGreaterThan(waist(0) * 0.6);
    expect(waist(50)).toBeLessThan(waist(28) * 0.4);
    expect(waist(DOCK_DETACH_PULL)).toBeGreaterThan(0);
  });

  it("靠近边缘用自己的长度算粗细：刚进范围时很细，贴上时最粗", () => {
    const waist = (distance: number) =>
      Math.abs(numbers(neckPath("left", 0, 0, distance, 38, 24))[7]);
    expect(waist(23)).toBeLessThan(5);
    expect(waist(2)).toBeGreaterThan(15);
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

describe("断开后的尖头", () => {
  const xs = (path: string) =>
    (path.match(/-?\d+(\.\d+)?/g) ?? [])
      .map(Number)
      .filter((_, i) => i % 2 === 0);

  it("胶囊上的尖头朝边缘伸出，太短就不画", () => {
    // 左边缘，胶囊离边缘 60：尖头伸到 60 - 20
    const tail = pillTailPath("left", 0, 100, 60, 20, 38);
    expect(Math.min(...xs(tail))).toBe(40);
    expect(Math.max(...xs(tail))).toBe(78);
    expect(pillTailPath("left", 0, 100, 60, 0.2, 38)).toBe("");
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
