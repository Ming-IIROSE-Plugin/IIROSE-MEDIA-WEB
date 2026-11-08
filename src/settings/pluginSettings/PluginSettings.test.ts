import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PluginSettings,
  SETTINGS_REV,
  SETTINGS_REV_KEY,
} from "./PluginSettings";
import {
  DEFAULT_DESK_MODE,
  DESK_MODE_LIST,
  type DeskModeDescriptor,
} from "../deskModeCatalog";
import { LocalStorageUtils } from "../localStorageUtils/LocalStorageUtils";

describe("normalizeSyncSettings", () => {
  const empty = PluginSettings.normalizeSyncSettings(null);

  it("缺省值：关闭、无 salt、无 lastRev、地址是默认函数 URL", () => {
    expect(empty.enabled).toBe(false);
    expect(empty.salt).toBeNull();
    expect(empty.lastRev).toBeNull();
    expect(empty.lastSyncAt).toBeNull();
    expect(empty.serverUrl).toMatch(/^https:\/\/.+\.tencentscf\.com$/);
  });

  it("lastRev 只接受非空字符串，其余一律回退 null", () => {
    const keep = PluginSettings.normalizeSyncSettings({ lastRev: "MTg0NDQ5" });
    expect(keep.lastRev).toBe("MTg0NDQ5");

    expect(
      PluginSettings.normalizeSyncSettings({ lastRev: "" }).lastRev,
    ).toBeNull();
    expect(
      PluginSettings.normalizeSyncSettings({
        lastRev: 123 as unknown as string,
      }).lastRev,
    ).toBeNull();
    expect(
      PluginSettings.normalizeSyncSettings({ lastRev: null }).lastRev,
    ).toBeNull();
  });

  it("非法 deviceId 被清空（服务端要 16 位 hex，否则每次 PUT 400）", () => {
    expect(
      PluginSettings.normalizeSyncSettings({ deviceId: "device-1" }).deviceId,
    ).toBe("");
    expect(
      PluginSettings.normalizeSyncSettings({ deviceId: "0123456789abcdef" })
        .deviceId,
    ).toBe("0123456789abcdef");
  });

  it("口令不出现在设置结构里", () => {
    const shape = PluginSettings.normalizeSyncSettings({
      // 即使有人手改 localStorage 塞了这些键，归一化也不应该带出去
      passphrase: "oops",
      password: "oops",
    } as never);
    expect(Object.keys(shape).sort()).toEqual([
      "deviceId",
      "enabled",
      "lastRev",
      "lastSyncAt",
      "salt",
      "serverUrl",
    ]);
  });
});

describe("搜索结果视图切换", () => {
  it("卡片 → 列表 → 卡片：翻转并落盘", () => {
    localStorage.clear();
    localStorage.setItem(
      "imwPluginSetting",
      JSON.stringify({ searchViewMode: "card" }),
    );

    expect(PluginSettings.toggleSearchViewMode()).toBe("list");
    expect(
      JSON.parse(localStorage.getItem("imwPluginSetting")!).searchViewMode,
    ).toBe("list");

    expect(PluginSettings.toggleSearchViewMode()).toBe("card");
    expect(
      JSON.parse(localStorage.getItem("imwPluginSetting")!).searchViewMode,
    ).toBe("card");
  });

  it("缺省或非法值一律按卡片处理，再切换一次得到列表", () => {
    localStorage.clear();
    expect(PluginSettings.toggleSearchViewMode()).toBe("list");

    localStorage.setItem(
      "imwPluginSetting",
      JSON.stringify({ searchViewMode: "grid" }),
    );
    expect(PluginSettings.getPluginSetting().searchViewMode).toBe("card");
    expect(PluginSettings.toggleSearchViewMode()).toBe("list");
  });

  it("展示文案与设置值一一对应", () => {
    expect(PluginSettings.parseSearchViewMode("list")).toBe("列表");
    expect(PluginSettings.parseSearchViewMode("card")).toBe("卡片");
  });
});

