import { beforeEach, describe, expect, it, vi } from "vitest";

// 平台层的整单点播（`playCollectionAll`）：内页头「全部播放」与宿站弹窗的
// select 0/1 共用它，所以「正序保序 / 乱序是同一集合的置换 / 不碰 buildSelect2」
// 必须有断言——否则两个入口一起错也不会红。
const neteaseMusic = vi.hoisted(() => ({
  getSongListDetail: vi.fn(),
  getAlbumDetail: vi.fn(),
}));
const announce = vi.hoisted(() => ({
  runBatchAnnounce: vi.fn(),
  runSingleAnnounce: vi.fn(),
  showBatchItemError: vi.fn(),
}));

vi.mock("../Api/NeteaseAPI/NeteaseMusic", () => ({
  NeteaseMusicAPI: neteaseMusic,
}));
vi.mock("../iirose_func/Socket/Announce", () => ({ Announce: announce }));

import { IIROSEUtils } from "../iirose_func/IIROSEUtils";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { NetEasePlatform } from "./NetEasePlatform";

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
