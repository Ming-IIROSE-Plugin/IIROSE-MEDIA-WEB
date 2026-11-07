// 面板开合：胶囊本身撑大成面板，收起时缩回胶囊（维护者在试玩页选定的方案 A）。
// 只裁不缩：面板内容始终是原尺寸，变的只是露出来的范围（容器的 clip-path），从胶囊露出的那块
// 长到面板矩形。胶囊在面板范围外时（窗口模式），露出的那块贴着胶囊那一侧，用 translate 挪过去，
// 长到最后归零。另有两个跟着形状走的 fixed 元素：上层是胶囊同色的底，盖住还没浮现的内容；
// 下层是投影。停稳后这些全部清掉：面板停稳时不能带 transform（见 adr-panel-rests-without-transform.md）。
import { deskMenuShadow, deskSheet } from "../floating-panel/tokens";
import type { DockSilhouette } from "./dockLiquid";
import type { PanelRect } from "./geometry";

/** 露出来的范围：矩形加四角圆角（左上、右上、右下、左下），和胶囊的剪影同一种形状。 */
export type GrowShape = DockSilhouette;
export type GrowDirection = "open" | "close";

export const GROW_OPEN_MS = 450;
export const GROW_CLOSE_MS = 300;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;
/** x 从 a 走到 b 时，平滑地从 0 变到 1。 */
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const px = (value: number) => `${+value.toFixed(2)}px`;

/** CSS `cubic-bezier()` 的数值版本：按 x 二分求参数，再取 y。 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 40; i++) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

const openEase = cubicBezier(0.2, 0, 0, 1);
const closeEase = cubicBezier(0.3, 0, 0.8, 0.15);

/** 开合程度（0 是胶囊，1 是面板）随进度变化：打开先快后慢，收起先慢后快。 */
export function growOpenness(
  direction: GrowDirection,
  progress: number,
): number {
  return direction === "open" ? openEase(progress) : 1 - closeEase(progress);
}

/** 中途反向：新方向从哪个进度开始，形状才接得上。两条曲线都单调，二分就够了。 */
export function growResume(direction: GrowDirection, openness: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const reached =
      direction === "open"
        ? growOpenness("open", mid) >= openness
        : growOpenness("close", mid) <= openness;
    if (reached) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function growShape(
  from: GrowShape,
  to: GrowShape,
  amount: number,
): GrowShape {
  return {
    x: lerp(from.x, to.x, amount),
    y: lerp(from.y, to.y, amount),
    width: lerp(from.width, to.width, amount),
    height: lerp(from.height, to.height, amount),
    radii: from.radii.map((radius, i) =>
      Math.max(0, lerp(radius, to.radii[i], amount)),
    ) as GrowShape["radii"],
  };
}

export interface GrowFrame {
  shape: GrowShape;
  /** 面板内容露出多少：其余部分被胶囊同色的底盖着。 */
  content: number;
  /** 胶囊的可见程度：打开时先淡出，收起时最后淡入接手。 */
  dock: number;
  /** 投影的浓度。 */
  shadow: number;
}

export function growFrame(
  direction: GrowDirection,
  progress: number,
  capsule: GrowShape,
  panel: GrowShape,
): GrowFrame {
  const openness = growOpenness(direction, progress);
  const opening = direction === "open";
  return {
    shape: growShape(capsule, panel, openness),
    content: opening
      ? smooth(0.1, 0.5, progress)
      : 1 - smooth(0, 0.38, progress),
    dock: opening ? 1 - smooth(0, 0.22, progress) : smooth(0.8, 1, progress),
    shadow: openness,
  };
}

/**
 * 露出的是面板的哪一块：取胶囊在面板里的相对位置。胶囊在面板范围内时，露出的正好是胶囊底下那块，
 * 不用挪；在范围外（窗口模式）时贴着靠近胶囊的那一侧。
 */
export function growAnchor(capsule: GrowShape, panel: PanelRect) {
  const axis = (at: number, size: number, from: number, span: number) =>
    span > size ? clamp01((at - from) / (span - size)) : 0.5;
  return {
    x: axis(capsule.x, capsule.width, panel.x, panel.width),
    y: axis(capsule.y, capsule.height, panel.y, panel.height),
  };
}

/** 露出的范围换成容器的 clip-path inset（上、右、下、左）和 translate，都是容器自己的坐标。 */
export function growClip(
  shape: GrowShape,
  panel: PanelRect,
  anchor: { x: number; y: number },
) {
  const width = Math.min(shape.width, panel.width);
  const height = Math.min(shape.height, panel.height);
  const left = (panel.width - width) * anchor.x;
  const top = (panel.height - height) * anchor.y;
  return {
    inset: [
      top,
      panel.width - left - width,
      panel.height - top - height,
      left,
    ] as const,
    translate: { x: shape.x - left - panel.x, y: shape.y - top - panel.y },
  };
}

export interface GrowRun {
  direction: GrowDirection;
  /** 胶囊露出的那块：打开的起点，收起的终点。 */
  capsule: GrowShape;
  /** 面板停稳时的矩形和圆角。 */
  panel: GrowShape;
  /** 每帧告诉胶囊该多可见。 */
  onDock(amount: number): void;
  /** 走完了。被反向打断的那一段不调用。 */
  onDone(): void;
}

export interface PanelGrow {
  /** 开始一段开合；上一段没走完就从当前形状接着走。 */
  start(run: GrowRun): void;
  /** 立刻走到终点并清掉所有内联样式和跟随元素（卸载时）。 */
  finish(): void;
  readonly running: boolean;
}

/** 动画期间写在容器上的属性，停稳后全部移除。 */
const CONTAINER_PROPS = [
  "clip-path",
  "translate",
  "visibility",
  "opacity",
  "pointer-events",
];

/** 动画期间点到正在长的形状上：吞掉，别落到下面的宿站或刚露出来的面板按钮上（比如双击胶囊的第二下）。 */
const SWALLOWED_EVENTS = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "click",
  "dblclick",
  "contextmenu",
  "touchstart",
  "touchend",
];
const swallow = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
};

