// 加载骨架（DESIGN.md `skeleton-row` / `skeleton-tile`）：静态色块，无闪光动画。
// 曲目表用骨架行，视频 / 音乐网格用骨架瓦片。
import {
  deskRule,
  deskSkeleton,
  roundedLg,
  roundedTrackCover,
} from "../floating-panel/tokens";
import { trackColumns } from "./TracklistRow";

/** 骨架行：封面块 + 标题条 40% 宽 + 副行条 24% 宽，行高与曲目行一致。 */
export function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`${trackColumns} min-h-[62px] border-0 border-b border-solid max-[768px]:min-h-[66px] ${deskRule}`}
          data-imw-skeleton-row="true"
        >
          <span className="grid place-items-center max-[768px]:hidden">
            <span
              className={`block h-[10px] w-[14px] rounded-full ${deskSkeleton}`}
            />
          </span>
          <span
            className={`block h-[42px] w-[42px] max-[768px]:h-12 max-[768px]:w-12 ${roundedTrackCover} ${deskSkeleton}`}
          />
          <span className="min-w-0">
            <span
              className={`block h-2 w-[40%] rounded-full ${deskSkeleton}`}
            />
            <span
              className={`mt-2 block h-1.5 w-[24%] rounded-full ${deskSkeleton}`}
            />
          </span>
          <span className="max-[768px]:hidden" />
          <span
            className={`block h-[10px] w-[34px] rounded-full max-[768px]:hidden ${deskSkeleton}`}
          />
          <span
            className={`hidden h-[10px] w-[34px] rounded-full max-[768px]:block ${deskSkeleton}`}
          />
          <span className="max-[768px]:hidden" />
          <span
            className={`block h-8 w-full rounded-full max-[768px]:h-10 max-[768px]:w-10 max-[768px]:justify-self-center ${deskSkeleton}`}
          />
        </div>
      ))}
    </div>
  );
}

/** 骨架瓦片：封面块 + 下方两根条，圆角同所替代的卡片（16:9 或 1:1）。 */
export function SkeletonTiles({
  count = 8,
  aspect = "video",
}: {
  count?: number;
  aspect?: "video" | "square";
}) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} aria-hidden="true" data-imw-skeleton-tile="true">
          <div
            className={`w-full ${roundedLg} ${aspect === "square" ? "aspect-square" : "aspect-video"} ${deskSkeleton}`}
          />
          <div className={`mt-2 h-2 w-[70%] rounded-full ${deskSkeleton}`} />
          <div className={`mt-2 h-1.5 w-[40%] rounded-full ${deskSkeleton}`} />
        </div>
      ))}
    </>
  );
}
