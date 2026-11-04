// BilibiliLogic.ts

import { BilibiliPlatform } from "../../platforms/BilibiliPlatform";
import { loadPage, showPage, sliceCachedPage } from "./pagedLoader";

/** B 站搜索接口的每页条数（上游固定 50，与本地 itemsPerPage 无关）。 */
const BILI_SEARCH_PAGE_SIZE = 50;

export class BilibiliService {
  /**
   * 首页推荐
   */
  static snbclickRecommand(ctx: BilibiliActionContext) {
    const data = BilibiliPlatform.getRecommendVideosBasicsData(
      ctx.getRefreshCount(),
    );
    const vod = BilibiliPlatform.VOD;

    ctx.setState({
      mediaData: data,
      currentOnDemandPlay: vod,
      currentPage: 1,
      totalPage: 1,
      requestToken: ctx.getState().requestToken + 1,
    });
    ctx.incrementRefreshCount();
  }

  /**
   * 搜索视频 (包含分页缓存逻辑)
   */
  static snbclickSearchVideo(
    ctx: MainAppContainerActionContext,
    itemsPerPage: number,
  ) {
    const { searchKeyword, allMediaData, currentPage, updating, totalPage } =
      ctx.getState();

    if (searchKeyword === "") {
      ctx.setState({ mediaData: null, totalPage: 0 });
      return;
    }

    const maxPage = Math.ceil(allMediaData.length / itemsPerPage);
    const vod = BilibiliPlatform.VOD;

    // 命中本地缓存
    if (currentPage <= maxPage) {
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
    // 网络请求
    else if (!updating) {
      const page =
        currentPage !== 1
          ? Math.floor(allMediaData.length / BILI_SEARCH_PAGE_SIZE) + 1
          : 1;

      loadPage(ctx, {
        fetch: () =>
          BilibiliPlatform.searchForVideosBasicsData(searchKeyword, page),
        onDemandPlay: vod,
      });
    }
  }

  /**
   * @description 哔哩哔哩搜索直播逻辑
   * @param ctx 核心操作上下文
   */
  static snbclickSearchLive(ctx: MainAppContainerActionContext) {
    const { searchKeyword, currentPage, requestToken, updating } =
      ctx.getState();

    // 1. 基础校验：如果搜索关键字为空，重置状态并返回
    if (searchKeyword === "") {
      ctx.setState({ mediaData: null, totalPage: 0 });
      return;
    }

    // 与另两条搜索一致：进行中不叠加第二次请求。
    if (updating) return;

    // 2. 准备请求：生成新的 Request Token 防止并发冲突
    const currentRequestToken = requestToken + 1;

    const dataPromise = BilibiliPlatform.searchForLiveBasicsData(
      searchKeyword,
      currentPage,
    );
    const lod = BilibiliPlatform.LOD;

    // 3. 更新 UI 状态：设置 Loading 状态（Promise）和播放回调
    ctx.setState({
      mediaData: dataPromise,
      currentOnDemandPlay: lod,
      requestToken: currentRequestToken,
      updating: true,
    });

    // 4. 异步处理结果
    // 成功与失败都要解除守卫；陈旧结果不动它（新请求自己会接管）。
    const settle = (patch: Partial<MainAppContainerState>) => {
      if (ctx.getState().requestToken !== currentRequestToken) return;
      ctx.setState({ ...patch, updating: false });
    };
    dataPromise.then(
      (res) => settle({ totalPage: res.totalPage }),
      () => settle({}),
    );
  }
}
