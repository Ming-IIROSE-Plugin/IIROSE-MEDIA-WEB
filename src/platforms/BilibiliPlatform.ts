import { Platform } from "./Platform";
import type { AutoPlayOptions } from "./Platform";
import { selectEpisodes as openEpisodes, vod } from "./bilibili/episodes";
import type { VodDeps } from "./bilibili/episodes";
import { multiPageBasics, videoDetail } from "./bilibili/pages";
import { playPage, sendBiliMedia, streamLive } from "./bilibili/playback";
import {
  recommendVideos,
  searchLiveBasics,
  searchVideosBasics,
} from "./bilibili/search";
import type { BiliPage } from "./bilibili/shared";

export class BilibiliPlatform extends Platform {
  public static async getRecommendVideosBasicsData(refresh: number) {
    return recommendVideos(refresh);
  }

  public static async searchForVideosBasicsData(keyword: string, page: number) {
    return searchVideosBasics(keyword, page, BilibiliPlatform.itemPerPage);
  }

  public static async searchForLiveBasicsData(keyword: string, page: number) {
    return searchLiveBasics(keyword, page, BilibiliPlatform.itemPerPage);
  }

  public static async getMultiPageBasicsData(pd: PlatformData) {
    return multiPageBasics(pd, BilibiliPlatform.itemPerPage);
  }

  public static async getBilibiliVideoDetail(videoId: string) {
    return videoDetail(videoId);
  }

  /**
   * Bilibili 播放指定单 P
   * @param options.cardless 自动播放（收藏随机）：只发播放报文、不发点播卡片（CAP-2）。
   */
  public static async playBiliPage(
    basePlatformData: PlatformData,
    pageItem: BiliPage,
    aid?: number,
    bvid?: string,
    options?: AutoPlayOptions,
  ) {
    return playPage(
      BilibiliPlatform.prepareAndSendMedia,
      basePlatformData,
      pageItem,
      aid,
      bvid,
      options,
    );
  }

  /**
   * Bilibili 点播逻辑
   * 支持指定 targetP 直达、多分 P 选集多选与正序/乱序二次流转
   */
  public static async VOD(
    platformData: PlatformData,
    targetP?: number,
    options?: AutoPlayOptions,
  ) {
    return vod(BilibiliPlatform.vodDeps(), platformData, targetP, options);
  }

  /**
   * 多分 P 选集（CAP-8）：插件自有选集面板，点选顺序 = 播放顺序。
   * `VOD` 已拿到 `pages` 时直接传入；只有条目本身时（如收藏点播）由面板的 `load` 现取。
   */
  public static selectEpisodes(
    platformData: PlatformData,
    preloaded?: { pages: BiliPage[]; description?: string | null },
  ) {
    openEpisodes(() => BilibiliPlatform.playBiliPage, platformData, preloaded);
  }

  /**
   * 辅助：构建并发送媒体卡片
   */
  private static async prepareAndSendMedia(
    platformData: PlatformData,
    url: string,
    durationMs: number,
    qn: number,
    options?: AutoPlayOptions,
  ) {
    return sendBiliMedia(
      BilibiliPlatform.baseHex,
      platformData,
      url,
      durationMs,
      qn,
      options,
    );
  }

  public static async LOD(platformData: PlatformData) {
    return streamLive(BilibiliPlatform.baseHex, platformData);
  }

  /**
   * 点播入口的发送点一律现取类成员：测试替换 `playBiliPage` / `prepareAndSendMedia`
   * 后才生效，不能把模块实现直接交给 VOD。
   */
  private static vodDeps = (): VodDeps => ({
    playBiliPage: BilibiliPlatform.playBiliPage,
    prepareAndSendMedia: BilibiliPlatform.prepareAndSendMedia,
    selectEpisodes: BilibiliPlatform.selectEpisodes,
  });
}
