// mainAppContainerView.tsx
import type { RefObject } from "preact";
import { DeskToast } from "./components/desk/DeskToast";
import { PageHeader } from "./components/desk/PageHeader";
import { SearchBar, type SearchSource } from "./components/desk/SearchBar";
import { ScopeRow, type ScopeItem } from "./components/desk/ScopeRow";
import { RoomDeck } from "./components/room-deck/RoomDeck";
import {
  MODE,
  hasPager,
  hasScopeRow,
  hasSearchBar,
  modeTitle,
} from "./components/desk/deskModes";
import { Provider } from "./components/media-container-context/MediaContainerContext";
import { ResultsArea } from "./components/media-card-container/ResultsArea";
import { CollectionHeader } from "./components/media-card-container/CollectionHeader";
import { SelectionBar } from "./components/media-card-container/SelectionBar";
import type { PlayOrder } from "./components/media-card-container/OrderMenu";
import { roomSupportsRequest } from "./components/media-card-container/roomSupport";
import { SelectionService } from "./MainAppContainerServices/SelectionService";
import { deskInk, deskPaper } from "./components/floating-panel/tokens";
import type { MainAppController } from "./mainAppContainerController";

/**
 * 视图向容器要的那一口：渲染只读现场、不自己判定范围与分页，
 * 动作一律转交容器的 `controller` 与几个入口（点播 / 勾选 / 重试）。
 */
export interface MainAppContainerViewHost {
  readonly state: MainAppContainerState;
  readonly props: MainAppContainerProps;
  readonly searchBarRef: RefObject<SearchBar>;
  readonly controller: MainAppController;
  /** 当前模式的下标 → 分类表。 */
  getActiveCategories(mode?: number): Categories;
  /** 当前模式可见的范围条目（桌面不渲染手机专属项）。 */
  visibleScopes(): Platform["subNavBarItems"];
  /** 有效范围下标（手机专属项越界时夹回可见范围）。 */
  effectiveScopeIndex(): number;
  /** 每页条数：收藏列表按设置，其余固定 10。 */
  pageSizeFor(mode: number): number;
  /** 内页的来源条目（多 P / 多集内页头的名称来自它）。 */
  readonly innerPageSource: PlatformData | null;
  /** 内页头「全部播放」。 */
  playCollectionAll(order: PlayOrder): void;
  handleRetry(): void;
  handleClearSearch(): void;
  selectionOrderOf(position: number): number | undefined;
  toggleSelection(position: number, platformData: PlatformData): void;
  clearSelection(): void;
  playSelection(): void;
}

