import { beforeEach, describe, expect, it, vi } from "vitest";

// 平台层的整单点播（`playCollectionAll`）：内页头「全部播放」与宿站弹窗的
// select 0/1 共用它，所以「正序保序 / 乱序是同一集合的置换 / 不碰 buildSelect2」
// 必须有断言——否则两个入口一起错也不会红。
const neteaseMusic = vi.hoisted(() => ({
  getNeteaseSongDetail: vi.fn(),
  getSongListDetail: vi.fn(),
  getAlbumDetail: vi.fn(),
}));
const announce = vi.hoisted(() => ({
  runBatchAnnounce: vi.fn(),
  runSingleAnnounce: vi.fn(),
  showBatchItemError: vi.fn(),
}));
const episodePicker = vi.hoisted(() => ({ openEpisodePicker: vi.fn() }));

vi.mock("../Api/NeteaseAPI/NeteaseMusic", () => ({
  NeteaseMusicAPI: neteaseMusic,
}));
vi.mock("../iirose_func/Socket/Announce", () => ({ Announce: announce }));
vi.mock(
  "../page/components/episode-picker/openEpisodePicker",
  () => episodePicker,
);

import { IIROSEUtils } from "../iirose_func/IIROSEUtils";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { NetEasePlatform } from "./NetEasePlatform";
import type { EpisodePickEntry } from "../page/components/episode-picker/EpisodePicker";

const songList = {
  title: "冬日歌单",
  author: "某某",
  coverImg: "",
  websiteUrl: "https://music.163.com/#/playlist?id=7",
  trackCount: "3",
  neteaseMusic: { id: 7, fee: 0, isSongList: true },
} as unknown as PlatformData;

const album = {
  title: "华丽的冒险",
  author: "陈绮贞",
  coverImg: "",
  websiteUrl: "https://music.163.com/#/album?id=9",
  trackCount: "3",
  neteaseMusic: { id: 9, fee: 0, isAlbum: true },
} as unknown as PlatformData;

const plainSong = {
  title: "旅行的意义",
  author: "陈绮贞",
  coverImg: "",
  websiteUrl: "",
  neteaseMusic: { id: 11, fee: 0 },
} as unknown as PlatformData;

/** 被 `runBatchAnnounce` 收下的那个执行器真正发给宿站的曲目 id 序列。 */
const playedIds = async () => {
  const loop = announce.runBatchAnnounce.mock.lastCall?.[2] as
    (() => Promise<void> | void) | undefined;
  await loop?.();
  return vi.mocked(finalODSONG).mock.lastCall?.[0] as number[];
};

let finalODSONG: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  finalODSONG = vi
    .spyOn(
      NetEasePlatform as unknown as Record<string, () => Promise<void>>,
      "finalODSONG",
    )
    .mockResolvedValue(undefined);
  neteaseMusic.getSongListDetail.mockResolvedValue({
    playlist: {
      name: "冬日歌单",
      description: "冬天听",
      trackIds: [{ id: 1 }, { id: 2 }, { id: 3 }],
    },
  });
  neteaseMusic.getAlbumDetail.mockResolvedValue({
    album: { name: "华丽的冒险", description: "" },
    songs: [{ id: 4 }, { id: 5 }, { id: 6 }],
  });
});

describe("playCollectionAll（整张点播）", () => {
  it("歌单正序：按接口原序批量点播，标题 / 数量 / 简介交给批量播报", async () => {
    await NetEasePlatform.playCollectionAll(songList, "asc");

    expect(announce.runBatchAnnounce).toHaveBeenCalledWith(
      "冬日歌单",
      3,
      expect.any(Function),
      "冬天听",
    );
    expect(await playedIds()).toEqual([1, 2, 3]);
  });

  it("歌单乱序：同一集合的置换，数量不变", async () => {
    await NetEasePlatform.playCollectionAll(songList, "shuffle");

    expect(announce.runBatchAnnounce).toHaveBeenCalledWith(
      "冬日歌单",
      3,
      expect.any(Function),
      "冬天听",
    );
    const ids = await playedIds();
    expect(ids).toHaveLength(3);
    expect([...ids].sort()).toEqual([1, 2, 3]);
  });

  it("专辑走专辑端点：正序保序，乱序为置换", async () => {
    await NetEasePlatform.playCollectionAll(album, "asc");
    expect(neteaseMusic.getAlbumDetail).toHaveBeenCalledWith(9);
    expect(await playedIds()).toEqual([4, 5, 6]);

    await NetEasePlatform.playCollectionAll(album, "shuffle");
    const ids = await playedIds();
    expect([...ids].sort()).toEqual([4, 5, 6]);
  });

  it("详情拿不到时静默结束，不批量播报", async () => {
    neteaseMusic.getAlbumDetail.mockResolvedValue(null);
    await NetEasePlatform.playCollectionAll(album, "asc");
    expect(announce.runBatchAnnounce).not.toHaveBeenCalled();
  });

  it("非专辑 / 歌单条目提示一次，不批量播报", async () => {
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    await NetEasePlatform.playCollectionAll(plainSong, "asc");
    expect(show).toHaveBeenCalledWith("这不是专辑或歌单");
    expect(announce.runBatchAnnounce).not.toHaveBeenCalled();
  });

  it("整条路径不经过宿站 buildSelect2", async () => {
    const buildSelect2 = vi.spyOn(IIROSEUtils, "buildSelect2");
    await NetEasePlatform.playCollectionAll(songList, "asc");
    await NetEasePlatform.playCollectionAll(album, "shuffle");
    expect(buildSelect2).not.toHaveBeenCalled();
    expect(finalODSONG).toBeDefined();
  });
});

