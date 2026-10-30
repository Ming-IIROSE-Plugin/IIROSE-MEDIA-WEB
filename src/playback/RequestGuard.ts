// 点播守卫：面板内所有手动点播入口（曲目行、网格卡、视频卡、操作条、收藏、
// 最近点播、电台、歌单「全部播放」）都经过这里。
// - 进行中加锁：同一条目还没发完，再点无效（防连点刷屏）。
// - 冷却：同一条目发出后 COOLDOWN_MS 内再点只提示，不再发送；不同条目互不影响。
// - 结果判定不改平台层：以 `Socket.send` 观察到的 `&1` 点播报文为「真的发出去了」，
//   以平台层弹出的提示（ShowMessage）为「失败」；两者都没有（如弹出了选集面板、
//   正序/乱序菜单）按「交给下一步」回到空闲，不算失败。

import { ShowMessage } from "../iirose_func/ShowMessage";
import { FavoritesStorageService } from "../storage/FavoritesStorageService";

export type RequestStatus = "idle" | "pending" | "sent" | "failed";
export type RequestOutcome =
  "sent" | "failed" | "handoff" | "busy" | "cooldown";

/** 同一条目发出后多久内不能再点。 */
export const COOLDOWN_MS = 10_000;
/** 「已点播」停留时长。 */
export const SENT_SHOW_MS = 1_500;
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
const sentAt = new Map<string, number>();
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
): Promise<RequestOutcome> {
  if (getRequestStatus(key) === "pending") return "busy";
  const last = sentAt.get(key);
  if (last !== undefined && Date.now() - last < COOLDOWN_MS) {
    emitToast(`刚刚点过《${data.title}》了，稍等一会儿`);
    return "cooldown";
  }

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
  try {
    if (!threw) await result;
  } catch {
    threw = true;
  }
  if (!entry.sent && !threw) await waitForSend(entry);
  queue.splice(queue.indexOf(entry), 1);

  if (entry.sent) {
    sentAt.set(key, Date.now());
    setStatus(key, "sent", SENT_SHOW_MS);
    emitToast(`已点播《${data.title}》`);
    return "sent";
  }
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
  sentAt.clear();
  queue.length = 0;
  statusListeners.clear();
  toastListeners.clear();
}
