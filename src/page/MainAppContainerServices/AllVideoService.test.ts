import { describe, expect, it, vi } from "vitest";
import { AllVideosPlatform } from "../../platforms/AllVideosPlatform";
import { AllVideosService } from "./AllVideoService";

type Page = { platformData: PlatformData[]; totalPage: number };

type SearchResult = Page & { allPlatformData: PlatformData[] };

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

const BASE_URL = "https://cms.example.com";

describe("采集站搜索", () => {
  it("空关键词：清掉结果与总页数，不出网", () => {
    const search = vi.spyOn(AllVideosPlatform, "searchAllVideos");
    const { ctx, state } = makeCtx({ searchKeyword: "" });

    AllVideosService.searchAllVideos(ctx, BASE_URL, 10);

    expect(search).not.toHaveBeenCalled();
    expect(state().mediaData).toBeNull();
    expect(state().totalPage).toBe(0);
  });

  it("首屏：占新票号、置 updating，落地后追加条目并写总页数", async () => {
    const result: SearchResult = {
      platformData: rows("甲", "乙"),
      allPlatformData: rows("甲", "乙"),
      totalPage: 3,
    };
    const search = vi
      .spyOn(AllVideosPlatform, "searchAllVideos")
      .mockResolvedValue(result);
    const { ctx, state, page } = makeCtx({ searchKeyword: "西部" });

    AllVideosService.searchAllVideos(ctx, BASE_URL, 10);

    // 请求在途：守卫已置位，mediaData 就是本次请求的 Promise
    expect(state().updating).toBe(true);
    expect(state().requestToken).toBe(1);
    expect(state().mediaData).toBe(search.mock.results[0].value);
    expect(state().currentOnDemandPlay).toBe(AllVideosPlatform.VOD);
    expect(search).toHaveBeenCalledWith("西部", 1, BASE_URL);

    await page();
    await Promise.resolve();

    expect(state().allMediaData.map((item) => item.title)).toEqual([
      "甲",
      "乙",
    ]);
    expect(state().totalPage).toBe(3);
    expect(state().updating).toBe(false);
    expect((await page())?.platformData.map((item) => item.title)).toEqual([
      "甲",
      "乙",
    ]);
  });

  it("翻页：采集站页码按每页 10 条换算，与调用方给的 itemsPerPage 无关", async () => {
    // 已加载 25 条：采集站只有 3 页；当前要第 3 页（每页 20 条时本地只够 2 页）
    const search = vi
      .spyOn(AllVideosPlatform, "searchAllVideos")
      .mockResolvedValue({
        platformData: rows("丙"),
        allPlatformData: rows("丙"),
        totalPage: 4,
      });
    const { ctx, state } = makeCtx({
      searchKeyword: "西部",
      currentPage: 3,
      allMediaData: rows(...Array.from({ length: 25 }, (_, i) => `${i}`)),
    });

    AllVideosService.searchAllVideos(ctx, BASE_URL, 20);

    expect(search).toHaveBeenCalledWith("西部", 3, BASE_URL);
    await Promise.resolve();
    expect(state().allMediaData).toHaveLength(26);
    expect(state().totalPage).toBe(4);
  });

  it("命中本地缓存：只切已加载列表，不动票号与 updating，也不出网", async () => {
    const search = vi.spyOn(AllVideosPlatform, "searchAllVideos");
    const { ctx, state, page } = makeCtx({
      searchKeyword: "西部",
      currentPage: 2,
      totalPage: 4,
      requestToken: 7,
      updating: true,
      allMediaData: rows(...Array.from({ length: 15 }, (_, i) => `第${i}集`)),
    });

    AllVideosService.searchAllVideos(ctx, BASE_URL, 10);

    expect(search).not.toHaveBeenCalled();
    expect(state().requestToken).toBe(7);
    expect(state().updating).toBe(true);
    expect((await page())?.platformData.map((item) => item.title)).toEqual([
      "第10集",
      "第11集",
      "第12集",
      "第13集",
      "第14集",
    ]);
    expect((await page())?.totalPage).toBe(4);
  });

  it("updating 期间再翻页：不发第二次请求，解除后恢复", async () => {
    const search = vi
      .spyOn(AllVideosPlatform, "searchAllVideos")
      .mockResolvedValue({
        platformData: rows("丙"),
        allPlatformData: rows("丙"),
        totalPage: 2,
      });
    const { ctx, state } = makeCtx({
      searchKeyword: "西部",
      currentPage: 2,
      updating: true,
      allMediaData: rows(...Array.from({ length: 5 }, (_, i) => `${i}`)),
    });

    AllVideosService.searchAllVideos(ctx, BASE_URL, 10);
    AllVideosService.searchAllVideos(ctx, BASE_URL, 10);
    expect(search).not.toHaveBeenCalled();
    expect(state().mediaData).toBeNull();

    ctx.setState({ updating: false });
    AllVideosService.searchAllVideos(ctx, BASE_URL, 10);
    expect(search).toHaveBeenCalledOnce();
  });

  it("取数返回空：解除 updating，已加载列表保持原样", async () => {
    vi.spyOn(AllVideosPlatform, "searchAllVideos").mockResolvedValue({
      platformData: [],
      allPlatformData: [],
      totalPage: 0,
    });
    const { ctx, state } = makeCtx({
      searchKeyword: "西部",
      currentPage: 2,
      allMediaData: rows("甲"),
    });

    AllVideosService.searchAllVideos(ctx, BASE_URL, 10);
    await state().mediaData;
    await Promise.resolve();

    expect(state().allMediaData.map((item) => item.title)).toEqual(["甲"]);
    expect(state().updating).toBe(false);
    expect(state().totalPage).toBe(0);
  });

  it("取数失败：解除 updating，列表不被清空，失败语义保留", async () => {
    vi.spyOn(AllVideosPlatform, "searchAllVideos").mockRejectedValue(
      new Error("采集站超时"),
    );
    const { ctx, state } = makeCtx({
      searchKeyword: "西部",
      currentPage: 2,
      allMediaData: rows("甲", "乙"),
    });

    AllVideosService.searchAllVideos(ctx, BASE_URL, 10);
    await expect(state().mediaData!).rejects.toThrow("采集站超时");
    await Promise.resolve();

    expect(state().allMediaData.map((item) => item.title)).toEqual([
      "甲",
      "乙",
    ]);
    expect(state().updating).toBe(false);
    // 失败后还能再翻页
    expect(state().requestToken).toBe(1);
  });
});
