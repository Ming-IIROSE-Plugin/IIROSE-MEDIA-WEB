// NetEaseService.ts
import { NetEasePlatform } from "../../platforms/NetEasePlatform";
import { loadPage, showPage, sliceCachedPage } from "./pagedLoader";

/** 网易云搜索接口的每页条数（上游固定 100，与本地 itemsPerPage 无关）。 */
const NETEASE_PAGE_SIZE = 100;

export class NetEaseService {
  /**
   * @description 网易云通用搜索处理器 (内部私有)
   */
  private static handleSearch(
    ctx: MainAppContainerActionContext,
    itemsPerPage: number,
    searchFn: (
      k: string,
      p: number,
    ) => Promise<{
      platformData: PlatformData[];
      totalPage: number;
      allPlatformData: PlatformData[];
    }>,
    getOnDemandPlay: (
      platform: NetEasePlatform,
    ) => (data: PlatformData) => void,
  ) {
    const {
      searchKeyword,
      allMediaData,
      currentPage,
      totalPage,
      updating,
      isCurrentInMultiPage,
    } = ctx.getState();
    const maxPage = Math.ceil(allMediaData.length / itemsPerPage);

    // 空关键词一律清空：缓存分支不能先于它，否则「搜词 → 翻页 → 清空」
    // 会停在上一轮的缓存页而不是回到空态。
    if (searchKeyword === "") {
      ctx.setState({ mediaData: null, totalPage: 0 });
      return;
    }

    // 1. 逻辑 A: 处理本地分页缓存
    if (currentPage <= maxPage) {
      // 如果在多级页面，点播逻辑通常会变为 MOD (播放单曲)
      const onDemand = isCurrentInMultiPage
        ? NetEasePlatform.MOD
        : getOnDemandPlay(NetEasePlatform);

      showPage(
        ctx,
        {
          platformData: sliceCachedPage(
            allMediaData,
            currentPage,
            itemsPerPage,
          ),
          totalPage,
        },
        onDemand,
      );
    }
    // 2. 逻辑 B: 处理异步网络请求
    else if (!updating) {
      const page =
        currentPage !== 1
          ? Math.floor(allMediaData.length / NETEASE_PAGE_SIZE) + 1
          : 1;

      loadPage(ctx, {
        fetch: () => searchFn(searchKeyword, page),
        // 内页翻页与缓存分支同一口径：内页里点播是「播这一首」，不是弹整张菜单。
        onDemandPlay: isCurrentInMultiPage
          ? NetEasePlatform.MOD
          : getOnDemandPlay(NetEasePlatform),
      });
    }
  }

  // --- 外部调用的静态接口 ---

  static searchMusic(ctx: MainAppContainerActionContext, itemsPerPage: number) {
    this.handleSearch(
      ctx,
      itemsPerPage,
      (k, p) => NetEasePlatform.searchForMusicsBasicsData(k, p),
      () => NetEasePlatform.MOD,
    );
  }

  static searchAlbum(ctx: MainAppContainerActionContext, itemsPerPage: number) {
    this.handleSearch(
      ctx,
      itemsPerPage,
      (k, p) => NetEasePlatform.searchForAlbumBasicsData(k, p),
      () => NetEasePlatform.AOD,
    );
  }

  static searchPlaylist(
    ctx: MainAppContainerActionContext,
    itemsPerPage: number,
  ) {
    this.handleSearch(
      ctx,
      itemsPerPage,
      (k, p) => NetEasePlatform.searchForMusicListBasicsData(k, p),
      () => NetEasePlatform.MLOD,
    );
  }

  static searchMV(ctx: MainAppContainerActionContext, itemsPerPage: number) {
    this.handleSearch(
      ctx,
      itemsPerPage,
      (k, p) => NetEasePlatform.searchForMVBasicsData(k, p),
      () => NetEasePlatform.MVOD,
    );
  }
}
