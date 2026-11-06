// 主面板窗口的几何：只有纯函数，坐标都是 `viewport.ts` 换算后的（宿站缩放前的）CSS 像素。
import { constrainPosition } from "../../../media-progress/model";

export const PANEL_MIN_WIDTH = 800;
export const PANEL_MIN_HEIGHT = 520;
export const PANEL_DEFAULT_WIDTH = 1000;
export const PANEL_DEFAULT_HEIGHT = 680;
/** 距视口边的留白（与 `constrainPosition` 的 12px 一致）。 */
export const PANEL_EDGE = 12;

export interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanelViewport {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const RESIZE_EDGES: readonly ResizeEdge[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** 视口放不放得下「最小尺寸 + 两侧留白」；放不下时面板用全屏。 */
export function viewportFitsWindow(viewport: PanelViewport): boolean {
  return (
    viewport.width >= PANEL_MIN_WIDTH + 2 * PANEL_EDGE &&
    viewport.height >= PANEL_MIN_HEIGHT + 2 * PANEL_EDGE
  );
}

/** 把窗口收回视口：先缩尺寸（不小于最小尺寸），再挪位置。存档不经过这里改写。 */
export function fitRect(rect: PanelRect, viewport: PanelViewport): PanelRect {
  const width = clamp(
    rect.width,
    PANEL_MIN_WIDTH,
    Math.max(PANEL_MIN_WIDTH, Math.floor(viewport.width - 2 * PANEL_EDGE)),
  );
  const height = clamp(
    rect.height,
    PANEL_MIN_HEIGHT,
    Math.max(PANEL_MIN_HEIGHT, Math.floor(viewport.height - 2 * PANEL_EDGE)),
  );
  const { x, y } = constrainPosition(
    rect.x,
    rect.y,
    width,
    height,
    viewport.width,
    viewport.height,
    viewport.offsetX,
    viewport.offsetY,
  );
  return { x, y, width, height };
}

/** 首次使用：1000×680 在视口居中（放不下时先收窄）。 */
export function defaultRect(viewport: PanelViewport): PanelRect {
  const fitted = fitRect(
    { x: 0, y: 0, width: PANEL_DEFAULT_WIDTH, height: PANEL_DEFAULT_HEIGHT },
    viewport,
  );
  return {
    ...fitted,
    x: Math.round(viewport.offsetX + (viewport.width - fitted.width) / 2),
    y: Math.round(viewport.offsetY + (viewport.height - fitted.height) / 2),
  };
}

/** 拖标题栏：尺寸不变，位置收回视口。 */
export function dragRect(
  start: PanelRect,
  dx: number,
  dy: number,
  viewport: PanelViewport,
): PanelRect {
  return fitRect(
    { ...start, x: start.x + Math.round(dx), y: start.y + Math.round(dy) },
    viewport,
  );
}

/** 拖一条边：对边不动，受最小尺寸和视口留白限制。返回新的两端。 */
function resizeAxis(
  start: number,
  size: number,
  delta: number,
  movesStart: boolean,
  minSize: number,
  lower: number,
  upper: number,
): [number, number] {
  const end = start + size;
  if (movesStart) {
    const next = clamp(
      start + delta,
      Math.min(lower, end - minSize),
      end - minSize,
    );
    return [next, end - next];
  }
  const next = clamp(
    end + delta,
    start + minSize,
    Math.max(upper, start + minSize),
  );
  return [start, next - start];
}

/** 拖边或角：对边或对角不动。 */
export function resizeRect(
  start: PanelRect,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  viewport: PanelViewport,
): PanelRect {
  let { x, y, width, height } = start;
  if (edge.includes("e") || edge.includes("w")) {
    [x, width] = resizeAxis(
      start.x,
      start.width,
      Math.round(dx),
      edge.includes("w"),
      PANEL_MIN_WIDTH,
      viewport.offsetX + PANEL_EDGE,
      viewport.offsetX + viewport.width - PANEL_EDGE,
    );
  }
  if (edge.includes("n") || edge.includes("s")) {
    [y, height] = resizeAxis(
      start.y,
      start.height,
      Math.round(dy),
      edge.includes("n"),
      PANEL_MIN_HEIGHT,
      viewport.offsetY + PANEL_EDGE,
      viewport.offsetY + viewport.height - PANEL_EDGE,
    );
  }
  return { x, y, width, height };
}

/** 读存档：非对象、非有限数字、小于最小尺寸都按没有存档处理。 */
export function normalizeStoredRect(raw: unknown): PanelRect | null {
  if (!raw || typeof raw !== "object") return null;
  const { x, y, width, height } = raw as Record<string, unknown>;
  const values = [x, y, width, height];
  if (!values.every((value) => Number.isFinite(value))) return null;
  const rect = { x, y, width, height } as PanelRect;
  if (rect.width < PANEL_MIN_WIDTH || rect.height < PANEL_MIN_HEIGHT)
    return null;
  return rect;
}
