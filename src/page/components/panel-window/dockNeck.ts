// 胶囊贴边时的「颈」：SVG 路径的绘制、断开与落定动画。只管画，不管拖动手势和存档。
import {
  nearbyWall,
  neckPath,
  pillTailPath,
  wallBumpPath,
  wallOf,
  type StickyEdge,
} from "./dockLiquid";
import {
  dockBounds,
  DOCK_SNAP_DISTANCE,
  type DockPoint,
} from "./dockPlacement";
import { dockFrame, dockSize, writeDockEdge } from "./dockMeasure";

/** 颈缩回去、胶囊落定的时长；`app.css` 的 `data-imw-dock-settling` 规则与它同长。 */
export const DOCK_SETTLE_MS = 300;

export const prefersReducedMotion = () =>
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

/** 拖动时还粘在哪条边、离它多远。 */
export interface StuckState {
  stuck: StickyEdge | null;
  stuckDistance: number;
}

export interface NeckController {
  writeNeck(path: string): void;
  drawNeck(element: HTMLElement, edge: StickyEdge, distance: number): void;
  /** 这一轮颈的收缩动画是否还在跑。 */
  animating(): boolean;
  stop(): void;
  animate(draw: (remaining: number) => void): void;
  settle(element: HTMLElement, kind: "scale" | "place"): void;
  /** 取消落定计时（又按下了、或卸载）。 */
  cancelSettle(): void;
  detach(element: HTMLElement, current: StuckState): void;
  drawApproach(element: HTMLElement, point: DockPoint): void;
}

export function createNeckController(
  reference: () => HTMLElement,
  neck: () => SVGPathElement | null,
): NeckController {
  let frame = 0;
  let settleTimer = 0;

  const writeNeck = (path: string) => neck()?.setAttribute("d", path);

  /** 这条边的颈所需的几何；胶囊的位置取当前 left / top。 */
  const neckGeometry = (element: HTMLElement, edge: StickyEdge) => {
    const size = dockSize(element);
    const { anchor, viewport } = dockFrame(reference());
    return {
      wall: wallOf(edge, dockBounds(anchor, size, viewport), size.width),
      center:
        edge === "top"
          ? parseFloat(element.style.left) + element.offsetWidth / 2
          : parseFloat(element.style.top) + element.offsetHeight / 2,
      thickness: element.offsetHeight,
    };
  };

  const drawNeck = (
    element: HTMLElement,
    edge: StickyEdge,
    distance: number,
  ) => {
    const { wall, center, thickness } = neckGeometry(element, edge);
    writeNeck(neckPath(edge, wall, center, distance, thickness));
  };

  const stop = () => {
    window.cancelAnimationFrame?.(frame);
    frame = 0;
  };

  /** 逐帧画一段 ease-out 的收缩；减少动态效果时直接到终点。 */
  const animate = (draw: (remaining: number) => void) => {
    stop();
    if (prefersReducedMotion()) {
      draw(0);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DOCK_SETTLE_MS, 1);
      draw((1 - progress) ** 3);
      frame = progress < 1 ? requestAnimationFrame(tick) : 0;
    };
    frame = requestAnimationFrame(tick);
  };

  /**
   * 落定用的过渡，只在这一小段时间打开。断开时手指还在拖，只能弹 `scale`（`"scale"`）：
   * 带上 left / top 胶囊就会缓动着追手指；松手后才用 `"place"`。
   */
  const settle = (element: HTMLElement, kind: "scale" | "place") => {
    window.clearTimeout(settleTimer);
    element.setAttribute("data-imw-dock-settling", kind);
    settleTimer = window.setTimeout(
      () => element.removeAttribute("data-imw-dock-settling"),
      DOCK_SETTLE_MS + 40,
    );
  };

  /** 断开：丝从中间断成两个尖头，边缘那头缩回边上，胶囊那头跟着胶囊缩回去。 */
  const detach = (element: HTMLElement, current: StuckState) => {
    const edge = current.stuck;
    if (!edge) return;
    const { wall, center, thickness } = neckGeometry(element, edge);
    const bumpLength = current.stuckDistance * 0.45 + 4;
    const tailLength = current.stuckDistance * 0.45;
    current.stuck = null;
    writeDockEdge(element, null);
    settle(element, "scale");
    element.style.removeProperty("scale");
    animate((remaining) => {
      const tail = neckGeometry(element, edge);
      const left = parseFloat(element.style.left);
      const top = parseFloat(element.style.top);
      const cap =
        edge === "left"
          ? left - tail.wall
          : edge === "right"
            ? tail.wall - left - element.offsetWidth
            : top - tail.wall;
      writeNeck(
        [
          wallBumpPath(edge, wall, center, bumpLength * remaining, thickness),
          pillTailPath(
            edge,
            tail.wall,
            tail.center,
            cap,
            tailLength * remaining,
            thickness,
          ),
        ].join(" "),
      );
    });
  };

  /** 自由拖动靠近边缘时，边缘提前伸出来接它。 */
  const drawApproach = (element: HTMLElement, point: DockPoint) => {
    if (frame) return;
    const { anchor, viewport } = dockFrame(reference());
    const near = nearbyWall(
      point,
      dockBounds(anchor, dockSize(element), viewport),
    );
    if (near) {
      const { wall, center, thickness } = neckGeometry(element, near.edge);
      writeNeck(
        neckPath(
          near.edge,
          wall,
          center,
          near.gap,
          thickness,
          DOCK_SNAP_DISTANCE,
        ),
      );
    } else writeNeck("");
  };

  return {
    writeNeck,
    drawNeck,
    animating: () => frame !== 0,
    stop,
    animate,
    settle,
    cancelSettle: () => window.clearTimeout(settleTimer),
    detach,
    drawApproach,
  };
}
