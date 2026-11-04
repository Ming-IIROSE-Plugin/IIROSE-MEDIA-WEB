// mainAppContainerController.ts
import { setPanelFocus } from "../playback/PanelFocus";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import { BilibiliPlatform } from "../platforms/BilibiliPlatform";
import { NetEasePlatform } from "../platforms/NetEasePlatform";
import { isCollectionItem } from "./components/media-card-container/mediaFormat";
import { MODE } from "./components/desk/deskModes";
import { detectVideoTarget } from "./components/desk/searchIntent";
import {
  InnerPageService,
  type InnerPageHost,
} from "./MainAppContainerServices/InnerPageService";
import { SelectionService } from "./MainAppContainerServices/SelectionService";

/** 容器的动作字典：视图与各服务按名字取用，方法之间也互相调用。 */
export interface MainAppController {
  /** 提交搜索：粘贴或输入的视频链接先切到视频模式再提交。 */
  submitSearch(text: string): void;
  /** 真正发起检索：页码归 1、清结果，再交给当前范围的动作。 */
  runSearch(
    text: string,
    options?: { propagate?: boolean; reloadEmpty?: boolean },
  ): void;
  /** 输入即过滤（收藏 / 电台）：只改关键词与页码，不清结果、不出网。 */
  filterLive(text: string): void;
  /** 切换来源：页码归 1、回到第一个范围。 */
  selectSource(index: number): void;
  /** 切换范围：页码归 1、按当前关键词重取。 */
  selectScope(index: number): void;
  /** 切换搜索结果视图（列表/网格），并持久化。 */
  toggleSearchViewMode(): void;
  /** 更新目前的页面。 */
  changecurrentPage(page: number): Promise<void>;
  /** 更新目前是否在多集页面里面。 */
  updateCurrentInMultiPageStatus(status: boolean): void;
  /** 切换到多集页面（专辑 / 歌单内页与多 P / 多集列表共用）。 */
  switchToMultiPage(
    platformData: PlatformData,
    _isCurrentInMultiPage?: boolean,
  ): Promise<void>;
  /** 退出多集页面。 */
  switchToOutFromMultiPage(): void;
  pushAllData(
    currentRequestToken: number,
    allPlatformData: PlatformData[] | undefined,
    totalPage: number,
  ): void;
}

/**
 * 动作字典向容器要的那一口：字典不持有 state、也不直接调 `setState`，
 * 一律经 `mergeState` 落地；内页的票号、来源条目与分段加载器仍归容器。
 */
export interface MainAppControllerHost {
  readonly state: MainAppContainerState;
  /** 合并一段现场到 state（可选回调在落地后执行）。 */
  mergeState(
    patch: Partial<MainAppContainerState>,
    callback?: () => void,
  ): void;
  readonly props: MainAppContainerProps;
  /** 每页条数（音乐 / 视频等固定 10；收藏按设置走的是 `pageSizeFor`）。 */
  /** 每页条数：容器按模式/收藏设置给出，这里的值可能随设置变化，不要当常量缓存。 */
  itemsPerPage: number;
  /** 切模式时待提交的关键词（粘贴视频链接要先切到视频模式）。 */
  pendingSearch: string | null;
  /** 内页的来源条目：重试时按它重新载入内页。 */
  innerPageSource: PlatformData | null;
  /**
   * 多 P / 多集内页的载入票号，与 `dropSegments` 的分段票号同源同义：进新内页、
   * 返回外层时自增，迟到的分 P 列表结果不再改写 `totalPage` / `allMediaData`。
   */
  multiPageTicket: number;
  /** 离开（或换掉）当前内页：中止未完成的段请求，迟到结果不再落地。 */
  dropSegments(): void;
  /** 内页加载服务的现场读写口。 */
  innerPageHost(): InnerPageHost;
  /** 当前模式当前来源。 */
  currentPlatform(): Platform | undefined;
  /** 执行当前范围的动作（搜索/筛选/读取设置）。 */
  runCurrentScope(): void;
  /** 动作字典本身（方法之间互相调用）。 */
  readonly controller: MainAppController;
}

