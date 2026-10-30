import { SendFetch } from "../Api";
import { BiliBiliCourseApi } from "../Api/BilibiliAPI/bilibili-course/BiliBiliCourseApi";
import { BiliBiliLiveApi } from "../Api/BilibiliAPI/BiliBiliLive";
import { BiliBiliSearchApi } from "../Api/BilibiliAPI/BiliBiliSearch";
import { BiliBiliVideoApi } from "../Api/BilibiliAPI/BiliBiliVideoAPI";
import {
  openEpisodePicker,
  type EpisodePickEntry,
} from "../page/components/episode-picker/openEpisodePicker";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { Socket } from "../iirose_func/Socket";
import { Announce } from "../iirose_func/Socket/Announce";
import { Media } from "../iirose_func/Socket/Media";
import { BiliBiliSettings } from "../settings/bilibiliSettings/BiliBiliSettings";
import { Platform } from "./Platform";

/** B 站分 P（`BiliBiliVideoApi.getBilibiliVideoData` 的 `pages` 项）。 */
type BiliPage = {
  page: number;
  part: string;
  duration: number;
  cid: number;
};

export class BilibiliPlatform extends Platform {
  private static timeToSeconds(timeString: string) {
    // 使用 ':' 分隔时间字符串
    const [minutes, seconds] = timeString.split(":").map(Number);
    // 将分钟转换为秒并加上秒数
    return minutes * 60 + seconds;
  }

  private static removeEmTagsUsingDOMParser(input: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(input, "text/html");
    return doc.body.textContent || "";
  }

  public static async getRecommendVideosBasicsData(
    refresh: number,
  ): Promise<{ platformData: PlatformData[]; totalPage: number }> {
    try {
      // 等待异步请求完成
      const res = await BiliBiliVideoApi.getRecommendVideoFromMainPage(
        3,
        1,
        10,
        refresh,
        refresh,
        0,
      );

      // 初始化 platformData 数组
      const platformData: PlatformData[] = [];

      if (res && res.code === 0 && res.data && res.data.item) {
        for (const item of res.data.item) {
          if (item.id === 0) continue; // 过滤掉不是视频的数据
          const data: PlatformData = {
            title: BilibiliPlatform.removeEmTagsUsingDOMParser(item.title),
            coverImg: item.pic,
            author: item.owner.name,
            websiteUrl: `https://www.bilibili.com/video/${item.bvid}`,
            duration: item.duration,
            bilibili: {
              bvid: item.bvid,
              cid: item.cid,
            },
          };
          platformData.push(data);
        }
      } else {
        throw new Error("获取推荐视频失败"); // 处理错误
      }

      const totalPage = 1;
      return { platformData, totalPage };
    } catch (error) {
      ShowMessage.show((error as Error).message);
      return { platformData: [], totalPage: 0 };
    }
  }

