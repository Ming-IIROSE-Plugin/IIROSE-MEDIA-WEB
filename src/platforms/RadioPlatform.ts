import { reportFailure } from "../tools/reportFailure";
import { Socket } from "../iirose_func/Socket";
import { Announce } from "../iirose_func/Socket/Announce";
import { Media } from "../iirose_func/Socket/Media";
import { RadioSettings } from "../settings/radioSettings/RadioSettings";
import { Platform } from "./Platform";
import { splitByPage } from "./shared/splitByPage";

export class RadioPlatform extends Platform {
  static radiourl = [
    {
      id: 1,
      url: "https://listen.moe/stream?format=mp3&ext=.mp3",
    },
    {
      id: 2,
      url: "https://vocaloid.radioca.st/stream?format=mp3&ext=.mp3",
    },
  ];

  static searchSongs = async (area: string) => {
    let platformData: PlatformData[] = [];
    let allPlatformData: PlatformData[] = [];

    if (area === "japan") {
      const data: PlatformData[] = [
        {
          title: `Listen.moe`,
          coverImg: `http://r.iirose.com/i/26/3/4/4/5306-B0.png`,
          author: "Listen.moe",
          websiteUrl: "https://listen.moe/",
          radio: {
            isradio: true,
            id: 1,
          },
        },
        {
          title: `Vocaloid Radio`,
          coverImg: `http://r.iirose.com/i/26/3/6/5/2829-MQ.png`,
          author: "Vocaloid Radio",
          websiteUrl: "https://vocaloidradio.com/",
          radio: {
            isradio: true,
            id: 2,
          },
        },
      ];

      const split = splitByPage(data, this.itemPerPage);
      platformData = split.platformData;
      allPlatformData = split.allPlatformData;
    }
    const totalPage = Math.ceil(allPlatformData.length / this.itemPerPage);
    return { platformData, totalPage, allPlatformData };
  };

  static MOD = async (platformData: PlatformData) => {
    // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
    try {
      await Announce.runSingleAnnounce(() => this.finalODSONG([platformData]));
    } catch (error) {
      reportFailure(error);
    }
  };

  private static finalODSONG = async (data: PlatformData[]) => {
    const media = new Media();
    const socket = new Socket();

    for (const item of data) {
      const cover =
        typeof item.coverImg === "string" ? item.coverImg : await item.coverImg;
      if (!cover) item.coverImg = "http://r.iirose.com/i/26/3/6/4/5918-8B.png";
      const url = this.radiourl.find((r) => r.id === item.radio?.id)?.url;
      if (!url) throw new Error("无法获取播放链接");
      const radioSetting = RadioSettings.getRadioSettings();
      const mediaData: MediaData = {
        type: "music",
        name: `${item.title} - 电台 - ${Math.floor(radioSetting.duration / 60)} 分钟`,
        singer: item.author,
        cover: cover,
        link: item.websiteUrl,
        url: url,
        duration: radioSetting.duration, // 默认播放时长，单位秒
        bitRate: 320,
        color: this.baseHex,
        lyrics: "",
        origin: "undefined",
      };
      const mediacard = media.mediaCard(mediaData);
      const mediaEvent = media.mediaEvent(mediaData);

      Announce.sendMediaCard(socket, mediacard);
      socket.send(mediaEvent);
    }
  };
}
