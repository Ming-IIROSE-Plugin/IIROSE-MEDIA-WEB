import { setPanelFocus } from "../playback/PanelFocus";
import { Component, createRef } from "preact";
import { ResultsArea } from "./components/media-card-container/ResultsArea";
import { CollectionHeader } from "./components/media-card-container/CollectionHeader";
import type { PlayOrder } from "./components/media-card-container/OrderMenu";
import { BilibiliPlatform } from "../platforms/BilibiliPlatform";
import { NetEasePlatform } from "../platforms/NetEasePlatform";
import { AllVideosPlatform } from "../platforms/AllVideosPlatform";
import { SendFetch } from "../Api";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import {
  MediaContainerContext,
  Provider,
} from "./components/media-container-context/MediaContainerContext";
import { BilibiliService } from "./MainAppContainerServices/BilibiliService";
import { AllVideosService } from "./MainAppContainerServices/AllVideoService";
import { AboutService } from "./MainAppContainerServices/AboutService";
import { SettingsService } from "./MainAppContainerServices/SettingsService";
import { NetEaseService } from "./MainAppContainerServices/NetEaseService";
import { MediaContainerGesture } from "./MainAppContainerServices/MediaContainerGesture";
import { RadioService } from "./MainAppContainerServices/RadioService";
import { FavoritesService } from "./MainAppContainerServices/FavoritesService";
import { FavoritesStorageService } from "../storage/FavoritesStorageService";
import { SyncManager } from "../sync/SyncManager";
import { PageHeader } from "./components/desk/PageHeader";
import { SearchBar, type SearchSource } from "./components/desk/SearchBar";
import { ScopeRow, type ScopeItem } from "./components/desk/ScopeRow";
import { detectVideoTarget } from "./components/desk/searchIntent";
import {
  MODE,
  hasPager,
  hasScopeRow,
  hasSearchBar,
  modeTitle,
  normalizeMode,
} from "./components/desk/deskModes";
import { deskInk, deskPaper } from "./components/floating-panel/tokens";

type ModeMediaData = Promise<{
  platformData: PlatformData[];
  totalPage: number;
}> | null;

/** 一个模式的全部现场：切走时快照、切回时原样恢复（关键词、范围、页码、结果）。 */
interface ModeSnapshot {
  searchKeyword: string;
  PlatformIndex: number;
  SubNavBarIndex: number;
  currentPage: number;
  totalPage: number;
  mediaData: ModeMediaData;
  allMediaData: PlatformData[];
  isCurrentInMultiPage: boolean;
  oldItems: OldItems | null;
  innerCollection: PlatformData | null;
  settingsData: SettingData[] | null;
  currentSubNavBarAction: () => void;
  currentOnDemandPlay: (platformData: PlatformData) => void;
}

/** 空现场的字段（不取自任何模式）。 */
function emptyModeState(): ModeSnapshot {
  return {
    searchKeyword: "",
    PlatformIndex: 0,
    SubNavBarIndex: 0,
    currentPage: 1,
    totalPage: 0,
    mediaData: null,
    allMediaData: [],
    isCurrentInMultiPage: false,
    oldItems: null,
    innerCollection: null,
    settingsData: null,
    currentSubNavBarAction: () => {},
    currentOnDemandPlay: () => {},
  };
}

/** 手机（≤768px，宿站 iframe 缩放后仍按 `max-[768px]` 判定）：不自动聚焦搜索栏。 */
function isPhone(): boolean {
  return window.matchMedia?.("(max-width: 768px)").matches ?? false;
}

export class MainAppContainer extends Component<
  MainAppContainerProps,
  MainAppContainerState
