import { describe, expect, it, vi } from "vitest";
import { BilibiliPlatform } from "../../platforms/BilibiliPlatform";
import { BilibiliService } from "./BilibiliService";

type Page = { platformData: PlatformData[]; totalPage: number };

type VideoResult = Page & { allPlatformData?: PlatformData[] };

/** 只带标题的条目：Service 只搬运数组，不读条目字段。 */
const row = (title: string) => ({ title }) as PlatformData;
const rows = (...titles: string[]) => titles.map(row);

/** 最小现场：与容器的 `pushAllData` 同语义（票号不符即丢弃）+ 刷新计数。 */
function makeCtx(initial: Partial<MainAppContainerState> = {}) {
  let state = {
    searchKeyword: "",
    currentPage: 1,
    totalPage: 0,
    updating: false,
    requestToken: 0,
    mediaData: null,
    allMediaData: [],
    currentOnDemandPlay: () => {},
    ...initial,
  } as unknown as MainAppContainerState;
  let refreshCount = 0;
  const incrementRefreshCount = vi.fn(() => {
    refreshCount += 1;
  });
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
    getRefreshCount: () => refreshCount,
    incrementRefreshCount,
  } as unknown as BilibiliActionContext;
  const page = async () => (await state.mediaData) as Page | null;
  return { ctx, state: () => state, page, incrementRefreshCount };
}

describe("首页推荐", () => {
  it("带上刷新计数取推荐并整体替换结果页，同时推进刷新计数", async () => {
    const data = Promise.resolve({ platformData: rows("甲"), totalPage: 1 });
    const recommend = vi
      .spyOn(BilibiliPlatform, "getRecommendVideosBasicsData")
      .mockReturnValue(data);
    const { ctx, state, incrementRefreshCount } = makeCtx({ requestToken: 4 });

    BilibiliService.snbclickRecommand(ctx);

    expect(recommend).toHaveBeenCalledWith(0);
    expect(state().mediaData).toBe(data);
    expect(state().currentOnDemandPlay).toBe(BilibiliPlatform.VOD);
    expect(state().currentPage).toBe(1);
    expect(state().totalPage).toBe(1);
    expect(state().requestToken).toBe(5);
    expect(incrementRefreshCount).toHaveBeenCalledOnce();

    // 再刷新一次：取数拿到的是自增后的计数
    BilibiliService.snbclickRecommand(ctx);
    expect(recommend).toHaveBeenLastCalledWith(1);
    expect(state().requestToken).toBe(6);
  });
});

describe("视频搜索", () => {
  it("空关键词：清掉结果与总页数，不出网", () => {
    const search = vi.spyOn(BilibiliPlatform, "searchForVideosBasicsData");
    const { ctx, state } = makeCtx({ searchKeyword: "" });

    BilibiliService.snbclickSearchVideo(ctx, 10);

    expect(search).not.toHaveBeenCalled();
    expect(state().mediaData).toBeNull();
    expect(state().totalPage).toBe(0);
  });

  it("首屏：占新票号、置 updating，落地后追加条目并写总页数", async () => {
    const search = vi
      .spyOn(BilibiliPlatform, "searchForVideosBasicsData")
      .mockResolvedValue({
        platformData: rows("甲", "乙"),
        allPlatformData: rows("甲", "乙"),
        totalPage: 5,
      } satisfies VideoResult);
    const { ctx, state, page } = makeCtx({ searchKeyword: "东方" });

    BilibiliService.snbclickSearchVideo(ctx, 10);

    expect(state().updating).toBe(true);
    expect(state().requestToken).toBe(1);
    expect(state().mediaData).toBe(search.mock.results[0].value);
    expect(state().currentOnDemandPlay).toBe(BilibiliPlatform.VOD);
    expect(search).toHaveBeenCalledWith("东方", 1);

    await page();
    await Promise.resolve();

    expect(state().allMediaData.map((item) => item.title)).toEqual([
      "甲",
      "乙",
    ]);
    expect(state().totalPage).toBe(5);
    expect(state().updating).toBe(false);
  });

  it("翻页：B 站接口按每页 50 条换算页码，与调用方给的 itemsPerPage 无关", async () => {
    // 已加载 60 条：B 站侧是第 2 页；每页 10 条时本地已有 6 页
    const search = vi
      .spyOn(BilibiliPlatform, "searchForVideosBasicsData")
      .mockResolvedValue({
        platformData: rows("丙"),
        allPlatformData: rows("丙"),
        totalPage: 7,
      });
    const { ctx, state } = makeCtx({
      searchKeyword: "东方",
      currentPage: 7,
      allMediaData: rows(...Array.from({ length: 60 }, (_, i) => `${i}`)),
    });

    BilibiliService.snbclickSearchVideo(ctx, 10);

    expect(search).toHaveBeenCalledWith("东方", 2);
    await Promise.resolve();
    expect(state().allMediaData).toHaveLength(61);
    expect(state().totalPage).toBe(7);
  });

  it("命中本地缓存：只切已加载列表，不动票号与 updating，也不出网", async () => {
    const search = vi.spyOn(BilibiliPlatform, "searchForVideosBasicsData");
    const { ctx, state, page } = makeCtx({
      searchKeyword: "东方",
      currentPage: 2,
      totalPage: 3,
      requestToken: 9,
      updating: true,
      allMediaData: rows(...Array.from({ length: 12 }, (_, i) => `第${i}集`)),
    });

    BilibiliService.snbclickSearchVideo(ctx, 10);

    expect(search).not.toHaveBeenCalled();
    expect(state().requestToken).toBe(9);
    expect(state().updating).toBe(true);
    expect((await page())?.platformData.map((item) => item.title)).toEqual([
      "第10集",
      "第11集",
    ]);
  });

  it("updating 期间再翻页：不发第二次请求，解除后恢复", async () => {
    const search = vi
      .spyOn(BilibiliPlatform, "searchForVideosBasicsData")
      .mockResolvedValue({
        platformData: rows("丙"),
        allPlatformData: rows("丙"),
        totalPage: 2,
      });
    const { ctx, state } = makeCtx({
      searchKeyword: "东方",
      currentPage: 2,
      updating: true,
      allMediaData: rows("甲"),
    });

    BilibiliService.snbclickSearchVideo(ctx, 10);
    BilibiliService.snbclickSearchVideo(ctx, 10);
    expect(search).not.toHaveBeenCalled();
    expect(state().mediaData).toBeNull();

    ctx.setState({ updating: false });
    BilibiliService.snbclickSearchVideo(ctx, 10);
    expect(search).toHaveBeenCalledOnce();
  });

  it("取数返回空：解除 updating，已加载列表保持原样", async () => {
    vi.spyOn(BilibiliPlatform, "searchForVideosBasicsData").mockResolvedValue({
      platformData: [],
      totalPage: 0,
    });
    const { ctx, state } = makeCtx({
      searchKeyword: "东方",
      currentPage: 2,
      allMediaData: rows("甲"),
    });

    BilibiliService.snbclickSearchVideo(ctx, 10);
    await state().mediaData;
    await Promise.resolve();

    expect(state().allMediaData.map((item) => item.title)).toEqual(["甲"]);
    expect(state().updating).toBe(false);
    expect(state().totalPage).toBe(0);
  });

  it("取数失败：解除 updating，列表不被清空", async () => {
    vi.spyOn(BilibiliPlatform, "searchForVideosBasicsData").mockRejectedValue(
      new Error("B 站 412"),
    );
    const { ctx, state } = makeCtx({
      searchKeyword: "东方",
      currentPage: 2,
      allMediaData: rows("甲", "乙"),
    });

    BilibiliService.snbclickSearchVideo(ctx, 10);
    await expect(state().mediaData!).rejects.toThrow("B 站 412");
    await Promise.resolve();

    expect(state().allMediaData.map((item) => item.title)).toEqual([
      "甲",
      "乙",
    ]);
    expect(state().updating).toBe(false);
  });
});

