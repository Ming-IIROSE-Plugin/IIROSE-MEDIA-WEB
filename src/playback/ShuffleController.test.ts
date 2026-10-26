import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaSnapshot } from "../media-progress/model";
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import { snapshot } from "./fixtures";
import { resetPanelFocus, setPanelFocus } from "./PanelFocus";
import { PlaybackMode } from "./PlaybackMode";
import { SHUFFLE_REASONS, ShuffleController } from "./ShuffleController";
import type { ShufflePrepareOptions, ShuffleTarget } from "./ShuffleController";
import type { ShuffleSelection } from "./ShuffleSelection";

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
  let selection: ShuffleSelection | null = null;
  const loadSelection = vi.fn(() => selection);
  const select = (next: ShuffleSelection | null) => {
    selection = next;
  };
  const prepare = vi.fn(
    async (
      item: FavoriteRecord,
      _options: ShufflePrepareOptions,
    ): Promise<ShuffleTarget | "exhausted" | null> => ({
      key: item.id,
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
    { query, prepare, loadSelection, now: () => clock },
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
  return {
    mode,
    play,
    query,
    prepare,
    push,
    light,
    advance,
    controller,
    cut,
    select,
  };
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
      sync: {},
    }),
  );
});

afterEach(() => {
  resetPanelFocus();
  localStorage.clear();
});

