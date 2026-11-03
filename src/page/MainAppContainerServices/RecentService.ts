import { NetEasePlatform } from "../../platforms/NetEasePlatform";
import { RequestHistory } from "../../history/RequestHistory";
import { showLocalList } from "./pagedLoader";

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

    // 整张历史一次取全：按页码切片后连同列表一起落地
    showLocalList(ctx, allMediaData, {
      currentPage,
      itemsPerPage,
      onDemandPlay: NetEasePlatform.MOD,
    });
  }
}