  public static async searchForVideosBasicsData(keyword: string, page: number) {
    try {
      let totalPage = 0;
      let count = 0;
      const pageSize = 50;
      const res = await BiliBiliSearchApi.getSearchRequestByTypeVideo(
        keyword,
        page,
        pageSize,
      );

      const platformData: PlatformData[] = [];
      const allPlatformData: PlatformData[] = [];

      if (res.data?.v_voucher)
        throw new Error("搜索失败，接口被风控，请尝试在插件设置登录B站账号");

      if (res && res.code === 0 && res.data && res.data.result) {
        for (const item of res.data.result) {
          if (item.id === 0) continue; // 过滤掉不是视频的数据
          const duration = BilibiliPlatform.timeToSeconds(item.duration);

          const data: PlatformData = {
            title: BilibiliPlatform.removeEmTagsUsingDOMParser(item.title),
            coverImg: item.pic,
            author: item.author,
            websiteUrl:
              item.arcurl ||
              `https://www.bilibili.com/video/${item.bvid || `av${item.aid}`}`,
            duration: duration,
            bilibili: {
              aid: item.type === "video" ? item.aid : undefined,
              bvid: item.type === "video" ? item.bvid : undefined,
              course_id: item.type === "ketang" ? item.aid : undefined,
            },
            multiPage: (async () => {
              if (item.type === "ketang") return { platform: "bilibili" };
              try {
                const res = await BiliBiliVideoApi.getBilibiliPagesAndCids(
                  item.aid,
                  item.bvid,
                );
                if (res?.data?.length && res.data.length > 1) {
                  return { platform: "bilibili" };
                }
              } catch (e) {
                console.error("Check multipage failed", e);
              }
              return undefined;
            })(),
          };

          if (count >= BilibiliPlatform.itemPerPage) {
            allPlatformData.push(data);
          } else {
            allPlatformData.push(data);
            platformData.push(data);
          }

          count++;
        }
        totalPage = Math.ceil(
          res.data.numResults / BilibiliPlatform.itemPerPage,
        );
      }
      return { platformData, totalPage, allPlatformData };
    } catch (error) {
      ShowMessage.show((error as Error).message);
      return { platformData: [], totalPage: 0 };
    }
  }

  public static async searchForLiveBasicsData(
    keyword: string,
    page: number,
  ): Promise<{ platformData: PlatformData[]; totalPage: number }> {
    try {
      const res = await BiliBiliSearchApi.getSearchRequestByTypeLiveRoom(
        keyword,
        page,
        BilibiliPlatform.itemPerPage,
      );

      const platformData: PlatformData[] = [];

      let totalPage = 0;

      if (res.data?.v_voucher)
        throw new Error("搜索失败，接口被风控，请尝试在插件设置登录B站账号");

      if (res && res.code === 0 && res.data && res.data.result) {
        for (const item of res.data.result) {
          const data: PlatformData = {
            title: BilibiliPlatform.removeEmTagsUsingDOMParser(item.title),
            coverImg: item.cover,
            author: item.uname,
            websiteUrl: `https://live.bilibili.com/${item.roomid}`,
            bilibiliLive: {
              roomid: item.roomid,
            },
          };
          platformData.push(data);
        }
        totalPage = res.data.numPages;
      }

      return { platformData, totalPage: totalPage };
    } catch (error) {
      ShowMessage.show((error as Error).message);
      return { platformData: [], totalPage: 0 };
    }
  }

