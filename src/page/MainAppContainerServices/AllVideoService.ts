// AllVideosService.ts
import { AllVideosPlatform } from "../../platforms/AllVideosPlatform";
import { loadPage, showPage, sliceCachedPage } from "./pagedLoader";

export class AllVideosService {
  /**
   * @description 多源剧集搜索逻辑
   * @param ctx 核心操作上下文
   * @param baseUrl 采集站基础地址
   * @param itemsPerPage 每页显示条数 (通常为 10)
   */
  static searchAllVideos(
    ctx: MainAppContainerActionContext,
    baseUrl: string,
    itemsPerPage: number,
  ) {
    const { searchKeyword, allMediaData, currentPage, updating, totalPage } =
      ctx.getState();

    // 1. 基础校验：空关键字处理
    if (searchKeyword === "") {
      ctx.setState({ mediaData: null, totalPage: 0 });
      return;
    }

    // 2. 初始化总页数检查
    if (!allMediaData.length) {
      ctx.setState({ totalPage: 0 });
    }

    const maxLoadedPage = Math.ceil(allMediaData.length / itemsPerPage);
    const vod = AllVideosPlatform.VOD;

    // 3. 逻辑 A: 处理本地分页缓存
    if (currentPage <= maxLoadedPage) {
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
        vod,
      );
    }
    // 4. 逻辑 B: 处理异步网络请求
    else if (!updating) {
      // 计算采集站对应的页码 (假设每页 10 条)
      const page =
        currentPage !== 1 ? Math.floor(allMediaData.length / 10) + 1 : 1;

      // 落地后由加载器凭票号追加到全局列表
      loadPage(ctx, {
        fetch: () =>
          AllVideosPlatform.searchAllVideos(searchKeyword, page, baseUrl),
        onDemandPlay: vod,
      });
    }
  }
}
