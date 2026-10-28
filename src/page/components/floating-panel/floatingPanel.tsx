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

// ---- 主题变体版：给插件主面板用 ----
// 主面板不逐个组件传 dark，而是根节点写 `data-imw-theme`，由 `imw-dark:` 变体
// （注册在 src/app.css）切深色；取值与上面的 panelTheme / borderTone 一致。

/** 主面板根节点 `data-imw-theme` 的取值。 */
export const themeAttr = (dark: boolean) => (dark ? "dark" : "light");

// 主面板强调色：根节点的两个变量（MainAppControlLayer 按主题解析——浅色取当前平台品牌色经
// readableAccent 压深的两份，深色都为 sky-500）。主面板的强调一律经这两个变量，浮窗仍用天蓝常量。
// - `--imw-accent`：实底、描边、淡底、光晕、转圈与空状态图形；
// - `--imw-accent-ink`：强调色文字与图标（浅色下更深，落在光晕与淡底上仍 ≥4.5:1）。

/** 主面板根节点的强调色变量：默认（深色）天蓝，浅色取 `--imw-brand` / `--imw-brand-ink`。 */
export const accentVar =
  "[--imw-accent:var(--color-sky-500,#0ea5e9)] data-[imw-theme=light]:[--imw-accent:var(--imw-brand,var(--color-sky-500,#0ea5e9))] [--imw-accent-ink:var(--color-sky-500,#0ea5e9)] data-[imw-theme=light]:[--imw-accent-ink:var(--imw-brand-ink,var(--color-sky-500,#0ea5e9))]";

/**
 * 主面板表面：浅色柔灰底 + 顶部四行背后的强调色光晕（约 16% 向下渐隐，只在顶部区域）；
 * 深色同浮窗表面、无光晕。
 */
export const themedSurface =
  "bg-[#eef1f6] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--imw-accent)_16%,transparent)_0px,color-mix(in_oklab,var(--imw-accent)_6%,transparent)_110px,transparent_180px)] text-[#253047] imw-dark:bg-[#242a34] imw-dark:bg-none imw-dark:text-[#f4f6fa]";

/** 描边色（同 borderTone）；描边宽度与线型由使用处补。 */
export const themedBorder = "border-black/10 imw-dark:border-white/15";

/** 底部分隔线：用内阴影画，不占盒子高度（各行高度约定不受影响）。 */
export const themedDividerBottom =
  "shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)] imw-dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.15)]";

/** 次要文字。 */
export const mutedText = "opacity-65";

/** 强调色文字/图标（用 ink：浅色下压得更深，落在光晕与淡底上仍可读）。 */
export const accentText = "text-(color:--imw-accent-ink)";

/** 悬停淡强调、按压加深（透明底控件用）。 */
export const pressTone =
  "hov:hover:bg-(color:--imw-accent)/8 active:bg-(color:--imw-accent)/15";

/**
 * 分段标签选中段：强调色实底白字（描边同为强调色，不与 themedBorder 并存）；
 * 抬到相邻段之上，四边都露出强调色描边。
 */
export const selectedSegment =
  "relative z-[1] border-(color:--imw-accent) bg-(color:--imw-accent) font-semibold text-white";

/** 分段标签未选段：透明底、主题描边、悬停淡强调。 */
export const idleSegment = `${themedBorder} bg-transparent ${pressTone}`;

/**
 * 相连分段的首尾圆角；非首段左移 1px 与前一段描边重叠（不叠出 2px 竖线），
 * 选中段靠 selectedSegment 的 z-index 盖在上面，左右描边对称。
 */
export const segmentEdge = (index: number, count: number) =>
  [
    index === 0 ? "rounded-l-lg" : "",
    index === count - 1 ? "rounded-r-lg" : "",
    index > 0 ? "-ml-px" : "",
  ]
    .filter(Boolean)
    .join(" ");

/**
 * 主面板次要按钮：透明底 + 主题描边、`rounded-lg`、悬停淡强调。
 * 不含尺寸、内边距、字号与文字色，由使用处补。
 */
export const themedSecondaryButton = `rounded-lg border border-solid bg-transparent ${themedBorder} ${pressTone}`;

/** 主面板次要按钮的开启态：强调色描边与文字、淡强调底（替换 themedSecondaryButton）。 */
export const themedSecondaryButtonOn =
  "rounded-lg border border-solid border-(color:--imw-accent) bg-(color:--imw-accent)/10 text-(color:--imw-accent-ink) active:bg-(color:--imw-accent)/15";

/**
 * 主面板结果卡片与列表行的表面：浅色白底 + black/8 描边 + 轻阴影；
 * 深色次级表面 white/[0.04] + white/10 描边、无阴影。圆角与内边距由使用处补。
 */
export const themedCard =
  "border border-solid bg-white border-black/8 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.07)] imw-dark:bg-white/[0.04] imw-dark:border-white/10 imw-dark:shadow-none";

/** 强调色实底白字（不含交互反馈；禁用态直接用它再补 opacity）。 */
export const accentFill = "border-0 bg-(color:--imw-accent) text-white";

/** 强调色实心按钮（白字，悬停/按压减淡）；不含尺寸、圆角与字号。 */
export const accentFillButton = `${accentFill} hov:hover:opacity-90 active:opacity-80`;

/** 强调色描边次要按钮；不含尺寸、圆角与字号。 */
export const accentOutlineButton =
  "border border-solid border-(color:--imw-accent)/45 bg-transparent text-(color:--imw-accent-ink) hov:hover:bg-(color:--imw-accent)/8 active:bg-(color:--imw-accent)/15";

/** 封面占位底（图片未加载或透明处）。 */
export const coverPlaceholder = "bg-black/10 imw-dark:bg-white/[0.06]";

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
