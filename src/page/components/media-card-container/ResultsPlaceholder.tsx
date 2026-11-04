// 结果区在数据落地前的三种落点：加载失败（可重试）、未发请求的搜索提示、骨架。
// 数据就绪（ready）后的空态与内容由容器渲染。
import type { JSX } from "preact";
import { MODE } from "../desk/deskModes";
import { deskGutter } from "../floating-panel/tokens";
import { SkeletonRows, SkeletonTiles } from "./Skeletons";
import { StateMessage } from "./StateMessage";
import {
  musicGridClass,
  videoGridClass,
  type Load,
  type Shape,
} from "./resultsModel";

export interface ResultsPlaceholderProps {
  load: Load;
  shape: Shape;
  mode: number;
  scopeIndex: number;
  trimmedKeyword: string;
  isInnerPage: boolean;
  onRetry: () => void;
}

export function ResultsPlaceholder({
  load,
  shape,
  mode,
  scopeIndex,
  trimmedKeyword,
  isInnerPage,
  onRetry,
}: ResultsPlaceholderProps): JSX.Element | null {
  if (load.status === "error")
    return <StateMessage message="加载失败" action="重试" onAction={onRetry} />;

  // 方形卡网格：音乐网格与收藏网格
  const square = shape === "musicGrid" || shape === "favoritesGrid";

  // idle = 还没有任何数据承诺（首次进入某模式 / 恢复到 `mediaData: null` 的快照）：
  // 此时渲染骨架，不能落到空态——否则会闪一帧「没有找到结果」。
  // 例外：空关键词的视频模式 / 音乐专辑·歌单·MV 范围不会自己发请求，idle 是常态，
  // 骨架会永远转下去——这里给搜索提示。
  if (
    load.status === "idle" &&
    !trimmedKeyword &&
    !isInnerPage &&
    (mode === MODE.video || (mode === MODE.music && scopeIndex !== 0))
  ) {
    return (
      <StateMessage
        message={
          mode === MODE.video
            ? "输入关键词或粘贴 BV 号，搜索视频。"
            : "输入关键词开始搜索。"
        }
      />
    );
  }

  if (load.status === "idle" || load.status === "loading") {
    return shape === "tracklist" ||
      shape === "collections" ||
      shape === "favorites" ||
      shape === "radio" ? (
      <div className={deskGutter}>
        <SkeletonRows />
      </div>
    ) : (
      <div
        className={`${deskGutter} ${square ? musicGridClass : videoGridClass}`}
      >
        <SkeletonTiles
          count={square ? 10 : 8}
          aspect={square ? "square" : "video"}
        />
      </div>
    );
  }

  return null;
}
