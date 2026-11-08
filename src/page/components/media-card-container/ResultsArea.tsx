// 结果区容器：Promise 状态机（loading / error / 空 / 未搜索）+ 按模式与范围选形态。
// 形态派生与文案在 resultsModel，列表 / 网格 / 状态分别在 ResultsRows /
// ResultsTiles / ResultsPlaceholder；容器只管状态机、滚动与点播接线。
import { guardedRequest } from "../../../playback/RequestGuard";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { SettingsCards } from "../settings/SettingsGroup";
import { MediaContainerContext } from "../media-container-context/MediaContainerContext";
import { MODE } from "../desk/deskModes";
import { deskGutter, deskInk, typeLabelStrong } from "../floating-panel/tokens";
import { placeholderKind, ResultsPlaceholder } from "./ResultsPlaceholder";
import { ResultsRows } from "./ResultsRows";
import { ResultsTiles } from "./ResultsTiles";
import { StateMessage } from "./StateMessage";
import { TracklistHeader } from "./TracklistRow";
import { subscribeNowPlayingTitle } from "./nowPlaying";
import { notifyRoomUnsupported, roomSupportsRequest } from "./roomSupport";
import {
  emptyMessage,
  isRowShape,
  musicGridClass,
  RADIO_MIN_PENDING_MS,
  settingsPageClass,
  shapeOf,
  videoGridClass,
  type Load,
  type ResultsPayload,
  type ResultsSelection,
  type SelectionProps,
} from "./resultsModel";

export { RADIO_MIN_PENDING_MS, shapeOf } from "./resultsModel";
export type { ResultsPayload, ResultsSelection } from "./resultsModel";

export interface ResultsAreaProps {
  mediaData: Promise<ResultsPayload> | null;
  /** 设置 / 关于页的数据（本地读取，一组一张卡），与 `mediaData` 互斥。 */
  settingsData: SettingGroupData[] | null;
  /** 搜索结果视图（列表 / 网格）；音乐专辑·歌单与 MV 固定形态，不看它。 */
  viewMode: "card" | "list";
  mode: number;
  /** 当前范围下标（音乐：0 单曲 1 专辑 2 歌单 3 MV）。 */
  scopeIndex: number;
  /** 当前关键词（判断音乐首屏与过滤无结果）。 */
  keyword: string;
  /** 专辑/歌单/多集内页：形态固定为曲目行。 */
  isInnerPage?: boolean;
  /** 本页首条在整份结果里的序号偏移：分页后序号续接，不每页从 01 重排。 */
  pageOffset?: number;
  /** 重试：内页重载内页，否则重发当前范围。 */
  onRetry: () => void;
  /** 清除搜索（收藏 / 电台过滤后为空时）。 */
  onClearSearch: () => void;
  /**
   * 歌单 / 专辑内页的勾选（只在那里给）：键为绝对位置 `pageOffset + 行下标`。
   * 选择状态由容器持有——结果区随 `mediaData` 重置，放这里翻页就丢。
   */
  selection?: ResultsSelection;
}

