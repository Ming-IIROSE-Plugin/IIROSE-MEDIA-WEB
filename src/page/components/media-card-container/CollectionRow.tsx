// 专辑 / 歌单结果行（DESIGN.md `collection-row`）：沿用曲目行的列结构，
// 时长列换成等宽曲目数，点播钮位换成 16px 右向箭头；整行可点进入面板内页。
// 行本身不提供整张点播——整张播放在内页头「全部播放」。
import { Cover } from "./Cover";
import { FavoriteStar } from "./FavoriteStar";
import { SourceCell, trackColumns } from "./TracklistRow";
import { trackCountLabel } from "./mediaFormat";
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk2,
  deskInk3,
  deskRowHover,
  deskRule,
  roundedTrackCover,
  typeMonoNum,
  typeRowMeta,
  typeRowTitle,
} from "../floating-panel/tokens";

export interface CollectionRowProps {
  platformData: PlatformData;
  index?: number;
  onOpen: () => void;
}

export function CollectionRow({
  platformData,
  index,
  onOpen,
}: CollectionRowProps) {
  return (
    <div
      className={`${trackColumns} group mx-[-14px] min-h-[62px] w-full cursor-pointer border-0 border-b border-solid px-[14px] text-left max-[768px]:mx-0 max-[768px]:min-h-[66px] max-[768px]:px-0 ${deskRule} ${deskRowHover}`}
      data-imw-collection-row="true"
      onClick={onOpen}
    >
      <span className="grid place-items-center max-[768px]:hidden">
        <span className={`${typeMonoNum} ${deskInk3}`}>
          {String(index ?? 0).padStart(2, "0")}
        </span>
      </span>

      <Cover
        src={platformData.coverImg}
        icon="note"
        rounded={roundedTrackCover}
        className="h-[42px] w-[42px] max-[768px]:h-12 max-[768px]:w-12"
      />

      <div className="min-w-0">
        <div className={`truncate ${typeRowTitle} ${deskInk}`}>
          {platformData.title}
        </div>
        <div className={`truncate ${typeRowMeta} ${deskInk2}`}>
          {platformData.author}
        </div>
      </div>

      <SourceCell platformData={platformData} />

      <span className={`${typeMonoNum} ${deskInk2} max-[768px]:hidden`}>
        {trackCountLabel(platformData.trackCount)}
      </span>
      <span className={`hidden ${typeMonoNum} ${deskInk2} max-[768px]:block`}>
        {trackCountLabel(platformData.trackCount)}
      </span>

      <span className="grid place-items-center max-[768px]:hidden">
        <FavoriteStar platformData={platformData} />
      </span>

      <button
        type="button"
        aria-label={`查看 ${platformData.title}`}
        title="查看曲目"
        className={`relative flex h-8 w-full cursor-pointer items-center justify-center border-0 bg-transparent p-0 ${deskFocusRing} ${deskInk3} after:absolute after:-inset-[2px] after:content-[''] max-[768px]:h-10 max-[768px]:w-10 max-[768px]:justify-self-center`}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <DeskIcon name="right" size={16} />
      </button>
    </div>
  );
}
