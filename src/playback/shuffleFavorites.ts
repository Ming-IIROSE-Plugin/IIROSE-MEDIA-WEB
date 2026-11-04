// 收藏随机的候选来源：各平台已读出的收藏缓存 + 「随机」开关的可用性刷新。
// 只负责取数与可用性，抽选、预取与发送仍由 ShuffleController 的状态机决定。
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import { SHUFFLE_PLATFORMS, type ShufflePlatform } from "./ShuffleSelection";
import { SHUFFLE_REASONS } from "./shuffleContract";

export class ShuffleFavorites {
  /** 各平台已读出的收藏：可用性看全部平台，抽取只用随机平台。 */
  private lists = new Map<ShufflePlatform, FavoriteRecord[]>();
  private querying = new Map<
    ShufflePlatform,
    Promise<FavoriteRecord[] | null>
  >();
  /** 收藏变更或范围刷新递增：作废在途的收藏查询结果。 */
  private generation = 0;

  constructor(
    private query: (platform: ShufflePlatform) => Promise<FavoriteRecord[]>,
    private setAvailability: (enabled: boolean, reason: string) => void,
  ) {}

  /** 收藏增删 / 选择范围变了：丢掉缓存的收藏列表，在途结果作废。 */
  clear(): void {
    this.generation += 1;
    this.lists.clear();
    this.querying.clear();
  }

  load(platform: ShufflePlatform): Promise<FavoriteRecord[] | null> {
    const cached = this.lists.get(platform);
    if (cached) return Promise.resolve(cached);
    // 同平台的并发调用复用在途查询：预取不能因可用性刷新先发起了查询而空等一帧。
    const inflight = this.querying.get(platform);
    if (inflight) return inflight;
    const generation = this.generation;
    const querying = (async () => {
      let list: FavoriteRecord[];
      try {
        list = await this.query(platform);
      } catch {
        list = [];
      }
      // 期间范围被刷新或收藏有变：结果作废，下一次调用重新查。
      if (this.generation !== generation) return null;
      this.lists.set(platform, list);
      return list;
    })();
    this.querying.set(platform, querying);
    void querying.finally(() => {
      if (this.querying.get(platform) === querying)
        this.querying.delete(platform);
    });
    return querying;
  }

  /** 连接就绪且任一平台有收藏即可用；随机平台本身是否有收藏留给抽取时判定。 */
  publish(): void {
    const missing = SHUFFLE_PLATFORMS.filter((p) => !this.lists.has(p));
    if (missing.length > 0) {
      // 收藏还没读全：先取一次，读到后再刷新可用性（查询中不重复触发）。
      for (const platform of missing)
        if (!this.querying.has(platform))
          void this.load(platform).then((list) => {
            if (list) this.publish();
          });
      return;
    }
    const any = SHUFFLE_PLATFORMS.some(
      (platform) => (this.lists.get(platform)?.length ?? 0) > 0,
    );
    if (!any) {
      this.setAvailability(false, SHUFFLE_REASONS.empty);
      return;
    }
    this.setAvailability(true, "");
  }
}
