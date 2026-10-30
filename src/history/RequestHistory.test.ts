import { beforeEach, describe, expect, it, vi } from "vitest";
import { REQUEST_HISTORY_KEY, RequestHistory } from "./RequestHistory";

beforeEach(() => {
  localStorage.clear();
});

/** `&1` 点播报文：`Socket/Media.mediaEvent` 产出的字段（`c` / `o` 已被截掉 `http`）。 */
const payload = (overrides: Record<string, unknown> = {}) =>
  `&1${JSON.stringify({
    s: "s://a/b.mp3",
    d: 300,
    c: "s://a/c.jpg",
    n: "晴天",
    r: "周杰伦",
    b: "@0",
    o: "s://music.163.com/#/song?id=1",
    l: "",
    ...overrides,
  })}`;

const card = (title: string) =>
  JSON.stringify({
    m: `m__4@0>${title}>周杰伦>s://a/c.jpg>000000>320`,
    mc: "000000",
    i: "1",
  });

describe("报文解析", () => {
  it("解析 &1 报文：标题、歌手、封面、时长、链接、来源与媒体 id", () => {
    RequestHistory.recordPayload(payload());
    const [entry] = RequestHistory.load();
    expect(entry).toMatchObject({
      key: "netease:1",
      source: "netease",
      kind: "music",
      mediaId: "1",
      title: "晴天",
      artist: "周杰伦",
      cover: "https://a/c.jpg",
      link: "https://music.163.com/#/song?id=1",
      duration: 300,
    });
    expect(entry.at).toBeTypeOf("number");
  });

  it("卡片报文不写历史", () => {
    RequestHistory.recordPayload(card("晴天"));
    expect(RequestHistory.load()).toEqual([]);
  });

  it("标题为空或 JSON 解析失败一律不写", () => {
    RequestHistory.recordPayload(payload({ n: "   " }));
    RequestHistory.recordPayload("&1{不是 JSON");
    expect(RequestHistory.load()).toEqual([]);
  });

  it("电台流 / @ 直链（=0）记为「其他」并按标题歌手去重", () => {
    RequestHistory.recordPayload(
      payload({
        b: "=0",
        n: "某电台",
        r: "电台",
        o: "s://example.com/stream",
        c: "s://example.com/a.png",
      }),
    );
    const [entry] = RequestHistory.load();
    expect(entry).toMatchObject({
      source: "other",
      kind: "other",
      mediaId: null,
      key: "other:某电台|电台",
    });
    expect(RequestHistory.recentMusic()).toEqual([]);
  });

  it("B 站直播（!8）与无来源视频（!1）按平台码分类", () => {
    RequestHistory.recordPayload(
      payload({
        b: "!8",
        n: "某直播间",
        o: "s://live.bilibili.com/123",
      }),
    );
    RequestHistory.recordPayload(
      payload({ b: "!1", n: "某无来源视频", o: "s://example.com/v/1" }),
    );
    expect(
      RequestHistory.load().map((entry) => [
        entry.source,
        entry.kind,
        entry.mediaId,
      ]),
    ).toEqual([
      ["other", "other", null],
      ["bilibili", "video", "123"],
    ]);
    expect(RequestHistory.recentMusic()).toEqual([]);
  });

  it("已是 https 的封面与链接原样保留，不被改写", () => {
    RequestHistory.recordPayload(
      payload({
        c: "https://a/c.jpg",
        o: "https://music.163.com/#/song?id=1",
      }),
    );
    const [entry] = RequestHistory.load();
    expect(entry.cover).toBe("https://a/c.jpg");
    expect(entry.link).toBe("https://music.163.com/#/song?id=1");
  });

  it("缺 duration 的报文照常收录，还原时不带时长", () => {
    RequestHistory.recordPayload(payload({ d: undefined }));
    const [entry] = RequestHistory.load();
    expect(entry.duration).toBeUndefined();
    expect(RequestHistory.toPlatformData(entry).duration).toBeUndefined();
  });

  it("B 站与网易云 MV 按平台码分类", () => {
    RequestHistory.recordPayload(
      payload({
        b: "!3",
        n: "某视频",
        o: "s://www.bilibili.com/video/BV1xx411c7mD",
      }),
    );
    RequestHistory.recordPayload(
      payload({ b: "!7", n: "某 MV", o: "s://music.163.com/#/mv?id=9" }),
    );
    expect(
      RequestHistory.load().map((entry) => [
        entry.source,
        entry.kind,
        entry.mediaId,
      ]),
    ).toEqual([
      ["neteaseMV", "mv", "9"],
      ["bilibili", "video", "BV1xx411c7mD"],
    ]);
    expect(RequestHistory.recentMusic()).toEqual([]);
  });
});

