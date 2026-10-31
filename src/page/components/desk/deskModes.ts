// 点歌台的六种模式：目录（下标 / 文案 / 合法范围）在 `settings/deskModeCatalog`，
// 设置层的「启动默认页面」与这里的导航、页标题共用同一份，不各写一套。
import {
  DESK_MODE_LIST,
  DEFAULT_DESK_MODE,
  deskModeTitle,
  normalizeDeskMode,
  type DeskModeDescriptor,
  type DeskModeId,
} from "../../../settings/deskModeCatalog";

/** 按 id 取下标：目录是唯一真相，这里不重复写数字。 */
function modeIndexOf(id: DeskModeId): number {
  const mode = DESK_MODE_LIST.find((item) => item.id === id);
  return mode ? mode.index : DEFAULT_DESK_MODE;
}

export const MODE = {
  music: modeIndexOf("music"),
  video: modeIndexOf("video"),
  radio: modeIndexOf("radio"),
  favorites: modeIndexOf("favorites"),
  settings: modeIndexOf("settings"),
  about: modeIndexOf("about"),
} as const;

export type DeskMode = number;

export type DeskModeInfo = DeskModeDescriptor;

export const DESK_MODES: readonly DeskModeInfo[] = DESK_MODE_LIST;

/** 桌面竖栏：四个内容模式在弹性空白之上，设置与关于在下方。 */
export const RAIL_MODES = DESK_MODES.slice(0, 4);
export const RAIL_FOOTER_MODES = DESK_MODES.slice(4);

/** 手机底部标签栏：五项，关于并入设置。 */
export const TAB_MODES = DESK_MODES.filter((mode) => mode.id !== "about");

/** 非法下标（手改 localStorage、旧版本残留）一律回退音乐模式。 */
export function normalizeMode(raw: unknown): number {
  return normalizeDeskMode(raw);
}

export function modeInfo(index: unknown): DeskModeInfo {
  return DESK_MODES[normalizeMode(index)];
}

/** 页标题：音乐是「点歌台」，其余为模式名。 */
export function modeTitle(index: unknown): string {
  return deskModeTitle(index);
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

/** 有分页的模式：设置与关于不分页；电台按 EXPERIENCE（地区列表）不分页。 */
export function hasPager(index: unknown): boolean {
  const mode = normalizeMode(index);
  return mode !== MODE.radio && hasSearchBar(mode);
}
