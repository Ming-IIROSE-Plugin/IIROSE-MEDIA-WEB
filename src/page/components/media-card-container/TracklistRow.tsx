// 曲目行与曲目表表头（DESIGN.md `tracklist-row` / `tracklist-header`）。
// 桌面七列（序号 / 封面 / 标题+歌手 / 出处 / 时长 / 星标 / 点播胶囊），
// 手机四列（封面 / 标题+歌手 / 时长 / 40px 点播钮），手机不显示表头、序号、出处与星标。
// 音乐、收藏、电台与专辑/歌单内页共用这个结构；电台行只用到封面、台名与点播列。
import { Cover } from "./Cover";
import { FavoriteStar } from "./FavoriteStar";
import { formatDuration, isVideoItem, sourceOf } from "./mediaFormat";
import { notifyRoomUnsupported } from "./roomSupport";
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk2,
  deskInk3,
  deskRose,
  deskRoseFill,
  deskRowHover,
  deskRule,
  deskSendHover,
  deskSourceDots,
  roundedRequestButton,
  roundedTrackCover,
  typeButtonSm,
  typeMonoCaption,
  typeMonoNum,
  typeMonoNumSm,
  typeRowMeta,
  typeRowMetaSource,
  typeRowTitle,
} from "../floating-panel/tokens";

/** 桌面七列 / 手机四列；表头与所有行共用，列宽不会漂移。 */
export const trackColumns =
  "grid grid-cols-[38px_56px_1.6fr_1fr_74px_44px_96px] items-center gap-3 max-[768px]:grid-cols-[48px_1fr_auto_40px]";

const rowFrame = `group w-full border-0 border-b border-solid ${deskRule} bg-transparent text-left ${deskRowHover} mx-[-14px] px-[14px] max-[768px]:mx-0 max-[768px]:px-0`;

/** 三根 3px 蔷薇红音柱：替换序号表示「房间正在播放」（不只靠颜色）。 */
export function NowPlayingBars({
  className = "",
  tone = deskRoseFill,
}: {
  className?: string;
  tone?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-imw-now-playing="true"
      className={`flex h-[14px] items-end justify-center gap-[2px] ${className}`}
    >
      {[8, 14, 11].map((height) => (
        <span
          key={height}
          className={`block w-[3px] rounded-full ${tone}`}
          style={{ height: `${height}px` }}
        />
      ))}
    </span>
  );
}

/** 出处列：来源圆点 + 平台简称（圆点从不单独承载信息）。 */
export function SourceCell({ platformData }: { platformData: PlatformData }) {
  const source = sourceOf(platformData);
  if (!source.key && !source.label) return null;
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 max-[768px]:hidden ${typeRowMetaSource} ${deskInk3}`}
    >
      {source.key && (
        <span
          aria-hidden="true"
          className={`h-[7px] w-[7px] shrink-0 rounded-full ${deskSourceDots[source.key]}`}
        />
      )}
      <span className="truncate">{source.label}</span>
    </span>
  );
}

export interface RequestButtonProps {
  /** 房间不支持点播：40% 不透明、无悬停实心态，但仍可聚焦并说明原因。 */
  supported?: boolean;
  onPlay: () => void;
  /** 手机上的读屏名（桌面显示「点播」文字）。 */
  label?: string;
}

/** 点播按钮：桌面描边胶囊、悬停整行时转实心蔷薇红；手机 40px 方钮（点击区 44px）。 */
export function RequestButton({
  supported = true,
  onPlay,
  label = "点播",
}: RequestButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={!supported}
      title={supported ? "点播到房间" : "这个房间不支持点播"}
      className={`relative flex w-full cursor-pointer items-center justify-center gap-1.5 border border-solid bg-transparent p-0 ${roundedRequestButton} ${deskRule} ${deskInk2} ${deskFocusRing} ${typeButtonSm} after:absolute after:-inset-[2px] after:content-[''] h-8 max-[768px]:h-10 max-[768px]:w-10 max-[768px]:justify-self-center ${supported ? deskSendHover : "opacity-40"}`}
      onClick={(event) => {
        event.stopPropagation();
        if (!supported) {
          notifyRoomUnsupported();
          return;
        }
        onPlay();
      }}
    >
      <DeskIcon name="play" size={14} />
      <span className="max-[768px]:hidden">点播</span>
    </button>
  );
}

export interface TracklistRowProps {
  platformData: PlatformData;
  /** 1 起的序号（手机不显示）。 */
  index?: number;
  /** `radio`：无序号、无出处、无星标（电台行只用台标、台名与点播列）。 */
  variant?: "track" | "radio";
  nowPlaying?: boolean;
  supported?: boolean;
  onPlay: () => void;
  /** 行体点击 = 手机操作条的挂点（story 4 填充），桌面无动作。 */
  onActivate?: () => void;
}

export function TracklistRow({
  platformData,
  index,
  variant = "track",
  nowPlaying = false,
  supported = true,
  onPlay,
  onActivate,
}: TracklistRowProps) {
  const radio = variant === "radio";
  const duration = formatDuration(platformData.duration);

  return (
    <div
      className={`${rowFrame} ${trackColumns} min-h-[62px] max-[768px]:min-h-[66px]`}
      data-imw-tracklist-row="true"
      data-now-playing={nowPlaying ? "true" : undefined}
      onClick={onActivate}
    >
      <span className="grid place-items-center max-[768px]:hidden">
        {!radio &&
          (nowPlaying ? (
            <NowPlayingBars />
          ) : (
            <span className={`${typeMonoNum} ${deskInk3}`}>
              {String(index ?? 0).padStart(2, "0")}
            </span>
          ))}
      </span>

      <Cover
        src={platformData.coverImg}
        icon={radio ? "radio" : isVideoItem(platformData) ? "film" : "note"}
        rounded={roundedTrackCover}
        className="h-[42px] w-[42px] max-[768px]:h-12 max-[768px]:w-12"
      />

      <div className="min-w-0">
        <div
          className={`truncate ${typeRowTitle} ${nowPlaying ? deskRose : deskInk}`}
        >
          {platformData.title}
        </div>
        <div className={`truncate ${typeRowMeta} ${deskInk2}`}>
          {platformData.author}
          {nowPlaying && <span> · 房间正在播放</span>}
        </div>
      </div>

      {radio ? (
        <span className="max-[768px]:hidden" />
      ) : (
        <SourceCell platformData={platformData} />
      )}

      <span className={`${typeMonoNum} ${deskInk2} max-[768px]:hidden`}>
        {duration}
      </span>
      <span className={`hidden ${typeMonoNumSm} ${deskInk2} max-[768px]:block`}>
        {duration}
      </span>

      <span className="grid place-items-center max-[768px]:hidden">
        {!radio && <FavoriteStar platformData={platformData} />}
      </span>

      <RequestButton supported={supported} onPlay={onPlay} />
    </div>
  );
}

/** 表头：仅桌面（手机不显示）。列名与行同宽，等宽大写。 */
export function TracklistHeader({
  durationLabel = "时长",
}: {
  durationLabel?: string;
}) {
  return (
    <div
      className={`${trackColumns} h-[34px] border-0 border-b border-solid ${deskRule} ${typeMonoCaption} ${deskInk3} max-[768px]:hidden`}
      aria-hidden="true"
      data-imw-tracklist-header="true"
    >
      <span className="px-1">#</span>
      <span />
      <span className="px-1">标题</span>
      <span className="px-1">出处</span>
      <span className="px-1">{durationLabel}</span>
      <span />
      <span />
    </div>
  );
}
