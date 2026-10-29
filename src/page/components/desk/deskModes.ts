// 点歌台的六种模式：下标即 `CategoriesIndex` / `PluginSettings.defaultPage` 的语义。
// 0 音乐、1 视频、2 电台、3 收藏、4 设置、5 关于（手机端「关于」并入设置标签）。
export const MODE = {
  music: 0,
  video: 1,
  radio: 2,
  favorites: 3,
  settings: 4,
  about: 5,
} as const;

export type DeskMode = number;

export interface DeskModeInfo {
  index: number;
  id: "music" | "video" | "radio" | "favorites" | "settings" | "about";
  /** 导航项文字。 */
  label: string;
  /** 页标题（音乐页为「点歌台」）。 */
  title: string;
}

export const DESK_MODES: readonly DeskModeInfo[] = [
  { index: MODE.music, id: "music", label: "音乐", title: "点歌台" },
  { index: MODE.video, id: "video", label: "视频", title: "视频" },
  { index: MODE.radio, id: "radio", label: "电台", title: "电台" },
  { index: MODE.favorites, id: "favorites", label: "收藏", title: "收藏" },
  { index: MODE.settings, id: "settings", label: "设置", title: "设置" },
  { index: MODE.about, id: "about", label: "关于", title: "关于" },
];

/** 桌面竖栏：四个内容模式在弹性空白之上，设置与关于在下方。 */
export const RAIL_MODES = DESK_MODES.slice(0, 4);
export const RAIL_FOOTER_MODES = DESK_MODES.slice(4);

/** 手机底部标签栏：五项，关于并入设置。 */
export const TAB_MODES = DESK_MODES.filter((mode) => mode.id !== "about");

/** 非法下标（手改 localStorage、旧版本残留）一律回退音乐模式。 */
export function normalizeMode(raw: unknown): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value < DESK_MODES.length
    ? value
    : MODE.music;
}

export function modeInfo(index: unknown): DeskModeInfo {
  return DESK_MODES[normalizeMode(index)];
}

/** 页标题：音乐是「点歌台」，其余为模式名。 */
export function modeTitle(index: unknown): string {
  return modeInfo(index).title;
}

/** 有搜索栏的模式：设置与关于没有搜索作用（EXPERIENCE 各模式的来源、范围与内容）。 */
export function hasSearchBar(index: unknown): boolean {
  const mode = normalizeMode(index);
  return mode !== MODE.settings && mode !== MODE.about;
}

/** 有范围行的模式：关于页没有范围。 */
export function hasScopeRow(index: unknown): boolean {
  return normalizeMode(index) !== MODE.about;
}

/** 有分页的模式：设置与关于不分页。 */
export function hasPager(index: unknown): boolean {
  return hasSearchBar(index);
}
