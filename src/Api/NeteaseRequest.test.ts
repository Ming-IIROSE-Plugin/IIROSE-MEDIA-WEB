import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 宿站 toast 通道只在 window._alert 存在时才发消息；这里直接接管，用来断言
// 「重试过程静默、全部失败才提示一次」。
vi.mock("../iirose_func/ShowMessage", () => ({
  ShowMessage: { show: vi.fn() },
}));

import { SendFetch } from "./index";
import { NeteaseMusicAPI } from "./NeteaseAPI/NeteaseMusic";
import { NeteaseSearchAPI } from "./NeteaseAPI/NeteaseSearch";
import { ShowMessage } from "../iirose_func/ShowMessage";

/**
 * 网易云统一请求入口 `neteaseRequest` 的失败检测与节点切换。
 *
 * 宿站代理（腾讯 SCF）的失败形态是概率性的且多数不是 HTTP 错误：风控返回
 * 200 + `code: -462`，网关超时返回 433，节点挂起则根本没有响应。这些行由
 * spec 的 I/O & Edge-Case Matrix 逐条钉死，此处按矩阵逐行覆盖。
 */

const showMock = ShowMessage.show as unknown as ReturnType<typeof vi.fn>;

// 同因提示有 10 秒去重窗口：用例之间必须重置，否则后一条断言会被上一条压掉
beforeEach(() => {
  (SendFetch as any).neteaseFailureToastAt = 0;
  (SendFetch as any).neteaseFailureToastMessage = "";
});

const URL_UNDER_TEST = "https://music.163.com/weapi/search/get";
const POST_BODY = new URLSearchParams({ s: "周杰伦", type: "1000" });

/** 代理链路上的 POST 请求：任何一次真正的出网调用都会打到这里 */
const fetchMock = vi.fn();

function callNeteaseRequest(
  method: "GET" | "POST" = "POST",
  url: string = URL_UNDER_TEST,
  params: URLSearchParams = POST_BODY,
): Promise<any | null> {
  return (SendFetch as any).neteaseRequest(url, params, method);
}

