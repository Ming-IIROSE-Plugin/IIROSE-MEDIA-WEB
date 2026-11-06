// 胶囊粘在边缘的「蜂蜜拉丝」效果：只有纯函数。胶囊始终 1:1 跟手，粘只表现在形状上：
// 边缘和胶囊之间拉出一条丝，先粗后急细，到阈值断开，两端的尖头各自缩回去。
// 坐标都是 `viewport.ts` 换算后的 CSS 像素，和胶囊的 left / top 同一口径。
import {
  DOCK_SNAP_DISTANCE,
  type DockEdge,
  type DockPoint,
} from "./dockPlacement";

/** 离开贴边位置这么远就断开：距离短，粘的感觉靠形状。 */
export const DOCK_DETACH_PULL = 56;
/** 被拉到最长时，胶囊沿拉动方向变长、另一个方向变窄的比例。 */
const DOCK_STRETCH_ALONG = 0.07;
const DOCK_STRETCH_ACROSS = 0.05;
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

/** 被拉长的胶囊：沿拉动方向变长、另一个方向变窄（CSS `scale` 的值）。 */
export function stretchScale(edge: StickyEdge, distance: number): string {
  const amount = Math.min(distance / DOCK_DETACH_PULL, 1);
  const along = (1 + DOCK_STRETCH_ALONG * amount).toFixed(3);
  const across = (1 - DOCK_STRETCH_ACROSS * amount).toFixed(3);
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
 * 边缘和胶囊之间的丝：贴在边上时是弯月面，拉开后先保持粗、快断时才急剧变细，这样才显得粘。
 * 末端伸进胶囊的圆头，和胶囊同色，所以看起来是一整块。`reach` 是丝细到最细时的长度。
 */
export function neckPath(
  edge: StickyEdge,
  wall: number,
  center: number,
  distance: number,
  thickness: number,
  reach: number = DOCK_DETACH_PULL,
): string {
  const half = thickness / 2;
  const amount = Math.min(distance / reach, 1);
  // 胶囊被拉长时变窄（`stretchScale`）：末端跟着窄一点，不露出肩膀
  const endHalf = half * (1 - DOCK_STRETCH_ACROSS * amount) - 0.5;
  const end = distance + half;
  const waistAt = distance / 2 + thickness * 0.2;
  const waist = Math.min(
    Math.max(half * (1 - amount ** 1.6), NECK_MIN_HALF),
    endHalf,
  );
  // 根部随丝收窄，但始终比丝宽：边缘上留着一片铺开的底
  const flare = waist + (half + NECK_FLARE - waist) * (1 - 0.75 * amount);
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

/** 断开后胶囊上留的尖头：`cap` 是胶囊朝向边缘那一端离边缘的距离。太短就不画。 */
export function pillTailPath(
  edge: StickyEdge,
  wall: number,
  center: number,
  cap: number,
  length: number,
  thickness: number,
): string {
  if (length < 0.5) return "";
  const half = thickness / 2 - 1;
  const base = cap + half;
  const tip = cap - length;
  const p = edgeMapper(edge, wall, center);
  return [
    `M ${p(base, -half)}`,
    `C ${p(cap, -half * 0.8)} ${p(tip + length * 0.35, -half * 0.12)} ${p(tip, 0)}`,
    `C ${p(tip + length * 0.35, half * 0.12)} ${p(cap, half * 0.8)} ${p(base, half)}`,
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
