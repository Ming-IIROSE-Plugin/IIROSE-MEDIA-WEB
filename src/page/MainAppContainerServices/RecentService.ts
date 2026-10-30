import { NetEasePlatform } from "../../platforms/NetEasePlatform";
import { RequestHistory } from "../../history/RequestHistory";

/**
 * 音乐首屏供数：单曲范围、关键词为空时，把本地点播历史里的网易云单曲铺成曲目表。
 * 只读 localStorage，不发网络请求；点播复用 `NetEasePlatform.MOD`（重解析音源与歌词、
 * 沿用播报档位），而不是重发旧报文。
 */
export class RecentService {
  public static load(
    ctx: MainAppContainerActionContext,
    itemsPerPage: number,
  ): void {
    const { currentPage } = ctx.getState();
    const allMediaData = RequestHistory.recentMusic().map((entry) =>
      RequestHistory.toPlatformData(entry),
    );
    const totalPage = Math.ceil(allMediaData.length / itemsPerPage);
    const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPage || 1);
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    const currentPageData = allMediaData.slice(
      startIndex,
      startIndex + itemsPerPage,
    );

    ctx.setState({
      updating: false,
      currentPage: safeCurrentPage,
      totalPage,
      allMediaData,
      mediaData: Promise.resolve({
        platformData: currentPageData,
        totalPage,
      }),
      currentOnDemandPlay: NetEasePlatform.MOD,
    });
  }
}
