// 收藏随机的选择面板（CAP-8/9/10/14）：非模态浮动工具窗，桌面居中、移动端停在上半部。
// 状态规则在 pickerModel，这里只渲染与转发交互；外观取自共享浮窗模块 floating-panel。
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import type { JSX } from "preact";
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import type {
  ShufflePlatform,
  ShuffleSelection,
  ShuffleWeight,
} from "../../../playback/ShuffleSelection";
import {
  isSingle,
  SHUFFLE_PLATFORMS,
} from "../../../playback/ShuffleSelection";
import {
  exportSelection,
  filterRows,
  formatSummary,
  initialPickerState,
  isTrackChecked,
  applyLoadedTracks,
  pickedCount,
  rowOf,
  setVisible,
  summarize,
  toggleRow,
  toggleTrack,
  type LoadedTracks,
  type PickerState,
  type PickerTrack,
  type RowCheck,
} from "./pickerModel";
import { cachedTracks, canExpand, loadTracks } from "./trackLoader";
import { PlatformTabs } from "./PlatformTabs";
import {
  constrainPosition,
  type MediaProgressPosition,
} from "../../../media-progress/model";
import {
  currentViewportPosition,
  pointerPosition,
} from "../../../media-progress/viewport";
import {
  DragGrip,
  focusRing,
  iconButton,
  PanelHeader,
  panelFrame,
  panelSurface,
  primaryButton,
  resetButton,
  secondaryButton,
  startsOnControl,
  stopHostGestures,
  Svg,
  textButton,
} from "../floating-panel/floatingPanel";
import {
  deskInk,
  deskInk2,
  deskOnRose,
  deskPressTone,
  deskRoseBorder,
  deskRoseBorderFocus,
  deskRoseSolid,
  deskRule,
  deskSkeleton,
  deskThumb,
} from "../floating-panel/tokens";
import {
  readShufflePickerPosition,
  saveShufflePickerPosition,
} from "./pickerPosition";

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

/** 一个平台标签本次打开期间的数据：收藏与未保存的勾选/权重。 */
interface TabData {
  records: FavoriteRecord[];
  state: PickerState;
}

const EMPTY_STATE: PickerState = { weight: "entry", rows: {} };

const PLATFORM_LABEL: Record<ShufflePlatform, string> = {
  netease: "网易云",
  bilibili: "B站",
};

const TYPE_LABEL: Record<FavoriteRecord["type"], string> = {
  song: "单曲",
  video: "视频",
  playlist: "歌单",
  album: "专辑",
};

const WEIGHT_HINT: Record<ShuffleWeight, string> = {
  entry: "每个收藏机会相同",
  song: "每首歌机会相同，大歌单出现更多",
};

