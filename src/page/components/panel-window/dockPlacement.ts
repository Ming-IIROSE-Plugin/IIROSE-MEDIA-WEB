// 最小化停靠件的定位：只有纯函数，坐标都是 `viewport.ts` 换算后的（宿站缩放前的）CSS 像素。
import { PANEL_EDGE, type PanelRect, type PanelViewport } from "./geometry";

/** 胶囊底缘与输入框的间距。 */
export const DOCK_GAP = 6;
/** 松手时离视口左右边缘不到这么远，就吸附并收起。 */
export const DOCK_SNAP_DISTANCE = 24;

export type DockEdge = "left" | "right";

export interface DockSize {
  width: number;
  height: number;
}

export interface DockAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface DockPoint {
  x: number;
  y: number;
}

/** 存档：吸附在边缘时记 `edge`，视口变宽后仍贴着那条边。 */
export interface StoredDock extends DockPoint {
  edge?: DockEdge;
}

/** 输入框能不能当锚：有尺寸、在视口内，且上方放得下胶囊（放不下就不能压住它）。 */
function usableAnchor(
  anchor: DockAnchor | null,
  size: DockSize,
  viewport: PanelViewport,
): anchor is DockAnchor {
  if (!anchor) return false;
  if (anchor.right <= anchor.left || anchor.bottom <= anchor.top) return false;
  const inView =
    anchor.right > viewport.offsetX &&
    anchor.left < viewport.offsetX + viewport.width &&
    anchor.bottom > viewport.offsetY &&
    anchor.top < viewport.offsetY + viewport.height;
  return inView && anchor.top - DOCK_GAP - size.height >= viewport.offsetY;
}

/** 存档校验：坏数据按没有存档处理。 */
export function normalizeStoredDock(raw: unknown): StoredDock | null {
  if (!raw || typeof raw !== "object") return null;
  const { x, y, edge } = raw as Record<string, unknown>;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const point = { x, y } as DockPoint;
  return edge === "left" || edge === "right" ? { ...point, edge } : point;
}

/** 松手位置靠近哪条左右边缘；都不近时为 null。 */
export function snapDockEdge(
  point: DockPoint,
  size: DockSize,
  viewport: PanelViewport,
): DockEdge | null {
  if (point.x - viewport.offsetX < DOCK_SNAP_DISTANCE) return "left";
  const right = viewport.offsetX + viewport.width;
  return right - (point.x + size.width) < DOCK_SNAP_DISTANCE ? "right" : null;
}

/** 把 x 贴到边缘（`clampDockPoint` 负责落到视口内）。 */
export function pinToEdge(point: DockPoint, edge: DockEdge): DockPoint {
  return { x: edge === "left" ? -Infinity : Infinity, y: point.y };
}

/** 限制在视口内，且底缘不越过输入框顶边（间距 `DOCK_GAP`）；输入框不能当锚时只限制在视口内。 */
export function clampDockPoint(
  point: DockPoint,
  anchor: DockAnchor | null,
  size: DockSize,
  viewport: PanelViewport,
): DockPoint {
  const maxX = viewport.offsetX + viewport.width - size.width;
  const viewportMaxY = viewport.offsetY + viewport.height - size.height;
  const maxY = usableAnchor(anchor, size, viewport)
    ? Math.min(viewportMaxY, anchor.top - DOCK_GAP - size.height)
    : viewportMaxY;
  return {
    x: Math.max(viewport.offsetX, Math.min(point.x, maxX)),
    y: Math.max(viewport.offsetY, Math.min(point.y, maxY)),
  };
}

/**
 * 胶囊左上角：有存档时用存档（只改显示，不动存档）；否则在输入框左上方，左边留 12px、
 * 底缘在它上方；没有输入框时视口底部居中，留 12px。
 */
export function dockPosition(
  anchor: DockAnchor | null,
  size: DockSize,
  viewport: PanelViewport,
  stored: StoredDock | null = null,
): DockPoint {
  if (stored)
    return clampDockPoint(
      stored.edge ? pinToEdge(stored, stored.edge) : stored,
      anchor,
      size,
      viewport,
    );
  if (!usableAnchor(anchor, size, viewport))
    return {
      x: viewport.offsetX + (viewport.width - size.width) / 2,
      y: viewport.offsetY + viewport.height - size.height - PANEL_EDGE,
    };
  return {
    // 输入框可能伸到视口外（宿站侧栏把聊天区推走时）：从看得见的左缘量起
    x: Math.min(
      Math.max(anchor.left, viewport.offsetX) + PANEL_EDGE,
      Math.max(
        viewport.offsetX,
        viewport.offsetX + viewport.width - size.width,
      ),
    ),
    y: anchor.top - DOCK_GAP - size.height,
  };
}

/** 窗口中心飞到胶囊中心的位移（`transform-origin` 是 center，缩放不影响它）。 */
export function dockFlight(
  windowRect: PanelRect,
  position: DockPoint,
  size: DockSize,
): DockPoint {
  return {
    x: position.x + size.width / 2 - (windowRect.x + windowRect.width / 2),
    y: position.y + size.height / 2 - (windowRect.y + windowRect.height / 2),
  };
}
