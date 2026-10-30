import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  query: vi.fn(),
  restorePlatformData: vi.fn(),
}));

vi.mock("../../storage/FavoritesStorageService", () => ({
  FavoritesStorageService: storage,
}));

import { FavoritesService } from "./FavoritesService";

type Record_ = {
  id: string;
  ownerUid?: string;
  platform: "netease" | "bilibili";
  type: "song" | "album" | "playlist" | "video";
  title: string;
  author: string;
  coverImg: string;
  websiteUrl: string;
  createdAt: number;
  updatedAt: number;
  platformData: PlatformData;
};

function favorite(id: string, type: Record_["type"], updatedAt = 1): Record_ {
  return {
    id,
    ownerUid: "owner",
    platform: id.startsWith("bilibili") ? "bilibili" : "netease",
    type,
    title: id,
    author: "作者",
    coverImg: "",
    websiteUrl: "",
    createdAt: 1,
    updatedAt,
    platformData: {
      title: id,
      author: "作者",
      coverImg: "",
      websiteUrl: "",
    },
  };
}

/** 最小现场：FavoritesService 只读关键词 / 页码 / 多页标记。 */
function makeCtx(initial: Partial<MainAppContainerState> = {}) {
  let state = {
    searchKeyword: "",
    currentPage: 1,
    requestToken: 0,
    isCurrentInMultiPage: false,
    ...initial,
  } as unknown as MainAppContainerState;
  return {
    ctx: {
      getState: () => state,
      setState: (patch: Partial<MainAppContainerState>) => {
        state = { ...state, ...patch };
      },
      pushAllData: () => {},
    } as unknown as MainAppContainerActionContext,
    state: () => state,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // 缓存是静态的：每个用例用新的主键，避免互相命中
  storage.restorePlatformData.mockImplementation((record: Record_) => ({
    ...record.platformData,
  }));
});

describe("收藏查询与还原", () => {
  it("逐字过滤重跑查询时复用已还原的条目，不重复还原（B 站分 P 探测不再出网）", async () => {
    const records = [
      favorite("netease:song:1", "song"),
      favorite("bilibili:video:BV1", "video"),
    ];
    storage.query.mockResolvedValue(records);

    const { ctx, state } = makeCtx();
    await FavoritesService.loadFavorites(ctx, "all", "all", 10);
    expect(storage.restorePlatformData).toHaveBeenCalledTimes(2);
    const firstPage = await state().mediaData!;

    // 换过滤词：查询仍在本地跑（关键词下推到存储层），但两个条目都已在缓存里
    ctx.setState({ searchKeyword: "BV1", currentPage: 1 });
    storage.query.mockResolvedValue([records[1]]);
    await FavoritesService.loadFavorites(ctx, "all", "all", 10);
    expect(storage.query).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: "BV1" }),
    );
    expect(storage.restorePlatformData).toHaveBeenCalledTimes(2);
    // 「改过滤词要重新查库」：列表范围跟着查询结果收窄，但条目本身是同一份
    expect(await state().mediaData).not.toBe(firstPage);
    expect((await state().mediaData!).platformData).toHaveLength(1);
    expect(storage.restorePlatformData.mock.results[1].value).toBe(
      (await state().mediaData!).platformData[0],
    );
  });

  it("记录变化（updatedAt 变了）后重新还原；「歌单与专辑」走 types 合并查询", async () => {
    const record = favorite("netease:album:9", "album");
    storage.query.mockResolvedValue([record]);

    const { ctx, state } = makeCtx();
    await FavoritesService.loadFavorites(ctx, "netease", "collection", 10);
    expect(storage.query).toHaveBeenLastCalledWith({
      platform: "netease",
      type: undefined,
      types: ["album", "playlist"],
      keyword: undefined,
    });
    expect(storage.restorePlatformData).toHaveBeenCalledTimes(1);

    // 同一条记录更新时间变了：视为新内容，重新还原
    storage.query.mockResolvedValue([{ ...record, updatedAt: 2 }]);
    await FavoritesService.loadFavorites(ctx, "netease", "collection", 10);
    expect(storage.restorePlatformData).toHaveBeenCalledTimes(2);
    expect((await state().mediaData!).platformData).toHaveLength(1);
  });
});
