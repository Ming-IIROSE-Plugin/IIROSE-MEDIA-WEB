// 随机选择面板的纯状态：组件只负责渲染，勾选规则、搜索过滤、摘要与导出都在这里。
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import {
  isSingle,
  type ShuffleSelection,
  type ShuffleWeight,
} from "../../../playback/ShuffleSelection";

export type RowCheck = "all" | "partial" | "none";

/** 一条收藏的勾选：all = 整条（歌单为动态范围），partial = 固定曲目集合。 */
export interface RowSelection {
  check: RowCheck;
  /** 仅 partial 有意义：勾选的曲目原始 id。 */
  tracks: string[];
}

export interface PickerState {
  weight: ShuffleWeight;
  rows: Record<string, RowSelection>;
}

/** 展开后加载到的歌单/专辑曲目。 */
export interface PickerTrack {
  id: string;
  name: string;
  artist: string;
}

/** 已加载的曲目：按收藏 id；没加载（或加载失败）的不在表里。 */
export type LoadedTracks = Map<string, PickerTrack[]>;

const NONE: RowSelection = { check: "none", tracks: [] };
const ALL: RowSelection = { check: "all", tracks: [] };

/** 无记录 = 全部整条、按条目；记录里没有的收藏（后来新增）为未勾选。 */
export function initialPickerState(
  records: FavoriteRecord[],
  saved: ShuffleSelection | null,
): PickerState {
  const rows: Record<string, RowSelection> = {};
  if (!saved) {
    for (const record of records) rows[record.id] = ALL;
    return { weight: "entry", rows };
  }
  const items = new Map(saved.items.map((item) => [item.id, item]));
  for (const record of records) {
    const item = items.get(record.id);
    if (!item) rows[record.id] = NONE;
    else if (!item.tracks || isSingle(record)) rows[record.id] = ALL;
    else if (item.tracks.length === 0) rows[record.id] = NONE;
    else rows[record.id] = { check: "partial", tracks: [...item.tracks] };
  }
  return { weight: saved.weight, rows };
}

export function rowOf(state: PickerState, id: string): RowSelection {
  return state.rows[id] ?? NONE;
}

/** 部分勾选的曲目：已加载时只计仍在歌单里的。 */
function partialTracks(
  row: RowSelection,
  loaded: PickerTrack[] | undefined,
): string[] {
  if (!loaded) return row.tracks;
  const present = new Set(loaded.map((track) => track.id));
  return row.tracks.filter((id) => present.has(id));
}

/** 部分勾选数（「已选 k」）：已加载时只计仍在歌单里的。 */
export function pickedCount(
  row: RowSelection,
  loaded: PickerTrack[] | undefined,
): number {
  return row.check === "partial" ? partialTracks(row, loaded).length : 0;
}

/** 曲目集合归一：勾满全部已加载曲目即整条，一首不剩即未勾。 */
function normalize(
  tracks: string[],
  loaded: PickerTrack[] | undefined,
): RowSelection {
  const unique = [...new Set(tracks)];
  if (unique.length === 0) return NONE;
  if (loaded && loaded.length > 0) {
    const picked = new Set(unique);
    if (loaded.every((track) => picked.has(track.id))) return ALL;
  }
  return { check: "partial", tracks: unique };
}

function withRow(
  state: PickerState,
  id: string,
  row: RowSelection,
): PickerState {
  return { ...state, rows: { ...state.rows, [id]: row } };
}

/**
 * 曲目加载完成后按实际曲目归一：空歌单/专辑一律未勾（无可播内容）；部分勾选的
 * 曲目一首都不在了也转未勾，避免显示「部分」而摘要按未选计。
 */
export function applyLoadedTracks(
  state: PickerState,
  id: string,
  loaded: PickerTrack[],
): PickerState {
  const row = rowOf(state, id);
  if (row.check === "none") return state;
  if (loaded.length === 0) return withRow(state, id, NONE);
  if (row.check === "partial" && partialTracks(row, loaded).length === 0)
    return withRow(state, id, NONE);
  return state;
}

/** 点行/三态框：全勾 ↔ 未勾；部分态点一下变全勾。 */
export function toggleRow(state: PickerState, id: string): PickerState {
  return withRow(state, id, rowOf(state, id).check === "all" ? NONE : ALL);
}

/** 单首曲目是否勾选（整条 = 全部勾选）。 */
export function isTrackChecked(
  state: PickerState,
  id: string,
  trackId: string,
): boolean {
  const row = rowOf(state, id);
  if (row.check === "all") return true;
  return row.check === "partial" && row.tracks.includes(trackId);
}

/** 展开后逐首切换；结果按已加载曲目归一（勾满即整条）。 */
export function toggleTrack(
  state: PickerState,
  id: string,
  trackId: string,
  loaded: PickerTrack[],
): PickerState {
  return setTracks(
    state,
    id,
    [trackId],
    !isTrackChecked(state, id, trackId),
    loaded,
  );
}

