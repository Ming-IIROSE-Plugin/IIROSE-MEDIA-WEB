import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PluginSettings } from "./PluginSettings";

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
    expect(changeActionTitleAction).toHaveBeenCalledWith("静默");

    // 写路径同样过归一化：非法值落盘回退 card，文案同步回默认档
    setCb!(document.createElement("div"), "loud");
    expect(
      JSON.parse(localStorage.getItem("imwPluginSetting")!).announceMode,
    ).toBe("card");
    expect(changeActionTitleAction).toHaveBeenCalledWith("发卡片");
  });

  it("三档展示文案与设置值一一对应", () => {
    expect(PluginSettings.parseAnnounceMode("card")).toBe("发卡片");
    expect(PluginSettings.parseAnnounceMode("silent")).toBe("静默");
    expect(PluginSettings.parseAnnounceMode("summary")).toBe("批量总结");
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
