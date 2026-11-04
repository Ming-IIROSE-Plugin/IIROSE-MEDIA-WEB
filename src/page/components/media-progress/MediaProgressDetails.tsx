// 播放进度浮窗的媒体资料块：封面 + 标题 + 时间。只读展示，状态仍由父组件持有。
import type { MediaSnapshot } from "../../../media-progress/model";
import { formatTime } from "../../../media-progress/model";
import { Svg } from "../floating-panel/floatingPanel";
import { deskInk2, deskThumb } from "../floating-panel/tokens";

export const ClockIcon = () => (
  <Svg size={22}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

const NoteIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    aria-hidden="true"
  >
    <path d="M9 18V5l11-2v13M9 8l11-2" />
    <ellipse cx="6" cy="18" rx="3" ry="2.5" />
    <ellipse cx="17" cy="16" rx="3" ry="2.5" />
  </svg>
);

export function MediaProgressDetails({
  media,
  time,
  previewing,
  failedCover,
  onCoverError,
}: {
  media: MediaSnapshot;
  /** 当前显示时间：预览值优先，否则宿站进度。 */
  time: number | null;
  previewing: boolean;
  /** 已加载失败的封面地址（同一地址不再重试）。 */
  failedCover: string;
  onCoverError: (cover: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl ${deskThumb} ${deskInk2}`}
      >
        {media.playing && media.cover && failedCover !== media.cover ? (
          <img
            className="h-full w-full object-cover"
            src={media.cover}
            alt=""
            onError={() => onCoverError(media.cover)}
          />
        ) : (
          <NoteIcon />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate font-semibold"
          title={media.playing ? media.title : "暂无播放内容"}
        >
          {media.playing ? media.title : "暂无播放内容"}
        </div>
        <div className={`mt-1 text-[12px] tabular-nums ${deskInk2}`}>
          {formatTime(media.playing ? time : null)} /{" "}
          {formatTime(media.playing ? media.duration : null)}
          {previewing ? " · 预览" : ""}
        </div>
      </div>
    </div>
  );
}