function json200(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function httpStatus(status: number): Response {
  return new Response("", { status });
}

function setNeteaseApi(api: string | undefined): void {
  localStorage.setItem(
    "neteaseSetting",
    JSON.stringify(api === undefined ? {} : { api }),
  );
}

function nodeOfCall(index: number): string {
  return String(fetchMock.mock.calls[index][0]);
}

describe("neteaseRequest：节点序与存量设置", () => {
  beforeEach(() => {
    localStorage.clear();
    showMock.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("无设置时走广州节点，正常响应直接返回 JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      json200({ code: 200, result: { songs: [] } }),
    );

    const data = await callNeteaseRequest();

    expect(data).toEqual({ code: 200, result: { songs: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(nodeOfCall(0).startsWith(SendFetch.cncors)).toBe(true);
    expect(showMock).not.toHaveBeenCalled();
  });

  it("存量值 api: 'default' 仍走广州节点", async () => {
    setNeteaseApi("default");
    fetchMock.mockResolvedValueOnce(json200({ code: 200 }));

    await callNeteaseRequest();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(nodeOfCall(0).startsWith(SendFetch.cncors)).toBe(true);
  });

  it("设置切到 HK 后新请求出口为香港节点", async () => {
    setNeteaseApi("HK");
    fetchMock.mockResolvedValueOnce(json200({ code: 200 }));

    await callNeteaseRequest();

    expect(nodeOfCall(0).startsWith(SendFetch.malaysiacors)).toBe(true);
  });
});

describe("neteaseRequest：单节点失败换节点重试", () => {
  beforeEach(() => {
    localStorage.clear();
    showMock.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("优先节点风控（200 + code -462）时换节点成功，且全程无提示", async () => {
    fetchMock
      .mockResolvedValueOnce(json200({ code: -462, message: "risk" }))
      .mockResolvedValueOnce(json200({ code: 200, result: { songs: ["ok"] } }));

    const data = await callNeteaseRequest();

    expect(data).toEqual({ code: 200, result: { songs: ["ok"] } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(nodeOfCall(0).startsWith(SendFetch.cncors)).toBe(true);
    expect(nodeOfCall(1).startsWith(SendFetch.malaysiacors)).toBe(true);
    expect(showMock).not.toHaveBeenCalled();
  });

  it("SCF 网关超时（HTTP 433）时换节点成功", async () => {
    fetchMock
      .mockResolvedValueOnce(httpStatus(433))
      .mockResolvedValueOnce(json200({ code: 200 }));

    const data = await callNeteaseRequest();

    expect(data).toEqual({ code: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(showMock).not.toHaveBeenCalled();
  });

  it("假 200（body 非 JSON）视为该节点失败并换节点", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response("<html>gateway</html>", { status: 200 }),
      )
      .mockResolvedValueOnce(json200({ code: 200 }));

    const data = await callNeteaseRequest();

    expect(data).toEqual({ code: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(showMock).not.toHaveBeenCalled();
  });

  it("假 200（code 非 200）视为该节点失败并换节点", async () => {
    fetchMock
      .mockResolvedValueOnce(json200({ code: 400 }))
      .mockResolvedValueOnce(json200({ code: 200 }));

    const data = await callNeteaseRequest();

    expect(data).toEqual({ code: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(showMock).not.toHaveBeenCalled();
  });

  it("新请求仍从优先节点发起，不粘住上一次成功的节点", async () => {
    fetchMock
      .mockResolvedValueOnce(json200({ code: -462 }))
      .mockResolvedValueOnce(json200({ code: 200 }))
      .mockResolvedValueOnce(json200({ code: 200 }));

    await callNeteaseRequest();
    await callNeteaseRequest();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(nodeOfCall(0).startsWith(SendFetch.cncors)).toBe(true);
    expect(nodeOfCall(1).startsWith(SendFetch.malaysiacors)).toBe(true);
    expect(nodeOfCall(2).startsWith(SendFetch.cncors)).toBe(true);
  });
});

describe("neteaseRequest：5 秒超时兜底", () => {
  beforeEach(() => {
    localStorage.clear();
    showMock.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("节点挂起 5 秒后中止并转下一节点", async () => {
    let abortedAt: number | undefined;
    fetchMock
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            abortedAt = Date.now();
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      })
      .mockResolvedValueOnce(json200({ code: 200 }));

    const pending = callNeteaseRequest();

    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(abortedAt).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ code: 200 });

    expect(abortedAt).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(nodeOfCall(1).startsWith(SendFetch.malaysiacors)).toBe(true);
    expect(showMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("GET 节点挂起 5 秒后中止并转下一节点，且定时器已清理", async () => {
    let abortedAt: number | undefined;
    fetchMock
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            abortedAt = Date.now();
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      })
      .mockResolvedValueOnce(json200({ code: 200 }));

    const pending = callNeteaseRequest("GET");

    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(abortedAt).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ code: 200 });

    expect(abortedAt).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(nodeOfCall(0).startsWith(SendFetch.cncors)).toBe(true);
    expect(nodeOfCall(1).startsWith(SendFetch.malaysiacors)).toBe(true);
    expect(showMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("neteaseRequest：全部节点失败", () => {
  beforeEach(() => {
    localStorage.clear();
    showMock.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("双节点风控时返回 null 并按风控提示一次", async () => {
    fetchMock
      .mockResolvedValueOnce(json200({ code: -462 }))
      .mockResolvedValueOnce(json200({ code: -462 }));

    const data = await callNeteaseRequest();

    expect(data).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(showMock).toHaveBeenCalledTimes(1);
    expect(String(showMock.mock.calls[0][0])).toContain("风控");
  });

  it("双节点 433 时返回 null 并按超时提示一次", async () => {
    fetchMock
      .mockResolvedValueOnce(httpStatus(433))
      .mockResolvedValueOnce(httpStatus(433));

    const data = await callNeteaseRequest();

    expect(data).toBeNull();
    expect(showMock).toHaveBeenCalledTimes(1);
    expect(String(showMock.mock.calls[0][0])).toContain("超时");
  });

  it.each([-460, 460])("双节点业务码 %s 时按风控提示一次", async (code) => {
    fetchMock
      .mockResolvedValueOnce(json200({ code }))
      .mockResolvedValueOnce(json200({ code }));

    const data = await callNeteaseRequest();

    expect(data).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(showMock).toHaveBeenCalledTimes(1);
    expect(String(showMock.mock.calls[0][0])).toContain("风控");
  });

  it.each([408, 504])("双节点 HTTP %s 时按超时提示一次", async (status) => {
    fetchMock
      .mockResolvedValueOnce(httpStatus(status))
      .mockResolvedValueOnce(httpStatus(status));

    const data = await callNeteaseRequest();

    expect(data).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(showMock).toHaveBeenCalledTimes(1);
    expect(String(showMock.mock.calls[0][0])).toContain("超时");
  });

  it("双节点其它 HTTP 错误时按通用失败文案提示一次", async () => {
    fetchMock
      .mockResolvedValueOnce(httpStatus(500))
      .mockResolvedValueOnce(httpStatus(500));

    const data = await callNeteaseRequest();

    expect(data).toBeNull();
    expect(showMock).toHaveBeenCalledTimes(1);
    expect(String(showMock.mock.calls[0][0])).toContain("请求失败");
    expect(String(showMock.mock.calls[0][0])).toContain("500");
  });

  it("前一节点的状态码不会污染后一节点的最终提示", async () => {
    fetchMock
      .mockResolvedValueOnce(httpStatus(500))
      .mockResolvedValueOnce(
        new Response("<html>gateway</html>", { status: 200 }),
      );

    const data = await callNeteaseRequest();

    expect(data).toBeNull();
    expect(showMock).toHaveBeenCalledTimes(1);
    expect(String(showMock.mock.calls[0][0])).toContain("请求失败");
    expect(String(showMock.mock.calls[0][0])).not.toContain("500");
  });

  it("同一原因的连续失败在 10 秒窗口内只提示一次", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(json200({ code: -462 }));

    await callNeteaseRequest();
    await callNeteaseRequest();

    expect(showMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_500);
    await callNeteaseRequest();

    expect(showMock).toHaveBeenCalledTimes(2);
  });

  it("网络异常时返回 null 并按网络原因提示一次", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const data = await callNeteaseRequest();

    expect(data).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(showMock).toHaveBeenCalledTimes(1);
    expect(String(showMock.mock.calls[0][0])).toContain("网络");
  });

  it("Dev 模式只有本地节点，失败后仅请求一次并提示一次", async () => {
    setNeteaseApi("Dev");
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const data = await callNeteaseRequest();

    expect(data).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(nodeOfCall(0).startsWith(SendFetch.devcors)).toBe(true);
    expect(showMock).toHaveBeenCalledTimes(1);
  });
});

describe("neteaseRequest：外部中止信号", () => {
  beforeEach(() => {
    localStorage.clear();
    showMock.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const hanging = (_url: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      );
    });

  it("请求期间外部中止：立即返回 null，不换节点、不提示、无残留定时器", async () => {
    fetchMock.mockImplementation(hanging);
    const abort = new AbortController();
    const pending = (SendFetch as any).neteaseRequest(
      URL_UNDER_TEST,
      POST_BODY,
      "GET",
      undefined,
      abort.signal,
    );
    await vi.advanceTimersByTimeAsync(100);
    abort.abort();
    await expect(pending).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(showMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("入口已中止：不发请求，直接返回 null", async () => {
    const abort = new AbortController();
    abort.abort();
    const data = await (SendFetch as any).neteaseRequest(
      URL_UNDER_TEST,
      POST_BODY,
      "GET",
      undefined,
      abort.signal,
    );
    expect(data).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(showMock).not.toHaveBeenCalled();
  });

  it("传了信号但未中止：超时仍按原逻辑换节点", async () => {
    fetchMock
      .mockImplementationOnce(hanging)
      .mockResolvedValueOnce(json200({ code: 200 }));
    const pending = (SendFetch as any).neteaseRequest(
      URL_UNDER_TEST,
      POST_BODY,
      "GET",
      undefined,
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toEqual({ code: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("getNeteaseSongDetail 中止后不再请求后续分段", async () => {
    const abort = new AbortController();
    fetchMock.mockImplementation(async () => {
      abort.abort();
      return json200({ code: 200, songs: [] });
    });
    const ids = Array.from({ length: 250 }, (_, i) => i + 1);
    const data = await NeteaseMusicAPI.getNeteaseSongDetail(ids, abort.signal);
    expect(data).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("端点方法：调用处只拼一层代理前缀", () => {
  beforeEach(() => {
    localStorage.clear();
    showMock.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getSongListDetail（GET）不带双层代理前缀并透传返回值", async () => {
    const body = { code: 200, playlist: { id: 42, trackIds: [] } };
    fetchMock.mockResolvedValueOnce(json200(body));

    const data = await NeteaseMusicAPI.getSongListDetail(42);

    expect(data).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(
      url.startsWith(
        `${SendFetch.cncors}https://music.163.com/api/v6/playlist/detail`,
      ),
    ).toBe(true);
    expect(url.split("proxy?url=").length).toBe(2);
    expect(url).toContain("id=42");
  });

  it("getNeteaseMusicSearchData（POST）不带双层代理前缀并透传返回值", async () => {
    const body = { code: 200, result: { songs: [{ id: 1 }] } };
    fetchMock.mockResolvedValueOnce(json200(body));

    const data = await NeteaseSearchAPI.getNeteaseMusicSearchData(
      "周杰伦",
      1000,
      0,
    );

    expect(data).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(url).toBe(
      `${SendFetch.cncors}https://music.163.com/weapi/search/get`,
    );
    expect(url.split("proxy?url=").length).toBe(2);
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect((init.body as URLSearchParams).get("params")).toBeTruthy();
    expect((init.body as URLSearchParams).get("encSecKey")).toBeTruthy();
  });
});
