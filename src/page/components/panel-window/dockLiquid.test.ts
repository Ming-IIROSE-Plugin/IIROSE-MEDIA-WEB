import { describe, expect, it } from "vitest";
import {
  DOCK_DETACH_PULL,
  dockCapsule,
  dockOutline,
  dockShape,
  dockSilhouette,
  isStickyEdge,
  nearbyWall,
  pillTailPath,
  stuckPull,
  wallBumpPath,
  wallOf,
  type DockMetrics,
  type DockShapeInput,
  type StickyEdge,
} from "./dockLiquid";

const SMALL: DockMetrics = {
  width: 87,
  height: 38,
  peek: 34,
  pad: 12,
  gap: 6,
  icon: 16,
  font: 13,
};
const LARGE: DockMetrics = {
  width: 110,
  height: 54,
  peek: 54,
  pad: 16,
  gap: 8,
  icon: 20,
  font: 15,
};
const BOUNDS = { minX: 0, minY: 0, maxX: 1513, maxY: 800 };

/** 把路径按贝塞尔和直线采样成密集的点。 */
function sample(path: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let current = { x: 0, y: 0 };
  for (const [, command, args] of path.matchAll(/([MLCZ])([^MLCZ]*)/g)) {
    const n = (args.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    if (command === "M") current = { x: n[0], y: n[1] };
    if (command === "L") {
      for (let i = 0; i <= 400; i++) {
        const t = i / 400;
        points.push({
          x: current.x + (n[0] - current.x) * t,
          y: current.y + (n[1] - current.y) * t,
        });
      }
      current = { x: n[0], y: n[1] };
    }
    if (command === "C") {
      for (let i = 0; i <= 400; i++) {
        const t = i / 400;
        const u = 1 - t;
        const at = (a: number, b: number, c: number, d: number) =>
          u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
        points.push({
          x: at(current.x, n[0], n[2], n[4]),
          y: at(current.y, n[1], n[3], n[5]),
        });
      }
      current = { x: n[4], y: n[5] };
    }
  }
  return points;
}

/**
 * 轮廓的「宽度表」：离边缘每 1px，胶囊沿边缘的半宽。贴边的轮廓都以 `center` 为对称轴。
 */
function profile(path: string, edge: StickyEdge, wall: number, center: number) {
  const widths: number[] = [];
  for (const { x, y } of sample(path)) {
    const a = Math.round(edge === "top" ? y - wall : Math.abs(x - wall));
    const b = Math.abs((edge === "top" ? x : y) - center);
    widths[a] = Math.max(widths[a] ?? 0, b);
  }
  return widths;
}

const shapeOf = (input: Partial<DockShapeInput>) =>
  dockShape({
    point: { x: 0, y: 0 },
    edge: null,
    open: 1,
    metrics: SMALL,
    bounds: BOUNDS,
    ...input,
  });

/** 三条能粘的边，胶囊贴着时的左上角、边缘坐标和对称轴。 */
function attached(edge: StickyEdge, metrics: DockMetrics, distance = 0) {
  const bounds = { ...BOUNDS, maxX: 1600 - metrics.width };
  if (edge === "top")
    return {
      bounds,
      point: { x: 500, y: distance },
      wall: 0,
      center: 500 + metrics.width / 2,
    };
  const x = edge === "left" ? distance : bounds.maxX - distance;
  return {
    bounds,
    point: { x, y: 300 },
    wall: edge === "left" ? 0 : 1600,
    center: 300 + metrics.height / 2,
  };
}

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
});

