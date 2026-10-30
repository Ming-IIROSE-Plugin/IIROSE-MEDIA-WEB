// 选集面板视图（DESIGN.md `episode-picker`，CAP-8）：插件自有的有序多选列表，
// 取代宿站 `buildSelect2`——不再有跨弹窗 300ms 流转，也不再接管宿站选项的 `onclick`。
//
// 受控视图：加载状态、已选项与点选顺序、正序 / 乱序全由 `openEpisodePicker` 持有，
// 这里只排版与派发。选中项左列是蔷薇红实底序号徽章（点选顺序 1、2、3…），
// 未选是 20px 描边方块；标题行「全选」按列表顺序选中全部，全选后文案变「取消全选」。
import { formatDuration } from "../media-card-container/mediaFormat";
import {
  notifyRoomUnsupported,
  roomSupportsRequest,
} from "../media-card-container/roomSupport";
import { trapFocusWithin } from "../desk/focusTrap";
import { stopHostGestures } from "../floating-panel/floatingPanel";
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
  roundedXl,
  roundedXs,
  typeLabelStrong,
  typeMonoNum,
  typeMonoNumSm,
  typeRowMeta,
  typeRowTitle,
  touchMin,
} from "../floating-panel/tokens";

/** 一条可选分集：id 由调用方保证在本次列表内唯一。 */
export interface EpisodePickEntry {
  id: string;
  title: string;
  /** 副行（B 站 / 多源留空，网易云放歌手）。 */
  meta?: string;
  /** 时长（秒）；缺省不渲染等宽时长。 */
  duration?: number;
}

export type EpisodePickOrder = "asc" | "shuffle";

export type EpisodePickStatus = "loading" | "failed" | "ready";

/**
 * 点选顺序：未选则排到末尾，已选则摘掉——其后已选项目的序号据此自动前移
 * （徽章序号就是本数组的下标 + 1）。
 */
export function toggleEpisode(
  selected: readonly string[],
  id: string,
): string[] {
  const index = selected.indexOf(id);
  if (index === -1) return [...selected, id];
  const next = [...selected];
  next.splice(index, 1);
  return next;
}

/** 「全选」按列表顺序选中全部（徽章 1…N）。 */
export function selectAllEpisodes(
  entries: readonly EpisodePickEntry[],
): string[] {
  return entries.map((entry) => entry.id);
}

/**
 * 确认时的播放顺序：默认正序 = 点选顺序；乱序为同一集合的随机置换。
 * Fisher–Yates（`sort(() => Math.random() - .5)` 的分布不均，且不是置换的严格实现）。
 */
