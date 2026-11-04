// 收藏随机的对外契约：抽取目标、依赖注入与用户可见的停止原因。
// 控制器（ShuffleController）再导出这些名字，调用方路径保持不变。
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import type { MediaSnapshot } from "../media-progress/model";
import type { ShufflePlatform, ShuffleSelection } from "./ShuffleSelection";

/** 抽中的一个可播目标：标题用于回读校验，play 真正发起点播。 */
export interface ShuffleTarget {
  /** 歌曲身份（见 ShuffleSelection.songKey），用于按歌去重。 */
  key: string;
  title: string;
  play: () => void;
}

export interface ShufflePrepareOptions {
  /** 部分勾选的曲目原始 id；null = 整条。 */
  tracks: string[] | null;
  /** 本轮已播的歌曲身份。 */
  exclude: ReadonlySet<string>;
  currentTitle: string;
}

export interface ShuffleDeps {
  query(platform: ShufflePlatform): Promise<FavoriteRecord[]>;
  /** null = 解析失败（计入失败）；"exhausted" = 该条本轮已无可播曲目（不计失败）。 */
  prepare(
    record: FavoriteRecord,
    options: ShufflePrepareOptions,
  ): Promise<ShuffleTarget | "exhausted" | null>;
  /** 本机保存的随机选择；null = 全部收藏、按条目。 */
  loadSelection(platform: ShufflePlatform): ShuffleSelection | null;
  /** 收藏增删（含云端落地）时通知；返回取消订阅。 */
  onFavoritesChange?(listener: () => void): () => void;
  now(): number;
}

export interface ShuffleBridge {
  subscribe(listener: (snapshot: MediaSnapshot) => void): () => void;
}

export const SHUFFLE_REASONS = {
  empty: "收藏为空，先去收藏一些内容",
  gaveUp: "连续 5 首无法播放，已停止随机",
  emptySelection: "随机范围为空，重新选择",
} as const;
