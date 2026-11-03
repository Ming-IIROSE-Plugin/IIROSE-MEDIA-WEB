// platformSearchSources.ts
//
// 平台检索的集中描述（CAP-3）：「平台 → 范围 → 取数动作」只写在这一份数据里。
// 视图层（`page/mainAppCategories`）负责把它映射成 `Platform`（title / shortTitle /
// sourceKey / subNavBarItems），自己不写任何取数逻辑。
// 注意：新增一个平台仍要照 `AGENTS.md` 补三处（platforms 类、Api 客户端、settings），
// 再在本表加一行；新增一个资源站/范围则只改这里。
//
// 取数动作不捕获宿主：每个范围只声明自己要哪一族入参（`ctx` / `page` / `refresh` /
// `desk`），视图层在用户点击的那一刻才把动作上下文、每页条数、刷新计数、宿站回调喂进来。

import { SendFetch } from "../Api";
import { AboutService } from "../page/MainAppContainerServices/AboutService";
import { AllVideosService } from "../page/MainAppContainerServices/AllVideoService";
import { BilibiliService } from "../page/MainAppContainerServices/BilibiliService";
import {
  FavoritesService,
  type FavoritePlatformFilter,
  type FavoriteRange,
} from "../page/MainAppContainerServices/FavoritesService";
import { NetEaseService } from "../page/MainAppContainerServices/NetEaseService";
import { RadioService } from "../page/MainAppContainerServices/RadioService";
import { RecentService } from "../page/MainAppContainerServices/RecentService";
import { SettingsService } from "../page/MainAppContainerServices/SettingsService";

/** 哔哩哔哩「推荐」的刷新计数：读一次拿数据、翻一次给下一次，读写都由调用点提供。 */
export interface SearchRefreshCounter {
  get(): number;
  increment(): void;
}

/** 设置 / 关于范围要的宿站回调：插件设置与关于卡直接转交给宿站组件。 */
export interface SearchDeskCallbacks {
  changeSearchKeyword: (keyword: string | null) => void;
  showOrHideIMC: () => Promise<void>;
}

/** 范围行的公共部分。 */
interface SearchRangeMeta {
  title: string;
  /** 宿站搜索列表的样式钩子（映射成 `class="search"`）。 */
  search?: boolean;
  /** 手机专属范围标签（设置里的「关于」）：桌面不渲染。 */
  phoneOnly?: boolean;
}

/**
 * 一个范围：键名就是视图层要喂的入参族——`ctx` 只要动作上下文；`page` 还带每页条数；
 * `refresh` 还带刷新计数；`desk` 还带宿站回调。动作只拿自己声明的那一族。
 */
export type PlatformSearchRange =
  | (SearchRangeMeta & {
      ctx: (ctx: MainAppContainerActionContext) => void;
    })
  | (SearchRangeMeta & {
      page: (ctx: MainAppContainerActionContext, pageSize: number) => void;
    })
  | (SearchRangeMeta & {
      refresh: (
        ctx: MainAppContainerActionContext,
        refresh: SearchRefreshCounter,
      ) => void;
    })
  | (SearchRangeMeta & {
      desk: (
        ctx: MainAppContainerActionContext,
        desk: SearchDeskCallbacks,
      ) => void;
    });

/** 一个来源（来源切换器上的一项）。 */
export interface PlatformSearchSource {
  title: string;
  /** 来源切换器里的简称（手机只显示简称）。 */
  shortTitle: string;
  /** 来源圆点令牌；缺省无圆点（如收藏模式的「全部」）。 */
  sourceKey?: Platform["sourceKey"];
  /** 页大小跟随「收藏」的设置；缺省按所在模式取。 */
  pageSizeOf?: "favorites";
  ranges: PlatformSearchRange[];
}

// --- 取数动作：只接收自己真正需要的入参 ---

