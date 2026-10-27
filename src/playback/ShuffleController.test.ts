import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaSnapshot } from "../media-progress/model";
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import { snapshot } from "./fixtures";
import { resetPanelFocus, setPanelFocus } from "./PanelFocus";
import { PlaybackMode } from "./PlaybackMode";
import { SHUFFLE_REASONS, ShuffleController } from "./ShuffleController";
import type { ShufflePrepareOptions, ShuffleTarget } from "./ShuffleController";
import { saveShufflePlatform } from "./ShuffleSelection";
import type { ShufflePlatform, ShuffleSelection } from "./ShuffleSelection";

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
  bilibili: FavoriteRecord[] = [],
) {
  let clock = 1_000_000;
  const play = vi.fn();
  const query = vi.fn(async (platform: ShufflePlatform) =>
    platform === "bilibili" ? bilibili : records,
  );
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
  const favoriteListeners = new Set<() => void>();
  const onFavoritesChange = vi.fn((listener: () => void) => {
    favoriteListeners.add(listener);
    return () => favoriteListeners.delete(listener);
  });
  const emitFavorites = () => {
    for (const listener of favoriteListeners) listener();
  };
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
    { query, prepare, loadSelection, onFavoritesChange, now: () => clock },
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
    emitFavorites,
    favoriteListeners,
  };
}

function setDefaultPage(defaultPage: number) {
  localStorage.setItem(
    "imwPluginSetting",
    JSON.stringify({
      chatBox: { isProxyAtInput: true },
      defaultPage,
      searchViewMode: "card",
      announceMode: "card",
      sync: {},
    }),
  );
}

beforeEach(() => {
  setDefaultPage(0);
});

afterEach(() => {
  resetPanelFocus();
  localStorage.clear();
});