describe("收藏随机控制器", () => {
  it("焦点平台有收藏时可用，且按焦点平台请求候选", async () => {
    const { mode, push, query } = setup();
    push();
    await settle();
    push();
    expect(mode.state.shuffle).toEqual({ enabled: true, reason: "" });
    expect(query).toHaveBeenCalledWith("netease");
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
    const { mode, push, light, controller } = setup(records);
    push();
    await settle();
    push();
    light();
    expect(mode.mode).toBe("shuffle");
    records.length = 0;
    // 选择确认后的刷新会重新取候选，借它模拟收藏被清空。
    controller.invalidate();
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

describe("收藏随机的选择范围", () => {
  const idle = { playing: false, current: null, duration: null } as const;
  const playlistRecord = (title: string) =>
    record(title, { id: `netease:playlist:${title}`, type: "playlist" });

  async function lit(
    records: FavoriteRecord[],
    selection: ShuffleSelection | null,
  ) {
    const ctx = setup(records);
    ctx.select(selection);
    ctx.push();
    await settle();
    ctx.push();
    ctx.light();
    return ctx;
  }

  it("只在选择范围内抽取，部分勾选的曲目随 prepare 传入", async () => {
    const { prepare, push, play } = await lit(
      [record("甲"), record("乙"), playlistRecord("单")],
      {
        weight: "entry",
        items: [{ id: "netease:playlist:单", tracks: ["1", "2", "3"] }],
      },
    );
    push(idle);
    await settle();
    expect(play).toHaveBeenCalledTimes(1);
    const [picked, options] = prepare.mock.calls[0];
    expect(picked.title).toBe("单");
    expect(options.tracks).toEqual(["1", "2", "3"]);
  });

  it("选择里的收藏全被删除：熄灭并提示范围为空", async () => {
    const { mode, push, play } = await lit([record("甲")], {
      weight: "entry",
      items: [{ id: "netease:song:已删除" }],
    });
    push(idle);
    await settle();
    expect(play).not.toHaveBeenCalled();
    expect(mode.mode).toBe("none");
    expect(mode.state.cleared?.reason).toBe(SHUFFLE_REASONS.emptySelection);
  });

  it("整单本轮耗尽改抽其他条目，不计入失败", async () => {
    const ctx = await lit([playlistRecord("单"), record("甲")], null);
    ctx.prepare.mockImplementation(async (item) =>
      item.type === "playlist"
        ? "exhausted"
        : { key: item.id, title: item.title, play: ctx.play },
    );
    ctx.push(idle);
    await settle();
    expect(ctx.play).toHaveBeenCalledTimes(1);
    expect(ctx.mode.mode).toBe("shuffle");
  });

  it("范围内全部无可播曲目：重开一轮仍耗尽即熄灭，不空转", async () => {
    const ctx = await lit([playlistRecord("单")], null);
    ctx.prepare.mockResolvedValue("exhausted");
    ctx.push(idle);
    await settle();
    expect(ctx.play).not.toHaveBeenCalled();
    expect(ctx.prepare.mock.calls.length).toBeLessThanOrEqual(2);
    expect(ctx.mode.mode).toBe("none");
    expect(ctx.mode.state.cleared?.reason).toBe(SHUFFLE_REASONS.emptySelection);
  });

  it("已播歌曲身份传给 prepare，用于歌单内去重", async () => {
    const ctx = await lit([playlistRecord("单")], null);
    ctx.prepare.mockImplementation(async () => ({
      key: "netease:song:42",
      title: "四十二",
      play: ctx.play,
    }));
    ctx.push(idle);
    await settle();
    ctx.push({ playing: true, current: 3, duration: 200, title: "四十二" });
    ctx.push({ current: 196, title: "四十二" });
    await settle();
    const exclude = ctx.prepare.mock.calls[1]?.[1].exclude;
    expect(exclude && [...exclude]).toContain("netease:song:42");
  });

  it("invalidate 丢弃已预取的目标，按新选择重新取", async () => {
    const ctx = await lit([record("甲"), record("乙")], null);
    ctx.push({ current: 182 });
    await settle();
    expect(ctx.prepare).toHaveBeenCalledTimes(1);
    ctx.select({ weight: "entry", items: [{ id: "netease:song:乙" }] });
    ctx.controller.invalidate();
    ctx.push({ current: 196 });
    await settle();
    expect(ctx.play).toHaveBeenCalledTimes(1);
    expect(ctx.prepare.mock.lastCall?.[0].title).toBe("乙");
  });

  it("单个歌单反复解析失败：按 5 次上限放弃，而不是报范围为空", async () => {
    const ctx = await lit([playlistRecord("单")], null);
    ctx.prepare.mockResolvedValue(null);
    ctx.push(idle);
    await settle();
    await settle();
    expect(ctx.prepare).toHaveBeenCalledTimes(5);
    expect(ctx.mode.state.cleared?.reason).toBe(SHUFFLE_REASONS.gaveUp);
  });

  it("重开一轮时刚播的歌单曲目仍被排除，不连续重复", async () => {
    const ctx = await lit([playlistRecord("单")], {
      weight: "entry",
      items: [{ id: "netease:playlist:单", tracks: ["3"] }],
    });
    // 与真实 prepare 一致：3 已在排除集合里就耗尽，否则选 3。
    ctx.prepare.mockImplementation(async (_item, options) =>
      options.exclude.has("netease:song:3")
        ? "exhausted"
        : { key: "netease:song:3", title: "三", play: ctx.play },
    );
    ctx.push(idle);
    await settle();
    expect(ctx.play).toHaveBeenCalledTimes(1);
    ctx.push({ playing: true, current: 3, duration: 200, title: "三" });
    ctx.push({ current: 196, title: "三" });
    await settle();
    // 范围里只有正在播的这一首：不重复点播，也不误报范围为空。
    expect(ctx.play).toHaveBeenCalledTimes(1);
    expect(ctx.mode.mode).toBe("shuffle");
  });

  it("预取进行中 invalidate：旧选择的目标作废，不会被播放", async () => {
    const ctx = await lit([record("甲"), record("乙")], null);
    let release: (value: ShuffleTarget) => void = () => {};
    const stalePlay = vi.fn();
    ctx.prepare.mockImplementationOnce(
      () =>
        new Promise<ShuffleTarget>((resolve) => {
          release = resolve;
        }),
    );
    ctx.push({ current: 182 });
    await settle();
    ctx.controller.invalidate();
    release({ key: "netease:song:甲", title: "甲", play: stalePlay });
    await settle();
    ctx.select({ weight: "entry", items: [{ id: "netease:song:乙" }] });
    ctx.push({ current: 196 });
    await settle();
    expect(stalePlay).not.toHaveBeenCalled();
    expect(ctx.play).toHaveBeenCalledTimes(1);
    expect(ctx.prepare.mock.lastCall?.[0].title).toBe("乙");
  });
});
