import { afterEach, describe, expect, it, vi } from "vitest";
import { InnerPageService, type InnerPageHost } from "./InnerPageService";
import { CollectionSegments } from "../../platforms/CollectionSegments";
import { NetEasePlatform } from "../../platforms/NetEasePlatform";

// 内页首屏的加载编排：先拿完整 id 列表（分段加载器），记票与模式校验通过后落现场，
// 再取第 1 段当首屏。只验证「落到哪儿 / 迟到结果丢不丢」，分段取数本身由
// CollectionSegments 自己的测试负责——这里用真的加载器配假的分段取数。

const song = (id: number): PlatformData =>
  ({
    title: `曲${id}`,
    coverImg: "",
    author: "",
    websiteUrl: `https://music.163.com/song?id=${id}`,
    neteaseMusic: { id, fee: 0 },
  }) as PlatformData;

const idList = (count: number) =>
  Array.from({ length: count }, (_, index) => index + 1);

/** 内页来源：`isSongList` / `isAlbum` 决定走哪个详情入口。 */
const collectionPage = (
  over: Partial<NonNullable<PlatformData["neteaseMusic"]>> = {},
): PlatformData =>
  ({
    title: "某歌单",
    coverImg: "",
    author: "",
    websiteUrl: "https://music.163.com/playlist?id=501",
    neteaseMusic: { id: 501, isSongList: true, fee: 0, ...over },
  }) as PlatformData;

/** 真加载器 + 可断言的分段取数（默认按 id 顺序造行）。 */
const makeLoader = (
  ids: number[],
  fetchSegment = vi.fn(async (chunk: number[]) => chunk.map(song)),
) => ({
  loader: new CollectionSegments(ids, fetchSegment),
  fetchSegment,
});

