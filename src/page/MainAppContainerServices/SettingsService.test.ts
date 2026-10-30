import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "./SettingsService";
import { AboutService } from "./AboutService";

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
