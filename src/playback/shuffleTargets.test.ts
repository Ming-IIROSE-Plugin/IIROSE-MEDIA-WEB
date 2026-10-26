import { afterEach, describe, expect, it, vi } from "vitest";
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import { NeteaseMusicAPI } from "../Api/NeteaseAPI/NeteaseMusic";
import { prepareShuffleTarget } from "./shuffleTargets";
import { songKey } from "./ShuffleSelection";

vi.mock("../Api/NeteaseAPI/NeteaseMusic", () => ({
  NeteaseMusicAPI: {
    getAlbumDetail: vi.fn(),
    getSongListDetail: vi.fn(),
    getNeteaseSongDetail: vi.fn(),
  },
}));
vi.mock("../platforms/NetEasePlatform", () => ({
  NetEasePlatform: { MOD: vi.fn() },
}));
vi.mock("../platforms/BilibiliPlatform", () => ({
  BilibiliPlatform: { VOD: vi.fn() },
}));
vi.mock("../storage/FavoritesStorageService", () => ({
  FavoritesStorageService: {
    query: vi.fn(),
    restorePlatformData: vi.fn(() => ({})),
  },
}));

const api = NeteaseMusicAPI as unknown as Record<
  "getAlbumDetail" | "getSongListDetail" | "getNeteaseSongDetail",
  ReturnType<typeof vi.fn>
>;

function collection(type: "album" | "playlist"): FavoriteRecord {
  return {
    id: `netease:${type}:7`,
    platform: "netease",
    type,
    title: "合集",
    coverImg: "",
    author: "某人",
    websiteUrl: "",
    createdAt: 1,
    updatedAt: 1,
    platformData: {
      title: "合集",
      coverImg: "",
      author: "某人",
      websiteUrl: "",
      neteaseMusic: { id: 7, fee: 0 },
    },
  } as FavoriteRecord;
}

const options = (
  patch: Partial<Parameters<typeof prepareShuffleTarget>[1]> = {},
) => ({
  tracks: null,
  exclude: new Set<string>(),
  currentTitle: "",
  ...patch,
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("随机目标解析", () => {
  it("部分勾选只在勾选曲目里挑，并跳过本轮已播", async () => {
    api.getSongListDetail.mockResolvedValue({
      playlist: { trackIds: [1, 2, 3, 4].map((id) => ({ id })) },
    });
    api.getNeteaseSongDetail.mockImplementation(async ([id]: number[]) => [
      { name: `曲${id}`, album: {}, artists: [] },
    ]);
    const picked = new Set<string>();
    for (let index = 0; index < 20; index++) {
      const target = await prepareShuffleTarget(
        collection("playlist"),
        options({
          tracks: ["2", "3"],
          exclude: new Set([songKey("netease", "2")]),
        }),
      );
      if (target && target !== "exhausted") picked.add(target.key);
    }
    expect([...picked]).toEqual([songKey("netease", "3")]);
  });

  it("范围内曲目都已播或已不在歌单里：返回耗尽而不是失败", async () => {
    api.getSongListDetail.mockResolvedValue({
      playlist: { trackIds: [{ id: 1 }] },
    });
    await expect(
      prepareShuffleTarget(collection("playlist"), options({ tracks: ["99"] })),
    ).resolves.toBe("exhausted");
    await expect(
      prepareShuffleTarget(
        collection("playlist"),
        options({ exclude: new Set([songKey("netease", "1")]) }),
      ),
    ).resolves.toBe("exhausted");
  });

  it("专辑按标题跳过当前曲目，目标带歌曲身份", async () => {
    api.getAlbumDetail.mockResolvedValue({
      songs: [
        { id: 1, name: "正在放", al: {}, ar: [] },
        { id: 2, name: "下一首", al: {}, ar: [] },
      ],
    });
    const target = await prepareShuffleTarget(
      collection("album"),
      options({ currentTitle: "正在放" }),
    );
    expect(target).toMatchObject({
      key: songKey("netease", "2"),
      title: "下一首",
    });
  });

  it("详情为空仍按解析失败返回 null", async () => {
    api.getAlbumDetail.mockResolvedValue({ songs: [] });
    await expect(
      prepareShuffleTarget(collection("album"), options()),
    ).resolves.toBeNull();
  });

  it("单曲/视频目标的 key 即收藏主键（与歌单曲目身份同格式）", async () => {
    const song = {
      ...collection("album"),
      id: "netease:song:5",
      type: "song",
    } as FavoriteRecord;
    const video = {
      ...collection("album"),
      id: "bilibili:video:BV1xx",
      platform: "bilibili",
      type: "video",
    } as FavoriteRecord;
    await expect(prepareShuffleTarget(song, options())).resolves.toMatchObject({
      key: songKey("netease", "5"),
    });
    await expect(prepareShuffleTarget(video, options())).resolves.toMatchObject(
      {
        key: songKey("bilibili", "BV1xx"),
      },
    );
  });

  it("专辑部分勾选只在勾选曲目里挑", async () => {
    api.getAlbumDetail.mockResolvedValue({
      songs: [1, 2, 3].map((id) => ({ id, name: `曲${id}`, al: {}, ar: [] })),
    });
    for (let index = 0; index < 10; index++)
      await expect(
        prepareShuffleTarget(collection("album"), options({ tracks: ["2"] })),
      ).resolves.toMatchObject({ key: songKey("netease", "2") });
  });
});
