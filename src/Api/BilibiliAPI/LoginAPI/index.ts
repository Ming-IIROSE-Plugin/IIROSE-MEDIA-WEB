import { SendFetch } from "../..";
import { buildActivateCookiePayload } from "./activateCookiePayload";

export class BiliBiliLoginApi extends SendFetch {
  public static async QRLogin(
    qrcode_key: string,
  ): Promise<(qrLogin & { setCookies: string[] }) | null> {
    const url = `${this.cors}https://passport.bilibili.com/x/passport-login/web/qrcode/poll`;

    const params = new URLSearchParams({
      qrcode_key,
    });

    const cookie = this.buildCookieString();
    const headers = this.returnBilibiliHeaders();

    if (cookie) {
      headers.set("Cookie", cookie);
    }

    const response = await this.sendGet(url, params, headers);

    if (!response || !response.ok) {
      return null;
    }

    // 从你的 CORS Proxy 获取 Bilibili 的 Set-Cookie
    const setCookieHeader = response.headers.get("X-Proxy-Set-Cookie");

    let setCookies: string[] = [];

    if (setCookieHeader) {
      try {
        const parsed: unknown = JSON.parse(setCookieHeader);

        if (Array.isArray(parsed)) {
          setCookies = parsed.filter(
            (item): item is string => typeof item === "string",
          );
        }
      } catch (error) {
        console.error("Failed to parse X-Proxy-Set-Cookie:", error);
      }
    }

    const data = await response.json();

    return {
      ...data,
      setCookies,
    };
  }

  public static async getQRCode() {
    const url = `${this.cors}https://passport.bilibili.com/x/passport-login/web/qrcode/generate`;
    const headers = this.returnBilibiliHeaders();
    // headers.set('cookie', `bili_ticket_expires=${CookieData['bili_ticket_expires']?.value} bili_ticket=${CookieData['bili_ticket']?.value}bmg_af_switch=${CookieData['bmg_af_switch']?.value}FEED_LIVE_VERSION=${CookieData['FEED_LIVE_VERSION']?.value}browser_resolution=${CookieData['browser_resolution']?.value}header_theme_version=${CookieData['header_theme_version']?.value}home_feed_column=${CookieData['home_feed_column']?.value}bmg_src_def_domain=${CookieData['bmg_src_def_domain']?.value}enable_web_push=${CookieData['enable_web_push']?.value}_uuid=${CookieData['_uuid']?.value}b_lsid=${CookieData['b_lsid']?.value}buvid3=${CookieData['buvid3']?.value}b_ut=${CookieData['b_ut']?.value}buvid_fp=${CookieData['buvid_fp']?.value}b_nut=${CookieData['b_nut']?.value}buvid4=${CookieData['buvid4']?.value}`);
    const response = await this.sendGet(url, new URLSearchParams(""), headers);
    if (response && response.ok) {
      const data: QRcode = await response.json();
      return data;
    } else {
      return null;
    }
  }

  public static async accountStatusAPI(csrf: string) {
    const url =
      "https://passport.bilibili.com/x/passport-login/web/cookie/info";
    const params = new URLSearchParams({
      csrf: csrf,
    });
    const headers = this.returnBilibiliHeaders();

    const response = await this.sendGet(url, params, headers);

    if (response && response.ok) {
      const data: Refresh = await response.json();
      if (data.code === 0) {
        return data;
      } else {
        console.log(`accountStatusAPI: ${data.message}, code: ${data.code}`);
        throw new Error(
          `accountStatusAPI: ${data.message}, code: ${data.code}`,
        );
      }
    } else {
      return null;
    }
  }

  /**
   * 获取buvid (游览器指纹?)
   * @returns
   */
  public static async getBuvid(): Promise<buvid | null> {
    const url = `${this.cors}https://api.bilibili.com/x/frontend/finger/spi`;

    const params = new URLSearchParams();

    // ⚠️ 这个接口本身不需要 cookie，但可以带（可选）
    const cookie = this.buildCookieString();

    const headers = this.returnBilibiliHeaders();

    if (cookie) {
      headers.set("Cookie", cookie);
    }

    const response = await this.sendGet(url, params, headers);

    if (response && response.ok) {
      return await response.json();
    }

    return null;
  }

  /**
   * 激活cookie
   * 还没做好，不清楚是什么问题
   * @see {@link https://github.com/SocialSisterYi/bilibili-API-collect/issues/686}
   * @see {@link https://github.com/SocialSisterYi/bilibili-API-collect/issues/933}
   * @returns
   */
  public static async activateCookie() {
    const url = "https://api.bilibili.com/x/internal/gaia-gateway/ExClimbWuzhi";
    const headers = this.returnBilibiliHeaders();
    const timestamp: number = Date.now();
    const payload = buildActivateCookiePayload(timestamp);
    const param = new URLSearchParams({
      payload: JSON.stringify(payload),
    }); // 这个我不知道怎么弄
    const response = await this.sendPost(url, param, headers);
    if (response && response.ok) {
      const data = await response.json();
      return data;
    } else {
      return null;
    }
  }

