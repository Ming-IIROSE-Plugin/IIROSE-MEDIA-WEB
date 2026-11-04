import { BilibiliACC } from "../Account/BiliBili/BilibiliAccountInterface";
import { GetBiliBiliAccount } from "../Account/BiliBili/GetBiliBili";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { readJson } from "../storage/localStore";
import { getNeteaseNode } from "./NeteaseAPI/Nodes";
import * as fetchTransport from "./transports/fetchTransport";
import * as xhrTransport from "./transports/xhrTransport";

export class SendFetch {
  // public static cors = `http://localhost:9000/proxy?url=`;

  public static cors = `https://1309510434-0ia3djbhr3.ap-guangzhou.tencentscf.com/proxy?url=`;
  public static malaysiacors = `https://1309510434-j7rmgztk8t.ap-hongkong.tencentscf.com/proxy?url=`;
  public static cncors = `https://1309510434-0ia3djbhr3.ap-guangzhou.tencentscf.com/proxy?url=`;
  public static devcors = `http://localhost:9000/proxy?url=`;

  static {
    if (
      typeof window !== "undefined" &&
      window.iirosemedia &&
      window.iirosemedia.cors !== undefined
    ) {
      this.cors = window.iirosemedia.cors;
    }
  }
  public static async sendGet(
    url: string,
    params: URLSearchParams,
    headers?: Headers,
    warn: boolean = true,
    signal?: AbortSignal,
  ) {
    return fetchTransport.sendGet(url, params, headers, warn, signal);
  }

  public static async sendGetXHR(
    url: string,
    params: URLSearchParams,
    headers: Headers,
  ) {
    return xhrTransport.sendGetXHR(url, params, headers);
  }

  public static async sendPost(
    url: string,
    params: URLSearchParams | string,
    headers?: Headers,
    warn: boolean = true,
    signal?: AbortSignal,
  ) {
    return fetchTransport.sendPost(url, params, headers, warn, signal);
  }

  public static async sendHead(
    url: string,
    params: URLSearchParams,
    headers: Headers,
    followredirect: boolean = false,
    warn: boolean = true,
    signal?: AbortSignal,
  ) {
    return fetchTransport.sendHead(
      url,
      params,
      headers,
      followredirect,
      warn,
      signal,
    );
  }

  public static async tryGetWitchFetch(url: string) {
    return fetchTransport.tryGetWitchFetch(url);
  }

  public static async tryGetWhithXhr(url: string): Promise<boolean> {
    return xhrTransport.tryGetWhithXhr(url);
  }

