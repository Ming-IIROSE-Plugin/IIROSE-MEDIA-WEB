// 选集面板的分块视图（DESIGN.md `episode-picker`）：标题行、列表行、三种非就绪状态
// 与吸底底栏。状态与已选项都由面板本体持有，这里只排版与派发。
import { formatDuration } from "../media-card-container/mediaFormat";
import { notifyRoomUnsupported } from "../media-card-container/roomSupport";
import {
  DeskIcon,
  deskFocusRing,
  deskFocusRingOnInk,
  deskInk,
  deskInk2,
  deskInk3,
  deskInkSurface,
  deskOnRose,
  deskPaperText,
  deskRose,
  deskRoseSolid,
  deskRule,
  deskSheet,
  deskSkeleton,
  roundedLg,
  roundedMd,
  roundedXs,
  typeLabelStrong,
  typeMonoNum,
  typeMonoNumSm,
  typeRowMeta,
  typeRowTitle,
  touchMin,
} from "../floating-panel/tokens";
import type {
  EpisodePickEntry,
  EpisodePickOrder,
} from "../../../platforms/episodePickerPort";
import type { EpisodePickStatus } from "./episodePickerModel";

/** 文字钮（「全选」/「取消全选」/「重试」）：无底色、无描边，悬停下划线。 */
const textAction = `cursor-pointer border-0 bg-transparent ${typeLabelStrong} ${deskRose} hov:hover:underline ${deskFocusRing} ${touchMin}`;

/** 0 集文案按单位组织：视频 / 剧集是「分集」，网易云曲目是「曲目」。 */
export const EMPTY_TEXT: Record<string, string> = {
  集: "没有可点播的分集",
  首: "没有可点播的曲目",
};

/** 加载中 / 加载失败 / 0 集：列表区的三种非就绪状态。 */
export function EpisodeStateRow({
  message,
  action,
  onAction,
}: {
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className={`flex min-h-[44px] items-center gap-3 px-4 py-3 ${typeRowMeta} ${deskInk2}`}
    >
      {message}
      {action && (
        <button type="button" className={textAction} onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

/** 静态骨架行（无闪光动画，DESIGN.md `skeleton-row`）。 */
export function EpisodeSkeletonRows() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className={`flex min-h-[44px] items-center gap-3 border-b border-solid px-4 py-3 ${deskRule}`}
        >
          <span className={`h-5 w-5 shrink-0 ${roundedXs} ${deskSkeleton}`} />
          <span className={`h-2 w-2/5 rounded-full ${deskSkeleton}`} />
          <span
            className={`ml-auto h-2 w-[38px] rounded-full ${deskSkeleton}`}
          />
        </div>
      ))}
    </div>
  );
}

/** 列表行：左列为点选序号徽章（未选是描边方块），标题 / 副行 + 等宽时长。 */
export function EpisodeRow({
  entry,
  order,
  onToggle,
}: {
  entry: EpisodePickEntry;
  /** 点选序号（0 起）；未选为 -1。 */
  order: number;
  onToggle: (id: string) => void;
}) {
  const checked = order !== -1;
  const duration = formatDuration(entry.duration);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked ? "true" : "false"}
      aria-label={checked ? `${entry.title}，第 ${order + 1} 个` : entry.title}
      className={`flex min-h-[44px] w-full cursor-pointer items-center gap-3 border-0 border-b border-solid bg-transparent px-4 py-2 text-left ${deskFocusRing} ${deskRule}`}
      onClick={() => onToggle(entry.id)}
    >
      {checked ? (
        <span
          aria-hidden="true"
          className={`flex h-5 w-5 shrink-0 items-center justify-center ${roundedXs} ${deskRoseSolid} ${deskOnRose} ${typeMonoNumSm}`}
        >
          {order + 1}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 border border-solid ${roundedXs} ${deskRule}`}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${typeRowTitle} ${deskInk}`}>
          {entry.title}
        </span>
        {entry.meta && (
          <span className={`block truncate ${typeRowMeta} ${deskInk2}`}>
            {entry.meta}
          </span>
        )}
      </span>
      {duration && (
        <span className={`shrink-0 ${typeMonoNumSm} ${deskInk2}`}>
          {duration}
        </span>
      )}
    </button>
  );
}

