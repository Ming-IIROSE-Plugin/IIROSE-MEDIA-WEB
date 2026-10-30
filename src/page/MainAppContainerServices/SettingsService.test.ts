import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "./SettingsService";
import { AboutService } from "./AboutService";
import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";

// 设置数据契约（story 7）：范围 → 组卡 → 行三级结构、行语义（kind）、
// 云同步开关的 checked 只来自 SyncManager.getState().enabled、关于卡外链无 emoji。

type Ctx = Parameters<typeof SettingsService.showBilibili>[0];

const ctxOf = () => {
  const setState = vi.fn();
  return { ctx: { setState } as unknown as Ctx, setState };
};

const groupsOf = (setState: ReturnType<typeof vi.fn>): SettingGroupData[] =>
  setState.mock.lastCall?.[0]?.settingsData as SettingGroupData[];

const groupTitles = (groups: SettingGroupData[]) => groups.map((g) => g.title);

const rowOf = (groups: SettingGroupData[], key: string): SettingData => {
  const found = groups
    .flatMap((group) => group.items)
    .find((item) => item.key === key);
  if (!found) throw new Error(`没有这一行：${key}`);
  return found;
};

/** 只开云同步（不碰密钥缓存）：`getState().enabled` 直接反映这个设置。 */
const seedSyncSettings = (
  enabled: boolean,
  lastSyncAt: number | null = null,
) => {
  localStorage.setItem(
    "imwPluginSetting",
    JSON.stringify({
      chatBox: { isProxyAtInput: true },
      defaultPage: 0,
      searchViewMode: "card",
      announceMode: "card",
      sync: { enabled, lastSyncAt },
    }),
  );
};

const showPlugin = async () => {
  const { ctx, setState } = ctxOf();
  await SettingsService.showPluginSettings(
    ctx,
    () => {},
    async () => {},
  );
  return { groups: groupsOf(setState), setState, ctx };
};

afterEach(() => {
  SettingsService.release();
  localStorage.clear();
});

describe("设置范围的分组标题", () => {
  it("哔哩哔哩视频：「账号」+「视频设置」两张组卡", () => {
    const { ctx, setState } = ctxOf();
    SettingsService.showBilibili(ctx);
    const groups = groupsOf(setState);
    expect(groupTitles(groups)).toEqual(["账号", "视频设置"]);
    expect(groups[1].items.map((item) => item.key)).toEqual([
      "bilibiliVideoQn",
      "bilibiliLiveQn",
      "bilibiliStreamSeconds",
      "bilibiliVideoStreamFormat",
      "bilibiliDefaultApi",
    ]);
    // 取值类：行末是当前值 + chev（渲染层按 kind 加），语义在数据里
    expect(rowOf(groups, "bilibiliVideoQn").kind).toBe("value");
    expect(rowOf(groups, "bilibiliVideoQn").actionTitle).toBeTruthy();
    expect(rowOf(groups, "bilibiliAccount").kind).toBe("value");
  });

  it("网易云音乐与无线电广播各一张组卡", () => {
    const neteaseCtx = ctxOf();
    SettingsService.showNetEaseMusic(neteaseCtx.ctx);
    expect(groupTitles(groupsOf(neteaseCtx.setState))).toEqual(["音乐设置"]);

    const radioCtx = ctxOf();
    SettingsService.showRadio(radioCtx.ctx);
    const radioGroups = groupsOf(radioCtx.setState);
    expect(groupTitles(radioGroups)).toEqual(["无线电设置"]);
    expect(rowOf(radioGroups, "radioDuration").icon).toBe("radio");
  });

  it("插件设置：「聊天框」+「云端同步」两张组卡，既有设置项一项不少", async () => {
    const { groups } = await showPlugin();
    expect(groupTitles(groups)).toEqual(["聊天框", "云端同步"]);
    const chatKeys = groups[0].items.map((item) => item.key);
    expect(chatKeys).toEqual([
      "defaultPage",
      "searchViewMode",
      "announceMode",
      "proxyAtInput",
    ]);
    const syncKeys = groups[1].items.map((item) => item.key);
    expect(syncKeys).toEqual([
      "syncEnabled",
      "syncPassphrase",
      "syncLastSyncAt",
      "syncNow",
      "syncClearCloud",
      "syncForgetKey",
    ]);

    // 行语义没在渲染层猜：代理@输入是开关，取值类各自有 kind
    expect(rowOf(groups, "proxyAtInput").kind).toBe("switch");
    expect(rowOf(groups, "proxyAtInput").checked).toBe(true);
    expect(rowOf(groups, "defaultPage").kind).toBe("value");
    expect(rowOf(groups, "searchViewMode").kind).toBe("value");
    expect(rowOf(groups, "announceMode").kind).toBe("value");
    expect(rowOf(groups, "syncNow").kind).toBe("action");
    expect(rowOf(groups, "syncClearCloud").kind).toBe("action");
    expect(rowOf(groups, "syncForgetKey").kind).toBe("action");
    expect(rowOf(groups, "syncLastSyncAt").kind).toBe("readonly");
  });
  it("四个范围的组名都非空：空串是结果区「关于卡」的判别位", async () => {
    const titles: string[] = [];
    const collect = (show: (ctx: Ctx) => void) => {
      const { ctx, setState } = ctxOf();
      show(ctx);
      titles.push(...groupTitles(groupsOf(setState)));
    };
    collect((ctx) => SettingsService.showBilibili(ctx));
    collect((ctx) => SettingsService.showNetEaseMusic(ctx));
    collect((ctx) => SettingsService.showRadio(ctx));
    titles.push(...groupTitles((await showPlugin()).groups));

    expect(titles.length).toBeGreaterThan(4);
    for (const title of titles) expect(title).not.toBe("");
  });
});