  public static async getMultiPageBasicsData(pd: PlatformData): Promise<{
    platformData: PlatformData[];
    allPlatformData: PlatformData[];
    totalPage: number;
  }> {
    const platformDatas: PlatformData[] = [];
    const allPlatformDatas: PlatformData[] = [];
    let count = 0;

    try {
      if (!pd.bilibili) throw new Error("没有 bilibili 数据");

      if (pd.bilibili.course_id) {
        const res = await BiliBiliCourseApi.getBilibiliCoursePagesData(
          pd.bilibili.course_id,
          1000,
        );
        if (res?.data?.v_voucher)
          throw new Error("搜索失败，接口被风控，请尝试在插件设置登录B站账号");
        if (res && res.code === 0 && res.data) {
          for (const item of res.data.items) {
            const data: PlatformData = {
              title: `P${count + 1} ${item.title}`,
              coverImg: item.cover,
              author: pd.author,
              websiteUrl: `https://www.bilibili.com/cheese/play/ep${item.id}`,
              duration: item.duration,
              bilibili: {
                aid: item.aid,
                cid: item.cid,
                course_id: item.id,
              },
            };

            if (allPlatformDatas.length >= BilibiliPlatform.itemPerPage) {
              allPlatformDatas.push(data);
            } else {
              allPlatformDatas.push(data);
              platformDatas.push(data);
            }
            count++;
          }
          const totalPage = Math.ceil(
            res.data.items.length / BilibiliPlatform.itemPerPage,
          );
          return {
            platformData: platformDatas,
            allPlatformData: allPlatformDatas,
            totalPage: totalPage,
          };
        } else {
          throw new Error("获取课程信息失败");
        }
      }

      const bilibiliVideoDetail = await BiliBiliVideoApi.getBilibiliVideoData(
        null,
        pd.bilibili.bvid,
      );
      if (bilibiliVideoDetail?.data?.v_voucher)
        throw new Error("搜索失败，接口被风控，请尝试在插件设置登录B站账号");

      if (
        bilibiliVideoDetail &&
        bilibiliVideoDetail.data &&
        bilibiliVideoDetail.data.pages
      ) {
        for (const item of bilibiliVideoDetail.data.pages) {
          const data: PlatformData = {
            title: `P${count + 1} ${item.part}`,
            coverImg: bilibiliVideoDetail.data.pic,
            author: bilibiliVideoDetail.data.owner.name,
            websiteUrl: `https://www.bilibili.com/video/${pd.bilibili.bvid}?p=${item.page}`,
            duration: item.duration,
            bilibili: {
              bvid: pd.bilibili.bvid,
              cid: item.cid,
            },
          };

          if (allPlatformDatas.length >= BilibiliPlatform.itemPerPage) {
            allPlatformDatas.push(data);
          } else {
            allPlatformDatas.push(data);
            platformDatas.push(data);
          }
          count++;
        }

        const totalPage = Math.ceil(
          bilibiliVideoDetail.data.pages.length / BilibiliPlatform.itemPerPage,
        );
        return {
          platformData: platformDatas,
          allPlatformData: allPlatformDatas,
          totalPage: totalPage,
        };
      } else throw new Error("获取视频信息失败");
    } catch (error) {
      ShowMessage.show((error as Error).message);
      return { platformData: [], allPlatformData: [], totalPage: 0 };
    }
  }

  public static async getBilibiliVideoDetail(videoId: string) {
    try {
      let aid: number | null = null;
      let bvid: string | null = null;
      if (videoId.toLowerCase().startsWith("av")) {
        aid = parseInt(videoId.slice(2), 10);
      } else {
        bvid = videoId;
      }
      const res = await BiliBiliVideoApi.getBilibiliVideoData(aid, bvid);
      if (res && res.code === 0 && res.data) {
        return res.data;
      } else throw new Error("获取视频信息失败");
    } catch (error) {
      ShowMessage.show((error as Error).message);
      return null;
    }
  }

  /**
   * Bilibili 点播逻辑
   * 逻辑：检测多集 -> 弹出选择框 -> 执行点播
   */
  /**
   * Bilibili 播放指定单 P
   */
  public static async playBiliPage(
    basePlatformData: PlatformData,
    pageItem: { page: number; part: string; duration: number; cid: number },
    aid?: number,
    bvid?: string,
  ) {
    const bvSetting = new BiliBiliSettings().getBilibiliVideoSettings();
    const cid = pageItem.cid;
    if (typeof cid !== "number") throw new Error("无法确定有效的 CID");

    let streamFormat = BilibiliPlatform.getStreamPlatform(
      bvSetting.videoStreamFormat,
      bvSetting.qn,
    );
    const res = await BiliBiliVideoApi.getBilibiliVideoStream(
      aid,
      bvid,
      cid,
      bvSetting.qn,
      streamFormat,
    );

    if (res && res.code === 0 && res.data) {
      let videoUrl = "";
      let actuallyQn = res.data.quality || bvSetting.qn;

      if (res.data.durl && res.data.durl.length > 0) {
        videoUrl = res.data.durl[0].url;
      } else if (res.data.dash) {
        const { playurl, qn } = await BilibiliPlatform.getDashUrlAndQn(
          res.data.dash,
        );
        videoUrl = playurl;
        actuallyQn = qn;
      }

      if (!videoUrl) throw new Error("解析播放地址失败");

      const title = pageItem.part
        ? `P${pageItem.page} ${pageItem.part}`
        : basePlatformData.title;
      const pd: PlatformData = {
        ...basePlatformData,
        title: title,
        duration: pageItem.duration || basePlatformData.duration,
        websiteUrl: bvid
          ? `https://www.bilibili.com/video/${bvid}?p=${pageItem.page}`
          : basePlatformData.websiteUrl,
      };

      await BilibiliPlatform.prepareAndSendMedia(
        pd,
        videoUrl,
        res.data.timelength ||
          (pageItem.duration ? pageItem.duration * 1000 : 0),
        actuallyQn,
      );
    } else {
      throw new Error("获取播放流失败");
    }
  }

