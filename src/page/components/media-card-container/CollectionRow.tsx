// 专辑 / 歌单结果行（DESIGN.md `collection-row`）：沿用曲目行的列结构，
// 时长列换成等宽曲目数，点播钮位换成「查看」描边胶囊。
// 桌面只有封面、标题与「查看」进入内页（整行可点会让收藏星很难点中，用户反馈）；
// 手机整行点按进入（收藏星自己拦截点击）。行本身不提供整张点播——整张播放在内页头「全部播放」。
import { Cover } from "./Cover";
import { FavoriteStar } from "./FavoriteStar";
import { SourceCell, trackColumns } from "./TracklistRow";
import { isPhoneLayout, trackCountLabel } from "./mediaFormat";
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk2,
  deskInk3,
  deskPress,
  deskPressTone,
  deskRowHover,
  deskRule,
  roundedRequestButton,
  roundedTrackCover,
  typeButtonSm,
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
      className={`${trackColumns} group mx-[-14px] min-h-[62px] w-[calc(100%+28px)] border-0 border-b border-solid px-[14px] text-left max-[768px]:mx-0 max-[768px]:min-h-[66px] max-[768px]:w-full max-[768px]:cursor-pointer max-[768px]:px-0 ${deskRule} ${deskRowHover}`}
      data-imw-collection-row="true"
      onClick={() => {
        if (isPhoneLayout()) onOpen();
      }}
    >
      <span className="grid place-items-center max-[768px]:hidden">
        <span className={`${typeMonoNum} ${deskInk3}`}>
          {String(index ?? 0).padStart(2, "0")}
        </span>
      </span>

      <Cover
        src={platformData.coverImg}
        icon="note"
        alt={platformData.title}
        rounded={roundedTrackCover}
        className="h-[42px] w-[42px] max-[768px]:h-12 max-[768px]:w-12"
        onOpen={onOpen}
        openLabel="查看"
      />

      <div className="min-w-0">
        <button
          type="button"
          className={`block max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left ${typeRowTitle} ${deskInk} ${deskFocusRing} hov:hover:underline hov:hover:underline-offset-4`}
          title={`查看 ${platformData.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {platformData.title}
        </button>
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

      <span className="grid place-items-center">
        <FavoriteStar platformData={platformData} />
      </span>

      <button
        type="button"
        aria-label={`查看 ${platformData.title}`}
        title="查看曲目"
        className={`relative flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 border border-solid bg-transparent p-0 after:absolute after:-inset-[2px] after:content-[''] max-[768px]:h-10 max-[768px]:w-10 max-[768px]:justify-self-center ${roundedRequestButton} ${deskRule} ${deskInk2} ${typeButtonSm} ${deskPressTone} ${deskPress} ${deskFocusRing}`}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <DeskIcon name="list" size={14} />
        <span className="max-[768px]:hidden">查看</span>
      </button>
    </div>
  );
}
