// BilibiliLogic.ts

import { BilibiliPlatform } from "../../platforms/BilibiliPlatform";
import { loadPage, showPage, sliceCachedPage } from "./pagedLoader";

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
        currentPage !== 1 ? Math.floor(allMediaData.length / 50) + 1 : 1;

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
    const { searchKeyword, currentPage, requestToken } = ctx.getState();

    // 1. 基础校验：如果搜索关键字为空，重置状态并返回
    if (searchKeyword === "") {
      ctx.setState({ mediaData: null, totalPage: 0 });
      return;
    }

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
    });

    // 4. 异步处理结果
    dataPromise.then((res) => {
      // 校验 Token：确保回调返回时，用户没有发起新的搜索请求
      if (ctx.getState().requestToken !== currentRequestToken) {
        return;
      }

      // 更新总页数
      ctx.setState({ totalPage: res.totalPage });
    });
  }
}
