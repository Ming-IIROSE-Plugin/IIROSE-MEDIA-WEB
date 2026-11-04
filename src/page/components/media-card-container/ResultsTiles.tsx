// 结果区的网格形态：音乐 / 收藏方形卡与视频卡。收藏网格里专辑 / 歌单的胶囊是「查看」。
// 只管按形态出卡，点播 / 进内页 / 勾选 / 首点显形都由容器传入。
import type { JSX } from "preact";
import { MusicTile } from "./MusicTile";
import { VideoTile } from "./VideoTile";
import { isCollectionItem } from "./mediaFormat";
import { isNowPlayingTitle } from "./nowPlaying";
import type { SelectionProps, Shape } from "./resultsModel";

export interface ResultsTilesProps {
  items: PlatformData[];
  shape: Shape;
  /** 房间正在播放的标题（空串 = 未取到）。 */
  nowPlayingTitle: string;
  /** 房间是否支持点播（灰化按钮）。 */
  supported: boolean;
  /** 手机首点显形的卡片键（`${index}:${title}`）。 */
  revealedKey: string | null;
  onReveal: (key: string) => void;
  onPlay: (platformData: PlatformData) => void;
  onOpenCollection: (platformData: PlatformData) => void;
  selectProps: (platformData: PlatformData, index: number) => SelectionProps;
}

export function ResultsTiles({
  items,
  shape,
  nowPlayingTitle,
  supported,
  revealedKey,
  onReveal,
  onPlay,
  onOpenCollection,
  selectProps,
}: ResultsTilesProps): JSX.Element {
  return (
    <>
      {items.map((platformData, index) => {
        const key = `${index}:${platformData.title}`;
        const revealed = revealedKey === key;
        // 收藏网格里歌曲、视频、专辑混排：统一方形卡（视频封面方形裁切）
        // 收藏网格里的专辑 / 歌单：胶囊是「查看」，点卡片或胶囊都进内页
        const collection =
          shape === "favoritesGrid" && isCollectionItem(platformData);
        const open = () => void onOpenCollection(platformData);
        return shape === "musicGrid" || shape === "favoritesGrid" ? (
          <MusicTile
            key={key}
            platformData={platformData}
            nowPlaying={isNowPlayingTitle(nowPlayingTitle, platformData)}
            supported={collection || supported}
            revealed={revealed}
            onReveal={() => onReveal(key)}
            onPlay={collection ? open : () => onPlay(platformData)}
            idleLabel={collection ? "查看" : "点播"}
            {...selectProps(platformData, index)}
          />
        ) : (
          <VideoTile
            key={key}
            platformData={platformData}
            nowPlaying={isNowPlayingTitle(nowPlayingTitle, platformData)}
            supported={supported}
            revealed={revealed}
            onReveal={() => onReveal(key)}
            onPlay={() => onPlay(platformData)}
            // 课程没有分 P 详情 / 播放流接口（课程流走 `BiliBiliCourseApi`）：面板取不到
            // 分集，桌面保留内页钻取这条既有能力；其余多 P / 多集由面板接管。
            onSelectEpisodes={
              platformData.bilibili?.course_id
                ? () => void onOpenCollection(platformData)
                : undefined
            }
          />
        );
      })}
    </>
  );
}
