// 最小化停靠件的定位：只有纯函数，坐标都是 `viewport.ts` 换算后的（宿站缩放前的）CSS 像素。
import { PANEL_EDGE, type PanelRect, type PanelViewport } from "./geometry";

/** 胶囊底缘与输入框的间距。 */
export const DOCK_GAP = 6;

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

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

/** 胶囊左上角：右缘对齐输入框右缘、底缘在它上方；没有输入框时视口底部居中，留 12px。 */
export function dockPosition(
  anchor: DockAnchor | null,
  size: DockSize,
  viewport: PanelViewport,
): DockPoint {
  if (!usableAnchor(anchor, size, viewport))
    return {
      x: viewport.offsetX + (viewport.width - size.width) / 2,
      y: viewport.offsetY + viewport.height - size.height - PANEL_EDGE,
    };
  return {
    x: clamp(
      anchor.right - size.width,
      viewport.offsetX,
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
