// 专辑 / 歌单内页头（DESIGN.md `collection-header`）：进入内页后取代范围行。
// 左：「‹ 返回」文字钮 + 名称 + 等宽曲目数；右：分页（内页本地切片，多于一页才出现）+
// 描边胶囊「全部播放」→ 顺序菜单（正序播放 / 乱序播放）。
// 房间不支持点播时「全部播放」灰化但保留可聚焦。
import { useRef, useState } from "preact/hooks";
import { OrderMenu, type PlayOrder } from "./OrderMenu";
import { trackCountLabel } from "./mediaFormat";
import { notifyRoomUnsupported, roomSupportsRequest } from "./roomSupport";
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk2,
  deskInk3,
  deskRule,
  deskSendHover,
  deskTextButton,
  roundedSm,
  typeButtonSm,
  typeLabelStrong,
  typeMonoCaption,
  typeMonoNum,
} from "../floating-panel/tokens";

export interface CollectionHeaderProps {
  title: string;
  trackCount?: string | number | null;
  /** 内页本地分页：多于 1 页时在头部右侧给出上一页 / 下一页。 */
  currentPage?: number;
  totalPage?: number;
  onPageChange?: (page: number) => void;
  onBack: () => void;
  onPlayAll: (order: PlayOrder) => void;
}

const pad = (value: number) => String(value).padStart(2, "0");

const pagerButton = `grid h-[30px] w-[30px] shrink-0 cursor-pointer place-items-center border border-solid bg-transparent p-0 ${roundedSm} ${deskRule} ${deskInk2} ${deskFocusRing} max-[768px]:h-11 max-[768px]:w-11`;

export function CollectionHeader({
  title,
  trackCount,
  currentPage = 1,
  totalPage = 0,
  onPageChange,
  onBack,
  onPlayAll,
}: CollectionHeaderProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const supported = roomSupportsRequest();
  const count = trackCountLabel(trackCount);
  const pages = Math.max(totalPage, 1);
  const page = Math.min(Math.max(currentPage, 1), pages);

  return (
    <div
      className={`group mx-[36px] mt-[18px] flex items-center gap-2 border-b border-solid max-[768px]:mx-[20px] max-[768px]:mt-3 ${deskRule}`}
      data-imw-collection-header="true"
    >
      <button
        type="button"
        className={`flex min-h-[44px] shrink-0 items-center gap-0.5 px-0 ${deskTextButton}`}
        onClick={onBack}
      >
        <DeskIcon name="left" size={16} />
        返回
      </button>

      <span
        className={`ml-1 min-w-0 truncate ${typeLabelStrong} ${deskInk}`}
        title={title}
      >
        {title}
      </span>
      {count && (
        <span className={`shrink-0 ${typeMonoCaption} ${deskInk3}`}>
          {count}
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {pages > 1 && onPageChange && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="上一页"
              className={pagerButton}
              onClick={() => {
                if (page > 1) onPageChange(page - 1);
              }}
            >
              <DeskIcon name="left" size={16} />
            </button>
            <span
              className={`mx-1.5 whitespace-nowrap ${typeMonoNum} ${deskInk2}`}
            >
              {pad(page)} / {pad(pages)}
            </span>
            <button
              type="button"
              aria-label="下一页"
              className={pagerButton}
              onClick={() => {
                if (page < pages) onPageChange(page + 1);
              }}
            >
              <DeskIcon name="right" size={16} />
            </button>
          </div>
        )}

        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-disabled={!supported}
          title={supported ? "按顺序点播整张" : "这个房间不支持点播"}
          className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-solid bg-transparent px-[14px] ${typeButtonSm} ${deskRule} ${deskInk2} ${deskFocusRing} max-[768px]:h-11 ${supported ? deskSendHover : "opacity-40"}`}
          onClick={() => {
            if (!supported) {
              notifyRoomUnsupported();
              return;
            }
            setOpen(true);
          }}
        >
          <DeskIcon name="play" size={16} />
          全部播放
        </button>
      </div>

      {open && (
        <OrderMenu
          title={title}
          trackCount={trackCount}
          anchor={triggerRef.current}
          onSelect={(order) => {
            setOpen(false);
            onPlayAll(order);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}