describe("收录规则", () => {
  it("同一媒体移到最前且条数不变", () => {
    RequestHistory.recordPayload(payload({ n: "甲" }));
    RequestHistory.recordPayload(
      payload({ n: "乙", o: "s://music.163.com/#/song?id=2" }),
    );
    RequestHistory.recordPayload(payload({ n: "甲" }));
    expect(RequestHistory.load().map((entry) => entry.title)).toEqual([
      "甲",
      "乙",
    ]);
  });

  it("超过上限丢弃最旧的一条", () => {
    for (let id = 1; id <= 51; id++) {
      RequestHistory.recordPayload(
        payload({ n: `曲${id}`, o: `s://music.163.com/#/song?id=${id}` }),
      );
    }
    const entries = RequestHistory.load();
    expect(entries).toHaveLength(50);
    expect(entries[0].title).toBe("曲51");
    expect(entries.map((entry) => entry.title)).not.toContain("曲1");
  });

  it("存储写入失败静默：不抛错，已有记录原样保留", () => {
    RequestHistory.recordPayload(payload());
    expect(RequestHistory.load()).toHaveLength(1);

    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });
    try {
      expect(() =>
        RequestHistory.recordPayload(
          payload({ n: "乙", o: "s://music.163.com/#/song?id=2" }),
        ),
      ).not.toThrow();
    } finally {
      setItem.mockRestore();
    }
    // 第二条没写进去，第一条也没被半截覆盖
    expect(RequestHistory.load().map((entry) => entry.title)).toEqual(["晴天"]);
  });

  it("存储键字面量是 imwRequestHistory", () => {
    expect(REQUEST_HISTORY_KEY).toBe("imwRequestHistory");
    RequestHistory.recordPayload(payload());
    expect(localStorage.getItem("imwRequestHistory")).not.toBeNull();
  });
});

describe("存档损坏", () => {
  it("非法 JSON / 版本不符 / 非数组都按空历史处理", () => {
    localStorage.setItem(REQUEST_HISTORY_KEY, "{oops");
    expect(RequestHistory.load()).toEqual([]);

    localStorage.setItem(
      REQUEST_HISTORY_KEY,
      JSON.stringify({ version: 99, entries: [] }),
    );
    expect(RequestHistory.load()).toEqual([]);

    localStorage.setItem(
      REQUEST_HISTORY_KEY,
      JSON.stringify({ version: 1, entries: "不是数组" }),
    );
    expect(RequestHistory.load()).toEqual([]);

    localStorage.setItem(REQUEST_HISTORY_KEY, JSON.stringify([]));
    expect(RequestHistory.load()).toEqual([]);
  });
});

describe("最近点播", () => {
  it("只列网易云单曲，并还原成再点播用的 PlatformData", () => {
    RequestHistory.recordPayload(payload());
    RequestHistory.recordPayload(
      payload({ b: "!3", n: "某视频", o: "s://www.bilibili.com/video/BV1" }),
    );
    const recent = RequestHistory.recentMusic();
    expect(recent).toHaveLength(1);
    expect(RequestHistory.toPlatformData(recent[0])).toMatchObject({
      title: "晴天",
      author: "周杰伦",
      coverImg: "https://a/c.jpg",
      websiteUrl: "https://music.163.com/#/song?id=1",
      duration: 300,
      neteaseMusic: { id: 1, fee: 0 },
    });
  });

  it("网易云条目的链接里解析不出 id 时仍存档，但不进最近点播", () => {
    RequestHistory.recordPayload(payload({ o: "s://music.163.com/#/song" }));
    const [entry] = RequestHistory.load();
    expect(entry.mediaId).toBeNull();
    expect(entry.key).toBe("netease:晴天|周杰伦");
    expect(RequestHistory.recentMusic()).toEqual([]);
  });
});