describe("直播搜索", () => {
  it("空关键词：清掉结果与总页数，不出网", () => {
    const search = vi.spyOn(BilibiliPlatform, "searchForLiveBasicsData");
    const { ctx, state } = makeCtx({ searchKeyword: "" });

    BilibiliService.snbclickSearchLive(ctx);

    expect(search).not.toHaveBeenCalled();
    expect(state().mediaData).toBeNull();
    expect(state().totalPage).toBe(0);
  });

  it("按当前页取直播，点播入口换成 LOD，落地后写总页数并解除守卫", async () => {
    const data = Promise.resolve({
      platformData: rows("直播间"),
      totalPage: 6,
    });
    const search = vi
      .spyOn(BilibiliPlatform, "searchForLiveBasicsData")
      .mockReturnValue(data);
    const { ctx, state } = makeCtx({ searchKeyword: "东方", currentPage: 2 });

    BilibiliService.snbclickSearchLive(ctx);

    expect(search).toHaveBeenCalledWith("东方", 2);
    expect(state().mediaData).toBe(data);
    expect(state().currentOnDemandPlay).toBe(BilibiliPlatform.LOD);
    expect(state().requestToken).toBe(1);
    // 直播不走 loadPage：不追加全局列表，但同样要占用/解除 updating 守卫
    expect(state().updating).toBe(true);
    expect(state().allMediaData).toEqual([]);

    await data;
    await Promise.resolve();
    expect(state().totalPage).toBe(6);
    expect(state().updating).toBe(false);
  });

  it("票号被换掉：迟到的直播结果不写总页数", async () => {
    let resolve!: (value: Page) => void;
    const data = new Promise<Page>((r) => {
      resolve = r;
    });
    vi.spyOn(BilibiliPlatform, "searchForLiveBasicsData").mockReturnValue(data);
    const { ctx, state } = makeCtx({ searchKeyword: "东方" });

    BilibiliService.snbclickSearchLive(ctx);
    // 期间用户又发起了别的检索
    ctx.setState({ requestToken: ctx.getState().requestToken + 1 });
    resolve({ platformData: rows("直播间"), totalPage: 9 });
    await data;
    await Promise.resolve();

    expect(state().totalPage).toBe(0);
  });

  it("进行中再点不发第二次请求（与另两条搜索同一守卫）", () => {
    const search = vi
      .spyOn(BilibiliPlatform, "searchForLiveBasicsData")
      .mockResolvedValue({ platformData: rows("直播间"), totalPage: 3 });
    const { ctx, state } = makeCtx({ searchKeyword: "东方" });

    BilibiliService.snbclickSearchLive(ctx);
    BilibiliService.snbclickSearchLive(ctx);

    expect(search).toHaveBeenCalledTimes(1);
    expect(state().requestToken).toBe(1);
  });
});
