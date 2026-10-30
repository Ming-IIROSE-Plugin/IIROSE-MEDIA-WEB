import { afterEach, describe, expect, it, vi } from "vitest";
import { RadioService } from "./RadioService";
import { RadioPlatform } from "../../platforms/RadioPlatform";

type RadioPayload = { platformData: PlatformData[]; totalPage: number };

/** 最小现场：只保留 RadioService 读写的字段。 */
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
  const ctx: MainAppContainerActionContext = {
    getState: () => state,
    setState: (patch) => {
      state = { ...state, ...patch };
    },
    pushAllData: (token, data, total) => {
      if (state.requestToken !== token) return;
      state = {
        ...state,
        allMediaData: [...state.allMediaData, ...data],
        totalPage: total,
        updating: false,
      };
    },
  };
  const payload = async () => (await state.mediaData) as RadioPayload | null;
  return { ctx, state: () => state, payload };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("电台过滤", () => {
  it("首次进入取一次网络，返回前按关键词过滤台名", async () => {
    const search = vi.spyOn(RadioPlatform, "searchSongs");
    const { ctx, payload } = makeCtx({ searchKeyword: "vocaloid" });

    RadioService.search(ctx, 10, "japan");
    const data = await payload();
    expect(search).toHaveBeenCalledOnce();
    expect(data?.platformData.map((item) => item.title)).toEqual([
      "Vocaloid Radio",
    ]);
    expect(data?.totalPage).toBe(1);
  });

  it("请求在途时改关键词：落地的列表按落地时的关键词过滤", async () => {
    const search = vi.spyOn(RadioPlatform, "searchSongs");
    const { ctx, payload } = makeCtx();

    // 关键词还空着就发起请求
    RadioService.search(ctx, 10, "japan");
    // 请求在途时改词：第二次调用被 `updating` 挡住，不会再出网
    ctx.setState({ searchKeyword: "vocaloid", currentPage: 1 });
    RadioService.search(ctx, 10, "japan");

    expect(search).toHaveBeenCalledOnce();
    expect((await payload())?.platformData.map((item) => item.title)).toEqual([
      "Vocaloid Radio",
    ]);
  });

  it("已加载后只筛本地缓存，清空关键词恢复全部，都不联网", async () => {
    const search = vi.spyOn(RadioPlatform, "searchSongs");
    const { ctx, state, payload } = makeCtx();

    RadioService.search(ctx, 10, "japan");
    await payload();
    search.mockClear();

    ctx.setState({ searchKeyword: "listen", currentPage: 1 });
    RadioService.search(ctx, 10, "japan");
    expect((await payload())?.platformData.map((item) => item.title)).toEqual([
      "Listen.moe",
    ]);

    ctx.setState({ searchKeyword: "", currentPage: 1 });
    RadioService.search(ctx, 10, "japan");
    expect(await payload()).toMatchObject({ totalPage: 1 });
    expect((await payload())?.platformData).toHaveLength(2);

    expect(search).not.toHaveBeenCalled();
    expect(state().allMediaData).toHaveLength(2);
  });

  it("过滤无匹配时给出空列表，同样不联网", async () => {
    const search = vi.spyOn(RadioPlatform, "searchSongs");
    const { ctx, payload } = makeCtx();

    RadioService.search(ctx, 10, "japan");
    await payload();
    search.mockClear();

    ctx.setState({ searchKeyword: "不存在的台", currentPage: 1 });
    RadioService.search(ctx, 10, "japan");
    expect((await payload())?.platformData).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});
