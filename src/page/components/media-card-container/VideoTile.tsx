// 视频卡（DESIGN.md `video-tile`）：16:9 缩略图、无卡片框；右下角等宽时长胶囊，
// 直播换「直播」徽章且不显示时长；悬停 / 键盘聚焦 / 无悬停宽屏点按选中时覆遮罩并出现
// 「点播到房间」胶囊。MV、B 站视频、多源剧集与直播共用本组件。
import { useEffect, useState } from "preact/hooks";
import { Cover } from "./Cover";
import { FavoriteStar } from "./FavoriteStar";
import {
  formatDuration,
  hasMultiPage,
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
  deskRose,
  deskRoseSolid,
  deskSelectedRing,
  deskVideoScrim,
  roundedLg,
  roundedXs,
  typeLabelStrong,
  typeMonoPill,
  typeVideoMeta,
  typeVideoTitle,
} from "../floating-panel/tokens";

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
  const [multipage, setMultipage] = useState(false);

  useEffect(() => {
    let alive = true;
    void hasMultiPage(platformData).then((value) => {
      if (alive) setMultipage(value);
    });
    return () => {
      alive = false;
    };
  }, [platformData]);

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

  // 手机没有悬停：胶囊常显，保证「点播到房间」可达（操作条接管的是卡片主体的点击）。
  const overlayVisibility = `${revealed ? "opacity-100" : "opacity-0"} hov:group-hover:opacity-100 group-focus-within:opacity-100 max-[768px]:opacity-100`;
  const overlayHit = `${revealed ? "pointer-events-auto" : "pointer-events-none"} hov:group-hover:pointer-events-auto group-focus-within:pointer-events-auto max-[768px]:pointer-events-auto`;

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
          className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 ${deskVideoScrim} max-[768px]:bg-transparent ${overlayVisibility}`}
        >
          <button
            type="button"
            className={`flex h-[38px] items-center justify-center rounded-full border-0 px-5 max-[768px]:h-11 ${deskRoseSolid} ${deskOnRose} ${typeLabelStrong} ${deskFocusRingOnRose} ${overlayHit} ${supported ? "" : "opacity-40"}`}
            onClick={(event) => {
              event.stopPropagation();
              onPlay();
            }}
          >
            点播到房间
          </button>
          {multipage && onSelectEpisodes && (
            <button
              type="button"
              className={`border-0 bg-transparent p-0 ${deskOnRose} ${typeLabelStrong} underline ${overlayHit}`}
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
