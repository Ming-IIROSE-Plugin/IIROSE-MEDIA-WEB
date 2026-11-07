// 胶囊的形状：只有纯函数。胶囊和粘连是同一条轮廓，所有状态都从 `dockShape` 算出来：贴边时带两个耳朵，
// 往外拉时拉出一条丝（先粗后急细，到阈值断开，两端的尖头各自缩回去），胶囊始终 1:1 跟手。
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
/** 耳朵：轮廓在边缘处比胶囊两侧各多出的宽度。 */
const NECK_FLARE = 8;
/** 丝收到最细时的半宽。 */
const NECK_MIN_HALF = 1.5;
/** 上边收起时再藏进去的长度。 */
const TOP_TUCK = 8;
/** 胶囊上下或左右两侧的边框加起来的宽度：内容要扣掉它才居中。 */
const DOCK_BORDERS = 2;
/** 贝塞尔曲线画四分之一圆的控制点比例。 */
const CIRCLE_K = 0.5523;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;
const fmt = (value: number) => +value.toFixed(2);

/** 胶囊展开时的尺寸和内容排布，桌面和手机各一份，见 `dockMeasure.ts`。 */
export interface DockMetrics {
  width: number;
  height: number;
  /** 贴左右边收起时露出的长度。 */
  peek: number;
  /** 按钮的内边距和图标与文字的间距。 */
  pad: number;
  gap: number;
  icon: number;
  font: number;
}

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

/** `a` 是离边缘的距离，`b` 是沿边缘相对中心的偏移。 */
function edgeMapper(edge: StickyEdge, wall: number, center: number) {
  return (a: number, b: number) => {
    const [x, y] =
      edge === "top"
        ? [center + b, wall + a]
        : [edge === "left" ? wall + a : wall - a, center + b];
    return `${fmt(x)} ${fmt(y)}`;
  };
}

/**
 * 贴边胶囊的完整轮廓：边上的根 → 腰 → 胶囊肩 → 远端两角 → 回到根。`gap` 是胶囊离边缘的距离，
 * 为 0 时腰等于胶囊半宽，根就是两个耳朵；拉开后腰先保持粗、快断时才急剧变细，这样才显得粘。
 * `reach` 是丝细到最细时的长度。全程只有一条线，所以胶囊和粘连之间不可能露缝。
 */
export function dockOutline(
  edge: StickyEdge,
  wall: number,
  center: number,
  gap: number,
  length: number,
  half: number,
  corner: number,
  reach: number = DOCK_DETACH_PULL,
): string {
  const p = edgeMapper(edge, wall, center);
  const amount = clamp(gap / reach, 0, 1);
  const waist = Math.max(half * (1 - amount ** 1.6), NECK_MIN_HALF);
  // 根部随丝收窄，但始终比丝宽：边缘上留着一片铺开的底
  const foot = waist + (half + NECK_FLARE - waist) * (1 - 0.75 * amount);
  const near = clamp(gap / 12, 0, 1);
  const end = gap + length;
  const round = Math.min(corner, half, length);
  const k = CIRCLE_K * round;
  // 轮廓从这里并到胶囊的直边上：贴着时是耳朵的宽度，拉开后退到圆头开始的地方
  const merge = Math.min(gap + lerp(NECK_FLARE, corner, near), end - round);
  const waistAt = merge * lerp(0.9, 0.45, near);
  // 第一个控制点压在边缘上：曲线与边缘相切，看起来是铺开的液体，不是尖角
  const wallControl = waist + (foot - waist) * 0.35;
  const toWaist = (sign: 1 | -1) =>
    `C ${p(0, sign * wallControl)} ${p(waistAt * 0.45, sign * waist)} ${p(waistAt, sign * waist)}`;
  const toBody = (sign: 1 | -1) =>
    `C ${p(waistAt + (merge - waistAt) * 0.5, sign * waist)} ${p(merge - (merge - waistAt) * 0.35, sign * half)} ${p(merge, sign * half)}`;
  const fromBody = (sign: 1 | -1) =>
    `C ${p(merge - (merge - waistAt) * 0.35, sign * half)} ${p(waistAt + (merge - waistAt) * 0.5, sign * waist)} ${p(waistAt, sign * waist)}`;
  const fromWaist = (sign: 1 | -1) =>
    `C ${p(waistAt * 0.45, sign * waist)} ${p(0, sign * wallControl)} ${p(0, sign * foot)}`;
  return [
    `M ${p(0, -foot)}`,
    toWaist(-1),
    toBody(-1),
    `L ${p(end - round, -half)}`,
    `C ${p(end - round + k, -half)} ${p(end, -half + round - k)} ${p(end, -half + round)}`,
    `L ${p(end, half - round)}`,
    `C ${p(end, half - round + k)} ${p(end - round + k, half)} ${p(end - round, half)}`,
    `L ${p(merge, half)}`,
    fromBody(1),
    fromWaist(1),
    "Z",
  ].join(" ");
}