export function createPanelGrow(
  container: () => HTMLElement | null,
  reducedMotion: () => boolean,
): PanelGrow {
  let run: GrowRun | null = null;
  /** 这一段从哪个进度开始：中途反向时不是 0。 */
  let from = 0;
  /** 中途反向时上一段的胶囊：起点和终点胶囊不一样（悬停展开 / 收起），在这一段里平滑换过去。 */
  let blendFrom: GrowShape | null = null;
  /** 上一帧实际用的胶囊。 */
  let lastCapsule: GrowShape | null = null;
  let startedAt: number | null = null;
  /** 第一帧先不计时：首次打开时面板挂上后的那一大段工作落在这里，不会把动画顶出一跳。 */
  let warmed = false;
  let frame = 0;
  let openness = 0;
  let veil: HTMLDivElement | null = null;
  let shadow: HTMLDivElement | null = null;

  const follower = (kind: string, className: string) => {
    const node = document.createElement("div");
    node.setAttribute("data-imw-grow", kind);
    node.setAttribute("aria-hidden", "true");
    node.className = className;
    return node;
  };

  /** 跟随元素和容器放在同一个父节点下：`fixed` 的基准一样，坐标才对得上。 */
  const attachFollowers = (element: HTMLElement) => {
    const parent = element.parentElement;
    if (!parent) return;
    if (!veil) {
      veil = follower("veil", `fixed z-[90001] ${deskSheet}`);
      for (const type of SWALLOWED_EVENTS)
        veil.addEventListener(type, swallow, { passive: false });
    }
    shadow ??= follower(
      "shadow",
      `pointer-events-none fixed z-[89999] ${deskMenuShadow}`,
    );
    const theme = element.getAttribute("data-imw-theme");
    for (const node of [shadow, veil]) {
      if (theme) node.setAttribute("data-imw-theme", theme);
      else node.removeAttribute("data-imw-theme");
      if (node.parentElement !== parent) parent.appendChild(node);
    }
  };

  const place = (
    node: HTMLElement | null,
    shape: GrowShape,
    opacity: number,
  ) => {
    if (!node) return;
    Object.assign(node.style, {
      left: px(shape.x),
      top: px(shape.y),
      width: px(shape.width),
      height: px(shape.height),
      borderRadius: shape.radii.map(px).join(" "),
      opacity: `${clamp01(opacity)}`,
    });
  };

  const paint = (progress: number) => {
    const current = run;
    const element = container();
    if (!current) return;
    openness = growOpenness(current.direction, progress);
    const capsule = blendFrom
      ? growShape(
          blendFrom,
          current.capsule,
          smooth(0, 1, (progress - from) / Math.max(1 - from, 1e-6)),
        )
      : current.capsule;
    lastCapsule = capsule;
    const shot = growFrame(current.direction, progress, capsule, current.panel);
    current.onDock(shot.dock);
    if (!element) return;
    // 露出的是面板的哪一块跟着胶囊走：胶囊在面板范围内时 translate 恒为 0
    const { inset, translate } = growClip(
      shot.shape,
      current.panel,
      growAnchor(capsule, current.panel),
    );
    const { style } = element;
    style.clipPath = `inset(${inset.map(px).join(" ")} round ${shot.shape.radii.map(px).join(" ")})`;
    // 胶囊在面板范围内时不挪：不带 translate，里面的 fixed 也就不换基准
    style.translate =
      Math.abs(translate.x) < 0.01 && Math.abs(translate.y) < 0.01
        ? ""
        : `${px(translate.x)} ${px(translate.y)}`;
    // 动画期间点不到：双击胶囊时，第二下不能落在刚露出来的面板内容上（比如「点播」钮）
    style.pointerEvents = "none";
    if (current.direction === "close") {
      // 收起时容器已经摘掉打开的类：动画期间仍要看得见
      style.visibility = "visible";
      style.opacity = "1";
    }
    place(veil, shot.shape, 1 - shot.content);
    place(shadow, shot.shape, shot.shadow * (1 - shot.dock));
  };

  const clear = () => {
    const element = container();
    if (element)
      for (const name of CONTAINER_PROPS) element.style.removeProperty(name);
    veil?.remove();
    shadow?.remove();
    veil = null;
    shadow = null;
  };

  const complete = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    startedAt = null;
    blendFrom = null;
    lastCapsule = null;
    const done = run;
    run = null;
    clear();
    if (!done) return;
    const opened = done.direction === "open";
    openness = opened ? 1 : 0;
    done.onDock(opened ? 0 : 1);
    done.onDone();
  };

  const tick = (now: number) => {
    frame = 0;
    if (!run) return;
    // 第二帧才开始计时：首次打开时面板挂上后的工作会在第一帧之后拖出一段长帧，
    // 从第一帧就计时的话，这段时间会被算进动画，开头一跳
    if (!warmed) {
      warmed = true;
      frame = requestAnimationFrame(tick);
      return;
    }
    startedAt ??= now;
    const duration = run.direction === "open" ? GROW_OPEN_MS : GROW_CLOSE_MS;
    const progress = Math.min(from + (now - startedAt) / duration, 1);
    paint(progress);
    // 终点那一帧要真的画出来，下一帧再清掉：收起的曲线越走越快，同一帧里清掉的话，
    // 屏幕上最后看到的是还有两成大的面板，接着一下子没了
    frame = requestAnimationFrame(progress >= 1 ? complete : tick);
  };

  return {
    start(next) {
      const resumed = run !== null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      run = next;
      if (reducedMotion()) {
        complete();
        return;
      }
      from = resumed ? growResume(next.direction, openness) : 0;
      blendFrom = resumed ? lastCapsule : null;
      startedAt = null;
      warmed = false;
      const element = container();
      if (element) attachFollowers(element);
      // 同步画第一帧：容器换类之后、浏览器绘制之前就已经裁好，不会闪出整个面板
      paint(from);
      frame = requestAnimationFrame(tick);
    },
    finish: complete,
    get running() {
      return run !== null;
    },
  };
}
