import { describe, expect, it, vi } from "vitest";
import { NetEasePlatform } from "../../platforms/NetEasePlatform";
import { NetEaseService } from "./NetEaseService";

type Page = { platformData: PlatformData[]; totalPage: number };

/** 只带标题的条目：Service 只搬运数组，不读条目字段。 */
const row = (title: string) => ({ title }) as PlatformData;
const rows = (...titles: string[]) => titles.map(row);

/** 最小现场：与容器的 `pushAllData` 同语义（票号不符即丢弃）。 */
function makeCtx(initial: Partial<MainAppContainerState> = {}) {
  let state = {
    searchKeyword: "",
    currentPage: 1,
    totalPage: 0,
    updating: false,
    requestToken: 0,
    isCurrentInMultiPage: false,
    mediaData: null,
    allMediaData: [],
    currentOnDemandPlay: () => {},
    ...initial,
  } as unknown as MainAppContainerState;
  const ctx = {
    getState: () => state,
    setState: (patch: Partial<MainAppContainerState>) => {
      state = { ...state, ...patch };
    },
    pushAllData: (token: number, data: PlatformData[], total: number) => {
      if (state.requestToken !== token) return;
      state = {
        ...state,
        allMediaData: [...state.allMediaData, ...data],
        totalPage: total,
        updating: false,
      };
    },
  } as unknown as MainAppContainerActionContext;
  const page = async () => (await state.mediaData) as Page | null;
  return { ctx, state: () => state, page };
}

/** 四个搜索入口各自的平台取数函数与点播入口。 */
const entries = [
  {
    name: "音乐",
    call: (ctx: MainAppContainerActionContext, n: number) =>
      NetEaseService.searchMusic(ctx, n),
    search: () => vi.spyOn(NetEasePlatform, "searchForMusicsBasicsData"),
    onDemand: NetEasePlatform.MOD,
  },
  {
    name: "专辑",
    call: (ctx: MainAppContainerActionContext, n: number) =>
      NetEaseService.searchAlbum(ctx, n),
    search: () => vi.spyOn(NetEasePlatform, "searchForAlbumBasicsData"),
    onDemand: NetEasePlatform.AOD,
  },
  {
    name: "歌单",
    call: (ctx: MainAppContainerActionContext, n: number) =>
      NetEaseService.searchPlaylist(ctx, n),
    search: () => vi.spyOn(NetEasePlatform, "searchForMusicListBasicsData"),
    onDemand: NetEasePlatform.MLOD,
  },
  {
    name: "MV",
    call: (ctx: MainAppContainerActionContext, n: number) =>
      NetEaseService.searchMV(ctx, n),
    search: () => vi.spyOn(NetEasePlatform, "searchForMVBasicsData"),
    onDemand: NetEasePlatform.MVOD,
  },
];

describe.each(entries)("$name 搜索", ({ call, search, onDemand }) => {
  it("首屏：占新票号、置 updating，落地后追加条目并写总页数", async () => {
    const spy = search().mockResolvedValue({
      platformData: rows("甲", "乙"),
      allPlatformData: rows("甲", "乙"),
      totalPage: 2,
    });
    const { ctx, state, page } = makeCtx({ searchKeyword: "晴天" });

    call(ctx, 10);

    expect(state().updating).toBe(true);
    expect(state().requestToken).toBe(1);
    expect(state().mediaData).toBe(spy.mock.results[0].value);
    expect(state().currentOnDemandPlay).toBe(onDemand);
    expect(spy).toHaveBeenCalledWith("晴天", 1);

    await page();
    await Promise.resolve();

    expect(state().allMediaData.map((item) => item.title)).toEqual([
      "甲",
      "乙",
    ]);
    expect(state().totalPage).toBe(2);
    expect(state().updating).toBe(false);
  });

  it("空关键词：清掉结果与总页数，不出网", () => {
    const spy = search();
    const { ctx, state } = makeCtx({ searchKeyword: "" });

    call(ctx, 10);

    expect(spy).not.toHaveBeenCalled();
    expect(state().mediaData).toBeNull();
    expect(state().totalPage).toBe(0);
  });
});

