import { CMSAPI } from "../Api/AllVideosAPI/CMS";
import {
  openEpisodePicker,
  type EpisodePickEntry,
} from "../page/components/episode-picker/openEpisodePicker";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { Socket } from "../iirose_func/Socket";
import { Announce } from "../iirose_func/Socket/Announce";
import { Media } from "../iirose_func/Socket/Media";
import { ParseMediaMetaData } from "../tools/parseMediaMetaData";
import { Platform } from "./Platform";

export class AllVideosPlatform extends Platform {
  public static async searchAllVideos(
    keyword: string,
    page: number,
    baseurl: string,
  ) {
    let totalPage = 0;
    let count = 0;

    const platformData: PlatformData[] = [];
    const allPlatformData: PlatformData[] = [];
    const maotaiRes = await CMSAPI.getSearchRequestAll(keyword, page, baseurl);
    if (maotaiRes && maotaiRes.resource.length > 0) {
      for (const item of maotaiRes.resource) {
        const data: PlatformData = {
          title: item.name,
          coverImg: item.poster,
          author: "",
          websiteUrl: item.url,
          subtitle: item.subtitle,
          multiPage:
            item.playList.length > 1
              ? Promise.resolve({ platform: "video" })
              : Promise.resolve(undefined),
          playList: item.playList,
        };

        if (count >= this.itemPerPage) {
          allPlatformData.push(data);
        } else {
          allPlatformData.push(data);
          platformData.push(data);
        }

        count++;
      }
      totalPage = Math.ceil(maotaiRes.pagecount / this.itemPerPage);
    }

    return { platformData, totalPage, allPlatformData };
  }

  /**
   * Video 平台 (茅台资源等) 点播逻辑
   * 支持 PENDING 状态检查、单集直接播放、多集开插件自有选集面板
   */
  public static async VOD(platformData: PlatformData) {
    // 1. 拦截 PENDING 状态
    if (!platformData.playList) return;

    const PENDING = Symbol("pending");
    const status = await Promise.race([
      platformData.playList,
      Promise.resolve(PENDING),
    ]);

    if (status === PENDING) {
      console.warn("资源详情还在爬取中，请稍后再试");
      return;
    }

    const playList = status as PlayItem[];
    if (playList.length === 0) return;

    // 2. 多集：插件自有选集面板（点选顺序 = 播放顺序）；单集：直接点播
    if (playList.length > 1) {
      AllVideosPlatform.selectEpisodes(platformData, playList);
      return;
    }
    // 调用方（结果区 / 服务层）都不接 rejection：单集失败要在这里提示，
    // 否则用户看不到任何反馈（与旧 `VOD_ACTION` 的 catch 同一口径）。
    try {
      await AllVideosPlatform.playEpisode(platformData, playList[0], {
        singleAnnounce: true,
      });
    } catch (error) {
      console.error("[Video VOD Action Error]:", error);
      ShowMessage.show((error as Error).message);
    }
  }

  /**
   * 多集选集（CAP-8）：条目即 `playList` 的集名；面板自己取播放列表，
   * 已拿到时由调用方直接传入。
   */
  public static selectEpisodes(
    platformData: PlatformData,
    preloaded?: PlayItem[],
  ) {
    let playList: PlayItem[] = preloaded ?? [];
    const toEntries = (list: PlayItem[]): EpisodePickEntry[] =>
      list.map((item, index) => ({ id: String(index), title: item.episode }));

    openEpisodePicker({
      unit: "集",
      load: async () => {
        if (preloaded) return toEntries(preloaded);
        playList = (await platformData.playList) ?? [];
        return toEntries(playList);
      },
      onConfirm: (chosen) => {
        // 按面板给的顺序回填：点选顺序即播放顺序
        const picked = chosen
          .map((entry) => playList[Number(entry.id)])
          .filter((item): item is PlayItem => Boolean(item));
        if (!picked.length) return;

        if (picked.length === 1) {
          // 单项：`playEpisode` 内部包单曲播报窗口，卡片不被并行批量抑制吞掉
          void AllVideosPlatform.playEpisode(platformData, picked[0], {
            singleAnnounce: true,
            named: true,
          }).catch((error) =>
            Announce.showBatchItemError(error, picked[0].episode),
          );
          return;
        }

        void Announce.runBatchAnnounce(
          platformData.title,
          picked.length,
          async () => {
            for (const item of picked) {
              try {
                await AllVideosPlatform.playEpisode(platformData, item, {
                  named: true,
                });
                // 呼吸时间，防止 Socket 拥塞
                await new Promise((resolve) => setTimeout(resolve, 150));
              } catch (error) {
                // 单项失败：带集名提示（同因 10 秒去重）后跳过，剩余集照播
                Announce.showBatchItemError(error, item.episode);
              }
            }
          },
        );
      },
    });
  }

  /**
   * 点播单集：解析时长后发卡片 + 报文。
   * - `singleAnnounce`：包单曲播报窗口（手动单曲点播），否则由调用方的批量窗口管档位。
   * - `named`：副行用集名（选集面板确认的多集点播）；单集直点播仍用作者 / 简介，
   *   与旧行为一致。
   */
  private static async playEpisode(
    platformData: PlatformData,
    item: PlayItem,
    options: { singleAnnounce?: boolean; named?: boolean } = {},
  ) {
    const { singleAnnounce = false, named = false } = options;
    // 每一个分集都需要获取时长（缓存命中很快，未命中才真的探流）
    const duration = await ParseMediaMetaData.getM3U8Duration(item.url);
    const tempPD: PlatformData = {
      ...platformData,
      title: `${platformData.title}`,
      author: named
        ? `${item.episode || platformData.author || platformData.subtitle}`
        : `${platformData.author || platformData.subtitle}`,
    };
    const send = () =>
      AllVideosPlatform.sendVideoMedia(tempPD, item.url, duration);
    // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
    if (singleAnnounce) await Announce.runSingleAnnounce(send);
    else await send();
  }

  /**
   * 内部辅助：统一发送媒体指令
   */
  private static async sendVideoMedia(
    pd: PlatformData,
    url: string,
    duration: number,
  ) {
    const mediaData: MediaData = {
      type: "video",
      name: pd.title,
      singer: pd.author,
      cover: await pd.coverImg,
      link: pd.websiteUrl,
      url: url,
      duration: duration,
      bitRate: 1080,
      color: this.baseHex,
      origin: "video",
    };

    const media = new Media();
    const socket = new Socket();
    Announce.sendMediaCard(socket, media.mediaCard(mediaData));
    socket.send(media.mediaEvent(mediaData));
    console.log(`[VOD] Sent: ${pd.title}`);
  }
}
