// src/Api/transports/fetchTransport.ts
// SendFetch 的 fetch 传输：GET / POST / HEAD 与「这个地址能不能直连」探测。
// 门面（静态字段、代理选择、网易云统一入口）留在 `Api/index.ts`，这里不读 this。
import { ShowMessage } from "../../iirose_func/ShowMessage";

export async function sendGet(
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

export async function sendPost(
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

export async function sendHead(
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

export async function tryGetWitchFetch(url: string) {
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