  /**
   * Bilibili 点播逻辑
   * 支持指定 targetP 直达、多分 P 选集多选与正序/乱序二次流转
   */
  public static async VOD(platformData: PlatformData, targetP?: number) {
    try {
      if (!platformData.bilibili) throw new Error("没有 bilibili 数据");
      const { aid, bvid, course_id } = platformData.bilibili;

      // 1. 课程流处理
      if (course_id) {
        const bvSetting = new BiliBiliSettings().getBilibiliVideoSettings();
        let cid = platformData.bilibili.cid;
        if (!cid) {
          const res = await BiliBiliCourseApi.getBilibiliCoursePagesData(
            course_id,
            1000,
          );
          if (res?.data?.items?.length) {
            cid = res.data.items[0].cid;
          }
        }
        if (cid) {
          const res = await BiliBiliCourseApi.getBilibiliCourseStream(
            aid,
            course_id,
            cid,
            bvSetting.qn,
          );
          if (res?.data?.dash) {
            const { playurl, qn } = await BilibiliPlatform.getDashUrlAndQn(
              res.data.dash,
            );
            const timelength = res.data.timelength || 0;
            // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
            await Announce.runSingleAnnounce(() =>
              BilibiliPlatform.prepareAndSendMedia(
                platformData,
                playurl,
                timelength,
                qn,
              ),
            );
            return;
          }
        }
        throw new Error("获取课程播放流失败");
      }

      // 2. 普通视频：获取视频数据与分 P 列表
      let pages: BiliPage[] = [];
      const res = await BiliBiliVideoApi.getBilibiliVideoData(
        aid || null,
        bvid,
      );
      if (res && res.code === 0 && res.data && res.data.pages) {
        pages = res.data.pages;
      }

      // 3. 若显式指定 targetP (例如 URL 带 ?p=N)，直接播放对应分 P
      if (typeof targetP === "number" && targetP > 0) {
        const targetPage =
          pages.find((p) => p.page === targetP) || pages[targetP - 1];
        if (targetPage) {
          // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
          await Announce.runSingleAnnounce(() =>
            BilibiliPlatform.playBiliPage(platformData, targetPage, aid, bvid),
          );
        } else {
          ShowMessage.show(`未找到分P: P${targetP}`);
        }
        return;
      }

      // 4. 若为子级单集卡片（在分 P 列表内部单点某集：cid 存在且未携带 multiPage）
      if (platformData.bilibili.cid && !platformData.multiPage) {
        const singlePage = pages.find(
          (p) => p.cid === platformData.bilibili!.cid,
        ) || {
          page: 1,
          part: platformData.title,
          duration: platformData.duration || 0,
          cid: platformData.bilibili.cid,
        };
        // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
        await Announce.runSingleAnnounce(() =>
          BilibiliPlatform.playBiliPage(platformData, singlePage, aid, bvid),
        );
        return;
      }

      // 5. 若未指定 targetP 且为多分 P 视频 (pages.length > 1)
      let isMultiPage = pages.length > 1;
      if (!isMultiPage && platformData.multiPage) {
        const multi = await platformData.multiPage;
        if (multi) isMultiPage = true;
      }

      if (isMultiPage && pages.length > 1) {
        // 多分 P：直接开插件自有选集面板（CAP-5 J3），不再有宿站一级菜单与二次排序确认
        BilibiliPlatform.selectEpisodes(platformData, {
          pages,
          description: res?.data?.desc,
        });
        return;
      }

      // 6. 单集视频直接播放
      if (pages.length > 0) {
        // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
        await Announce.runSingleAnnounce(() =>
          BilibiliPlatform.playBiliPage(
            platformData,
            { ...pages[0], part: platformData.title },
            aid,
            bvid,
          ),
        );
      } else {
        throw new Error("无法获取视频信息");
      }
    } catch (error) {
      console.error("[VOD Error]:", error);
      ShowMessage.show((error as Error).message);
    }
  }

