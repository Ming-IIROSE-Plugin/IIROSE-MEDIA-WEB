import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mediaSession,
  provideMediaSession,
  releaseMediaSession,
  subscribeMediaSession,
  type MediaSessionHandle,
} from "./MediaSession";
import { HostMediaBridge } from "./HostMediaBridge";
import { PlaybackMode } from "../playback/PlaybackMode";

function handle(): MediaSessionHandle {
  return {
    bridge: new HostMediaBridge({}),
    playback: new PlaybackMode(),
    pickShuffle: vi.fn(),
  };
}

afterEach(() => {
  releaseMediaSession();
});

describe("页面级媒体会话注册表", () => {
  it("未提供时为空；provide 后立刻可读并通知订阅者", () => {
    const seen: (MediaSessionHandle | null)[] = [];
    const stop = subscribeMediaSession((session) => seen.push(session));
    expect(mediaSession()).toBeNull();
    expect(seen).toEqual([null]);

    const session = handle();
    provideMediaSession(session);
    expect(mediaSession()).toBe(session);
    expect(seen).toEqual([null, session]);
    stop();
  });

  it("订阅时立即回调当前值，退订后不再通知", () => {
    const session = handle();
    provideMediaSession(session);
    const listener = vi.fn();
    const stop = subscribeMediaSession(listener);
    expect(listener).toHaveBeenCalledExactlyOnceWith(session);

    stop();
    releaseMediaSession();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("重复提供同一份引用不重复通知", () => {
    const session = handle();
    const listener = vi.fn();
    subscribeMediaSession(listener);
    provideMediaSession(session);
    provideMediaSession(session);
    expect(listener.mock.calls.map((call) => call[0])).toEqual([null, session]);
  });

  it("释放：重复释放安全，释放未登记的引用不影响当前会话", () => {
    const session = handle();
    provideMediaSession(session);
    releaseMediaSession(handle());
    expect(mediaSession()).toBe(session);

    releaseMediaSession(session);
    expect(mediaSession()).toBeNull();
    expect(() => releaseMediaSession(session)).not.toThrow();
    expect(mediaSession()).toBeNull();
  });

  it("只清自己：后注入者接管后，旧实例的释放不摘掉新会话", () => {
    const previous = handle();
    const next = handle();
    provideMediaSession(previous);
    provideMediaSession(next);

    releaseMediaSession(previous);
    expect(mediaSession()).toBe(next);

    releaseMediaSession();
    expect(mediaSession()).toBeNull();
  });
});
