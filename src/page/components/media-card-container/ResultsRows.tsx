// 结果区的行形态：曲目表（含收藏里的专辑 / 歌单行）、专辑·歌单范围、电台行。
// 只管按形态出行，点播 / 进内页 / 勾选都由容器传入。
import type { JSX } from "preact";
import { CollectionRow } from "./CollectionRow";
import { TracklistRow } from "./TracklistRow";
import { isCollectionItem } from "./mediaFormat";
import { isNowPlayingTitle } from "./nowPlaying";
import type { SelectionProps, Shape } from "./resultsModel";

export interface ResultsRowsProps {
  items: PlatformData[];
  shape: Shape;
  /** 本页首条在整份结果里的序号偏移。 */
  pageOffset: number;
  /** 房间正在播放的标题（空串 = 未取到）。 */
  nowPlayingTitle: string;
  /** 房间是否支持点播（灰化按钮）。 */
  supported: boolean;
  onPlay: (platformData: PlatformData) => void;
  onOpenCollection: (platformData: PlatformData) => void;
  /** 内页勾选 props：位置 = pageOffset + 行下标。 */
  selectProps: (platformData: PlatformData, index: number) => SelectionProps;
}

export function ResultsRows({
  items,
  shape,
  pageOffset,
  nowPlayingTitle,
  supported,
  onPlay,
  onOpenCollection,
  selectProps,
}: ResultsRowsProps): JSX.Element {
  const isNowPlaying = (platformData: PlatformData) =>
    isNowPlayingTitle(nowPlayingTitle, platformData);

  if (shape === "collections") {
    return (
      <>
        {items.map((platformData, index) => (
          <CollectionRow
            key={`${index}:${platformData.title}`}
            platformData={platformData}
            index={pageOffset + index + 1}
            onOpen={() => onOpenCollection(platformData)}
          />
        ))}
      </>
    );
  }
  return (
    <>
      {items.map((platformData, index) =>
        // 收藏里的专辑 / 歌单：与搜索结果同一种行（曲目数 + 「查看」进内页）
        shape === "favorites" && isCollectionItem(platformData) ? (
          <CollectionRow
            key={`${index}:${platformData.title}`}
            platformData={platformData}
            index={pageOffset + index + 1}
            onOpen={() => onOpenCollection(platformData)}
          />
        ) : (
          <TracklistRow
            key={`${index}:${platformData.title}`}
            platformData={platformData}
            index={pageOffset + index + 1}
            variant={shape === "radio" ? "radio" : "track"}
            nowPlaying={isNowPlaying(platformData)}
            supported={supported}
            onPlay={() => onPlay(platformData)}
            {...selectProps(platformData, index)}
          />
        ),
      )}
    </>
  );
}