describe("贴边的轮廓", () => {
  const EDGES: StickyEdge[] = ["left", "right", "top"];

  for (const metrics of [SMALL, LARGE]) {
    for (const edge of EDGES) {
      it(`${edge}（高 ${metrics.height}）：收起、展开和中间帧，沿线都没有凹陷`, () => {
        const { point, bounds, wall, center } = attached(edge, metrics);
        for (const open of [0, 0.25, 0.5, 0.75, 1]) {
          const { path } = shapeOf({ edge, open, point, bounds, metrics });
          const widths = profile(path, edge, wall, center);
          // 从边缘往里走，宽度只收不放：一放就是凹陷
          for (let a = 1; a < widths.length; a++)
            expect(widths[a]).toBeLessThanOrEqual(widths[a - 1] + 0.05);
        }
      });

      it(`${edge}（高 ${metrics.height}）：边缘处比胶囊宽，是两个耳朵`, () => {
        const { point, bounds, wall, center } = attached(edge, metrics);
        const { path } = shapeOf({ edge, open: 1, point, bounds, metrics });
        const half = edge === "top" ? metrics.width / 2 : metrics.height / 2;
        expect(profile(path, edge, wall, center)[0]).toBeCloseTo(half + 8, 1);
      });
    }
  }

  it("上边收起和展开的中间帧：过了耳朵就只会越收越快，没有方角", () => {
    const { point, bounds, wall, center } = attached("top", SMALL);
    for (const open of [0, 0.25, 0.5, 0.75, 1]) {
      const { path } = shapeOf({ edge: "top", open, point, bounds });
      const widths = profile(path, "top", wall, center);
      for (let a = 10; a < widths.length - 1; a++) {
        const before = widths[a - 1] - widths[a];
        const after = widths[a] - widths[a + 1];
        expect(after).toBeGreaterThanOrEqual(before - 0.15);
      }
    }
  });

  it("上边：图标在看得见的那一段正中，左右对称", () => {
    const { point, bounds, center } = attached("top", SMALL);
    const closed = shapeOf({ edge: "top", open: 0, point, bounds }).box;
    expect(closed.x + closed.width / 2).toBeCloseTo(center, 5);
    expect(closed.y + closed.height / 2).toBeCloseTo((38 - 8) / 2, 5);
    expect(closed.width).toBe(38);
    expect(closed.gap).toBe(0);
    expect(closed.labelMaxEm).toBe(0);
    expect(closed.centered).toBe(true);
    // 展开也以中心为基准
    const opened = shapeOf({ edge: "top", open: 1, point, bounds }).box;
    expect(opened.x + opened.width / 2).toBeCloseTo(center, 5);
    expect(opened.width).toBe(87);
    expect(opened.labelMaxEm).toBeGreaterThan(0);
  });

  for (const metrics of [SMALL, LARGE]) {
    it(`左右收起（高 ${metrics.height}）：露出 peek，图标在露出的一段正中`, () => {
      const right = attached("right", metrics);
      const box = shapeOf({ edge: "right", open: 0, ...right, metrics }).box;
      expect(box.width).toBe(metrics.peek);
      expect(box.x).toBe(1600 - metrics.peek);
      expect(1 + box.padLeft + metrics.icon / 2).toBeCloseTo(
        metrics.peek / 2,
        5,
      );
      const left = attached("left", metrics);
      const mirrored = shapeOf({ edge: "left", open: 0, ...left, metrics }).box;
      expect(mirrored.x).toBe(0);
      expect(mirrored.reversed).toBe(true);
      expect(mirrored.padRight).toBe(box.padLeft);
    });
  }

  it("靠边那一侧是直角，点得到的范围和画出来的一样；不贴边四角都圆", () => {
    const radius = (edge: "left" | "right" | "top" | "bottom" | null) =>
      shapeOf({ edge, open: 0, point: { x: 500, y: 300 } }).box.radius;
    expect(radius("right")).toBe("19px 0 0 19px");
    expect(radius("left")).toBe("0 19px 19px 0");
    expect(radius("top")).toBe("0 0 19px 19px");
    expect(radius("bottom")).toBe("19px");
    expect(radius(null)).toBe("19px");
  });

  it("展开后回到正常内边距，文字出现", () => {
    const right = attached("right", SMALL);
    const box = shapeOf({ edge: "right", open: 1, ...right }).box;
    expect(box.width).toBe(87);
    expect(box.x).toBe(1513);
    expect(box.padLeft).toBe(12);
    expect(box.labelOpacity).toBe(1);
  });
});

