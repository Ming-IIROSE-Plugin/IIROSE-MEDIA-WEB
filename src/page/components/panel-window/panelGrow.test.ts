import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPanelGrow,
  cubicBezier,
  growAnchor,
  growClip,
  growFrame,
  growOpenness,
  growResume,
  growShape,
  GROW_CLOSE_MS,
  GROW_OPEN_MS,
  type GrowDirection,
  type GrowShape,
} from "./panelGrow";

// 视口 1440×810；窗口 1000×680 在中间偏上。胶囊贴右边：展开 87×38，收起只露 34。
const full: GrowShape = {
  x: 0,
  y: 0,
  width: 1440,
  height: 810,
  radii: [0, 0, 0, 0],
};
const win: GrowShape = {
  x: 220,
  y: 65,
  width: 1000,
  height: 680,
  radii: [12, 12, 12, 12],
};
const expanded: GrowShape = {
  x: 1353,
  y: 300,
  width: 87,
  height: 38,
  radii: [19, 0, 0, 19],
};
const tucked: GrowShape = { ...expanded, x: 1406, width: 34 };

/** 屏幕上真正露出来的矩形：面板位置加 translate，再扣掉四边 inset。 */
function exposed(shape: GrowShape, panel: GrowShape, capsule: GrowShape) {
  const { inset, translate } = growClip(
    shape,
    panel,
    growAnchor(capsule, panel),
  );
  const [top, right, bottom, left] = inset;
  return {
    x: panel.x + translate.x + left,
    y: panel.y + translate.y + top,
    width: panel.width - left - right,
    height: panel.height - top - bottom,
  };
}

const rectOf = ({ x, y, width, height }: GrowShape) => ({
  x,
  y,
  width,
  height,
});

describe("曲线", () => {
  it("和 CSS 的 cubic-bezier 一致", () => {
    const ease = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    // CSS `ease` 在一半时间走到约 80.24%
    expect(ease(0.5)).toBeCloseTo(0.8024, 3);
  });

  it("打开时开合程度一路变大，收起时一路变小", () => {
    for (const direction of ["open", "close"] as GrowDirection[]) {
      let previous = growOpenness(direction, 0);
      expect(previous).toBe(direction === "open" ? 0 : 1);
      for (let p = 0.05; p <= 1.0001; p += 0.05) {
        const value = growOpenness(direction, Math.min(p, 1));
        if (direction === "open")
          expect(value).toBeGreaterThanOrEqual(previous);
        else expect(value).toBeLessThanOrEqual(previous);
        previous = value;
      }
      expect(previous).toBe(direction === "open" ? 1 : 0);
    }
  });

  it("中途反向：反解出的进度正好接上当前的开合程度", () => {
    for (const direction of ["open", "close"] as GrowDirection[])
      for (const openness of [0.1, 0.35, 0.6, 0.9])
        expect(
          growOpenness(direction, growResume(direction, openness)),
        ).toBeCloseTo(openness, 3);
  });
});

describe("露出的范围", () => {
  it("两头就是胶囊和面板；圆角逐个角插值，靠墙那侧从直角开始", () => {
    expect(growShape(expanded, win, 0)).toEqual(expanded);
    expect(growShape(expanded, win, 1)).toEqual(win);
    expect(growShape(expanded, win, 0.5).radii).toEqual([15.5, 6, 6, 15.5]);
  });

  it("全屏：胶囊在面板里，全程不挪，露出来的就是插值的形状", () => {
    for (const openness of [0, 0.2, 0.5, 0.8, 1]) {
      const shape = growShape(expanded, full, openness);
      const { translate } = growClip(shape, full, growAnchor(expanded, full));
      expect(translate.x).toBeCloseTo(0, 9);
      expect(translate.y).toBeCloseTo(0, 9);
      const seen = exposed(shape, full, expanded);
      expect(seen.x).toBeCloseTo(shape.x, 9);
      expect(seen.y).toBeCloseTo(shape.y, 9);
      expect(seen.width).toBeCloseTo(shape.width, 9);
      expect(seen.height).toBeCloseTo(shape.height, 9);
    }
  });

  it("窗口：胶囊在窗口外时边长边挪，起点正好是胶囊，终点不挪不裁", () => {
    expect(exposed(expanded, win, expanded)).toEqual(rectOf(expanded));
    const middle = growShape(expanded, win, 0.5);
    const seen = exposed(middle, win, expanded);
    expect(seen.x).toBeCloseTo(middle.x, 9);
    expect(seen.width).toBeCloseTo(middle.width, 9);
    const end = growClip(win, win, growAnchor(expanded, win));
    expect(end.inset).toEqual([0, 0, 0, 0]);
    expect(end.translate).toEqual({ x: 0, y: 0 });
  });
});

