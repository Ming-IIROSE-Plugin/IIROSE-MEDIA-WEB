// 结果区容器：Promise 状态机（loading / error / 空 / 未搜索）+ 按模式与范围选形态。
// 取代旧的 `MediaCard`：曲目表 / 音乐网格 / 视频网格 / 专辑·歌单行 / 状态部件都在这里选。
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { SettingsCards } from "../settings/SettingsGroup";
import { MediaContainerContext } from "../media-container-context/MediaContainerContext";
import { MODE } from "../desk/deskModes";
import { deskGutter, deskInk, typeLabelStrong } from "../floating-panel/tokens";
import { CollectionRow } from "./CollectionRow";
import { MusicTile } from "./MusicTile";
import { SkeletonRows, SkeletonTiles } from "./Skeletons";
import { StateMessage } from "./StateMessage";
import { TracklistHeader, TracklistRow } from "./TracklistRow";
import { VideoTile } from "./VideoTile";
import { isPhoneLayout } from "./mediaFormat";
import { isNowPlayingTitle, subscribeNowPlayingTitle } from "./nowPlaying";
import { notifyRoomUnsupported, roomSupportsRequest } from "./roomSupport";

export interface ResultsPayload {
  platformData: PlatformData[];
  totalPage: number;
}

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
}

type Shape =
  | "settings"
  | "tracklist"
  | "musicGrid"
  | "videoGrid"
  | "collections"
  | "radio"
  | "favorites";

type Load =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ResultsPayload };

const musicGridClass =
  "grid grid-cols-5 gap-x-[22px] gap-y-[22px] [grid-auto-rows:max-content] max-[768px]:grid-cols-3 max-[768px]:gap-x-3 max-[768px]:gap-y-4";
const videoGridClass =
  "grid grid-cols-4 gap-x-[22px] gap-y-[26px] [grid-auto-rows:max-content] max-[768px]:grid-cols-2 max-[768px]:gap-x-3 max-[768px]:gap-y-[18px]";
/** 设置 / 关于：纸色底上的卡列（卡宽随内容区收敛，卡间 24px，DESIGN.md `settings-group.note`）。 */
const settingsPageClass =
  "flex max-w-[760px] flex-col gap-6 pb-4 pt-6 max-[768px]:pb-6";

