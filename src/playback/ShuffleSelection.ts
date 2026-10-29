// 收藏随机的「选择范围」：选了哪些收藏（整条或歌单里的几首）与权重模式。
// 只存本机，按账号与平台分键；面板（story 6）写入，控制器每次抽取前读取。
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import { getCurrentOwnerUid } from "../storage/favorites/recordUtils";

export type ShufflePlatform = "netease" | "bilibili";

/** 有收藏功能、可作随机平台的全部平台（面板标签顺序）。 */
export const SHUFFLE_PLATFORMS: readonly ShufflePlatform[] = [
  "netease",
  "bilibili",
];

/** entry：每个选中条目机会相同；song：每首被选中的歌机会相同。 */
export type ShuffleWeight = "entry" | "song";

export interface ShuffleSelectionItem {
  /** 收藏逻辑主键（`platform:type:rawId`）。 */
  id: string;
  /** 部分勾选的曲目原始 id；缺省 = 整条（歌单为动态范围）。 */
  tracks?: string[];
}

export interface ShuffleSelection {
  weight: ShuffleWeight;
  items: ShuffleSelectionItem[];
}

/** 解析后的一条候选：tracks 为 null 表示整条。 */
export interface ShuffleEntry {
  record: FavoriteRecord;
  tracks: string[] | null;
  /** 按歌曲计的份数上限：单曲 1，整单 trackCount，部分 = 勾选数。 */
  size: number;
}

/** 一轮内的已播记录：歌曲身份、各条目已播数、本轮已耗尽的条目。 */
export interface ShuffleRound {
  played: Set<string>;
  fromEntry: Map<string, number>;
  exhausted: Set<string>;
}

const STORAGE_PREFIX = "imwShuffleSelection";
const PLATFORM_PREFIX = "imwShufflePlatform";
const VERSION = 1;

export function createShuffleRound(): ShuffleRound {
  return { played: new Set(), fromEntry: new Map(), exhausted: new Set() };
}

/** 歌曲身份与收藏逻辑主键同格式：单曲收藏与歌单里的同一首共用一个身份。 */
export function songKey(platform: ShufflePlatform, rawId: string): string {
  return `${platform}:${platform === "bilibili" ? "video" : "song"}:${rawId}`;
}

export function isSingle(record: FavoriteRecord): boolean {
  return record.type === "song" || record.type === "video";
}

/** 某平台选择的存储键（当前账号）；保存失败回滚时用来快照旧值。 */
export function shuffleSelectionKey(platform: ShufflePlatform): string {
  return `${STORAGE_PREFIX}:${getCurrentOwnerUid()}:${platform}`;
}
const storageKey = shuffleSelectionKey;

/** 随机平台的存储键（当前账号）。 */
export function shufflePlatformKey(): string {
  return `${PLATFORM_PREFIX}:${getCurrentOwnerUid()}`;
}

function parseItems(value: unknown): ShuffleSelectionItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: ShuffleSelectionItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const { id, tracks } = raw as { id?: unknown; tracks?: unknown };
    if (typeof id !== "string" || !id) return null;
    if (tracks === undefined) {
      items.push({ id });
      continue;
    }
    if (!Array.isArray(tracks) || tracks.some((t) => typeof t !== "string"))
      return null;
    items.push({ id, tracks: [...new Set(tracks as string[])] });
  }
  return items;
}

/** 读本机选择；没有、损坏或版本不符一律返回 null（= 全部收藏、按条目）。 */
export function loadShuffleSelection(
  platform: ShufflePlatform,
): ShuffleSelection | null {
  try {
    const raw = localStorage.getItem(storageKey(platform));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      weight?: unknown;
      items?: unknown;
    };
    if (!parsed || parsed.version !== VERSION) return null;
    if (parsed.weight !== "entry" && parsed.weight !== "song") return null;
    const items = parseItems(parsed.items);
    return items ? { weight: parsed.weight, items } : null;
  } catch {
    return null;
  }
}

export function saveShuffleSelection(
  platform: ShufflePlatform,
  selection: ShuffleSelection,
): void {
  localStorage.setItem(
    storageKey(platform),
    JSON.stringify({ version: VERSION, ...selection }),
  );
}

function isShufflePlatform(value: unknown): value is ShufflePlatform {
  return SHUFFLE_PLATFORMS.includes(value as ShufflePlatform);
}

/**
 * 设置「插件启动默认页面」对应的随机平台：0 音乐→网易云，1 视频→B站。
 * 2 电台 / 3 收藏 / 4 设置 / 5 关于 都没有单一收藏平台，一律回退网易云。
 */
export function defaultShufflePlatform(defaultPage: unknown): ShufflePlatform {
  return defaultPage === 1 ? "bilibili" : "netease";
}

