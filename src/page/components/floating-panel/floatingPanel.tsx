// 插件浮窗（收藏随机、播放进度）共用的外观：样式常量与无状态小组件，不含业务逻辑。
// 外观一律取 tokens.ts 的成对令牌（纸 / 墨 / 蔷薇红），与主面板视觉同源（CAP-12）。
import type { JSX } from "preact";
import {
  deskFocusRing,
  deskFocusRingOnRose,
  deskInk,
  deskOnRose,
  deskPressTone,
  deskRose,
  deskRoseSolid,
  deskRule,
  deskSheet,
} from "./tokens";

// 焦点环：2px ink 外圈、2px 间隔（DESIGN.md components.focus-ring）。
export const focusRing = deskFocusRing;
// 同一属性的 Tailwind 类不能同时出现（顺序由 Tailwind 决定，不由书写顺序）：
// 底色、文字色、描边各自按用途补，不放进公共基类。
export const resetBase = "m-0 cursor-pointer p-0 font-[inherit]";
export const resetButton = `${resetBase} ${focusRing}`;
export const plainButton = `${resetButton} border-0 bg-transparent`;
export const iconButton = `${plainButton} text-inherit flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${deskPressTone}`;
export const textButton = `${plainButton} min-h-[44px] rounded-lg px-3 text-[13px] ${deskRose} ${deskPressTone}`;

/** 面板底色、文字色与描边色（sheet 底、ink 字、rule 描边）。 */
export const panelSurface = `${deskSheet} ${deskInk} ${deskRule}`;

/** 描边色：分隔线、输入框、次要按钮共用（rule）。 */
export const panelBorder = deskRule;

/** 外框：圆角、描边（浮层靠 sheet 底 + 1px rule，不用投影）。 */
export const panelFrame = "rounded-2xl border border-solid outline-none";

/**
 * 次要按钮（透明底 + rule 描边，悬停淡底色、按压加深）。
 * 不含内边距与字号，由使用处补，避免同属性类并存。
 */
export const secondaryButton = `${resetButton} min-h-[44px] rounded-lg border border-solid bg-transparent text-inherit ${deskPressTone} ${panelBorder}`;

/** 主按钮（蔷薇红实底 + on-rose 字色，焦点环带 paper 内环）；不含内边距与字号。 */
export const primaryButton = `${resetBase} min-h-[44px] rounded-lg border-0 font-semibold ${deskRoseSolid} ${deskOnRose} ${deskFocusRingOnRose} disabled:cursor-not-allowed disabled:opacity-40`;

/** 主面板根节点 `data-imw-theme` 的取值（浮窗根也写同一个值）。 */
export const themeAttr = (dark: boolean) => (dark ? "dark" : "light");

/** 拖动手柄的光标与触控行为。 */
export const dragHandleClass = (dragging: boolean) =>
  `touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`;

export function Svg({
  size,
  children,
  className = "",
  strokeWidth = 2,
}: {
  size: number;
  children: JSX.Element | JSX.Element[];
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      className={`block shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const CloseIcon = () => (
  <Svg size={20}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

/** 手柄内的这些可交互元素上按下不开始拖动。 */
export const NO_DRAG_SELECTOR =
  'button, input, select, textarea, a, [role="tab"], [tabindex]';

/**
 * 指针是否按在手柄内部的可交互元素上（只看手柄内部：面板自身带 tabindex，不能算进来）。
 */
export function startsOnControl(event: {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
}): boolean {
  const blocker = (event.target as Element | null)?.closest?.(NO_DRAG_SELECTOR);
  return !!blocker && !!(event.currentTarget as Node | null)?.contains(blocker);
}

const stopPropagation = (event: Event) => event.stopPropagation();

/**
 * 铺在浮窗根节点上：只 stopPropagation，不 preventDefault（指针拖动、滚动照常）。
 * - 触摸不冒泡到 window：插件主面板的双指下滑手势不被误触发。
 * - 鼠标按下/抬起不冒泡到 document：宿站在 document 上用 mousedown→mouseup（500ms 内）
 *   识别滑动手势，浮窗里的拖动会被当成右滑返回或左滑打开「捷径」等。
 */
export const stopHostGestures = {
  onTouchStart: stopPropagation,
  onTouchMove: stopPropagation,
  onTouchEnd: stopPropagation,
  onMouseDown: stopPropagation,
  onMouseUp: stopPropagation,
};

/** 拖动手柄需要的指针事件（由使用处实现拖动逻辑）。 */
export type DragHandleProps = Pick<
  JSX.HTMLAttributes<HTMLDivElement>,
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "onPointerCancel"
  | "onLostPointerCapture"
>;

/** 移动端顶部的装饰拖拽条（本身也是拖动手柄），桌面隐藏。 */
export function DragGrip({
  dragging,
  handle,
}: {
  dragging: boolean;
  handle: DragHandleProps;
}) {
  return (
    <div
      className={`hidden shrink-0 justify-center pt-2 max-[768px]:flex ${dragHandleClass(dragging)}`}
      aria-hidden="true"
      {...handle}
    >
      <div className="h-1 w-9 rounded-full bg-current opacity-25" />
    </div>
  );
}

/**
 * 头部行：蔷薇红图标 + 15px semibold 标题 + 右侧 44×44 关闭钮；整行是拖动手柄，
 * handle 的实现用 startsOnControl 排除关闭钮。
 */
export function PanelHeader({
  icon,
  title,
  titleId,
  closeLabel,
  onClose,
  dragging,
  handle,
}: {
  icon: JSX.Element;
  title: string;
  titleId?: string;
  closeLabel: string;
  onClose: () => void;
  dragging: boolean;
  handle: DragHandleProps;
}) {
  return (
    <div
      className={`flex h-12 shrink-0 items-center gap-2 pl-4 pr-1 ${dragHandleClass(dragging)}`}
      {...handle}
    >
      <span className={deskRose}>{icon}</span>
      <span id={titleId} className="text-[15px] font-semibold">
        {title}
      </span>
      <button
        type="button"
        className={`${iconButton} ml-auto`}
        aria-label={closeLabel}
        onClick={onClose}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
