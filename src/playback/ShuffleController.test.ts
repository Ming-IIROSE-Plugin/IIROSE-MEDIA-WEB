import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaSnapshot } from "../media-progress/model";
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import { snapshot } from "./fixtures";
import { resetPanelFocus, setPanelFocus } from "./PanelFocus";
import { PlaybackMode } from "./PlaybackMode";
import { SHUFFLE_REASONS, ShuffleController } from "./ShuffleController";
import type { ShuffleTarget } from "./ShuffleController";

const settle = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};

function record(
  title: string,
  patch: Partial<FavoriteRecord> = {},
): FavoriteRecord {
  return {
    id: `netease:song:${title}`,
    platform: "netease",
    type: "song",
    title,
    coverImg: "",
    author: "歌手",
    websiteUrl: "",
    createdAt: 1,
    updatedAt: 1,
    platformData: { title, coverImg: "", author: "歌手", websiteUrl: "" },
    ...patch,
  };
}

function fakeCut(active = false) {
  let recent = active;
  return {
    tick: vi.fn(),
    recent: () => recent,
    consume: vi.fn(() => {
      recent = false;
    }),
    activate: () => {
      recent = true;
    },
  };
}

function setup(
  records: FavoriteRecord[] = [record("甲"), record("乙")],
  cut = fakeCut(),
) {
  let clock = 1_000_000;
  const play = vi.fn();
  const query = vi.fn(async () => records);
  const prepare = vi.fn(
    async (item: FavoriteRecord): Promise<ShuffleTarget | null> => ({
      title: item.title,
      play,
    }),
  );
  const mode = new PlaybackMode();
  mode.setMediaPresent(true);
  let listener: ((value: MediaSnapshot) => void) | null = null;
  const controller = new ShuffleController(
    mode,
    {
      subscribe(next) {
        listener = next;
        return () => {
          listener = null;
        };
      },
    },
    { query, prepare, now: () => clock },
    cut as unknown as never,
  );
  controller.attach();
  const push = (patch: Partial<MediaSnapshot> = {}) => {
    const value = snapshot(patch);
    mode.applySnapshot(value);
    listener?.(value);
    return value;
  };
  const light = () => mode.toggle("shuffle");
  const advance = (ms: number) => {
    clock += ms;
  };
  return { mode, play, query, prepare, push, light, advance, controller, cut };
}

beforeEach(() => {
  setPanelFocus({ category: 0, platform: 0 });
  localStorage.setItem(
    "imwPluginSetting",
    JSON.stringify({
      chatBox: { isProxyAtInput: true },
      defaultPage: 0,
      searchViewMode: "card",
      announceMode: "card",
      shuffleIncludeCollections: true,
      sync: {},
    }),
  );
});

afterEach(() => {
  resetPanelFocus();
  localStorage.clear();
});