describe("时间", () => {
  it("打开：先是胶囊，头 22% 胶囊淡出，内容在 10%–50% 浮现，最后是面板", () => {
    const at = (p: number) => growFrame("open", p, expanded, full);
    expect(at(0)).toMatchObject({ shape: expanded, content: 0, dock: 1 });
    expect(at(0.1).content).toBe(0);
    expect(at(0.22).dock).toBe(0);
    expect(at(0.5).content).toBe(1);
    expect(at(1)).toMatchObject({ shape: full, content: 1, dock: 0 });
  });

  it("收起：内容在前 38% 淡出，最后 20% 胶囊淡入，终点是收起的胶囊", () => {
    const at = (p: number) => growFrame("close", p, tucked, full);
    expect(at(0)).toMatchObject({ shape: full, content: 1, dock: 0 });
    expect(at(0.38).content).toBe(0);
    expect(at(0.8).dock).toBe(0);
    expect(at(1)).toMatchObject({ shape: tucked, content: 0, dock: 1 });
  });
});

describe("驱动", () => {
  let parent: HTMLDivElement;
  let container: HTMLDivElement;
  let reduced = false;
  const onDock = vi.fn();
  const onDone = vi.fn();
  const grow = () =>
    createPanelGrow(
      () => container,
      () => reduced,
    );
  const run = (
    direction: GrowDirection,
    panel: GrowShape = full,
    capsule: GrowShape = direction === "open" ? expanded : tucked,
  ) => ({ direction, capsule, panel, onDock, onDone });
  const followers = () => parent.querySelectorAll("[data-imw-grow]");
  const veil = () =>
    parent.querySelector('[data-imw-grow="veil"]') as HTMLElement;
  const shadow = () =>
    parent.querySelector('[data-imw-grow="shadow"]') as HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    reduced = false;
    onDock.mockClear();
    onDone.mockClear();
    parent = document.createElement("div");
    container = document.createElement("div");
    container.setAttribute("data-imw-theme", "dark");
    parent.append(container);
    document.body.append(parent);
  });

  afterEach(() => {
    parent.remove();
    vi.useRealTimers();
  });

  it("打开：同步裁成胶囊，盖着同色的底；走完全部清掉", () => {
    const driver = grow();
    driver.start(run("open"));
    expect(driver.running).toBe(true);
    expect(container.style.clipPath).toBe(
      "inset(300px 0px 472px 1353px round 19px 0px 0px 19px)",
    );
    expect(container.style.translate).toBe("");
    expect(container.style.pointerEvents).toBe("none");
    expect(onDock).toHaveBeenLastCalledWith(1);
    expect(veil().style.opacity).toBe("1");
    expect(shadow().style.opacity).toBe("0");
    expect(veil().getAttribute("data-imw-theme")).toBe("dark");
    expect(veil().className).toContain("z-[90001]");
    expect(shadow().className).toContain("z-[89999]");
    expect(veil().style.left).toBe("1353px");
    vi.advanceTimersByTime(GROW_OPEN_MS + 100);
    expect(driver.running).toBe(false);
    expect(container.getAttribute("style") ?? "").toBe("");
    expect(followers()).toHaveLength(0);
    expect(onDock).toHaveBeenLastCalledWith(0);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("收起：动画期间看得见、点不到；走完摘掉，交还给类", () => {
    const driver = grow();
    driver.start(run("close"));
    expect(container.style.visibility).toBe("visible");
    expect(container.style.opacity).toBe("1");
    expect(container.style.pointerEvents).toBe("none");
    expect(veil().style.opacity).toBe("0");
    vi.advanceTimersByTime(GROW_CLOSE_MS + 100);
    expect(container.getAttribute("style") ?? "").toBe("");
    expect(followers()).toHaveLength(0);
    expect(onDock).toHaveBeenLastCalledWith(1);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("终点那一帧先画出来，下一帧才清：收起的最后一截不会一下子没了", () => {
    const driver = grow();
    driver.start(run("close"));
    let last = "";
    for (let i = 0; i < 60 && driver.running; i++) {
      vi.advanceTimersByTime(16);
      if (container.style.clipPath) last = container.style.clipPath;
    }
    expect(driver.running).toBe(false);
    expect(last).toBe("inset(300px 0px 472px 1406px round 19px 0px 0px 19px)");
  });

  it("窗口在胶囊另一边：起点靠 translate 挪过去，终点归零", () => {
    const driver = grow();
    driver.start(run("open", win));
    expect(container.style.translate).not.toBe("");
    vi.advanceTimersByTime(GROW_OPEN_MS + 100);
    expect(container.style.translate).toBe("");
  });

  it("减少动态效果：不裁不挪，直接到位", () => {
    reduced = true;
    const driver = grow();
    driver.start(run("open"));
    expect(driver.running).toBe(false);
    expect(container.getAttribute("style") ?? "").toBe("");
    expect(followers()).toHaveLength(0);
    expect(onDock).toHaveBeenCalledExactlyOnceWith(0);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("中途反向：从当前形状接着缩回去，最后落在收起的胶囊上；打开那一段不算走完", () => {
    const driver = grow();
    // 悬停时从展开的胶囊长出来，收起要缩回收起的胶囊：两头不一样也不能跳
    driver.start(run("open", full, expanded));
    vi.advanceTimersByTime(32 + GROW_OPEN_MS * 0.3);
    const left = () => parseFloat(veil().style.left);
    const width = () => parseFloat(veil().style.width);
    const before = { left: left(), width: width() };
    expect(before.width).toBeGreaterThan(expanded.width * 4);
    expect(driver.running).toBe(true);
    driver.start(run("close", full, tucked));
    expect(left()).toBeCloseTo(before.left, 1);
    expect(width()).toBeCloseTo(before.width, 1);
    // 全屏时胶囊在面板里：换胶囊的过程中也不挪
    expect(container.style.translate).toBe("");
    let last = "";
    for (let i = 0; i < 60 && driver.running; i++) {
      vi.advanceTimersByTime(16);
      if (container.style.clipPath) last = container.style.clipPath;
      expect(container.style.translate).toBe("");
    }
    expect(last).toBe("inset(300px 0px 472px 1406px round 19px 0px 0px 19px)");
    expect(onDone).toHaveBeenCalledOnce();
    expect(onDock).toHaveBeenLastCalledWith(1);
  });

  it("点到正在长的形状上被吞掉：双击胶囊的第二下不会落到宿站或面板上", () => {
    const driver = grow();
    const below = vi.fn();
    parent.addEventListener("click", below);
    parent.addEventListener("mousedown", below);
    driver.start(run("open"));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    veil().dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    veil().dispatchEvent(click);
    expect(below).not.toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(true);
    expect(veil().className).not.toContain("pointer-events-none");
    expect(shadow().className).toContain("pointer-events-none");
  });

  it("卸载时立刻走完并清掉", () => {
    const driver = grow();
    driver.start(run("open"));
    vi.advanceTimersByTime(32 + GROW_OPEN_MS * 0.3);
    driver.finish();
    expect(container.getAttribute("style") ?? "").toBe("");
    expect(followers()).toHaveLength(0);
    expect(onDone).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(GROW_OPEN_MS);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