// —— 选集（story 5）：MLOD / AOD 的 select===2 委托插件自有面板 ——
// 一级菜单（正序 / 乱序 / 选集）保留：收藏里「整张点播」只靠它；选集本身不再走宿站
// 多选弹窗与二次排序确认（没有 `buildOrderConfirmSelect`、没有跨弹窗 300ms 延迟）。
describe("选集委托", () => {
  const lastOptions = () =>
    episodePicker.openEpisodePicker.mock.lastCall?.[0] as {
      unit: string;
      load: () => Promise<EpisodePickEntry[]>;
      onConfirm: (entries: EpisodePickEntry[]) => void;
    };

  /** 触发一级菜单的某一项，返回被替换掉的宿站调用（用于断言单选）。 */
  const choose = async (run: () => void, select: number) => {
    const build = vi
      .spyOn(IIROSEUtils, "buildSelect2")
      .mockImplementation(() => {});
    run();
    const cb = build.mock.lastCall?.[2] as (
      target: HTMLElement,
      value: string,
    ) => Promise<void>;
    await cb(null as unknown as HTMLElement, String(select));
    return build;
  };

  beforeEach(() => {
    episodePicker.openEpisodePicker.mockClear();
    // 单曲播报入口在实现里接 `.catch`：替身要还回一个 promise
    announce.runSingleAnnounce.mockResolvedValue(undefined);
  });

  it("MLOD 选集：开面板（单位「首」），条目取歌单曲目", async () => {
    await choose(() => NetEasePlatform.MLOD(songList), 2);

    expect(episodePicker.openEpisodePicker).toHaveBeenCalledOnce();
    expect(lastOptions().unit).toBe("首");
    const entries = await lastOptions().load();
    // 行 id 带位置（`位置:曲目id`）：同一首歌在歌单里重复出现时行仍唯一
    expect(entries.map((entry) => entry.id)).toEqual(["0:1", "1:2", "2:3"]);
    expect(neteaseMusic.getSongListDetail).toHaveBeenCalledWith(7);
  });

  it("歌单详情带 tracks 时用曲名与歌手", async () => {
    neteaseMusic.getSongListDetail.mockResolvedValue({
      playlist: {
        name: "冬日歌单",
        description: "冬天听",
        trackIds: [{ id: 1 }, { id: 2 }],
        tracks: [
          { id: 1, name: "晴天", ar: [{ name: "周杰伦" }], dt: 269000 },
          { id: 2, name: "鱼", ar: [{ name: "陈绮贞" }], dt: 240000 },
        ],
      },
    });
    await choose(() => NetEasePlatform.MLOD(songList), 2);

    expect(await lastOptions().load()).toEqual([
      { id: "0:1", title: "晴天", meta: "周杰伦", duration: 269 },
      { id: "1:2", title: "鱼", meta: "陈绮贞", duration: 240 },
    ]);
  });

  it("歌单里重复出现的同一首歌：两行可分别点选，序号 1/2，确认按点选顺序给两条", async () => {
    neteaseMusic.getSongListDetail.mockResolvedValue({
      playlist: {
        name: "冬日歌单",
        description: "冬天听",
        trackIds: [{ id: 5 }, { id: 5 }],
        tracks: [
          { id: 5, name: "晴天", ar: [{ name: "周杰伦" }], dt: 269000 },
          { id: 5, name: "晴天", ar: [{ name: "周杰伦" }], dt: 269000 },
        ],
      },
    });
    await choose(() => NetEasePlatform.MLOD(songList), 2);
    const entries = await lastOptions().load();
    // 行 id 唯一，不会一次点选勾中两行
    expect(entries.map((entry) => entry.id)).toEqual(["0:5", "1:5"]);

    // 点选顺序：第二行 → 第一行
    lastOptions().onConfirm([entries[1], entries[0]]);
    expect(announce.runBatchAnnounce).toHaveBeenCalledWith(
      "冬日歌单",
      2,
      expect.any(Function),
      "冬天听",
    );
    // 同一首歌两条都播，顺序与点选一致
    expect(await playedIds()).toEqual([5, 5]);
  });

  it("确认顺序 = 点选顺序：批量播报按该顺序交给 finalODSONG", async () => {
    await choose(() => NetEasePlatform.MLOD(songList), 2);
    const entries = await lastOptions().load();
    lastOptions().onConfirm([entries[2], entries[0]]);

    expect(announce.runBatchAnnounce).toHaveBeenCalledWith(
      "冬日歌单",
      2,
      expect.any(Function),
      "冬天听",
    );
    expect(await playedIds()).toEqual([3, 1]);
  });

  it("只选 1 首：单曲播报窗口", async () => {
    await choose(() => NetEasePlatform.MLOD(songList), 2);
    const entries = await lastOptions().load();
    lastOptions().onConfirm([entries[1]]);

    expect(announce.runSingleAnnounce).toHaveBeenCalledOnce();
    expect(announce.runBatchAnnounce).not.toHaveBeenCalled();
    const loop = announce.runSingleAnnounce.mock.lastCall?.[0] as () => void;
    await loop();
    expect(vi.mocked(finalODSONG).mock.lastCall?.[0]).toEqual([2]);
  });

  it("AOD 选集：走专辑端点，确认顺序保序", async () => {
    await choose(() => NetEasePlatform.AOD(album), 2);
    const entries = await lastOptions().load();
    expect(neteaseMusic.getAlbumDetail).toHaveBeenCalledWith(9);
    expect(entries.map((entry) => entry.id)).toEqual(["0:4", "1:5", "2:6"]);

    lastOptions().onConfirm([entries[2], entries[0]]);
    expect(announce.runBatchAnnounce).toHaveBeenCalledWith(
      "华丽的冒险",
      2,
      expect.any(Function),
      "",
    );
    expect(await playedIds()).toEqual([6, 4]);
  });

  it("详情拿不到：`load` 抛错（面板显示「加载失败」+「重试」）", async () => {
    neteaseMusic.getAlbumDetail.mockResolvedValue(null);
    await choose(() => NetEasePlatform.AOD(album), 2);
    await expect(lastOptions().load()).rejects.toThrow("获取专辑失败");
  });

  it("一级菜单仍是单选（不让宿站承担任何选集职责）", async () => {
    const build = await choose(() => NetEasePlatform.MLOD(songList), 2);
    // 第 7 个参数（multiSelect）恒为 false
    expect(build.mock.lastCall?.[6]).toBe(false);
    expect(announce.runBatchAnnounce).not.toHaveBeenCalled();
  });
});

