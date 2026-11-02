// 收藏随机面板的列表区：搜索/加载/空态与收藏行、展开后的曲目区。
// 勾选状态一律由调用处回写（本文件不持有 state）。
import type { JSX } from "preact";
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import {
  isSingle,
  type ShufflePlatform,
} from "../../../playback/ShuffleSelection";
import {
  isTrackChecked,
  pickedCount,
  rowOf,
  type LoadedTracks,
  type PickerState,
  type PickerTrack,
  type VisibleRow,
} from "./pickerModel";
import { canExpand } from "./trackLoader";
import { iconButton, Svg, textButton } from "../floating-panel/floatingPanel";
import {
  deskInk2,
  deskPressTone,
  deskRule,
  deskSkeleton,
} from "../floating-panel/tokens";
import {
  LIST_ID,
  Spinner,
  tabId,
  tracksRegionId,
  TYPE_LABEL,
} from "./pickerChrome";
import { Checkbox, Cover } from "./PickerRowParts";

export interface PickerListProps {
  platform: ShufflePlatform;
  /** 有平台标签行时列表区是 `tabpanel`，否则由标题标注。 */
  showTabs: boolean;
  /** null = 该标签的收藏还没读回来（读取中或读取失败）。 */
  records: FavoriteRecord[] | null;
  list: FavoriteRecord[];
  visible: VisibleRow[];
  state: PickerState;
  loaded: LoadedTracks;
  expanded: ReadonlySet<string>;
  loading: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  loadFailed: boolean;
  onToggleRow: (record: FavoriteRecord) => void;
  onToggleTrack: (id: string, trackId: string) => void;
  onToggleExpand: (record: FavoriteRecord) => void;
  onRetryLoad: () => void;
  onRetryTracks: (record: FavoriteRecord) => void;
  onClearSearch: () => void;
}

