import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REQUEST_HISTORY_KEY, RequestHistory } from "./RequestHistory";
import { Media } from "../iirose_func/Socket/Media";

beforeEach(() => {
  // 写盘节流用定时器：伪时钟让「一秒窗口」可断言，也避免上一个用例的待写定时器漏到下一个
  vi.useFakeTimers();
  localStorage.clear();
  RequestHistory.resetForTests();
});

afterEach(() => {
  RequestHistory.resetForTests();
  vi.useRealTimers();
});

/** 存档里实际落盘的内容（尚未落盘时为 null）。 */
const saved = () => {
  const raw = localStorage.getItem(REQUEST_HISTORY_KEY);
  return raw === null ? null : (JSON.parse(raw) as { entries: unknown[] });
};

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

  it("真实 mediaEvent 产出的报文能解析：平台码、https 升级与媒体 id", () => {
    // 报文形状只由生产的 `mediaEvent` 定义：这里用真模块产出，不手抄字段
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const mediaEvent = (media: Partial<MediaData>) =>
        new Media().mediaEvent({
          type: "music",
          name: "",
          singer: "",
          cover: "",
          link: "",
          url: "",
          duration: 0,
          bitRate: 320,
          color: "#000000",
          ...media,
        } as MediaData);

      RequestHistory.recordPayload(
        mediaEvent({
          origin: "netease",
          name: "晴天",
          singer: "周杰伦",
          cover: "https://a/c.jpg",
          link: "https://music.163.com/#/song?id=1",
          url: "https://a/b.mp3",
          duration: 300,
        }),
      );
      RequestHistory.recordPayload(
        mediaEvent({
          type: "video",
          origin: "bilibili",
          name: "某视频",
          singer: "UP主",
          cover: "http://a/c.jpg",
          link: "https://www.bilibili.com/video/BV1xx411c7mD",
          url: "https://a/v.mp4",
          duration: 600,
        }),
      );
      RequestHistory.recordPayload(
        mediaEvent({
          type: "video",
          name: "无来源视频",
          link: "https://example.com/v/1",
          url: "https://example.com/v/1.mp4",
          duration: 60,
        }),
      );

      expect(RequestHistory.load()).toMatchObject([
        {
          source: "other",
          kind: "other",
          mediaId: null,
          key: "other:无来源视频|",
        },
        {
          source: "bilibili",
          kind: "video",
          mediaId: "BV1xx411c7mD",
          cover: "https://a/c.jpg",
          link: "https://www.bilibili.com/video/BV1xx411c7mD",
        },
        { source: "netease", kind: "music", mediaId: "1", key: "netease:1" },
      ]);
      expect(RequestHistory.recentMusic().map((entry) => entry.key)).toEqual([
        "netease:1",
      ]);
    } finally {
      log.mockRestore();
    }
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
    // 没有媒体 id 时键退化为「来源:标题|歌手」：换一条流地址仍是同一条记录，移到最前
    RequestHistory.recordPayload(
      payload({
        b: "=0",
        n: "某电台",
        r: "电台",
        o: "s://example.com/stream-2",
        c: "s://example.com/a.png",
      }),
    );
    expect(RequestHistory.load()).toHaveLength(1);
    const [entry] = RequestHistory.load();
    expect(entry).toMatchObject({
      source: "other",
      kind: "other",
      mediaId: null,
      key: "other:某电台|电台",
      link: "https://example.com/stream-2",
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

  it("存储写入失败静默：不抛错，内存里的记录照常可读，存档不被半截覆盖", () => {
    RequestHistory.recordPayload(payload());
    RequestHistory.flush();
    expect(saved()?.entries).toHaveLength(1);

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
      expect(() => RequestHistory.flush()).not.toThrow();
    } finally {
      setItem.mockRestore();
    }
    // 内存副本是读的真相：新记录照常可见，点播不因存储故障中断
    expect(RequestHistory.load().map((entry) => entry.title)).toEqual([
      "乙",
      "晴天",
    ]);
    // 存储里仍是上一次成功写入的那份：既没丢也没被半截覆盖
    expect(saved()?.entries).toHaveLength(1);
  });

  it("存储键字面量是 imwRequestHistory", () => {
    expect(REQUEST_HISTORY_KEY).toBe("imwRequestHistory");
    RequestHistory.recordPayload(payload());
    RequestHistory.flush();
    expect(localStorage.getItem("imwRequestHistory")).not.toBeNull();
  });
});

