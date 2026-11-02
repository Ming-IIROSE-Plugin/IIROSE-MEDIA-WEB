// 收藏随机的选择面板（CAP-8/9/10/14）：非模态浮动工具窗，桌面居中、移动端停在上半部。
// 状态规则在 pickerModel，这里只渲染与转发交互；外观取自共享浮窗模块 floating-panel。
// 列表区在 PickerList，搜索/批量栏在 PickerToolbar，拖动与定位在 useShufflePlacement，
// 数据加载与选择模型接线在 usePickerTabs；底栏留在本文件（摘要与确认态都在这里）。
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import type {
  ShufflePlatform,
  ShuffleSelection,
} from "../../../playback/ShuffleSelection";
import {
  filterRows,
  formatSummary,
  setVisible,
  summarize,
  toggleRow,
  toggleTrack,
  type PickerState,
} from "./pickerModel";
import { PlatformTabs } from "./PlatformTabs";
import {
  DragGrip,
  PanelHeader,
  panelFrame,
  panelSurface,
  primaryButton,
  secondaryButton,
  stopHostGestures,
  themeAttr,
} from "../floating-panel/floatingPanel";
import { deskInk, deskInk2 } from "../floating-panel/tokens";
import { LIST_ID, PLATFORM_LABEL, ShuffleIcon, tabId } from "./pickerChrome";
import { PickerList } from "./PickerList";
import { PickerBulkBar, PickerSearch } from "./PickerToolbar";
import { useShufflePlacement } from "./useShufflePlacement";
import { usePickerTabs } from "./usePickerTabs";

export interface PickerSource {
  records: FavoriteRecord[];
  saved: ShuffleSelection | null;
}

/** 确认结果：当前标签为随机平台；selections 含当前标签与本次改动过的平台。 */
export interface ShufflePickerResult {
  platform: ShufflePlatform;
  selections: Partial<Record<ShufflePlatform, ShuffleSelection>>;
}

export interface ShufflePickerProps {
  /**
   * 显示的平台标签（打开时算好，期间不变）；只有一个时不显示标签行。
   * null = 尚在计算：不显示标签行，列表区显示读取中，不读取任何平台。
   */
  platforms: readonly ShufflePlatform[] | null;
  /** 打开时停在的平台标签。 */
  initialPlatform: ShufflePlatform;
  dark: boolean;
  /** 读某平台的收藏与已存选择；失败按空收藏显示。切到该标签时才读，每平台只读一次。 */
  load: (platform: ShufflePlatform) => Promise<PickerSource>;
  /** 正在关闭：播放退场动效，不再接受交互。 */
  exiting?: boolean;
  /** 确认中（对齐收藏、保存）：主按钮置为忙碌不可点。 */
  busy?: boolean;
  /** 底栏错误提示（保存失败、所选收藏已删除等）。 */
  error?: string;
  onConfirm: (result: ShufflePickerResult) => void;
  onCancel: () => void;
  /** 切换了平台标签（openShufflePicker 借此清掉底栏错误）。 */
  onTabChange?: (platform: ShufflePlatform) => void;
}

const EMPTY_STATE: PickerState = { weight: "entry", rows: {} };

function isMobileViewport(): boolean {
  return !!window.matchMedia?.("(max-width: 768px)").matches;
}