/** 不贴边时的胶囊：四角都圆。 */
export function dockCapsule(
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const r = Math.min(width, height) / 2;
  const k = CIRCLE_K * r;
  const right = x + width;
  const bottom = y + height;
  const at = (px: number, py: number) => `${fmt(px)} ${fmt(py)}`;
  return [
    `M ${at(x + r, y)}`,
    `L ${at(right - r, y)}`,
    `C ${at(right - r + k, y)} ${at(right, y + r - k)} ${at(right, y + r)}`,
    `L ${at(right, bottom - r)}`,
    `C ${at(right, bottom - r + k)} ${at(right - r + k, bottom)} ${at(right - r, bottom)}`,
    `L ${at(x + r, bottom)}`,
    `C ${at(x + r - k, bottom)} ${at(x, bottom - r + k)} ${at(x, bottom - r)}`,
    `L ${at(x, y + r)}`,
    `C ${at(x, y + r - k)} ${at(x + r - k, y)} ${at(x + r, y)}`,
    "Z",
  ].join(" ");
}

/** 丝断开后留在边缘的一小团，缩回去时用。长度太短就不画。 */
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

export interface DockShapeBounds extends WallBounds {
  maxY: number;
}

export interface DockShapeInput {
  /** 胶囊展开时的左上角，落定动画期间含还没走完的偏移。 */
  point: DockPoint;
  edge: DockEdge | null;
  /** 展开程度：0 收起，1 展开。不贴边时不看它。 */
  open: number;
  metrics: DockMetrics;
  bounds: DockShapeBounds;
  /** 自由拖动时快贴上的边：边缘提前伸出来接它。 */
  approach?: { edge: StickyEdge; gap: number } | null;
  /** 断开后还没缩完的两个尖头，长度已经按剩余比例算好。`center` 是断开时在边上的位置。 */
  tips?: {
    edge: StickyEdge;
    center: number;
    bump: number;
    tail: number;
  } | null;
}

/** 文字和图标的摆放。形状和内容都从这里来，不从 DOM 量回胶囊的宽度，所以不会分家。 */
export interface DockBox {
  x: number;
  y: number;
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  gap: number;
  /** 贴左边时露出的是胶囊右端：图标换到右边。 */
  reversed: boolean;
  centered: boolean;
  labelOpacity: number;
  /** 文字的最大宽度（em）：上下边收起时收到 0。 */
  labelMaxEm: number;
  /** 圆角：靠边那一侧是直的，这样点得到的范围和画出来的一样，靠墙的角也点得到。 */
  radius: string;
}

/** 文字「点歌台」放得下的宽度。 */
const LABEL_MAX_EM = 4;

/**
 * 贴边胶囊在边上的量：墙在哪、胶囊中心、离墙多远开始、沿边多长、横向半宽。
 * 轮廓（`dockShape`）和露出的那块（`dockSilhouette`）都从这里算，两边不会对不上。
 */
function stuckMeasure(
  edge: StickyEdge,
  { point, open, metrics, bounds }: DockSilhouetteInput,
) {
  const { width, height, peek } = metrics;
  const side = edge !== "top";
  const wall = wallOf(edge, bounds, width);
  const distance = Math.max(
    edge === "left"
      ? point.x - bounds.minX
      : edge === "right"
        ? bounds.maxX - point.x
        : point.y - bounds.minY,
    0,
  );
  const center = side ? point.y + height / 2 : point.x + width / 2;
  const stretch = clamp(distance / DOCK_DETACH_PULL, 0, 1);
  const base = side
    ? lerp(peek, width, open)
    : lerp(height - TOP_TUCK, height, open);
  const length = base * (1 + DOCK_STRETCH_ALONG * stretch);
  // 以胶囊中心为基准拉长：中心才能 1:1 跟手
  const start = Math.max(distance - (length - base) / 2, 0);
  const half =
    (side ? height / 2 : lerp(height / 2, width / 2, open)) *
    (1 - DOCK_STRETCH_ACROSS * stretch);
  return { wall, center, start, length, half };
}

export type DockSilhouetteInput = Pick<
  DockShapeInput,
  "point" | "edge" | "open" | "metrics" | "bounds"
>;

/** 胶囊露出来的那块，不含贴边的耳朵：面板从它长出来，也缩回到它。 */
export interface DockSilhouette {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 左上、右上、右下、左下。靠墙那侧是直角。 */
  radii: [number, number, number, number];
}