  /**
   * 多分 P 选集（CAP-8）：插件自有选集面板，点选顺序 = 播放顺序。
   * `VOD` 已拿到 `pages` 时直接传入；手机操作条只有条目本身，由面板的 `load` 现取。
   */
  public static selectEpisodes(
    platformData: PlatformData,
    preloaded?: { pages: BiliPage[]; description?: string | null },
  ) {
    const { aid, bvid } = platformData.bilibili ?? {};
    let pages: BiliPage[] = preloaded?.pages ?? [];
    let description: string | null = preloaded?.description ?? null;
    const toEntry = (item: BiliPage): EpisodePickEntry => ({
      id: String(item.page),
      title: `P${item.page} ${item.part}`,
      duration: item.duration,
    });

    openEpisodePicker({
      unit: "集",
      load: async () => {
        if (preloaded?.pages?.length) return preloaded.pages.map(toEntry);
        if (!bvid && !aid) throw new Error("没有 bilibili 数据");
        const res = await BiliBiliVideoApi.getBilibiliVideoData(
          aid ?? null,
          bvid,
        );
        if (!res || res.code !== 0 || !res.data?.pages?.length)
          throw new Error("获取视频信息失败");
        pages = res.data.pages;
        description = res.data.desc;
        return pages.map(toEntry);
      },
      onConfirm: (chosen) => {
        // 按面板给的顺序回填分 P：点选顺序即播放顺序（乱序已在面板里置换）
        const picked = chosen
          .map((entry) => pages.find((item) => String(item.page) === entry.id))
          .filter((item): item is BiliPage => Boolean(item));
        if (!picked.length) return;
        const label = (item: BiliPage) => `P${item.page} ${item.part}`;

        if (picked.length === 1) {
          // 单项：单曲播报窗口，卡片不被并行批量抑制吞掉
          void Announce.runSingleAnnounce(() =>
            BilibiliPlatform.playBiliPage(platformData, picked[0], aid, bvid),
          ).catch((error) =>
            Announce.showBatchItemError(error, label(picked[0])),
          );
          return;
        }

        void Announce.runBatchAnnounce(
          platformData.title,
          picked.length,
          async () => {
            for (const item of picked) {
              try {
                await BilibiliPlatform.playBiliPage(
                  platformData,
                  item,
                  aid,
                  bvid,
                );
              } catch (error) {
                // 单项失败：带分P名提示（同因 10 秒去重）后跳过，剩余分 P 照播
                Announce.showBatchItemError(error, label(item));
              }
            }
          },
          description,
        );
      },
    });
  }

  /**
   * 辅助：构建并发送媒体卡片
   */
  private static async prepareAndSendMedia(
    platformData: PlatformData,
    url: string,
    durationMs: number,
    qn: number,
  ) {
    const cover =
      typeof platformData.coverImg === "string"
        ? platformData.coverImg
        : await platformData.coverImg;

    const mediaData: MediaData = {
      type: "video",
      name: platformData.title,
      singer: platformData.author,
      cover: cover,
      link: platformData.websiteUrl,
      url: url,
      duration: durationMs / 1000,
      bitRate: qn,
      color: BilibiliPlatform.baseHex,
      origin: "bilibili",
    };

    const media = new Media();
    const socket = new Socket();

    Announce.sendMediaCard(socket, media.mediaCard(mediaData));
    socket.send(media.mediaEvent(mediaData));

    console.log(`[VOD] 播放指令已下发: ${mediaData.name}`);
  }

