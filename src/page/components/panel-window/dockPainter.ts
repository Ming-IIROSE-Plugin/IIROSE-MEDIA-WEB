// 胶囊的画师：持有展开程度、落定、尖头三个动画，用一个 rAF 循环驱动。每次都调 `dockShape` 算出轮廓和
// 内容的摆放，再一起写进 DOM，所以形状和文字永远在同一帧。形状算法在 `dockLiquid.ts`，手势在 `PanelDock.tsx`。
import {
  dockShape,
  isStickyEdge,
  nearbyWall,
  type DockBox,
  type DockMetrics,
  type StickyEdge,
} from "./dockLiquid";
import { dockMetrics, dockFrame, dockSize } from "./dockMeasure";
import { dockBounds, type DockEdge, type DockPoint } from "./dockPlacement";

/** 落定和尖头缩回的时长。 */
const DOCK_SETTLE_MS = 300;
/** 展开和收起的时间常数：约 200ms 走完。 */
const DOCK_OPEN_TAU_MS = 55;
/** 一帧最多算这么久：标签页切回来时不要一步跳完。 */
const DOCK_MAX_FRAME_MS = 50;
const DOCK_OPEN_EPSILON = 0.002;

export const prefersReducedMotion = () =>
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export interface DockPainterParts {
  reference: () => HTMLElement;
  pill: () => HTMLElement | null;
  shape: () => SVGPathElement | null;
  tips: () => SVGPathElement | null;
  button: () => HTMLElement | null;
  label: () => HTMLElement | null;
}

export interface DockPainter {
  /** 边或位置变了：重算展开目标并重画。 */
  refresh(): void;
  /** 只重画，比如手指带着胶囊走了一步。 */
  paint(): void;
  setHovered(value: boolean): void;
  setHeld(value: boolean): void;
  setFocused(value: boolean): void;
  /** 开始拖动：胶囊立刻展开，靠近边缘时边缘提前伸出来接它。 */
  startDragging(): void;
  stopDragging(): void;
  /** 胶囊已摆到终点，视觉上从这个偏移走回去。 */
  settleFrom(offset: DockPoint): void;
  cancelSettle(): void;
  /** 丝断开：两端的尖头各自缩回去。`distance` 是断开前离边缘的距离。 */
  detach(edge: StickyEdge, distance: number): void;
  stop(): void;
}

function readEdge(element: HTMLElement) {
  return element.getAttribute("data-imw-dock-edge") as DockEdge | null;
}

function readPoint(element: HTMLElement): DockPoint {
  return {
    x: parseFloat(element.style.left) || 0,
    y: parseFloat(element.style.top) || 0,
  };
}

function writeBox(
  element: HTMLElement,
  button: HTMLElement | null,
  label: HTMLElement | null,
  base: DockPoint,
  box: DockBox,
  metrics: DockMetrics,
) {
  element.style.translate = `${box.x - base.x}px ${box.y - base.y}px`;
  element.style.width = `${box.width}px`;
  element.style.height = `${box.height}px`;
  element.style.borderRadius = box.radius;
  if (button) {
    button.style.borderRadius = box.radius;
    button.style.fontSize = `${metrics.font}px`;
    const icon = button.querySelector("svg");
    if (icon) {
      icon.style.width = `${metrics.icon}px`;
      icon.style.height = `${metrics.icon}px`;
    }
    button.style.padding = `0 ${box.padRight}px 0 ${box.padLeft}px`;
    button.style.gap = `${box.gap}px`;
    button.style.flexDirection = box.reversed ? "row-reverse" : "row";
    button.style.justifyContent = box.centered ? "center" : "flex-start";
  }
  if (label) {
    label.style.opacity = `${box.labelOpacity}`;
    label.style.maxWidth = `${box.labelMaxEm}em`;
  }
}