describe("网易云分页编排", () => {
  it("翻页页码按每页 100 条换算，与调用方给的 itemsPerPage 无关", async () => {
    // 已加载 100 条（页面每页 10 条时本地有 10 页）：网易云侧只到第 1 页
    const search = vi
      .spyOn(NetEasePlatform, "searchForMusicsBasicsData")
      .mockResolvedValue({
        platformData: rows("丙"),
        allPlatformData: rows("丙"),
        totalPage: 4,
      });
    const { ctx, state } = makeCtx({
      searchKeyword: "晴天",
      currentPage: 11,
      allMediaData: rows(...Array.from({ length: 100 }, (_, i) => `${i}`)),
    });

    NetEaseService.searchMusic(ctx, 10);

    expect(search).toHaveBeenCalledWith("晴天", 2);
    await Promise.resolve();
    expect(state().allMediaData).toHaveLength(101);
    expect(state().totalPage).toBe(4);
  });

  it("命中本地缓存：只切已加载列表，不动票号与 updating，也不出网", async () => {
    const search = vi.spyOn(NetEasePlatform, "searchForMusicListBasicsData");
    const { ctx, state, page } = makeCtx({
      searchKeyword: "晴天",
      currentPage: 2,
      totalPage: 3,
      requestToken: 8,
      updating: true,
      allMediaData: rows(...Array.from({ length: 15 }, (_, i) => `第${i}首`)),
    });

    NetEaseService.searchPlaylist(ctx, 10);

    expect(search).not.toHaveBeenCalled();
    expect(state().requestToken).toBe(8);
    expect(state().updating).toBe(true);
    expect((await page())?.platformData.map((item) => item.title)).toEqual([
      "第10首",
      "第11首",
      "第12首",
      "第13首",
      "第14首",
    ]);
    expect((await page())?.totalPage).toBe(3);
  });

  it("缓存命中时的点播入口：外层按入口给，内页一律降为单曲点播", async () => {
    const { ctx, state, page } = makeCtx({
      searchKeyword: "晴天",
      currentPage: 1,
      allMediaData: rows("甲", "乙"),
    });

    NetEaseService.searchPlaylist(ctx, 10);
    expect(state().currentOnDemandPlay).toBe(NetEasePlatform.MLOD);
    await page();

    ctx.setState({ isCurrentInMultiPage: true });
    NetEaseService.searchPlaylist(ctx, 10);
    expect(state().currentOnDemandPlay).toBe(NetEasePlatform.MOD);
  });

  it("updating 期间再翻页：不发第二次请求，解除后恢复", async () => {
    const search = vi
      .spyOn(NetEasePlatform, "searchForMusicsBasicsData")
      .mockResolvedValue({
        platformData: rows("丙"),
        allPlatformData: rows("丙"),
        totalPage: 2,
      });
    const { ctx, state } = makeCtx({
      searchKeyword: "晴天",
      currentPage: 6,
      updating: true,
      allMediaData: rows(...Array.from({ length: 50 }, (_, i) => `${i}`)),
    });

    NetEaseService.searchMusic(ctx, 10);
    NetEaseService.searchMusic(ctx, 10);
    expect(search).not.toHaveBeenCalled();
    expect(state().mediaData).toBeNull();

    ctx.setState({ updating: false });
    NetEaseService.searchMusic(ctx, 10);
    expect(search).toHaveBeenCalledOnce();
  });

  it("取数返回空：解除 updating，已加载列表保持原样", async () => {
    vi.spyOn(NetEasePlatform, "searchForMusicsBasicsData").mockResolvedValue({
      platformData: [],
      allPlatformData: [],
      totalPage: 0,
    });
    const { ctx, state } = makeCtx({
      searchKeyword: "晴天",
      currentPage: 2,
      allMediaData: rows("甲"),
    });

    NetEaseService.searchMusic(ctx, 10);
    await state().mediaData;
    await Promise.resolve();

    expect(state().allMediaData.map((item) => item.title)).toEqual(["甲"]);
    expect(state().updating).toBe(false);
    expect(state().totalPage).toBe(0);
  });

  it("取数失败：解除 updating，列表不被清空", async () => {
    vi.spyOn(NetEasePlatform, "searchForAlbumBasicsData").mockRejectedValue(
      new Error("节点全部失败"),
    );
    const { ctx, state } = makeCtx({
      searchKeyword: "晴天",
      currentPage: 2,
      allMediaData: rows("甲", "乙"),
    });

    NetEaseService.searchAlbum(ctx, 10);
    await expect(state().mediaData!).rejects.toThrow("节点全部失败");
    await Promise.resolve();

    expect(state().allMediaData.map((item) => item.title)).toEqual([
      "甲",
      "乙",
    ]);
    expect(state().updating).toBe(false);
  });

  it("空关键词即使命中缓存也清空（空词判断在缓存分支之前）", async () => {
    const search = vi.spyOn(NetEasePlatform, "searchForMusicsBasicsData");
    const { ctx, state, page } = makeCtx({
      searchKeyword: "",
      currentPage: 1,
      allMediaData: rows("甲"),
    });

    NetEaseService.searchMusic(ctx, 10);

    expect(search).not.toHaveBeenCalled();
    expect(await page()).toBeNull();
    expect(state().totalPage).toBe(0);
  });
});
