import { describe, expect, it } from "vitest";
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import {
  exportSelection,
  filterRows,
  formatSummary,
  applyLoadedTracks,
  initialPickerState,
  isTrackChecked,
  rowOf,
  setVisible,
  summarize,
  toggleRow,
  toggleTrack,
  type LoadedTracks,
  type PickerTrack,
} from "./pickerModel";

function record(
  type: FavoriteRecord["type"],
  raw: string,
  patch: Partial<FavoriteRecord> = {},
): FavoriteRecord {
  return {
    id: `netease:${type}:${raw}`,
    platform: "netease",
    type,
    title: `标题${raw}`,
    coverImg: "",
    author: "作者",
    websiteUrl: "",
    createdAt: 1,
    updatedAt: 1,
    platformData: {
      title: "",
      coverImg: "",
      author: "",
      websiteUrl: "",
      neteaseMusic: { id: Number(raw), fee: 0 },
    },
    ...patch,
  } as FavoriteRecord;
}

const A = record("song", "1", { title: "晴天", author: "周杰伦" });
const P = record("playlist", "2", { title: "通勤歌单", trackCount: "3" });
const B = record("song", "3", { title: "后来", author: "刘若英" });
const tracks: PickerTrack[] = [
  { id: "11", name: "七里香", artist: "周杰伦" },
  { id: "12", name: "夜曲", artist: "周杰伦" },
  { id: "13", name: "红豆", artist: "王菲" },
];