  public static async LOD(platformData: PlatformData) {
    const bvSetting = new BiliBiliSettings().getBilibiliVideoSettings();
    try {
      if (!platformData.bilibiliLive) throw new Error("没有 bilibiliLive 数据");
      const res = await BiliBiliLiveApi.getLiveStream(
        platformData.bilibiliLive.roomid,
        "web",
        bvSetting.streamqn,
      );

      if (res && res.code === 0 && res.data && res.data.durl) {
        let videoUrl = ``;

        const durl = res.data.durl;

        let testResult = false;

        for (const item of durl) {
          const res = await SendFetch.tryGetWhithXhr(item.url);
          if (res) {
            videoUrl = item.url;
            testResult = true;
            break;
          }
        }

        if (!testResult) throw new Error("获取直播流失败");

        // const imageTools = new ImageTools();

        // const hex = await imageTools.getAverageColorFromImageUrl(platformData.coverImg);

        const br = res.data.current_qn;

        const mediaData: MediaData = {
          type: "video",
          name: platformData.title,
          singer: platformData.author,
          cover: await platformData.coverImg,
          link: platformData.websiteUrl,
          url: videoUrl,
          duration: bvSetting.streamSeconds,
          bitRate: br,
          color: BilibiliPlatform.baseHex,
          origin: "bilibililive",
        };
        const media = new Media();

        const mediacard = media.mediaCard(mediaData);
        const mediaEvent = media.mediaEvent(mediaData);

        const socket = new Socket();
        // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
        await Announce.runSingleAnnounce(async () => {
          Announce.sendMediaCard(socket, mediacard);
          socket.send(mediaEvent);
        });
      }
    } catch (error) {
      ShowMessage.show((error as Error).message);
    }
  }

  private static async getDashUrlAndQn(data: StreamDash) {
    const bvSetting = new BiliBiliSettings().getBilibiliVideoSettings();
    let playurl: string | null = null;
    let audiourl: string | null = null;
    let qn: number | null = null;
    console.log(`try get video`);

    for (const video of data.video) {
      if (video.id === bvSetting.qn && video.codecid === 13) {
        const res = await SendFetch.tryGetWhithXhr(
          video.baseUrl || video.base_url,
        );
        if (res) {
          playurl = video.base_url || video.baseUrl;
          qn = video.id;
          break;
        }
      }
    }

    if (!playurl) {
      console.log(`try another method to get video`);
      for (const video of data.video) {
        if (video.codecid === 13 || video.codecid === 7) {
          const res = await SendFetch.tryGetWhithXhr(
            video.baseUrl || video.base_url,
          );
          if (res) {
            playurl = video.base_url || video.baseUrl;
            qn = video.id;
            break;
          }
        }
      }
    }

    if (!playurl)
      throw new Error(
        "获取Dash视频流失败, 找不到合适的视频流, 可能是因为视频是付费的",
      );

    if (!qn) qn = bvSetting.qn;

    const audioArray = data.audio;
    console.log(`try get audio`);
    for (const audio of audioArray) {
      const res = await SendFetch.tryGetWhithXhr(
        audio.baseUrl || audio.base_url,
      );
      if (res) {
        audiourl = audio.base_url || audio.baseUrl;
        break;
      }
    }
    console.log(`finish`);
    if (!audiourl)
      throw new Error(
        "获取Dash视频流失败, 找不到合适的音频流, 可能是因为视频是付费的",
      );

    playurl = `${playurl}#audio=${audiourl}`;
    return { playurl, qn };
  }

  private static getStreamPlatform(platform: number, qn: number) {
    switch (platform) {
      case 0:
        return 1;
      case 1:
        return 4048;
      case 2:
        if (qn <= 64) return 1;
        else return 4048;
      default:
        return 1;
    }
  }
}