export function ResultsArea({
  mediaData,
  settingsData,
  viewMode,
  mode,
  scopeIndex,
  keyword,
  isInnerPage = false,
  pageOffset = 0,
  onRetry,
  onClearSearch,
  selection,
}: ResultsAreaProps) {
  const {
    currentOnDemandPlay,
    switchToMultiPage,
    updateCurrentInMultiPageStatus,
  } = useContext(MediaContainerContext);

  const [load, setLoad] = useState<Load>({ status: "idle" });
  const [nowPlayingTitle, setNowPlayingTitle] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  /** 当前进场块的键、它出现前的加载状态和选中的动画（见渲染处）。 */
  const motion = useRef<{
    key: string;
    status: Load["status"];
    fade: boolean;
  }>({ key: "", status: "idle", fade: false });
  /** 外层结果的实时滚动位置（内页期间的滚动不更新它）。 */
  const outerScroll = useRef(0);
  /** 进入内页前的外层滚动位置与数据承诺（返回时只有同一份数据才还原位置）。 */
  const savedScroll = useRef(0);
  const savedOuterData = useRef<Promise<ResultsPayload> | null>(null);
  const previousData = useRef<Promise<ResultsPayload> | null>(mediaData);
  const wasInnerPage = useRef(isInnerPage);

  const supported = roomSupportsRequest();
  const trimmedKeyword = keyword.trim();
  /** 音乐首屏（单曲范围、关键词为空、非内页）：列出「最近点播」，列表 / 网格随视图切换。 */
  const firstScreen =
    mode === MODE.music && scopeIndex === 0 && !trimmedKeyword && !isInnerPage;
  const shape = shapeOf({
    mode,
    scopeIndex,
    viewMode,
    isInnerPage,
  });

  // Promise 状态机：只为最新的请求落地，旧请求的结果直接丢弃。
  useEffect(() => {
    if (!mediaData) {
      setLoad({ status: "idle" });
      return;
    }
    let alive = true;
    setLoad({ status: "loading" });
    mediaData.then(
      (data) => {
        if (alive) setLoad({ status: "ready", data });
      },
      () => {
        if (alive) setLoad({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [mediaData]);

  // 「房间正在播放」：只读订阅宿站标题，没人用时不轮询。
  useEffect(() => subscribeNowPlayingTitle(setNowPlayingTitle), []);

  // 换数据即清掉点按选中态，避免选中态跟到另一批结果上。
  useEffect(() => {
    setRevealedKey(null);
  }, [mediaData]);

  // 内页进出：进入时记住外层滚动位置并回到顶部；返回同一份外层结果时还原位置
  // （内页里发起新搜索 → 数据承诺变了 → 按新结果滚到顶部）。
  useEffect(() => {
    const node = scrollerRef.current;
    const previous = previousData.current;
    previousData.current = mediaData;
    if (!node) return;
    if (isInnerPage) {
      if (!wasInnerPage.current) {
        savedScroll.current = outerScroll.current;
        savedOuterData.current = previous;
      }
      wasInnerPage.current = true;
      node.scrollTop = 0;
      return;
    }
    if (wasInnerPage.current) {
      wasInnerPage.current = false;
      if (savedOuterData.current === mediaData) {
        node.scrollTop = savedScroll.current;
        return;
      }
    }
    node.scrollTop = 0;
  }, [mediaData, isInnerPage]);

  const handleScroll = (event: Event) => {
    const node = event.currentTarget as HTMLDivElement | null;
    if (!node || isInnerPage) return;
    outerScroll.current = node.scrollTop;
  };

  const play = (platformData: PlatformData) => {
    if (!roomSupportsRequest()) {
      notifyRoomUnsupported();
      return;
    }
    // 守卫：进行中加锁、同一条目 10 秒冷却、按钮显示点播中 / 已点播 / 重试
    void guardedRequest(platformData, currentOnDemandPlay, undefined, {
      minPendingMs: mode === MODE.radio ? RADIO_MIN_PENDING_MS : 0,
    });
  };

  const openCollection = async (platformData: PlatformData) => {
    await updateCurrentInMultiPageStatus(true);
    void switchToMultiPage(platformData);
  };

  const handleAreaClick = (event: MouseEvent) => {
    if (revealedKey === null) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("[data-imw-tile]")) return;
    setRevealedKey(null);
  };

  /** 表头文案：专辑/歌单的时长列换成曲目数。 */
  const durationLabel = shape === "collections" ? "曲目数" : "时长";

  /** 内页勾选只给内页的曲目行 / 音乐网格卡。 */
  const selectable = !!selection && isInnerPage;
  const selectProps = (
    platformData: PlatformData,
    index: number,
  ): SelectionProps => {
    if (!selection || !selectable) return {};
    const position = pageOffset + index;
    return {
      selectionOrder: selection.orderOf(position),
      onToggleSelect: () => selection.onToggle(position, platformData),
    };
  };

  const body = () => {
    if (shape === "settings") {
      if (!settingsData) return null;
      return (
        <div className={`${deskGutter} ${settingsPageClass}`}>
          <SettingsCards groups={settingsData} />
        </div>
      );
    }

    if (load.status !== "ready")
      return (
        <ResultsPlaceholder
          load={load}
          shape={shape}
          mode={mode}
          scopeIndex={scopeIndex}
          trimmedKeyword={trimmedKeyword}
          isInnerPage={isInnerPage}
          selectable={selectable}
          onRetry={onRetry}
        />
      );

    const items = load.data.platformData;
    if (items.length === 0) {
      const empty = emptyMessage({
        isInnerPage,
        firstScreen,
        shape,
        trimmedKeyword,
      });
      return (
        <StateMessage
          message={empty.message}
          action={empty.action}
          onAction={empty.action ? onClearSearch : undefined}
        />
      );
    }

    const square = shape === "musicGrid" || shape === "favoritesGrid";

    if (square || shape === "videoGrid") {
      return (
        <div className={deskGutter}>
          <div className={square ? musicGridClass : videoGridClass}>
            <ResultsTiles
              items={items}
              shape={shape}
              nowPlayingTitle={nowPlayingTitle}
              supported={supported}
              revealedKey={revealedKey}
              onReveal={setRevealedKey}
              onPlay={play}
              onOpenCollection={openCollection}
              selectProps={selectProps}
            />
          </div>
        </div>
      );
    }

    return (
      <div className={deskGutter}>
        <ResultsRows
          items={items}
          shape={shape}
          pageOffset={pageOffset}
          nowPlayingTitle={nowPlayingTitle}
          supported={supported}
          onPlay={play}
          onOpenCollection={openCollection}
          selectProps={selectProps}
        />
      </div>
    );
  };

  // 表头和「最近点播」标题放在动画块外面：骨架和结果都有它，换页、数据落地时不跟着闪。
  // 只在要列东西的时候出（骨架，或有结果），失败、提示和空态不带表头。
  const listing =
    shape !== "settings" &&
    (load.status === "ready"
      ? load.data.platformData.length > 0
      : placeholderKind({
          load,
          mode,
          scopeIndex,
          trimmedKeyword,
          isInnerPage,
        }) === "skeleton");
  const showHeader = listing && isRowShape(shape) && shape !== "radio";
  const lead = listing && (firstScreen || showHeader) && (
    <div className={deskGutter}>
      {firstScreen && (
        <h2 className={`mb-1 mt-4 ${typeLabelStrong} ${deskInk}`}>最近点播</h2>
      )}
      {showHeader && (
        <TracklistHeader
          durationLabel={durationLabel}
          selectable={selectable}
        />
      )}
    </div>
  );

  // 进场：换页 / 换范围 / 换视图时内容从下方 8px 淡入；骨架换成结果只淡入不位移，
  // 骨架和结果是平齐的，位移会让整页先往下掉再回来。按进场的键记住选了哪种，
  // 同一块内容重渲染（正在播放标题变了等）不会换动画、不会重播。
  const motionKey = `${load.status}:${shape}:${scopeIndex}:${pageOffset}`;
  if (motion.current.key !== motionKey) {
    const before = motion.current.status;
    motion.current = {
      key: motionKey,
      status: load.status,
      fade:
        load.status === "ready" && (before === "loading" || before === "idle"),
    };
  }
  const entrance = motion.current.fade
    ? "animate-[imwFadeIn_160ms_var(--imw-ease)]"
    : "animate-[imwRiseIn_200ms_var(--imw-ease)]";

  return (
    <div className="h-full min-h-0">
      <div
        ref={scrollerRef}
        className="h-full overflow-y-auto overflow-x-hidden pt-4 pb-8"
        data-imw-results="true"
        onScroll={handleScroll}
        onClick={handleAreaClick}
      >
        {lead}
        <div
          key={motionKey}
          className={`${entrance} motion-reduce:animate-none`}
        >
          {body()}
        </div>
      </div>
    </div>
  );
}
