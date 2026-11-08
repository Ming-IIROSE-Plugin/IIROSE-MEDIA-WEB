// 结果区的共享契约与形态派生：模式 + 范围 + 视图 + 内页 → 形态。
// 渲染分别落在 ResultsRows（列表）/ ResultsTiles（网格）/ ResultsPlaceholder（状态），
// ResultsArea 只保留 Promise 状态机与滚动、点播接线。
import { MODE } from "../desk/deskModes";

export interface ResultsPayload {
  platformData: PlatformData[];
  totalPage: number;
}

export interface ResultsSelection {
  /** 1 起的点选序号；未选为 undefined。 */
  orderOf: (position: number) => number | undefined;
  onToggle: (position: number, platformData: PlatformData) => void;
}

export type Shape =
  | "settings"
  | "tracklist"
  | "musicGrid"
  | "videoGrid"
  | "collections"
  | "radio"
  | "favorites"
  | "favoritesGrid";

/** 行形态（曲目表、专辑歌单行、收藏列表、电台）；其余是网格或设置页。 */
export function isRowShape(shape: Shape): boolean {
  return (
    shape === "tracklist" ||
    shape === "collections" ||
    shape === "favorites" ||
    shape === "radio"
  );
}

export type Load =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ResultsPayload };

/** 行 / 卡的内页勾选 props；不在内页时为空对象。 */
export interface SelectionProps {
  selectionOrder?: number;
  onToggleSelect?: () => void;
}

export const musicGridClass =
  "grid grid-cols-5 gap-x-[22px] gap-y-[22px] [grid-auto-rows:max-content] max-[768px]:grid-cols-3 max-[768px]:gap-x-3 max-[768px]:gap-y-4";
export const videoGridClass =
  "grid grid-cols-4 gap-x-[22px] gap-y-[26px] [grid-auto-rows:max-content] max-[768px]:grid-cols-2 max-[768px]:gap-x-3 max-[768px]:gap-y-[18px]";
/** 设置 / 关于：纸色底上的卡列（卡宽随内容区收敛，卡间 24px，DESIGN.md `settings-group.note`）。 */
export const settingsPageClass =
  "flex max-w-[760px] flex-col gap-6 pb-4 pt-6 max-[768px]:pb-6";

/** 形态由「模式 + 范围 + 视图 + 内页」派生，不新增 prop 爆炸。 */
/** 电台流几乎瞬间发出：「点播中」至少停留 1 秒，看得见过渡。 */
export const RADIO_MIN_PENDING_MS = 1_000;

export function shapeOf(options: {
  mode: number;
  scopeIndex: number;
  viewMode: "card" | "list";
  isInnerPage: boolean;
}): Shape {
  const { mode, scopeIndex, viewMode, isInnerPage } = options;
  // 内页（专辑 / 歌单曲目、多 P）同样跟着视图切换走
  if (isInnerPage)
    return viewMode === "list"
      ? "tracklist"
      : mode === MODE.video
        ? "videoGrid"
        : "musicGrid";
  if (mode === MODE.settings || mode === MODE.about) return "settings";
  if (mode === MODE.radio) return "radio";
  if (mode === MODE.favorites)
    return viewMode === "list" ? "favorites" : "favoritesGrid";
  if (mode === MODE.video)
    return viewMode === "list" ? "tracklist" : "videoGrid";
  if (mode === MODE.music) {
    if (scopeIndex === 1 || scopeIndex === 2) return "collections";
    if (scopeIndex === 3) return "videoGrid";
    return viewMode === "list" ? "tracklist" : "musicGrid";
  }
  return "tracklist";
}

/** 空结果文案：内页 / 音乐首屏 / 收藏 / 电台各有说法。 */
export function emptyMessage(options: {
  isInnerPage: boolean;
  firstScreen: boolean;
  shape: Shape;
  trimmedKeyword: string;
}): { message: string; action?: string } {
  const { isInnerPage, firstScreen, shape, trimmedKeyword } = options;
  // 内页没有关键词可换：空列表说明这张专辑/歌单本身没有曲目。
  if (isInnerPage) return { message: "这张列表没有曲目。" };
  if (firstScreen)
    return { message: "还没有点播记录。搜索歌名或歌手，点播到房间。" };
  if (shape === "favorites" || shape === "favoritesGrid") {
    return trimmedKeyword
      ? { message: "没有匹配的收藏", action: "清除搜索" }
      : { message: "还没有收藏。在曲目旁点星标即可收藏。" };
  }
  if (shape === "radio" && trimmedKeyword)
    return { message: "没有匹配的电台", action: "清除搜索" };
  return { message: "没有找到结果。换个关键词试试。" };
}
