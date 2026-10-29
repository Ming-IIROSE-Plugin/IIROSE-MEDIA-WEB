// 点歌台「纸 / 墨 / 蔷薇红」外观令牌：DESIGN.md frontmatter 的唯一落点。
//
// 约定：这里只导出**成对的完整 Tailwind 类串**（浅色类 + `imw-dark:` 类），组件拿到的
// 是一个不可拆分的整体，既拼错不了深色值，也天然满足「深色取同名 `-dark`」。
// 唯一的显式例外是承载白字的蔷薇红实底（DESIGN.md `rose-fill-dark`）与反相面（墨底纸字）。
// 组件不得裸写颜色、`rgba`、`themed*` 或 `accentVar`，需要新颜色时先在这里加令牌。
import { h } from "preact";

// ---------------------------------------------------------------- 字体栈
// 不加载网络字体：黑体 / 宋体 / 等宽一律回退系统字体（DESIGN.md Typography）。
const fontSans = "font-['PingFang_SC','Microsoft_YaHei',sans-serif]";
const fontSerif = "font-['Songti_SC','SimSun',serif]";
const fontMono = "font-[ui-monospace,'SF_Mono',monospace]";

// ---------------------------------------------------------------- 颜色
/** 主内容区底色（paper）。 */
export const deskPaper = "bg-[#F5F2EC] imw-dark:bg-[#141312]";
/** 桌面竖栏底色（rail）。 */
export const deskRail = "bg-[#EDE8DF] imw-dark:bg-[#0F0E0D]";
/** 抬起的面：搜索栏、选中的竖栏项、视图分段选中格（sheet）。 */
export const deskSheet = "bg-[#FBFAF7] imw-dark:bg-[#1C1A18]";
/** 行悬停底、来源切换器常态底（hover）。 */
export const deskHover = "bg-[#EFEBE3] imw-dark:bg-[#201E1C]";
/** 封面 / 缩略图占位底（thumb）。 */
export const deskThumb = "bg-[#E6E0D6] imw-dark:bg-[#262320]";

/** 一级文字（ink）。 */
export const deskInk = "text-[#1C1916] imw-dark:text-[#EDE7DD]";
/** 二级文字（ink2）。 */
export const deskInk2 = "text-[#5F5850] imw-dark:text-[#A79E92]";
/** 三级文字（ink3）。 */
export const deskInk3 = "text-[#6B655D] imw-dark:text-[#8F887E]";

/** 蔷薇红文字 / 细线 / 指示条（rose）。 */
export const deskRose = "text-[#B42F3E] imw-dark:text-[#E3606C]";
/** 蔷薇红图形：竖栏指示条、标签栏选中图标（rose）。 */
export const deskRoseFill = "bg-[#B42F3E] imw-dark:bg-[#E3606C]";
/** 承载白字的蔷薇红实底（浅色 rose / 深色 rose-fill-dark）。 */
export const deskRoseSolid = "bg-[#B42F3E] imw-dark:bg-[#BA4F59]";
/** 蔷薇红实底上的字色（on-rose）。 */
export const deskOnRose = "text-[#FFFFFF]";

/** 分隔线与描边（rule）。 */
export const deskRule = "border-[#E2DCD1] imw-dark:border-[#2B2825]";
/** 用底色画的分隔线（rule）。 */
export const deskRuleFill = "bg-[#E2DCD1] imw-dark:bg-[#2B2825]";

/** 选中竖栏项的细线环（rule）。 */
export const deskRing =
  "shadow-[0_0_0_1px_#E2DCD1] imw-dark:shadow-[0_0_0_1px_#2B2825]";

/** 搜索栏输入光标（rose）。 */
export const deskCaret = "caret-[#B42F3E] imw-dark:caret-[#E3606C]";
/** 输入占位文字（ink3）。 */
export const deskPlaceholder =
  "placeholder:text-[#6B655D] imw-dark:placeholder:text-[#8F887E]";

/** 墨底纸字（搜索按钮、反相的底部条）。 */
export const deskInkSurface = "bg-[#1C1916] imw-dark:bg-[#EDE7DD]";
export const deskPaperText = "text-[#F5F2EC] imw-dark:text-[#141312]";

/** 悬停底与按压底（透明底控件用）。 */
export const deskPressTone =
  "hov:hover:bg-[#EFEBE3] active:bg-[#E6E0D6] imw-dark:hov:hover:bg-[#201E1C] imw-dark:active:bg-[#262320]";

/** 搜索栏几乎不可见的抬升线（DESIGN.md Elevation & Depth，不承载信息）。 */
export const deskSearchShadow = "shadow-[0_1px_0_#00000005]";

/** 平台来源圆点：只做 7px 圆点，从不整片铺色，不随主题变化。 */
export const deskSourceDots = {
  netease: "bg-[#D7371F]",
  bilibili: "bg-[#E1608C]",
  radio: "bg-[#4F7FD6]",
} as const;

export type DeskSourceKey = keyof typeof deskSourceDots;

// ---------------------------------------------------------------- 字号
/** 眉题（等宽大写，ink3）。 */
export const typeEyebrow = `${fontMono} text-[11px] uppercase tracking-[0.18em]`;
/** 页标题（宋体，每屏只出现一次）。 */
export const typeDisplay =
  "text-[30px] font-bold leading-none tracking-[0.02em] max-[768px]:text-[26px]";
