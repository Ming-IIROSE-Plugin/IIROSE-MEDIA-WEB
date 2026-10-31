import { setPanelFocus } from "../playback/PanelFocus";
import { RADIO_MIN_PENDING_MS } from "./components/media-card-container/ResultsArea";
import { DeskToast } from "./components/desk/DeskToast";
import { guardedRequest, requestKey } from "../playback/RequestGuard";
import { Component, createRef } from "preact";
import { ResultsArea } from "./components/media-card-container/ResultsArea";
import { CollectionHeader } from "./components/media-card-container/CollectionHeader";
import type { PlayOrder } from "./components/media-card-container/OrderMenu";
import {
  isCollectionItem,
  isPhoneLayout,
} from "./components/media-card-container/mediaFormat";
import {
  notifyRoomUnsupported,
  roomSupportsRequest,
} from "./components/media-card-container/roomSupport";
import { BilibiliPlatform } from "../platforms/BilibiliPlatform";
import { NetEasePlatform } from "../platforms/NetEasePlatform";
import type { CollectionSegments } from "../platforms/CollectionSegments";
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
import {
  FavoritesService,
  type FavoritePlatformFilter,
  type FavoriteRange,
} from "./MainAppContainerServices/FavoritesService";
import { RecentService } from "./MainAppContainerServices/RecentService";
import { FavoritesStorageService } from "../storage/FavoritesStorageService";
import { SyncManager } from "../sync/SyncManager";
import { PageHeader } from "./components/desk/PageHeader";
import { SearchBar, type SearchSource } from "./components/desk/SearchBar";
import { ScopeRow, type ScopeItem } from "./components/desk/ScopeRow";
import { RoomDeck } from "./components/room-deck/RoomDeck";
import { restoreFocus } from "./components/desk/focusTrap";
import {
  closePanelTier,
  pushOverlayLayer,
} from "./components/desk/overlayLayers";
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
  collectionSegments: CollectionSegments | null;
  settingsData: SettingGroupData[] | null;
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
    collectionSegments: null,
    settingsData: null,
    currentSubNavBarAction: () => {},
    currentOnDemandPlay: () => {},
  };
}

export class MainAppContainer extends Component<
  MainAppContainerProps,
  MainAppContainerState
