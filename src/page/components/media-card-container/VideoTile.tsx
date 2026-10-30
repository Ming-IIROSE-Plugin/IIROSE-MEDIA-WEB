// 视频卡（DESIGN.md `video-tile`）：16:9 缩略图、无卡片框；右下角等宽时长胶囊，
// 直播换「直播」徽章且不显示时长；悬停 / 键盘聚焦 / 无悬停宽屏点按选中时覆遮罩并出现
// 「点播到房间」胶囊。MV、B 站视频、多源剧集与直播共用本组件。
// 多 P / 多集的选集由插件自有面板接管（story 5）；只有面板服务不了的 B 站课程卡
// 仍带一个「选集」文字钮，走内页钻取。
import { requestLabel, useRequestStatus } from "./requestStatus";
import { Cover } from "./Cover";
import { FavoriteStar } from "./FavoriteStar";
import {
  formatDuration,
  isLiveItem,
  isPhoneLayout,
  isTapToReveal,
} from "./mediaFormat";
import { NowPlayingBars } from "./TracklistRow";
import {
  deskDurationPill,
  deskFocusRingOnRose,
  deskInk,
  deskInk3,
  deskOnRose,
  deskOnRoseFill,
  deskRoseSolid,
  deskSelectedRing,
  deskVideoScrim,
  roundedLg,
  roundedXs,
  typeLabelStrong,
  typeMonoPill,
  typeVideoMeta,
  typeVideoTitle,
  deskPress,
} from "../floating-panel/tokens";
import { DeskIcon } from "../floating-panel/tokens";

export interface VideoTileProps {
  platformData: PlatformData;
  /** 房间正在放这条（视频列表里同样要标出来）。 */
  nowPlaying?: boolean;
  supported?: boolean;
  revealed?: boolean;
  onReveal?: () => void;
  onPlay: () => void;
  /** 手机点缩略图（点播按钮以外）= 操作条挂点（触发元素用于收起后归还焦点）。 */
  onActivate?: (trigger: HTMLElement) => void;
  /**
   * 桌面「选集」入口：只给选集面板服务不了的条目（B 站课程——没有分 P 详情与播放流
   * 接口，面板只会「加载失败」），走内页钻取。普通多 P / 多集由面板接管，不传该 prop。
   */
  onSelectEpisodes?: () => void;
}

export function VideoTile({
  platformData,
  nowPlaying = false,
  supported = true,
  revealed = false,
  onReveal,
  onPlay,
  onActivate,
  onSelectEpisodes,
}: VideoTileProps) {
  const live = isLiveItem(platformData);
  // 手机点主体出操作条（story 4）、无悬停宽屏只选中：两种情况都不是「点播」，读屏名随之改。
  const bodyLabel = `${
    isPhoneLayout() || isTapToReveal() ? "查看" : "点播"
  } ${platformData.title}`;
  const duration = formatDuration(platformData.duration);

  const handleBodyClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (isTapToReveal()) {
      if (!revealed) onReveal?.();
      return;
    }
    if (isPhoneLayout()) {
      onActivate?.(event.currentTarget as HTMLElement);
      return;
    }
    onPlay();
  };

  // 点播进行中 / 刚发出 / 失败时胶囊保持可见，鼠标移开也看得到结果
  const status = useRequestStatus(platformData);
  const shown = revealed || status !== "idle";
  const overlayVisibility = `${shown ? "opacity-100" : "opacity-0"} hov:group-hover:opacity-100 group-focus-within:opacity-100`;
  const overlayHit = `${shown ? "pointer-events-auto" : "pointer-events-none"} hov:group-hover:pointer-events-auto group-focus-within:pointer-events-auto`;

  return (
    <div
      className="group min-w-0"
      data-imw-tile={live ? "live" : "video"}
      data-revealed={revealed ? "true" : undefined}
    >
      <div
        className={`relative overflow-hidden ${roundedLg} ${revealed ? deskSelectedRing : ""}`}
      >
        <Cover
          src={platformData.coverImg}
          icon="film"
          rounded={roundedLg}
          className="aspect-video w-full"
          alt={platformData.title}
        />

        <button
          type="button"
          aria-label={bodyLabel}
          data-imw-tile-body="true"
          className="absolute inset-0 block h-full w-full cursor-pointer border-0 bg-transparent p-0"
          onClick={handleBodyClick}
        />

        {/* 桌面可收藏（旧卡片有）；手机走 story 4 的操作条 */}
        <span className="absolute right-1 top-1 max-[768px]:hidden">
          <FavoriteStar platformData={platformData} />
        </span>

        {nowPlaying && (
          <span
            className={`pointer-events-none absolute bottom-2 left-2 flex items-center ${roundedXs} px-1.5 py-1 ${deskDurationPill}`}
          >
            <NowPlayingBars tone={deskOnRoseFill} />
          </span>
        )}

        {/* 右下角：直播徽章占时长胶囊的位置，直播卡不显示时长 */}
        {(live || duration) && (
          <span
            className={`pointer-events-none absolute bottom-2 right-2 flex items-center ${roundedXs} px-1.5 py-0.5 ${typeMonoPill} ${live ? `${deskRoseSolid} ${deskOnRose}` : `${deskDurationPill} ${deskOnRose}`}`}
          >
            {live ? "直播" : duration}
          </span>
        )}

        <div
          className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 ${deskVideoScrim} ${overlayVisibility}`}
        >
          <button
            type="button"
            aria-busy={status === "pending"}
            className={`flex h-[38px] items-center justify-center gap-1.5 rounded-full border-0 px-5 ${deskPress} max-[768px]:h-11 ${deskRoseSolid} ${deskOnRose} ${typeLabelStrong} ${deskFocusRingOnRose} ${overlayHit} ${supported ? "" : "opacity-40"} ${status === "pending" ? "cursor-wait" : ""} ${status === "failed" ? "animate-[imwShake_360ms_ease-in-out]" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              if (status === "pending") return;
              onPlay();
            }}
          >
            {status !== "idle" && (
              <DeskIcon
                name={
                  status === "pending"
                    ? "spinner"
                    : status === "sent"
                      ? "check"
                      : "refresh"
                }
                size={16}
                className={status === "pending" ? "animate-spin" : ""}
              />
            )}
            {requestLabel(status, "点播到房间")}
          </button>
          {onSelectEpisodes && (
            <button
              type="button"
              className={`border-0 bg-transparent p-0 max-[768px]:hidden ${deskOnRose} ${typeLabelStrong} underline ${overlayHit}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectEpisodes();
              }}
            >
              选集
            </button>
          )}
        </div>
      </div>

      <div className={`mt-2 line-clamp-2 ${typeVideoTitle} ${deskInk}`}>
        {platformData.title}
      </div>
      <div className={`mt-0.5 truncate ${typeVideoMeta} ${deskInk3}`}>
        {platformData.author}
      </div>
    </div>
  );
}