export function dockSilhouette(input: DockSilhouetteInput): DockSilhouette {
  const { point, edge, open, metrics } = input;
  const { width, height } = metrics;
  if (isStickyEdge(edge)) {
    const { wall, center, start, length, half } = stuckMeasure(edge, input);
    // 和 `dockOutline` 里远端两个角同一个半径
    const r = Math.min(height / 2, half, length);
    if (edge === "top")
      return {
        x: center - half,
        y: wall + start,
        width: half * 2,
        height: length,
        radii: [0, 0, r, r],
      };
    return {
      x: edge === "left" ? wall + start : wall - start - length,
      y: center - half,
      width: length,
      height: half * 2,
      radii: edge === "left" ? [0, r, r, 0] : [r, 0, 0, r],
    };
  }
  // 下边是圆钮，以中心为基准展开；自由状态是完整的胶囊
  const current = edge === "bottom" ? lerp(height, width, open) : width;
  const r = Math.min(current, height) / 2;
  return {
    x: point.x + width / 2 - current / 2,
    y: point.y,
    width: current,
    height,
    radii: [r, r, r, r],
  };
}

export function dockShape({
  point,
  edge,
  open,
  metrics,
  bounds,
  approach,
  tips,
}: DockShapeInput): { path: string; tips: string; box: DockBox } {
  const { width, height, peek, pad, gap: spacing, icon } = metrics;
  const r = height / 2;
  const shape = (): { path: string; box: DockBox } => {
    if (isStickyEdge(edge)) {
      const { wall, center, start, length, half } = stuckMeasure(edge, {
        point,
        edge,
        open,
        metrics,
        bounds,
      });
      const path = dockOutline(
        edge,
        wall,
        center,
        start,
        length,
        half,
        height / 2,
      );
      if (edge === "top")
        return {
          path,
          box: {
            x: center - half,
            // 图标放在看得见的那一段正中
            y: wall + start + length / 2 - height / 2,
            width: half * 2,
            height,
            padLeft: 0,
            padRight: 0,
            gap: spacing * open,
            reversed: false,
            centered: true,
            labelOpacity: open,
            labelMaxEm: LABEL_MAX_EM * open,
            radius: `0 0 ${r}px ${r}px`,
          },
        };
      // 收起时图标在露出的那一段正中，展开时回到正常内边距
      const inset = lerp((peek - DOCK_BORDERS - icon) / 2, pad, open);
      return {
        path,
        box: {
          x: edge === "left" ? wall + start : wall - start - length,
          y: center - height / 2,
          width: length,
          height,
          padLeft: edge === "right" ? inset : 0,
          padRight: edge === "left" ? inset : 0,
          gap: spacing,
          reversed: edge === "left",
          centered: false,
          labelOpacity: open,
          labelMaxEm: LABEL_MAX_EM,
          radius: edge === "left" ? `0 ${r}px ${r}px 0` : `${r}px 0 0 ${r}px`,
        },
      };
    }
    if (edge === "bottom") {
      // 下边是输入框上方的线，不粘：圆钮，以中心为基准展开
      const current = lerp(height, width, open);
      const x = point.x + width / 2 - current / 2;
      return {
        path: dockCapsule(x, point.y, current, height),
        box: {
          x,
          y: point.y,
          width: current,
          height,
          padLeft: 0,
          padRight: 0,
          gap: spacing * open,
          reversed: false,
          centered: true,
          labelOpacity: open,
          labelMaxEm: LABEL_MAX_EM * open,
          radius: `${r}px`,
        },
      };
    }
    const across = approach && approach.edge === "top";
    return {
      path: approach
        ? dockOutline(
            approach.edge,
            wallOf(approach.edge, bounds, width),
            across ? point.x + width / 2 : point.y + height / 2,
            approach.gap,
            across ? height : width,
            across ? width / 2 : height / 2,
            height / 2,
            DOCK_SNAP_DISTANCE,
          )
        : dockCapsule(point.x, point.y, width, height),
      box: {
        x: point.x,
        y: point.y,
        width,
        height,
        padLeft: pad,
        padRight: pad,
        gap: spacing,
        reversed: false,
        centered: true,
        labelOpacity: 1,
        labelMaxEm: LABEL_MAX_EM,
        radius: `${r}px`,
      },
    };
  };
  const { path, box } = shape();
  if (!tips) return { path, tips: "", box };
  const wall = wallOf(tips.edge, bounds, width);
  const cap =
    tips.edge === "left"
      ? point.x - wall
      : tips.edge === "right"
        ? wall - point.x - width
        : point.y - wall;
  const tailCenter =
    tips.edge === "top" ? point.x + width / 2 : point.y + height / 2;
  return {
    path,
    // 尖头和胶囊重叠，放进同一条路径的话，绕向相反的地方会被抠出一个洞，所以单独一条
    tips: [
      wallBumpPath(tips.edge, wall, tips.center, tips.bump, height),
      pillTailPath(tips.edge, wall, tailCenter, cap, tips.tail, height),
    ]
      .filter(Boolean)
      .join(" "),
    box,
  };
}
