import { afterEach, describe, expect, it } from "vitest";
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import {
  createShuffleRound,
  defaultShufflePlatform,
  loadShufflePlatform,
  resolvePickerPlatforms,
  resolveShufflePlatform,
  saveShufflePlatform,
  loadShuffleSelection,
  pickShuffleEntry,
  remainingShare,
  resolveShuffleSelection,
  saveShuffleSelection,
  songKey,
} from "./ShuffleSelection";

function record(
  id: string,
  patch: Partial<FavoriteRecord> = {},
): FavoriteRecord {
  return {
    id: `netease:song:${id}`,
    platform: "netease",
    type: "song",
    title: id,
    coverImg: "",
    author: "歌手",
    websiteUrl: "",
    createdAt: 1,
    updatedAt: 1,
    platformData: { title: id, coverImg: "", author: "歌手", websiteUrl: "" },
    ...patch,
  };
}

const playlist = (id: string, trackCount?: string) =>
  record(id, { id: `netease:playlist:${id}`, type: "playlist", trackCount });

// 固定随机数：r ∈ [0,1) 映射到累计份数上的位置。
const at = (value: number) => () => value;

afterEach(() => {
  localStorage.clear();
  delete (window as { uid?: string }).uid;
});

describe("随机选择的存取", () => {
  it("没有记录时返回 null（全部收藏、按条目）", () => {
    expect(loadShuffleSelection("netease")).toBeNull();
    const { weight, entries } = resolveShuffleSelection(null, [
      record("A"),
      playlist("P", "100"),
    ]);
    expect(weight).toBe("entry");
    expect(entries.map((entry) => entry.record.title)).toEqual(["A", "P"]);
    expect(entries.every((entry) => entry.tracks === null)).toBe(true);
  });

  it("保存后按平台读回，平台之间互不影响", () => {
    saveShuffleSelection("netease", {
      weight: "song",
      items: [
        { id: "netease:song:A" },
        { id: "netease:playlist:P", tracks: ["1", "2"] },
      ],
    });
    expect(loadShuffleSelection("netease")).toEqual({
      weight: "song",
      items: [
        { id: "netease:song:A" },
        { id: "netease:playlist:P", tracks: ["1", "2"] },
      ],
    });
    expect(loadShuffleSelection("bilibili")).toBeNull();
  });

  it("按账号隔离：换账号读不到上一个账号的选择", () => {
    (window as { uid?: string }).uid = "aaaaaaaa";
    saveShuffleSelection("netease", { weight: "song", items: [] });
    (window as { uid?: string }).uid = "bbbbbbbb";
    expect(loadShuffleSelection("netease")).toBeNull();
    (window as { uid?: string }).uid = "aaaaaaaa";
    expect(loadShuffleSelection("netease")?.weight).toBe("song");
  });

  it("损坏或版本不符按无记录处理，不抛错", () => {
    const key = "imwShuffleSelection:unknown:netease";
    for (const raw of [
      "{oops",
      JSON.stringify({ version: 2, weight: "entry", items: [] }),
      JSON.stringify({ version: 1, weight: "heavy", items: [] }),
      JSON.stringify({ version: 1, weight: "entry", items: [{ id: 3 }] }),
      JSON.stringify({
        version: 1,
        weight: "entry",
        items: [{ id: "x", tracks: [1] }],
      }),
    ]) {
      localStorage.setItem(key, raw);
      expect(loadShuffleSelection("netease")).toBeNull();
    }
  });
});

describe("选择与当前收藏对齐", () => {
  it("已删除的收藏与空的部分勾选被剔除；单曲带 tracks 仍按整条", () => {
    const { entries } = resolveShuffleSelection(
      {
        weight: "entry",
        items: [
          { id: "netease:song:gone" },
          { id: "netease:song:A", tracks: ["9"] },
          { id: "netease:playlist:P", tracks: [] },
          { id: "netease:playlist:Q", tracks: ["1", "2", "3"] },
        ],
      },
      [record("A"), playlist("P", "10"), playlist("Q", "50")],
    );
    expect(
      entries.map((entry) => [entry.record.title, entry.tracks, entry.size]),
    ).toEqual([
      ["A", null, 1],
      ["Q", ["1", "2", "3"], 3],
    ]);
  });

  it("整单份数取 trackCount，缺失或非法按 1", () => {
    const { entries } = resolveShuffleSelection(null, [
      playlist("P", "100"),
      playlist("Q"),
      playlist("R", "abc"),
    ]);
    expect(entries.map((entry) => entry.size)).toEqual([100, 1, 1]);
  });
});