describe("点播播报模式设置", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("imwPluginSetting", JSON.stringify({}));
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).Utils;
  });

  it("setAnnounceMode 真实写路径：选项框回调归一化落盘，actionTitle 同步档位文案", () => {
    // IIROSEUtils.buildSelect2 只是 window.Utils.buildSelect2 的透传 delegate
    // （见 src/iirose_func/IIROSEUtils.ts:64），stub 宿主侧即可截获真正的 set 回调
    let setCb: ((t: HTMLElement, s: string) => void) | undefined;
    (window as unknown as Record<string, unknown>).Utils = {
      buildSelect2: (
        _i: unknown,
        _a: unknown,
        s: (t: HTMLElement, v: string) => void,
      ) => {
        setCb = s;
      },
    };

    const changeActionTitleAction = vi.fn();
    PluginSettings.setAnnounceMode(changeActionTitleAction);

    expect(setCb).toBeDefined();
    setCb!(document.createElement("div"), "silent");

    expect(
      JSON.parse(localStorage.getItem("imwPluginSetting")!).announceMode,
    ).toBe("silent");
    expect(changeActionTitleAction).toHaveBeenCalledWith("静默（仅不发卡片）");

    // 写路径同样过归一化：非法值落盘回退 card，文案同步回默认档
    setCb!(document.createElement("div"), "loud");
    expect(
      JSON.parse(localStorage.getItem("imwPluginSetting")!).announceMode,
    ).toBe("card");
    expect(changeActionTitleAction).toHaveBeenCalledWith("发卡片");
  });

  it("三档展示文案与设置值一一对应", () => {
    expect(PluginSettings.parseAnnounceMode("card")).toBe("发卡片");
    expect(PluginSettings.parseAnnounceMode("silent")).toBe(
      "静默（仅不发卡片）",
    );
    expect(PluginSettings.parseAnnounceMode("summary")).toBe("批量总结");
  });

  it("静默档的选项文案写清「只是不发卡片」，不会被读成什么都不播", () => {
    let options: unknown[][] = [];
    (window as unknown as Record<string, unknown>).Utils = {
      buildSelect2: (_i: unknown, a: unknown[][]) => {
        options = a;
      },
    };

    PluginSettings.setAnnounceMode();

    expect(options.map((option) => option[0])).toEqual([
      "card",
      "silent",
      "summary",
    ]);
    expect(options.map((option) => option[1])).toEqual([
      "发卡片",
      "静默（不发卡片）",
      "批量总结",
    ]);
    // 文案必须落在「不发卡片」这个真实行为上，光写「静默」就是这次要修的歧义
    expect(String(options[1][1])).toContain("不发卡片");
  });

  it("已退役的随机包含专辑/歌单字段：读取时丢弃，不再出现在设置对象里", () => {
    localStorage.setItem(
      "imwPluginSetting",
      JSON.stringify({
        chatBox: { isProxyAtInput: true },
        defaultPage: 0,
        searchViewMode: "card",
        announceMode: "card",
        shuffleIncludeCollections: false,
      }),
    );
    expect(PluginSettings.getPluginSetting()).not.toHaveProperty(
      "shuffleIncludeCollections",
    );
  });
});