/** 列表区：读取中、读取失败、空收藏、无匹配、收藏行与展开的曲目区。 */
export function PickerList({
  platform,
  showTabs,
  records,
  list,
  visible,
  state,
  loaded,
  expanded,
  loading,
  failed,
  loadFailed,
  onToggleRow,
  onToggleTrack,
  onToggleExpand,
  onRetryLoad,
  onRetryTracks,
  onClearSearch,
}: PickerListProps) {
  const renderTracks = (
    record: FavoriteRecord,
    tracks: PickerTrack[] | null,
  ) => {
    const regionId = tracksRegionId(record.id);
    let body: JSX.Element | JSX.Element[];
    if (loading.has(record.id))
      body = [0, 1, 2].map((key) => (
        <div
          key={key}
          className="flex h-11 animate-pulse items-center gap-3 pl-[52px] pr-3"
        >
          <span className={`h-5 w-5 shrink-0 rounded-md ${deskSkeleton}`} />
          <span className={`h-3 flex-1 rounded ${deskSkeleton}`} />
        </div>
      ));
    else if (failed.has(record.id))
      body = (
        <div className="flex h-11 items-center gap-2 pl-[52px] pr-3 text-[12px]">
          <span className={deskInk2}>加载失败</span>
          <button
            type="button"
            className={textButton}
            onClick={() => onRetryTracks(record)}
          >
            重试
          </button>
        </div>
      );
    else if (loaded.get(record.id)?.length === 0)
      body = (
        <div
          className={`flex h-11 items-center pl-[52px] pr-3 text-[12px] ${deskInk2}`}
        >
          {record.type === "album" ? "专辑" : "歌单"}里没有可播放的曲目
        </div>
      );
    else
      body = (tracks ?? []).map((track) => {
        const checked = isTrackChecked(state, record.id, track.id);
        const toggle = () => onToggleTrack(record.id, track.id);
        return (
          <div
            key={track.id}
            className={`flex h-11 cursor-pointer items-center gap-1 pl-[40px] pr-3 ${deskPressTone}`}
            onClick={toggle}
          >
            <Checkbox
              check={checked ? "all" : "none"}
              label={track.name}
              onToggle={toggle}
            />
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="truncate text-[13px]">{track.name}</span>
              {track.artist && (
                <span
                  className={`shrink-0 max-w-[45%] truncate text-[12px] ${deskInk2}`}
                >
                  {track.artist}
                </span>
              )}
            </div>
          </div>
        );
      });
    return (
      <div id={regionId} role="group" aria-label={`${record.title} 的曲目`}>
        {body}
      </div>
    );
  };

  return (
    <div
      id={LIST_ID}
      role={showTabs ? "tabpanel" : undefined}
      data-platform={platform}
      aria-labelledby={showTabs ? tabId(platform) : "imw-shuffle-picker-title"}
      className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain border-0 border-y border-solid ${deskRule}`}
    >
      {!records && loadFailed ? (
        <div className="flex h-28 flex-col items-center justify-center gap-1">
          <span className={`text-[13px] ${deskInk2}`}>读取收藏失败</span>
          <button type="button" className={textButton} onClick={onRetryLoad}>
            重试
          </button>
        </div>
      ) : !records ? (
        <div
          className={`flex h-24 items-center justify-center gap-2 ${deskInk2}`}
        >
          <Spinner />
          <span className="text-[13px]">正在读取收藏…</span>
        </div>
      ) : list.length === 0 ? (
        <div
          className={`flex h-24 items-center justify-center text-[13px] ${deskInk2}`}
        >
          该平台还没有收藏
        </div>
      ) : visible.length === 0 ? (
        <div className="flex h-28 flex-col items-center justify-center gap-1">
          <span className={`text-[13px] ${deskInk2}`}>没有匹配的收藏</span>
          <button type="button" className={textButton} onClick={onClearSearch}>
            清除搜索
          </button>
        </div>
      ) : (
        visible.map(({ record, tracks }) => {
          const row = rowOf(state, record.id);
          const single = isSingle(record);
          const expandable = canExpand(record);
          const open = expandable && expanded.has(record.id);
          // 与父组件里 `empty()` 同一判定：空合集不可点选（两处需同步改）。
          const disabled = loaded.get(record.id)?.length === 0;
          const toggle = () => {
            if (!disabled) onToggleRow(record);
          };
          const picked =
            row.check === "partial"
              ? pickedCount(row, loaded.get(record.id))
              : 0;
          const sub = single
            ? `${record.author || "未知作者"} · ${TYPE_LABEL[record.type]}`
            : `${record.trackCount ? `${record.trackCount} 首 · ` : ""}${TYPE_LABEL[record.type]}${row.check === "partial" ? ` · 已选 ${picked}` : ""}`;
          return (
            <div key={record.id}>
              <div
                className={`flex h-14 items-center gap-1 pl-1 pr-1 ${disabled ? "" : `cursor-pointer ${deskPressTone}`}`}
                onClick={toggle}
              >
                <Checkbox
                  check={row.check}
                  disabled={disabled}
                  label={record.title}
                  onToggle={toggle}
                />
                <Cover record={record} />
                <div className="ml-2 min-w-0 flex-1">
                  <div
                    className="truncate text-[14px] leading-5"
                    title={record.title}
                  >
                    {record.title}
                  </div>
                  <div
                    className={`truncate text-[12px] leading-4 tabular-nums ${deskInk2}`}
                  >
                    {sub}
                  </div>
                </div>
                {expandable && (
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`${open ? "收起" : "展开"}${record.title}`}
                    aria-expanded={open ? "true" : "false"}
                    aria-controls={open ? tracksRegionId(record.id) : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleExpand(record);
                    }}
                  >
                    {loading.has(record.id) ? (
                      <Spinner />
                    ) : (
                      <span
                        className={`block transition-[rotate] duration-[120ms] ${open ? "rotate-90" : "rotate-0"}`}
                      >
                        <Svg size={18}>
                          <path d="m9 6 6 6-6 6" />
                        </Svg>
                      </span>
                    )}
                  </button>
                )}
              </div>
              {open && renderTracks(record, tracks)}
            </div>
          );
        })
      )}
    </div>
  );
}