describe("加权抽取", () => {
  const entries = resolveShuffleSelection(null, [
    record("A"),
    playlist("P", "100"),
  ]).entries;

  it("按条目：单曲与整个歌单各一份", () => {
    const round = createShuffleRound();
    expect(
      pickShuffleEntry(entries, "entry", round, undefined, at(0.49))?.record
        .title,
    ).toBe("A");
    expect(
      pickShuffleEntry(entries, "entry", round, undefined, at(0.51))?.record
        .title,
    ).toBe("P");
  });

  it("按歌曲：整单 100 首占 100/101", () => {
    const round = createShuffleRound();
    expect(
      pickShuffleEntry(entries, "song", round, undefined, at(0.009))?.record
        .title,
    ).toBe("A");
    expect(
      pickShuffleEntry(entries, "song", round, undefined, at(0.01))?.record
        .title,
    ).toBe("P");
    expect(
      pickShuffleEntry(entries, "song", round, undefined, at(0.99))?.record
        .title,
    ).toBe("P");
  });

  it("按歌曲：已从整单播过的曲数从份数里扣除", () => {
    const round = createShuffleRound();
    round.fromEntry.set("netease:playlist:P", 90);
    expect(remainingShare(entries[1], "song", round)).toBe(10);
    round.fromEntry.set("netease:playlist:P", 100);
    expect(remainingShare(entries[1], "song", round)).toBe(0);
    expect(remainingShare(entries[1], "entry", round)).toBe(0);
  });

  it("部分勾选按歌去重：三首各播一次后本轮耗尽", () => {
    const [partial] = resolveShuffleSelection(
      {
        weight: "song",
        items: [{ id: "netease:playlist:P", tracks: ["1", "2", "3"] }],
      },
      [playlist("P", "100")],
    ).entries;
    const round = createShuffleRound();
    expect(remainingShare(partial, "song", round)).toBe(3);
    round.played.add(songKey("netease", "1"));
    round.played.add(songKey("netease", "2"));
    expect(remainingShare(partial, "song", round)).toBe(1);
    expect(remainingShare(partial, "entry", round)).toBe(1);
    round.played.add(songKey("netease", "3"));
    expect(remainingShare(partial, "entry", round)).toBe(0);
    expect(pickShuffleEntry([partial], "song", round)).toBeNull();
  });

  it("跨条目同曲：歌单里播过的歌，单曲收藏本轮不再抽", () => {
    const single = resolveShuffleSelection(null, [record("9")]).entries[0];
    const round = createShuffleRound();
    // 歌单里抽中的曲目身份与单曲收藏主键同格式。
    round.played.add(songKey("netease", "9"));
    expect(single.record.id).toBe(songKey("netease", "9"));
    expect(remainingShare(single, "entry", round)).toBe(0);
  });

  it("本轮耗尽与 skip 的条目不参与抽取", () => {
    const round = createShuffleRound();
    round.exhausted.add("netease:playlist:P");
    expect(
      pickShuffleEntry(entries, "song", round, undefined, at(0.99))?.record
        .title,
    ).toBe("A");
    expect(
      pickShuffleEntry(
        entries,
        "song",
        round,
        (entry) => entry.record.title === "A",
      ),
    ).toBeNull();
  });
});

describe("随机平台的存取", () => {
  it("defaultPage 规则：0 → 网易云，1 → B站，其他 → 网易云", () => {
    expect(defaultShufflePlatform(0)).toBe("netease");
    expect(defaultShufflePlatform(1)).toBe("bilibili");
    expect(defaultShufflePlatform(2)).toBe("netease");
    expect(defaultShufflePlatform(undefined)).toBe("netease");
  });

  it("没有记录按 defaultPage；保存后以记录为准", () => {
    expect(loadShufflePlatform()).toBeNull();
    expect(resolveShufflePlatform(1)).toBe("bilibili");
    saveShufflePlatform("netease");
    expect(loadShufflePlatform()).toBe("netease");
    expect(resolveShufflePlatform(1)).toBe("netease");
  });

  it("按账号隔离", () => {
    (window as { uid?: string }).uid = "aaaaaaaa";
    saveShufflePlatform("bilibili");
    (window as { uid?: string }).uid = "bbbbbbbb";
    expect(loadShufflePlatform()).toBeNull();
    (window as { uid?: string }).uid = "aaaaaaaa";
    expect(loadShufflePlatform()).toBe("bilibili");
  });

  it("记录非法按无记录处理，不抛错", () => {
    saveShufflePlatform("bilibili");
    const key = Object.keys(localStorage).find((name) =>
      name.startsWith("imwShufflePlatform:"),
    )!;
    localStorage.setItem(key, "radio");
    expect(loadShufflePlatform()).toBeNull();
    expect(resolveShufflePlatform(0)).toBe("netease");
  });
});

describe("选择面板的可见平台与初始标签", () => {
  const both = { netease: true, bilibili: true };

  it("只显示有收藏的平台，按固定顺序", () => {
    expect(
      resolvePickerPlatforms(
        { netease: false, bilibili: true },
        { stored: null, fallback: "netease" },
      ),
    ).toEqual({ platforms: ["bilibili"], initial: "bilibili" });
    expect(
      resolvePickerPlatforms(both, { stored: null, fallback: "bilibili" }),
    ).toEqual({ platforms: ["netease", "bilibili"], initial: "bilibili" });
  });

  it("已存平台收藏删光仍显示，并作为初始标签", () => {
    expect(
      resolvePickerPlatforms(
        { netease: true, bilibili: false },
        { stored: "bilibili", fallback: "netease" },
      ),
    ).toEqual({ platforms: ["netease", "bilibili"], initial: "bilibili" });
  });

  it("无记录且默认平台无收藏：停在可见集第一个", () => {
    expect(
      resolvePickerPlatforms(
        { netease: true, bilibili: false },
        { stored: null, fallback: "bilibili" },
      ),
    ).toEqual({ platforms: ["netease"], initial: "netease" });
  });

  it("全无收藏且无记录：只剩默认平台", () => {
    expect(
      resolvePickerPlatforms({}, { stored: null, fallback: "bilibili" }),
    ).toEqual({ platforms: ["bilibili"], initial: "bilibili" });
  });

  it("指定平台必定可见且为初始标签", () => {
    expect(
      resolvePickerPlatforms(
        { netease: true },
        { stored: "netease", fallback: "netease", forced: "bilibili" },
      ),
    ).toEqual({ platforms: ["netease", "bilibili"], initial: "bilibili" });
  });
});