/** 音乐「单曲」：关键词为空时列最近点播（只读本地历史，不出网）。 */
function loadNeteaseSong(ctx: MainAppContainerActionContext, pageSize: number) {
  if (!ctx.getState().searchKeyword.trim()) {
    RecentService.load(ctx, pageSize);
    return;
  }
  NetEaseService.searchMusic(ctx, pageSize);
}

/**
 * 多源剧集的一个采集站：代理前缀在点击时才拼（`SendFetch.cors` 与其余出网请求同一份，
 * 不在建表时定死）。
 */
function loadAllVideos(baseUrl: string) {
  return (ctx: MainAppContainerActionContext, pageSize: number) => {
    AllVideosService.searchAllVideos(
      ctx,
      `${SendFetch.cors}${baseUrl}`,
      pageSize,
    );
  };
}

/** 电台按地区取数（当前只登记日本一个地区）。 */
function loadRadio(area: string) {
  return (ctx: MainAppContainerActionContext, pageSize: number) => {
    RadioService.search(ctx, pageSize, area);
  };
}

/** 收藏的一个范围：来源过滤 + 范围（`collection` 合并歌单与专辑）交给存储层一次查。 */
function loadFavorites(platform: FavoritePlatformFilter, range: FavoriteRange) {
  return (ctx: MainAppContainerActionContext, pageSize: number) => {
    FavoritesService.loadFavorites(ctx, platform, range, pageSize);
  };
}

/**
 * 哔哩哔哩「推荐」：算法与刷新节奏都在 `BilibiliService` 里，这里只按原样把刷新计数
 * 接进它的上下文（`snbclickRecommand` 先读一次拿数据，再自增给下一次）。
 */
function loadBilibiliRecommend(
  ctx: MainAppContainerActionContext,
  refresh: SearchRefreshCounter,
) {
  BilibiliService.snbclickRecommand({
    ...ctx,
    getRefreshCount: () => refresh.get(),
    incrementRefreshCount: () => refresh.increment(),
  });
}

// --- 各模式的数据 ---

/** 0 音乐：网易云是唯一来源，范围为 单曲 / 专辑 / 歌单 / MV。 */
const neteaseSource: PlatformSearchSource = {
  title: "网易云音乐",
  shortTitle: "网易云",
  sourceKey: "netease",
  ranges: [
    { title: "单曲", search: true, page: loadNeteaseSong },
    {
      title: "专辑",
      search: true,
      page: (ctx, pageSize) => NetEaseService.searchAlbum(ctx, pageSize),
    },
    {
      title: "歌单",
      search: true,
      page: (ctx, pageSize) => NetEaseService.searchPlaylist(ctx, pageSize),
    },
    {
      title: "MV",
      search: true,
      page: (ctx, pageSize) => NetEaseService.searchMV(ctx, pageSize),
    },
  ],
};

/** 1 视频·哔哩哔哩：推荐（刷新计数驱动）与视频 / 直播检索。 */
const bilibiliSource: PlatformSearchSource = {
  title: "哔哩哔哩",
  shortTitle: "哔哩哔哩",
  sourceKey: "bilibili",
  ranges: [
    { title: "推荐", refresh: loadBilibiliRecommend },
    {
      title: "视频",
      search: true,
      page: (ctx, pageSize) =>
        BilibiliService.snbclickSearchVideo(ctx, pageSize),
    },
    {
      title: "直播",
      search: true,
      ctx: (ctx) => BilibiliService.snbclickSearchLive(ctx),
    },
  ],
};

/** 多源剧集的采集站：加一个资源站就是这里加一行。 */
const MULTI_VIDEO_SITES: { title: string; baseUrl: string }[] = [
  { title: "U库资源网", baseUrl: "https://api.ukuapi88.com" },
  { title: "非凡资源", baseUrl: "https://ffzy.tv" },
  { title: "最大资源网", baseUrl: "https://zuidazy.co" },
];

