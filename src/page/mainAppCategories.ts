// mainAppCategories.ts
import { SendFetch } from "../Api";
import { BilibiliService } from "./MainAppContainerServices/BilibiliService";
import { AllVideosService } from "./MainAppContainerServices/AllVideoService";
import { AboutService } from "./MainAppContainerServices/AboutService";
import { SettingsService } from "./MainAppContainerServices/SettingsService";
import { NetEaseService } from "./MainAppContainerServices/NetEaseService";
import { RadioService } from "./MainAppContainerServices/RadioService";
import {
  FavoritesService,
  type FavoritePlatformFilter,
  type FavoriteRange,
} from "./MainAppContainerServices/FavoritesService";
import { RecentService } from "./MainAppContainerServices/RecentService";
import { MODE } from "./components/desk/deskModes";

/**
 * 分类表向容器要的那一口：表里的 `searchAction` 会在任意时刻被用户触发，
 * 所以一律当场去问（上下文、每页条数、刷新计数、宿主回调），不在建表时取值。
 */
export interface MainAppCategoriesHost {
  getActionContext(): MainAppContainerActionContext;
  pageSizeFor(mode: number): number;
  readonly itemsPerPage: number;
  /** 哔哩哔哩「推荐」的刷新计数（每次刷新自增）。 */
  bilibiliRefreshCount: number;
  /** 宿站回调：直接给 props 上的函数引用（调用点会比对同一性）。 */
  readonly changeSearchKeyword: (keyword: string | null) => void;
  readonly showOrHideIMC: () => Promise<void>;
}

/**
 * 收藏的一个来源：三个来源共用同一组四个范围，只是平台过滤不同。
 * 「歌单与专辑」是合并范围（存储层按 `types` 一次查出两类）。
 */
function favoriteSource(
  host: MainAppCategoriesHost,
  platform: FavoritePlatformFilter,
  title: string,
  shortTitle: string,
  sourceKey?: "netease" | "bilibili" | "multi",
): Platform {
  const ranges: { title: string; type: FavoriteRange }[] = [
    { title: "全部", type: "all" },
    { title: "单曲", type: "song" },
    { title: "歌单与专辑", type: "collection" },
    { title: "视频", type: "video" },
  ];
  return {
    title,
    shortTitle,
    ...(sourceKey ? { sourceKey } : {}),
    subNavBarItems: ranges.map((range) => ({
      title: range.title,
      class: "search",
      searchAction: () => {
        FavoritesService.loadFavorites(
          host.getActionContext(),
          platform,
          range.type,
          host.pageSizeFor(MODE.favorites),
        );
      },
    })),
  };
}

