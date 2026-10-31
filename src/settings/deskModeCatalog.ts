// 点歌台模式目录：下标即 `CategoriesIndex` / `PluginSettings.defaultPage` 的语义。
// 设置层（启动默认页的标签、合法范围、一次性迁移）与界面层（竖栏、底部标签栏、页标题）
// 共用这一份，避免两处各写一套后模式增删时下标与文案漂移（redesign 复盘 F4）。

export type DeskModeId =
  "music" | "video" | "radio" | "favorites" | "settings" | "about";

export interface DeskModeDescriptor {
  index: number;
  id: DeskModeId;
  /** 导航项 / 设置行文案。 */
  label: string;
  /** 页标题（音乐页为「点歌台」）。 */
  title: string;
}

export const DESK_MODE_LIST: readonly DeskModeDescriptor[] = [
  { index: 0, id: "music", label: "音乐", title: "点歌台" },
  { index: 1, id: "video", label: "视频", title: "视频" },
  { index: 2, id: "radio", label: "电台", title: "电台" },
  { index: 3, id: "favorites", label: "收藏", title: "收藏" },
  { index: 4, id: "settings", label: "设置", title: "设置" },
  { index: 5, id: "about", label: "关于", title: "关于" },
];

/** 默认页面（音乐）：非法值与一次性迁移都回退到这里。 */
export const DEFAULT_DESK_MODE = DESK_MODE_LIST[0].index;

/** 非法下标（手改 localStorage、旧版本残留）一律回退音乐模式；范围随目录长度走。 */
export function normalizeDeskMode(raw: unknown): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value < DESK_MODE_LIST.length
    ? value
    : DEFAULT_DESK_MODE;
}

/** 模式文案（设置行末的值位）：非法值取音乐的文案。 */
export function deskModeLabel(raw: unknown): string {
  return DESK_MODE_LIST[normalizeDeskMode(raw)].label;
}

/** 页标题：音乐是「点歌台」，其余为模式名。 */
export function deskModeTitle(raw: unknown): string {
  return DESK_MODE_LIST[normalizeDeskMode(raw)].title;
}