/** 1 视频·多源剧集：每个资源站一个范围。 */
const multiVideoSource: PlatformSearchSource = {
  title: "多源剧集",
  shortTitle: "多源",
  sourceKey: "multi",
  ranges: MULTI_VIDEO_SITES.map((site) => ({
    title: site.title,
    search: true,
    page: loadAllVideos(site.baseUrl),
  })),
};

/** 2 电台：沿用「无线电广播」平台，地区作范围。 */
const radioSource: PlatformSearchSource = {
  title: "电台",
  shortTitle: "电台",
  sourceKey: "radio",
  ranges: [{ title: "日本", search: true, page: loadRadio("japan") }],
};

/** 收藏的四个范围：`collection` 是「歌单与专辑」的合并范围（存储层按 types 一次查出两类）。 */
const FAVORITE_RANGES: { title: string; type: FavoriteRange }[] = [
  { title: "全部", type: "all" },
  { title: "单曲", type: "song" },
  { title: "歌单与专辑", type: "collection" },
  { title: "视频", type: "video" },
];

/** 收藏的一个来源：三个来源共用同一组四个范围，只是平台过滤不同。 */
function favoriteSource(
  platform: FavoritePlatformFilter,
  title: string,
  shortTitle: string,
  sourceKey?: Platform["sourceKey"],
): PlatformSearchSource {
  return {
    title,
    shortTitle,
    ...(sourceKey ? { sourceKey } : {}),
    pageSizeOf: "favorites",
    ranges: FAVORITE_RANGES.map((range) => ({
      title: range.title,
      search: true,
      page: loadFavorites(platform, range.type),
    })),
  };
}

/**
 * 4 设置：平台分组作范围标签，每个范围出一到两张组卡；「关于」只在手机上作为最后一个
 * 范围（桌面走独立关于模式）。
 */
const settingsSource: PlatformSearchSource = {
  title: "设置",
  shortTitle: "设置",
  ranges: [
    { title: "哔哩哔哩视频", ctx: (ctx) => SettingsService.showBilibili(ctx) },
    {
      title: "网易云音乐",
      ctx: (ctx) => SettingsService.showNetEaseMusic(ctx),
    },
    { title: "无线电广播", ctx: (ctx) => SettingsService.showRadio(ctx) },
    {
      title: "插件设置",
      desk: (ctx, desk) =>
        SettingsService.showPluginSettings(
          ctx,
          desk.changeSearchKeyword,
          desk.showOrHideIMC,
        ),
    },
    {
      title: "关于",
      phoneOnly: true,
      desk: (ctx, desk) => {
        // 离开「插件设置」的同步订阅：否则之后任何同步状态变化都会 refresh 出
        // 插件组卡，把关于卡顶掉（标签还停在「关于」）。
        SettingsService.release();
        AboutService.showAbout(ctx, desk.showOrHideIMC);
      },
    },
  ],
};

/** 5 关于（桌面独立模式；手机并入设置的最后一个范围）。 */
const aboutSource: PlatformSearchSource = {
  title: "关于这个插件",
  shortTitle: "关于",
  ranges: [
    {
      title: "关于",
      desk: (ctx, desk) => AboutService.showAbout(ctx, desk.showOrHideIMC),
    },
  ],
};

/**
 * 六种模式各自的来源与范围；**下标即模式下标**（`settings/deskModeCatalog`）。
 * 收藏那一行必须留在 `MODE.favorites` 的位置：它的每页条数按该行下标去问容器。
 */
export const PLATFORM_SEARCH_SOURCES: readonly (readonly PlatformSearchSource[])[] =
  [
    [neteaseSource],
    [bilibiliSource, multiVideoSource],
    [radioSource],
    [
      favoriteSource("all", "全部", "全部"),
      favoriteSource("netease", "网易云音乐", "网易云", "netease"),
      favoriteSource("bilibili", "哔哩哔哩", "B站", "bilibili"),
    ],
    [settingsSource],
    [aboutSource],
  ];
