// 选集面板视图（DESIGN.md `episode-picker`，CAP-8）：插件自有的有序多选列表，
// 取代宿站 `buildSelect2`——不再有跨弹窗 300ms 流转，也不再接管宿站选项的 `onclick`。
//
// 受控视图：加载状态、已选项与点选顺序、正序 / 乱序全由 `openEpisodePicker` 持有，
// 这里只排版与派发。选中项左列是蔷薇红实底序号徽章（点选顺序 1、2、3…），
// 未选是 20px 描边方块；标题行「全选」按列表顺序选中全部，全选后文案变「取消全选」。
// 标题行 / 列表行 / 状态行与吸底底栏在 `EpisodePickerParts`，纯逻辑在 `episodePickerModel`。
import { useMemo, useRef, useState } from "preact/hooks";
import { roomSupportsRequest } from "../media-card-container/roomSupport";
import { trapFocusWithin } from "../desk/focusTrap";
import { stopHostGestures } from "../floating-panel/floatingPanel";
import { deskRule, deskSheet, roundedXl } from "../floating-panel/tokens";
import type {
  EpisodePickEntry,
  EpisodePickOrder,
} from "../../../platforms/episodePickerPort";
import {
  EMPTY_TEXT,
  EpisodePickerFooter,
  EpisodePickerHeader,
  EpisodeRow,
  EpisodeSkeletonRows,
  EpisodeStateRow,
} from "./EpisodePickerParts";
import type { EpisodePickStatus } from "./episodePickerModel";

// 这两个类型是平台层构造的数据形状，定义在 `platforms/episodePickerPort`：
// 视图层从这里再导出，避免「平台层为了拿类型而 import 视图层」。
export type {
  EpisodePickEntry,
  EpisodePickOrder,
} from "../../../platforms/episodePickerPort";

// 纯逻辑与加载状态类型放在 `episodePickerModel`，对外出口保持在原路径。
export type { EpisodePickStatus } from "./episodePickerModel";
export {
  resolveEpisodeOrder,
  selectAllEpisodes,
  toggleEpisode,
} from "./episodePickerModel";

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
  /** 后台补歌名的进度（只在补取期间给出）：header 显示「歌名加载中 d / t」。 */
  progress?: { done: number; total: number } | null;
}

/** 一次画多少行：大歌单（上万首）一次全画会卡死，滚到底再追加。 */
export const RENDER_BATCH = 200;
/** 距底部多少像素开始追加下一批。 */
const LOAD_MORE_THRESHOLD_PX = 600;

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
  progress = null,
}: EpisodePickerProps) {
  const supported = roomSupportsRequest();
  /** 已画出的行数：只增不减（换歌单 / 重试时随组件重建归位）。 */
  const [visible, setVisible] = useState(RENDER_BATCH);
  /** id → 点选序号：每行查序号别再 `indexOf`（上万行 × 全选 = 上亿次比较）。 */
  const orderOf = useMemo(
    () => new Map(selected.map((id, index) => [id, index])),
    [selected],
  );
  const handleListScroll = (event: Event) => {
    const list = event.currentTarget as HTMLElement;
    if (
      visible < entries.length &&
      list.scrollHeight - list.scrollTop - list.clientHeight <
        LOAD_MORE_THRESHOLD_PX
    ) {
      setVisible((count) => Math.min(count + RENDER_BATCH, entries.length));
    }
  };
  const ready = status === "ready" && entries.length > 0;
  const busy = status !== "ready" || entries.length === 0;
  const allSelected = ready && selected.length === entries.length;
  const confirmDisabled = busy || selected.length === 0;
  // 点外侧才取消：按「按下点」判定。从某一行按下、拖到面板外松开时，`click` 会派发到
  // 最近公共祖先（外框层），只看 click 的 target 会误判并把已选丢掉。
  const pressedOutside = useRef(false);

  return (
    <div
      // 外框在退场期间照样拦截指针：整层 `pointer-events-none` 会让 160ms 淡出窗口里的
      // 第二次点击穿透到下面的结果区（可能又点播一次）。只有卡片本身停收指针。
      className={`fixed inset-0 z-[90010] flex items-center justify-center max-[768px]:items-end`}
      data-imw-episode-picker="true"
      onPointerDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (!pressedOutside.current) return;
        pressedOutside.current = false;
        if (event.target === event.currentTarget) onCancel();
      }}
      {...stopHostGestures}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="imw-episode-picker-title"
        tabIndex={-1}
        data-imw-episode-picker-card="true"
        className={`flex max-h-[min(640px,80vh)] w-[min(560px,calc(100%-72px))] flex-col overflow-hidden border border-solid animate-[imwSheetFade_180ms_ease-out] max-[768px]:max-h-[85vh] max-[768px]:w-full max-[768px]:rounded-b-none max-[768px]:border-x-0 max-[768px]:border-b-0 max-[768px]:pb-[env(safe-area-inset-bottom)] max-[768px]:animate-[imwSheetRise_220ms_ease-out] ${roundedXl} ${deskSheet} ${deskRule} ${exiting ? "pointer-events-none opacity-0 transition-opacity duration-[160ms]" : ""}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapFocusWithin}
        {...stopHostGestures}
      >
        <EpisodePickerHeader
          unit={unit}
          status={status}
          count={entries.length}
          allSelected={allSelected}
          busy={busy}
          progress={progress}
          onToggleAll={onToggleAll}
          onCancel={onCancel}
        />

        {/* 列表区：只有这里滚动，标题行与吸底底栏固定。 */}
        <div
          className="min-h-0 flex-1 overflow-y-auto"
          data-imw-episode-list="true"
          onScroll={handleListScroll}
        >
          {status === "loading" && <EpisodeSkeletonRows />}
          {status === "failed" && (
            <EpisodeStateRow
              message="加载失败"
              action="重试"
              onAction={onRetry}
            />
          )}
          {status === "ready" && entries.length === 0 && (
            <EpisodeStateRow
              message={EMPTY_TEXT[unit] ?? `没有可点播的${unit}`}
            />
          )}
          {ready &&
            entries
              .slice(0, visible)
              .map((entry) => (
                <EpisodeRow
                  key={entry.id}
                  entry={entry}
                  order={orderOf.get(entry.id) ?? -1}
                  onToggle={onToggle}
                />
              ))}
        </div>

        <EpisodePickerFooter
          order={order}
          busy={busy}
          supported={supported}
          confirmDisabled={confirmDisabled}
          onOrderChange={onOrderChange}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}