> {
  static contextType = MediaContainerContext;
  private itemsPerPage = 10;
  bilibiliRefreshCount = 1;
  mediaContainerGesture = new MediaContainerGesture(this.props.ShowOrHideIMC);

  /** 切模式时待提交的关键词（粘贴视频链接要先切到视频模式）。 */
  private pendingSearch: string | null = null;
  /** 内页的来源条目：重试时按它重新载入内页。 */
  private innerPageSource: PlatformData | null = null;
  /** 各模式现场快照；没有 = 该模式首次进入。 */
  private snapshots = new Map<number, ModeSnapshot>();
  private searchBarRef = createRef<SearchBar>();

  constructor(props: MainAppContainerProps) {
    super(props);
    const mode = normalizeMode(props.mode);
    this.state = {
      mode,
      ...emptyModeState(),
      updating: false,
      requestToken: 0,
      searchViewMode:
        PluginSettings.getPluginSetting().searchViewMode || "card",
    };
  }

  componentDidMount() {
    setPanelFocus({
      category: this.state.mode,
      platform: this.state.PlatformIndex,
    });
    FavoritesStorageService.init();
    // 云端拉取落地后刷新已渲染的收藏列表（外部变更通知，不会反向触发上传）
    FavoritesStorageService.onExternalChange(() => {
      if (this.state.mode !== MODE.favorites) return;
      void FavoritesService.reloadLastQuery(this.getActionContext());
    });
    void SyncManager.init();
    if (this.props.active && !isPhone()) this.searchBarRef.current?.focus();
    // 内页（专辑/歌单）里按 Esc 先返回外层结果，再按一次才关面板（story 4 统一为层级栈）
    document.addEventListener("keydown", this.handleInnerPageEscape, true);
    // 首个模式的首个范围：与旧四行顶栏挂载时自执行首项一致
    this.runCurrentScope();
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleInnerPageEscape, true);
  }

  componentDidUpdate(prevProps: Readonly<MainAppContainerProps>): void {
    // 面板打开：桌面把焦点放进搜索栏（手机不聚焦）
    if (!prevProps.active && this.props.active && !isPhone())
      this.searchBarRef.current?.focus();

    // 切模式：先快照当前现场，再恢复目标模式的现场
    if (prevProps.mode !== this.props.mode) {
      this.applyMode(normalizeMode(this.props.mode));
      return;
    }

    // 全局搜索词（聊天框 `@` 点歌、外部调用）：切到能承接它的模式再提交
    if (prevProps.searchKeyword !== this.props.searchKeyword) {
      const keyword = (this.props.searchKeyword || "").trim();
      if (keyword && keyword !== this.state.searchKeyword)
        this.handleExternalKeyword(keyword);
      else if (!keyword && this.state.searchKeyword)
        this.controller.runSearch("", { propagate: false });
    }

    // 进入专辑/歌单/多集内页时保存外层现场（`‹ 返回` 用）
    if (this.state.isCurrentInMultiPage && !this.state.oldItems) {
      this.setState({
        oldItems: {
          mediaData: this.state.mediaData,
          allMediaData: this.state.allMediaData,
          totalPage: this.state.totalPage,
          currentPage: this.state.currentPage,
          SubNavBarAction: this.state.currentSubNavBarAction,
          OnDemandPlay: this.state.currentOnDemandPlay,
        },
      });
    }
  }

  /**
   * 内页的 `Esc`：顺序菜单自己关（它先接管并阻止冒泡），否则回到外层结果。
   * story 4 会把这里换成统一的逐层关闭（捕获阶段 + 层级栈）。
   */
  private handleInnerPageEscape = (event: KeyboardEvent) => {
    if (!this.props.active) return;
    if (event.key !== "Escape") return;
    if (document.querySelector("[data-imw-order-menu]")) return;
    if (!this.state.isCurrentInMultiPage) return;
    this.controller.switchToOutFromMultiPage();
    event.stopPropagation();
  };

  /** 手机操作条的挂点：story 4 在这里打开操作条，本 story 只保证行体点击有落点。 */
  private handleRowActivate = (_platformData: PlatformData) => {};

  /** 重试：内页重载内页，否则重发当前范围。 */
  private handleRetry = () => {
    const source = this.innerPageSource ?? this.state.innerCollection;
    if (this.state.isCurrentInMultiPage && source) {
      void this.controller.switchToMultiPage(source);
      return;
    }
    this.runCurrentScope();
  };

  /** 收藏 / 电台过滤无结果时的「清除搜索」：清空关键词后按当前范围重取（回到全量）。 */
  private handleClearSearch = () => {
    this.controller.runSearch("", { reloadEmpty: true });
  };

  /** 内页头「全部播放」：按所选顺序批量点播整张（不走宿站 `buildSelect2`）。 */
  private playCollectionAll = (order: PlayOrder) => {
    const collection = this.state.innerCollection;
    if (!collection) return;
    void NetEasePlatform.playCollectionAll(collection, order);
  };

  render() {
    const { ShowOrHideIMC } = this.props;
    const {
      mode,
      PlatformIndex,
      SubNavBarIndex,
      mediaData,
      settingsData,
      searchKeyword,
      currentPage,
      totalPage,
      searchViewMode,
      currentOnDemandPlay,
    } = this.state;

    const categories = this.getActiveCategories();
    const platform = this.currentPlatform();
    const scopes: ScopeItem[] = (platform?.subNavBarItems ?? []).map(
      (item) => ({ title: item.title }),
    );
    const sources: SearchSource[] = categories.platform.map((item) => ({
      label: item.title,
      short: item.shortTitle ?? item.title,
      dot: item.sourceKey ?? null,
    }));

    const providerValue = {
      switchToMultiPage: this.controller.switchToMultiPage,
      switchToOutFromMultiPage: this.controller.switchToOutFromMultiPage,
      currentOnDemandPlay,
      updateCurrentInMultiPageStatus:
        this.controller.updateCurrentInMultiPageStatus,
      onRowActivate: this.handleRowActivate,
      ShowOrHideIMC,
    };

    const innerCollection = this.state.innerCollection;
    const showCollectionHeader =
      !!innerCollection && this.state.isCurrentInMultiPage;

    return (
      <Provider value={providerValue}>
        <div
          className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
          onTouchStart={(e) =>
            this.mediaContainerGesture.handleStart(
              e,
              currentPage,
              totalPage,
              this.controller.changecurrentPage,
            )
          }
          onMouseDown={(e) =>
            this.mediaContainerGesture.handleStart(
              e,
              currentPage,
              totalPage,
              this.controller.changecurrentPage,
            )
          }
        >
          <div
            className={`flex min-h-0 flex-1 flex-col ${deskPaper} ${deskInk}`}
          >
            <PageHeader title={modeTitle(mode)} onClose={ShowOrHideIMC} />

            {hasSearchBar(mode) && (
              <SearchBar
                ref={this.searchBarRef}
                keyword={searchKeyword}
                placeholder={this.placeholderFor(mode)}
                placeholderPhone={this.placeholderPhoneFor(mode)}
                sources={sources}
                sourceIndex={PlatformIndex}
                onSelectSource={this.controller.selectSource}
                onSubmit={this.controller.submitSearch}
              />
            )}

            {showCollectionHeader ? (
              <CollectionHeader
                title={innerCollection.title}
                trackCount={innerCollection.trackCount}
                currentPage={currentPage}
                totalPage={totalPage}
                onPageChange={this.controller.changecurrentPage}
                onBack={this.controller.switchToOutFromMultiPage}
                onPlayAll={this.playCollectionAll}
              />
            ) : (
              hasScopeRow(mode) &&
              scopes.length > 0 && (
                <ScopeRow
                  items={scopes}
                  activeIndex={SubNavBarIndex}
                  onChange={this.controller.selectScope}
                  viewMode={this.viewToggleMode()}
                  onToggleView={this.controller.toggleSearchViewMode}
                  currentPage={currentPage}
                  totalPage={totalPage}
                  showPager={hasPager(mode)}
                  onPageChange={this.controller.changecurrentPage}
                  label={mode === MODE.radio ? "地区" : "范围"}
                />
              )
            )}

            <div className="relative min-h-0 flex-1">
              {/* 每个模式一个实例：切模式重挂载，避免跨模式残留的列表数据与滚动位置 */}
              <ResultsArea
                key={mode}
                mediaData={mediaData}
                settingsData={settingsData}
                viewMode={searchViewMode}
                mode={mode}
                scopeIndex={SubNavBarIndex}
                keyword={searchKeyword}
                isInnerPage={this.state.isCurrentInMultiPage}
                onRetry={this.handleRetry}
                onClearSearch={this.handleClearSearch}
              />
            </div>

            {/* 底部条 / 迷你条占位：story 3 的挂载点，本 story 不渲染内容 */}
            <div
              id="imw-desk-room-deck"
              className="shrink-0 max-[768px]:hidden"
            />
            <div
              id="imw-desk-mini-deck"
              className="hidden shrink-0 max-[768px]:block"
            />
          </div>
        </div>
      </Provider>
    );
  }

  private placeholderFor(mode: number): string {
    switch (mode) {
      case MODE.video:
        return "搜索视频、UP 主，或粘贴 BV 号";
      case MODE.radio:
        return "过滤电台名";
      case MODE.favorites:
        return "过滤收藏";
      default:
        return "搜索歌名或歌手";
    }
  }

  /** 手机占位更短（手机搜索栏只留来源简称 + 输入区）。 */
  private placeholderPhoneFor(mode: number): string | undefined {
    return mode === MODE.video ? "搜索或粘贴 BV 号" : undefined;
  }

  /**
   * 视图切换只在「该范围有两种视图」时出现：
   * 音乐的单曲范围可切列表/网格；专辑、歌单只有列表，MV 只有网格；
   * 视频的推荐/视频/直播两种视图都在（收藏只有列表，多源剧集只有列表）。
   */
  private viewToggleMode(): "card" | "list" | null {
    if (this.state.mode === MODE.video) {
      return this.currentPlatform()?.shortTitle === "多源"
        ? null
        : this.state.searchViewMode;
    }
    if (this.state.mode !== MODE.music || this.state.SubNavBarIndex !== 0)
      return null;
    return this.state.searchViewMode;
  }

  /** 当前模式的下标 → 分类表。 */
  private getActiveCategories(mode?: number): Categories {
    const index = mode ?? this.state.mode;
    return this.categories[index] || this.categories[0];
  }

  private currentPlatform(): Platform | undefined {
    const categories = this.getActiveCategories();
    return (
      categories.platform[this.state.PlatformIndex] ?? categories.platform[0]
    );
  }

  /** 当前模式空现场的默认值：第一个来源的第一个范围。 */
  private defaultModeState(mode: number): ModeSnapshot {
    const item = this.getActiveCategories(mode).platform[0]?.subNavBarItems[0];
    return {
      ...emptyModeState(),
      currentSubNavBarAction: item?.searchAction ?? (() => {}),
    };
  }

  private takeSnapshot(): ModeSnapshot {
    const state = this.state;
    return {
      searchKeyword: state.searchKeyword,
      PlatformIndex: state.PlatformIndex,
      SubNavBarIndex: state.SubNavBarIndex,
      currentPage: state.currentPage,
      totalPage: state.totalPage,
      mediaData: state.mediaData,
      // 复制一份：分页缓存后续会被追加，快照不能与当前现场共享同一数组
      allMediaData: [...state.allMediaData],
      isCurrentInMultiPage: state.isCurrentInMultiPage,
      oldItems: state.oldItems,
      innerCollection: state.innerCollection,
      settingsData: state.settingsData,
      currentSubNavBarAction: state.currentSubNavBarAction,
      currentOnDemandPlay: state.currentOnDemandPlay,
    };
  }

  /**
   * 切模式：快照现场 → 恢复目标现场（无历史用默认）→ 首次进入时执行首个范围。
   * 设置页的数据是本地读取、且同步状态订阅随离开释放，所以每次回到设置页都重跑一次。
   */
  private applyMode(next: number) {
    const previous = this.state.mode;
    if (previous === next) return;
    this.snapshots.set(previous, this.takeSnapshot());
    if (previous === MODE.settings) SettingsService.release();

    const snapshot = this.snapshots.get(next);
    const restored: ModeSnapshot = snapshot
      ? { ...snapshot, allMediaData: [...snapshot.allMediaData] }
      : this.defaultModeState(next);
    const pending = this.pendingSearch;
    this.pendingSearch = null;
    setPanelFocus({ category: next, platform: restored.PlatformIndex });
    this.innerPageSource = restored.innerCollection;

    this.setState(
      {
        mode: next,
        ...restored,
        updating: false,
        requestToken: this.state.requestToken + 1,
      },
      () => {
        // 待提交的关键词走完整提交：浏览型范围（视频「推荐」）会先落到可搜索的范围
        if (pending) this.controller.runSearch(pending, { propagate: false });
        else if (!snapshot || next === MODE.settings) this.runCurrentScope();
      },
    );
  }

  /** 执行当前范围的动作（搜索/筛选/读取设置）。 */
  private runCurrentScope() {
    const item =
      this.currentPlatform()?.subNavBarItems[this.state.SubNavBarIndex];
    const action = item?.searchAction ?? this.state.currentSubNavBarAction;
    if (!action) return;
    this.setState({ currentSubNavBarAction: action }, () => action());
  }

  /** 外部关键词能落在哪个模式：视频链接→视频，其余在音乐/视频里就地搜，其他模式回音乐。 */
  private modeForKeyword(keyword: string): number {
    if (detectVideoTarget(keyword)) return MODE.video;
    return this.state.mode === MODE.video ? MODE.video : MODE.music;
  }

  private handleExternalKeyword(keyword: string) {
    const target = this.modeForKeyword(keyword);
    if (target === this.state.mode) {
      this.controller.runSearch(keyword, { propagate: false });
      return;
    }
    this.pendingSearch = keyword;
    this.props.switchMode(target);
  }

  private getActionContext(): MainAppContainerActionContext {
    return {
      getState: () => this.state,
      setState: (state) => this.setState(state as MainAppContainerState),
      pushAllData: this.controller.pushAllData,
    };
  }

  private controller = {
    /**
     * @description 提交搜索：粘贴或输入的视频链接先切到视频模式再提交
     */
    submitSearch: (text: string) => {
      const keyword = text.trim();
      // 空提交不发起检索（沿用旧搜索栏：清空后提交无动作）
      if (!keyword) return;
      const video = detectVideoTarget(keyword);
      if (video && this.state.mode !== MODE.video) {
        this.pendingSearch = video;
        this.props.switchMode(MODE.video);
        return;
      }
      this.controller.runSearch(video ?? keyword);
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
      this.innerPageSource = null;
      // 浏览型范围（视频的「推荐」）不承接关键词：有词时自动落到第一个可搜索的范围
      const platform = this.currentPlatform();
      let scope = this.state.SubNavBarIndex;
      if (keyword && platform?.subNavBarItems[scope]?.class !== "search") {
        const first = platform?.subNavBarItems.findIndex(
          (item) => item.class === "search",
        );
        if (first !== undefined && first >= 0) scope = first;
      }
      const nextAction =
        platform?.subNavBarItems[scope]?.searchAction ??
        this.state.currentSubNavBarAction;
      this.setState(
        {
          SubNavBarIndex: scope,
          searchKeyword: keyword,
          currentPage: 1,
          totalPage: 0,
          allMediaData: [],
          mediaData: null,
          isCurrentInMultiPage: false,
          oldItems: null,
          innerCollection: null,
          updating: false,
          currentSubNavBarAction: nextAction,
        },
        () => {
          if (keyword || options?.reloadEmpty) this.runCurrentScope();
          if (options?.propagate !== false)
            this.props.changeSearchKeyword(keyword);
        },
      );
    },

    /** 切换来源：页码归 1、回到第一个范围。 */
    selectSource: (index: number) => {
      this.innerPageSource = null;
      setPanelFocus({ category: this.state.mode, platform: index });
      this.setState(
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
          updating: false,
        },
        () => this.runCurrentScope(),
      );
    },

    /** 切换范围：页码归 1、滚到顶部，按当前关键词重取。 */
    selectScope: (index: number) => {
      this.innerPageSource = null;
      this.setState(
        {
          SubNavBarIndex: index,
          currentPage: 1,
          totalPage: 0,
          allMediaData: [],
          mediaData: null,
          isCurrentInMultiPage: false,
          oldItems: null,
          innerCollection: null,
          updating: false,
        },
        () => this.runCurrentScope(),
      );
    },

    /**
     * @description 切换搜索结果视图（列表/网格），并持久化到 localStorage
     */
    toggleSearchViewMode: () => {
      const searchViewMode = PluginSettings.toggleSearchViewMode();
      this.setState({ searchViewMode });
    },

    /**
     * @description 更新目前的页面
     */
    changecurrentPage: async (page: number) => {
      const { updating, isCurrentInMultiPage, allMediaData, totalPage } =
        this.state;

      if (isCurrentInMultiPage) {
        const safePage = Math.min(Math.max(1, page), totalPage || 1);
        const startIndex = (safePage - 1) * this.itemsPerPage;
        const endIndex = Math.min(
          startIndex + this.itemsPerPage,
          allMediaData.length,
        );
        const currentPageData = allMediaData.slice(startIndex, endIndex);

        await this.setState({
          currentPage: safePage,
          mediaData: Promise.resolve({
            platformData: currentPageData,
            totalPage: totalPage,
          }),
        });
        return;
      }

      if (updating) return;
      await this.setState({ currentPage: Math.max(1, page) });
      this.runCurrentScope();
    },

    /**
     * @description 更新目前是否在多集页面里面
     */
    updateCurrentInMultiPageStatus: (status: boolean) => {
      this.setState({ isCurrentInMultiPage: status });
    },

    /**
     * @description 切换到多集页面
     */
    switchToMultiPage: async (
      platformData: PlatformData,
      _isCurrentInMultiPage?: boolean,
    ) => {
      // 记住来源条目：内页加载失败时「重试」按它重载内页
      this.innerPageSource = platformData;
      // 专辑 / 歌单的内页头（名称 + 曲目数 + 全部播放）；多 P / 多集仍用范围行
      const isCollection = !!(
        platformData.neteaseMusic?.isSongList ||
        platformData.neteaseMusic?.isAlbum
      );
      this.setState({ innerCollection: isCollection ? platformData : null });

      if (platformData.bilibili) {
        const data = BilibiliPlatform.getMultiPageBasicsData(platformData);
        const vod = BilibiliPlatform.VOD;
        this.setState({ currentPage: 1, totalPage: 0, allMediaData: [] });
        this.setState({ mediaData: data });
        this.setState({ currentOnDemandPlay: vod });
        data.then((res) => {
          if (!this.state.isCurrentInMultiPage) return;
          if (!res) return;
          this.setState({ totalPage: res.totalPage });
          if (res.allPlatformData) {
            this.setState({ allMediaData: res.allPlatformData });
          }
        });
      } else if (platformData.neteaseMusic?.isSongList) {
        const data = NetEasePlatform.getSongListMultiPageData(platformData);
        this.setState({ currentPage: 1, totalPage: 0, allMediaData: [] });
        this.setState({ mediaData: data });
        this.setState({ currentOnDemandPlay: NetEasePlatform.MOD });

        data.then((res) => {
          if (!this.state.isCurrentInMultiPage) return;
          if (!res) return;
          this.setState({ totalPage: res.totalPage });
          if (res.allPlatformData) {
            this.setState({ allMediaData: res.allPlatformData });
          }
        });
      } else if (platformData.neteaseMusic?.isAlbum) {
        const data = NetEasePlatform.getAlbumMultiPageData(platformData);

        this.setState({ currentPage: 1, totalPage: 0, allMediaData: [] });
        this.setState({ mediaData: data });
        this.setState({ currentOnDemandPlay: NetEasePlatform.MOD });

        data.then((res) => {
          if (!this.state.isCurrentInMultiPage) return;
          if (!res) return;
          this.setState({ totalPage: res.totalPage });
          if (res.allPlatformData) {
            this.setState({ allMediaData: res.allPlatformData });
          }
        });
      } else {
        const multipage = await platformData.multiPage;
        if (!multipage) return;
        if (multipage.platform === "video") {
          const playList = platformData.playList || [];
          const multiPageDatas: PlatformData[] = playList.map((item) => ({
            title: `${platformData.title}`,
            coverImg: platformData.coverImg,
            author: item.episode,
            websiteUrl: item.url,
            multiPage: Promise.resolve(undefined),
            playList: [item],
          }));

          const totalPage = Math.ceil(
            multiPageDatas.length / this.itemsPerPage,
          );
          const VOD = AllVideosPlatform.VOD;

          this.setState({
            currentPage: 1,
            totalPage: totalPage,
            mediaData: Promise.resolve({
              platformData: multiPageDatas.slice(0, this.itemsPerPage),
              totalPage: totalPage,
            }),
            allMediaData: multiPageDatas,
            currentOnDemandPlay: VOD,
          });
        }
      }
    },

    /**
     * @description 退出多集页面
     */
    switchToOutFromMultiPage: () => {
      const oldItems = this.state.oldItems;
      if (!oldItems) return;
      this.innerPageSource = null;
      this.setState({ oldItems: null });
      this.setState({ mediaData: oldItems.mediaData });
      this.setState({ allMediaData: oldItems.allMediaData });
      this.setState({ totalPage: oldItems.totalPage });
      this.setState({ currentPage: oldItems.currentPage });
      this.setState({ isCurrentInMultiPage: false });
      this.setState({ innerCollection: null });
      this.setState({ currentSubNavBarAction: oldItems.SubNavBarAction });
      this.setState({ currentOnDemandPlay: oldItems.OnDemandPlay });
    },

    pushAllData: (
      currentRequestToken: number,
      allPlatformData: PlatformData[] | undefined,
      totalPage: number,
    ) => {
      if (this.state.requestToken !== currentRequestToken) return;
      if (!allPlatformData) return;
      this.setState({
        allMediaData: [...this.state.allMediaData, ...allPlatformData],
        totalPage,
        updating: false,
      });
    },
  };

  /** 六种模式各自的来源与范围；下标即模式下标。 */
  private categories: Categories[] = [
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
                NetEaseService.searchMusic(
                  this.getActionContext(),
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "专辑",
              class: "search",
              searchAction: () => {
                NetEaseService.searchAlbum(
                  this.getActionContext(),
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "歌单",
              class: "search",
              searchAction: () => {
                NetEaseService.searchPlaylist(
                  this.getActionContext(),
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "MV",
              class: "search",
              searchAction: () => {
                NetEaseService.searchMV(
                  this.getActionContext(),
                  this.itemsPerPage,
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
                  ...this.getActionContext(),
                  getRefreshCount: () => this.bilibiliRefreshCount,
                  incrementRefreshCount: () => {
                    this.bilibiliRefreshCount++;
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
                  this.getActionContext(),
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "直播",
              class: "search",
              searchAction: () => {
                BilibiliService.snbclickSearchLive(this.getActionContext());
              },
            },
          ],
        },
        {
          title: "多源剧集",
          shortTitle: "多源",
          subNavBarItems: [
            {
              title: "U库资源网",
              class: "search",
              searchAction: () => {
                const baseUrl = `${SendFetch.cors}https://api.ukuapi88.com`;
                AllVideosService.searchAllVideos(
                  this.getActionContext(),
                  baseUrl,
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "非凡资源",
              class: "search",
              searchAction: () => {
                const baseUrl = `${SendFetch.cors}https://ffzy.tv`;
                AllVideosService.searchAllVideos(
                  this.getActionContext(),
                  baseUrl,
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "最大资源网",
              class: "search",
              searchAction: () => {
                const baseUrl = `${SendFetch.cors}https://zuidazy.co`;
                AllVideosService.searchAllVideos(
                  this.getActionContext(),
                  baseUrl,
                  this.itemsPerPage,
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
                  this.getActionContext(),
                  this.itemsPerPage,
                  "japan",
                );
              },
            },
          ],
        },
      ],
    },
    // 3 收藏：单来源「全部」，范围为类型（来源筛选与即时过滤在 story 6）
    {
      platform: [
        {
          title: "全部",
          shortTitle: "全部",
          subNavBarItems: [
            {
              title: "全部",
              class: "search",
              searchAction: () => {
                FavoritesService.loadFavorites(
                  this.getActionContext(),
                  "all",
                  "all",
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "单曲",
              class: "search",
              searchAction: () => {
                FavoritesService.loadFavorites(
                  this.getActionContext(),
                  "all",
                  "song",
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "专辑",
              class: "search",
              searchAction: () => {
                FavoritesService.loadFavorites(
                  this.getActionContext(),
                  "all",
                  "album",
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "歌单",
              class: "search",
              searchAction: () => {
                FavoritesService.loadFavorites(
                  this.getActionContext(),
                  "all",
                  "playlist",
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "视频",
              class: "search",
              searchAction: () => {
                FavoritesService.loadFavorites(
                  this.getActionContext(),
                  "all",
                  "video",
                  this.itemsPerPage,
                );
              },
            },
          ],
        },
      ],
    },
    // 4 设置：搜索栏隐藏，所以把现有四组设置的全部子分组摊平成范围标签
    // （story 7 会改成「平台分组作范围标签 + 每组一张设置卡」）
    {
      platform: [
        {
          title: "设置",
          shortTitle: "设置",
          subNavBarItems: [
            {
              title: "账号",
              searchAction: () => {
                SettingsService.showBilibiliAccount(this.getActionContext());
              },
            },
            {
              title: "视频设置",
              searchAction: () => {
                SettingsService.showBilibiliVideo(this.getActionContext());
              },
            },
            {
              title: "音乐设置",
              searchAction: () => {
                SettingsService.showNetEaseMusic(this.getActionContext());
              },
            },
            {
              title: "无线电设置",
              searchAction: () => {
                SettingsService.showRadio(this.getActionContext());
              },
            },
            {
              title: "聊天框",
              searchAction: () => {
                SettingsService.showPluginSettings(
                  this.getActionContext(),
                  this.props.changeSearchKeyword,
                  this.props.ShowOrHideIMC,
                );
              },
            },
            {
              title: "云端同步",
              searchAction: () => {
                SettingsService.showSyncSettings(this.getActionContext());
              },
            },
          ],
        },
      ],
    },
    // 5 关于（手机并入设置的最后一个范围，由 story 7 落地）
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
                  this.getActionContext(),
                  this.props.ShowOrHideIMC,
                );
              },
            },
          ],
        },
      ],
    },
  ];
}