/** 六种模式各自的来源与范围；下标即模式下标。 */
export function createCategories(host: MainAppCategoriesHost): Categories[] {
  return [
    // 0 音乐：网易云是唯一来源，范围为 单曲 / 专辑 / 歌单 / MV
    {
      platform: [
        {
          title: "网易云音乐",
          shortTitle: "网易云",
          sourceKey: "netease",
          subNavBarItems: [
            {
              title: "单曲",
              class: "search",
              searchAction: () => {
                const ctx = host.getActionContext();
                // 首屏（关键词为空）列出「最近点播」，不发网络请求
                if (!ctx.getState().searchKeyword.trim()) {
                  RecentService.load(ctx, host.itemsPerPage);
                  return;
                }
                NetEaseService.searchMusic(ctx, host.itemsPerPage);
              },
            },
            {
              title: "专辑",
              class: "search",
              searchAction: () => {
                NetEaseService.searchAlbum(
                  host.getActionContext(),
                  host.itemsPerPage,
                );
              },
            },
            {
              title: "歌单",
              class: "search",
              searchAction: () => {
                NetEaseService.searchPlaylist(
                  host.getActionContext(),
                  host.itemsPerPage,
                );
              },
            },
            {
              title: "MV",
              class: "search",
              searchAction: () => {
                NetEaseService.searchMV(
                  host.getActionContext(),
                  host.itemsPerPage,
                );
              },
            },
          ],
        },
      ],
    },
    // 1 视频：哔哩哔哩（推荐/视频/直播）与多源剧集（各资源站为范围）
    {
      platform: [
        {
          title: "哔哩哔哩",
          shortTitle: "哔哩哔哩",
          sourceKey: "bilibili",
          subNavBarItems: [
            {
              title: "推荐",
              searchAction: () => {
                const ctx: BilibiliActionContext = {
                  ...host.getActionContext(),
                  getRefreshCount: () => host.bilibiliRefreshCount,
                  incrementRefreshCount: () => {
                    host.bilibiliRefreshCount++;
                  },
                };
                BilibiliService.snbclickRecommand(ctx);
              },
            },
            {
              title: "视频",
              class: "search",
              searchAction: () => {
                BilibiliService.snbclickSearchVideo(
                  host.getActionContext(),
                  host.itemsPerPage,
                );
              },
            },
            {
              title: "直播",
              class: "search",
              searchAction: () => {
                BilibiliService.snbclickSearchLive(host.getActionContext());
              },
            },
          ],
        },
        {
          title: "多源剧集",
          shortTitle: "多源",
          sourceKey: "multi",
          subNavBarItems: [
            {
              title: "U库资源网",
              class: "search",
              searchAction: () => {
                const baseUrl = `${SendFetch.cors}https://api.ukuapi88.com`;
                AllVideosService.searchAllVideos(
                  host.getActionContext(),
                  baseUrl,
                  host.itemsPerPage,
                );
              },
            },
            {
              title: "非凡资源",
              class: "search",
              searchAction: () => {
                const baseUrl = `${SendFetch.cors}https://ffzy.tv`;
                AllVideosService.searchAllVideos(
                  host.getActionContext(),
                  baseUrl,
                  host.itemsPerPage,
                );
              },
            },
            {
              title: "最大资源网",
              class: "search",
              searchAction: () => {
                const baseUrl = `${SendFetch.cors}https://zuidazy.co`;
                AllVideosService.searchAllVideos(
                  host.getActionContext(),
                  baseUrl,
                  host.itemsPerPage,
                );
              },
            },
          ],
        },
      ],
    },
    // 2 电台：沿用「无线电广播」平台，地区作范围
    {
      platform: [
        {
          title: "电台",
          shortTitle: "电台",
          sourceKey: "radio",
          subNavBarItems: [
            {
              title: "日本",
              class: "search",
              searchAction: () => {
                RadioService.search(
                  host.getActionContext(),
                  host.itemsPerPage,
                  "japan",
                );
              },
            },
          ],
        },
      ],
    },
    // 3 收藏：三来源（全部 / 网易云 / B站）× 四范围（含「歌单与专辑」合并范围）
    {
      platform: [
        favoriteSource(host, "all", "全部", "全部"),
        favoriteSource(host, "netease", "网易云音乐", "网易云", "netease"),
        favoriteSource(host, "bilibili", "哔哩哔哩", "B站", "bilibili"),
      ],
    },
    // 4 设置：平台分组作范围标签（哔哩哔哩视频 / 网易云音乐 / 无线电广播 / 插件设置），
    // 每个范围出一到两张组卡；「关于」只在手机上作为最后一个范围（桌面走独立关于模式）。
    {
      platform: [
        {
          title: "设置",
          shortTitle: "设置",
          subNavBarItems: [
            {
              title: "哔哩哔哩视频",
              searchAction: () => {
                SettingsService.showBilibili(host.getActionContext());
              },
            },
            {
              title: "网易云音乐",
              searchAction: () => {
                SettingsService.showNetEaseMusic(host.getActionContext());
              },
            },
            {
              title: "无线电广播",
              searchAction: () => {
                SettingsService.showRadio(host.getActionContext());
              },
            },
            {
              title: "插件设置",
              searchAction: () => {
                SettingsService.showPluginSettings(
                  host.getActionContext(),
                  host.changeSearchKeyword,
                  host.showOrHideIMC,
                );
              },
            },
            {
              title: "关于",
              phoneOnly: true,
              searchAction: () => {
                // 离开「插件设置」的同步订阅：否则之后任何同步状态变化都会
                // refresh 出插件组卡，把关于卡顶掉（标签还停在「关于」）
                SettingsService.release();
                AboutService.showAbout(
                  host.getActionContext(),
                  host.showOrHideIMC,
                );
              },
            },
          ],
        },
      ],
    },
    // 5 关于（桌面独立模式；手机并入设置的最后一个范围）
    {
      platform: [
        {
          title: "关于这个插件",
          shortTitle: "关于",
          subNavBarItems: [
            {
              title: "关于",
              searchAction: () => {
                AboutService.showAbout(
                  host.getActionContext(),
                  host.showOrHideIMC,
                );
              },
            },
          ],
        },
      ],
    },
  ];
}