describe("代理蔷薇@输入开关", () => {
  it("点整行翻转并落盘，回报新值（开关状态单一来源）", async () => {
    localStorage.setItem(
      "imwPluginSetting",
      JSON.stringify({
        chatBox: { isProxyAtInput: true },
        defaultPage: 0,
        searchViewMode: "card",
        announceMode: "card",
      }),
    );
    const { groups } = await showPlugin();
    const report = vi.fn();
    rowOf(groups, "proxyAtInput").action?.(report);
    expect(report).toHaveBeenCalledWith(undefined, false);
    const stored = JSON.parse(localStorage.getItem("imwPluginSetting")!);
    expect(stored.chatBox.isProxyAtInput).toBe(false);
  });
});

describe("云同步开关", () => {
  it("未登录账号：checked=false，值位「未登录账号」，且没有「同步状态」行", async () => {
    // vitest.setup.ts 默认给了登录态 uid，游客分支要显式清掉
    const uid = (globalThis as any).window.uid;
    delete (globalThis as any).window.uid;
    try {
      const { groups } = await showPlugin();
      expect(rowOf(groups, "syncEnabled").checked).toBe(false);
      expect(rowOf(groups, "syncEnabled").actionTitle).toBe("未登录账号");
      expect(
        groups
          .flatMap((group) => group.items)
          .some((i) => i.key === "syncStatus"),
      ).toBe(false);
    } finally {
      (globalThis as any).window.uid = uid;
    }
  });

  it("已登录但未启用：值位「未启用」，开关仍为关", async () => {
    const { groups } = await showPlugin();
    expect(rowOf(groups, "syncEnabled").checked).toBe(false);
    expect(rowOf(groups, "syncEnabled").actionTitle).toBe("未启用");
    expect(rowOf(groups, "syncPassphrase").actionTitle).toBe("未启用");
  });

  it("已启用：checked 随 SyncManager.getState().enabled，并出现同步状态只读行", async () => {
    seedSyncSettings(true, 1_700_000_000_000);
    const { groups } = await showPlugin();
    expect(rowOf(groups, "syncEnabled").checked).toBe(true);
    expect(rowOf(groups, "syncEnabled").actionTitle).toBe("已启用");
    expect(rowOf(groups, "syncStatus").kind).toBe("readonly");
    expect(rowOf(groups, "syncLastSyncAt").actionTitle).not.toBe("从未同步");
    // 只读行没有动作：不可点
    expect(rowOf(groups, "syncLastSyncAt").action).toBeUndefined();
  });
});

describe("异步构建作废守卫", () => {
  it("构建在途时切走范围：迟到的插件组卡不落地，也不再订阅同步状态", async () => {
    const { SyncManager } = await import("../../sync/SyncManager");
    let resolveKey!: (value: boolean) => void;
    vi.spyOn(SyncManager, "hasLocalKey").mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveKey = resolve;
      }),
    );
    const onStateChange = vi.spyOn(SyncManager, "onStateChange");

    const { ctx, setState } = ctxOf();
    const pending = SettingsService.showPluginSettings(
      ctx,
      () => {},
      async () => {},
    );

    // 在途期间换范围（`setState` 自增版本号）→ 旧构建作废
    const radio = ctxOf();
    SettingsService.showRadio(radio.ctx);
    resolveKey(false);
    await pending;

    expect(setState).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
    expect(groupTitles(groupsOf(radio.setState))).toEqual(["无线电设置"]);
  });

  it("同一范围两次构建交错完成：以最新一次为准，先发后到的不覆盖", async () => {
    const { SyncManager } = await import("../../sync/SyncManager");
    const resolvers: ((value: boolean) => void)[] = [];
    vi.spyOn(SyncManager, "hasLocalKey").mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const first = ctxOf();
    const firstPending = SettingsService.showPluginSettings(
      first.ctx,
      () => {},
      async () => {},
    );
    const second = ctxOf();
    const secondPending = SettingsService.showPluginSettings(
      second.ctx,
      () => {},
      async () => {},
    );
    expect(resolvers).toHaveLength(2);

    // 后发的先完成（本机有密钥缓存），先发的后完成（无缓存）
    resolvers[1](false);
    await secondPending;
    resolvers[0](true);
    await firstPending;

    expect(second.setState).toHaveBeenCalledOnce();
    expect(first.setState).not.toHaveBeenCalled();
    expect(rowOf(groupsOf(second.setState), "syncForgetKey").actionTitle).toBe(
      "无本机密钥",
    );
  });
});

