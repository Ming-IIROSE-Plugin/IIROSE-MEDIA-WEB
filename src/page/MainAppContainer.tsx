import { setPanelFocus } from "../playback/PanelFocus";
import { guardedRequest, requestKey } from "../playback/RequestGuard";
import { Component, createRef } from "preact";
import type { PlayOrder } from "./components/media-card-container/OrderMenu";
import { isPhoneLayout } from "./components/media-card-container/mediaFormat";
import {
  notifyRoomUnsupported,
  roomSupportsRequest,
} from "./components/media-card-container/roomSupport";
import { NetEasePlatform } from "../platforms/NetEasePlatform";
import type { CollectionSegments } from "../platforms/CollectionSegments";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import type { InnerPageHost } from "./MainAppContainerServices/InnerPageService";
import {
  SelectionService,
  type InnerSelectionHolder,
} from "./MainAppContainerServices/SelectionService";
import { FavoritesService } from "./MainAppContainerServices/FavoritesService";
import { FavoritesStorageService } from "../storage/FavoritesStorageService";
import { SyncManager } from "../sync/SyncManager";
import { emptyModeState, type ModeSnapshot } from "./mainAppContainerModel";
import { MediaContainerContext } from "./components/media-container-context/MediaContainerContext";
import { createCategories } from "./mainAppCategories";
import { renderContainer } from "./mainAppContainerView";
import { applyMode, handleExternalKeyword } from "./mainAppContainerModes";
import {
  createController,
  type MainAppController,
} from "./mainAppContainerController";
import type { SearchBar } from "./components/desk/SearchBar";
import { pushOverlayLayer } from "./components/desk/overlayLayers";
import { detectVideoTarget } from "./components/desk/searchIntent";
import { MODE, normalizeMode } from "./components/desk/deskModes";

export class MainAppContainer extends Component<
  MainAppContainerProps,
  MainAppContainerState