function setTracks(
  state: PickerState,
  id: string,
  trackIds: string[],
  checked: boolean,
  loaded: PickerTrack[],
): PickerState {
  const row = rowOf(state, id);
  const current =
    row.check === "all"
      ? loaded.map((track) => track.id)
      : row.check === "partial"
        ? partialTracks(row, loaded)
        : [];
  const changing = new Set(trackIds);
  const next = checked
    ? [...current, ...trackIds]
    : current.filter((track) => !changing.has(track));
  return withRow(state, id, normalize(next, loaded));
}

/** 搜索结果里的一行：tracks 为已加载且可见的曲目；self 表示收藏本身命中。 */
export interface VisibleRow {
  record: FavoriteRecord;
  /** 收藏本身命中（或无搜索词）。 */
  self: boolean;
  /** 已加载时可见的曲目；未加载为 null。 */
  tracks: PickerTrack[] | null;
}

function includes(value: string | undefined, query: string): boolean {
  return (value ?? "").toLowerCase().includes(query);
}

/**
 * 不区分大小写匹配标题与作者；已展开且已加载的歌单同时过滤曲目，歌单本身不命中但有
 * 曲目命中时保留该行。收起的歌单只按标题/作者匹配（会话缓存里的曲目不参与），
 * 未加载的歌单不会因搜索去拉详情。
 */
export function filterRows(
  records: FavoriteRecord[],
  query: string,
  loaded: LoadedTracks,
  expanded: ReadonlySet<string>,
): VisibleRow[] {
  const needle = query.trim().toLowerCase();
  const rows: VisibleRow[] = [];
  for (const record of records) {
    const tracks = expanded.has(record.id)
      ? (loaded.get(record.id) ?? null)
      : null;
    if (!needle) {
      rows.push({ record, self: true, tracks });
      continue;
    }
    const self =
      includes(record.title, needle) || includes(record.author, needle);
    const hits = tracks
      ? tracks.filter(
          (track) =>
            includes(track.name, needle) || includes(track.artist, needle),
        )
      : null;
    if (self) rows.push({ record, self, tracks: hits?.length ? hits : tracks });
    else if (hits?.length) rows.push({ record, self, tracks: hits });
  }
  return rows;
}

/** 全选 / 全不选：只作用于可见行；只因曲目命中而可见的歌单只改可见曲目。 */
export function setVisible(
  state: PickerState,
  visible: VisibleRow[],
  checked: boolean,
  loaded: LoadedTracks,
  disabled: (id: string) => boolean = () => false,
): PickerState {
  let next = state;
  for (const row of visible) {
    const id = row.record.id;
    if (disabled(id)) continue;
    if (row.self || !row.tracks) next = withRow(next, id, checked ? ALL : NONE);
    else
      next = setTracks(
        next,
        id,
        row.tracks.map((track) => track.id),
        checked,
        loaded.get(id) ?? row.tracks,
      );
  }
  return next;
}

export interface PickerSummary {
  /** 选中条目数。 */
  entries: number;
  /** 估算曲目数。 */
  songs: number;
  /** 有整单缺 trackCount，曲目数只是已知部分。 */
  approximate: boolean;
}

function knownCount(
  record: FavoriteRecord,
  loaded: PickerTrack[] | undefined,
): number | null {
  const count = Number.parseInt(record.trackCount ?? "", 10);
  if (Number.isFinite(count) && count > 0) return count;
  return loaded ? loaded.length : null;
}

/** 摘要计数：含被搜索过滤掉的已勾选项。 */
export function summarize(
  state: PickerState,
  records: FavoriteRecord[],
  loaded: LoadedTracks,
): PickerSummary {
  const summary: PickerSummary = { entries: 0, songs: 0, approximate: false };
  for (const record of records) {
    const row = rowOf(state, record.id);
    if (row.check === "none") continue;
    if (row.check === "partial") {
      const count = partialTracks(row, loaded.get(record.id)).length;
      if (count === 0) continue;
      summary.entries += 1;
      summary.songs += count;
      continue;
    }
    summary.entries += 1;
    if (isSingle(record)) {
      summary.songs += 1;
      continue;
    }
    const count = knownCount(record, loaded.get(record.id));
    if (count === null) summary.approximate = true;
    else summary.songs += count;
  }
  return summary;
}

export function formatSummary(summary: PickerSummary): string {
  if (summary.entries === 0) return "未选择";
  return `已选 ${summary.entries} 条 · ${summary.approximate ? "约 " : ""}${summary.songs} 首`;
}

/** 导出持久化选择：部分勾满即整条，已不在歌单里的曲目剔除，空选择丢弃。 */
export function exportSelection(
  state: PickerState,
  records: FavoriteRecord[],
  loaded: LoadedTracks,
): ShuffleSelection {
  const items: ShuffleSelection["items"] = [];
  for (const record of records) {
    const row = rowOf(state, record.id);
    if (row.check === "none") continue;
    if (row.check === "all" || isSingle(record)) {
      items.push({ id: record.id });
      continue;
    }
    const tracks = loaded.get(record.id);
    const normalized = normalize(partialTracks(row, tracks), tracks);
    if (normalized.check === "all") items.push({ id: record.id });
    else if (normalized.check === "partial")
      items.push({ id: record.id, tracks: normalized.tracks });
  }
  return { weight: state.weight, items };
}