describe("选集面板的歌单曲目", () => {
  it("tracks 只给前几首时按 trackIds 补齐，顺序与数量跟歌单一致", async () => {
    neteaseMusic.getNeteaseSongDetail.mockResolvedValue([
      { id: 3, name: "三", artists: [{ name: "甲" }], duration: 180_000 },
    ]);
    const tracks = await NetEasePlatform.fullPlaylistTracks({
      tracks: [{ id: 1, name: "一" }],
      trackIds: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    expect(neteaseMusic.getNeteaseSongDetail).toHaveBeenCalledWith([2, 3]);
    expect(tracks).toEqual([
      { id: 1, name: "一" },
      // 补取不到的仍按 id 列出（面板显示「曲目 N」，照样可选）
      { id: 2 },
      { id: 3, name: "三", ar: [{ name: "甲" }], duration: 180_000 },
    ]);
  });

  it("tracks 已完整时不再请求", async () => {
    neteaseMusic.getNeteaseSongDetail.mockClear();
    const tracks = await NetEasePlatform.fullPlaylistTracks({
      tracks: [{ id: 1 }, { id: 2 }],
      trackIds: [{ id: 1 }, { id: 2 }],
    });
    expect(tracks).toHaveLength(2);
    expect(neteaseMusic.getNeteaseSongDetail).not.toHaveBeenCalled();
  });
});

describe("一级菜单选正序 / 乱序后显示点播中", () => {
  it("选完顺序：这一行进入点播中，第一首发出后恢复", async () => {
    const { getRequestStatus, requestKey, noteMediaSent, resetRequestGuard } =
      await import("../playback/RequestGuard");
    resetRequestGuard();
    const playlist = {
      title: "千首歌单",
      neteaseMusic: { id: 77, isSongList: true },
    } as PlatformData;
    let finish!: () => void;
    const playAll = vi
      .spyOn(NetEasePlatform, "playCollectionAll")
      .mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
    const build = vi
      .spyOn(IIROSEUtils, "buildSelect2")
      .mockImplementation(() => {});
    NetEasePlatform.MLOD(playlist);
    const cb = build.mock.lastCall?.[2] as (
      target: HTMLElement,
      value: string,
    ) => Promise<void>;
    const done = cb(null as unknown as HTMLElement, "0");
    await Promise.resolve();
    expect(playAll).toHaveBeenCalledWith(playlist, "asc");
    expect(getRequestStatus(requestKey(playlist))).toBe("pending");
    noteMediaSent("&1{}");
    finish();
    await done;
    // 菜单回调的包装不返回内部 Promise：等守卫自己落地
    await vi.waitFor(() =>
      expect(getRequestStatus(requestKey(playlist))).toBe("idle"),
    );
    playAll.mockRestore();
    build.mockRestore();
  });
});

describe("批量发送：进度与停止", () => {
  it("逐首上报进度；中途停止后不再处理后面的曲目", async () => {
    // 文件级 beforeEach 把 finalODSONG 换成了替身：这里要跑真实的发送循环
    finalODSONG.mockRestore();
    const { startBatch, stopBatch, getBatches, resetBatches } =
      await import("../playback/BatchProgress");
    resetBatches();
    const songs = [1, 2, 3].map((id) => ({
      id,
      name: `曲${id}`,
      fee: 0,
      duration: 1000,
      artists: [{ name: "甲" }],
      album: { picUrl: "" },
    }));
    neteaseMusic.getNeteaseSongDetail.mockResolvedValue(songs);
    const batch = startBatch("测试歌单", 3);
    let lyricCalls = 0;
    (neteaseMusic as unknown as { getLyric: unknown }).getLyric = vi.fn(
      async () => {
        lyricCalls++;
        // 第一首取歌词时用户点了「停止」
        if (lyricCalls === 1) stopBatch(batch.id);
        return null;
      },
    );
    await (
      NetEasePlatform as unknown as {
        finalODSONG: (ids: number[], b: typeof batch) => Promise<void>;
      }
    ).finalODSONG([1, 2, 3], batch);
    expect(lyricCalls).toBe(1);
    expect(getBatches()[0]).toMatchObject({ status: "stopped", total: 3 });
  });
});

describe("整张点播：并发与失败", () => {
  const playlist = {
    title: "千首歌单",
    neteaseMusic: { id: 77, isSongList: true },
  } as PlatformData;

  it("第一轮还在进行时再点：只提示，不开第二轮", async () => {
    const { resetBatches, getBatches, startBatch } =
      await import("../playback/BatchProgress");
    resetBatches();
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    startBatch("千首歌单", 130); // 第一轮：准备中
    neteaseMusic.getSongListDetail.mockClear();
    await NetEasePlatform.playCollectionAll(playlist, "asc");
    expect(neteaseMusic.getSongListDetail).not.toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith("《千首歌单》正在点播中");
    expect(getBatches()).toHaveLength(1);
    show.mockRestore();
  });

  it("取不到曲目详情：进度卡显示失败，不是「已点播完」", async () => {
    const { resetBatches, getBatches } =
      await import("../playback/BatchProgress");
    resetBatches();
    finalODSONG.mockRestore();
    neteaseMusic.getSongListDetail.mockResolvedValue({
      code: 200,
      playlist: {
        name: "千首歌单",
        description: "",
        trackIds: [{ id: 1 }, { id: 2 }],
      },
    });
    neteaseMusic.getNeteaseSongDetail.mockResolvedValue(null);
    announce.runBatchAnnounce.mockImplementation(
      async (_t: string, _n: number, loop: () => Promise<void>) => {
        await loop();
      },
    );
    await NetEasePlatform.playCollectionAll(playlist, "asc");
    await vi.waitFor(() => expect(getBatches()[0]?.status).toBe("failed"));
  });
});
