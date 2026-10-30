import {
  FavoritesStorageService,
  type FavoriteRecord,
} from "../../storage/FavoritesStorageService";
import { NetEasePlatform } from "../../platforms/NetEasePlatform";
import { BilibiliPlatform } from "../../platforms/BilibiliPlatform";

/** 收藏来源筛选：「全部」= 不按平台过滤（story 6 接入三来源切换器）。 */
export type FavoritePlatformFilter = "all" | "netease" | "bilibili";

/** 收藏范围：`collection` 合并「专辑 + 歌单」两类收藏（story 6）。 */
export type FavoriteRange = "all" | "song" | "collection" | "video";

/** 「歌单与专辑」范围查的两类记录：交给存储层过滤，墓碑与云同步落地后仍一致。 */
const COLLECTION_TYPES: FavoriteRecord["type"][] = ["album", "playlist"];

export class FavoritesService {
  /** 最近一次收藏查询条件：云端拉取落地后按同一条件刷新已渲染的列表 */
  private static lastQuery: {
    platform: FavoritePlatformFilter;
    type: FavoriteRange;
    itemsPerPage: number;
  } | null = null;

  /**
   * 已还原的条目（`账号|主键@更新时间`）：记录还原成 `PlatformData` 时 B 站条目要探测
   * 分 P（出网）。逐字过滤会反复重跑查询，复用上次的还原结果才能保证过滤只读本地存储。
   */
  private static restored = new Map<string, PlatformData>();

  /** 记录 → 可直接渲染/点播的条目；未变化的记录复用上次的还原结果。 */
  private static restoreAll(records: FavoriteRecord[]): PlatformData[] {
    // 总量兜底：换账号或大量删改后缓存不无限膨胀
    if (this.restored.size > 500) this.restored.clear();
    return records.map((record) => {
      const key = `${record.ownerUid ?? ""}|${record.id}@${record.updatedAt}`;
      const cached = this.restored.get(key);
      if (cached) return cached;
      const platformData = FavoritesStorageService.restorePlatformData(record);
      this.restored.set(key, platformData);
      return platformData;
    });
  }

  /** 用最近一次的条件重新加载收藏列表（供「外部变更」通知使用） */
  public static async reloadLastQuery(
    ctx: MainAppContainerActionContext,
    attempt: number = 0,
  ): Promise<void> {
    const last = this.lastQuery;
    if (!last) return;
    if (ctx.getState().isCurrentInMultiPage) {
      // 正在看选集/多集：现在刷新会覆盖当前列表，顺延一次再来（有上限，不无限轮询）
      if (attempt < 10) {
        window.setTimeout(
          () => void this.reloadLastQuery(ctx, attempt + 1),
          1000,
        );
      }
      return;
    }
    await this.loadFavorites(ctx, last.platform, last.type, last.itemsPerPage);
  }

  /**
   * 通用收藏加载器：连接 IndexedDB、分页与同构点播分发
   */
  public static async loadFavorites(
    ctx: MainAppContainerActionContext,
    platform: FavoritePlatformFilter,
    type: FavoriteRange,
    itemsPerPage: number = 10,
  ) {
    const { searchKeyword, currentPage, requestToken, isCurrentInMultiPage } =
      ctx.getState();

    // 若当前处于选集/多集状态，阻断外层收藏查询，防止覆盖正在查看的选集列表
    if (isCurrentInMultiPage) {
      return;
    }

    this.lastQuery = { platform, type, itemsPerPage };

    // 收藏模式有自己的一级现场（关键词按模式保存），过滤词就是当前模式的关键词
    const effectiveKeyword = searchKeyword?.trim();

    const currentRequestToken = requestToken + 1;
    ctx.setState({ updating: true, requestToken: currentRequestToken });

    // 从 IndexedDB 中提取匹配条件的收藏记录（「歌单与专辑」用 types 合并查询）
    const records = await FavoritesStorageService.query({
      platform,
      type: type === "all" || type === "collection" ? undefined : type,
      types: type === "collection" ? COLLECTION_TYPES : undefined,
      keyword: effectiveKeyword || undefined,
    });

    if (ctx.getState().requestToken !== currentRequestToken) {
      return;
    }

    const allData = this.restoreAll(records);
    const totalPage = Math.ceil(allData.length / itemsPerPage);
    const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPage || 1);
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    const currentPageData = allData.slice(
      startIndex,
      startIndex + itemsPerPage,
    );

    const onDemandPlay = (data: PlatformData) => {
      if (data.bilibili) {
        BilibiliPlatform.VOD(data);
      } else if (data.neteaseMusic) {
        if (data.neteaseMusic.isAlbum) {
          NetEasePlatform.AOD(data);
        } else if (data.neteaseMusic.isSongList) {
          NetEasePlatform.MLOD(data);
        } else if (data.neteaseMusic.isMV) {
          NetEasePlatform.MVOD(data);
        } else {
          NetEasePlatform.MOD(data);
        }
      }
    };

    ctx.setState({
      updating: false,
      currentPage: safeCurrentPage,
      totalPage,
      allMediaData: allData,
      mediaData: Promise.resolve({
        platformData: currentPageData,
        totalPage,
      }),
      currentOnDemandPlay: onDemandPlay,
    });
  }
}