describe("往外拉", () => {
  const center = (box: { x: number; width: number }) => box.x + box.width / 2;

  for (const edge of ["left", "right"] as const) {
    it(`${edge}：胶囊中心 1:1 跟手，轮廓略微拉长`, () => {
      const rest = attached(edge, SMALL);
      const restCenter = center(shapeOf({ edge, ...rest }).box);
      for (const distance of [5, 20, 40, 55]) {
        const pulled = attached(edge, SMALL, distance);
        const { box } = shapeOf({ edge, ...pulled });
        const moved = edge === "left" ? distance : -distance;
        expect(center(box)).toBeCloseTo(restCenter + moved, 5);
        expect(box.width).toBeGreaterThan(87);
      }
    });
  }

  it("上边：胶囊中心 1:1 跟手", () => {
    for (const distance of [5, 20, 40, 55]) {
      const pulled = attached("top", SMALL, distance);
      const { box } = shapeOf({ edge: "top", ...pulled });
      expect(box.y + box.height / 2).toBeCloseTo(19 + distance, 5);
    }
  });

  /** 丝最细处的半宽。 */
  const waist = (distance: number) => {
    const {
      point,
      bounds,
      wall,
      center: axis,
    } = attached("left", SMALL, distance);
    const { path } = shapeOf({ edge: "left", point, bounds });
    const widths = profile(path, "left", wall, axis);
    return Math.min(...widths.slice(1, Math.max(distance, 2)));
  };

  it("丝先粗后急细：前半段还很粗，快断时才变细", () => {
    expect(waist(28)).toBeGreaterThan(19 * 0.5);
    expect(waist(50)).toBeLessThan(waist(28) * 0.4);
    expect(waist(DOCK_DETACH_PULL - 1)).toBeGreaterThan(0);
  });

  it("边缘上留着一片铺开的底：根部比丝宽", () => {
    const { point, bounds, wall, center: axis } = attached("left", SMALL, 40);
    const { path } = shapeOf({ edge: "left", point, bounds });
    expect(profile(path, "left", wall, axis)[0]).toBeGreaterThan(waist(40));
  });

  it("曲线在边缘处相切：第一个控制点贴着边缘", () => {
    const numbers = (
      dockOutline("left", 0, 0, 20, 87, 19, 19).match(/-?\d+(\.\d+)?/g) ?? []
    ).map(Number);
    expect(numbers[2]).toBe(0);
  });

  it("断开后的尖头单独一条路径：放进胶囊的路径会因为绕向相反抠出洞", () => {
    const point = { x: 200, y: 300 };
    const count = (path: string) => path.match(/M/g)?.length ?? 0;
    const tips = { edge: "left" as const, center: 319, bump: 20, tail: 18 };
    const shape = shapeOf({ point, tips });
    expect(shape.path).toBe(dockCapsule(200, 300, 87, 38));
    expect(count(shape.tips)).toBe(2);
    // 缩完就没有了
    expect(
      shapeOf({ point, tips: { ...tips, bump: 0.1, tail: 0.1 } }).tips,
    ).toBe("");
    expect(shapeOf({ point }).tips).toBe("");
  });
});

describe("不贴边", () => {
  it("下边不粘：圆钮，以中心为基准展开，没有耳朵", () => {
    const point = { x: 500, y: 700 };
    const closed = shapeOf({ edge: "bottom", open: 0, point });
    expect(closed.box.width).toBe(38);
    expect(closed.box.x + 19).toBeCloseTo(500 + 87 / 2, 5);
    expect(closed.box.labelMaxEm).toBe(0);
    expect(closed.path).toBe(dockCapsule(closed.box.x, 700, 38, 38));
    const opened = shapeOf({ edge: "bottom", open: 1, point });
    expect(opened.box.width).toBe(87);
    expect(opened.box.x).toBe(500);
    expect(opened.path).toBe(dockCapsule(500, 700, 87, 38));
  });

  it("自由状态是完整的胶囊，内容摆在胶囊上", () => {
    const point = { x: 400, y: 300 };
    const { path, box } = shapeOf({ point, open: 0 });
    expect(path).toBe(dockCapsule(400, 300, 87, 38));
    expect(box).toMatchObject({ x: 400, y: 300, width: 87, labelOpacity: 1 });
  });

  it("靠近边缘时边缘伸出来：刚进范围时丝很细，贴上时最粗", () => {
    const widths = (gap: number) =>
      profile(
        shapeOf({
          point: { x: gap, y: 300 },
          approach: { edge: "left", gap },
        }).path,
        "left",
        0,
        319,
      );
    expect(Math.min(...widths(23).slice(1, 23))).toBeLessThan(5);
    expect(Math.min(...widths(2).slice(1, 2))).toBeGreaterThan(15);
    expect(widths(23)[0]).toBeGreaterThan(0);
  });
});

