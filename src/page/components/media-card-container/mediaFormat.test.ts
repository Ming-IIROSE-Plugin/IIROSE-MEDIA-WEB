import { describe, expect, it } from "vitest";
import { sourceOf } from "./mediaFormat";

const base = { title: "t", coverImg: "", author: "a", websiteUrl: "" };
const netease = (extra: object) => ({
  ...base,
  neteaseMusic: { id: 1, fee: 0, ...extra },
});

describe("sourceOf 出处细分", () => {
  it.each([
    [{}, "网易云-单曲"],
    [{ isSongList: true }, "网易云-歌单"],
    [{ isAlbum: true }, "网易云-专辑"],
    [{ isMV: true }, "网易云-MV"],
  ])("网易云 %j → %s", (extra, label) => {
    expect(sourceOf(netease(extra))).toEqual({ key: "netease", label });
  });

  it("B 站按视频 / 课程 / 直播细分", () => {
    expect(sourceOf({ ...base, bilibili: { bvid: "x" } }).label).toBe(
      "B站-视频",
    );
    expect(sourceOf({ ...base, bilibili: { course_id: 1 } }).label).toBe(
      "B站-课程",
    );
    expect(sourceOf({ ...base, bilibiliLive: { roomid: 1 } }).label).toBe(
      "B站-直播",
    );
  });
});
