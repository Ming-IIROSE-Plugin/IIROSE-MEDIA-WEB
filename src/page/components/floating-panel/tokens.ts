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
// 数字：系统界面字体 + 表格数字（等宽对齐，字形正常）。等宽栈在 Windows 上会落到
// Consolas / 宋体一类，小字号又细又散、冒号两侧发空（用户反馈时长不好看）。
const fontNum =
  "font-[-apple-system,BlinkMacSystemFont,'Segoe_UI','Helvetica_Neue',Arial,'PingFang_SC','Microsoft_YaHei',sans-serif]";

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
/** 三级图形的实底（开关关态的圆钮，ink3）。 */
export const deskInk3Fill = "bg-[#6B655D] imw-dark:bg-[#8F887E]";
/** 三级图形的描边（开关关态的轨道，ink3）。 */
export const deskInk3Border = "border-[#6B655D] imw-dark:border-[#8F887E]";

/** 蔷薇红文字 / 细线 / 指示条（rose）。 */
export const deskRose = "text-[#B42F3E] imw-dark:text-[#E3606C]";
/** 蔷薇红图形：竖栏指示条、标签栏选中图标（rose）。 */
export const deskRoseFill = "bg-[#B42F3E] imw-dark:bg-[#E3606C]";
/** 蔷薇红实底控件的描边：与实底同值（浅 rose、深 rose-fill-dark），见 DESIGN 实底控件。 */
export const deskRoseSolidBorder = "border-[#B42F3E] imw-dark:border-[#BA4F59]";
/** 搜索框聚焦时的蔷薇红描边（rose，`focus-within:` 版）。 */
export const deskRoseBorderFocus =
  "focus-within:border-[#B42F3E] imw-dark:focus-within:border-[#E3606C]";
/** 原生 range 滑块的强调色（rose）。 */
export const deskAccent = "accent-[#B42F3E] imw-dark:accent-[#E3606C]";
/** 承载白字的蔷薇红实底（浅色 rose / 深色 rose-fill-dark）。 */
export const deskRoseSolid = "bg-[#B42F3E] imw-dark:bg-[#BA4F59]";
/** 蔷薇红实底上的字色（on-rose）。 */
export const deskOnRose = "text-[#FFFFFF]";

/** 已收藏星标（star-on；浅色压暗到达标）。 */
export const deskStarOn = "text-[#A17822] imw-dark:text-[#C9962B]";

/** on-rose 实色（时长胶囊上的音柱等白图形）。 */
export const deskOnRoseFill = "bg-[#FFFFFF]";

/** 骨架条 / 骨架块（skeleton，与 thumb 同值）。 */
export const deskSkeleton = "bg-[#E6E0D6] imw-dark:bg-[#262320]";

/** 封面 / 缩略图内环（cover-ring）：防止浅色封面与纸色融在一起。 */
export const deskCoverRing =
  "shadow-[inset_0_0_0_1px_#0000000F] imw-dark:shadow-[inset_0_0_0_1px_#FFFFFF0A]";

/** 视频时长胶囊底（duration-pill），字色取 on-rose；不随主题变化。 */
export const deskDurationPill = "bg-[#0C0B0AB8] imw-dark:bg-[#0C0B0AB8]";

/** 视频悬停遮罩（video-scrim）；不随主题变化。 */
export const deskVideoScrim = "bg-[#0A090861] imw-dark:bg-[#0A090861]";

// ---------------------------------------------------------------- 底部条
// room-deck / mini-deck / room-deck-expanded：与面板同色系的贴底细栏，
// sheet 底 + 顶边一条 rule 细线，不再是反相的深色悬浮卡（用户反馈「又粗又大、压迫」）。
/** 底部条 / 迷你条 / 展开层的底色（sheet）。 */
export const deskDeckSurface = "bg-[#FBFAF7] imw-dark:bg-[#1C1A18]";
/** 底部条上的主文字（ink）。 */
export const deskDeckText = "text-[#1C1916] imw-dark:text-[#EDE7DD]";
/** 底部条顶边细线（rule），用阴影画，不占布局。 */
export const deskDeckRing =
  "shadow-[0_-1px_0_#E2DCD1] imw-dark:shadow-[0_-1px_0_#2B2825]";
/** 进度填充（rose）。 */
export const deskDeckProgress = "bg-[#B42F3E] imw-dark:bg-[#E3606C]";
/** 进度轨（rule）。 */
export const deskDeckTrack = "bg-[#E2DCD1] imw-dark:bg-[#2B2825]";
/** 模式开关常态描边（rule）。 */
export const deskDeckToggleBorder =
  "border-[#E2DCD1] imw-dark:border-[#2B2825]";
