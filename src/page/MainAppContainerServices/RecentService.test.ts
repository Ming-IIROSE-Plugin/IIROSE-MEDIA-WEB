import { beforeEach, describe, expect, it } from "vitest";
import { NetEasePlatform } from "../../platforms/NetEasePlatform";
import { RequestHistory } from "../../history/RequestHistory";
import { RecentService } from "./RecentService";

/** `&1` 点播报文：与 `Socket/Media.mediaEvent` 同形（`c` / `o` 已截掉 `http`）。 */
const payload = (id: number, title: string) =>
  `&1${JSON.stringify({
    s: `s://a/${id}.mp3`,
    d: 269,
    c: "s://a/c.jpg",
    n: title,
    r: "周杰伦",
    b: "@0",
    o: `s://music.163.com/#/song?id=${id}`,
    l: "",
  })}`;

/** 最小现场：RecentService 只读页码、只写结果与点播入口。 */
function makeCtx(currentPage = 1) {
  let state = {
    currentPage,
    mediaData: null,
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
  localStorage.clear();
});

describe("音乐首屏「最近点播」供数", () => {
  it("把历史里的网易云单曲铺成曲目行，点播仍走单曲点播入口", async () => {
    RequestHistory.recordPayload(payload(1, "晴天"));
    RequestHistory.recordPayload(payload(2, "鱼"));
    const { ctx, state } = makeCtx();

    RecentService.load(ctx, 10);

    expect(state().totalPage).toBe(1);
    expect(state().currentOnDemandPlay).toBe(NetEasePlatform.MOD);
    expect((await state().mediaData!).platformData).toEqual([
      expect.objectContaining({
        title: "鱼",
        author: "周杰伦",
        websiteUrl: "https://music.163.com/#/song?id=2",
        duration: 269,
        neteaseMusic: { id: 2, fee: 0 },
      }),
      expect.objectContaining({ title: "晴天" }),
    ]);
  });

  it("同一首再点播仍是同一条：首屏行数不变且该条在最前", async () => {
    RequestHistory.recordPayload(payload(1, "晴天"));
    RequestHistory.recordPayload(payload(2, "鱼"));
    RequestHistory.recordPayload(payload(1, "晴天"));
    const { ctx, state } = makeCtx();

    RecentService.load(ctx, 10);

    expect((await state().mediaData!).platformData.map((d) => d.title)).toEqual(
      ["晴天", "鱼"],
    );
  });

  it("超过一页按页码切片；没有历史时给空列表", async () => {
    for (let id = 1; id <= 12; id++)
      RequestHistory.recordPayload(payload(id, `曲${id}`));

    const second = makeCtx(2);
    RecentService.load(second.ctx, 10);
    const page = await second.state().mediaData!;
    expect(page.totalPage).toBe(2);
    expect(page.platformData.map((d) => d.title)).toEqual(["曲2", "曲1"]);

    localStorage.clear();
    const empty = makeCtx();
    RecentService.load(empty.ctx, 10);
    expect((await empty.state().mediaData!).platformData).toEqual([]);
  });

  it("只列网易云单曲：视频与无来源条目不上首屏", async () => {
    RequestHistory.recordPayload(payload(1, "晴天"));
    RequestHistory.recordPayload(
      `&1${JSON.stringify({ n: "某视频", r: "UP", b: "!3", o: "s://www.bilibili.com/video/BV1", c: "", d: 60 })}`,
    );
    RequestHistory.recordPayload(
      `&1${JSON.stringify({ n: "某电台", r: "电台", b: "=0", o: "s://example.com/stream", c: "" })}`,
    );
    const { ctx, state } = makeCtx();

    RecentService.load(ctx, 10);

    expect((await state().mediaData!).platformData.map((d) => d.title)).toEqual(
      ["晴天"],
    );
  });
});
