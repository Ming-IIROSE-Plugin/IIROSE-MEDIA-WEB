import { beforeEach, describe, expect, it, vi } from "vitest";

// 共用实现：聊天输入框的链接拦截与搜索栏粘贴分 P 链接都调 `playBilibiliLink`。
// 这里盯它的契约——认不认这条链接、`?p=` 有没有一路带到 `VOD`。
const bilibili = vi.hoisted(() => ({
  getBilibiliVideoDetail: vi.fn(),
  VOD: vi.fn(async (_data: PlatformData, _targetP?: number) => {}),
}));

vi.mock("./BilibiliPlatform", () => ({ BilibiliPlatform: bilibili }));

import { playBilibiliLink } from "./bilibiliLink";

const detail = (pages = 2) => ({
  title: "某多 P 视频",
  pic: "https://i0.hdslb.com/cover.jpg",
  owner: { name: "某 UP" },
  duration: 60,
  aid: 170001,
  bvid: "BV1xx411c7mD",
  cid: 101,
  pages: Array.from({ length: pages }, (_, i) => ({
    page: i + 1,
    part: `P${i + 1}`,
    duration: 60,
    cid: 101 + i,
  })),
});

beforeEach(() => {
  bilibili.getBilibiliVideoDetail.mockReset();
  bilibili.VOD.mockClear();
});

describe("playBilibiliLink", () => {
  it("带 ?p= 的链接：取详情后直接点播该分 P", async () => {
    bilibili.getBilibiliVideoDetail.mockResolvedValue(detail());

    const handled = await playBilibiliLink(
      "https://www.bilibili.com/video/BV1xx411c7mD?p=2",
    );

    expect(handled).toBe(true);
    expect(bilibili.getBilibiliVideoDetail).toHaveBeenCalledWith(
      "BV1xx411c7mD",
    );
    expect(bilibili.VOD).toHaveBeenCalledTimes(1);
    const [data, targetP] = bilibili.VOD.mock.calls[0];
    expect(targetP).toBe(2);
    expect(data).toMatchObject({
      title: "某多 P 视频",
      coverImg: "https://i0.hdslb.com/cover.jpg",
      author: "某 UP",
      websiteUrl: "https://www.bilibili.com/video/BV1xx411c7mD?p=2",
      duration: 60,
      bilibili: { aid: 170001, bvid: "BV1xx411c7mD", cid: 101 },
    });
    // 多 P 视频要带上 multiPage，单 P 不用
    expect(await data.multiPage).toEqual({ platform: "bilibili" });
  });

  it("不带分 P 的链接：也点播（第 1 P），websiteUrl 不带 ?p=", async () => {
    bilibili.getBilibiliVideoDetail.mockResolvedValue(detail(1));

    expect(
      await playBilibiliLink("https://www.bilibili.com/video/BV1xx411c7mD"),
    ).toBe(true);
    const [data, targetP] = bilibili.VOD.mock.calls[0];
    expect(targetP).toBeUndefined();
    expect(data.websiteUrl).toBe("https://www.bilibili.com/video/BV1xx411c7mD");
    expect(data.multiPage).toBeUndefined();
  });

  it("requirePage：不带 ?p= 的链接不接管，也不发请求", async () => {
    bilibili.getBilibiliVideoDetail.mockResolvedValue(detail());

    expect(
      await playBilibiliLink("https://www.bilibili.com/video/BV1xx411c7mD", {
        requirePage: true,
      }),
    ).toBe(false);
    expect(bilibili.getBilibiliVideoDetail).not.toHaveBeenCalled();
    expect(bilibili.VOD).not.toHaveBeenCalled();
  });

  it("不是哔哩哔哩视频链接：不接管", async () => {
    for (const url of [
      "https://music.163.com/song?id=1",
      "https://b23.tv/abcd",
      "陈绮贞",
    ]) {
      expect(await playBilibiliLink(url)).toBe(false);
    }
    expect(bilibili.getBilibiliVideoDetail).not.toHaveBeenCalled();
  });

  it("取详情失败：算已接管（失败提示由平台层弹出），不再退化成搜索", async () => {
    bilibili.getBilibiliVideoDetail.mockResolvedValue(null);

    expect(
      await playBilibiliLink("https://www.bilibili.com/video/BV1xx411c7mD?p=2"),
    ).toBe(true);
    expect(bilibili.VOD).not.toHaveBeenCalled();
  });
});