export function createDockPainter(parts: DockPainterParts): DockPainter {
  // null：还没画过，第一次直接到位，不播动画
  let open: number | null = null;
  let hovered = false;
  let held = false;
  let focused = false;
  let dragging = false;
  let settle: {
    from: DockPoint;
    offset: DockPoint;
    start: number | null;
  } | null = null;
  let tips: {
    edge: StickyEdge;
    center: number;
    bump: number;
    tail: number;
    remaining: number;
    start: number | null;
  } | null = null;
  let frame = 0;
  let last: number | null = null;

  const openTarget = (element: HTMLElement) =>
    !readEdge(element) || hovered || held || focused || dragging ? 1 : 0;

  const paint = () => {
    const element = parts.pill();
    const path = parts.shape();
    if (!element || !path) return;
    const metrics = dockMetrics();
    const { anchor, viewport } = dockFrame(parts.reference());
    const bounds = dockBounds(anchor, dockSize(element), viewport);
    const base = readPoint(element);
    const point = settle
      ? { x: base.x + settle.offset.x, y: base.y + settle.offset.y }
      : base;
    const edge = readEdge(element);
    if (open === null) open = openTarget(element);
    const {
      path: d,
      tips: tipsPath,
      box,
    } = dockShape({
      point,
      edge,
      open,
      metrics,
      bounds,
      // 减少动态效果时不画拉丝，自由拖近边缘也一样
      approach:
        dragging && !edge && !prefersReducedMotion()
          ? nearbyWall(point, bounds)
          : null,
      tips: tips && {
        edge: tips.edge,
        center: tips.center,
        bump: tips.bump * tips.remaining,
        tail: tips.tail * tips.remaining,
      },
    });
    path.setAttribute("d", d);
    parts.tips()?.setAttribute("d", tipsPath);
    writeBox(element, parts.button(), parts.label(), base, box, metrics);
  };

  const wake = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  const tick = (now: number) => {
    frame = 0;
    const element = parts.pill();
    if (!element) return;
    const elapsed = Math.min(now - (last ?? now - 16), DOCK_MAX_FRAME_MS);
    last = now;
    let busy = false;
    const target = openTarget(element);
    if (open !== null && open !== target) {
      const next =
        open + (target - open) * (1 - Math.exp(-elapsed / DOCK_OPEN_TAU_MS));
      open = Math.abs(target - next) < DOCK_OPEN_EPSILON ? target : next;
      busy = open !== target;
    }
    if (settle) {
      settle.start ??= now;
      const progress = Math.min((now - settle.start) / DOCK_SETTLE_MS, 1);
      const left = (1 - progress) ** 3;
      settle.offset = { x: settle.from.x * left, y: settle.from.y * left };
      if (progress < 1) busy = true;
      else settle = null;
    }
    if (tips) {
      tips.start ??= now;
      const progress = Math.min((now - tips.start) / DOCK_SETTLE_MS, 1);
      tips.remaining = (1 - progress) ** 3;
      if (progress < 1) busy = true;
      else tips = null;
    }
    paint();
    if (busy) wake();
    else last = null;
  };

  /** 展开目标变了：减少动态效果时直接到位，否则交给动画。 */
  const refresh = () => {
    const element = parts.pill();
    if (!element) return;
    if (open !== null && open !== openTarget(element)) {
      if (prefersReducedMotion()) open = openTarget(element);
      else wake();
    }
    paint();
  };

  return {
    refresh,
    paint,
    setHovered(value) {
      hovered = value;
      refresh();
    },
    setHeld(value) {
      held = value;
      refresh();
    },
    setFocused(value) {
      focused = value;
      refresh();
    },
    startDragging() {
      dragging = true;
      open = 1;
    },
    stopDragging() {
      dragging = false;
    },
    settleFrom(from) {
      if (prefersReducedMotion() || (!from.x && !from.y)) return;
      settle = { from, offset: from, start: null };
      wake();
    },
    cancelSettle() {
      settle = null;
    },
    detach(edge, distance) {
      const element = parts.pill();
      if (!element || !isStickyEdge(edge)) return;
      const metrics = dockMetrics();
      const point = readPoint(element);
      tips = {
        edge,
        center:
          edge === "top"
            ? point.x + metrics.width / 2
            : point.y + metrics.height / 2,
        bump: distance * 0.45 + 4,
        tail: distance * 0.45,
        remaining: 1,
        start: null,
      };
      wake();
    },
    stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      settle = null;
      tips = null;
    },
  };
}
