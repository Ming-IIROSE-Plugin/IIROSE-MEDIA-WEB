import { describe, expect, it } from "vitest";
import { PLATFORM_SEARCH_SOURCES } from "./platformSearchSources";

const rangesOf = (row: number, source: number) =>
  PLATFORM_SEARCH_SOURCES[row][source].ranges.map((range) => range.title);

describe("平台检索描述表", () => {
  it("六种模式各一行，顺序与模式下标一致", () => {
    expect(PLATFORM_SEARCH_SOURCES).toHaveLength(6);
    expect(PLATFORM_SEARCH_SOURCES[0].map((s) => s.title)).toEqual([
      "网易云音乐",
    ]);
    expect(PLATFORM_SEARCH_SOURCES[1].map((s) => s.title)).toEqual([
      "哔哩哔哩",
      "多源剧集",
    ]);
    expect(PLATFORM_SEARCH_SOURCES[2].map((s) => s.title)).toEqual(["电台"]);
    expect(PLATFORM_SEARCH_SOURCES[3].map((s) => s.title)).toEqual([
      "全部",
      "网易云音乐",
      "哔哩哔哩",
    ]);
    expect(PLATFORM_SEARCH_SOURCES[4].map((s) => s.title)).toEqual(["设置"]);
    expect(PLATFORM_SEARCH_SOURCES[5].map((s) => s.title)).toEqual([
      "关于这个插件",
    ]);
  });

  it("音乐四范围与视频三范围保持原顺序", () => {
    expect(rangesOf(0, 0)).toEqual(["单曲", "专辑", "歌单", "MV"]);
    expect(rangesOf(1, 0)).toEqual(["推荐", "视频", "直播"]);
    expect(rangesOf(1, 1)).toEqual(["U库资源网", "非凡资源", "最大资源网"]);
  });

  it("收藏是三来源 × 四范围，且页大小跟随收藏设置", () => {
    for (const source of PLATFORM_SEARCH_SOURCES[3]) {
      expect(source.ranges.map((r) => r.title)).toEqual([
        "全部",
        "单曲",
        "歌单与专辑",
        "视频",
      ]);
      expect(source.pageSizeOf).toBe("favorites");
    }
  });

  it("设置的「关于」只在手机出现，且排最后", () => {
    const ranges = PLATFORM_SEARCH_SOURCES[4][0].ranges;
    expect(ranges.map((r) => r.title)).toEqual([
      "哔哩哔哩视频",
      "网易云音乐",
      "无线电广播",
      "插件设置",
      "关于",
    ]);
    expect(ranges.slice(0, -1).every((r) => !r.phoneOnly)).toBe(true);
    expect(ranges[ranges.length - 1].phoneOnly).toBe(true);
  });

  it("只有音乐与哔哩哔哩在「单曲/视频」这类范围上标 search", () => {
    const searchFlags = (row: number, source: number) =>
      PLATFORM_SEARCH_SOURCES[row][source].ranges.map((r) => !!r.search);
    expect(searchFlags(0, 0)).toEqual([true, true, true, true]);
    expect(searchFlags(1, 0)).toEqual([false, true, true]);
  });

  it("每个范围只声明一族取数动作", () => {
    const families = ["ctx", "page", "refresh", "desk"];
    for (const row of PLATFORM_SEARCH_SOURCES)
      for (const source of row)
        for (const range of source.ranges) {
          const used = families.filter((key) => key in range);
          expect(used, `${source.title} / ${range.title}`).toHaveLength(1);
        }
  });

  it("来源圆点只出现在真有品牌来源的三处", () => {
    const keys = PLATFORM_SEARCH_SOURCES.flatMap((row) =>
      row.map((source) => source.sourceKey),
    ).filter(Boolean);
    expect(keys.sort()).toEqual(
      ["bilibili", "bilibili", "multi", "netease", "netease", "radio"].sort(),
    );
  });
});
