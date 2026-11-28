import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BiliBiliSettings, DEFAULT_BILIBILI_API } from "./BiliBiliSettings";
import { SendFetch } from "../../Api";

class TestSendFetch extends SendFetch {
  static cors = "https://generic-proxy.example/";
  static getBilibiliCors = () => super.getBilibiliCors();
}

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

  it.each([false, true])("构建 DEV=%s 只提供香港和广州节点", (dev) => {
    vi.stubEnv("DEV", dev);
    const options = captureOptions();

    settings.setBilibiliDefaultApi();
    const rows = options();

    expect(rows.map((row) => row[0])).toEqual(["HK", "Guangzhou"]);
    expect(rows.map((row) => row[1])).toEqual([
      "香港-海外优化",
      "广州-中国优化",
    ]);
    expect(String(rows[0][2])).toContain("imwApiNodeIcon");
    expect(String(rows[1][2])).toContain("imwApiNodeIcon");
    expect(rows.some((row) => String(row[2]).includes("mdi-dev-to"))).toBe(
      false,
    );
    expect(settings.availableBilibiliApis()).toEqual(["HK", "Guangzhou"]);
  });

  it("存档里的 Dev 从首次请求起走广州，读取设置时也会写回", () => {
    vi.stubEnv("DEV", true);
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

    expect(TestSendFetch.getBilibiliCors()).toBe(SendFetch.cncors);
    expect(settings.getBilibiliVideoSettings().api).toBe(DEFAULT_BILIBILI_API);
    expect(DEFAULT_BILIBILI_API).toBe("Guangzhou");
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

  it("广州节点文案沿用现有名称", () => {
    expect(settings.parseBilibiliApi("Guangzhou")).toBe("广州-中国优化");
    expect(settings.parseBilibiliApi("Tokyo" as never)).toBe("未知");
  });
});