describe("取值行的动作回报", () => {
  /** 宿站选择弹窗被替换成「直接点中某一项」：`buildSelect2` 的第三个参数是取值回调。 */
  const pickOption = (value: string) =>
    vi
      .spyOn(IIROSEUtils, "buildSelect2")
      .mockImplementation((_i, _a, onPick) =>
        onPick(null as unknown as HTMLElement, value),
      );

  it("插件启动默认页面：确认后把新标题回报给行", async () => {
    const { groups } = await showPlugin();
    pickOption("2");
    const report = vi.fn();
    rowOf(groups, "defaultPage").action?.(report);
    expect(report).toHaveBeenCalledWith("电台");
  });

  it("点播播报：确认后把新标题回报给行", async () => {
    const { groups } = await showPlugin();
    pickOption("summary");
    const report = vi.fn();
    rowOf(groups, "announceMode").action?.(report);
    expect(report).toHaveBeenCalledWith("批量总结");
  });

  it("搜索结果视图：翻转后回报新标题，并同步父级的视图偏好", async () => {
    const { groups, setState } = await showPlugin();
    const report = vi.fn();
    rowOf(groups, "searchViewMode").action?.(report);
    expect(report).toHaveBeenCalledWith("列表");
    // 结果区渲染读的是父级 state，不跟着改就只落盘不生效
    expect(setState).toHaveBeenLastCalledWith({ searchViewMode: "list" });
  });
});

describe("关于卡", () => {
  it("四项一组，外链行 external 且值无 emoji", () => {
    const { ctx, setState } = ctxOf();
    AboutService.showAbout(ctx, async () => {});
    const groups = groupsOf(setState);
    expect(groups).toHaveLength(1);
    const items = groups[0].items;
    expect(items.map((item) => item.key)).toEqual([
      "aboutAuthor",
      "aboutSource",
      "aboutDonate",
      "aboutSponsorList",
    ]);

    const source = rowOf(groups, "aboutSource");
    expect(source.external).toBe(true);
    expect(source.actionTitle).toBe("GitHub");
    for (const item of items) {
      expect(item.actionTitle ?? "").not.toMatch(/\p{Extended_Pictographic}/u);
      expect(item.icon).not.toContain("mdi-");
    }
  });
});

describe("忘记本机密钥的值位", () => {
  it("本机没有密钥缓存时显示「无本机密钥」", async () => {
    const { groups } = await showPlugin();
    expect(rowOf(groups, "syncForgetKey").actionTitle).toBe("无本机密钥");
  });

  it("hasLocalKey 失败时设置数据照常建出来，值位退回「无本机密钥」", async () => {
    const { SyncManager } = await import("../../sync/SyncManager");
    vi.spyOn(SyncManager, "hasLocalKey").mockRejectedValue(
      new Error("indexeddb unavailable"),
    );

    const { groups } = await showPlugin();
    // 云端同步组卡仍然完整（不因读缓存失败而整块消失）
    expect(groupTitles(groups)).toEqual(["聊天框", "云端同步"]);
    expect(rowOf(groups, "syncForgetKey").kind).toBe("action");
    expect(rowOf(groups, "syncForgetKey").actionTitle).toBe("无本机密钥");
  });
});

describe("行图标", () => {
  it("四个范围与关于卡产出的每个 icon 都是已知的 DeskIcon 名字", async () => {
    const { isDeskIconName } =
      await import("../components/floating-panel/tokens");

    const collected: { who: string; key: string; icon: string }[] = [];
    const collect = (who: string, groups: SettingGroupData[]) => {
      for (const group of groups)
        for (const item of group.items)
          collected.push({ who, key: item.key, icon: item.icon });
    };

    const bili = ctxOf();
    SettingsService.showBilibili(bili.ctx);
    collect("showBilibili", groupsOf(bili.setState));

    const netease = ctxOf();
    SettingsService.showNetEaseMusic(netease.ctx);
    collect("showNetEaseMusic", groupsOf(netease.setState));

    const radio = ctxOf();
    SettingsService.showRadio(radio.ctx);
    collect("showRadio", groupsOf(radio.setState));

    const plugin = await showPlugin();
    collect("showPluginSettings", plugin.groups);

    const about = ctxOf();
    AboutService.showAbout(about.ctx, async () => {});
    collect("AboutService.showAbout", groupsOf(about.setState));

    expect(collected.length).toBeGreaterThan(20);
    for (const { who, key, icon } of collected)
      expect(`${who}.${key}: ${icon} 已知 ${isDeskIconName(icon)}`).toBe(
        `${who}.${key}: ${icon} 已知 true`,
      );
  });
});
