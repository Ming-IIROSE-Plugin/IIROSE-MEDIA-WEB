// 音乐网格卡（DESIGN.md `music-tile`）：1:1 封面、无卡片框，悬停/聚焦/点按选中时
// 覆遮罩并出现「点播」胶囊；标题单行截断，副行「歌手 · 等宽时长」，桌面在标题行右端放收藏星。
import { useEffect, useState } from "preact/hooks";
import { Cover } from "./Cover";
import { FavoriteStar } from "./FavoriteStar";
import {
  formatDuration,
  hasMultiPage,
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
  typeMonoNumSm,
  typeVideoMeta,
  typeVideoTitle,
} from "../floating-panel/tokens";

export interface MusicTileProps {
  platformData: PlatformData;
  nowPlaying?: boolean;
  supported?: boolean;
  /** 无悬停宽屏：该卡已被第一次点按选中（显示按钮 + 描边）。 */
  revealed?: boolean;
  onReveal?: () => void;
  onPlay: () => void;
  /** 手机点卡片（点播按钮以外）= 操作条挂点（story 4 填充）。 */
  onActivate?: () => void;
  /** 多 P / 多集条目的过渡「选集」入口（story 5 由选集面板取代）。 */
  onSelectEpisodes?: () => void;
}

export function MusicTile({
  platformData,
  nowPlaying = false,
  supported = true,
  revealed = false,
  onReveal,
  onPlay,
  onActivate,
  onSelectEpisodes,
}: MusicTileProps) {
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

  const duration = formatDuration(platformData.duration);
  // 手机点主体出操作条（story 4）、无悬停宽屏只选中：两种情况都不是「点播」，读屏名随之改。
  const bodyLabel = `${
    isPhoneLayout() || isTapToReveal() ? "查看" : "点播"
  } ${platformData.title}`;

  const handleBodyClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (isTapToReveal()) {
      if (!revealed) onReveal?.();
      return;
    }
    if (isPhoneLayout()) {
      onActivate?.();
      return;
    }
    onPlay();
  };

  // 手机没有悬停：胶囊常显，保证「点播」可达（story 4 的操作条接管后回收）。
  const overlayVisibility = `${revealed ? "opacity-100" : "opacity-0"} hov:group-hover:opacity-100 group-focus-within:opacity-100 max-[768px]:opacity-100`;
  const overlayHit = `${revealed ? "pointer-events-auto" : "pointer-events-none"} hov:group-hover:pointer-events-auto group-focus-within:pointer-events-auto max-[768px]:pointer-events-auto`;

  return (
    <div
      className="group relative min-w-0"
      data-imw-tile="music"
      data-revealed={revealed ? "true" : undefined}
    >
      <div
        className={`relative overflow-hidden ${roundedLg} ${revealed ? deskSelectedRing : ""}`}
      >
        <Cover
          src={platformData.coverImg}
          icon="note"
          rounded={roundedLg}
          className="aspect-square w-full"
          alt={platformData.title}
        />

        <button
          type="button"
          aria-label={bodyLabel}
          data-imw-tile-body="true"
          className="absolute inset-0 block h-full w-full cursor-pointer border-0 bg-transparent p-0"
          onClick={handleBodyClick}
        />

        {nowPlaying && (
          <span
            className={`pointer-events-none absolute bottom-2 left-2 flex items-center ${roundedXs} px-1.5 py-1 ${deskDurationPill}`}
          >
            <NowPlayingBars tone={deskOnRoseFill} />
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
            点播
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

      <div className="mt-2 flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <div
            className={`truncate ${typeVideoTitle} ${nowPlaying ? deskRose : deskInk}`}
          >
            {platformData.title}
          </div>
          <div className={`truncate ${typeVideoMeta} ${deskInk3}`}>
            {platformData.author}
            {platformData.author && duration && " · "}
            {duration && <span className={typeMonoNumSm}>{duration}</span>}
          </div>
        </div>
        <span className="shrink-0 max-[768px]:hidden">
          <FavoriteStar platformData={platformData} />
        </span>
      </div>
    </div>
  );
}
