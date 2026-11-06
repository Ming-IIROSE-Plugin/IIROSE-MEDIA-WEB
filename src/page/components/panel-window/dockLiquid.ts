// 胶囊粘在边缘的液体效果：只有纯函数。拉胶囊时先被拉长（阻尼位移 + 收细的颈），到阈值才断开。
// 坐标都是 `viewport.ts` 换算后的 CSS 像素，和胶囊的 left / top 同一口径。
import {
  DOCK_SNAP_DISTANCE,
  type DockEdge,
  type DockPoint,
} from "./dockPlacement";

/** 手指离开贴边位置这么远才断开。 */
export const DOCK_DETACH_PULL = 72;
/** 阻尼位移的上限：胶囊被拉住时最多离开边缘这么远。 */
const DOCK_PULL_MAX = 44;
const DOCK_PULL_SOFTNESS = 40;
/** 颈在边缘处比胶囊两侧各多出的宽度（弯月面）。 */
const NECK_FLARE = 8;
/** 颈收到最细时的半宽。 */
const NECK_MIN_HALF = 1.5;

/** 能粘的边：下边是输入框上方的线，不是真正的边，不粘。 */
export type StickyEdge = Exclude<DockEdge, "bottom">;

export const isStickyEdge = (
  edge: DockEdge | null | undefined,
): edge is StickyEdge => edge === "left" || edge === "right" || edge === "top";

/** 手指朝离开边缘的方向走了多远；往边缘里按是负数。 */
export function stuckPull(
  edge: StickyEdge,
  docked: DockPoint,
  raw: DockPoint,
): number {
  if (edge === "left") return raw.x - docked.x;
  if (edge === "right") return docked.x - raw.x;
  return raw.y - docked.y;
}

/** 手指拉出的距离换算成胶囊实际离开边缘的距离：越拉越费劲。 */
export function rubberDistance(pull: number): number {
  if (pull <= 0) return 0;
  return DOCK_PULL_MAX * (1 - Math.exp(-pull / DOCK_PULL_SOFTNESS));
}

/** 被粘住时胶囊的位置：垂直于边缘走阻尼位移，沿着边缘正常跟手。 */
export function stuckPoint(
  edge: StickyEdge,
  docked: DockPoint,
  raw: DockPoint,
  distance: number,
): DockPoint {
  if (edge === "left") return { x: docked.x + distance, y: raw.y };
  if (edge === "right") return { x: docked.x - distance, y: raw.y };
  return { x: raw.x, y: docked.y + distance };
}

/** 被拉长的胶囊：沿拉动方向变长、另一个方向变窄（CSS `scale` 的值）。 */
export function stretchScale(edge: StickyEdge, distance: number): string {
  const amount = Math.min(distance / DOCK_PULL_MAX, 1);
  const along = (1 + 0.1 * amount).toFixed(3);
  const across = (1 - 0.06 * amount).toFixed(3);
  return edge === "top" ? `${across} ${along}` : `${along} ${across}`;
}

/** `a` 是离边缘的距离，`b` 是沿边缘相对中心的偏移。 */
function edgeMapper(edge: StickyEdge, wall: number, center: number) {
  return (a: number, b: number) => {
    const [x, y] =
      edge === "top"
        ? [center + b, wall + a]
        : [edge === "left" ? wall + a : wall - a, center + b];
    return `${+x.toFixed(2)} ${+y.toFixed(2)}`;
  };
}

/**
 * 边缘和胶囊之间的颈：贴在边上时是弯月面，拉开后中间收细。
 * 末端伸进胶囊的圆头，和胶囊同色，所以看起来是一整块。
 */
export function neckPath(
  edge: StickyEdge,
  wall: number,
  center: number,
  distance: number,
  thickness: number,
): string {
  const half = thickness / 2;
  const amount = Math.min(distance / DOCK_PULL_MAX, 1);
  // 拉长时根部也收窄，否则边缘上会留下两根刺
  const flare = (half + NECK_FLARE) * (1 - 0.4 * amount);
  // 胶囊被拉长时变窄（`stretchScale`）：末端跟着窄一点，不露出肩膀
  const endHalf = half * (1 - 0.06 * amount) - 0.5;
  const end = distance + half;
  const waistAt = distance / 2 + thickness * 0.2;
  const taper = Math.max(1 - distance / DOCK_PULL_MAX, 0);
  const waist = Math.min(Math.max(half * taper ** 1.2, NECK_MIN_HALF), endHalf);
  const p = edgeMapper(edge, wall, center);
  // 第一个控制点压在边缘上：曲线与边缘相切，看起来是铺开的液体，不是尖角
  const wallControl = waist + (flare - waist) * 0.35;
  const side = (sign: 1 | -1) => ({
    toWaist: `C ${p(0, sign * wallControl)} ${p(waistAt * 0.45, sign * waist)} ${p(waistAt, sign * waist)}`,
    toEnd: `C ${p(waistAt + (end - waistAt) * 0.5, sign * waist)} ${p(end - (end - waistAt) * 0.3, sign * endHalf)} ${p(end, sign * endHalf)}`,
    fromEnd: `C ${p(end - (end - waistAt) * 0.3, sign * endHalf)} ${p(waistAt + (end - waistAt) * 0.5, sign * waist)} ${p(waistAt, sign * waist)}`,
    fromWaist: `C ${p(waistAt * 0.45, sign * waist)} ${p(0, sign * wallControl)} ${p(0, sign * flare)}`,
  });
  const up = side(-1);
  const down = side(1);
  return [
    `M ${p(0, -flare)}`,
    up.toWaist,
    up.toEnd,
    `L ${p(end, endHalf)}`,
    down.fromEnd,
    down.fromWaist,
    "Z",
  ].join(" ");
}

/** 颈断开后留在边缘的一小团，缩回去时用。长度太短就不画。 */
export function wallBumpPath(
  edge: StickyEdge,
  wall: number,
  center: number,
  length: number,
  thickness: number,
): string {
  if (length < 0.5) return "";
  const flare =
    (thickness / 2 + NECK_FLARE) * Math.min(length / thickness + 0.4, 1);
  const p = edgeMapper(edge, wall, center);
  return [
    `M ${p(0, -flare)}`,
    `C ${p(0, -flare * 0.45)} ${p(length, -flare * 0.35)} ${p(length, 0)}`,
    `C ${p(length, flare * 0.35)} ${p(0, flare * 0.45)} ${p(0, flare)}`,
    "Z",
  ].join(" ");
}

export interface WallBounds {
  minX: number;
  minY: number;
  maxX: number;
}

/** 边缘的坐标：左、上是胶囊能到的最小值，右是胶囊贴边时的右缘。 */
export function wallOf(
  edge: StickyEdge,
  bounds: WallBounds,
  width: number,
): number {
  if (edge === "left") return bounds.minX;
  if (edge === "top") return bounds.minY;
  return bounds.maxX + width;
}

/** 自由拖动时快贴上哪条边：用来提前伸出颈（左右优先，与吸附一致）。 */
export function nearbyWall(
  point: DockPoint,
  bounds: WallBounds,
): { edge: StickyEdge; gap: number } | null {
  const left = point.x - bounds.minX;
  if (left < DOCK_SNAP_DISTANCE)
    return { edge: "left", gap: Math.max(left, 0) };
  const right = bounds.maxX - point.x;
  if (right < DOCK_SNAP_DISTANCE)
    return { edge: "right", gap: Math.max(right, 0) };
  const top = point.y - bounds.minY;
  if (top < DOCK_SNAP_DISTANCE) return { edge: "top", gap: Math.max(top, 0) };
  return null;
}
