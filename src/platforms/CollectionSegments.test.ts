import { describe, expect, it, vi } from "vitest";
import { CollectionSegments, type FetchSegment } from "./CollectionSegments";

const song = (id: number) =>
  ({ title: `曲目 ${id}`, neteaseMusic: { id, fee: 0 } }) as PlatformData;

const range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => from + i);

/** 按入参 id 原样回填（可选打乱顺序 / 丢掉某些 id）。 */
const fetcher = (options?: { drop?: number[]; reverse?: boolean }) =>
  vi.fn<FetchSegment>(async (ids) => {
    const songs = ids
      .filter((id) => !options?.drop?.includes(id))
      .map((id) => song(id));
    return options?.reverse ? songs.reverse() : songs;
  });

const titles = (songs: PlatformData[]) =>
  songs.map((item) => item.neteaseMusic!.id);

/** 让排队的微任务（预取）跑完。 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("CollectionSegments", () => {
  it("万首：总页数按 id 数算，首屏只取第 1 段（前 100 个 id）", async () => {
    const ids = range(0, 10000);
    const fetch = fetcher();
    const segments = new CollectionSegments(ids, fetch, 100);

    expect(segments.totalPage(10)).toBe(1000);
    expect(titles(await segments.loadPage(1, 10))).toEqual(range(0, 10));
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toEqual(range(0, 100));
  });

  it("段内翻页不发请求；显示第 10 页预取第 2 段恰 1 次，翻到 11 页不再请求", async () => {
    const fetch = fetcher();
    const segments = new CollectionSegments(range(0, 1000), fetch, 100);
    await segments.loadPage(1, 10);
    for (let page = 2; page <= 9; page++) await segments.loadPage(page, 10);
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);

    await segments.loadPage(10, 10);
    await segments.loadPage(10, 10);
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toEqual(range(100, 200));

    expect(titles(await segments.loadPage(11, 10))).toEqual(range(100, 110));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("同段进行中去重：并发两次只请求一次", async () => {
    const fetch = fetcher();
    const segments = new CollectionSegments(range(0, 50), fetch, 100);
    await Promise.all([segments.loadPage(1, 10), segments.loadPage(2, 10)]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("段失败：该页 reject，重试只重取这一段", async () => {
    const fetch = fetcher();
    const segments = new CollectionSegments(range(0, 300), fetch, 100);
    await segments.loadPage(1, 10);
    expect(fetch).toHaveBeenCalledTimes(1);

    fetch.mockResolvedValueOnce(null);
    await expect(segments.loadPage(11, 10)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);

    expect(titles(await segments.loadPage(11, 10))).toEqual(range(100, 110));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][0]).toEqual(range(100, 200));
  });

  it("段回空列表算失败：跨段页整页 reject，不静默只出半页；重试重取这一段", async () => {
    // 每页 30 首：第 4 页是 id 90–119，横跨第 1、2 段
    const fetch = fetcher();
    const segments = new CollectionSegments(range(0, 300), fetch, 100);
    await segments.loadPage(1, 30);
    expect(fetch).toHaveBeenCalledTimes(1);

    // 接口对非空请求回 []：不算成功，也不能被缓存成「这一段就是空的」
    fetch.mockResolvedValueOnce([]);
    await expect(segments.loadPage(4, 30)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);

    fetch.mockImplementationOnce(async (ids) => ids.map((id) => song(id)));
    expect(titles(await segments.loadPage(4, 30))).toEqual(range(90, 120));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][0]).toEqual(range(100, 200));
  });

  it("页越过末尾：reject 而不是空列表，且不发段请求；空列表仍给空结果", async () => {
    const fetch = fetcher();
    const segments = new CollectionSegments(range(0, 30), fetch, 100);
    expect(segments.totalPage(10)).toBe(3);

    await expect(segments.loadPage(4, 10)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();

    // 空列表（0 首）本来就是空的：保留「这张列表没有曲目」的空态，不报失败
    const empty = new CollectionSegments([], fetch, 100);
    expect(await empty.loadPage(1, 10)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();

    // 正常页不受影响
    expect(titles(await segments.loadPage(1, 10))).toEqual(range(0, 10));
  });

  it("整页 id 都缺：reject 并清掉该页的段，重试真的重新请求", async () => {
    // 段本身取回 90 首（成功），但第 11 页那 10 个 id（100–109）一个都没命中
    const fetch = fetcher({ drop: range(100, 110) });
    const segments = new CollectionSegments(range(0, 300), fetch, 100);
    await expect(segments.loadPage(11, 10)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);

    // 段没被当成「已成功的空页」留在缓存里：重试重新请求这一段并正常出页
    fetch.mockImplementationOnce(async (ids) => ids.map((id) => song(id)));
    expect(titles(await segments.loadPage(11, 10))).toEqual(range(100, 110));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toEqual(range(100, 200));
  });

  it("预取失败静默，翻到该页时再取", async () => {
    const fetch = fetcher();
    const segments = new CollectionSegments(range(0, 200), fetch, 100);
    await segments.loadPage(1, 10);
    fetch.mockRejectedValueOnce(new Error("网络"));
    await segments.loadPage(10, 10);
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);

    expect(titles(await segments.loadPage(11, 10))).toEqual(range(100, 110));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("段内结果按 id 顺序重排，接口缺失的 id 跳过", async () => {
    const fetch = fetcher({ drop: [3, 7], reverse: true });
    const segments = new CollectionSegments(range(0, 30), fetch, 100);
    expect(titles(await segments.loadPage(1, 10))).toEqual([
      0, 1, 2, 4, 5, 6, 8, 9,
    ]);
  });

  it("专辑 30 首：1 次请求、3 页、末页不预取", async () => {
    const fetch = fetcher();
    const segments = new CollectionSegments(range(0, 30), fetch, 100);
    expect(segments.totalPage(10)).toBe(3);
    await segments.loadPage(1, 10);
    expect(titles(await segments.loadPage(3, 10))).toEqual(range(20, 30));
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("abort：飞行中的段带 signal 被中止，迟到结果与之后的取页都 reject", async () => {
    let release: (songs: PlatformData[]) => void = () => {};
    const fetch = vi.fn<FetchSegment>(
      () => new Promise((resolve) => (release = resolve)),
    );
    const segments = new CollectionSegments(range(0, 100), fetch, 100);
    const page = segments.loadPage(1, 10);
    const signal = fetch.mock.calls[0][1];
    expect(signal.aborted).toBe(false);

    segments.abort();
    expect(signal.aborted).toBe(true);
    release(range(0, 100).map(song));
    await expect(page).rejects.toThrow();
    await expect(segments.loadPage(1, 10)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("页跨两段时取两段并拼接", async () => {
    const fetch = fetcher();
    const segments = new CollectionSegments(range(0, 300), fetch, 100);
    expect(titles(await segments.loadPage(10, 15))).toEqual(range(135, 150));
    expect(titles(await segments.loadPage(7, 15))).toEqual(range(90, 105));
    expect(fetch.mock.calls.map((call) => call[0][0])).toEqual([100, 0]);
  });
});