export function resolveEpisodeOrder(
  entries: readonly EpisodePickEntry[],
  selected: readonly string[],
  order: EpisodePickOrder,
  random: () => number = Math.random,
): EpisodePickEntry[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const picked = selected
    .map((id) => byId.get(id))
    .filter((entry): entry is EpisodePickEntry => Boolean(entry));
  if (order === "asc") return picked;
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

/** 文字钮（「全选」/「取消全选」/「重试」）：无底色、无描边，悬停下划线。 */
const textAction = `cursor-pointer border-0 bg-transparent ${typeLabelStrong} ${deskRose} hov:hover:underline ${deskFocusRing} ${touchMin}`;

export interface EpisodePickerProps {
  /** 数量单位：视频 / 剧集「集」、网易云曲目「首」。 */
  unit: string;
  status: EpisodePickStatus;
  entries: EpisodePickEntry[];
  /** 已选项 id，按点选顺序。 */
  selected: string[];
  order: EpisodePickOrder;
  /** 退场中：不再接收指针。 */
  exiting?: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOrderChange: (order: EpisodePickOrder) => void;
  onRetry: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 加载中 / 加载失败 / 0 集：列表区的三种非就绪状态。 */
function StateRow({
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
function SkeletonRows() {
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

export function EpisodePicker({
  unit,
  status,
  entries,
  selected,
  order,
  exiting = false,
  onToggle,
  onToggleAll,
  onOrderChange,
  onRetry,
  onConfirm,
  onCancel,
}: EpisodePickerProps) {
  const supported = roomSupportsRequest();
  const ready = status === "ready" && entries.length > 0;
  const busy = status !== "ready" || entries.length === 0;
  const allSelected = ready && selected.length === entries.length;
  const confirmDisabled = busy || selected.length === 0;
  const orders: { key: EpisodePickOrder; label: string }[] = [
    { key: "asc", label: "正序" },
    { key: "shuffle", label: "乱序" },
  ];
  /** 方向键在两段之间移动（radiogroup 的读取顺序靠 roving tabIndex + 方向键）。 */
  const otherOrder: EpisodePickOrder = order === "asc" ? "shuffle" : "asc";

  return (
    <div
      className={`fixed inset-0 z-[90010] flex items-center justify-center max-[768px]:items-end ${exiting ? "pointer-events-none" : ""}`}
      data-imw-episode-picker="true"
      onClick={onCancel}
      {...stopHostGestures}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="imw-episode-picker-title"
        tabIndex={-1}
        data-imw-episode-picker-card="true"
        className={`flex max-h-[min(640px,80vh)] w-[min(560px,calc(100%-72px))] flex-col overflow-hidden border border-solid animate-[imwSheetFade_180ms_ease-out] max-[768px]:max-h-[85vh] max-[768px]:w-full max-[768px]:rounded-b-none max-[768px]:border-x-0 max-[768px]:border-b-0 max-[768px]:pb-[env(safe-area-inset-bottom)] max-[768px]:animate-[imwSheetRise_220ms_ease-out] ${roundedXl} ${deskSheet} ${deskRule}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapFocusWithin}
        {...stopHostGestures}
      >
        {/* 标题行：标题 + 等宽数量 + 「全选」+ 关闭（关闭 = 取消，不点播）。 */}
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
            {status === "ready" ? `${entries.length} ${unit}` : `— ${unit}`}
          </span>
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

        {/* 列表区：只有这里滚动，标题行与吸底底栏固定。 */}
        <div
          className="min-h-0 flex-1 overflow-y-auto"
          data-imw-episode-list="true"
        >
          {status === "loading" && <SkeletonRows />}
          {status === "failed" && (
            <StateRow message="加载失败" action="重试" onAction={onRetry} />
          )}
          {status === "ready" && entries.length === 0 && (
            <StateRow message="没有可点播的分集" />
          )}
          {ready &&
            entries.map((entry) => {
              const index = selected.indexOf(entry.id);
              const checked = index !== -1;
              const duration = formatDuration(entry.duration);
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked ? "true" : "false"}
                  aria-label={
                    checked ? `${entry.title}，第 ${index + 1} 个` : entry.title
                  }
                  className={`flex min-h-[44px] w-full cursor-pointer items-center gap-3 border-0 border-b border-solid bg-transparent px-4 py-2 text-left ${deskFocusRing} ${deskRule}`}
                  onClick={() => onToggle(entry.id)}
                >
                  {checked ? (
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 shrink-0 items-center justify-center ${roundedXs} ${deskRoseSolid} ${deskOnRose} ${typeMonoNumSm}`}
                    >
                      {index + 1}
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className={`h-5 w-5 shrink-0 border border-solid ${roundedXs} ${deskRule}`}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate ${typeRowTitle} ${deskInk}`}
                    >
                      {entry.title}
                    </span>
                    {entry.meta && (
                      <span
                        className={`block truncate ${typeRowMeta} ${deskInk2}`}
                      >
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
            })}
        </div>

        {/* 吸底底栏：正序 / 乱序 + 墨底「点播所选」。 */}
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
                      ![
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(event.key)
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
      </div>
    </div>
  );
}