describe("启动默认页（模式重编号的一次性迁移）", () => {
  const KEY = "imwPluginSetting";
  const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "null");

  beforeEach(() => {
    localStorage.clear();
  });

  it("旧存档（defaultPage: 2、没有版本标记）重置为音乐并写入标记", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        chatBox: { isProxyAtInput: false },
        defaultPage: 2,
        searchViewMode: "list",
        announceMode: "summary",
        favoritesPageSize: 50,
        sync: { enabled: true, lastSyncAt: 1700000000000 },
      }),
    );

    expect(PluginSettings.getPluginSetting().defaultPage).toBe(
      DEFAULT_DESK_MODE,
    );
    expect(localStorage.getItem(SETTINGS_REV_KEY)).toBe(String(SETTINGS_REV));
    // 存档本身也要改：只改返回值的话，下一次读（标记已在）又会拿回 2
    expect(stored().defaultPage).toBe(DEFAULT_DESK_MODE);
    // 其余设置一项不动
    expect(stored()).toMatchObject({
      chatBox: { isProxyAtInput: false },
      searchViewMode: "list",
      announceMode: "summary",
      favoritesPageSize: 50,
    });
    expect(stored().sync).toMatchObject({
      enabled: true,
      lastSyncAt: 1700000000000,
    });
  });

  it("已带标记的存档不再被改写：defaultPage: 3 就是收藏", () => {
    localStorage.setItem(SETTINGS_REV_KEY, String(SETTINGS_REV));
    localStorage.setItem(KEY, JSON.stringify({ defaultPage: 3 }));

    expect(PluginSettings.getPluginSetting().defaultPage).toBe(3);
    expect(stored().defaultPage).toBe(3);
    expect(PluginSettings.parseDefaultPage(3)).toBe("收藏");
  });

  it("迁移只跑一次：用户之后自己选的页面留得住", () => {
    localStorage.setItem(KEY, JSON.stringify({ defaultPage: 3 }));

    const ps = PluginSettings.getPluginSetting();
    expect(ps.defaultPage).toBe(DEFAULT_DESK_MODE);
    ps.defaultPage = 4;
    localStorage.setItem(KEY, JSON.stringify(ps));

    expect(PluginSettings.getPluginSetting().defaultPage).toBe(4);
    expect(PluginSettings.parseDefaultPage(4)).toBe("设置");
  });

  it("迁移幂等：第二次读取不再写盘", () => {
    localStorage.setItem(KEY, JSON.stringify({ defaultPage: 2 }));
    PluginSettings.getPluginSetting();

    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(PluginSettings.getPluginSetting().defaultPage).toBe(
      DEFAULT_DESK_MODE,
    );
    expect(setItem).not.toHaveBeenCalled();
  });

  it("手改出的非法值一律回退音乐", () => {
    localStorage.setItem(SETTINGS_REV_KEY, String(SETTINGS_REV));
    for (const raw of ["电台", -1, 99, 2.5, null, undefined]) {
      localStorage.setItem(KEY, JSON.stringify({ defaultPage: raw }));
      expect(PluginSettings.getPluginSetting().defaultPage).toBe(
        DEFAULT_DESK_MODE,
      );
    }
    expect(PluginSettings.normalizeDefaultPage("音乐")).toBe(DEFAULT_DESK_MODE);
  });

  it("合法范围与文案都取自共享模式目录：多出第七种模式照样归一化", () => {
    localStorage.setItem(SETTINGS_REV_KEY, String(SETTINGS_REV));
    // 临时模拟第七种模式：目录增长后归一化与文案无需改动即跟上
    const list = DESK_MODE_LIST as unknown as DeskModeDescriptor[];
    list.push({
      index: 6,
      id: "lab" as DeskModeDescriptor["id"],
      label: "实验室",
      title: "实验室",
    });
    try {
      expect(PluginSettings.normalizeDefaultPage(6)).toBe(6);
      expect(PluginSettings.parseDefaultPage(6)).toBe("实验室");
      localStorage.setItem(KEY, JSON.stringify({ defaultPage: 6 }));
      expect(PluginSettings.getPluginSetting().defaultPage).toBe(6);
      expect(PluginSettings.normalizeDefaultPage(7)).toBe(DEFAULT_DESK_MODE);
    } finally {
      list.pop();
    }
  });
});

