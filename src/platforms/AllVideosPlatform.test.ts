import { beforeEach, describe, expect, it, vi } from "vitest";

// 多源剧集：多集开插件自有选集面板（不再有「正序点播」宿站菜单），
// 单项单播报、多项批量播报、按面板给的顺序播放、保留 150ms 呼吸与逐项失败提示。
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
const meta = vi.hoisted(() => ({
  getM3U8Duration: vi.fn(async (_url?: string) => 123),
}));
const socket = vi.hoisted(() => ({ send: vi.fn(), sendMessage: vi.fn() }));

vi.mock("../iirose_func/Socket/Announce", () => ({ Announce: announce }));
vi.mock(
  "../page/components/episode-picker/openEpisodePicker",
  () => episodePicker,
);
vi.mock("../tools/parseMediaMetaData", () => ({ ParseMediaMetaData: meta }));
vi.mock("../iirose_func/Socket", () => ({ Socket: vi.fn(() => socket) }));

import { IIROSEUtils } from "../iirose_func/IIROSEUtils";
import { AllVideosPlatform } from "./AllVideosPlatform";
import allVideosSource from "./AllVideosPlatform.ts?raw";
import type { EpisodePickEntry } from "../page/components/episode-picker/EpisodePicker";

const playList = [
  { episode: "第01集", url: "https://cdn.example.com/1.m3u8" },
  { episode: "第02集", url: "https://cdn.example.com/2.m3u8" },
  { episode: "第03集", url: "https://cdn.example.com/3.m3u8" },
];

const drama = {
  title: "某剧",
  subtitle: "剧情简介",
  coverImg: "",
  author: "",
  websiteUrl: "https://example.com/vod/1",
  playList,
} as unknown as PlatformData;

type Options = {
  unit: string;
  load: () => Promise<EpisodePickEntry[]>;
  onConfirm: (entries: EpisodePickEntry[]) => void;
};
const lastOptions = () =>
  episodePicker.openEpisodePicker.mock.lastCall?.[0] as Options;

let sendVideoMedia: ReturnType<typeof vi.spyOn>;

/** 已发出的媒体 url（按播放顺序）。 */
const playedUrls = () =>
  sendVideoMedia.mock.calls.map((call: unknown[]) => call[1] as string);

beforeEach(() => {
  vi.clearAllMocks();
  sendVideoMedia = vi
    .spyOn(
      AllVideosPlatform as unknown as Record<
        string,
        (...args: unknown[]) => Promise<void>
      >,
      "sendVideoMedia",
    )
    .mockResolvedValue(undefined);
  meta.getM3U8Duration.mockResolvedValue(123);
});

describe("多集开选集面板", () => {
  it("多集直接开面板：条目 = playList 的集名，unit 为「集」", async () => {
    await AllVideosPlatform.VOD(drama);

    expect(episodePicker.openEpisodePicker).toHaveBeenCalledOnce();
    const options = lastOptions();
    expect(options.unit).toBe("集");
    expect((await options.load()).map((entry) => entry.title)).toEqual([
      "第01集",
      "第02集",
      "第03集",
    ]);
  });

  it("只有条目（手机操作条）时 `load` 现取 playList", async () => {
    AllVideosPlatform.selectEpisodes(drama);
    expect(await lastOptions().load()).toHaveLength(3);
  });

  it("单集仍直接点播，不开面板", async () => {
    await AllVideosPlatform.VOD({
      ...drama,
      playList: [playList[0]],
    } as PlatformData);
    expect(episodePicker.openEpisodePicker).not.toHaveBeenCalled();
    expect(announce.runSingleAnnounce).toHaveBeenCalledOnce();
    expect(playedUrls()).toEqual([playList[0].url]);
  });

  it("只选 1 集：单曲播报窗口，副行用集名", async () => {
    await AllVideosPlatform.VOD(drama);
    const list = await lastOptions().load();
    lastOptions().onConfirm([list[1]]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(announce.runSingleAnnounce).toHaveBeenCalledOnce();
    expect(announce.runBatchAnnounce).not.toHaveBeenCalled();
    expect(playedUrls()).toEqual([playList[1].url]);
    expect(sendVideoMedia.mock.calls[0][0]).toMatchObject({
      author: "第02集",
    });
  });

  it("选 ≥2 集：批量播报 count = 所选数，按面板给的顺序播放", async () => {
    await AllVideosPlatform.VOD(drama);
    const list = await lastOptions().load();
    // 点选顺序 3 → 1
    lastOptions().onConfirm([list[2], list[0]]);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(announce.runBatchAnnounce).toHaveBeenCalledWith(
      "某剧",
      2,
      expect.any(Function),
    );
    expect(playedUrls()).toEqual([playList[2].url, playList[0].url]);
    expect(meta.getM3U8Duration).toHaveBeenCalledTimes(2);
  });

  it("单项失败带集名提示后跳过，其余照播", async () => {
    await AllVideosPlatform.VOD(drama);
    meta.getM3U8Duration.mockImplementation(async (url?: string) => {
      if (url === playList[0].url) throw new Error("探流失败");
      return 123;
    });
    const list = await lastOptions().load();
    lastOptions().onConfirm([list[0], list[1]]);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(announce.showBatchItemError).toHaveBeenCalledWith(
      expect.any(Error),
      "第01集",
    );
    expect(playedUrls()).toEqual([playList[1].url]);
  });

  it("PENDING 的资源详情照旧提示、不开面板、不抛错", async () => {
    const pending = {
      ...drama,
      playList: new Promise<PlayItem[]>(() => {}),
    } as unknown as PlatformData;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await AllVideosPlatform.VOD(pending);
    expect(warn).toHaveBeenCalled();
    expect(episodePicker.openEpisodePicker).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("宿站选择器的存量已删除", () => {
  it("平台源码里没有 buildSelect2 / 「正序点播」菜单 / 跨弹窗延迟", () => {
    expect(allVideosSource).not.toMatch(/buildSelect2/);
    expect(allVideosSource).not.toMatch(/buildVideoSelect/);
    expect(allVideosSource).not.toMatch(/正序点播/);
    expect(allVideosSource).not.toMatch(/setTimeout\([^)]*,\s*300\s*\)/);
    expect(allVideosSource).not.toMatch(/IIROSEUtils/);
    expect(
      vi.spyOn(IIROSEUtils, "buildSelect2").mockImplementation(() => {}),
    ).not.toHaveBeenCalled();
  });
});
