import { RadioPlatform } from "../../platforms/RadioPlatform";
import { loadPage, showPage, sliceCachedPage } from "./pagedLoader";

export class RadioService {
  /**
   * 已经取过网的电台列表（按渲染中的数据承诺记）：电台列表可能**合法为空**，
   * 光看 `allMediaData.length` 会把「加载完但 0 个台」当成「没加载」，于是每敲一个
   * 过滤键都重新发请求。列表非空与「已加载一次」要分开判断。
   */
  private static loadedLists = new WeakSet<object>();

  /** 当前渲染的数据是否就是本服务取回来的那份电台列表。 */
  private static hasLoadedList(
    mediaData: MainAppContainerState["mediaData"],
  ): boolean {
    return !!mediaData && this.loadedLists.has(mediaData);
  }

  /**
   * @description 通用搜索处理器 (内部私有)
   */
  private static handleSearch(
    ctx: MainAppContainerActionContext,
    itemsPerPage: number,
    area: string,
    searchFn: (k: string) => Promise<any>,
    getOnDemandPlay: (platform: RadioPlatform) => (data: PlatformData) => void,
  ) {
    const {
      allMediaData,
      currentPage,
      updating,
      isCurrentInMultiPage,
      searchKeyword,
    } = ctx.getState();
    // 输入即过滤：只裁本地列表里的台名，不发网络请求（电台只有一页）
    const keyword = searchKeyword.trim().toLowerCase();
    const matches = (item: PlatformData) =>
      !keyword || (item.title ?? "").toLowerCase().includes(keyword);
    const filtered = allMediaData.filter(matches);
    const maxPage = Math.ceil(filtered.length / itemsPerPage);

    // 1. 逻辑 A: 处理本地分页缓存（已加载过列表就只切片：过滤为空也不联网）
    if (
      allMediaData.length > 0 ||
      currentPage <= maxPage ||
      this.hasLoadedList(ctx.getState().mediaData)
    ) {
      // 如果在多级页面，点播逻辑通常会变为 MOD (播放单曲)
      const onDemand = isCurrentInMultiPage
        ? RadioPlatform.MOD
        : getOnDemandPlay(RadioPlatform);

      const listData = showPage(
        ctx,
        {
          platformData: sliceCachedPage(filtered, currentPage, itemsPerPage),
          totalPage: 1,
        },
        onDemand,
      );
      // 切片结果同样是「本服务取回来的列表」：下一次逐字过滤还在它上面切，不再出网
      this.loadedLists.add(listData);
    }
    // 2. 逻辑 B: 处理异步网络请求（返回前同样按关键词过一遍）
    else if (!updating) {
      loadPage(ctx, {
        // 过滤按「落地时的当前关键词」求值：请求在途时改词，落地的也得是收窄后的列表
        fetch: () =>
          searchFn(area).then((res) => {
            const currentKeyword = ctx
              .getState()
              .searchKeyword.trim()
              .toLowerCase();
            return {
              ...res,
              platformData: (res.platformData as PlatformData[]).filter(
                (item) =>
                  !currentKeyword ||
                  (item.title ?? "").toLowerCase().includes(currentKeyword),
              ),
              totalPage: 1,
            };
          }),
        onDemandPlay: getOnDemandPlay(RadioPlatform),
        // 落地成功才算「已加载一次」：失败（拒绝）不记，下一次过滤键仍可重试
        onFulfilled: (_res, pending) => this.loadedLists.add(pending),
      });
    }
  }

  static search(
    ctx: MainAppContainerActionContext,
    itemsPerPage: number,
    area: string,
  ) {
    this.handleSearch(
      ctx,
      itemsPerPage,
      area,
      (k) => RadioPlatform.searchSongs(k),
      () => RadioPlatform.MOD,
    );
  }
}
