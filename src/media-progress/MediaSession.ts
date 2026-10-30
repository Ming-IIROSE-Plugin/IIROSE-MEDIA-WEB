// 页面级媒体会话注册表：`HostMediaBridge`（250ms 轮询 + 宿站钩子）与 `PlaybackMode`
// 都由 `initMediaProgress()` 创建，而面板底部条活在 Preact 树里、挂载时可能还没有会话。
// 这里只做引用共享 + 订阅，不持有时钟、不新建桥接：面板经它只读复用页面单例。
import type { PlaybackMode } from "../playback/PlaybackMode";
import type { HostMediaBridge } from "./HostMediaBridge";

export interface MediaSessionHandle {
  bridge: HostMediaBridge;
  playback: PlaybackMode;
  /**
   * 随机点亮前的选择步骤（与侧栏行同一条接线）：确认后调 `done()` 才点亮；
   * `returnFocus` 是关闭面板后应归还焦点的触发元素。
   */
  pickShuffle: (done: () => void, returnFocus?: HTMLElement | null) => void;
}

export type MediaSessionListener = (session: MediaSessionHandle | null) => void;

let current: MediaSessionHandle | null = null;
const listeners = new Set<MediaSessionListener>();

function notify(): void {
  for (const listener of [...listeners]) listener(current);
}

/** 登记页面会话（重复登记同一份引用不重复通知）。 */
export function provideMediaSession(session: MediaSessionHandle): void {
  if (current === session) return;
  current = session;
  notify();
}

/**
 * 释放会话。传了引用时只清自己（后注入者接管后不能清掉新实例）；
 * 重复释放、释放未登记的引用都不做任何事。
 */
export function releaseMediaSession(session?: MediaSessionHandle): void {
  if (!current) return;
  if (session && current !== session) return;
  current = null;
  notify();
}

/** 当前会话；底部条首次挂载读它，未提供时为 null（不渲染）。 */
export function mediaSession(): MediaSessionHandle | null {
  return current;
}

/** 订阅会话变化；订阅时立即回调一次当前值（含 null）。 */
export function subscribeMediaSession(
  listener: MediaSessionListener,
): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
