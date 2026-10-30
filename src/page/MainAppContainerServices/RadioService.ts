import { RadioPlatform } from "../../platforms/RadioPlatform";

export class RadioService {
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
      requestToken,
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
    if (allMediaData.length > 0 || currentPage <= maxPage) {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, filtered.length);
      const currentPageData = filtered.slice(startIndex, endIndex);

      // 如果在多级页面，点播逻辑通常会变为 MOD (播放单曲)
      const onDemand = isCurrentInMultiPage
        ? RadioPlatform.MOD
        : getOnDemandPlay(RadioPlatform);

      ctx.setState({
        mediaData: Promise.resolve({
          platformData: currentPageData,
          totalPage: 1,
        }),
        currentOnDemandPlay: onDemand,
      });
    }
    // 2. 逻辑 B: 处理异步网络请求（返回前同样按关键词过一遍）
    else if (!updating) {
      const currentRequestToken = requestToken + 1;
      ctx.setState({ updating: true, requestToken: currentRequestToken });

      // 过滤按「落地时的当前关键词」求值：请求在途时改词，落地的也得是收窄后的列表
      const dataPromise = searchFn(area).then((res) => {
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
      });
      const onDemand = getOnDemandPlay(RadioPlatform);

      ctx.setState({
        mediaData: dataPromise,
        currentOnDemandPlay: onDemand,
        requestToken: currentRequestToken,
      });

      dataPromise.then((res) => {
        ctx.pushAllData(
          currentRequestToken,
          res.allPlatformData,
          res.totalPage,
        );
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