describe("断开后的尖头", () => {
  const xs = (path: string) =>
    (path.match(/-?\d+(\.\d+)?/g) ?? [])
      .map(Number)
      .filter((_, i) => i % 2 === 0);
  const ys = (path: string) =>
    (path.match(/-?\d+(\.\d+)?/g) ?? [])
      .map(Number)
      .filter((_, i) => i % 2 === 1);

  it("断开后留在边缘的一团：越短越窄，太短就不画", () => {
    const wide = Math.max(...ys(wallBumpPath("left", 0, 0, 30, 38)));
    const narrow = Math.max(...ys(wallBumpPath("left", 0, 0, 3, 38)));
    expect(narrow).toBeLessThan(wide);
    expect(wallBumpPath("left", 0, 0, 0.2, 38)).toBe("");
  });

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

describe("露出的那块（面板从这里长出来）", () => {
  const EDGES: StickyEdge[] = ["left", "right", "top"];

  for (const metrics of [SMALL, LARGE])
    for (const edge of EDGES)
      it(`${edge}（高 ${metrics.height}）：和轮廓去掉耳朵后的范围一致，靠墙一侧是直角`, () => {
        const { point, bounds, wall } = attached(edge, metrics);
        for (const open of [0, 0.5, 1]) {
          const input = { edge, open, point, bounds, metrics };
          const outline = sample(shapeOf(input).path);
          const seen = dockSilhouette(input);
          // 离边缘超过耳朵（8px）的部分才是胶囊本身
          const body = outline.filter(({ x, y }) =>
            edge === "top" ? y - wall > 10 : Math.abs(x - wall) > 10,
          );
          const xs = body.map((p) => p.x);
          const ys = body.map((p) => p.y);
          const far = outline.map((p) => (edge === "top" ? p.y : p.x));
          if (edge === "top") {
            expect(seen.y).toBe(wall);
            expect(seen.y + seen.height).toBeCloseTo(Math.max(...far), 1);
            expect(seen.x).toBeCloseTo(Math.min(...xs), 1);
            expect(seen.x + seen.width).toBeCloseTo(Math.max(...xs), 1);
          } else {
            const tip = edge === "left" ? Math.max(...far) : Math.min(...far);
            expect(edge === "left" ? seen.x + seen.width : seen.x).toBeCloseTo(
              tip,
              1,
            );
            expect(edge === "left" ? seen.x : seen.x + seen.width).toBe(wall);
            expect(seen.y).toBeCloseTo(Math.min(...ys), 1);
            expect(seen.y + seen.height).toBeCloseTo(Math.max(...ys), 1);
          }
          const wallCorners =
            edge === "top" ? [0, 1] : edge === "left" ? [0, 3] : [1, 2];
          for (const i of wallCorners) expect(seen.radii[i]).toBe(0);
        }
      });

  it("贴右边收起只露 peek，展开是整个胶囊", () => {
    const { point, bounds } = attached("right", SMALL);
    expect(
      dockSilhouette({ edge: "right", open: 0, point, bounds, metrics: SMALL }),
    ).toEqual({
      x: 1600 - 34,
      y: 300,
      width: 34,
      height: 38,
      radii: [19, 0, 0, 19],
    });
    expect(
      dockSilhouette({ edge: "right", open: 1, point, bounds, metrics: SMALL }),
    ).toMatchObject({ x: 1600 - 87, width: 87 });
  });

  it("下边是以中心展开的圆钮，自由状态是整个胶囊，四角都圆", () => {
    const point = { x: 500, y: 700 };
    const round = dockSilhouette({
      edge: "bottom",
      open: 0,
      point,
      bounds: BOUNDS,
      metrics: SMALL,
    });
    expect(round).toEqual({
      x: 524.5,
      y: 700,
      width: 38,
      height: 38,
      radii: [19, 19, 19, 19],
    });
    const box = shapeOf({ edge: "bottom", open: 0.5, point }).box;
    expect(
      dockSilhouette({
        edge: "bottom",
        open: 0.5,
        point,
        bounds: BOUNDS,
        metrics: SMALL,
      }),
    ).toMatchObject({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    expect(
      dockSilhouette({
        edge: null,
        open: 0,
        point,
        bounds: BOUNDS,
        metrics: SMALL,
      }),
    ).toEqual({
      x: 500,
      y: 700,
      width: 87,
      height: 38,
      radii: [19, 19, 19, 19],
    });
  });
});