> {
  static contextType = MediaContainerContext;
  itemsPerPage = 10;

  /**
   * 每页条数：收藏列表按设置（10 / 50 / 100 / 自定义），其余固定 10。
   * 专辑 / 歌单 / 多 P 内页是另一份本地分页（固定每页 10），即使从收藏进入也不跟设置走。
   */
  pageSizeFor(mode: number): number {
    return mode === MODE.favorites && !this.state.isCurrentInMultiPage
      ? PluginSettings.getPluginSetting().favoritesPageSize
      : this.itemsPerPage;
  }
  bilibiliRefreshCount = 1;

  /** 切模式时待提交的关键词（粘贴视频链接要先切到视频模式）。 */
  pendingSearch: string | null = null;
  /** 内页的来源条目：重试时按它重新载入内页。 */
  innerPageSource: PlatformData | null = null;
  /**
   * 当前模式内页的分段加载器（与 state 同步，但 setState 生效前也能拿到）；
   * `innerLoad` 按模式记票号：该模式进出 / 换掉内页即递增，迟到的内页详情据此丢弃
   * （别的模式里的搜索、换内页不影响它）。
   */
  activeSegments: CollectionSegments | null = null;
  private innerLoad = new Map<number, number>();
  /** 各模式现场快照；没有 = 该模式首次进入。 */
  snapshots = new Map<number, ModeSnapshot>();
  searchBarRef = createRef<SearchBar>();

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
    // 别的模式里还开着的内页：加载器随快照停在那儿，`dropSegments` 只中止当前模式那一个。
    // 面板已经卸载，它们的段请求与缓存的行都没有意义，一并中止。
    for (const snapshot of this.snapshots.values())
      snapshot.collectionSegments?.abort();
  }

  private innerTicket(mode: number): number {
    return this.innerLoad.get(mode) ?? 0;
  }

  /** 离开（或换掉）当前内页：中止未完成的段请求，迟到结果不再落地。 */
  dropSegments() {
    const mode = this.state.mode;
    this.innerLoad.set(mode, this.innerTicket(mode) + 1);
    this.activeSegments?.abort();
    this.activeSegments = null;
  }

  /**
   * 内页加载服务的现场读写口：票号、模式与快照都由容器给，服务只做
   * 「迟到的详情该落到当前现场还是原模式快照」的判断，不碰 `setState`。
   */
  innerPageHost(): InnerPageHost {
    return {
      itemsPerPage: this.itemsPerPage,
      originMode: this.state.mode,
      ticketOf: (mode) => this.innerTicket(mode),
      currentMode: () => this.state.mode,
      isInnerPageOpen: () => this.state.isCurrentInMultiPage,
      setSegments: (segments, totalPage) => {
        this.activeSegments = segments;
        this.setState({ collectionSegments: segments, totalPage });
      },
      setSnapshotSegments: (mode, segments, totalPage) => {
        const snapshot = this.snapshots.get(mode);
        if (!snapshot) return;
        snapshot.collectionSegments = segments;
        snapshot.totalPage = totalPage;
      },
    };
  }

  componentDidUpdate(prevProps: Readonly<MainAppContainerProps>): void {
    // 面板打开：桌面把焦点放进搜索栏（手机不聚焦）
    if (!prevProps.active && this.props.active && !isPhoneLayout())
      this.searchBarRef.current?.focus();

    // 切模式：先快照当前现场，再恢复目标模式的现场
    if (prevProps.mode !== this.props.mode) {
      applyMode(this, normalizeMode(this.props.mode));
      return;
    }

    // 全局搜索词（聊天框 `@` 点歌、外部调用）：切到能承接它的模式再提交
    if (prevProps.searchKeyword !== this.props.searchKeyword) {
      const keyword = (this.props.searchKeyword || "").trim();
      if (keyword && keyword !== this.state.searchKeyword)
        handleExternalKeyword(this, keyword);
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
   * 多 P / 多集内页的载入票号，与 `dropSegments` 的分段票号同源同义：进新内页、
   * 返回外层时自增，迟到的分 P 列表结果不再改写 `totalPage` / `allMediaData`。
   */
  multiPageTicket = 0;

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
  handleRetry = () => {
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
  handleClearSearch = () => {
    this.controller.runSearch("", { reloadEmpty: true });
  };

  /** 内页头「全部播放」：按所选顺序批量点播整张（不走宿站 `buildSelect2`）。 */
  playCollectionAll = (order: PlayOrder) => {
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

  /** 内页勾选的点选序号（1 起）：键是绝对位置，同一首歌重复出现时各自计序。 */
  selectionOrderOf = (position: number): number | undefined =>
    SelectionService.orderOf(this.state.innerSelection, position);

  /** 勾 / 取消一首：取消后后面的序号自然前移（序号即数组下标）。 */
  toggleSelection = (position: number, platformData: PlatformData) => {
    // 没有网易云曲目 id 的行不可选：连一次重渲染都不必
    if (!SelectionService.canSelect(platformData)) return;
    this.setState((prev) => ({
      innerSelection: SelectionService.toggle(
        prev.innerSelection,
        position,
        platformData,
      ),
    }));
  };

  clearSelection = () => {
    this.setState({ innerSelection: SelectionService.clear() });
  };

  /**
   * 选择条「点播所选」：按点选顺序点播（1 首单曲播报，多首批量进度浮窗）。
   * 报文真的发出后清掉这次发出的几首；`handoff`（`playSongIds` 恒返回 Promise，
   * 这时等于一首没发、也没提示）/ 失败 / 进行中保留，可以再点。
   */
  playSelection = () => {
    const collection = this.state.innerCollection;
    const selection = this.state.innerSelection;
    if (!collection || selection.length === 0) return;
    if (!roomSupportsRequest()) {
      notifyRoomUnsupported();
      return;
    }
    const mode = this.state.mode;
    // 成功提示「已点播《…》」要与「全部播放」区分开：1 首用曲名，多首写明所选数
    const title =
      selection.length === 1
        ? selection[0].title
        : `${collection.title}·所选 ${selection.length} 首`;
    void guardedRequest(
      { ...collection, title },
      () =>
        NetEasePlatform.playSongIds(
          SelectionService.ids(selection),
          collection.title,
        ),
      SelectionService.requestKey(collection),
    ).then((outcome) => {
      if (outcome !== "sent") return;
      // 只去掉这次发出的几首（等待期间新勾的保留）；已换到别的内页就不动
      const drop = (current: InnerSelectionHolder) =>
        SelectionService.afterSend(selection, current, collection);
      if (this.state.mode === mode) {
        this.setState((prev) => ({ innerSelection: drop(prev) }));
        return;
      }
      const snapshot = this.snapshots.get(mode);
      if (snapshot) snapshot.innerSelection = drop(snapshot);
    });
  };

  render() {
    return renderContainer(this);
  }

  /** 当前模式的下标 → 分类表。 */
  getActiveCategories(mode?: number): Categories {
    const index = mode ?? this.state.mode;
    return this.categories[index] || this.categories[0];
  }

  currentPlatform(): Platform | undefined {
    const categories = this.getActiveCategories();
    return (
      categories.platform[this.state.PlatformIndex] ?? categories.platform[0]
    );
  }

  /** 当前模式可见的范围条目（桌面不渲染手机专属项，如设置里的「关于」）。 */
  visibleScopes(): Platform["subNavBarItems"] {
    const phone = isPhoneLayout();
    return (this.currentPlatform()?.subNavBarItems ?? []).filter(
      (item) => phone || !item.phoneOnly,
    );
  }

  /**
   * 有效范围下标：手机专属项恒为末项，停在它上面时视口变宽（下标越界），
   * 夹回可见范围。渲染（范围行、结果区）与动作解析共用这一份，不各算一套。
   */
  effectiveScopeIndex(): number {
    const items = this.visibleScopes();
    return Math.min(this.state.SubNavBarIndex, Math.max(items.length - 1, 0));
  }

  /** 执行当前范围的动作（搜索/筛选/读取设置）。 */
  runCurrentScope() {
    const item = this.visibleScopes()[this.effectiveScopeIndex()];
    const action = item?.searchAction ?? this.state.currentSubNavBarAction;
    if (!action) return;
    this.setState({ currentSubNavBarAction: action }, () => action());
  }

  /** 外部关键词能落在哪个模式：视频链接→视频，其余在音乐/视频里就地搜，其他模式回音乐。 */
  modeForKeyword(keyword: string): number {
    if (detectVideoTarget(keyword)) return MODE.video;
    return this.state.mode === MODE.video ? MODE.video : MODE.music;
  }

  getActionContext(): MainAppContainerActionContext {
    return {
      getState: () => this.state,
      setState: (state) => this.setState(state as MainAppContainerState),
      pushAllData: this.controller.pushAllData,
    };
  }

  /** 动作字典落地的唯一出口（与 `getActionContext().setState` 同一条路）。 */
  mergeState(patch: Partial<MainAppContainerState>, callback?: () => void) {
    this.setState(patch as MainAppContainerState, callback);
  }

  /** 分类表要的宿站回调：直接给 props 上的函数（调用点会比对同一性）。 */
  get changeSearchKeyword() {
    return this.props.changeSearchKeyword;
  }

  get showOrHideIMC() {
    return this.props.ShowOrHideIMC;
  }

  controller: MainAppController = createController(this);

  /** 六种模式各自的来源与范围；下标即模式下标（表见 `mainAppCategories`）。 */
  private categories: Categories[] = createCategories(this);
}
