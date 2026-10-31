import { BilibiliACC } from "../Account/BiliBili/BilibiliAccountInterface";
import { GetBiliBiliAccount } from "../Account/BiliBili/GetBiliBili";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { getNeteaseNode } from "./NeteaseAPI/Nodes";

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
    const symbol = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${symbol}${params.toString()}`;
    if (!headers) headers = new Headers();
    try {
      const response = await fetch(fullUrl, {
        method: "GET",
        headers: {
          // Headers 实例没有可枚举自有属性，展开会丢光所有请求头
          ...Object.fromEntries(headers),
          Origin: "https://iirose.com",
        },
        signal: signal,
      });

      if (!response.ok && warn) {
        ShowMessage.show(
          `GET请求失败，url: ${fullUrl} 状态码：${response.status}, 信息：${response.statusText}, params: ${params.toString()}`,
        );
      }

      return response;
    } catch (error) {
      if (warn) {
        ShowMessage.show(`GET请求失败，url: ${fullUrl} 信息：${error}`);
        console.log(`GET请求失败，url: ${fullUrl} 信息：${error}`);
      }
      return null;
    }
  }

  public static async sendGetXHR(
    url: string,
    params: URLSearchParams,
    headers: Headers,
  ) {
    const fullUrl = `${url}?${params.toString()}`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      headers.forEach((value, key) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.open("GET", fullUrl, true);
      xhr.setRequestHeader("Origin", ""); // 设置 Origin 为空
      xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status === 200) {
            // 请求成功，将响应返回
            resolve(xhr.responseText);
          } else {
            // 请求失败，返回错误信息
            reject(new Error(`Request failed with status: ${xhr.status}`));
          }
        }
      };
      xhr.send();
    });
  }

  public static async sendPost(
    url: string,
    params: URLSearchParams | string,
    headers?: Headers,
    warn: boolean = true,
    signal?: AbortSignal,
  ) {
    try {
      if (!headers) headers = new Headers();
      if (
        window.iirosemedia &&
        window.iirosemedia.cors !== undefined &&
        headers
      ) {
        if (headers.get("cookie-trans")) {
          headers.append("cookie", headers.get("cookie-trans") as string);
        }
      }
      const response = await fetch(url, {
        method: "POST",
        headers: {
          // Headers 实例没有可枚举自有属性，展开会丢光所有请求头
          ...Object.fromEntries(headers),
          Origin: "https://iirose.com",
        },
        body: params,
        signal: signal,
      });

      if (!response.ok && warn) {
        ShowMessage.show(
          `POST请求失败，url: ${url} 状态码：${response.status}, 信息：${response.statusText}, params: ${params.toString()}`,
        );
      }

      return response;
    } catch (error) {
      if (warn) {
        ShowMessage.show(`POST请求失败，url: ${url} 信息：${error}`);
      }
      return null;
    }
  }

  public static async sendHead(
    url: string,
    params: URLSearchParams,
    headers: Headers,
    followredirect: boolean = false,
    warn: boolean = true,
    signal?: AbortSignal,
  ) {
    try {
      if (window.iirosemedia && window.iirosemedia.cors !== undefined) {
        if (headers.get("cookie-trans")) {
          headers.append("cookie", headers.get("cookie-trans") as string);
        }
      }

      const fullUrl = `${url}?${params.toString()}`;

      const response = await fetch(fullUrl, {
        method: "HEAD",
        headers: headers,
        redirect: followredirect ? "follow" : "manual",
        signal: signal,
      });

      if (!response.ok && warn) {
        ShowMessage.show(
          `GET请求失败，url: ${url} 状态码：${response.status}, 信息：${response.statusText}, Cookie: ${headers.get("cookie-trans")}, params: ${params.toString()}`,
        );
      }

      return response;
    } catch (error) {
      if (warn) {
        ShowMessage.show(`HEAD请求失败，url: ${url} 信息：${error}`);
      }
      return null;
    }
  }

  public static async tryGetWitchFetch(url: string) {
    try {
      const response = await fetch(url, {});

      // 如果请求成功，检查状态码
      if (response.ok || response.status === 200) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.log(error);
      return true; // 处理其他错误
    }
  }

  public static async tryGetWhithXhr(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("HEAD", url, true); // 使用 HEAD 请求方法
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true); // 请求成功，返回 true
        } else {
          resolve(false); // 请求失败，返回 false
        }
      };
      xhr.onerror = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true); // 请求成功，返回 true
        }
        resolve(false); // 请求出错，返回 false
      };
      xhr.send(); // 发送请求
    });
  }

  protected static returnBilibiliHeaders() {
    const headers = new Headers();
    headers.set("referer", "https://www.bilibili.com");
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    );
    const bilibiliAccount = localStorage.getItem("bilibiliAccount");
    if (bilibiliAccount) {
      const account: BilibiliACC = JSON.parse(bilibiliAccount);
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
    const bilibiliAccount = localStorage.getItem("bilibiliAccount");
    if (!bilibiliAccount) return undefined;

    const account = JSON.parse(bilibiliAccount);

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
    try {
      const ls =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("bilibiliSetting")
          : null;
      if (ls) {
        const parsed = JSON.parse(ls);
        if (parsed.api) api = parsed.api;
      }
    } catch {
      /* ignore */
    }

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
    let api: string | undefined;
    try {
      const ls =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("neteaseSetting")
          : null;
      if (ls) {
        const parsed = JSON.parse(ls);
        if (parsed.api) api = parsed.api;
      }
    } catch {
      /* ignore */
    }

    return this[getNeteaseNode(api).cors];
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
