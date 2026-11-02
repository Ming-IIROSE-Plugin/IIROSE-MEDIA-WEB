// 收藏随机面板的数据接线：每个平台标签的收藏与未保存勾选、曲目加载、确认导出。
// 组件只渲染；读取时序与勾选规则回写都在这里（纯规则本身在 pickerModel）。
import { useEffect, useRef, useState } from "preact/hooks";
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import type {
  ShufflePlatform,
  ShuffleSelection,
} from "../../../playback/ShuffleSelection";
import { SHUFFLE_PLATFORMS } from "../../../playback/ShuffleSelection";
import {
  applyLoadedTracks,
  exportSelection,
  initialPickerState,
  type LoadedTracks,
  type PickerState,
} from "./pickerModel";
import { cachedTracks, loadTracks } from "./trackLoader";

/** 一个平台标签本次打开期间的数据：收藏与未保存的勾选/权重。 */
interface TabData {
  records: FavoriteRecord[];
  state: PickerState;
}

export interface PickerTabsModel {
  tabs: Partial<Record<ShufflePlatform, TabData>>;
  loaded: LoadedTracks;
  expanded: ReadonlySet<string>;
  loading: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  /** 读取失败的平台：显示「读取收藏失败」与重试，不当成空收藏。 */
  loadFailed: ReadonlySet<ShufflePlatform>;
  /** 改当前标签的勾选状态（记为本次改动过，确认时保存）。 */
  setState: (update: (prev: PickerState) => PickerState) => void;
  loadTab: (target: ShufflePlatform) => void;
  fetchTracks: (record: FavoriteRecord) => void;
  toggleExpand: (record: FavoriteRecord) => void;
  /** 确认时的各平台选择：当前标签必存，其他标签只存改动过且有收藏的。 */
  buildSelections: (
    platform: ShufflePlatform,
  ) => Partial<Record<ShufflePlatform, ShuffleSelection>>;
}

export function usePickerTabs({
  ready,
  platform,
  load,
}: {
  /** 可见平台已算好：算好之前不读任何平台。 */
  ready: boolean;
  platform: ShufflePlatform;
  load: (platform: ShufflePlatform) => Promise<{
    records: FavoriteRecord[];
    saved: ShuffleSelection | null;
  }>;
}): PickerTabsModel {
  const [tabs, setTabs] = useState<Partial<Record<ShufflePlatform, TabData>>>(
    {},
  );
  // 本次打开期间用户改动过选择或权重的平台：确认时一并保存。
  const [dirty, setDirty] = useState<ReadonlySet<ShufflePlatform>>(new Set());
  const [loaded, setLoaded] = useState<LoadedTracks>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  // 读取失败的平台：显示「读取收藏失败」与重试，不当成空收藏。
  const [loadFailed, setLoadFailed] = useState<ReadonlySet<ShufflePlatform>>(
    new Set(),
  );
  const alive = useRef(true);
  // 已发起读取的平台：每个标签打开期间只读一次，切回来沿用本次的改动。
  const requested = useRef(new Set<ShufflePlatform>());

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
    return () => {
      alive.current = false;
    };
  }, []);

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

  const buildSelections = (platform: ShufflePlatform) => {
    // 当前标签必存；其他标签只存本次改动过且有收藏的。
    const selections: Partial<Record<ShufflePlatform, ShuffleSelection>> = {};
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
    return selections;
  };

  return {
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
  };
}