/** 标题行：标题 + 等宽数量 + 「全选」+ 关闭（关闭 = 取消，不点播）。 */
export function EpisodePickerHeader({
  unit,
  status,
  count,
  allSelected,
  busy,
  progress,
  onToggleAll,
  onCancel,
}: {
  unit: string;
  status: EpisodePickStatus;
  count: number;
  allSelected: boolean;
  busy: boolean;
  progress?: { done: number; total: number } | null;
  onToggleAll: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className={`flex shrink-0 items-center gap-3 border-b border-solid px-4 py-2 ${deskRule}`}
    >
      <span
        id="imw-episode-picker-title"
        className={`${typeLabelStrong} ${deskInk}`}
      >
        选集
      </span>
      <span className={`${typeMonoNum} ${deskInk3}`}>
        {status === "ready" ? `${count} ${unit}` : `— ${unit}`}
      </span>
      {progress && progress.done < progress.total && (
        <span
          className={`${typeMonoNumSm} ${deskInk3}`}
          data-imw-episode-progress="true"
        >
          歌名加载中 {progress.done} / {progress.total}
        </span>
      )}
      <button
        type="button"
        className={`ml-auto ${textAction} disabled:cursor-default disabled:opacity-40`}
        disabled={busy}
        onClick={onToggleAll}
      >
        {allSelected ? "取消全选" : "全选"}
      </button>
      <button
        type="button"
        aria-label="关闭选集"
        className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-solid bg-transparent max-[768px]:h-11 max-[768px]:w-11 ${roundedLg} ${deskRule} ${deskInk2} ${deskFocusRing}`}
        onClick={onCancel}
      >
        <DeskIcon name="close" size={18} />
      </button>
    </div>
  );
}

/** 吸底底栏：正序 / 乱序 + 墨底「点播所选」。 */
export function EpisodePickerFooter({
  order,
  busy,
  supported,
  confirmDisabled,
  onOrderChange,
  onConfirm,
}: {
  order: EpisodePickOrder;
  busy: boolean;
  supported: boolean;
  confirmDisabled: boolean;
  onOrderChange: (order: EpisodePickOrder) => void;
  onConfirm: () => void;
}) {
  const orders: { key: EpisodePickOrder; label: string }[] = [
    { key: "asc", label: "正序" },
    { key: "shuffle", label: "乱序" },
  ];
  /** 方向键在两段之间移动（radiogroup 的读取顺序靠 roving tabIndex + 方向键）。 */
  const otherOrder: EpisodePickOrder = order === "asc" ? "shuffle" : "asc";
  return (
    <div
      className={`flex shrink-0 items-center gap-3 border-t border-solid px-4 py-3 ${deskRule}`}
    >
      <div
        role="radiogroup"
        aria-label="播放顺序"
        className={`flex h-11 overflow-hidden border border-solid ${roundedMd} ${deskRule}`}
      >
        {orders.map((item) => {
          const active = order === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={active ? "true" : "false"}
              tabIndex={active ? 0 : -1}
              disabled={busy}
              data-order={item.key}
              className={`h-full cursor-pointer border-0 px-3 disabled:cursor-default disabled:opacity-40 ${typeLabelStrong} ${deskFocusRing} ${
                active
                  ? `${deskSheet} ${deskInk}`
                  : `bg-transparent ${deskInk3}`
              }`}
              onClick={() => onOrderChange(item.key)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next = active ? otherOrder : item.key;
                onOrderChange(next);
                (
                  event.currentTarget.parentElement?.querySelector(
                    `[data-order="${next}"]`,
                  ) as HTMLElement | null
                )?.focus();
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={confirmDisabled}
        aria-disabled={!confirmDisabled && !supported ? "true" : undefined}
        title={supported ? undefined : "这个房间不支持点播"}
        className={`ml-auto h-11 cursor-pointer border-0 px-5 ${roundedMd} ${typeLabelStrong} ${deskInkSurface} ${deskPaperText} ${deskFocusRingOnInk} ${
          confirmDisabled || !supported
            ? "opacity-40 disabled:cursor-default"
            : ""
        }`}
        onClick={() => {
          // 灰化但仍可点：不支持点播的房间只提示，不发报文、不关面板。
          if (!supported) {
            notifyRoomUnsupported();
            return;
          }
          onConfirm();
        }}
      >
        点播所选
      </button>
    </div>
  );
}
