import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SendFetch } from "../Api";
import { Environment } from "./Environment";

const CACHE_KEY = "imwClientLocation";
const GLOBAL_CORS = "https://cors-anywhere-cwimzudkuk.cn-hongkong.fcapp.run/";

function ipinfoResponse(country: unknown, ok = true) {
  return {
    ok,
    json: async () => ({ country }),
  } as unknown as Response;
}

function corsResponse(ok = true) {
  return { ok } as unknown as Response;
}

describe("Environment", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("缓存命中时不请求 ipinfo.io", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ location: "CN", at: Date.now() }),
    );
    const sendGet = vi.spyOn(SendFetch, "sendGet");
    await Environment.setEnv();
    expect(sendGet).not.toHaveBeenCalled();
    expect(window.iirosemedia?.cors).toContain("cn-shenzhen");
  });

  it("首次探测后按天缓存", async () => {
    const sendGet = vi
      .spyOn(SendFetch, "sendGet")
      .mockResolvedValue(ipinfoResponse("CN"));
    await Environment.setEnv();
    expect(sendGet).toHaveBeenCalledTimes(1);
    expect(window.iirosemedia?.cors).toContain("cn-shenzhen");
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) as string);
    expect(cached.location).toBe("CN");
  });

  it("过期的缓存会重新探测", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ location: "CN", at: Date.now() - 25 * 60 * 60 * 1000 }),
    );
    const sendGet = vi
      .spyOn(SendFetch, "sendGet")
      .mockResolvedValue(ipinfoResponse("US"));
    await Environment.setEnv();
    expect(sendGet).toHaveBeenCalledTimes(1);
    expect(window.iirosemedia?.cors).toContain("cn-hongkong");
  });

  it("缺少 country 的应答不写缓存，并回退到测速", async () => {
    const sendGet = vi
      .spyOn(SendFetch, "sendGet")
      .mockResolvedValue(ipinfoResponse(undefined));
    await Environment.setEnv();
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    expect(sendGet).toHaveBeenCalledTimes(3);
  });

  it("测速按响应速度选代理，非 2xx 也算连通", async () => {
    const seen: string[] = [];
    vi.spyOn(SendFetch, "sendGet").mockImplementation(async (url: string) => {
      seen.push(url);
      if (url.includes("ipinfo.io")) return null;
      // 代理根路径真实返回 400；能拿到响应就说明代理可达。
      if (url.includes("cn-hongkong"))
        return new Promise((resolve) =>
          setTimeout(() => resolve(corsResponse(false)), 20),
        );
      return corsResponse(false);
    });
    await Environment.setEnv();
    expect(seen).toHaveLength(3);
    expect(window.iirosemedia?.cors).toContain("cn-shenzhen");
  });

  it("全部不可用时给确定兜底值，不留下 undefined", async () => {
    vi.spyOn(SendFetch, "sendGet").mockResolvedValue(null);
    await Environment.setEnv();
    expect(window.iirosemedia?.cors).toBe(GLOBAL_CORS);
  });
});