/** 进度拖柄的 3px 外环（deck-thumb-ring）。 */
export const deskDeckThumbRing =
  "shadow-[0_0_0_3px_#BC445159] imw-dark:shadow-[0_0_0_3px_#E3606C59]";

/** 正在播放 / 已选中：缩略图外 2px ink 描边（与焦点环同色）。 */
export const deskSelectedRing =
  "shadow-[0_0_0_2px_#1C1916] imw-dark:shadow-[0_0_0_2px_#EDE7DD]";

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

/**
 * 曲目行悬停（`hov:` 门控后整体换底，外扩与底线隐去由行组件补）：
 * 悬停底 + 行圆角 + 底线让位（DESIGN.md `tracklist-row-hover`）。
 */
export const deskRowHover =
  "hov:hover:bg-[#EFEBE3] hov:hover:rounded-[12px] hov:hover:border-transparent imw-dark:hov:hover:bg-[#201E1C]";

/**
 * 点播胶囊的悬停实心态（悬停在整行/整卡上时点亮）：
 * 浅色 rose、深色 rose-fill-dark（承载白字的实底）；禁用态不拼这段类。
 */
export const deskSendHover =
  "hov:group-hover:bg-[#B42F3E] hov:group-hover:border-[#B42F3E] hov:group-hover:text-[#FFFFFF] imw-dark:hov:group-hover:bg-[#BA4F59] imw-dark:hov:group-hover:border-[#BA4F59]";

/** 搜索栏几乎不可见的抬升线（DESIGN.md Elevation & Depth，不承载信息）。 */
export const deskSearchShadow = "shadow-[0_1px_0_#00000005]";
/** 按下反馈：缩到 96% 松开回弹（时长取 app.css 动效基线的「快」档；减少动态效果时不缩放）。 */
export const deskPress = "active:scale-[.96]";
/** 下拉菜单浮层投影（来源菜单）：浅色柔和，深色加深一档才看得出层次。 */
export const deskMenuShadow =
  "shadow-[0_10px_30px_#1C19161F] imw-dark:shadow-[0_10px_30px_#00000080]";
/** 面板提示条：浮在结果区上方的柔和投影。 */
export const deskToastShadow = "shadow-[0_6px_20px_#0000002E]";

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
/** 数字（序号、时长、页码；tabular-nums 每位等宽，列对齐）。 */
export const typeMonoNum = `${fontNum} text-[13px] tabular-nums`;
/** 数字小字（手机时长、进度时间）。 */
export const typeMonoNumSm = `${fontNum} text-[12px] tabular-nums`;
/** 胶囊字（视频时长胶囊、「直播」徽章）。 */
export const typeMonoPill = `${fontNum} text-[11.5px] font-medium tabular-nums`;
/** 小字（表头、结果计数）。 */
export const typeMonoCaption = `${fontNum} text-[11px] tracking-[0.08em] tabular-nums`;

/** 曲目行标题（15px medium）。 */
export const typeRowTitle = `${fontSans} text-[15px] font-medium`;
/** 曲目行歌手行（12.5px）。 */
export const typeRowMeta = `${fontSans} text-[12.5px]`;
/** 曲目表出处列（13px）。 */
export const typeRowMetaSource = `${fontSans} text-[13px]`;
/** 视频卡标题（桌面 14 / 手机 13，最多两行）。 */
export const typeVideoTitle = `${fontSans} text-[14px] font-medium leading-[1.45] max-[768px]:text-[13px]`;
/** 视频卡副行（桌面 12 / 手机 11）。 */
export const typeVideoMeta = `${fontSans} text-[12px] max-[768px]:text-[11px]`;

/** 等宽小字但无字距（键位提示 kbd，DESIGN.md mono-caption 注）。 */
export const typeKeyHint = `${fontMono} text-[11px] tabular-nums`;

/** 底部条标签（等宽大写，0.2em 字距；55% 不透明度由使用处补）。 */
export const typeDeckLabel = `${fontMono} text-[10px] uppercase tracking-[0.2em]`;
/** 底部条标题（15px semibold）。 */
export const typeDeckTitle = `${fontSans} text-[15px] font-semibold`;
/** 迷你条标题（14px semibold）。 */
export const typeDeckTitleMini = `${fontSans} text-[14px] font-semibold`;

