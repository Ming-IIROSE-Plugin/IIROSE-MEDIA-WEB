import { beforeEach, describe, expect, it, vi } from "vitest";

// 多 P 选集：`VOD` 与操作条都开插件自有面板（不再有 `buildBiliSelect` 一级菜单、
// 也不再有多选弹窗 + 二次排序确认的 300ms 流转）。矩阵：开面板的条目、单项单播报、
// 多项批量播报、按面板给的顺序播放、全程不碰 `buildSelect2`。
const videoApi = vi.hoisted(() => ({
  getBilibiliVideoData: vi.fn(),
  getBilibiliVideoStream: vi.fn(),
}));
const announce = vi.hoisted(() => ({
  runBatchAnnounce: vi.fn(
    async (
      _title: string,
      _count: number,
      loop: () => Promise<void> | void,
    ) => {
      await loop();
    },
  ),
  runSingleAnnounce: vi.fn(async (loop: () => Promise<void> | void) => {
    await loop();
  }),
  showBatchItemError: vi.fn(),
  sendMediaCard: vi.fn(),
}));
const episodePicker = vi.hoisted(() => ({ openEpisodePicker: vi.fn() }));

vi.mock("../Api/BilibiliAPI/BiliBiliVideoAPI", () => ({
  BiliBiliVideoApi: videoApi,
}));
vi.mock("../iirose_func/Socket/Announce", () => ({ Announce: announce }));
vi.mock(
  "../page/components/episode-picker/openEpisodePicker",
  () => episodePicker,
);

import { IIROSEUtils } from "../iirose_func/IIROSEUtils";
import { BilibiliPlatform } from "./BilibiliPlatform";
import openSource from "./BilibiliPlatform.ts?raw";
import type { EpisodePickEntry } from "../page/components/episode-picker/EpisodePicker";

const pages = [
  { page: 1, part: "开场", duration: 60, cid: 101 },
  { page: 2, part: "中段", duration: 90, cid: 102 },
  { page: 3, part: "结尾", duration: 120, cid: 103 },
];

const video = {
  title: "某多 P 视频",
  author: "某 UP",
  coverImg: "",
  websiteUrl: "https://www.bilibili.com/video/BV1",
  duration: 60,
  bilibili: { bvid: "BV1" },
} as unknown as PlatformData;

type Options = {
  unit: string;
  load: () => Promise<EpisodePickEntry[]>;
  onConfirm: (entries: EpisodePickEntry[]) => void;
};
const lastOptions = () =>
  episodePicker.openEpisodePicker.mock.lastCall?.[0] as Options;

let playBiliPage: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  videoApi.getBilibiliVideoData.mockResolvedValue({
    code: 0,
    data: { pages, desc: "简介", pic: "" },
  });
  playBiliPage = vi
    .spyOn(
      BilibiliPlatform as unknown as Record<string, () => Promise<void>>,
      "playBiliPage",
    )
    .mockResolvedValue(undefined);
});

/** 被播放的分 P 序号（按调用顺序）。 */
/** 批量 / 单曲循环是 `void` 调用：让它在断言前跑完。 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const playedPages = () =>
  playBiliPage.mock.calls.map(
    (call: unknown[]) => (call[1] as { page: number }).page,
  );

describe("多 P 点播开选集面板", () => {
  it("VOD 判定多 P 后直接开面板：条目 = P{n} {part} + 时长，unit 为「集」", async () => {
    // spy 必须在被测代码跑之前建：跑完再 spy 的 `not.toHaveBeenCalled()` 恒真
    const buildSelect2 = vi
      .spyOn(IIROSEUtils, "buildSelect2")
      .mockImplementation(() => {});
    await BilibiliPlatform.VOD(video);

    expect(episodePicker.openEpisodePicker).toHaveBeenCalledOnce();
    const options = lastOptions();
    expect(options.unit).toBe("集");
    expect((await options.load()).map((entry) => entry.title)).toEqual([
      "P1 开场",
      "P2 中段",
      "P3 结尾",
    ]);
    expect((await options.load())[0].duration).toBe(60);
    // 没有宿站选择弹窗，也没有跨弹窗延迟
    expect(buildSelect2).not.toHaveBeenCalled();
  });

  it("面板自己取分 P：只有条目（手机操作条）时 `load` 现取，拿到 desc", async () => {
    BilibiliPlatform.selectEpisodes(video);
    expect((await lastOptions().load()).map((entry) => entry.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(videoApi.getBilibiliVideoData).toHaveBeenCalledWith(null, "BV1");
  });

  it("`load` 取不到分 P 时抛错（面板显示「加载失败」+「重试」）", async () => {
    videoApi.getBilibiliVideoData.mockResolvedValue({
      code: -404,
      data: null,
    });
    BilibiliPlatform.selectEpisodes(video);
    await expect(lastOptions().load()).rejects.toThrow("获取视频信息失败");
  });

  it("只选 1 集：走单曲播报窗口", async () => {
    await BilibiliPlatform.VOD(video);
    const list = await lastOptions().load();
    lastOptions().onConfirm([list[1]]);
    await settle();

    expect(announce.runSingleAnnounce).toHaveBeenCalledOnce();
    expect(announce.runBatchAnnounce).not.toHaveBeenCalled();
    expect(playedPages()).toEqual([2]);
  });

  it("选 ≥2 集：批量播报 count = 所选数，按面板给的顺序播放", async () => {
    await BilibiliPlatform.VOD(video);
    const list = await lastOptions().load();
    // 点选顺序 3 → 1（不是列表顺序）
    lastOptions().onConfirm([list[2], list[0]]);
    await settle();

    expect(announce.runBatchAnnounce).toHaveBeenCalledWith(
      "某多 P 视频",
      2,
      expect.any(Function),
      "简介",
    );
    expect(playedPages()).toEqual([3, 1]);
    expect(announce.runSingleAnnounce).not.toHaveBeenCalled();
  });

  it("单项失败带分 P 名提示后跳过，其余照播", async () => {
    await BilibiliPlatform.VOD(video);
    playBiliPage.mockImplementation(
      async (_pd: PlatformData, item: unknown) => {
        if ((item as { page: number }).page === 1) throw new Error("解析失败");
      },
    );
    const list = await lastOptions().load();
    lastOptions().onConfirm([list[0], list[1]]);
    await settle();

    expect(announce.showBatchItemError).toHaveBeenCalledWith(
      expect.any(Error),
      "P1 开场",
    );
    expect(playedPages()).toEqual([1, 2]);
  });

  it("单集视频仍直接点播，不开面板", async () => {
    videoApi.getBilibiliVideoData.mockResolvedValue({
      code: 0,
      data: { pages: [pages[0]], desc: "" },
    });
    await BilibiliPlatform.VOD(video);
    expect(episodePicker.openEpisodePicker).not.toHaveBeenCalled();
    expect(playedPages()).toEqual([1]);
  });
});

describe("宿站选择器的存量已删除", () => {
  it("平台源码里没有 buildSelect2 / 跨弹窗 setTimeout(300)", () => {
    expect(openSource).not.toMatch(/buildSelect2/);
    expect(openSource).not.toMatch(/buildBiliSelect/);
    expect(openSource).not.toMatch(/buildOrderConfirmSelect/);
    expect(openSource).not.toMatch(/setTimeout\([^)]*,\s*300\s*\)/);
    expect(openSource).not.toMatch(/IIROSEUtils/);
  });
});