describe("合并写盘", () => {
  it("一秒内多条报文只写一次，内容合并到那份存档里", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    for (let id = 1; id <= 20; id++) {
      RequestHistory.recordPayload(
        payload({ n: `曲${id}`, o: `s://music.163.com/#/song?id=${id}` }),
      );
    }
    // 窗口没到：一条都没落盘（旧实现这时候已经重写了 20 遍）
    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(setItem).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(
      saved()?.entries.map((entry) => (entry as { title: string }).title),
    ).toEqual(Array.from({ length: 20 }, (_, index) => `曲${20 - index}`));
  });

  it("持续点播时每秒至多写一次（千首批量不会逐条重写整份存档）", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    let id = 0;
    for (let second = 0; second < 3; second++) {
      for (let index = 0; index < 5; index++) {
        id += 1;
        RequestHistory.recordPayload(
          payload({ n: `曲${id}`, o: `s://music.163.com/#/song?id=${id}` }),
        );
      }
      vi.advanceTimersByTime(1000);
      expect(setItem).toHaveBeenCalledTimes(second + 1);
    }
    expect(saved()?.entries).toHaveLength(15);
  });

  it("批量超过上限也只写一份 50 条的存档", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    for (let id = 1; id <= 120; id++) {
      RequestHistory.recordPayload(
        payload({ n: `曲${id}`, o: `s://music.163.com/#/song?id=${id}` }),
      );
    }
    vi.advanceTimersByTime(1000);
    expect(setItem).toHaveBeenCalledTimes(1);
    const entries = saved()!.entries as { title: string }[];
    expect(entries).toHaveLength(50);
    expect(entries[0].title).toBe("曲120");
  });

  it("读到的立刻是新内容，不等落盘", () => {
    RequestHistory.recordPayload(payload());
    expect(RequestHistory.load().map((entry) => entry.title)).toEqual(["晴天"]);
    expect(RequestHistory.recentMusic()).toHaveLength(1);
    // 还没到写窗口：存档里什么都没有，但读的已经是对的了
    expect(saved()).toBeNull();
  });

  it("pagehide 时把待写内容立即落盘（不丢最后一秒）", () => {
    RequestHistory.recordPayload(payload());
    expect(saved()).toBeNull();
    window.dispatchEvent(new Event("pagehide"));
    expect(saved()?.entries).toHaveLength(1);

    const setItem = vi.spyOn(Storage.prototype, "setItem");
    vi.advanceTimersByTime(1000);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("存档被外部改写（另一个标签页 / 清场）后按存储重新种子化", () => {
    RequestHistory.recordPayload(payload());
    RequestHistory.flush();
    expect(RequestHistory.load()).toHaveLength(1);

    localStorage.setItem(REQUEST_HISTORY_KEY, JSON.stringify({ entries: [] }));
    expect(RequestHistory.load()).toEqual([]);
  });

  it("flush 立即写出合并结果，之后没有改动就不重复写", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    RequestHistory.recordPayload(payload({ n: "甲" }));
    RequestHistory.recordPayload(
      payload({ n: "乙", o: "s://music.163.com/#/song?id=2" }),
    );
    RequestHistory.flush();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(saved()?.entries).toHaveLength(2);

    RequestHistory.flush();
    expect(setItem).toHaveBeenCalledTimes(1);
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