describe("收藏随机控制器", () => {
  it("焦点平台有收藏时可用，且按设置请求候选", async () => {
    const { mode, push, query } = setup();
    push();
    await settle();
    push();
    expect(mode.state.shuffle).toEqual({ enabled: true, reason: "" });
    expect(query).toHaveBeenCalledWith("netease", true);
  });

  it("焦点页面没有收藏时不可用并给出原因", async () => {
    setPanelFocus({ category: 0, platform: 1 });
    const { mode, push } = setup();
    push();
    await settle();
    expect(mode.state.shuffle.enabled).toBe(false);
    expect(mode.state.shuffle.reason).toBe(SHUFFLE_REASONS.noFavorites);
  });

  it("收藏为空时不可用", async () => {
    const { mode, push } = setup([]);
    push();
    await settle();
    push();
    expect(mode.state.shuffle).toEqual({
      enabled: false,
      reason: SHUFFLE_REASONS.empty,
    });
  });

  it("剩余 20 秒预取、5 秒发送，同一轮不重复当前曲目", async () => {
    const { play, push, light, prepare } = setup();
    push();
    await settle();
    push();
    light();
    push({ current: 182 });
    await settle();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();
    push({ current: 196 });
    await settle();
    expect(play).toHaveBeenCalledTimes(1);
    const picked = prepare.mock.calls[0][0] as FavoriteRecord;
    expect(picked.title).not.toBe("测试曲目");
  });

  it("发送成功后回读换曲即重置失败计数", async () => {
    const { mode, play, push, light } = setup();
    push();
    await settle();
    push();
    light();
    push({ current: 196 });
    await settle();
    expect(play).toHaveBeenCalledTimes(1);
    push({ current: 2, title: "乙" });
    expect(mode.mode).toBe("shuffle");
  });

  it("连续 5 次无回读即熄灭并提示", async () => {
    const { mode, push, light, advance } = setup();
    push();
    await settle();
    push();
    light();
    for (let round = 0; round < 5; round++) {
      push({ current: 196 });
      await settle();
      advance(5001);
      push({ current: 196 });
      await settle();
    }
    expect(mode.mode).toBe("none");
    expect(mode.state.cleared?.reason).toBe(SHUFFLE_REASONS.gaveUp);
  });

  it("他人点播待命时零动作", async () => {
    const { play, prepare, push, light } = setup();
    push();
    await settle();
    push();
    light();
    push({ current: 196, ownMedia: false });
    await settle();
    expect(prepare).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it("暂停或时长未知不触发", async () => {
    const { play, push, light } = setup();
    push();
    await settle();
    push();
    light();
    push({ current: 196, playing: false });
    push({ current: 196, duration: null });
    await settle();
    expect(play).not.toHaveBeenCalled();
  });

  it("关闭专辑/歌单后按设置重新取候选", async () => {
    const { mode, push, query } = setup();
    push();
    await settle();
    push();
    const settings = JSON.parse(
      localStorage.getItem("imwPluginSetting") as string,
    );
    settings.shuffleIncludeCollections = false;
    localStorage.setItem("imwPluginSetting", JSON.stringify(settings));
    push();
    await settle();
    expect(query).toHaveBeenLastCalledWith("netease", false);
    expect(mode.state.shuffle.enabled).toBe(true);
  });

  it("随机熄灭后不再发送", async () => {
    const { mode, play, push, light } = setup();
    push();
    await settle();
    push();
    light();
    light();
    push({ current: 196 });
    await settle();
    expect(play).not.toHaveBeenCalled();
    expect(mode.mode).toBe("none");
  });

  it("点亮期间收藏被删空：可用性转不可用并熄灭", async () => {
    const records = [record("甲"), record("乙")];
    const { mode, push, light } = setup(records);
    push();
    await settle();
    push();
    light();
    expect(mode.mode).toBe("shuffle");
    records.length = 0;
    // 切换设置强制重新取候选，模拟收藏被清空。
    const settings = JSON.parse(
      localStorage.getItem("imwPluginSetting") as string,
    );
    settings.shuffleIncludeCollections = false;
    localStorage.setItem("imwPluginSetting", JSON.stringify(settings));
    push();
    await settle();
    push();
    expect(mode.mode).toBe("none");
    expect(mode.state.shuffle.reason).toBe(SHUFFLE_REASONS.empty);
  });

  it("没在播时开启随机也会立即点播一首，且只发一次", async () => {
    const { mode, play, prepare, push, light } = setup();
    push();
    await settle();
    push();
    mode.toggle("shuffle");
    expect(mode.mode).toBe("shuffle");
    // 空闲态：没有播放、没有时长
    push({ playing: false, current: null, duration: null });
    await settle();
    expect(prepare).toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(1);
    push({ playing: false, current: null, duration: null });
    await settle();
    expect(prepare).toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("空闲起播后换曲即视为成功，继续接力", async () => {
    const { mode, push, light } = setup();
    push();
    await settle();
    push();
    light();
    push({ playing: false, current: null, duration: null });
    await settle();
    push({ playing: true, current: 3, duration: 200, title: "甲" });
    expect(mode.mode).toBe("shuffle");
    expect(mode.state.cleared).toBeNull();
  });

  it("自己 cut 后接着放下一首", async () => {
    const { mode, play, push, light, cut } = setup();
    push();
    await settle();
    push();
    light();
    cut.activate();
    push({ playing: false, current: -1, duration: 200, title: "测试曲目" });
    await settle();
    expect(cut.consume).toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(1);
    expect(mode.mode).toBe("shuffle");
  });

  it("他人点播被 cut 时不接管", async () => {
    const { mode, play, push, cut } = setup();
    push({ ownMedia: false });
    await settle();
    push({ ownMedia: false });
    mode.toggle("shuffle");
    cut.activate();
    push({
      playing: false,
      current: -1,
      duration: 200,
      ownMedia: false,
      title: "测试曲目",
    });
    await settle();
    expect(play).not.toHaveBeenCalled();
  });
});
