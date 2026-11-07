// 胶囊的量取与存档：输入框在哪、视口多大、胶囊该摆哪、存的位置。不碰胶囊自己的拖动状态。
import { viewportMetrics } from "../../../media-progress/viewport";
import { readJson, writeJson } from "../../../storage/localStore";
import type { DockMetrics } from "./dockLiquid";
import {
  dockFlight,
  dockPosition,
  normalizeStoredDock,
  type DockAnchor,
  type DockEdge,
  type DockPoint,
  type DockSize,
  type StoredDock,
} from "./dockPlacement";
import type { PanelRect, PanelViewport } from "./geometry";

export const PANEL_DOCK_POSITION_KEY = "imwPanelDockPosition";
/** 真站 `#moveinput` 的外层；`#mainHolder` 隐藏时尺寸为 0，按缺失处理。 */
const DOCK_ANCHOR_ID = "moveinputDisplay";

/** 胶囊的尺寸只有这一处；手机和粗指针上更大，好点。高度比其它目标的 44px 还大一些。 */
export const DOCK_METRICS: DockMetrics = {
  width: 87,
  height: 38,
  peek: 34,
  pad: 12,
  gap: 6,
  icon: 16,
  font: 13,
};
export const DOCK_METRICS_LARGE: DockMetrics = {
  width: 110,
  height: 54,
  peek: 54,
  pad: 16,
  gap: 8,
  icon: 20,
  font: 15,
};

export const dockMetrics = (): DockMetrics =>
  window.matchMedia?.("(max-width: 768px), (pointer: coarse)")?.matches
    ? DOCK_METRICS_LARGE
    : DOCK_METRICS;

function readAnchor(scale: number): DockAnchor | null {
  const anchor = document.getElementById(DOCK_ANCHOR_ID);
  if (!anchor || getComputedStyle(anchor).visibility === "hidden") return null;
  const { left, top, right, bottom } = anchor.getBoundingClientRect();
  // 宿站侧栏打开时平移整个 body，胶囊也在 body 里：要换算成相对 body 的坐标，不然平移会算两次
  const body = document.body.getBoundingClientRect();
  return {
    left: (left - body.left) / scale,
    top: (top - body.top) / scale,
    right: (right - body.left) / scale,
    bottom: (bottom - body.top) / scale,
  };
}

/**
 * 胶囊摆放要参考的输入框和视口（`fixed` 只看可视视口的平移，不加页面滚动）。`reference` 用来量
 * 宿站缩放，要够宽：`offsetWidth` 是取整的，拿胶囊自己量（约 113px）在 1.15 倍下会差出 4px。
 */
export function dockFrame(reference: HTMLElement) {
  const { scale, width, height } = viewportMetrics(reference);
  const viewport: PanelViewport = {
    width,
    height,
    offsetX: (window.visualViewport?.offsetLeft || 0) / scale,
    offsetY: (window.visualViewport?.offsetTop || 0) / scale,
  };
  return { anchor: readAnchor(scale), viewport };
}

/**
 * 范围一律按展开后的宽度算：收起时胶囊变窄，往外拉时又被拉长，按实际宽度算范围会跟着抖。
 */
export function dockSize(element: HTMLElement): DockSize {
  return { width: dockMetrics().width, height: element.offsetHeight };
}

/** 存储写不进去（隐私模式、被禁用）时的内存兜底：否则拖完的位置会在下一次轮询被默认位置覆盖。 */
let unsavedDock: StoredDock | null = null;

export function readStoredDock() {
  return (
    normalizeStoredDock(readJson(PANEL_DOCK_POSITION_KEY, null)) ?? unsavedDock
  );
}

/** 松手时存档：写盘失败就留在内存里。 */
export function saveStoredDock(saved: StoredDock): void {
  unsavedDock = writeJson(PANEL_DOCK_POSITION_KEY, saved) ? null : saved;
}

export function forgetUnsavedDock(): void {
  unsavedDock = null;
}

/** 胶囊贴着哪条边：`dockPainter.ts` 读它决定怎么画。 */
export function writeDockEdge(
  element: HTMLElement,
  edge: DockEdge | null | undefined,
) {
  if (edge) element.setAttribute("data-imw-dock-edge", edge);
  else element.removeAttribute("data-imw-dock-edge");
}

/** 胶囊该摆的位置：输入框移动或视口变化只改显示，存档留着等放得下时恢复。 */
export function measureDock(reference: HTMLElement, size: DockSize): DockPoint {
  const { anchor, viewport } = dockFrame(reference);
  return dockPosition(anchor, size, viewport, readStoredDock());
}

/**
 * 写面板缩向胶囊的位移（CSS 变量，见 `app.css`）。`rect` 是窗口展开时的矩形，全屏传 null。
 * 收起中的容器量不准，所以不读它的矩形。
 */
export function writeDockFlight(
  container: HTMLElement,
  rect: PanelRect | null,
): void {
  const { width, height } = viewportMetrics(container);
  const size = dockMetrics();
  const flight = dockFlight(
    rect ?? { x: 0, y: 0, width, height },
    measureDock(container, size),
    size,
  );
  container.style.setProperty("--imw-dock-x", `${flight.x}px`);
  container.style.setProperty("--imw-dock-y", `${flight.y}px`);
}