describe("isProxyAtInputSetting", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("翻转后回报布尔并重装输入行为（各一次）", async () => {
    const { Input_Behavior_Module } =
      await import("../../input-behavior-module/Input-Behavior-Module");
    const apply = vi
      .spyOn(Input_Behavior_Module, "applyBehavior")
      .mockImplementation(() => {});
    localStorage.setItem(
      "imwPluginSetting",
      JSON.stringify({
        chatBox: { isProxyAtInput: true },
        defaultPage: 0,
        searchViewMode: "card",
        announceMode: "card",
      }),
    );

    const onChange = vi.fn();
    const changeSearchKeyword = () => {};
    const ShowOrHideIMC = async () => {};
    PluginSettings.isProxyAtInputSetting(
      onChange,
      changeSearchKeyword,
      ShowOrHideIMC,
    );

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(false);
    expect(apply).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledWith(changeSearchKeyword, ShowOrHideIMC);
    expect(
      JSON.parse(localStorage.getItem("imwPluginSetting")!).chatBox
        .isProxyAtInput,
    ).toBe(false);
  });

  it("只传 onChange 时不重装输入行为", async () => {
    const { Input_Behavior_Module } =
      await import("../../input-behavior-module/Input-Behavior-Module");
    localStorage.setItem(
      "imwPluginSetting",
      JSON.stringify({
        chatBox: { isProxyAtInput: true },
        defaultPage: 0,
        searchViewMode: "card",
        announceMode: "card",
      }),
    );
    const apply = vi
      .spyOn(Input_Behavior_Module, "applyBehavior")
      .mockImplementation(() => {});

    const onChange = vi.fn();
    PluginSettings.isProxyAtInputSetting(onChange);

    expect(onChange).toHaveBeenCalledWith(false);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("收藏每页显示", () => {
  let selectCb: ((t: HTMLElement, s: string) => void) | undefined;
  let options: unknown[][] = [];
  let syncCb: ((input: string | null) => void) | undefined;
  const alerts: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem("imwPluginSetting", JSON.stringify({}));
    selectCb = undefined;
    syncCb = undefined;
    alerts.length = 0;
    (window as unknown as Record<string, unknown>).Utils = {
      buildSelect2: (
        _i: unknown,
        a: unknown[][],
        s: (t: HTMLElement, v: string) => void,
      ) => {
        options = a;
        selectCb = s;
      },
      sync: (_e: number, _t: unknown, o: (input: string | null) => void) => {
        syncCb = o;
      },
    };
    window._alert = (message: string) => {
      alerts.push(message);
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as Record<string, unknown>).Utils;
  });

  const saved = () =>
    JSON.parse(localStorage.getItem("imwPluginSetting")!).favoritesPageSize;

  it("缺省与非法值回退 10 条", () => {
    expect(PluginSettings.getPluginSetting().favoritesPageSize).toBe(10);
    expect(PluginSettings.normalizeFavoritesPageSize(0)).toBe(10);
    expect(PluginSettings.normalizeFavoritesPageSize(501)).toBe(10);
    expect(PluginSettings.normalizeFavoritesPageSize(12.5)).toBe(10);
    expect(PluginSettings.normalizeFavoritesPageSize("50")).toBe(50);
    expect(PluginSettings.parseFavoritesPageSize(100)).toBe("100 条");
  });

  it("每个选项都带图标位（宿站缺第三项会渲染出 undefined）", () => {
    PluginSettings.setFavoritesPageSize();
    expect(options.map((option) => option[1])).toEqual([
      "10 条",
      "50 条",
      "100 条",
      "自定义…",
    ]);
    options.forEach((option) => {
      expect(typeof option[2]).toBe("string");
      expect(option[2]).not.toBe("");
    });
  });

  it("选预设：直接落盘并回报文案", () => {
    const report = vi.fn();
    PluginSettings.setFavoritesPageSize(report);
    selectCb!(document.createElement("div"), "50");
    expect(saved()).toBe(50);
    expect(report).toHaveBeenCalledWith("50 条");
  });

  it("选自定义：等选择框淡出后再弹输入框，合法整数落盘", () => {
    const report = vi.fn();
    PluginSettings.setFavoritesPageSize(report);
    selectCb!(document.createElement("div"), "custom");
    expect(syncCb).toBeUndefined();
    vi.advanceTimersByTime(300);
    expect(syncCb).toBeDefined();
    syncCb!("25");
    expect(saved()).toBe(25);
    expect(report).toHaveBeenCalledWith("25 条");
  });

  it("自定义输入超出范围：提示且不改设置", () => {
    const report = vi.fn();
    PluginSettings.setFavoritesPageSize(report);
    selectCb!(document.createElement("div"), "custom");
    vi.advanceTimersByTime(300);
    syncCb!("1000");
    expect(alerts).toEqual(["请输入 1 到 500 之间的整数"]);
    expect(saved()).toBeUndefined();
    expect(report).not.toHaveBeenCalled();
  });
});

describe("主面板显示方式", () => {
  beforeEach(() => localStorage.clear());

  it("没有存档、旧存档、非法值都归一化为全屏", () => {
    expect(PluginSettings.getPluginSetting().panelDisplay).toBe("full");
    localStorage.setItem("imwPluginSetting", JSON.stringify({}));
    expect(PluginSettings.getPluginSetting().panelDisplay).toBe("full");
    localStorage.setItem(
      "imwPluginSetting",
      JSON.stringify({ panelDisplay: "floating" }),
    );
    expect(PluginSettings.getPluginSetting().panelDisplay).toBe("full");
  });

  it("选择跨刷新保留（读盘后仍是窗口）", () => {
    expect(PluginSettings.togglePanelDisplay()).toBe("window");
    expect(PluginSettings.getPluginSetting().panelDisplay).toBe("window");
  });

  it("启动合并默认值：旧存档补上全屏，已选的窗口不被覆盖", () => {
    localStorage.setItem(
      "imwPluginSetting",
      JSON.stringify({ defaultPage: 0 }),
    );
    LocalStorageUtils.Init();
    expect(
      JSON.parse(localStorage.getItem("imwPluginSetting")!).panelDisplay,
    ).toBe("full");

    PluginSettings.togglePanelDisplay();
    LocalStorageUtils.Init();
    expect(
      JSON.parse(localStorage.getItem("imwPluginSetting")!).panelDisplay,
    ).toBe("window");
  });

  it("退订后不再收到通知", () => {
    const listener = vi.fn();
    const off = PluginSettings.onPanelDisplayChange(listener);
    PluginSettings.togglePanelDisplay();
    off();
    PluginSettings.togglePanelDisplay();
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("点歌台入口", () => {
  const KEY = "imwPluginSetting";
  const stored = () => JSON.parse(localStorage.getItem(KEY)!).panelEntry;
  let setCb: ((t: HTMLElement, s: string) => void) | undefined;
  let options: unknown[][] = [];

  beforeEach(() => {
    localStorage.clear();
    setCb = undefined;
    (window as unknown as Record<string, unknown>).Utils = {
      buildSelect2: (
        _i: unknown,
        a: unknown[][],
        s: (t: HTMLElement, v: string) => void,
      ) => {
        options = a;
        setCb = s;
      },
    };
  });
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).Utils;
    delete (window as unknown as Record<string, unknown>)._alert;
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("没有存档、旧存档、不认识的值都按「胶囊 + 双指下滑」", () => {
    expect(PluginSettings.getPluginSetting().panelEntry).toBe("pillSwipe");
    localStorage.setItem(KEY, JSON.stringify({ panelDisplay: "window" }));
    expect(PluginSettings.getPluginSetting().panelEntry).toBe("pillSwipe");
    for (const raw of ["abc", 3, null, "PILL"]) {
      localStorage.setItem(KEY, JSON.stringify({ panelEntry: raw }));
      expect(PluginSettings.getPluginSetting().panelEntry).toBe("pillSwipe");
    }
  });

  it("启动合并默认值：旧存档补上默认档，已选的不被覆盖", () => {
    // 启动初始化会碰宿站 Utils：这一条不需要选择框
    delete (window as unknown as Record<string, unknown>).Utils;
    localStorage.setItem(KEY, JSON.stringify({ defaultPage: 0 }));
    LocalStorageUtils.Init();
    expect(stored()).toBe("pillSwipe");
    PluginSettings.savePanelEntry("swipe");
    LocalStorageUtils.Init();
    expect(stored()).toBe("swipe");
  });

  it("选择框四个选项按顺序、文案与图标位；选中后落盘、回报文案、通知订阅方", () => {
    const report = vi.fn();
    const listener = vi.fn();
    const off = PluginSettings.onPanelEntryChange(listener);
    PluginSettings.setPanelEntry(report);
    expect(options.map((option) => option[0])).toEqual([
      "pillSwipe",
      "pillSwipeClose",
      "pill",
      "swipe",
    ]);
    expect(options.map((option) => option[1])).toEqual([
      "胶囊 + 双指下滑",
      "胶囊 + 双指下滑只收起",
      "只用胶囊",
      "只用双指下滑",
    ]);
    for (const option of options) expect(String(option[2])).toContain("<div");

    setCb!(document.createElement("div"), "pill");
    expect(stored()).toBe("pill");
    expect(PluginSettings.getPluginSetting().panelEntry).toBe("pill");
    expect(report).toHaveBeenCalledWith("只用胶囊");
    expect(listener).toHaveBeenCalledWith("pill");

    off();
    setCb!(document.createElement("div"), "swipe");
    expect(listener).toHaveBeenCalledOnce();
    expect(report).toHaveBeenLastCalledWith("只用双指下滑");
  });

  it("写盘失败：提示、不回报、不通知，读到的仍是原值", () => {
    PluginSettings.savePanelEntry("pill");
    const alerts: string[] = [];
    (window as unknown as { _alert: (m: string) => void })._alert = (m) =>
      alerts.push(m);
    const report = vi.fn();
    const listener = vi.fn();
    const off = PluginSettings.onPanelEntryChange(listener);
    PluginSettings.setPanelEntry(report);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    setCb!(document.createElement("div"), "swipe");
    expect(alerts).toEqual(["设置保存失败，请重试"]);
    expect(report).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    off();
    vi.restoreAllMocks();
    expect(PluginSettings.getPluginSetting().panelEntry).toBe("pill");
  });
});