  // async GenerateCrorrespondPath(timestamp: number)
  // {
  //     const publicKeyData = {
  //         kty: "RSA",
  //         n: "y4HdjgJHBlbaBN04VERG4qNBIFHP6a3GozCl75AihQloSWCXC5HDNgyinEnhaQ_4-gaMud_GF50elYXLlCToR9se9Z8z433U3KjM-3Yx7ptKkmQNAMggQwAVKgq3zYAoidNEWuxpkY_mAitTSRLnsJW-NCTa0bqBFF6Wm1MxgfE",
  //         e: "AQAB",
  //     }

  //     const publicKey = await crypto.webcrypto.subtle.importKey(
  //         "jwk",
  //         publicKeyData,
  //         { name: "RSA-OAEP", hash: "SHA-256" },
  //         true,
  //         ["encrypt"]
  //     );

  //     const data = new TextEncoder().encode(`refresh_${timestamp}`);
  //     const encrypted = new Uint8Array(await crypto.webcrypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, data));
  //     return encrypted.reduce((str, c) => str + c.toString(16).padStart(2, "0"), "");
  // }

  // public static async getrefresh_csfr(correspondPath: string, biliBiliSessData: string)
  // {
  //     const url = `https://www.bilibili.com/correspond/1/${correspondPath}`;
  //     const headers = this.returnBilibiliHeaders(biliBiliSessData);
  //     const response = await this.sendGet(url, new URLSearchParams(''), headers);

  //     if (response && response.ok)
  //     {
  //         const htmlContent = await response.text();
  //         const dom = new JSDOM(htmlContent);
  //         const refreshCsrf: string = dom.window.document.querySelector('[id="1-name"]').textContent;
  //         return refreshCsrf;
  //     } else
  //     {
  //         console.log('Warn:', response.statusText);
  //         return null;
  //     }
  // }

  /**
   * 刷新并且获取cookie
   * @param csrf CSRF Token, 位于 Cookie 中的bili_jct字段
   * @param refresh_csrf 实时刷新口令，通过getrefresh_csfr 获得
   * @param refresh_token 持久化刷新口令，在localStorage 中的ac_time_value字段
   * @param biliBiliSessData SESSDATA
   * @returns
   */
  // public static async refreshCookie(csrf: string, refresh_csrf: string, refresh_token: string, biliBiliSessData: string)
  // {
  //     const url = 'https://passport.bilibili.com/x/passport-login/web/cookie/refresh';
  //     const data = new URLSearchParams({
  //         csrf: csrf,
  //         refresh_csrf: refresh_csrf,
  //         source: 'main_web',
  //         refresh_token: refresh_token
  //     });
  //     const headers = this.returnBilibiliHeaders(biliBiliSessData);

  //     const response = await this.sendPost(url, data, headers);

  //     if (response && response.ok)
  //     {
  //         const data: RefreshCookiedata = await response.json();
  //         const cookies = response.headers.get('set-cookie');
  //         if (!cookies) throw new Error('GetRefreshCookie: 获取的cookie为空');
  //         // 将字符串按逗号分隔成数组
  //         const cookieArray = cookies.split(', ');

  //         // 创建一个空对象来存储重组后的 cookie
  //         const parsedCookies: { [key: string]: string; } = {}

  //         // 遍历数组，解析每个 cookie 并存储到对象中
  //         cookieArray.forEach(cookie =>
  //         {
  //             const cookieParts = cookie.split(';')[0].split('=');
  //             const key = cookieParts[0];
  //             const value = cookieParts[1];
  //             parsedCookies[key] = value;
  //         });
  //         console.log(parsedCookies);
  //         parsedCookies['refresh_token'] = data.data.refresh_token;
  //         return parsedCookies;
  //     } else
  //     {
  //         console.log('Warn:', response.statusText);
  //         return null;
  //     }
  // }

  // public static async confirmRefreshCookie(csrf: string, refresh_token: string, biliBiliSessData: string)
  // {

  //     const url = 'https://passport.bilibili.com/x/passport-login/web/confirm/refresh';

  //     const headers = this.returnBilibiliHeaders(biliBiliSessData);

  //     const data = new URLSearchParams({
  //         csrf: csrf,
  //         refresh_token: refresh_token
  //     });
  //     data.append('csrf', csrf);
  //     data.append('refresh_token', refresh_token);

  //     const response = await this.sendPost(url, data, headers);

  //     if (response && response.ok)
  //     {
  //         const responseData: RefreshCookiedata = await response.json();
  //         return responseData;
  //     } else
  //     {
  //         console.log('Warn:', response.statusText);
  //         return null;
  //     }
  // }

  public static async getNavUserData(sessdata?: string | null) {
    const url = `${this.cors}https://api.bilibili.com/x/web-interface/nav`;

    const params = new URLSearchParams();

    const cookieString = sessdata
      ? `SESSDATA=${sessdata}`
      : this.buildCookieString();

    console.log(`sessdata: ${sessdata}`);

    if (cookieString) {
      params.set("cookie", cookieString);
    }

    const response = await this.sendGet(url, params);

    if (response && response.ok) {
      return await response.json();
    }

    return null;
  }
}