const ShuffleIcon = ({ size = 22 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M16 3h5v5" />
    <path d="M4 20 21 3" />
    <path d="M21 16v5h-5" />
    <path d="m15 15 6 6" />
    <path d="M4 4l5 5" />
  </Svg>
);

const SearchIcon = () => (
  <Svg size={18} className="opacity-55">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

const ClearIcon = () => (
  <Svg size={18} className="opacity-55">
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Svg>
);

const NoteIcon = () => (
  <Svg size={20} strokeWidth={1.5}>
    <path d="M9 18V5l11-2v13M9 8l11-2" />
    <ellipse cx="6" cy="18" rx="3" ry="2.5" />
    <ellipse cx="17" cy="16" rx="3" ry="2.5" />
  </Svg>
);

const VideoIcon = () => (
  <Svg size={20} strokeWidth={1.5}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m10 9 5 3-5 3z" />
  </Svg>
);

const Spinner = () => (
  <Svg size={18} className="animate-spin">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Svg>
);

function Checkbox({
  check,
  disabled,
  label,
  onToggle,
}: {
  check: RowCheck;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  const on = check !== "none";
  return (
    <span
      role="checkbox"
      aria-checked={
        check === "all" ? "true" : check === "partial" ? "mixed" : "false"
      }
      aria-disabled={disabled ? "true" : undefined}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${focusRing} ${disabled ? "cursor-not-allowed opacity-35" : "cursor-pointer"}`}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onToggle();
      }}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 border-solid ${on ? `${deskRoseBorder} ${deskRoseSolid} ${deskOnRose}` : "border-current/40 bg-transparent"}`}
      >
        {check === "all" && (
          <Svg size={14} strokeWidth={3}>
            <path d="m5 12 5 5 9-10" />
          </Svg>
        )}
        {check === "partial" && (
          <Svg size={14} strokeWidth={3}>
            <path d="M6 12h12" />
          </Svg>
        )}
      </span>
    </span>
  );
}

function Cover({ record }: { record: FavoriteRecord }) {
  const [failed, setFailed] = useState(false);
  const src = (record.coverImg || "").replace(/^http:\/\//, "https://");
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${deskThumb} ${deskInk2}`}
    >
      {src && !failed ? (
        <img
          className="block h-full w-full object-cover"
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : record.type === "video" ? (
        <VideoIcon />
      ) : (
        <NoteIcon />
      )}
    </span>
  );
}

function isMobileViewport(): boolean {
  return !!window.matchMedia?.("(max-width: 768px)").matches;
}

/** 曲目展开区 id：由收藏主键派生（非法字符换成下划线），不随搜索过滤变化。 */
function tracksRegionId(id: string): string {
  return `imw-shuffle-picker-tracks-${id.replace(/[^\w-]/g, "_")}`;
}

const tabId = (platform: ShufflePlatform) =>
  `imw-shuffle-picker-tab-${platform}`;
const LIST_ID = "imw-shuffle-picker-list";

/** 拖动手柄里按下这些元素不触发拖动（关闭钮等照常工作）。 */

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
  const [tabs, setTabs] = useState<Partial<Record<ShufflePlatform, TabData>>>(
    {},
  );
  // 本次打开期间用户改动过选择或权重的平台：确认时一并保存。
  const [dirty, setDirty] = useState<ReadonlySet<ShufflePlatform>>(new Set());
  const [loaded, setLoaded] = useState<LoadedTracks>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  // 已发起读取的平台：每个标签打开期间只读一次，切回来沿用本次的改动。
  const requested = useRef(new Set<ShufflePlatform>());
  // 读取失败的平台：显示「读取收藏失败」与重试，不当成空收藏。
  const [loadFailed, setLoadFailed] = useState<ReadonlySet<ShufflePlatform>>(
    new Set(),
  );
  // 拖动位置：有已存位置时作浮动卡片（fixed + left/top），否则保持默认摆放。
  const [position, setPosition] = useState<MediaProgressPosition | null>(
    () => readShufflePickerPosition() ?? null,
  );
  const positionRef = useRef(position);
  const [dragging, setDragging] = useState(false);
  // 定位层：铺满视口但不拦截指针（非模态），也不带 transform，用于实测宿站缩放。
  const layer = useRef<HTMLDivElement>(null);
  const move = useRef<{
    pointer: number;
    x: number;
    y: number;
    left: number;
    top: number;
    /** 指针真的移动过：只有移动过的拖动才保存位置。 */
    moved: boolean;
    /** 从默认摆放起拖：未移动就结束时退回默认摆放。 */
    fromDefault: boolean;
  }>();
  const floating = position !== null;

  const tab = tabs[platform];
  const records = tab?.records ?? null;
  const state = tab?.state ?? EMPTY_STATE;

  /** 改某个平台标签的勾选状态；user 为真时记为本次改动过（确认时保存）。 */
  const updateTab = (
    target: ShufflePlatform,
    update: (prev: PickerState) => PickerState,
    user = true,
  ) => {
    setTabs((prev) => {
      const current = prev[target];
      if (!current) return prev;
      return {
        ...prev,
        [target]: { ...current, state: update(current.state) },
      };
    });
    if (user)
      setDirty((prev) => (prev.has(target) ? prev : new Set(prev).add(target)));
  };
  const setState = (update: (prev: PickerState) => PickerState) =>
    updateTab(platform, update);

  const loadTab = (target: ShufflePlatform) => {
    if (requested.current.has(target)) return;
    requested.current.add(target);
    setLoadFailed((prev) => {
      if (!prev.has(target)) return prev;
      const next = new Set(prev);
      next.delete(target);
      return next;
    });
    load(target)
      .catch((): null => null)
      .then((source) => {
        if (!alive.current) return;
        if (!source) {
          // 允许重试：下次重试（或切回该标签）重新读取。
          requested.current.delete(target);
          setLoadFailed((prev) => new Set(prev).add(target));
          return;
        }
        const { records: list, saved } = source;
        const cached: LoadedTracks = new Map();
        let initial = initialPickerState(list, saved);
        for (const record of list) {
          const tracks = cachedTracks(record.id);
          if (!tracks) continue;
          cached.set(record.id, tracks);
          initial = applyLoadedTracks(initial, record.id, tracks);
        }
        setLoaded((prev) => {
          if (cached.size === 0) return prev;
          const next = new Map(prev);
          for (const [id, tracks] of cached) next.set(id, tracks);
          return next;
        });
        setTabs((prev) => ({
          ...prev,
          [target]: { records: list, state: initial },
        }));
      });
  };

  useEffect(() => {
    if (ready && !loadFailed.has(platform)) loadTab(platform);
  }, [ready, platform, load]);

  useEffect(() => {
    alive.current = true;
    // 下一帧再切到可见态，让入场过渡生效。
    const frame = requestAnimationFrame(() => setShown(true));
    // 移动端不自动聚焦搜索框，避免弹出键盘遮挡列表。
    if (isMobileViewport()) dialog.current?.focus({ preventScroll: true });
    else search.current?.focus({ preventScroll: true });
    return () => {
      alive.current = false;
      cancelAnimationFrame(frame);
    };
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

  const fetchTracks = (record: FavoriteRecord) => {
    setLoading((prev) => new Set(prev).add(record.id));
    setFailed((prev) => {
      const next = new Set(prev);
      next.delete(record.id);
      return next;
    });
    void loadTracks(record).then((tracks) => {
      if (!alive.current) return;
      setLoading((prev) => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
      if (tracks) {
        setLoaded((prev) => new Map(prev).set(record.id, tracks));
        // 曲目归一不算用户改动；按收藏所属平台写回（期间可能已切到别的标签）。
        updateTab(
          record.platform,
          (prev) => applyLoadedTracks(prev, record.id, tracks),
          false,
        );
      } else setFailed((prev) => new Set(prev).add(record.id));
    });
  };

  const toggleExpand = (record: FavoriteRecord) => {
    const open = expanded.has(record.id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.delete(record.id);
      else next.add(record.id);
      return next;
    });
    if (!open && !loaded.has(record.id) && !loading.has(record.id))
      fetchTracks(record);
  };

  const confirm = () => {
    if (!canConfirm) return;
    // 当前标签必存；其他标签只存本次改动过且有收藏的。
    const selections: ShufflePickerResult["selections"] = {};
    for (const target of SHUFFLE_PLATFORMS) {
      const data = tabs[target];
      if (!data) continue;
      if (target !== platform && (!dirty.has(target) || !data.records.length))
        continue;
      const selection = exportSelection(data.state, data.records, loaded);
      // 其他标签选成空的不保存：保留该平台原有的选择。
      if (target !== platform && selection.items.length === 0) continue;
      selections[target] = selection;
    }
    onConfirm({ platform, selections });
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

  const place = (next: MediaProgressPosition) => {
    const previous = positionRef.current;
    if (previous && previous.x === next.x && previous.y === next.y) return;
    positionRef.current = next;
    setPosition(next);
  };

  // 缩放比例取定位层（无 transform）：面板入场的 scale 会让面板自身的实测比例失真。
  const clampToViewport = (x: number, y: number) => {
    const element = dialog.current!;
    const { metrics, offsetLeft, offsetTop } = currentViewportPosition(
      layer.current!,
    );
    return constrainPosition(
      x,
      y,
      element.offsetWidth,
      element.offsetHeight,
      metrics.width,
      metrics.height,
      offsetLeft,
      offsetTop,
    );
  };

  // 结束拖动（松手、取消、失焦、丢失捕获、面板退场）：移动过才保存；
  // 从默认摆放起拖却没移动（单纯点按）则退回默认摆放，存储不动。
  const endDrag = () => {
    const drag = move.current;
    if (!drag) return;
    move.current = undefined;
    setDragging(false);
    if (drag.moved) {
      if (positionRef.current) saveShufflePickerPosition(positionRef.current);
    } else if (drag.fromDefault) {
      positionRef.current = null;
      setPosition(null);
    }
  };

  // 打开时、视口变化/滚动与面板尺寸变化时把位置收回视口内（只改内存，不写存储）。
  // 视口变化不打断拖动（移动端键盘收起、地址栏伸缩会在触摸拖动开始时触发 resize）。
  useLayoutEffect(() => {
    if (!floating) return;
    const constrain = () => {
      const current = positionRef.current;
      if (!current || !dialog.current || !layer.current) return;
      place(clampToViewport(current.x, current.y));
    };
    // 拖动起点切换成浮动卡片时不立即收回：卡片停在原视觉位置，首次移动再约束。
    if (!move.current) constrain();
    window.addEventListener("resize", constrain);
    window.addEventListener("scroll", constrain, { passive: true });
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", constrain);
    viewport?.addEventListener("scroll", constrain);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(constrain);
    if (dialog.current) observer?.observe(dialog.current);
    return () => {
      window.removeEventListener("resize", constrain);
      window.removeEventListener("scroll", constrain);
      viewport?.removeEventListener("resize", constrain);
      viewport?.removeEventListener("scroll", constrain);
      observer?.disconnect();
    };
  }, [floating]);

  useEffect(() => {
    window.addEventListener("blur", endDrag);
    return () => window.removeEventListener("blur", endDrag);
  }, []);

  // 拖动中面板开始退场（Esc、返回、确认）：结束拖动，之后的指针事件一律忽略。
  useEffect(() => {
    if (exiting) endDrag();
  }, [exiting]);

  const dragHandle = {
    onPointerDown: (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || event.button !== 0 || exiting) return;
      if (startsOnControl(event)) return;
      const element = dialog.current;
      if (!element || !layer.current) return;
      const pointer = pointerPosition(
        layer.current,
        event.clientX,
        event.clientY,
      );
      const fromDefault = !positionRef.current;
      // 默认摆放时取面板当前的视觉位置（含入场缩放），按定位层实测缩放换算，
      // 并立即切成浮动卡片，让布局变化发生在移动之前，手指下不跳。
      let start = positionRef.current;
      if (!start) {
        const rect = element.getBoundingClientRect();
        start = pointerPosition(layer.current, rect.left, rect.top);
        positionRef.current = start;
        setPosition(start);
      }
      move.current = {
        pointer: event.pointerId,
        x: pointer.x,
        y: pointer.y,
        left: start.x,
        top: start.y,
        moved: false,
        fromDefault,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging(true);
    },
    onPointerMove: (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
      const start = move.current;
      if (!start || start.pointer !== event.pointerId || exiting) return;
      if (!dialog.current || !layer.current) return;
      const pointer = pointerPosition(
        layer.current,
        event.clientX,
        event.clientY,
      );
      if (pointer.x === start.x && pointer.y === start.y) return;
      start.moved = true;
      place(
        clampToViewport(
          start.left + pointer.x - start.x,
          start.top + pointer.y - start.y,
        ),
      );
    },
    onPointerUp: (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
      if (move.current?.pointer === event.pointerId) endDrag();
    },
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
  };

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
          <span className="opacity-65">加载失败</span>
          <button
            type="button"
            className={textButton}
            onClick={() => {
              fetchTracks(record);
              // 「重试」随即被骨架替换：焦点交给面板，Esc 与 Tab 循环仍然有效。
              dialog.current?.focus({ preventScroll: true });
            }}
          >
            重试
          </button>
        </div>
      );
    else if (loaded.get(record.id)?.length === 0)
      body = (
        <div className="flex h-11 items-center pl-[52px] pr-3 text-[12px] opacity-65">
          {record.type === "album" ? "专辑" : "歌单"}里没有可播放的曲目
        </div>
      );
    else
      body = (tracks ?? []).map((track) => {
        const checked = isTrackChecked(state, record.id, track.id);
        const toggle = () =>
          setState((prev) =>
            toggleTrack(prev, record.id, track.id, loaded.get(record.id)!),
          );
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
                <span className="shrink-0 max-w-[45%] truncate text-[12px] opacity-65">
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
      ref={layer}
      data-imw-theme={dark ? "dark" : "light"}
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
              dark={dark}
              disabled={exiting || busy}
              tabId={tabId}
              controls={LIST_ID}
              ariaLabel="随机平台"
            />
          </div>
        )}

        <div className="shrink-0 px-3">
          <div
            className={`flex h-11 items-center rounded-lg border border-solid pl-3 ${deskRule} ${deskRoseBorderFocus}`}
          >
            <SearchIcon />
            <input
              ref={search}
              type="search"
              value={input}
              placeholder="搜索标题或作者…"
              aria-label="搜索标题或作者"
              className="m-0 h-full min-w-0 flex-1 appearance-none border-0 bg-transparent px-2 font-[inherit] text-[14px] text-inherit outline-none placeholder:text-current placeholder:opacity-50 max-[768px]:text-[16px] [&::-webkit-search-cancel-button]:hidden"
              onInput={(event) => setInput(event.currentTarget.value)}
            />
            {input && (
              <button
                type="button"
                className={iconButton}
                aria-label="清除搜索"
                onClick={() => {
                  setInput("");
                  setQuery("");
                  search.current?.focus();
                }}
              >
                <ClearIcon />
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-1 px-2 py-1">
          <button
            type="button"
            className={textButton}
            disabled={!records}
            onClick={() => bulk(true)}
          >
            全选
          </button>
          <button
            type="button"
            className={textButton}
            disabled={!records}
            onClick={() => bulk(false)}
          >
            全不选
          </button>
          <div className="ml-auto flex flex-col items-end">
            <div
              role="radiogroup"
              aria-label="随机权重"
              className={`flex h-8 overflow-hidden rounded-lg border border-solid ${deskRule}`}
            >
              {(["entry", "song"] as const).map((weight) => {
                const selected = state.weight === weight;
                return (
                  <button
                    key={weight}
                    type="button"
                    role="radio"
                    aria-checked={selected ? "true" : "false"}
                    tabIndex={selected ? 0 : -1}
                    className={`${resetButton} relative h-full border-0 px-3 text-[13px] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] max-[768px]:text-[12px] ${selected ? `${deskRoseSolid} ${deskOnRose}` : `bg-transparent text-inherit ${deskPressTone}`}`}
                    onClick={() => setState((prev) => ({ ...prev, weight }))}
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
                      const other = weight === "entry" ? "song" : "entry";
                      setState((prev) => ({ ...prev, weight: other }));
                      const sibling =
                        event.currentTarget.parentElement?.querySelector<HTMLElement>(
                          `[data-weight="${other}"]`,
                        );
                      sibling?.focus();
                    }}
                    data-weight={weight}
                  >
                    {weight === "entry" ? "按条目" : "按歌曲"}
                  </button>
                );
              })}
            </div>
            <div className="mt-0.5 text-[11px] leading-4 opacity-65">
              {WEIGHT_HINT[state.weight]}
            </div>
          </div>
        </div>

        <div
          id={LIST_ID}
          role={showTabs ? "tabpanel" : undefined}
          data-platform={platform}
          aria-labelledby={
            showTabs ? tabId(platform) : "imw-shuffle-picker-title"
          }
          className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain border-0 border-y border-solid ${deskRule}`}
        >
          {!records && loadFailed.has(platform) ? (
            <div className="flex h-28 flex-col items-center justify-center gap-1">
              <span className="text-[13px] opacity-65">读取收藏失败</span>
              <button
                type="button"
                className={textButton}
                onClick={() => {
                  loadTab(platform);
                  // 「重试」随即被加载态替换：焦点交给面板。
                  dialog.current?.focus({ preventScroll: true });
                }}
              >
                重试
              </button>
            </div>
          ) : !records ? (
            <div className="flex h-24 items-center justify-center gap-2 opacity-65">
              <Spinner />
              <span className="text-[13px]">正在读取收藏…</span>
            </div>
          ) : list.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-[13px] opacity-65">
              该平台还没有收藏
            </div>
          ) : visible.length === 0 ? (
            <div className="flex h-28 flex-col items-center justify-center gap-1">
              <span className="text-[13px] opacity-65">没有匹配的收藏</span>
              <button
                type="button"
                className={textButton}
                onClick={() => {
                  setInput("");
                  setQuery("");
                  // 本按钮随空态一起卸载：焦点移回搜索框。
                  search.current?.focus({ preventScroll: true });
                }}
              >
                清除搜索
              </button>
            </div>
          ) : (
            visible.map(({ record, tracks }) => {
              const row = rowOf(state, record.id);
              const single = isSingle(record);
              const expandable = canExpand(record);
              const open = expandable && expanded.has(record.id);
              const disabled = empty(record.id);
              const toggle = () => {
                if (!disabled) setState((prev) => toggleRow(prev, record.id));
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
                      <div className="truncate text-[12px] leading-4 tabular-nums opacity-65">
                        {sub}
                      </div>
                    </div>
                    {expandable && (
                      <button
                        type="button"
                        className={iconButton}
                        aria-label={`${open ? "收起" : "展开"}${record.title}`}
                        aria-expanded={open ? "true" : "false"}
                        aria-controls={
                          open ? tracksRegionId(record.id) : undefined
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleExpand(record);
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

        <div className="flex min-h-16 shrink-0 items-center gap-2 px-3 py-2.5 max-[768px]:flex-col max-[768px]:items-stretch">
          <div className="min-w-0 flex-1 truncate text-[13px] tabular-nums opacity-80 max-[768px]:text-[12px]">
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
                className="mt-1 text-right text-[11px] leading-4 opacity-65"
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
