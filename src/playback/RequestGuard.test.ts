import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAILED_SHOW_MS,
  getRequestStatus,
  guardedRequest,
  noteMediaSent,
  requestKey,
  resetRequestGuard,
  subscribeRequestToast,
} from "./RequestGuard";
import { ShowMessage } from "../iirose_func/ShowMessage";

const item = (title: string): PlatformData =>
  ({ title, author: "歌手", coverImg: "" }) as PlatformData;

/** 模拟平台点播：异步发出一条 `&1` 报文。 */
const sends = () => async () => {
  await Promise.resolve();
  noteMediaSent('&1{"s":"x"}');
};

describe("RequestGuard", () => {
  let toasts: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    resetRequestGuard();
    toasts = [];
    subscribeRequestToast((toast) => toasts.push(toast.text));
    window._alert = () => {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("发出报文：点播中 → 立刻回到空闲，并提示已点播", async () => {
    const song = item("太聪明");
    const run = guardedRequest(song, sends());
    expect(getRequestStatus(requestKey(song))).toBe("pending");
    await expect(run).resolves.toBe("sent");
    expect(getRequestStatus(requestKey(song))).toBe("idle");
    expect(toasts).toEqual(["已点播《太聪明》"]);
  });

  it("点播中再点：不再调用平台函数", async () => {
    const song = item("鱼");
    const platform = vi.fn(sends());
    const first = guardedRequest(song, platform);
    await expect(guardedRequest(song, platform)).resolves.toBe("busy");
    await first;
    expect(platform).toHaveBeenCalledTimes(1);
  });

  it("发出后可以立刻再点（没有冷却）", async () => {
    const song = item("晴天");
    const platform = vi.fn(sends());
    await guardedRequest(song, platform);
    await expect(guardedRequest(song, platform)).resolves.toBe("sent");
    expect(platform).toHaveBeenCalledTimes(2);
  });

  it("第一条报文一发出就解锁，不等整张歌单发完", async () => {
    const album = item("整张");
    let finish!: () => void;
    const run = guardedRequest(album, () => {
      noteMediaSent("&1{}");
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    await expect(run).resolves.toBe("sent");
    expect(getRequestStatus(requestKey(album))).toBe("idle");
    finish();
  });

  it("最短转圈时长：报文瞬间发出也至少停留 minPendingMs", async () => {
    const radio = item("电台");
    const run = guardedRequest(radio, sends(), undefined, {
      minPendingMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(getRequestStatus(requestKey(radio))).toBe("pending");
    await vi.advanceTimersByTimeAsync(500);
    await expect(run).resolves.toBe("sent");
    expect(getRequestStatus(requestKey(radio))).toBe("idle");
  });

  it("不同条目互不影响", async () => {
    await guardedRequest(item("A"), sends());
    await expect(guardedRequest(item("B"), sends())).resolves.toBe("sent");
  });

  it("平台层弹出失败提示且没有报文：重试，过后回到空闲", async () => {
    const song = item("失败曲");
    const run = guardedRequest(song, async () => {
      ShowMessage.show("获取音源失败");
    });
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(run).resolves.toBe("failed");
    expect(getRequestStatus(requestKey(song))).toBe("failed");
    vi.advanceTimersByTime(FAILED_SHOW_MS);
    expect(getRequestStatus(requestKey(song))).toBe("idle");
  });

  it("平台函数抛错：重试", async () => {
    const run = guardedRequest(item("抛错"), async () => {
      throw new Error("x");
    });
    await expect(run).resolves.toBe("failed");
  });

  it("不返回 Promise 的入口（弹菜单）：放行，不加锁", async () => {
    const song = item("歌单");
    await expect(guardedRequest(song, () => undefined)).resolves.toBe(
      "handoff",
    );
    expect(getRequestStatus(requestKey(song))).toBe("idle");
  });

  it("Promise 结束但没有报文也没有提示（如弹出选集面板）：回到空闲，不算失败", async () => {
    const song = item("多P");
    const run = guardedRequest(song, async () => {});
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(run).resolves.toBe("handoff");
    expect(getRequestStatus(requestKey(song))).toBe("idle");
  });

  it("报文晚于平台函数返回到达：仍算发出", async () => {
    const song = item("晚到");
    const run = guardedRequest(song, async () => {
      setTimeout(() => noteMediaSent("&1{}"), 500);
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(run).resolves.toBe("sent");
  });

  it("非点播报文不算发出", async () => {
    const run = guardedRequest(item("卡片"), async () => {
      noteMediaSent('{"m":"m__4@0>..."}');
    });
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(run).resolves.toBe("handoff");
  });
});