describe("收藏随机控制器", () => {
  it("有收藏时可用，可用性查询覆盖全部收藏平台", async () => {
    const { mode, push, query } = setup();
    push();
    await settle();
    push();
    expect(mode.state.shuffle).toEqual({ enabled: true, reason: "" });
    expect(query).toHaveBeenCalledWith("netease");
    expect(query).toHaveBeenCalledWith("bilibili");
  });

  it("与主面板焦点无关：焦点停在无线电页仍可用", async () => {
    setPanelFocus({ category: 2, platform: 0 });
    const { mode, push } = setup();
    push();
    await settle();
    push();
    expect(mode.state.shuffle).toEqual({ enabled: true, reason: "" });
  });

  it("只有另一平台有收藏也可用", async () => {
    const { mode, push } = setup([], fakeCut(), [
      record("视频", { id: "bilibili:video:BV1", platform: "bilibili" }),
    ]);
    push();
    await settle();
    push();
    expect(mode.state.shuffle).toEqual({ enabled: true, reason: "" });
  });

  it("收藏变更后刷新可用性：从空到有收藏即可用，卸载后退订", async () => {
    const records: FavoriteRecord[] = [];
    const ctx = setup(records);
    ctx.push();
    await settle();
    ctx.push();
    expect(ctx.mode.state.shuffle).toEqual({
      enabled: false,
      reason: SHUFFLE_REASONS.empty,
    });
    records.push(record("甲"));
    ctx.emitFavorites();
    await settle();
    expect(ctx.mode.state.shuffle).toEqual({ enabled: true, reason: "" });
    records.length = 0;
    ctx.emitFavorites();
    await settle();
    expect(ctx.mode.state.shuffle.enabled).toBe(false);
    ctx.controller.dispose();
    expect(ctx.favoriteListeners.size).toBe(0);
  });

  it("全部平台都没有收藏时不可用", async () => {
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
      // 上一首放完停下后，10 秒内仍未回读到新曲目才算一次失败。
      push({ playing: false, current: 200 });
      await settle();
      advance(10_001);
      push({ playing: false, current: 200 });
      await settle();
    }
    expect(mode.mode).toBe("none");
    expect(mode.state.cleared?.reason).toBe(SHUFFLE_REASONS.gaveUp);
  });

  it("剩余 5 秒发出后旧歌仍在播：不判失败、不补发第二首", async () => {
    const { mode, play, push, light, advance } = setup();
    push();
    await settle();
    push();
    light();
    push({ current: 196 });
    await settle();
    expect(play).toHaveBeenCalledTimes(1);
    // 旧歌继续播到结尾，期间时间流逝超过回读等待。
    for (let second = 197; second <= 200; second++) {
      advance(3000);
      push({ current: second });
      await settle();
    }
    expect(play).toHaveBeenCalledTimes(1);
    // 宿站切到新曲目：回读成功。
    push({ current: 1, title: "乙" });
    await settle();
    expect(play).toHaveBeenCalledTimes(1);
    expect(mode.mode).toBe("shuffle");
  });

  it("旧歌停下后 10 秒内回读到新曲目即成功，不补发", async () => {
    const { play, push, light, advance } = setup();
    push();
    await settle();
    push();
    light();
    push({ current: 196 });
    await settle();
    push({ playing: false, current: 200 });
    advance(9_000);
    push({ playing: false, current: 200 });
    await settle();
    push({ current: 1, title: "乙" });
    await settle();
    expect(play).toHaveBeenCalledTimes(1);
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

describe("随机平台", () => {
  const idle = { playing: false, current: null, duration: null } as const;
  const video = (title: string) =>
    record(title, {
      id: `bilibili:video:${title}`,
      platform: "bilibili",
      type: "video",
    });

  async function litWith(bilibili: FavoriteRecord[]) {
    const ctx = setup([record("甲"), record("乙")], fakeCut(), bilibili);
    ctx.push();
    await settle();
    ctx.push();
    ctx.light();
    return ctx;
  }

  it("无记录按 defaultPage：0 → 网易云", async () => {
    const ctx = await litWith([video("视频")]);
    ctx.push(idle);
    await settle();
    expect(ctx.prepare.mock.lastCall?.[0].platform).toBe("netease");
  });

  it("无记录按 defaultPage：1 → B站", async () => {
    setDefaultPage(1);
    const ctx = await litWith([video("视频")]);
    ctx.push(idle);
    await settle();
    expect(ctx.prepare.mock.lastCall?.[0].platform).toBe("bilibili");
  });

  it("defaultPage 非 0/1 → 网易云", async () => {
    setDefaultPage(3);
    const ctx = await litWith([video("视频")]);
    ctx.push(idle);
    await settle();
    expect(ctx.prepare.mock.lastCall?.[0].platform).toBe("netease");
  });

  it("已存随机平台优先于 defaultPage", async () => {
    saveShufflePlatform("bilibili");
    const ctx = await litWith([video("视频")]);
    ctx.push(idle);
    await settle();
    expect(ctx.play).toHaveBeenCalledTimes(1);
    expect(ctx.prepare.mock.lastCall?.[0].title).toBe("视频");
  });

  it("随机平台记录损坏：按 defaultPage，不抛错", async () => {
    setDefaultPage(1);
    // 未登录时账号键为 unknown。
    localStorage.setItem("imwShufflePlatform:unknown", "{坏数据");
    const ctx = await litWith([video("视频")]);
    ctx.push(idle);
    await settle();
    expect(ctx.prepare.mock.lastCall?.[0].platform).toBe("bilibili");
  });

  it("点亮后主面板换页：不熄灭，仍在原平台抽取", async () => {
    saveShufflePlatform("bilibili");
    const ctx = await litWith([video("视频")]);
    setPanelFocus({ category: 0, platform: 0 });
    ctx.push({ current: 100 });
    setPanelFocus({ category: 2, platform: 0 });
    ctx.push({ current: 196 });
    await settle();
    expect(ctx.mode.mode).toBe("shuffle");
    expect(ctx.play).toHaveBeenCalledTimes(1);
    expect(ctx.prepare.mock.lastCall?.[0].platform).toBe("bilibili");
  });

  it("随机平台没有收藏而另一平台有：点亮后抽取时熄灭并报范围为空", async () => {
    saveShufflePlatform("bilibili");
    const ctx = await litWith([]);
    expect(ctx.mode.mode).toBe("shuffle");
    ctx.push(idle);
    await settle();
    expect(ctx.play).not.toHaveBeenCalled();
    expect(ctx.mode.mode).toBe("none");
    expect(ctx.mode.state.cleared?.reason).toBe(SHUFFLE_REASONS.emptySelection);
  });
});
