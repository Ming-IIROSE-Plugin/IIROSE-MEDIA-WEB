// 最小化停靠件的定位：只有纯函数，坐标都是 `viewport.ts` 换算后的（宿站缩放前的）CSS 像素。
import { PANEL_EDGE, type PanelRect, type PanelViewport } from "./geometry";

/** 胶囊底缘与输入框的间距。 */
export const DOCK_GAP = 6;
/** 松手时离可停靠范围的边缘不到这么远，就吸附并收起。 */
export const DOCK_SNAP_DISTANCE = 24;

export type DockEdge = "left" | "right" | "top" | "bottom";

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

const DOCK_EDGES: readonly unknown[] = ["left", "right", "top", "bottom"];

/** 存档校验：坏数据按没有存档处理。 */
export function normalizeStoredDock(raw: unknown): StoredDock | null {
  if (!raw || typeof raw !== "object") return null;
  const { x, y, edge } = raw as Record<string, unknown>;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const point = { x, y } as DockPoint;
  return DOCK_EDGES.includes(edge)
    ? { ...point, edge: edge as DockEdge }
    : point;
}

/** 胶囊左上角能到的范围：视口内，且底缘不越过输入框顶边（间距 `DOCK_GAP`）；输入框不能当锚时只看视口。 */
export function dockBounds(
  anchor: DockAnchor | null,
  size: DockSize,
  viewport: PanelViewport,
) {
  const viewportMaxY = viewport.offsetY + viewport.height - size.height;
  return {
    minX: viewport.offsetX,
    minY: viewport.offsetY,
    maxX: viewport.offsetX + viewport.width - size.width,
    maxY: usableAnchor(anchor, size, viewport)
      ? Math.min(viewportMaxY, anchor.top - DOCK_GAP - size.height)
      : viewportMaxY,
  };
}

/** 松手位置靠近哪条边（左右优先，角落按左右算）；都不近时为 null。下边指输入框上方那条线。 */
export function snapDockEdge(
  point: DockPoint,
  anchor: DockAnchor | null,
  size: DockSize,
  viewport: PanelViewport,
): DockEdge | null {
  const { minX, minY, maxX, maxY } = dockBounds(anchor, size, viewport);
  if (point.x - minX < DOCK_SNAP_DISTANCE) return "left";
  if (maxX - point.x < DOCK_SNAP_DISTANCE) return "right";
  if (point.y - minY < DOCK_SNAP_DISTANCE) return "top";
  if (maxY - point.y < DOCK_SNAP_DISTANCE) return "bottom";
  return null;
}

/** 把点贴到边缘（`clampDockPoint` 负责落到范围内）。 */
export function pinToEdge(point: DockPoint, edge: DockEdge): DockPoint {
  if (edge === "left") return { x: -Infinity, y: point.y };
  if (edge === "right") return { x: Infinity, y: point.y };
  return { x: point.x, y: edge === "top" ? -Infinity : Infinity };
}

/** 限制在可停靠范围内。 */
export function clampDockPoint(
  point: DockPoint,
  anchor: DockAnchor | null,
  size: DockSize,
  viewport: PanelViewport,
): DockPoint {
  const { minX, minY, maxX, maxY } = dockBounds(anchor, size, viewport);
  return {
    x: Math.max(minX, Math.min(point.x, maxX)),
    y: Math.max(minY, Math.min(point.y, maxY)),
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