/** 本机上次确认的随机平台；没有或数据非法返回 null。 */
export function loadShufflePlatform(): ShufflePlatform | null {
  try {
    const raw = localStorage.getItem(shufflePlatformKey());
    return isShufflePlatform(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveShufflePlatform(platform: ShufflePlatform): void {
  localStorage.setItem(shufflePlatformKey(), platform);
}

/** 随机平台：已存记录优先，否则按 defaultPage 规则。与主插件面板焦点无关。 */
export function resolveShufflePlatform(defaultPage: unknown): ShufflePlatform {
  return loadShufflePlatform() ?? defaultShufflePlatform(defaultPage);
}

export interface PickerPlatforms {
  /** 面板显示的平台标签（`SHUFFLE_PLATFORMS` 顺序，至少一个）。 */
  platforms: ShufflePlatform[];
  /** 打开时停在的标签（必在 platforms 内）。 */
  initial: ShufflePlatform;
}

/**
 * 选择面板的可见平台与初始标签（CAP-12）。
 * 可见 = 有收藏的平台 ∪ 已存随机平台（∪ 调用方指定的平台）；全空时只剩默认平台。
 * 初始 = 指定平台 → 已存随机平台 → 默认平台（须可见）→ 可见集第一个。
 */
export function resolvePickerPlatforms(
  hasFavorites: Partial<Record<ShufflePlatform, boolean>>,
  {
    stored,
    fallback,
    forced,
  }: {
    stored: ShufflePlatform | null;
    fallback: ShufflePlatform;
    forced?: ShufflePlatform;
  },
): PickerPlatforms {
  const platforms = SHUFFLE_PLATFORMS.filter(
    (platform) =>
      hasFavorites[platform] || platform === stored || platform === forced,
  );
  if (platforms.length === 0) platforms.push(fallback);
  const initial =
    forced ??
    stored ??
    (platforms.includes(fallback) ? fallback : platforms[0]);
  return { platforms, initial };
}

function trackCountOf(record: FavoriteRecord): number {
  const count = Number.parseInt(record.trackCount ?? "", 10);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

/** 与当前收藏对齐：已删除的收藏丢弃，部分勾选为空的丢弃。 */
export function resolveShuffleSelection(
  selection: ShuffleSelection | null,
  records: FavoriteRecord[],
): { weight: ShuffleWeight; entries: ShuffleEntry[] } {
  const whole = (record: FavoriteRecord): ShuffleEntry => ({
    record,
    tracks: null,
    size: isSingle(record) ? 1 : trackCountOf(record),
  });
  if (!selection) return { weight: "entry", entries: records.map(whole) };
  const byId = new Map(records.map((record) => [record.id, record]));
  const entries: ShuffleEntry[] = [];
  for (const item of selection.items) {
    const record = byId.get(item.id);
    if (!record) continue;
    // 单曲/视频没有「部分」：带了 tracks 也按整条处理。
    if (!item.tracks || isSingle(record)) {
      entries.push(whole(record));
      continue;
    }
    if (item.tracks.length === 0) continue;
    entries.push({ record, tracks: item.tracks, size: item.tracks.length });
  }
  return { weight: selection.weight, entries };
}

/** 本轮剩余份数；0 表示本轮不再抽它。 */
export function remainingShare(
  entry: ShuffleEntry,
  weight: ShuffleWeight,
  round: ShuffleRound,
): number {
  const { record } = entry;
  if (round.exhausted.has(record.id)) return 0;
  let left: number;
  if (isSingle(record)) left = round.played.has(record.id) ? 0 : 1;
  else if (entry.tracks)
    left = entry.tracks.filter(
      (id) => !round.played.has(songKey(record.platform, id)),
    ).length;
  else left = Math.max(0, entry.size - (round.fromEntry.get(record.id) ?? 0));
  if (left === 0) return 0;
  return weight === "song" ? left : 1;
}

/** 按剩余份数加权抽一条；skip 用于排除当前正在播的单曲。 */
export function pickShuffleEntry(
  entries: ShuffleEntry[],
  weight: ShuffleWeight,
  round: ShuffleRound,
  skip: (entry: ShuffleEntry) => boolean = () => false,
  random: () => number = Math.random,
): ShuffleEntry | null {
  const shares = entries.map((entry) =>
    skip(entry) ? 0 : remainingShare(entry, weight, round),
  );
  const total = shares.reduce((sum, share) => sum + share, 0);
  if (total <= 0) return null;
  let target = random() * total;
  for (let index = 0; index < entries.length; index++) {
    if (shares[index] <= 0) continue;
    target -= shares[index];
    if (target < 0) return entries[index];
  }
  // 浮点边界：落到最后一个有份数的条目。
  for (let index = entries.length - 1; index >= 0; index--)
    if (shares[index] > 0) return entries[index];
  return null;
}