export function createController(
  host: MainAppControllerHost,
): MainAppController {
  return {
    /**
     * @description 提交搜索：粘贴或输入的视频链接先切到视频模式再提交
     */
    submitSearch: (text: string) => {
      const keyword = text.trim();
      // 空提交不发起检索（沿用旧搜索栏：清空后提交无动作）
      if (!keyword) return;
      const video = detectVideoTarget(keyword);
      if (video && host.state.mode !== MODE.video) {
        host.pendingSearch = video;
        host.props.switchMode(MODE.video);
        return;
      }
      host.controller.runSearch(video ?? keyword);
    },

    /**
     * 真正发起检索：页码归 1、清结果，再交给当前范围的动作。
     * 空的检索只重置现场、不发请求；`reloadEmpty` 用于「清除搜索」——本地过滤的范围
     * （收藏 / 电台）要按清空后的关键词重取一遍。
     */
    runSearch: (
      text: string,
      options?: { propagate?: boolean; reloadEmpty?: boolean },
    ) => {
      const keyword = text.trim();
      host.innerPageSource = null;
      host.dropSegments();
      // 浏览型范围（视频的「推荐」）不承接关键词：有词时自动落到第一个可搜索的范围
      const platform = host.currentPlatform();
      let scope = host.state.SubNavBarIndex;
      if (keyword && platform?.subNavBarItems[scope]?.class !== "search") {
        const first = platform?.subNavBarItems.findIndex(
          (item) => item.class === "search",
        );
        if (first !== undefined && first >= 0) scope = first;
      }
      const nextAction =
        platform?.subNavBarItems[scope]?.searchAction ??
        host.state.currentSubNavBarAction;
      host.mergeState(
        {
          SubNavBarIndex: scope,
          searchKeyword: keyword,
          currentPage: 1,
          // 电台是本地过滤：保留已加载的列表（与总页数），RadioService 按新关键词
          // 切片，不再出网
          totalPage: host.state.mode === MODE.radio ? host.state.totalPage : 0,
          allMediaData:
            host.state.mode === MODE.radio ? host.state.allMediaData : [],
          mediaData: null,
          isCurrentInMultiPage: false,
          oldItems: null,
          innerCollection: null,
          collectionSegments: null,
          innerSelection: SelectionService.clear(),
          updating: false,
          currentSubNavBarAction: nextAction,
        },
        () => {
          if (keyword || options?.reloadEmpty) host.runCurrentScope();
          if (options?.propagate !== false)
            host.props.changeSearchKeyword(keyword);
        },
      );
    },

    /**
     * 输入即过滤（收藏 / 电台）：只改关键词与页码，不清已渲染结果、不发网络请求。
     * 与 `runSearch` 分开：后者会清 `mediaData`，逐字提交会每键闪一次骨架。
     * 关键词保留原始输入（trim 交给 FavoritesService / RadioService）：受控回写不会
     * 吞掉刚敲的空格，也不会把光标移到末尾。
     */
    filterLive: (text: string) => {
      if (text === host.state.searchKeyword) return;
      // 内页（专辑 / 歌单）开着时先按「返回」回到外层：恢复外层快照、中止分段请求、清空勾选。
      // 否则收藏查询会被 `isCurrentInMultiPage` 挡掉，内页继续显示第 N 页的行而页头写 01 / N，
      // 勾选徽标 / 复选框按错页的绝对位置落点（点一行的框会删掉另一页的勾选）。
      if (host.state.isCurrentInMultiPage)
        host.controller.switchToOutFromMultiPage();
      host.mergeState({ searchKeyword: text, currentPage: 1 }, () =>
        host.runCurrentScope(),
      );
    },

    /** 切换来源：页码归 1、回到第一个范围。 */
    selectSource: (index: number) => {
      host.innerPageSource = null;
      host.dropSegments();
      setPanelFocus({ category: host.state.mode, platform: index });
      host.mergeState(
        {
          PlatformIndex: index,
          SubNavBarIndex: 0,
          currentPage: 1,
          totalPage: 0,
          allMediaData: [],
          mediaData: null,
          isCurrentInMultiPage: false,
          oldItems: null,
          innerCollection: null,
          collectionSegments: null,
          innerSelection: SelectionService.clear(),
          updating: false,
        },
        () => host.runCurrentScope(),
      );
    },

    /** 切换范围：页码归 1、滚到顶部，按当前关键词重取。 */
    selectScope: (index: number) => {
      host.innerPageSource = null;
      host.dropSegments();
      host.mergeState(
        {
          SubNavBarIndex: index,
          currentPage: 1,
          totalPage: 0,
          allMediaData: [],
          mediaData: null,
          isCurrentInMultiPage: false,
          oldItems: null,
          innerCollection: null,
          collectionSegments: null,
          innerSelection: SelectionService.clear(),
          updating: false,
        },
        () => host.runCurrentScope(),
      );
    },

    /**
     * @description 切换搜索结果视图（列表/网格），并持久化到 localStorage
     */
    toggleSearchViewMode: () => {
      const searchViewMode = PluginSettings.toggleSearchViewMode();
      host.mergeState({ searchViewMode });
    },

    /**
     * @description 更新目前的页面
     */
    changecurrentPage: async (page: number) => {
      const {
        updating,
        isCurrentInMultiPage,
        allMediaData,
        totalPage,
        collectionSegments,
      } = host.state;

      if (isCurrentInMultiPage) {
        const safePage = Math.min(Math.max(1, page), totalPage || 1);
        // 歌单 / 专辑：只在越过已取范围时取对应段
        if (collectionSegments) {
          const data = collectionSegments
            .loadPage(safePage, host.itemsPerPage)
            .then((platformData) => ({ platformData, totalPage }));
          // 失败交给结果区的「加载失败 / 重试」；换页后被丢弃的旧页不算未处理
          data.catch(() => {});
          await host.mergeState({ currentPage: safePage, mediaData: data });
          return;
        }
        const startIndex = (safePage - 1) * host.itemsPerPage;
        const endIndex = Math.min(
          startIndex + host.itemsPerPage,
          allMediaData.length,
        );
        const currentPageData = allMediaData.slice(startIndex, endIndex);

        await host.mergeState({
          currentPage: safePage,
          mediaData: Promise.resolve({
            platformData: currentPageData,
            totalPage: totalPage,
          }),
        });
        return;
      }

      if (updating) return;
      await host.mergeState({ currentPage: Math.max(1, page) });
      host.runCurrentScope();
    },

    /**
     * @description 更新目前是否在多集页面里面
     */
    updateCurrentInMultiPageStatus: (status: boolean) => {
      host.mergeState({ isCurrentInMultiPage: status });
    },

    /**
     * @description 切换到多集页面（专辑 / 歌单内页与多 P / 多集列表共用）
     */
    switchToMultiPage: async (
      platformData: PlatformData,
      _isCurrentInMultiPage?: boolean,
    ) => {
      // 记住来源条目：内页加载失败时「重试」按它重载内页
      host.innerPageSource = platformData;
      // 多 P / 多集与专辑 / 歌单共用这层票号：换内页后旧结果作废
      const ticket = ++host.multiPageTicket;
      // 专辑 / 歌单的内页头（名称 + 曲目数 + 全部播放）；多 P / 多集仍用范围行
      const isCollection = isCollectionItem(platformData);
      // 换掉上一个内页：它未完成的段请求中止，迟到的详情丢弃
      host.dropSegments();
      host.mergeState({
        innerCollection: isCollection ? platformData : null,
        collectionSegments: null,
        innerSelection: SelectionService.clear(),
      });

      if (platformData.bilibili) {
        const data = BilibiliPlatform.getMultiPageBasicsData(platformData);
        const vod = BilibiliPlatform.VOD;
        host.mergeState({ currentPage: 1, totalPage: 0, allMediaData: [] });
        host.mergeState({ mediaData: data });
        host.mergeState({ currentOnDemandPlay: vod });
        data.then((res) => {
          // 迟到结果：已换进别的内页或已返回外层（`isCurrentInMultiPage` 可能被下一个内页重新置真）
          if (ticket !== host.multiPageTicket) return;
          if (!host.state.isCurrentInMultiPage) return;
          if (!res) return;
          host.mergeState({ totalPage: res.totalPage });
          if (res.allPlatformData) {
            host.mergeState({ allMediaData: res.allPlatformData });
          }
        });
      } else if (
        platformData.neteaseMusic?.isSongList ||
        platformData.neteaseMusic?.isAlbum
      ) {
        // 只取歌单（专辑）详情得到完整 id 列表，首屏再取第 1 段
        const { mediaData } = InnerPageService.load(
          host.innerPageHost(),
          platformData,
        );
        host.mergeState({ currentPage: 1, totalPage: 0, allMediaData: [] });
        host.mergeState({ mediaData });
        host.mergeState({ currentOnDemandPlay: NetEasePlatform.MOD });
      }
    },

    /**
     * @description 退出多集页面
     */
    switchToOutFromMultiPage: () => {
      const oldItems = host.state.oldItems;
      // 收尾先做：外层现场还没落地这一帧（内页已可见但 `oldItems` 尚未提交）按返回 / Esc
      // 退不回去，但分段请求与勾选必须照样停下来，不能挂在后台继续取段。
      host.innerPageSource = null;
      // 离开内页：飞行中的分 P 列表结果作废
      host.multiPageTicket += 1;
      host.dropSegments();
      host.mergeState({
        collectionSegments: null,
        innerSelection: SelectionService.clear(),
      });
      if (!oldItems) return;
      host.mergeState({ oldItems: null });
      host.mergeState({ mediaData: oldItems.mediaData });
      host.mergeState({ allMediaData: oldItems.allMediaData });
      host.mergeState({ totalPage: oldItems.totalPage });
      host.mergeState({ currentPage: oldItems.currentPage });
      host.mergeState({ isCurrentInMultiPage: false });
      host.mergeState({ innerCollection: null });
      host.mergeState({ currentSubNavBarAction: oldItems.SubNavBarAction });
      host.mergeState({ currentOnDemandPlay: oldItems.OnDemandPlay });
    },

    pushAllData: (
      currentRequestToken: number,
      allPlatformData: PlatformData[] | undefined,
      totalPage: number,
    ) => {
      if (host.state.requestToken !== currentRequestToken) return;
      if (!allPlatformData) return;
      host.mergeState({
        allMediaData: [...host.state.allMediaData, ...allPlatformData],
        totalPage,
        updating: false,
      });
    },
  };
}