/** 形态由「模式 + 范围 + 视图 + 内页」派生，不新增 prop 爆炸。 */
export function shapeOf(options: {
  mode: number;
  scopeIndex: number;
  viewMode: "card" | "list";
  isInnerPage: boolean;
}): Shape {
  const { mode, scopeIndex, viewMode, isInnerPage } = options;
  if (isInnerPage) return "tracklist";
  if (mode === MODE.settings || mode === MODE.about) return "settings";
  if (mode === MODE.radio) return "radio";
  if (mode === MODE.favorites) return "favorites";
  if (mode === MODE.video)
    return viewMode === "list" ? "tracklist" : "videoGrid";
  if (mode === MODE.music) {
    if (scopeIndex === 1 || scopeIndex === 2) return "collections";
    if (scopeIndex === 3) return "videoGrid";
    return viewMode === "list" ? "tracklist" : "musicGrid";
  }
  return "tracklist";
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
}: ResultsAreaProps) {
  const {
    currentOnDemandPlay,
    onRowActivate,
    switchToMultiPage,
    updateCurrentInMultiPageStatus,
  } = useContext(MediaContainerContext);

  const [load, setLoad] = useState<Load>({ status: "idle" });
  const [nowPlayingTitle, setNowPlayingTitle] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  /** 外层结果的实时滚动位置（内页期间的滚动不更新它）。 */
  const outerScroll = useRef(0);
  /** 进入内页前的外层滚动位置与数据承诺（返回时只有同一份数据才还原位置）。 */
  const savedScroll = useRef(0);
  const savedOuterData = useRef<Promise<ResultsPayload> | null>(null);
  const previousData = useRef<Promise<ResultsPayload> | null>(mediaData);
  const wasInnerPage = useRef(isInnerPage);

  const supported = roomSupportsRequest();
  const trimmedKeyword = keyword.trim();
  /** 音乐首屏（单曲范围、关键词为空、非内页）：列出「最近点播」，固定曲目表。 */
  const firstScreen =
    mode === MODE.music && scopeIndex === 0 && !trimmedKeyword && !isInnerPage;
  const shape = shapeOf({
    mode,
    scopeIndex,
    viewMode: firstScreen ? "list" : viewMode,
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
    currentOnDemandPlay(platformData);
  };

  /** 行 / 卡的主体点击：手机上挂操作条，桌面不动作。触发元素用于收起后归还焦点。 */
  const activate = (
    platformData: PlatformData,
    trigger?: HTMLElement | null,
  ) => {
    if (!isPhoneLayout()) return;
    onRowActivate?.(platformData, trigger ?? null);
  };

  const openCollection = async (platformData: PlatformData) => {
    await updateCurrentInMultiPageStatus(true);
    void switchToMultiPage(platformData);
  };

  const isNowPlaying = (platformData: PlatformData) =>
    isNowPlayingTitle(nowPlayingTitle, platformData);

  const handleAreaClick = (event: MouseEvent) => {
    if (revealedKey === null) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("[data-imw-tile]")) return;
    setRevealedKey(null);
  };

  const emptyState = (): { message: string; action?: string } => {
    // 内页没有关键词可换：空列表说明这张专辑/歌单本身没有曲目。
    if (isInnerPage) return { message: "这张列表没有曲目。" };
    if (firstScreen)
      return { message: "还没有点播记录。搜索歌名或歌手，点播到房间。" };
    if (shape === "favorites") {
      return trimmedKeyword
        ? { message: "没有匹配的收藏", action: "清除搜索" }
        : { message: "还没有收藏。在曲目旁点星标即可收藏。" };
    }
    if (shape === "radio" && trimmedKeyword)
      return { message: "没有匹配的电台", action: "清除搜索" };
    return { message: "没有找到结果。换个关键词试试。" };
  };

  /** 表头文案：专辑/歌单的时长列换成曲目数。 */
  const durationLabel = shape === "collections" ? "曲目数" : "时长";

  const renderRows = (items: PlatformData[]) => {
    if (shape === "collections") {
      return items.map((platformData, index) => (
        <CollectionRow
          key={`${index}:${platformData.title}`}
          platformData={platformData}
          index={pageOffset + index + 1}
          onOpen={() => openCollection(platformData)}
        />
      ));
    }
    return items.map((platformData, index) => (
      <TracklistRow
        key={`${index}:${platformData.title}`}
        platformData={platformData}
        index={pageOffset + index + 1}
        variant={shape === "radio" ? "radio" : "track"}
        nowPlaying={isNowPlaying(platformData)}
        supported={supported}
        onPlay={() => play(platformData)}
        onActivate={(trigger) => activate(platformData, trigger)}
      />
    ));
  };

  const renderTiles = (items: PlatformData[]) =>
    items.map((platformData, index) => {
      const key = `${index}:${platformData.title}`;
      const revealed = revealedKey === key;
      return shape === "musicGrid" ? (
        <MusicTile
          key={key}
          platformData={platformData}
          nowPlaying={isNowPlaying(platformData)}
          supported={supported}
          revealed={revealed}
          onReveal={() => setRevealedKey(key)}
          onPlay={() => play(platformData)}
          onActivate={(trigger) => activate(platformData, trigger)}
        />
      ) : (
        <VideoTile
          key={key}
          platformData={platformData}
          nowPlaying={isNowPlaying(platformData)}
          supported={supported}
          revealed={revealed}
          onReveal={() => setRevealedKey(key)}
          onPlay={() => play(platformData)}
          onActivate={(trigger) => activate(platformData, trigger)}
          // 课程没有分 P 详情 / 播放流接口（课程流走 `BiliBiliCourseApi`）：面板取不到
          // 分集，桌面保留内页钻取这条既有能力；其余多 P / 多集由面板接管。
          onSelectEpisodes={
            platformData.bilibili?.course_id
              ? () => void openCollection(platformData)
              : undefined
          }
        />
      );
    });

  const body = () => {
    if (shape === "settings") {
      if (!settingsData) return null;
      return (
        <div className={`${deskGutter} ${settingsPageClass}`}>
          <SettingsCards groups={settingsData} />
        </div>
      );
    }

    if (load.status === "error")
      return (
        <StateMessage message="加载失败" action="重试" onAction={onRetry} />
      );

    if (load.status === "loading") {
      return shape === "tracklist" ||
        shape === "collections" ||
        shape === "favorites" ||
        shape === "radio" ? (
        <div className={deskGutter}>
          <SkeletonRows />
        </div>
      ) : (
        <div
          className={`${deskGutter} ${shape === "musicGrid" ? musicGridClass : videoGridClass}`}
        >
          <SkeletonTiles
            count={shape === "musicGrid" ? 10 : 8}
            aspect={shape === "musicGrid" ? "square" : "video"}
          />
        </div>
      );
    }

    const items = load.status === "ready" ? load.data.platformData : [];
    if (items.length === 0) {
      const empty = emptyState();
      return (
        <StateMessage
          message={empty.message}
          action={empty.action}
          onAction={empty.action ? onClearSearch : undefined}
        />
      );
    }

    if (shape === "musicGrid" || shape === "videoGrid") {
      return (
        <div
          className={`${deskGutter} ${shape === "musicGrid" ? musicGridClass : videoGridClass}`}
        >
          {renderTiles(items)}
        </div>
      );
    }

    return (
      <div className={deskGutter}>
        {firstScreen && items.length > 0 && (
          <h2 className={`mb-1 mt-4 ${typeLabelStrong} ${deskInk}`}>
            最近点播
          </h2>
        )}
        {shape !== "radio" && <TracklistHeader durationLabel={durationLabel} />}
        {renderRows(items)}
      </div>
    );
  };

  return (
    <div className="h-full min-h-0">
      <div
        ref={scrollerRef}
        className="h-full overflow-y-auto overflow-x-hidden pb-8"
        data-imw-results="true"
        onScroll={handleScroll}
        onClick={handleAreaClick}
      >
        {body()}
      </div>
    </div>
  );
}
