// 结果区的展示派生：时长、曲目数、来源、条目形态，全部是纯函数。
// 组件只负责排版，不在 JSX 里做条件推导（便于单测与跨组件复用）。

/** 秒 → `mm:ss`；缺值/非法值返回空串（不渲染空胶囊）。 */
export function formatDuration(seconds?: number): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0)
    return "";
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** 曲目数 → 「24 首」；缺值返回空串。 */
export function trackCountLabel(count?: string | number | null): string {
  if (count === null || count === undefined) return "";
  const text = String(count).trim().replace(/首$/, "");
  if (!text) return "";
  return `${text} 首`;
}

export type DeskSourceKeyOfItem = "netease" | "bilibili" | "radio" | null;

export interface SourceInfo {
  /** 来源圆点令牌的键；无来源（如多源剧集）为 null，不画圆点。 */
  key: DeskSourceKeyOfItem;
  /** 出处列的简称（圆点旁边总有文字，圆点不单独承载信息）。 */
  label: string;
}

/** 条目的来源：平台圆点 + 简称（收藏/音乐曲目表的出处列）。 */
export function sourceOf(platformData: PlatformData): SourceInfo {
  if (platformData.radio?.isradio) return { key: "radio", label: "电台" };
  if (platformData.bilibili || platformData.bilibiliLive)
    return { key: "bilibili", label: "B站" };
  if (platformData.neteaseMusic || platformData.websiteUrl?.includes("163.com"))
    return { key: "netease", label: "网易云" };
  return { key: null, label: platformData.subtitle ?? "" };
}

/** 直播条目：时长胶囊换成「直播」徽章。 */
export function isLiveItem(platformData: PlatformData): boolean {
  return !!platformData.bilibiliLive;
}

/** 专辑 / 歌单条目：行末为进入箭头，整行进入内页。 */
export function isCollectionItem(platformData: PlatformData): boolean {
  return !!(
    platformData.neteaseMusic?.isSongList || platformData.neteaseMusic?.isAlbum
  );
}

/** 视频形态条目（16:9 缩略图）：B 站视频/直播、网易云 MV、多源剧集。 */
export function isVideoItem(platformData: PlatformData): boolean {
  return !!(
    platformData.bilibili ||
    platformData.bilibiliLive ||
    platformData.neteaseMusic?.isMV ||
    (platformData.playList?.length ?? 0) > 0
  );
}

/**
 * 多 P / 多集条目：手机操作条据此显示「选集」（story 5 起由插件自有面板接手）。
 * 桌面卡片的「选集」入口只在面板服务不了的课程卡上保留，见 `VideoTile`。
 */
export async function hasMultiPage(
  platformData: PlatformData,
): Promise<boolean> {
  if (!platformData.multiPage) return false;
  try {
    const multipage = await platformData.multiPage;
    return !!multipage?.platform;
  } catch {
    return false;
  }
}

/** 手机布局（宿站 iframe 缩放后仍按 `max-[768px]` 判定，与 CSS 断点一致）。 */
export function isPhoneLayout(): boolean {
  return window.matchMedia?.("(max-width: 768px)").matches ?? false;
}

/**
 * 无悬停宽屏（>768px 且 `(hover: none)`，如 iPad 横屏）：
 * 卡片改为「第一次点按选中显示按钮，再点按钮点播」。jsdom 无 matchMedia 时按有悬停处理。
 */
export function isTapToReveal(): boolean {
  return (
    !!window.matchMedia?.("(hover: none)").matches &&
    !window.matchMedia?.("(max-width: 768px)").matches
  );
}
