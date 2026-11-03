import { BiliBiliCourseApi } from "../../Api/BilibiliAPI/bilibili-course/BiliBiliCourseApi";
import { BiliBiliVideoApi } from "../../Api/BilibiliAPI/BiliBiliVideoAPI";
import { reportFailure } from "../../tools/reportFailure";

export const multiPageBasics = async (
  pd: PlatformData,
  itemPerPage: number,
): Promise<{
  platformData: PlatformData[];
  allPlatformData: PlatformData[];
  totalPage: number;
}> => {
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

          if (allPlatformDatas.length >= itemPerPage) {
            allPlatformDatas.push(data);
          } else {
            allPlatformDatas.push(data);
            platformDatas.push(data);
          }
          count++;
        }
        const totalPage = Math.ceil(res.data.items.length / itemPerPage);
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

        if (allPlatformDatas.length >= itemPerPage) {
          allPlatformDatas.push(data);
        } else {
          allPlatformDatas.push(data);
          platformDatas.push(data);
        }
        count++;
      }

      const totalPage = Math.ceil(
        bilibiliVideoDetail.data.pages.length / itemPerPage,
      );
      return {
        platformData: platformDatas,
        allPlatformData: allPlatformDatas,
        totalPage: totalPage,
      };
    } else throw new Error("获取视频信息失败");
  } catch (error) {
    reportFailure(error);
    return { platformData: [], allPlatformData: [], totalPage: 0 };
  }
};

export const videoDetail = async (videoId: string) => {
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
    reportFailure(error);
    return null;
  }
};