export const typeDisplayFamily = fontSerif;
/** 标签 / 按钮（14px）。 */
export const typeLabel = `${fontSans} text-[14px] font-normal`;
/** 标签 / 按钮（14px semibold）。 */
export const typeLabelStrong = `${fontSans} text-[14px] font-semibold`;
/** 小按钮文字（13px）。 */
export const typeButtonSm = `${fontSans} text-[13px]`;
/** 搜索词（手机 16px 防 iOS 聚焦放大）。 */
export const typeSearchQuery = `${fontSans} text-[17px] max-[768px]:text-[16px]`;
/** 竖栏项文字。 */
export const typeNavLabel = `${fontSans} text-[11.5px] tracking-[0.04em]`;
/** 底部标签栏文字。 */
export const typeNavLabelTab = `${fontSans} text-[11px] tracking-[0.04em]`;
/** 等宽数字（序号、时长、页码；tabular-nums 保证列对齐）。 */
export const typeMonoNum = `${fontMono} text-[13px] tabular-nums`;
/** 等宽小字（表头、结果计数、键位提示）。 */
export const typeMonoCaption = `${fontMono} text-[11px] tracking-[0.14em] tabular-nums`;

/** 等宽小字但无字距（键位提示 kbd，DESIGN.md mono-caption 注）。 */
export const typeKeyHint = `${fontMono} text-[11px] tabular-nums`;

// ---------------------------------------------------------------- 圆角
export const roundedXs = "rounded-[6px]";
export const roundedSm = "rounded-[8px]";
export const roundedMd = "rounded-[10px]";
export const roundedLg = "rounded-[12px]";
export const roundedXl = "rounded-[16px]";

// ---------------------------------------------------------------- 间距
/** 桌面页头 / 搜索栏 / 范围行 / 内容区左右边距。 */
export const deskGutter = "px-[36px] max-[768px]:px-[16px]";
/** 手机页头与范围行的左右边距（20px）。 */
export const deskGutterWide = "px-[36px] max-[768px]:px-[20px]";
/** 竖栏宽度。 */
export const deskRailWidth = "w-[84px]";
/** 手机端所有可点目标的最小点击区。 */
export const touchMin = "min-h-[44px] min-w-[44px]";

// ---------------------------------------------------------------- 焦点环
// 2px ink 外圈、2px 间隔；仅 :focus-visible 显示（DESIGN.md components.focus-ring）。
export const deskFocusRing =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[#1C1916] imw-dark:focus-visible:outline-[#EDE7DD]";

/** 实底蔷薇红控件上的焦点环：外圈同上，另加 2px paper 内环。 */
export const deskFocusRingOnRose = `${deskFocusRing} focus-visible:shadow-[inset_0_0_0_2px_#F5F2EC] imw-dark:focus-visible:shadow-[inset_0_0_0_2px_#141312]`;

/** 墨底（纸字）控件上的焦点环：外圈改用纸色，避免 ink 压 ink 看不见。 */
export const deskFocusRingOnInk =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[#F5F2EC] imw-dark:focus-visible:outline-[#141312]";

// ---------------------------------------------------------------- 图标
// 自包含内联 SVG（currentColor）：DESIGN.md `symbol` 的原始路径，不借用宿站 `mdi-*`。
export type DeskIconName =
  | "note"
  | "film"
  | "radio"
  | "star"
  | "starf"
  | "gear"
  | "info"
  | "search"
  | "chev"
  | "left"
  | "right"
  | "play"
  | "close"
  | "mark"
  | "list"
  | "grid";

const ICON_INNER: Record<DeskIconName, string> = {
  note: '<path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="16.5" cy="16" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  film: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>',
  radio:
    '<circle cx="12" cy="13" r="2" fill="currentColor"/><path d="M7.8 8.8a6 6 0 0 0 0 8.4M16.2 8.8a6 6 0 0 1 0 8.4M5 6a10 10 0 0 0 0 14M19 6a10 10 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  star: '<path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.6 7.2 19.1l.9-5.4-3.9-3.8 5.4-.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  starf:
    '<path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.6 7.2 19.1l.9-5.4-3.9-3.8 5.4-.8z" fill="currentColor"/>',
  gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  info: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5M12 8v.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  search:
    '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  chev: '<path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  left: '<path d="M14.5 6.5L9 12l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  right:
    '<path d="M9.5 6.5L15 12l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  close:
    '<path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  mark: '<path d="M12 4.5c2.2 1.6 3.4 3.6 3.4 5.6 0 1.9-1.5 3.4-3.4 3.4s-3.4-1.5-3.4-3.4c0-2 1.2-4 3.4-5.6zM12 13.5v6M12 17c-1.8-1.6-3.6-2-5-1.6M12 17c1.8-1.6 3.6-2 5-1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  list: '<path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  grid: '<rect x="4.5" y="4.5" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
};

/** 外壳图标：`currentColor` 着色，随宿主字号/字色走。 */
export function DeskIcon({
  name,
  size = 22,
  className = "",
}: {
  name: DeskIconName;
  size?: number;
  className?: string;
}) {
  return h("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    class: `block shrink-0 ${className}`,
    "aria-hidden": "true",
    dangerouslySetInnerHTML: { __html: ICON_INNER[name] },
  });
}
