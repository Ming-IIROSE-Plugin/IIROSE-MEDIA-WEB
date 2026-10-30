// 点播守卫：面板内所有手动点播入口（曲目行、网格卡、视频卡、操作条、收藏、
// 最近点播、电台、歌单「全部播放」）都经过这里。
// - 进行中加锁：同一条目的点播报文还没发出，再点无效（防连点刷屏）；
//   报文一发出立刻解锁，可以再点。不同条目互不影响。
// - 结果判定不改平台层：以 `Socket.send` 观察到的 `&1` 点播报文为「真的发出去了」，
//   以平台层弹出的提示（ShowMessage）为「失败」；两者都没有（如弹出了选集面板、
//   正序/乱序菜单）按「交给下一步」回到空闲，不算失败。

import { ShowMessage } from "../iirose_func/ShowMessage";
import { FavoritesStorageService } from "../storage/FavoritesStorageService";

export type RequestStatus = "idle" | "pending" | "failed";
export type RequestOutcome = "sent" | "failed" | "handoff" | "busy";

/** 「重试」停留时长。 */
export const FAILED_SHOW_MS = 3_000;
/** 平台函数已返回但报文还没到时，再等多久。 */
const LATE_SEND_GRACE_MS = 1_500;

export interface RequestToast {
  id: number;
  text: string;
}

interface Pending {
  key: string;
  sent: boolean;
  /** 等晚到报文时挂上：报文一到立刻结束等待。 */
  onSent?: () => void;
}

const status = new Map<string, RequestStatus>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const queue: Pending[] = [];
const statusListeners = new Set<() => void>();
const toastListeners = new Set<(toast: RequestToast) => void>();
let toastSeq = 0;

/** 条目的稳定键：能收藏的条目用收藏 id，其余（电台、直播等）退化为标题 + 作者 + 封面。 */
export function requestKey(data: PlatformData): string {
  const fav = FavoritesStorageService.deriveFavoriteId(data);
  if (fav) return `${fav.platform}:${fav.type}:${fav.id}`;
  return `t:${data.title}|${data.author ?? ""}|${data.coverImg ?? ""}`;
}

export function getRequestStatus(key: string): RequestStatus {
  return status.get(key) ?? "idle";
}

export function subscribeRequestStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function subscribeRequestToast(
  listener: (toast: RequestToast) => void,
): () => void {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

function emitToast(text: string): void {
  const toast = { id: ++toastSeq, text };
  toastListeners.forEach((listener) => listener(toast));
}

function setStatus(key: string, next: RequestStatus, resetAfter?: number) {
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
  if (next === "idle") status.delete(key);
  else status.set(key, next);
  if (resetAfter !== undefined) {
    timers.set(
      key,
      setTimeout(() => setStatus(key, "idle"), resetAfter),
    );
  }
  statusListeners.forEach((listener) => listener());
}

/**
 * `Socket.send` 观察钩子调用：一条 `&1` 点播报文记给最早一个还没收到报文的点播。
 * 整张歌单会连发多条，只有第一条起作用。
 */
export function noteMediaSent(payload: string): void {
  if (!payload.startsWith("&1")) return;
  const waiting = queue.find((item) => !item.sent);
  if (!waiting) return;
  waiting.sent = true;
  waiting.onSent?.();
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  !!value && typeof (value as PromiseLike<unknown>).then === "function";

/** 等晚到的报文：到了立刻返回，最多等 LATE_SEND_GRACE_MS。 */
const waitForSend = (entry: Pending) =>
  new Promise<void>((resolve) => {
    entry.onSent = resolve;
    setTimeout(resolve, LATE_SEND_GRACE_MS);
  });

/**
 * 守卫一次点播。`run` 是平台点播函数；它不返回 Promise 时（弹菜单类入口）
 * 不加锁也不判结果，直接放行。
 */
export async function guardedRequest(
  data: PlatformData,
  run: (data: PlatformData) => unknown,
  key: string = requestKey(data),
  options: { minPendingMs?: number } = {},
): Promise<RequestOutcome> {
  if (getRequestStatus(key) === "pending") return "busy";

  const messagesBefore = ShowMessage.shownCount;
  const entry: Pending = { key, sent: false };
  queue.push(entry);
  let threw = false;
  let result: unknown;
  try {
    result = run(data);
  } catch {
    threw = true;
  }

  if (!threw && !isThenable(result)) {
    queue.splice(queue.indexOf(entry), 1);
    return "handoff";
  }

  setStatus(key, "pending");
  const startedAt = Date.now();
  // 电台这类几乎瞬间发出的入口：转圈至少停留 minPendingMs，不至于一闪而过
  const holdMinimum = async () => {
    const rest = (options.minPendingMs ?? 0) - (Date.now() - startedAt);
    if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest));
  };
  const finishSent = async (): Promise<RequestOutcome> => {
    queue.splice(queue.indexOf(entry), 1);
    await holdMinimum();
    setStatus(key, "idle");
    emitToast(`已点播《${data.title}》`);
    return "sent";
  };

  // 报文可能在平台函数里同步发出（等待还没挂上）：先查一次
  if (entry.sent) return finishSent();
  // 第一条报文一发出就结束转圈（整张歌单会继续在后台连发），不等平台函数整体返回。
  const firstSend = new Promise<"sent">((resolve) => {
    entry.onSent = () => resolve("sent");
  });
  const settled = threw
    ? Promise.resolve<"threw">("threw")
    : Promise.resolve(result).then(
        () => "settled" as const,
        () => "threw" as const,
      );
  const first = await Promise.race([firstSend, settled]);
  if (first === "sent" || entry.sent) return finishSent();
  if (first === "threw") threw = true;
  else await waitForSend(entry);
  if (entry.sent) return finishSent();
  queue.splice(queue.indexOf(entry), 1);

  if (threw || ShowMessage.shownCount > messagesBefore) {
    setStatus(key, "failed", FAILED_SHOW_MS);
    return "failed";
  }
  setStatus(key, "idle");
  return "handoff";
}

/** 测试用：清空全部状态。 */
export function resetRequestGuard(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  status.clear();
  queue.length = 0;
  statusListeners.clear();
  toastListeners.clear();
}