describe("pickerModel", () => {
  it("首次打开：全部整条勾选、按条目、摘要计数正确", () => {
    const state = initialPickerState([A, P, B], null);
    expect(state.weight).toBe("entry");
    for (const r of [A, P, B]) expect(rowOf(state, r.id).check).toBe("all");
    const summary = summarize(state, [A, P, B], new Map());
    expect(summary).toEqual({ entries: 3, songs: 5, approximate: false });
    expect(formatSummary(summary)).toBe("已选 3 条 · 5 首");
  });

  it("预填：整条 / 部分 / 后来新增的收藏为未勾", () => {
    const state = initialPickerState([A, P, B], {
      weight: "song",
      items: [{ id: A.id }, { id: P.id, tracks: ["11", "12"] }],
    });
    expect(state.weight).toBe("song");
    expect(rowOf(state, A.id).check).toBe("all");
    expect(rowOf(state, P.id).check).toBe("partial");
    expect(rowOf(state, B.id).check).toBe("none");
    expect(isTrackChecked(state, P.id, "11")).toBe(true);
    expect(isTrackChecked(state, P.id, "12")).toBe(true);
    expect(isTrackChecked(state, P.id, "13")).toBe(false);
    expect(formatSummary(summarize(state, [A, P, B], new Map()))).toBe(
      "已选 2 条 · 3 首",
    );
  });

  it("三态切换：部分 → 全选 → 未选", () => {
    let state = initialPickerState([P], {
      weight: "entry",
      items: [{ id: P.id, tracks: ["11"] }],
    });
    state = toggleRow(state, P.id);
    expect(rowOf(state, P.id).check).toBe("all");
    state = toggleRow(state, P.id);
    expect(rowOf(state, P.id).check).toBe("none");
  });

  it("逐首勾满全部曲目即转整条，导出为整条", () => {
    let state = initialPickerState([P], { weight: "entry", items: [] });
    state = toggleTrack(state, P.id, "11", tracks);
    expect(rowOf(state, P.id).check).toBe("partial");
    state = toggleTrack(state, P.id, "12", tracks);
    state = toggleTrack(state, P.id, "13", tracks);
    expect(rowOf(state, P.id).check).toBe("all");
    const loaded: LoadedTracks = new Map([[P.id, tracks]]);
    expect(exportSelection(state, [P], loaded).items).toEqual([{ id: P.id }]);
  });

  it("整条下取消一首变部分，取消最后一首变未选", () => {
    let state = initialPickerState([P], null);
    state = toggleTrack(state, P.id, "12", tracks);
    expect(rowOf(state, P.id)).toEqual({
      check: "partial",
      tracks: ["11", "13"],
    });
    state = toggleTrack(state, P.id, "11", tracks);
    state = toggleTrack(state, P.id, "13", tracks);
    expect(rowOf(state, P.id).check).toBe("none");
  });

  it("导出时部分勾选满已加载曲目存整条，已不在歌单的曲目剔除", () => {
    const state = initialPickerState([P], {
      weight: "entry",
      items: [{ id: P.id, tracks: ["11", "99"] }],
    });
    const loaded: LoadedTracks = new Map([[P.id, tracks]]);
    expect(exportSelection(state, [P], loaded).items).toEqual([
      { id: P.id, tracks: ["11"] },
    ]);
    const full = initialPickerState([P], {
      weight: "entry",
      items: [{ id: P.id, tracks: ["11", "12", "13"] }],
    });
    expect(exportSelection(full, [P], loaded).items).toEqual([{ id: P.id }]);
  });

  it("搜索 + 全选只勾可见行，被过滤的原勾选保留并计入摘要", () => {
    let state = initialPickerState([A, P, B], {
      weight: "entry",
      items: [{ id: B.id }],
    });
    const visible = filterRows([A, P, B], "周", new Map(), new Set());
    expect(visible.map((row) => row.record.id)).toEqual([A.id]);
    state = setVisible(state, visible, true, new Map());
    expect(rowOf(state, A.id).check).toBe("all");
    expect(rowOf(state, P.id).check).toBe("none");
    expect(rowOf(state, B.id).check).toBe("all");
    expect(summarize(state, [A, P, B], new Map()).entries).toBe(2);
  });

  it("搜索不区分大小写，命中已加载曲目时保留歌单行且全选只改可见曲目", () => {
    const loaded: LoadedTracks = new Map([[P.id, tracks]]);
    const visible = filterRows([A, P, B], "王菲", loaded, new Set([P.id]));
    expect(visible).toHaveLength(1);
    expect(visible[0].self).toBe(false);
    expect(visible[0].tracks?.map((t) => t.id)).toEqual(["13"]);
    const state = setVisible(
      initialPickerState([A, P, B], { weight: "entry", items: [] }),
      visible,
      true,
      loaded,
    );
    expect(rowOf(state, P.id)).toEqual({ check: "partial", tracks: ["13"] });
    expect(
      filterRows([{ ...A, title: "Sunny" }], "SUN", new Map(), new Set()),
    ).toHaveLength(1);
  });

  it("收起的歌单只按标题/作者匹配，缓存里的曲目不参与搜索", () => {
    const loaded: LoadedTracks = new Map([[P.id, tracks]]);
    expect(filterRows([A, P, B], "王菲", loaded, new Set())).toEqual([]);
    const visible = filterRows([A, P, B], "通勤", loaded, new Set());
    expect(visible).toHaveLength(1);
    expect(visible[0].tracks).toBeNull();
    const state = setVisible(
      initialPickerState([A, P, B], { weight: "entry", items: [] }),
      visible,
      true,
      loaded,
    );
    expect(rowOf(state, P.id).check).toBe("all");
  });

  it("曲目加载后归一：空歌单转未勾，部分勾选全部失效转未勾", () => {
    const whole = initialPickerState([P], null);
    expect(rowOf(applyLoadedTracks(whole, P.id, []), P.id).check).toBe("none");
    const stale = initialPickerState([P], {
      weight: "entry",
      items: [{ id: P.id, tracks: ["98", "99"] }],
    });
    const next = applyLoadedTracks(stale, P.id, tracks);
    expect(rowOf(next, P.id).check).toBe("none");
    expect(summarize(next, [P], new Map([[P.id, tracks]])).entries).toBe(0);
    const partial = initialPickerState([P], {
      weight: "entry",
      items: [{ id: P.id, tracks: ["11", "99"] }],
    });
    expect(applyLoadedTracks(partial, P.id, tracks)).toBe(partial);
    expect(applyLoadedTracks(whole, P.id, tracks)).toBe(whole);
  });

  it("搜索无结果返回空列表", () => {
    expect(filterRows([A, P, B], "不存在", new Map(), new Set())).toEqual([]);
  });

  it("全不选：摘要「未选择」，导出为空", () => {
    const visible = filterRows([A, P, B], "", new Map(), new Set());
    const state = setVisible(
      initialPickerState([A, P, B], null),
      visible,
      false,
      new Map(),
    );
    const summary = summarize(state, [A, P, B], new Map());
    expect(summary.entries).toBe(0);
    expect(formatSummary(summary)).toBe("未选择");
    expect(exportSelection(state, [A, P, B], new Map()).items).toEqual([]);
  });

  it("全选跳过置灰的空歌单", () => {
    const visible = filterRows([A, P], "", new Map(), new Set());
    const state = setVisible(
      initialPickerState([A, P], { weight: "entry", items: [] }),
      visible,
      true,
      new Map(),
      (id) => id === P.id,
    );
    expect(rowOf(state, A.id).check).toBe("all");
    expect(rowOf(state, P.id).check).toBe("none");
  });

  it("整单缺 trackCount 时摘要标「约」并按已知数计", () => {
    const Q = record("album", "5");
    const summary = summarize(
      initialPickerState([A, Q], null),
      [A, Q],
      new Map(),
    );
    expect(summary).toEqual({ entries: 2, songs: 1, approximate: true });
    expect(formatSummary(summary)).toBe("已选 2 条 · 约 1 首");
  });

  it("导出保留权重与收藏顺序", () => {
    const state = {
      ...initialPickerState([A, P, B], null),
      weight: "song" as const,
    };
    expect(exportSelection(state, [A, P, B], new Map())).toEqual({
      weight: "song",
      items: [{ id: A.id }, { id: P.id }, { id: B.id }],
    });
  });
});
