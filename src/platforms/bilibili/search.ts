import { BiliBiliSearchApi } from "../../Api/BilibiliAPI/BiliBiliSearch";
import { BiliBiliVideoApi } from "../../Api/BilibiliAPI/BiliBiliVideoAPI";
import { ShowMessage } from "../../iirose_func/ShowMessage";
import {
  removeEmTagsUsingDOMParser,
  splitByPage,
  timeToSeconds,
} from "./shared";

export const recommendVideos = async (
  refresh: number,
): Promise<{ platformData: PlatformData[]; totalPage: number }> => {
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
          title: removeEmTagsUsingDOMParser(item.title),
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
};

export const searchVideosBasics = async (
  keyword: string,
  page: number,
  itemPerPage: number,
) => {
  try {
    let totalPage = 0;
    const pageSize = 50;
    const res = await BiliBiliSearchApi.getSearchRequestByTypeVideo(
      keyword,
      page,
      pageSize,
    );

    const dataList: PlatformData[] = [];

    if (res.data?.v_voucher)
      throw new Error("搜索失败，接口被风控，请尝试在插件设置登录B站账号");

    if (res && res.code === 0 && res.data && res.data.result) {
      for (const item of res.data.result) {
        if (item.id === 0) continue; // 过滤掉不是视频的数据
        const duration = timeToSeconds(item.duration);

        const data: PlatformData = {
          title: removeEmTagsUsingDOMParser(item.title),
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

        dataList.push(data);
      }
      totalPage = Math.ceil(res.data.numResults / itemPerPage);
    }
    const { platformData, allPlatformData } = splitByPage(
      dataList,
      itemPerPage,
    );
    return { platformData, totalPage, allPlatformData };
  } catch (error) {
    ShowMessage.show((error as Error).message);
    return { platformData: [], totalPage: 0 };
  }
};

export const searchLiveBasics = async (
  keyword: string,
  page: number,
  itemPerPage: number,
): Promise<{ platformData: PlatformData[]; totalPage: number }> => {
  try {
    const res = await BiliBiliSearchApi.getSearchRequestByTypeLiveRoom(
      keyword,
      page,
      itemPerPage,
    );

    const platformData: PlatformData[] = [];

    let totalPage = 0;

    if (res.data?.v_voucher)
      throw new Error("搜索失败，接口被风控，请尝试在插件设置登录B站账号");

    if (res && res.code === 0 && res.data && res.data.result) {
      for (const item of res.data.result) {
        const data: PlatformData = {
          title: removeEmTagsUsingDOMParser(item.title),
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
};
