import { SendFetch } from "../../Api";
import { BiliBiliLiveApi } from "../../Api/BilibiliAPI/BiliBiliLive";
import { BiliBiliVideoApi } from "../../Api/BilibiliAPI/BiliBiliVideoAPI";
import { ShowMessage } from "../../iirose_func/ShowMessage";
import { Socket } from "../../iirose_func/Socket";
import { Announce } from "../../iirose_func/Socket/Announce";
import { Media } from "../../iirose_func/Socket/Media";
import { BiliBiliSettings } from "../../settings/bilibiliSettings/BiliBiliSettings";
import type { AutoPlayOptions } from "../Platform";
import type { BiliPage } from "./shared";

/**
 * 发卡片 + 播放报文：平台层 `prepareAndSendMedia` 的原样签名，
 * 由平台层传入以便测试仍能替换发送点。
 */
export type SendMediaFn = (
  platformData: PlatformData,
  url: string,
  durationMs: number,
  qn: number,
  options?: AutoPlayOptions,
) => Promise<void>;

const getStreamPlatform = (platform: number, qn: number) => {
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
};

export const getDashUrlAndQn = async (data: StreamDash) => {
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
    const res = await SendFetch.tryGetWhithXhr(audio.baseUrl || audio.base_url);
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
};

/**
 * Bilibili 播放指定单 P
 * @param send 发卡片与播放报文（平台层 `prepareAndSendMedia`）。
 * @param options.cardless 自动播放（收藏随机）：只发播放报文、不发点播卡片（CAP-2）。
 */
export const playPage = async (
  send: SendMediaFn,
  basePlatformData: PlatformData,
  pageItem: BiliPage,
  aid?: number,
  bvid?: string,
  options?: AutoPlayOptions,
) => {
  const bvSetting = new BiliBiliSettings().getBilibiliVideoSettings();
  const cid = pageItem.cid;
  if (typeof cid !== "number") throw new Error("无法确定有效的 CID");

  let streamFormat = getStreamPlatform(
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
      const { playurl, qn } = await getDashUrlAndQn(res.data.dash);
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

    await send(
      pd,
      videoUrl,
      res.data.timelength || (pageItem.duration ? pageItem.duration * 1000 : 0),
      actuallyQn,
      options,
    );
  } else {
    throw new Error("获取播放流失败");
  }
};

/**
 * 辅助：构建并发送媒体卡片
 */
export const sendBiliMedia = async (
  baseHex: string,
  platformData: PlatformData,
  url: string,
  durationMs: number,
  qn: number,
  options?: AutoPlayOptions,
) => {
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
    color: baseHex,
    origin: "bilibili",
  };

  const media = new Media();
  const socket = new Socket();

  // 自动播放（收藏随机）只发播放报文：卡片会抬高平台活跃度（CAP-2）
  if (!options?.cardless)
    Announce.sendMediaCard(socket, media.mediaCard(mediaData));
  socket.send(media.mediaEvent(mediaData));

  console.log(`[VOD] 播放指令已下发: ${mediaData.name}`);
};

export const streamLive = async (
  baseHex: string,
  platformData: PlatformData,
) => {
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
        color: baseHex,
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
};