// ---------------------------------------------------------------- 圆角
export const roundedXs = "rounded-[6px]";
export const roundedSm = "rounded-[8px]";
export const roundedMd = "rounded-[10px]";
export const roundedLg = "rounded-[12px]";
export const roundedXl = "rounded-[16px]";

/** 曲目表封面：桌面 xs、手机 sm（DESIGN.md `tracklist-row` / `tracklist-row-phone`）。 */
export const roundedTrackCover = `${roundedXs} max-[768px]:rounded-[8px]`;

/** 点播钮：桌面描边胶囊（满宽 96px 列）、手机 40px 圆角方钮。 */
export const roundedRequestButton = "rounded-full max-[768px]:rounded-[12px]";

// ---------------------------------------------------------------- 间距
/** 桌面页头 / 搜索栏 / 范围行 / 内容区左右边距。 */
export const deskGutter = "px-[36px] max-[768px]:px-[16px]";
/** 手机页头与范围行的左右边距（20px）。 */
export const deskGutterWide = "px-[36px] max-[768px]:px-[20px]";
/** 竖栏宽度。 */
export const deskRailWidth = "w-[84px]";
/** 手机端所有可点目标的最小点击区。 */
export const touchMin = "min-h-[44px] min-w-[44px]";

/** 文字钮（「重试」「清除搜索」「‹ 返回」）：无底色、无描边，悬停下划线。 */
export const deskTextButton = `cursor-pointer border-0 bg-transparent p-0 ${typeLabelStrong} ${deskRose} hov:hover:underline`;