export function ShufflePicker({
  platforms,
  initialPlatform,
  dark,
  load,
  exiting = false,
  busy = false,
  error = "",
  onConfirm,
  onCancel,
  onTabChange,
}: ShufflePickerProps) {
  // 用户切过标签前跟随 initialPlatform（可见平台算好后才确定）。
  const [chosen, setPlatform] = useState<ShufflePlatform | null>(null);
  const platform = chosen ?? initialPlatform;
  const ready = platforms !== null;
  const {
    tabs,
    loaded,
    expanded,
    loading,
    failed,
    loadFailed,
    setState,
    loadTab,
    fetchTracks,
    toggleExpand,
    buildSelections,
  } = usePickerTabs({ ready, platform, load });
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const { layer, dialog, position, floating, dragging, dragHandle } =
    useShufflePlacement(exiting);

  const tab = tabs[platform];
  const records = tab?.records ?? null;
  const state = tab?.state ?? EMPTY_STATE;

  useEffect(() => {
    // 下一帧再切到可见态，让入场过渡生效。
    const frame = requestAnimationFrame(() => setShown(true));
    // 移动端不自动聚焦搜索框，避免弹出键盘遮挡列表。
    if (isMobileViewport()) dialog.current?.focus({ preventScroll: true });
    else search.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 150);
    return () => clearTimeout(timer);
  }, [input]);

  const list = records ?? [];
  const visible = useMemo(
    () => filterRows(list, query, loaded, expanded),
    [list, query, loaded, expanded],
  );
  const summary = useMemo(
    () => summarize(state, list, loaded),
    [state, list, loaded],
  );
  const empty = (id: string) => loaded.get(id)?.length === 0;
  const canConfirm = !!records && summary.entries > 0 && !exiting && !busy;
  // 全选/全不选按输入框当前内容取可见行，不等 150ms 防抖。
  const bulk = (checked: boolean) => {
    setQuery(input);
    const rows = filterRows(list, input, loaded, expanded);
    setState((prev) => setVisible(prev, rows, checked, loaded, empty));
  };

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm({ platform, selections: buildSelections(platform) });
  };

  // 切换标签：搜索词清空；各标签的勾选、展开与权重保留到面板关闭。
  const switchTab = (next: ShufflePlatform) => {
    if (next === platform || exiting || busy) return;
    setPlatform(next);
    setInput("");
    setQuery("");
    onTabChange?.(next);
  };
  const showTabs = !!platforms && platforms.length > 1;

  // 面板内的按键不冒泡到 window：插件主面板的全局热键（Esc 关主面板、Alt+S）不被误触发。
  // 非模态：Tab 不锁在面板内，可移到宿站；面板外的 Esc 根本到不了这里，不关面板。
  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key !== "Escape") return;
    if (event.isComposing || event.defaultPrevented) return;
    event.preventDefault();
    if (!event.repeat && !exiting) onCancel();
  };

  const visibleNow = shown && !exiting;
  // 面板自身接收指针（定位层不拦截）；退场中不再接收。
  const cardBase = `flex max-h-[70%] w-[400px] max-w-[calc(100%-24px)] flex-col overflow-hidden ${panelFrame} ease-out ${exiting ? "pointer-events-none" : "pointer-events-auto"} ${panelSurface}`;
  const motion = `transition-[opacity,scale] motion-reduce:transition-opacity ${visibleNow ? "scale-100 opacity-100 duration-[180ms]" : "scale-95 opacity-0 duration-[90ms] motion-reduce:scale-100"}`;
  // 有已存位置：桌面与移动端都是浮动卡片，入场淡入 + scale-95→100（减弱动效只淡入）。
  // 无已存位置：桌面居中；移动端浮动卡片停在视口上半部（距顶 12px），不挡底部聊天输入栏。
  const dialogClass = floating
    ? `fixed ${cardBase} ${motion} max-[768px]:max-h-[85%] max-[768px]:pb-[env(safe-area-inset-bottom)]`
    : `${cardBase} ${motion} max-[768px]:mt-[max(12px,env(safe-area-inset-top))] max-[768px]:w-[calc(100%-24px)] max-[768px]:max-h-[60%] max-[768px]:origin-top`;

  return (
    <div
      ref={layer}
      data-imw-theme={themeAttr(dark)}
      className="pointer-events-none fixed inset-0 z-[90010] flex items-center justify-center font-sans text-[14px] leading-normal max-[768px]:items-start"
    >
      <div
        ref={dialog}
        id="imw-shuffle-picker"
        role="dialog"
        aria-labelledby="imw-shuffle-picker-title"
        tabIndex={-1}
        className={dialogClass}
        style={position ? { left: position.x, top: position.y } : undefined}
        onKeyDown={onKeyDown}
        {...stopHostGestures}
      >
        <DragGrip dragging={dragging} handle={dragHandle} />
        <PanelHeader
          icon={<ShuffleIcon />}
          title="收藏随机"
          titleId="imw-shuffle-picker-title"
          closeLabel="关闭收藏随机"
          onClose={() => !exiting && onCancel()}
          dragging={dragging}
          handle={dragHandle}
        />

        {showTabs && (
          <div className="shrink-0 px-3 pb-1">
            <PlatformTabs
              items={platforms!.map((target) => ({
                id: target,
                label: PLATFORM_LABEL[target],
              }))}
              selected={platform}
              onSelect={switchTab}
              disabled={exiting || busy}
              tabId={tabId}
              controls={LIST_ID}
              ariaLabel="随机平台"
            />
          </div>
        )}

        <PickerSearch
          value={input}
          inputRef={search}
          onInput={setInput}
          onClear={() => {
            setInput("");
            setQuery("");
            search.current?.focus();
          }}
        />

        <PickerBulkBar
          hasRecords={!!records}
          weight={state.weight}
          onBulk={bulk}
          onWeight={(weight) => setState((prev) => ({ ...prev, weight }))}
        />

        <PickerList
          platform={platform}
          showTabs={showTabs}
          records={records}
          list={list}
          visible={visible}
          state={state}
          loaded={loaded}
          expanded={expanded}
          loading={loading}
          failed={failed}
          loadFailed={loadFailed.has(platform)}
          onToggleRow={(record) =>
            setState((prev) => toggleRow(prev, record.id))
          }
          onToggleTrack={(id, trackId) =>
            setState((prev) => toggleTrack(prev, id, trackId, loaded.get(id)!))
          }
          onToggleExpand={toggleExpand}
          onRetryLoad={() => {
            loadTab(platform);
            // 「重试」随即被骨架替换：焦点交给面板，否则 Esc 与 Tab 循环会掉到 body。
            dialog.current?.focus({ preventScroll: true });
          }}
          onRetryTracks={(record) => {
            fetchTracks(record);
            // 「重试」随即被骨架替换：焦点交给面板，否则 Esc 与 Tab 循环会掉到 body。
            dialog.current?.focus({ preventScroll: true });
          }}
          onClearSearch={() => {
            setInput("");
            setQuery("");
            // 本按钮随空态一起卸载：焦点移回搜索框。
            search.current?.focus({ preventScroll: true });
          }}
        />

        <div className="flex min-h-16 shrink-0 items-center gap-2 px-3 py-2.5 max-[768px]:flex-col max-[768px]:items-stretch">
          <div
            className={`min-w-0 flex-1 truncate text-[13px] tabular-nums ${deskInk2} max-[768px]:text-[12px]`}
          >
            {records ? formatSummary(summary) : ""}
          </div>
          <div className="flex shrink-0 flex-col items-stretch">
            <div className="flex gap-2 max-[768px]:grid max-[768px]:grid-cols-2">
              <button
                type="button"
                className={`${secondaryButton} px-4 text-[14px]`}
                onClick={() => !exiting && onCancel()}
              >
                取消
              </button>
              <button
                type="button"
                className={`${primaryButton} px-4 text-[14px]`}
                disabled={!canConfirm}
                aria-busy={busy ? "true" : undefined}
                aria-describedby={
                  list.length > 0 && summary.entries === 0
                    ? "imw-shuffle-picker-hint"
                    : undefined
                }
                onClick={confirm}
              >
                {busy ? "正在保存…" : "开始随机"}
              </button>
            </div>
            {error && (
              <div
                role="alert"
                className={`mt-1 text-right text-[11px] leading-4 ${deskInk}`}
              >
                {error}
              </div>
            )}
            {list.length > 0 && summary.entries === 0 && (
              <div
                id="imw-shuffle-picker-hint"
                role="status"
                className={`mt-1 text-right text-[11px] leading-4 ${deskInk2}`}
              >
                至少选择一首
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
