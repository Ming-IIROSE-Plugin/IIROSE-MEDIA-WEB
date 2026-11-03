import { describe, expect, it, vi } from "vitest";
import {
  loadPage,
  showLocalList,
  showPage,
  sliceCachedPage,
} from "./pagedLoader";

type Page = { platformData: PlatformData[]; totalPage: number };

/** 只带标题的条目：分页编排只搬运数组，不读条目字段。 */
const row = (title: string) => ({ title }) as PlatformData;

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
  return { ctx, state: () => state };
}

const page = async (state: MainAppContainerState) =>
  (await state.mediaData) as Page | null;

describe("分页加载器", () => {
  it("结果没有 allPlatformData 时也解除 updating，失败后还能再翻页", async () => {
    const { ctx, state } = makeCtx();
    const failed = loadPage(ctx, {
      fetch: () => Promise.resolve({ platformData: [], totalPage: 0 }),
      onDemandPlay: vi.fn(),
    });
    await failed;
    await Promise.resolve();
    expect(state().updating).toBe(false);

    // 第二次请求不会被守卫拦住
    const retry = loadPage(ctx, {
      fetch: () =>
        Promise.resolve({
          platformData: [row("甲")],
          allPlatformData: [row("甲")],
          totalPage: 1,
        }),
      onDemandPlay: vi.fn(),
    });
    expect(retry).not.toBeNull();
    await retry;
    await Promise.resolve();
    expect(state().allMediaData).toHaveLength(1);
  });

  it("陈旧结果不解除新请求的 updating", async () => {
    const { ctx, state } = makeCtx();
    let resolveFirst: (value: unknown) => void = () => {};
    const first = loadPage(ctx, {
      fetch: () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }) as never,
      onDemandPlay: vi.fn(),
    });
    // 期间来了新请求：票号前进，旧结果不得动 updating
    ctx.setState({ requestToken: ctx.getState().requestToken + 1 });
    resolveFirst({ platformData: [], totalPage: 0 });
    await first;
    await Promise.resolve();
    expect(state().updating).toBe(true);
  });

  it("首屏：占新票号、置 updating，落地后把本次条目追加进全局列表", async () => {
    const { ctx, state } = makeCtx();
    const onDemand = vi.fn();

    const pending = loadPage(ctx, {
      fetch: () =>
        Promise.resolve({
          platformData: [row("甲"), row("乙")],
          allPlatformData: [row("甲"), row("乙")],
          totalPage: 3,
        }),
      onDemandPlay: onDemand,
    });

    // 请求在途：守卫已置位，mediaData 就是这次的 Promise
    expect(state().updating).toBe(true);
    expect(state().requestToken).toBe(1);
    expect(state().mediaData).toBe(pending);
    expect(state().currentOnDemandPlay).toBe(onDemand);

    await pending;

    expect(state().allMediaData.map((item) => item.title)).toEqual([
      "甲",
      "乙",
    ]);
    expect(state().totalPage).toBe(3);
    expect(state().updating).toBe(false);
  });

  it("翻页：第二页只追加新条目，页码口径由调用方给", async () => {
    const { ctx, state } = makeCtx({
      currentPage: 2,
      allMediaData: [row("甲"), row("乙")],
    });
    const fetch = vi.fn(() =>
      Promise.resolve({
        platformData: [row("丙")],
        allPlatformData: [row("丙")],
        totalPage: 2,
      }),
    );

    await loadPage(ctx, { fetch, onDemandPlay: vi.fn() });

    expect(fetch).toHaveBeenCalledOnce();
    expect(state().allMediaData.map((item) => item.title)).toEqual([
      "甲",
      "乙",
      "丙",
    ]);
    expect((await page(state()))?.platformData).toHaveLength(1);
  });

  it("缓存命中：只切本地列表，不动票号与 updating", () => {
    const allMediaData = [row("甲"), row("乙"), row("丙")];
    const { ctx, state } = makeCtx({ updating: true, requestToken: 7 });
    const onDemand = vi.fn();
    const sliced = sliceCachedPage(allMediaData, 2, 2);

    const pending = showPage(
      ctx,
      { platformData: sliced, totalPage: 2 },
      onDemand,
    );

    expect(sliced.map((item) => item.title)).toEqual(["丙"]);
    expect(state().requestToken).toBe(7);
    expect(state().updating).toBe(true);
    expect(state().currentOnDemandPlay).toBe(onDemand);
    // 返回的就是装进 mediaData 的那份承诺（电台按它记「已加载过」）
    expect(state().mediaData).toBe(pending);
  });

  it("取数返回空列表：不追加条目、总页数归零、解除守卫", async () => {
    const { ctx, state } = makeCtx({ allMediaData: [row("甲")] });

    await loadPage(ctx, {
      fetch: () =>
        Promise.resolve({
          platformData: [],
          allPlatformData: [],
          totalPage: 0,
        }),
      onDemandPlay: vi.fn(),
    });

    expect(state().allMediaData.map((item) => item.title)).toEqual(["甲"]);
    expect(state().totalPage).toBe(0);
    expect(state().updating).toBe(false);
    expect((await page(state()))?.platformData).toEqual([]);
  });

  it("票号已被换掉：迟到的结果不追加", async () => {
    const { ctx, state } = makeCtx();
    let resolve: (value: {
      platformData: PlatformData[];
      allPlatformData: PlatformData[];
      totalPage: number;
    }) => void = () => {};
    const pending = loadPage(ctx, {
      fetch: () =>
        new Promise<{
          platformData: PlatformData[];
          allPlatformData: PlatformData[];
          totalPage: number;
        }>((r) => {
          resolve = r;
        }),
      onDemandPlay: vi.fn(),
    });

    // 新一次检索换掉了票号
    ctx.setState({ requestToken: 2, updating: true });
    resolve({
      platformData: [row("甲")],
      allPlatformData: [row("甲")],
      totalPage: 1,
    });
    await pending;

    expect(state().allMediaData).toEqual([]);
  });

  it("整张列表一次取全：夹页码切片、收尾 updating", async () => {
    const { ctx, state } = makeCtx({ updating: true, currentPage: 9 });
    const onDemand = vi.fn();

    showLocalList(ctx, [row("甲"), row("乙"), row("丙")], {
      currentPage: 9,
      itemsPerPage: 2,
      onDemandPlay: onDemand,
    });

    expect(state().currentPage).toBe(2);
    expect(state().totalPage).toBe(2);
    expect(state().updating).toBe(false);
    expect(state().allMediaData).toHaveLength(3);
    expect(
      (await page(state()))?.platformData.map((item) => item.title),
    ).toEqual(["丙"]);
    expect(state().currentOnDemandPlay).toBe(onDemand);
  });
});
