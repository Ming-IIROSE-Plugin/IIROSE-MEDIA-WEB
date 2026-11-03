import { SendFetch } from "../Api";
import { readJson, writeJson } from "../storage/localStore";
// 全局声明，告诉 TypeScript window 具有 iirosemedia 属性

declare global {
  interface Window {
    device: number | 1 | 7; // 1: 电脑的游览器, 7: Windows app
    ClientLocation?: "CN" | "Global";
    iirosemedia?: {
      cors?: string;
      /** 调试入口：打开收藏随机选择面板；缺省取当前 focus 平台。 */
      openShufflePicker?: (platform?: "netease" | "bilibili") => void;
      // 其他属性...
    };
  }
}

const LOCATION_CACHE_KEY = "imwClientLocation";
const LOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CN_CORS = `https://cors-anywhere-cwimzudkuk.cn-shenzhen.fcapp.run/`;
const GLOBAL_CORS = `https://cors-anywhere-cwimzudkuk.cn-hongkong.fcapp.run/`;

type Location = "CN" | "Global";

export class Environment {
  public static setEnv(): Promise<void> {
    window.iirosemedia = {};
    return this.setCors();
  }

  private static applyLocation(location: Location) {
    if (!window.iirosemedia) return;
    window.ClientLocation = location;
    window.iirosemedia.cors = location === "CN" ? CN_CORS : GLOBAL_CORS;
  }

  private static readCachedLocation(): Location | null {
    const cached = readJson<{ location?: string; at?: number } | null>(
      LOCATION_CACHE_KEY,
      null,
    );
    if (!cached) return null;
    if (typeof cached.at !== "number") return null;
    if (Date.now() - cached.at > LOCATION_CACHE_TTL_MS) return null;
    return cached.location === "CN" || cached.location === "Global"
      ? cached.location
      : null;
  }

  private static writeCachedLocation(location: Location) {
    // 存储不可用时写入失败也无妨：下次再探测
    writeJson(LOCATION_CACHE_KEY, { location, at: Date.now() });
  }

  private static async setCors() {
    // 每次进站都跨域问一次 ipinfo.io 没有必要：归属在一天内不会变。
    const cached = this.readCachedLocation();
    if (cached) {
      this.applyLocation(cached);
      return;
    }

    const res = await SendFetch.sendGet(
      `https://ipinfo.io/json`,
      new URLSearchParams(),
      new Headers(),
      false,
    );

    // 非 2xx、非 JSON、缺 country 都算探测失败：宁可重测，也不要把
    // 一次坏应答钉死一天。
    if (!res || !res.ok) {
      await this.selectCorsBySpeed();
      return;
    }

    let data: ipinfo | null = null;
    try {
      data = (await res.json()) as ipinfo;
    } catch {
      data = null;
    }
    if (!data || typeof data.country !== "string") {
      await this.selectCorsBySpeed();
      return;
    }

    const location: Location = data.country === "CN" ? "CN" : "Global";
    this.writeCachedLocation(location);
    this.applyLocation(location);
  }

  private static async selectCorsBySpeed() {
    if (!window.iirosemedia) return;
    const corss = [GLOBAL_CORS, CN_CORS];

    // 只排除连不上的代理：这些代理的根路径本来就会回 400（要求 ?url=），
    // 拿 HTTP 状态判断可用性会把两边都判死，退回写死香港节点。
    const requestTimes: { cors: string; time: number }[] = [];

    for (const cors of corss) {
      const startTime = performance.now();
      try {
        const res = await SendFetch.sendGet(
          cors,
          new URLSearchParams(),
          new Headers(),
          false,
        );
        if (!res) continue;
        requestTimes.push({ cors, time: performance.now() - startTime });
      } catch {
        /* 跳过不可用代理 */
      }
    }

    requestTimes.sort((a, b) => a.time - b.time);
    // 全部不可用时给一个确定的兜底值，避免后续拼出 `undefinedhttps://...`。
    window.iirosemedia.cors = requestTimes[0]?.cors ?? GLOBAL_CORS;
  }
}