  protected static returnBilibiliHeaders() {
    const headers = new Headers();
    headers.set("referer", "https://www.bilibili.com");
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    );
    const account = readJson<BilibiliACC | null>("bilibiliAccount", null);
    if (account) {
      const excludedKeys = ["face", "uname"];
      const cookieString = Object.entries(account)
        .filter(
          ([key, value]) =>
            value !== undefined &&
            value !== null &&
            value !== "" &&
            key !== "id" &&
            !excludedKeys.includes(key),
        )
        .map(([key, value]) => `${key}=${value}`)
        .join(";");
      headers.append("cookie-trans", cookieString);
    }
    return headers;
  }

  protected static buildCookieString(): string | undefined {
    const account = readJson<BilibiliACC | null>("bilibiliAccount", null);
    if (!account) return undefined;

    if (!account.SESSDATA) {
      return undefined;
    }

    const excludedKeys = ["face", "uname", "id"];

    return Object.entries(account)
      .filter(
        ([key, value]) =>
          value !== undefined &&
          value !== null &&
          value !== "" &&
          !excludedKeys.includes(key),
      )
      .map(([key, value]) => `${key}=${value}`)
      .join(";");
  }

  protected static returnBiliBiliHeadersBuvidOnly() {
    const headers = new Headers();
    const bilibiliAccount = new GetBiliBiliAccount();
    const account = bilibiliAccount.getBiliBiliAccount();
    if (account) {
      headers.append(
        "cookie-trans",
        `buvid3=${account.buvid3} buvid4=${account.buvid4}`,
      );
    } else {
      headers.append("cookie-trans", `buvid3=1; buvid4=2;`);
    }
    headers.set("referer", "https://www.bilibili.com");
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    );
    return headers;
  }

  protected static returnCommonHeaders() {
    const headers = new Headers();
    return headers;
  }

  protected static getBilibiliCors() {
    let api = "Guangzhou";
    const setting = readJson<{ api?: string } | null>("bilibiliSetting", null);
    if (setting?.api) api = setting.api;

    if (api === "Guangzhou") {
      return this.cncors;
    } else if (api === "HK") {
      return this.malaysiacors;
    } else if (api === "Dev") {
      return this.devcors;
    }
    return this.cors;
  }

  /**
   * 读取用户选择的网易云优先节点（请求时读取）。
   * 节点 id / 文案 / 图标 / 代理常量的对应关系见 `NETEASE_NODES`，此处只做读取与回落。
   */
  protected static getNeteaseCors() {
    const setting = readJson<{ api?: string } | null>("neteaseSetting", null);
    return this[getNeteaseNode(setting?.api).cors];
  }

  /**
   * 网易云统一请求入口：优先节点失败后当次换其余节点重试，每节点 5 秒超时。
   * 仅当全部节点失败时提示一次；重试过程中的单次失败静默。
   * @param url 不含代理前缀的完整网易云 URL
   * @param params POST body / GET query
   * @param method 请求方法
   * @param headers 额外请求头（POST 用）
   * @param signal 调用方的中止信号（如批量点播的「停止」）：与 5 秒超时区分，
   *   中止后立即返回 null，不换节点、不提示
   * @returns 解析后的 JSON；全部节点失败或被外部中止返回 null
   */
  protected static async neteaseRequest(
    url: string,
    params: URLSearchParams | string,
    method: "GET" | "POST",
    headers?: Headers,
    signal?: AbortSignal,
  ): Promise<any | null> {
    if (signal?.aborted) return null;
    const TIMEOUT_MS = 5000;
    const primary = this.getNeteaseCors();
    // Dev 模式下仅本地开发节点可用；其余情况优先节点在前，另一个 SCF 兜底
    const nodes =
      primary === this.devcors
        ? [primary]
        : primary === this.malaysiacors
          ? [primary, this.cncors]
          : [primary, this.malaysiacors];

    let lastError: "risk" | "timeout" | "http" | "network" = "http";
    let lastStatus: number | undefined;

    // 超时类失败（含 433 腾讯云函数网关超时）往往是节点瞬时拥塞：所有节点都超时后
    // 再补一轮，间隔 600ms。风控 / HTTP / 网络类失败不补试，避免放大失败面。
    const passes = 2;
    const RETRY_DELAY_MS = 600;
    for (let pass = 0; pass < passes; pass++) {
      if (pass > 0) {
        if (lastError !== "timeout") break;
        if (signal?.aborted) return null;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
      for (const node of nodes) {
        if (signal?.aborted) return null;
        // 每个节点独立判定，避免上一节点的状态码污染最终提示
        lastStatus = undefined;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        // 外部中止联动当前节点的请求（超时与外部中止共用这一个 controller）
        const onAbort = () => controller.abort();
        signal?.addEventListener("abort", onAbort);
        try {
          const response =
            method === "GET"
              ? await this.sendGet(
                  `${node}${url}`,
                  params as URLSearchParams,
                  headers,
                  false,
                  controller.signal,
                )
              : await this.sendPost(
                  `${node}${url}`,
                  params,
                  headers,
                  false,
                  controller.signal,
                );

          if (controller.signal.aborted) {
            if (signal?.aborted) return null;
            lastError = "timeout";
            continue;
          }

          if (!response) {
            lastError = "network";
            continue;
          }

          if (!response.ok) {
            // 433 为腾讯云函数网关执行超时，归入超时
            lastStatus = response.status;
            lastError =
              response.status === 433 ||
              response.status === 408 ||
              response.status === 504
                ? "timeout"
                : "http";
            continue;
          }

          let data: any;
          try {
            data = await response.json();
          } catch {
            // 读 body 期间被外部中止，不算节点失败
            if (signal?.aborted) return null;
            // 假 200：body 不是 JSON
            lastError = "http";
            continue;
          }

          if (data && data.code === 200) {
            return data;
          }

          // 假 200：业务码失败（-462 / -460 / 460 为网易云风控）
          lastStatus =
            data && typeof data.code === "number" ? data.code : undefined;
          lastError =
            lastStatus === -462 || lastStatus === -460 || lastStatus === 460
              ? "risk"
              : "http";
        } catch {
          if (signal?.aborted) return null;
          lastError = controller.signal.aborted ? "timeout" : "network";
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
        }
      }
    }

    if (signal?.aborted) return null;

    const reason =
      lastError === "risk"
        ? "网易云风控校验，请稍后重试或切换节点"
        : lastError === "timeout"
          ? "网易云请求超时，请稍后重试或切换节点"
          : lastError === "network"
            ? "网易云网络请求失败，请检查网络后重试"
            : `网易云请求失败${lastStatus !== undefined ? `（${lastStatus}）` : ""}`;

    this.showNeteaseFailure(reason);
    return null;
  }

  /**
   * 同因提示去重：逐曲歌词这类批量请求在端点故障时会在几秒内失败 N 次，
   * 同一个原因（风控/超时/网络/状态码）在窗口内只提示一次，避免刷屏。
   */
  private static neteaseFailureToastAt = 0;
  private static neteaseFailureToastMessage = "";

  private static showNeteaseFailure(reason: string) {
    const now = Date.now();
    if (
      reason === this.neteaseFailureToastMessage &&
      now - this.neteaseFailureToastAt < 10000
    )
      return;
    this.neteaseFailureToastMessage = reason;
    this.neteaseFailureToastAt = now;
    ShowMessage.show(reason);
  }
}