> {
  static contextType = MediaContainerContext;
  private itemsPerPage = 10;

  /**
   * 每页条数：收藏列表按设置（10 / 50 / 100 / 自定义），其余固定 10。
   * 专辑 / 歌单 / 多 P 内页是另一份本地分页（固定每页 10），即使从收藏进入也不跟设置走。
   */
  private pageSizeFor(mode: number): number {
    return mode === MODE.favorites && !this.state.isCurrentInMultiPage
      ? PluginSettings.getPluginSetting().favoritesPageSize
      : this.itemsPerPage;
  }
  bilibiliRefreshCount = 1;
  mediaContainerGesture = new MediaContainerGesture(this.props.ShowOrHideIMC);

  /** 切模式时待提交的关键词（粘贴视频链接要先切到视频模式）。 */
  private pendingSearch: string | null = null;
  /** 内页的来源条目：重试时按它重新载入内页。 */
  private innerPageSource: PlatformData | null = null;
  /**
   * 当前模式内页的分段加载器（与 state 同步，但 setState 生效前也能拿到）；
   * `innerLoad` 每次进出内页递增，迟到的内页详情据此丢弃。
   */
  private activeSegments: CollectionSegments | null = null;
  private innerLoad = 0;
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
    if (this.props.active && !isPhoneLayout())
      this.searchBarRef.current?.focus();
    // 内页（专辑/歌单）登记为层级栈的一层：`Esc` 与宿站返回键先返回外层结果（story 4）
    this.syncInnerLayer();
    // 首个模式的首个范围：与旧四行顶栏挂载时自执行首项一致
    this.runCurrentScope();
  }

  componentWillUnmount() {
    this.releaseInnerLayer();
    this.dropSegments();
  }

  /** 离开（或换掉）当前内页：中止未完成的段请求，迟到结果不再落地。 */
  private dropSegments() {
    this.innerLoad++;
    this.activeSegments?.abort();
    this.activeSegments = null;
  }

  componentDidUpdate(prevProps: Readonly<MainAppContainerProps>): void {
    // 面板打开：桌面把焦点放进搜索栏（手机不聚焦）
    if (!prevProps.active && this.props.active && !isPhoneLayout())
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

    this.syncInnerLayer();
  }

  /** 内页层的注销函数；没有内页（或退不回去）时为 null。 */
  private releaseInner: (() => void) | null = null;

  /**
   * 内页登记为层级栈的一层（`Esc` / 宿站返回键先返回外层，再按一次才关面板）。
   * 没有外层现场就退不回去，此时不登记：`Esc` 交给下一层（面板）。
   */
  private syncInnerLayer() {
    const wanted =
      this.props.active &&
      this.state.isCurrentInMultiPage &&
      !!this.state.oldItems;
    if (wanted && !this.releaseInner)
      this.releaseInner = pushOverlayLayer("inner", this.dismissInnerPage);
    else if (!wanted && this.releaseInner) this.releaseInnerLayer();
  }

  private releaseInnerLayer() {
    this.releaseInner?.();
    this.releaseInner = null;
  }

  private dismissInnerPage = () => {
    this.controller.switchToOutFromMultiPage();
  };

  /** 重试：分段内页只重取当前页所在的段；其余内页重载内页，否则重发当前范围。 */
  private handleRetry = () => {
    if (this.state.isCurrentInMultiPage && this.state.collectionSegments) {
      void this.controller.changecurrentPage(this.state.currentPage);
      return;
    }
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
    // 灰化基于渲染期快照：点击时再判一次，与行内点播一致
    if (!roomSupportsRequest()) {
      notifyRoomUnsupported();
      return;
    }
    void guardedRequest(
      collection,
      () => NetEasePlatform.playCollectionAll(collection, order),
      `${requestKey(collection)}:all`,
    );
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
    // 手机专属范围标签（设置的「关于」）：桌面不渲染。它恒为末项，过滤后前面的下标不位移；
    // 若停在它上面（下标 4）时视口越过 768px，桌面只剩 4 个标签，越界下标既会让 tablist
    // 没有一个 tabIndex=0，也会让 `runCurrentScope` 执行桌面看不到的那一项，
    // 所以范围解析（渲染 / 动作）统一走 `effectiveScopeIndex`，不各算一套。
    const scopes: ScopeItem[] = this.visibleScopes().map((item) => ({
      title: item.title,
    }));
    const scopeIndex = this.effectiveScopeIndex();
    const sources: SearchSource[] = categories.platform.map((item) => ({
      label: item.title,
      short: item.shortTitle ?? item.title,
      dot: item.sourceKey ?? null,
    }));

    const providerValue = {
      switchToMultiPage: this.controller.switchToMultiPage,
      currentOnDemandPlay,
      updateCurrentInMultiPageStatus:
        this.controller.updateCurrentInMultiPageStatus,
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
                onLiveInput={
                  mode === MODE.favorites || mode === MODE.radio
                    ? this.controller.filterLive
                    : undefined
                }
              />
            )}

            {showCollectionHeader ? (
              <CollectionHeader
                title={innerCollection.title}
                trackCount={innerCollection.trackCount}
                viewMode={searchViewMode}
                onToggleView={this.controller.toggleSearchViewMode}
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
                  activeIndex={scopeIndex}
                  onChange={this.controller.selectScope}
                  viewMode={this.viewToggle()?.value ?? null}
                  viewLocked={this.viewToggle()?.locked ?? false}
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
                scopeIndex={scopeIndex}
                keyword={searchKeyword}
                isInnerPage={this.state.isCurrentInMultiPage}
                pageOffset={(currentPage - 1) * this.pageSizeFor(mode)}
                onRetry={this.handleRetry}
                onClearSearch={this.handleClearSearch}
              />
              <DeskToast />
            </div>

            {/* 底部条 / 迷你条：桌面三栏、手机迷你条 + 展开层（story 3） */}
            <RoomDeck active={this.props.active} mode={this.state.mode} />
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
   * 视图切换常驻范围行（不再时有时无，分页不跳）：
   * 音乐单曲（含首屏「最近点播」）、视频（含多源）、收藏可切列表/网格；
   * 专辑、歌单、电台只有列表，MV 只有网格——显示为灰色锁定并说明原因。
   */
  private viewToggle(): { value: "card" | "list"; locked: boolean } | null {
    const free = { value: this.state.searchViewMode, locked: false };
    const { mode, SubNavBarIndex } = this.state;
    // 设置 / 关于不是结果列表，没有视图可切
    if (mode === MODE.settings || mode === MODE.about) return null;
    if (mode === MODE.radio) return { value: "list", locked: true };
    if (mode === MODE.music) {
      if (SubNavBarIndex === 1 || SubNavBarIndex === 2)
        return { value: "list", locked: true };
      if (SubNavBarIndex === 3) return { value: "card", locked: true };
    }
    return free;
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

  /**
   * 收藏的一个来源：三个来源共用同一组四个范围，只是平台过滤不同。
   * 「歌单与专辑」是合并范围（存储层按 `types` 一次查出两类）。
   */
  private favoriteSource(
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
            this.getActionContext(),
            platform,
            range.type,
            this.pageSizeFor(MODE.favorites),
          );
        },
      })),
    };
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
      collectionSegments: state.collectionSegments,
      settingsData: state.settingsData,
      currentSubNavBarAction: state.currentSubNavBarAction,
      currentOnDemandPlay: state.currentOnDemandPlay,
    };
  }

  /**
   * 切模式：快照现场 → 恢复目标现场（无历史用默认）→ 首次进入时执行首个范围。
   * 设置页的数据是本地读取、且同步状态订阅随离开释放，所以每次回到设置页都重跑一次；
   * 收藏与音乐首屏同理：收藏要重新出现已取消收藏的行，首屏要反映最新的点播历史。
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
    // 加载器随现场走：切回来已取的段不重取（离开的模式的加载器留在快照里）
    this.activeSegments = restored.collectionSegments;

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
        else if (
          !snapshot ||
          next === MODE.settings ||
          // 收藏：取消收藏的行要重新出现；音乐首屏：反映最新的点播历史
          next === MODE.favorites ||
          (next === MODE.music && restored.searchKeyword.trim() === "")
        )
          this.runCurrentScope();
      },
    );
  }

  /** 当前模式可见的范围条目（桌面不渲染手机专属项，如设置里的「关于」）。 */
  private visibleScopes(): Platform["subNavBarItems"] {
    const phone = isPhoneLayout();
    return (this.currentPlatform()?.subNavBarItems ?? []).filter(
      (item) => phone || !item.phoneOnly,
    );
  }

  /**
   * 有效范围下标：手机专属项恒为末项，停在它上面时视口变宽（下标越界），
   * 夹回可见范围。渲染（范围行、结果区）与动作解析共用这一份，不各算一套。
   */
  private effectiveScopeIndex(): number {
    const items = this.visibleScopes();
    return Math.min(this.state.SubNavBarIndex, Math.max(items.length - 1, 0));
  }

  /** 执行当前范围的动作（搜索/筛选/读取设置）。 */
  private runCurrentScope() {
    const item = this.visibleScopes()[this.effectiveScopeIndex()];
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
      this.dropSegments();
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
          // 电台是本地过滤：保留已加载的列表（与总页数），RadioService 按新关键词
          // 切片，不再出网
          totalPage: this.state.mode === MODE.radio ? this.state.totalPage : 0,
          allMediaData:
            this.state.mode === MODE.radio ? this.state.allMediaData : [],
          mediaData: null,
          isCurrentInMultiPage: false,
          oldItems: null,
          innerCollection: null,
          collectionSegments: null,
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

    /**
     * 输入即过滤（收藏 / 电台）：只改关键词与页码，不清已渲染结果、不发网络请求。
     * 与 `runSearch` 分开：后者会清 `mediaData`，逐字提交会每键闪一次骨架。
     * 关键词保留原始输入（trim 交给 FavoritesService / RadioService）：受控回写不会
     * 吞掉刚敲的空格，也不会把光标移到末尾。
     */
    filterLive: (text: string) => {
      if (text === this.state.searchKeyword) return;
      this.setState({ searchKeyword: text, currentPage: 1 }, () =>
        this.runCurrentScope(),
      );
    },

    /** 切换来源：页码归 1、回到第一个范围。 */
    selectSource: (index: number) => {
      this.innerPageSource = null;
      this.dropSegments();
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
          collectionSegments: null,
          updating: false,
        },
        () => this.runCurrentScope(),
      );
    },

    /** 切换范围：页码归 1、滚到顶部，按当前关键词重取。 */
    selectScope: (index: number) => {
      this.innerPageSource = null;
      this.dropSegments();
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
          collectionSegments: null,
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
      const {
        updating,
        isCurrentInMultiPage,
        allMediaData,
        totalPage,
        collectionSegments,
      } = this.state;

      if (isCurrentInMultiPage) {
        const safePage = Math.min(Math.max(1, page), totalPage || 1);
        // 歌单 / 专辑：只在越过已取范围时取对应段
        if (collectionSegments) {
          const data = collectionSegments
            .loadPage(safePage, this.itemsPerPage)
            .then((platformData) => ({ platformData, totalPage }));
          // 失败交给结果区的「加载失败 / 重试」；换页后被丢弃的旧页不算未处理
          data.catch(() => {});
          await this.setState({ currentPage: safePage, mediaData: data });
          return;
        }
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
     * @description 切换到多集页面（专辑 / 歌单内页与多 P / 多集列表共用）
     */
    switchToMultiPage: async (
      platformData: PlatformData,
      _isCurrentInMultiPage?: boolean,
    ) => {
      // 记住来源条目：内页加载失败时「重试」按它重载内页
      this.innerPageSource = platformData;
      // 专辑 / 歌单的内页头（名称 + 曲目数 + 全部播放）；多 P / 多集仍用范围行
      const isCollection = isCollectionItem(platformData);
      // 换掉上一个内页：它未完成的段请求中止，迟到的详情丢弃
      this.dropSegments();
      const ticket = this.innerLoad;
      this.setState({
        innerCollection: isCollection ? platformData : null,
        collectionSegments: null,
      });

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
      } else if (
        platformData.neteaseMusic?.isSongList ||
        platformData.neteaseMusic?.isAlbum
      ) {
        const mode = this.state.mode;
        const entry = platformData.neteaseMusic.isSongList
          ? NetEasePlatform.getSongListMultiPageData
          : NetEasePlatform.getAlbumMultiPageData;
        // 只取歌单（专辑）详情得到完整 id 列表，首屏再取第 1 段
        const data = entry(platformData).then(async (segments) => {
          if (!segments) throw new Error("内页加载失败");
          if (
            ticket !== this.innerLoad ||
            this.state.mode !== mode ||
            !this.state.isCurrentInMultiPage
          ) {
            segments.abort();
            throw new Error("内页已离开");
          }
          const totalPage = segments.totalPage(this.itemsPerPage);
          this.activeSegments = segments;
          this.setState({ collectionSegments: segments, totalPage });
          const page = await segments.loadPage(1, this.itemsPerPage);
          return { platformData: page, totalPage };
        });
        data.catch(() => {});
        this.setState({ currentPage: 1, totalPage: 0, allMediaData: [] });
        this.setState({ mediaData: data });
        this.setState({ currentOnDemandPlay: NetEasePlatform.MOD });
      }
    },

    /**
     * @description 退出多集页面
     */
    switchToOutFromMultiPage: () => {
      const oldItems = this.state.oldItems;
      if (!oldItems) return;
      this.innerPageSource = null;
      this.dropSegments();
      this.setState({ oldItems: null });
      this.setState({ mediaData: oldItems.mediaData });
      this.setState({ allMediaData: oldItems.allMediaData });
      this.setState({ totalPage: oldItems.totalPage });
      this.setState({ currentPage: oldItems.currentPage });
      this.setState({ isCurrentInMultiPage: false });
      this.setState({ innerCollection: null, collectionSegments: null });
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
                const ctx = this.getActionContext();
                // 首屏（关键词为空）列出「最近点播」，不发网络请求
                if (!ctx.getState().searchKeyword.trim()) {
                  RecentService.load(ctx, this.itemsPerPage);
                  return;
                }
                NetEaseService.searchMusic(ctx, this.itemsPerPage);
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
          sourceKey: "multi",
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
    // 3 收藏：三来源（全部 / 网易云 / B站）× 四范围（含「歌单与专辑」合并范围）
    {
      platform: [
        this.favoriteSource("all", "全部", "全部"),
        this.favoriteSource("netease", "网易云音乐", "网易云", "netease"),
        this.favoriteSource("bilibili", "哔哩哔哩", "B站", "bilibili"),
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
                SettingsService.showBilibili(this.getActionContext());
              },
            },
            {
              title: "网易云音乐",
              searchAction: () => {
                SettingsService.showNetEaseMusic(this.getActionContext());
              },
            },
            {
              title: "无线电广播",
              searchAction: () => {
                SettingsService.showRadio(this.getActionContext());
              },
            },
            {
              title: "插件设置",
              searchAction: () => {
                SettingsService.showPluginSettings(
                  this.getActionContext(),
                  this.props.changeSearchKeyword,
                  this.props.ShowOrHideIMC,
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
                  this.getActionContext(),
                  this.props.ShowOrHideIMC,
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