export function renderContainer(host: MainAppContainerViewHost) {
  const { ShowOrHideIMC } = host.props;
  const {
    mode,
    PlatformIndex,
    mediaData,
    settingsData,
    searchKeyword,
    currentPage,
    totalPage,
    searchViewMode,
    currentOnDemandPlay,
  } = host.state;

  const categories = host.getActiveCategories();
  // 手机专属范围标签（设置的「关于」）：桌面不渲染。它恒为末项，过滤后前面的下标不位移；
  // 若停在它上面（下标 4）时视口越过 768px，桌面只剩 4 个标签，越界下标既会让 tablist
  // 没有一个 tabIndex=0，也会让 `runCurrentScope` 执行桌面看不到的那一项，
  // 所以范围解析（渲染 / 动作）统一走 `effectiveScopeIndex`，不各算一套。
  const scopes: ScopeItem[] = host.visibleScopes().map((item) => ({
    title: item.title,
  }));
  const scopeIndex = host.effectiveScopeIndex();
  const sources: SearchSource[] = categories.platform.map((item) => ({
    label: item.title,
    short: item.shortTitle ?? item.title,
    dot: item.sourceKey ?? null,
  }));

  const providerValue = {
    switchToMultiPage: host.controller.switchToMultiPage,
    currentOnDemandPlay,
    updateCurrentInMultiPageStatus:
      host.controller.updateCurrentInMultiPageStatus,
    ShowOrHideIMC,
  };

  const innerCollection = host.state.innerCollection;
  // 内页头通用于三类内页：专辑 / 歌单（曲目数 + 全部播放）与多 P / 多集
  // （只有返回 + 名称 + 分页；手机没有键盘，返回钮是多 P 内页唯一的出口）。
  const innerPage = host.state.isCurrentInMultiPage
    ? (innerCollection ?? host.innerPageSource)
    : null;
  const isCollectionInner = !!innerCollection && !!innerPage;
  const showInnerHeader = !!innerPage;
  const selectionCount = isCollectionInner
    ? host.state.innerSelection.length
    : 0;

  return (
    <Provider value={providerValue}>
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div className={`flex min-h-0 flex-1 flex-col ${deskPaper} ${deskInk}`}>
          <PageHeader title={modeTitle(mode)} onClose={ShowOrHideIMC} />

          {hasSearchBar(mode) && (
            <SearchBar
              ref={host.searchBarRef}
              active={host.props.active}
              keyword={searchKeyword}
              placeholder={placeholderFor(mode)}
              placeholderPhone={placeholderPhoneFor(mode)}
              sources={sources}
              sourceIndex={PlatformIndex}
              onSelectSource={host.controller.selectSource}
              onSubmit={host.controller.submitSearch}
              onLiveInput={
                mode === MODE.favorites || mode === MODE.radio
                  ? host.controller.filterLive
                  : undefined
              }
            />
          )}

          {showInnerHeader ? (
            <CollectionHeader
              title={innerPage.title}
              trackCount={isCollectionInner ? innerPage.trackCount : undefined}
              viewMode={searchViewMode}
              onToggleView={host.controller.toggleSearchViewMode}
              currentPage={currentPage}
              totalPage={totalPage}
              onPageChange={host.controller.changecurrentPage}
              onBack={host.controller.switchToOutFromMultiPage}
              onPlayAll={isCollectionInner ? host.playCollectionAll : undefined}
            />
          ) : (
            hasScopeRow(mode) &&
            scopes.length > 0 && (
              <ScopeRow
                items={scopes}
                activeIndex={scopeIndex}
                onChange={host.controller.selectScope}
                viewMode={viewToggle(host.state)?.value ?? null}
                viewLocked={viewToggle(host.state)?.locked ?? false}
                onToggleView={host.controller.toggleSearchViewMode}
                currentPage={currentPage}
                totalPage={totalPage}
                showPager={hasPager(mode)}
                onPageChange={host.controller.changecurrentPage}
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
              isInnerPage={host.state.isCurrentInMultiPage}
              pageOffset={(currentPage - 1) * host.pageSizeFor(mode)}
              onRetry={host.handleRetry}
              onClearSearch={host.handleClearSearch}
              selection={
                isCollectionInner
                  ? {
                      orderOf: host.selectionOrderOf,
                      onToggle: host.toggleSelection,
                    }
                  : undefined
              }
            />
            <DeskToast />
          </div>

          {/* 底部条 / 迷你条：桌面三栏、手机迷你条 + 展开层（story 3）；
                内页有勾选时选择条同位取代它（不另开浮层） */}
          {selectionCount > 0 && innerCollection ? (
            <SelectionBar
              count={selectionCount}
              requestKey={SelectionService.requestKey(innerCollection)}
              supported={roomSupportsRequest()}
              onClear={host.clearSelection}
              onPlay={host.playSelection}
            />
          ) : (
            <RoomDeck active={host.props.active} mode={host.state.mode} />
          )}
        </div>
      </div>
    </Provider>
  );
}

/** 搜索框占位（桌面）：各模式自己的一句话。 */
function placeholderFor(mode: number): string {
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
function placeholderPhoneFor(mode: number): string | undefined {
  return mode === MODE.video ? "搜索或粘贴 BV 号" : undefined;
}

/**
 * 视图切换常驻范围行（不再时有时无，分页不跳）：
 * 音乐单曲（含首屏「最近点播」）、视频（含多源）、收藏可切列表/网格；
 * 专辑、歌单、电台只有列表，MV 只有网格——显示为灰色锁定并说明原因。
 */
function viewToggle(
  state: MainAppContainerState,
): { value: "card" | "list"; locked: boolean } | null {
  const free = { value: state.searchViewMode, locked: false };
  const { mode, SubNavBarIndex } = state;
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