/** 可控的 `CollectionSegments | null`：用来把「详情还在路上」这段握住。 */
const deferred = <T>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** 最小现场：票号 / 模式 / 内页开关都能从外部改，写回都记下来。 */
function makeHost(options: { itemsPerPage?: number; mode?: number } = {}) {
  const state = { ticket: 0, mode: options.mode ?? 0, open: true };
  const setSegments = vi.fn();
  const setSnapshotSegments = vi.fn();
  const host: InnerPageHost = {
    itemsPerPage: options.itemsPerPage ?? 10,
    originMode: state.mode,
    ticketOf: () => state.ticket,
    currentMode: () => state.mode,
    isInnerPageOpen: () => state.open,
    setSegments,
    setSnapshotSegments,
  };
  return {
    host,
    setSegments,
    setSnapshotSegments,
    /** 换掉内页 / 返回外层：票号前进，迟到的详情作废。 */
    bumpTicket: () => {
      state.ticket += 1;
    },
    switchMode: (mode: number) => {
      state.mode = mode;
    },
    leaveInnerPage: () => {
      state.open = false;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("首屏加载", () => {
  it("打开歌单：先取 id 列表拿到加载器，落现场后再把第 1 段当首屏", async () => {
    const page = collectionPage();
    const { loader, fetchSegment } = makeLoader(idList(250));
    const entry = vi
      .spyOn(NetEasePlatform, "getSongListMultiPageData")
      .mockResolvedValue(loader);
    const { host, setSegments, setSnapshotSegments } = makeHost();

    const { mediaData, segments } = InnerPageService.load(host, page);

    const data = await mediaData;
    expect(entry).toHaveBeenCalledWith(page);
    // 25 页 × 10 首：首屏只有第一页
    expect(data.totalPage).toBe(25);
    expect(data.platformData.map((item) => item.title)).toEqual(
      idList(10).map((id) => `曲${id}`),
    );
    // 首屏只取第 1 段：一次请求 100 个 id
    expect(fetchSegment).toHaveBeenCalledOnce();
    expect(fetchSegment.mock.calls[0][0]).toHaveLength(100);
    // 加载器落到当前现场（不是快照），总页数一起给
    expect(setSegments).toHaveBeenCalledWith(loader, 25);
    expect(setSnapshotSegments).not.toHaveBeenCalled();
    expect(await segments).toBe(loader);
  });

  it("专辑内页走专辑入口，不碰歌单入口", async () => {
    const page = collectionPage({ id: 11, isSongList: false, isAlbum: true });
    const { loader } = makeLoader(idList(3));
    const albumEntry = vi
      .spyOn(NetEasePlatform, "getAlbumMultiPageData")
      .mockResolvedValue(loader);
    const songListEntry = vi.spyOn(NetEasePlatform, "getSongListMultiPageData");
    const { host } = makeHost();

    const { mediaData } = InnerPageService.load(host, page);
    await mediaData;

    expect(albumEntry).toHaveBeenCalledWith(page);
    expect(songListEntry).not.toHaveBeenCalled();
  });

  it("页大小与总页数按 host 的 itemsPerPage 计", async () => {
    const page = collectionPage();
    const { loader } = makeLoader(idList(250));
    vi.spyOn(NetEasePlatform, "getSongListMultiPageData").mockResolvedValue(
      loader,
    );
    const { host, setSegments } = makeHost({ itemsPerPage: 25 });

    const { mediaData } = InnerPageService.load(host, page);
    const data = await mediaData;

    expect(data.totalPage).toBe(10);
    expect(data.platformData).toHaveLength(25);
    expect(setSegments).toHaveBeenCalledWith(loader, 10);
  });

  it("列表本身是空的：给空首屏（不是加载失败）", async () => {
    const page = collectionPage();
    const { loader } = makeLoader([]);
    vi.spyOn(NetEasePlatform, "getSongListMultiPageData").mockResolvedValue(
      loader,
    );
    const { host, setSegments } = makeHost();

    const { mediaData } = InnerPageService.load(host, page);

    expect(await mediaData).toEqual({ platformData: [], totalPage: 0 });
    expect(setSegments).toHaveBeenCalledWith(loader, 0);
  });

  it("详情返回 null：首屏失败、加载器为 null，错误交给结果区重试", async () => {
    const page = collectionPage();
    vi.spyOn(NetEasePlatform, "getSongListMultiPageData").mockResolvedValue(
      null,
    );
    const { host, setSegments, setSnapshotSegments } = makeHost();

    const { mediaData, segments } = InnerPageService.load(host, page);

    await expect(mediaData).rejects.toThrow("内页加载失败");
    expect(await segments).toBeNull();
    expect(setSegments).not.toHaveBeenCalled();
    expect(setSnapshotSegments).not.toHaveBeenCalled();
  });

  it("首段取回失败：首屏 reject，但加载器照样交出去", async () => {
    const page = collectionPage();
    // 请求了非空 id 却回空列表 = 段失败
    const { loader } = makeLoader(
      idList(30),
      vi.fn(async () => []),
    );
    vi.spyOn(NetEasePlatform, "getSongListMultiPageData").mockResolvedValue(
      loader,
    );
    const { host, setSegments } = makeHost();

    const { mediaData, segments } = InnerPageService.load(host, page);

    await expect(mediaData).rejects.toThrow("段加载失败");
    // 首屏失败不能让翻页 / 重试失去加载器
    expect(await segments).toBe(loader);
    expect(setSegments).toHaveBeenCalledWith(loader, 3);
  });
});

describe("迟到结果的落点", () => {
  it("票号过期：不落任何现场，加载器被中止", async () => {
    const page = collectionPage();
    const { loader } = makeLoader(idList(30));
    const pending = deferred<CollectionSegments | null>();
    vi.spyOn(NetEasePlatform, "getSongListMultiPageData").mockReturnValue(
      pending.promise,
    );
    const { host, setSegments, setSnapshotSegments, bumpTicket } = makeHost();

    const { mediaData, segments } = InnerPageService.load(host, page);

    // 详情还在路上时就换掉了这个内页
    bumpTicket();
    pending.resolve(loader);

    await expect(mediaData).rejects.toThrow("内页已离开");
    expect(loader.aborted).toBe(true);
    expect(setSegments).not.toHaveBeenCalled();
    expect(setSnapshotSegments).not.toHaveBeenCalled();
    expect(await segments).toBeNull();
  });

  it("当前模式已退出内页（票号还没动）：同样按迟到丢弃", async () => {
    const page = collectionPage();
    const { loader } = makeLoader(idList(30));
    const pending = deferred<CollectionSegments | null>();
    vi.spyOn(NetEasePlatform, "getSongListMultiPageData").mockReturnValue(
      pending.promise,
    );
    const { host, setSegments, setSnapshotSegments, leaveInnerPage } =
      makeHost();

    const { mediaData, segments } = InnerPageService.load(host, page);

    leaveInnerPage();
    pending.resolve(loader);

    await expect(mediaData).rejects.toThrow("内页已离开");
    expect(loader.aborted).toBe(true);
    expect(setSegments).not.toHaveBeenCalled();
    expect(setSnapshotSegments).not.toHaveBeenCalled();
    expect(await segments).toBeNull();
  });

  it("期间切到别的模式：落进原模式快照，当前模式不动", async () => {
    const page = collectionPage();
    const { loader } = makeLoader(idList(30));
    const pending = deferred<CollectionSegments | null>();
    vi.spyOn(NetEasePlatform, "getSongListMultiPageData").mockReturnValue(
      pending.promise,
    );
    const { host, setSegments, setSnapshotSegments, switchMode } = makeHost({
      mode: 0,
    });

    const { mediaData } = InnerPageService.load(host, page);

    switchMode(1);
    pending.resolve(loader);

    // 首屏数据照给（它落在 `mediaData` 上，由切模式时的快照带走）
    expect((await mediaData).platformData).toHaveLength(10);
    expect(setSegments).not.toHaveBeenCalled();
    expect(setSnapshotSegments).toHaveBeenCalledWith(0, loader, 3);
    expect(loader.aborted).toBe(false);
  });

  it("切走之后原模式的内页也已退出：仍落快照（快照不看当前模式的开关）", async () => {
    const page = collectionPage();
    const { loader } = makeLoader(idList(30));
    const pending = deferred<CollectionSegments | null>();
    vi.spyOn(NetEasePlatform, "getSongListMultiPageData").mockReturnValue(
      pending.promise,
    );
    const {
      host,
      setSegments,
      setSnapshotSegments,
      switchMode,
      leaveInnerPage,
    } = makeHost({ mode: 0 });

    const { mediaData } = InnerPageService.load(host, page);

    switchMode(1);
    leaveInnerPage();
    pending.resolve(loader);

    await mediaData;
    expect(setSnapshotSegments).toHaveBeenCalledWith(0, loader, 3);
    expect(setSegments).not.toHaveBeenCalled();
  });
});
