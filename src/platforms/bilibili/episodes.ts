import { BiliBiliCourseApi } from "../../Api/BilibiliAPI/bilibili-course/BiliBiliCourseApi";
import { BiliBiliVideoApi } from "../../Api/BilibiliAPI/BiliBiliVideoAPI";
import { openEpisodePicker, type EpisodePickEntry } from "../episodePickerPort";
import { ShowMessage } from "../../iirose_func/ShowMessage";
import { reportFailure } from "../../tools/reportFailure";
import { Announce } from "../../iirose_func/Socket/Announce";
import { BiliBiliSettings } from "../../settings/bilibiliSettings/BiliBiliSettings";
import type { AutoPlayOptions } from "../Platform";
import { getDashUrlAndQn, type SendMediaFn } from "./playback";
import type { BiliPage } from "./shared";

/** 播放指定分 P（平台层 `playBiliPage`）：由平台层传入，测试仍可替换。 */
export type PlayPageFn = (
  basePlatformData: PlatformData,
  pageItem: BiliPage,
  aid?: number,
  bvid?: string,
  options?: AutoPlayOptions,
) => Promise<void>;

/** 开插件自有选集面板（平台层 `selectEpisodes`）。 */
export type SelectEpisodesFn = (
  platformData: PlatformData,
  preloaded?: { pages: BiliPage[]; description?: string | null },
) => void;

/** 点播入口用到的平台成员：VOD 的每个发送点都走平台层，不直接调模块实现。 */
export interface VodDeps {
  playBiliPage: PlayPageFn;
  prepareAndSendMedia: SendMediaFn;
  selectEpisodes: SelectEpisodesFn;
}

/**
 * Bilibili 点播逻辑
 * 支持指定 targetP 直达、多分 P 选集多选与正序/乱序二次流转
 */
export const vod = async (
  deps: VodDeps,
  platformData: PlatformData,
  targetP?: number,
  options?: AutoPlayOptions,
) => {
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
          const { playurl, qn } = await getDashUrlAndQn(res.data.dash);
          const timelength = res.data.timelength || 0;
          // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
          await Announce.runSingleAnnounce(() =>
            deps.prepareAndSendMedia(
              platformData,
              playurl,
              timelength,
              qn,
              // 课程分支排在 targetP 之前，必须自己把 cardless 传下去，
              // 否则收藏随机抽到「B站-课程」收藏时仍会发卡（复盘 B1）
              options,
            ),
          );
          return;
        }
      }
      throw new Error("获取课程播放流失败");
    }

    // 2. 普通视频：获取视频数据与分 P 列表
    let pages: BiliPage[] = [];
    const res = await BiliBiliVideoApi.getBilibiliVideoData(aid || null, bvid);
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
          deps.playBiliPage(platformData, targetPage, aid, bvid, options),
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
        deps.playBiliPage(platformData, singlePage, aid, bvid, options),
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
      deps.selectEpisodes(platformData, {
        pages,
        description: res?.data?.desc,
      });
      return;
    }

    // 6. 单集视频直接播放
    if (pages.length > 0) {
      // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
      await Announce.runSingleAnnounce(() =>
        deps.playBiliPage(
          platformData,
          { ...pages[0], part: platformData.title },
          aid,
          bvid,
          options,
        ),
      );
    } else {
      throw new Error("无法获取视频信息");
    }
  } catch (error) {
    console.error("[VOD Error]:", error);
    reportFailure(error);
  }
};

/**
 * 多分 P 选集（CAP-8）：插件自有选集面板，点选顺序 = 播放顺序。
 * `VOD` 已拿到 `pages` 时直接传入；只有条目本身时（如收藏点播）由面板的 `load` 现取。
 */
export const selectEpisodes = (
  /** 确认那一刻再取：类成员被替换（spy / 热更新）时仍能生效。 */
  getPlayPage: () => PlayPageFn,
  platformData: PlatformData,
  preloaded?: { pages: BiliPage[]; description?: string | null },
) => {
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
      const playBiliPage = getPlayPage();
      // 按面板给的顺序回填分 P：点选顺序即播放顺序（乱序已在面板里置换）
      const picked = chosen
        .map((entry) => pages.find((item) => String(item.page) === entry.id))
        .filter((item): item is BiliPage => Boolean(item));
      if (!picked.length) return;
      const label = (item: BiliPage) => `P${item.page} ${item.part}`;

      if (picked.length === 1) {
        // 单项：单曲播报窗口，卡片不被并行批量抑制吞掉
        void Announce.runSingleAnnounce(() =>
          playBiliPage(platformData, picked[0], aid, bvid),
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
              await playBiliPage(platformData, item, aid, bvid);
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
};