// ---------------------------------------------------------------- 焦点环
// 2px ink 外圈、2px 间隔；仅 :focus-visible 显示（DESIGN.md components.focus-ring）。
export const deskFocusRing =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[#1C1916] imw-dark:focus-visible:outline-[#EDE7DD]";

/** 实底蔷薇红控件上的焦点环：外圈同上，另加 2px paper 内环。 */
export const deskFocusRingOnRose = `${deskFocusRing} focus-visible:shadow-[inset_0_0_0_2px_#F5F2EC] imw-dark:focus-visible:shadow-[inset_0_0_0_2px_#141312]`;

/** 墨底（纸字）控件上的焦点环：外圈改用纸色，避免 ink 压 ink 看不见。 */
export const deskFocusRingOnInk =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[#F5F2EC] imw-dark:focus-visible:outline-[#141312]";

/**
 * 底部条上的焦点环：浅色底部条是墨底 → 外圈改 paper；深色底部条是 sheet 底 →
 * 外圈取 focus-ring-dark（= ink-dark）。见 DESIGN.md 对比度表末两行。
 */
export const deskFocusRingOnDeck =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[#1C1916] imw-dark:focus-visible:outline-[#EDE7DD]";

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
  | "send"
  | "close"
  | "mark"
  | "list"
  | "grid"
  | "sort"
  | "shuffle"
  | "repeat"
  // 点播按钮状态（点播中 / 已点播）
  | "check"
  | "spinner"
  // 设置行 / 关于卡（DESIGN 的 symbol 表未覆盖，同风格补：描边 1.6–1.9、currentColor）
  | "user"
  | "users"
  | "clock"
  | "signal"
  | "wrench"
  | "code"
  | "layout"
  | "at"
  | "cloud"
  | "key"
  | "refresh"
  | "trash"
  | "coffee"
  | "github"
  | "external";

/**
 * 全部图标名（运行期校验用）：`SettingData.icon` 是字符串，数据层拼错时
 * `isDeskIconName` 让渲染回退到 info，测试则直接断言数据里的名字都在此集合内。
 */
export const DESK_ICON_NAMES: readonly DeskIconName[] = [
  "note",
  "film",
  "radio",
  "star",
  "starf",
  "gear",
  "info",
  "search",
  "chev",
  "left",
  "right",
  "play",
  "send",
  "close",
  "mark",
  "list",
  "grid",
  "sort",
  "shuffle",
  "repeat",
  "check",
  "spinner",
  "user",
  "users",
  "clock",
  "signal",
  "wrench",
  "code",
  "layout",
  "at",
  "cloud",
  "key",
  "refresh",
  "trash",
  "coffee",
  "github",
  "external",
];

const DESK_ICON_SET = new Set<string>(DESK_ICON_NAMES);

/** 字符串是否是合法图标名（`SettingData.icon` 不强转，拼错则回退）。 */
export function isDeskIconName(name: string): name is DeskIconName {
  return DESK_ICON_SET.has(name);
}

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
  check:
    '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  spinner:
    '<path d="M12 4a8 8 0 1 1-8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  send: '<path d="M20.4 4.2L3.9 11.1l6.3 2.6 2.6 6.3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M20.4 4.2l-10.2 9.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  close:
    '<path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  mark: '<path d="M12 4.5c2.2 1.6 3.4 3.6 3.4 5.6 0 1.9-1.5 3.4-3.4 3.4s-3.4-1.5-3.4-3.4c0-2 1.2-4 3.4-5.6zM12 13.5v6M12 17c-1.8-1.6-3.6-2-5-1.6M12 17c1.8-1.6 3.6-2 5-1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  list: '<path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  grid: '<rect x="4.5" y="4.5" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  sort: '<path d="M5 7h8M5 12h6M5 17h4M17 6v12M17 18l-2.5-2.5M17 18l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  shuffle:
    '<path d="M4 17h3.2c1.2 0 2.1-.6 2.8-1.6l4-5.8c.7-1 1.6-1.6 2.8-1.6H20M4 7h3.2c1.2 0 2.1.6 2.8 1.6l.6.9M13.6 15l.6.9c.7 1 1.6 1.6 2.8 1.6H20M18 4l2 2-2 2M18 14l2 2-2 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  repeat:
    '<path d="M5 11V9.5A2.5 2.5 0 0 1 7.5 7H18l-2.5-2.5M19 13v1.5a2.5 2.5 0 0 1-2.5 2.5H6l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 10v4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  // ---- 设置行 / 关于卡 ----
  user: '<circle cx="12" cy="8.6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.2 19.4c1.3-3.1 3.8-4.7 6.8-4.7s5.5 1.6 6.8 4.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  users:
    '<circle cx="9.4" cy="9" r="3.3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.6 19.4c1.1-2.9 3.3-4.4 5.8-4.4s4.7 1.5 5.8 4.4M15.9 6.1a3.3 3.3 0 0 1 0 6.3M17.3 15.2c1.6.6 2.7 2 3.2 4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  clock:
    '<circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.4V12l3.2 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  signal:
    '<path d="M5.5 18.2v-3.4M10.5 18.2V11M15.5 18.2V8.2M20.5 18.2V5.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  wrench:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  code: '<path d="M16.5 18L21 12l-4.5-6M7.5 6L3 12l4.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  layout:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9.5h17" stroke="currentColor" stroke-width="1.7"/>',
  at: '<circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M15.5 8.5v5.2a2.3 2.3 0 0 0 4.6 0V12a8.1 8.1 0 1 0-3.3 6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  cloud:
    '<path d="M17.4 19H7.9a4.4 4.4 0 0 1-.4-8.8 6 6 0 0 1 11.3 1.5 3.7 3.7 0 0 1-1.4 7.3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  key: '<circle cx="8.4" cy="15.6" r="3.1" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.6 13.4L19 5M16.6 7.4l2 2M14.3 9.7l2 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  refresh:
    '<path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M19.6 4.6v5.2h-5.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  trash:
    '<path d="M4.6 7h14.8M9.6 7V4.8h4.8V7M6.6 7l.9 12.1a1.7 1.7 0 0 0 1.7 1.6h5.6a1.7 1.7 0 0 0 1.7-1.6L17.4 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  coffee:
    '<path d="M5 8.2h10.6v6.3a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M15.6 9.6h1.7a2.4 2.4 0 0 1 0 4.8h-1.7M4.4 21.2h12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  github:
    '<path d="M9 19.2c-4.6 1.4-4.6-2.4-6.4-2.9m12.8 5.7v-3.5a3.1 3.1 0 0 0-.9-2.4c2.9-.3 5.9-1.4 5.9-6.4a5 5 0 0 0-1.4-3.5 4.6 4.6 0 0 0-.1-3.4s-1.1-.3-3.6 1.3a12.3 12.3 0 0 0-6.4 0C6.4 2.1 5.3 2.4 5.3 2.4a4.6 4.6 0 0 0-.1 3.4A5 5 0 0 0 3.8 9.3c0 5 3 6.1 5.9 6.4a3.1 3.1 0 0 0-.9 2.4v3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  external:
    '<path d="M13.8 4.6H19.4v5.6M19.4 4.6l-7 7M16.8 13.8v4.5a1.9 1.9 0 0 1-1.9 1.9H5.9A1.9 1.9 0 0 1 4 18.3V8.3a1.9 1.9 0 0 1 1.9-1.9h4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
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
