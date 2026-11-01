import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BiliBiliSettings, DEFAULT_BILIBILI_API } from "./BiliBiliSettings";

const KEY = "bilibiliSetting";

const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "null");

/** 截获 setBilibiliDefaultApi 交给宿站的选项表（IIROSEUtils 只是 window.Utils 的透传）。 */
function captureOptions(): () => unknown[][] {
  let options: unknown[][] = [];
  (window as unknown as Record<string, unknown>).Utils = {
    buildSelect2: (_i: unknown, a: unknown[][]) => {
      options = a;
    },
  };
  return () => options;
}

describe("B 站默认 API 节点", () => {
  const settings = new BiliBiliSettings();

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as unknown as Record<string, unknown>).Utils;
  });

  it("线上构建不提供「开发者模式」，其余两项顺序与图标不变", () => {
    vi.stubEnv("DEV", false);
    const options = captureOptions();

    settings.setBilibiliDefaultApi();
    const rows = options();

    expect(rows.map((row) => row[0])).toEqual(["HK", "Guangzhou"]);
    expect(rows.map((row) => row[1])).toEqual([
      "香港-海外优化",
      "广州-中国优化",
    ]);
    // 图标逐行跟着自己的节点走，隐藏 Dev 后不会错位到别的行
    expect(String(rows[0][2])).toContain("mdi-crosshairs-gps");
    expect(String(rows[1][2])).toContain("mdi-crosshairs-gps");
    expect(rows.some((row) => String(row[2]).includes("mdi-dev-to"))).toBe(
      false,
    );
    expect(settings.availableBilibiliApis()).toEqual(["HK", "Guangzhou"]);
  });

  it("线上构建：存档里的 Dev 归一化为默认节点，并写回存档", () => {
    vi.stubEnv("DEV", false);
    localStorage.setItem(
      KEY,
      JSON.stringify({
        qn: 80,
        streamqn: 250,
        streamSeconds: 60,
        videoStreamFormat: 1,
        api: "Dev",
      }),
    );

    expect(settings.getBilibiliVideoSettings().api).toBe(DEFAULT_BILIBILI_API);
    expect(DEFAULT_BILIBILI_API).toBe("Guangzhou");
    // 请求层 Api.getBilibiliCors 直接读原始存档：不写回就还会打到 localhost
    expect(stored().api).toBe(DEFAULT_BILIBILI_API);
    // 其余字段原样保留
    expect(stored().qn).toBe(80);
    expect(settings.normalizeBilibiliApi("Dev")).toBe(DEFAULT_BILIBILI_API);
  });

  it("线上构建：未知取值同样回退默认节点", () => {
    vi.stubEnv("DEV", false);
    localStorage.setItem(KEY, JSON.stringify({ api: "Tokyo" }));
    expect(settings.getBilibiliVideoSettings().api).toBe(DEFAULT_BILIBILI_API);
  });

  it("开发构建仍提供「开发者模式」，且存档里的 Dev 不被改写", () => {
    vi.stubEnv("DEV", true);
    const options = captureOptions();

    settings.setBilibiliDefaultApi();
    const rows = options();

    expect(rows.map((row) => row[0])).toEqual(["HK", "Guangzhou", "Dev"]);
    expect(rows.map((row) => row[1])).toEqual([
      "香港-海外优化",
      "广州-中国优化",
      "开发者模式",
    ]);
    expect(String(rows[2][2])).toContain("mdi-dev-to");
    expect(String(rows[0][2])).toContain("mdi-crosshairs-gps");
    expect(settings.availableBilibiliApis()).toEqual([
      "HK",
      "Guangzhou",
      "Dev",
    ]);

    localStorage.setItem(KEY, JSON.stringify({ api: "Dev" }));
    expect(settings.getBilibiliVideoSettings().api).toBe("Dev");
    expect(stored().api).toBe("Dev");
  });

  it("开发者模式的节点文案仍可解析（开发构建里它出现在设置行上）", () => {
    expect(settings.parseBilibiliApi("Dev")).toBe("开发者模式");
    expect(settings.parseBilibiliApi("Guangzhou")).toBe("广州-中国优化");
    expect(settings.parseBilibiliApi("Tokyo" as never)).toBe("未知");
  });
});
