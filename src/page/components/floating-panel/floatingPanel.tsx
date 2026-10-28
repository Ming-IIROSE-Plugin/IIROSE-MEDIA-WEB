// 插件浮窗（收藏随机、播放进度）共用的外观：样式常量与无状态小组件，不含业务逻辑。
// 以收藏随机的视觉为准（shuffle-picker-panel.md「视觉规范」）；两窗只从这里取外观。
import type { JSX } from "preact";

export const focusRing =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-sky-500 focus-visible:outline-offset-[-2px]";
// 同一属性的 Tailwind 类不能同时出现（顺序由 Tailwind 决定，不由书写顺序）：
// 底色、文字色、描边各自按用途补，不放进公共基类。
export const resetButton = `m-0 cursor-pointer p-0 font-[inherit] ${focusRing}`;
export const plainButton = `${resetButton} border-0 bg-transparent`;
export const iconButton = `${plainButton} text-inherit flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hov:hover:bg-sky-500/8 active:bg-sky-500/15`;
export const textButton = `${plainButton} min-h-[44px] rounded-lg px-3 text-[13px] text-sky-500 hov:hover:bg-sky-500/8 active:bg-sky-500/15`;

/** 描边色：分隔线、输入框、次要按钮共用（宿站 `window.theme` 假值即深色）。 */
export const borderTone = (dark: boolean) =>
  dark ? "border-white/15" : "border-black/10";

/** 面板底色、文字色与描边色。 */
export const panelTheme = (dark: boolean) =>
  dark
    ? "border-white/15 bg-[#242a34] text-[#f4f6fa]"
    : "border-black/10 bg-[#fafbfe] text-[#253047]";

/** 外框：圆角、描边、阴影（不含尺寸与定位，配色另取 panelTheme）。 */
export const panelFrame =
  "rounded-2xl border border-solid shadow-[0_12px_40px_rgba(0,0,0,0.25)] outline-none";

/**
 * 次要按钮（透明底 + 描边，悬停淡天蓝、按压加深）。
 * 不含内边距与字号，由使用处补，避免同属性类并存。
 */
export const secondaryButton = (dark: boolean) =>
  `${resetButton} min-h-[44px] rounded-lg border border-solid bg-transparent text-inherit hov:hover:bg-sky-500/8 active:bg-sky-500/15 ${borderTone(dark)}`;

/** 主按钮（天蓝底白字）；不含内边距与字号。 */
export const primaryButton = `${resetButton} min-h-[44px] rounded-lg border-0 bg-sky-500 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40`;

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
 * 头部行：天蓝图标 + 15px semibold 标题 + 右侧 44×44 关闭钮；整行是拖动手柄，
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
      <span className="text-sky-500">{icon}</span>
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
