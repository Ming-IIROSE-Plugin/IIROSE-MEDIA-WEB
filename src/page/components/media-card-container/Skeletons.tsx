// 加载骨架（DESIGN.md `skeleton-row` / `skeleton-tile`）：静态色块，无闪光动画。
// 曲目表用骨架行，视频 / 音乐网格用骨架瓦片。
// 骨架和数据落地后的行 / 卡平齐：外框、列模板、每一行文字所在的行盒都和真组件用同一套类，
// 色条不自己定行高——换字号或行高时两边一起变，不会跳。
import type { JSX } from "preact";
import {
  deskSkeleton,
  roundedLg,
  roundedTrackCover,
  roundedXs,
  typeMonoNum,
  typeMonoNumSm,
  typeRowMeta,
  typeRowMetaSource,
  typeRowTitle,
  typeVideoMeta,
  typeVideoTitle,
} from "../floating-panel/tokens";
import { rowBox, selectableTrackColumns, trackColumns } from "./TracklistRow";

/** 单元格里的色条（格子本身由列模板和行高定位，条只是居中的一段）。 */
function Bar({ className }: { className: string }): JSX.Element {
  return (
    <span
      className={`inline-block align-middle rounded-full ${deskSkeleton} ${className}`}
    />
  );
}

/**
 * 一行文字的骨架：行里写一个透明的汉字撑出行盒，色条压在行盒正中。
 * 真标题多是中文，中文落在后备字体上，行盒和只有西文字体的空行不一样高；
 * 只放色条的话每行差 1～2px，网格第二排会跟着错。字直接写在行里（和真标题一样是裸文字），
 * 包一层 span 会多出一个内联盒，基线对不齐又会多 1px。
 */
function Line({ type, bar }: { type: string; bar: string }): JSX.Element {
  return (
    <div className={`relative select-none text-transparent ${type}`}>
      字
      <span
        className={`absolute inset-y-0 left-0 my-auto rounded-full ${deskSkeleton} ${bar}`}
      />
    </div>
  );
}

/**
 * 骨架行：与 `TracklistRow` 同一个外框和列模板（可勾选时多出勾选列），每格放在真行同一格的位置上。
 * 条数与页大小一致（10），数据落地时不跳行。电台行只有台标、台名和点播列。
 */
export function SkeletonRows({
  count = 10,
  variant = "track",
  selectable = false,
}: {
  count?: number;
  variant?: "track" | "radio";
  selectable?: boolean;
}) {
  const radio = variant === "radio";
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`${rowBox} ${selectable ? selectableTrackColumns : trackColumns} min-h-[62px] max-[768px]:min-h-[66px]`}
          data-imw-skeleton-row="true"
        >
          {selectable && (
            <span className="flex h-8 w-8 items-center justify-center">
              <span className={`block h-5 w-5 ${roundedXs} ${deskSkeleton}`} />
            </span>
          )}

          <span className="grid place-items-center max-[768px]:hidden">
            {!radio && (
              <span className={typeMonoNum}>
                <Bar className="h-[10px] w-[16px]" />
              </span>
            )}
          </span>

          <span
            className={`block h-[42px] w-[42px] max-[768px]:h-12 max-[768px]:w-12 ${roundedTrackCover} ${deskSkeleton}`}
          />

          <div className="min-w-0">
            <Line type={typeRowTitle} bar="h-2 w-[40%]" />
            <Line type={typeRowMeta} bar="h-1.5 w-[24%]" />
          </div>

          <span
            className={`flex items-center gap-1.5 max-[768px]:hidden ${typeRowMetaSource}`}
          >
            {!radio && <Bar className="h-2 w-[72px] max-w-full" />}
          </span>

          <span className={`max-[768px]:hidden ${typeMonoNum}`}>
            {!radio && <Bar className="h-2 w-[38px]" />}
          </span>
          <span className={`hidden max-[768px]:block ${typeMonoNumSm}`}>
            {!radio && <Bar className="h-2 w-[30px]" />}
          </span>

          <span className="grid place-items-center">
            {!radio && (
              <span
                className={`block h-[14px] w-[14px] rounded-full ${deskSkeleton}`}
              />
            )}
          </span>

          <span
            className={`block h-8 w-full rounded-full max-[768px]:h-10 max-[768px]:w-10 max-[768px]:justify-self-center ${deskSkeleton}`}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * 骨架瓦片：封面块的比例和圆角同所替代的卡片，下方文字区照搬卡片的结构。
 * 方形卡（`MusicTile`）：标题行 + 副行，右侧留出收藏星的 32px；
 * 视频卡（`VideoTile`）：标题按两行留（B 站标题在四列里几乎都折成两行，网格行高取最高的那张），再一行 UP 主。
 * 音乐网格两行满格（5 列）取 10，视频网格两行满格（4 列）取 8。
 */
export function SkeletonTiles({
  count = 8,
  aspect = "video",
}: {
  count?: number;
  aspect?: "video" | "square";
}) {
  const square = aspect === "square";
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="min-w-0"
          data-imw-skeleton-tile="true"
        >
          <div
            className={`w-full ${roundedLg} ${square ? "aspect-square" : "aspect-video"} ${deskSkeleton}`}
          />
          {square ? (
            <div className="mt-2 flex items-start gap-1.5">
              <div className="min-w-0 flex-1">
                <Line type={typeVideoTitle} bar="h-2 w-[70%]" />
                <Line type={typeVideoMeta} bar="h-1.5 w-[45%]" />
              </div>
              <span className="h-8 w-8 shrink-0" />
            </div>
          ) : (
            <>
              <div className="mt-2">
                <Line type={typeVideoTitle} bar="h-2 w-[90%]" />
                <Line type={typeVideoTitle} bar="h-2 w-[55%]" />
              </div>
              <div className="mt-0.5">
                <Line type={typeVideoMeta} bar="h-1.5 w-[40%]" />
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}
