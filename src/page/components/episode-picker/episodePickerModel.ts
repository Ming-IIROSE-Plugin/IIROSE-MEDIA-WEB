// 选集面板的纯逻辑：加载状态、点选顺序、全选与确认时的播放顺序。
// 不碰 DOM、不依赖视图，面板本体与入口都从这里取。
import type {
  EpisodePickEntry,
  EpisodePickOrder,
} from "../../../platforms/episodePickerPort";

export type EpisodePickStatus = "loading" | "failed" | "ready";

/**
 * 点选顺序：未选则排到末尾，已选则摘掉——其后已选项目的序号据此自动前移
 * （徽章序号就是本数组的下标 + 1）。
 */
export function toggleEpisode(
  selected: readonly string[],
  id: string,
): string[] {
  const index = selected.indexOf(id);
  if (index === -1) return [...selected, id];
  const next = [...selected];
  next.splice(index, 1);
  return next;
}

/** 「全选」按列表顺序选中全部（徽章 1…N）。 */
export function selectAllEpisodes(
  entries: readonly EpisodePickEntry[],
): string[] {
  return entries.map((entry) => entry.id);
}

/**
 * 确认时的播放顺序：默认正序 = 点选顺序；乱序为同一集合的随机置换。
 * Fisher–Yates（`sort(() => Math.random() - .5)` 的分布不均，且不是置换的严格实现）。
 */
export function resolveEpisodeOrder(
  entries: readonly EpisodePickEntry[],
  selected: readonly string[],
  order: EpisodePickOrder,
  random: () => number = Math.random,
): EpisodePickEntry[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const picked = selected
    .map((id) => byId.get(id))
    .filter((entry): entry is EpisodePickEntry => Boolean(entry));
  if (order === "asc") return picked;
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}
