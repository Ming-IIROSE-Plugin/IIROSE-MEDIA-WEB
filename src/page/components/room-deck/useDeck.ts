// 面板底部条的全部状态逻辑（story 3）：只读共享页面级 `MediaSession`，
// 不新建桥接、不新建模式机、不新建轮询。视图组件（RoomDeck / DeckProgress / ModeToggle）
// 保持无状态，开关的可用性提示、待命说明与 10 秒同因去重都在这里，与侧栏行同语义。
import { useEffect, useRef, useState } from "preact/hooks";
import { ShowMessage } from "../../../iirose_func/ShowMessage";
import {
  mediaSession,
  subscribeMediaSession,
  type MediaSessionHandle,
} from "../../../media-progress/MediaSession";
import {
  ProgressSession,
  type ProgressState,
} from "../../../media-progress/ProgressSession";
import {
  unavailableReason,
  type MediaSnapshot,
} from "../../../media-progress/model";
import type {
  PlaybackModeKind,
  PlaybackModeState,
} from "../../../playback/PlaybackMode";

export interface DeckModel {
  media: MediaSnapshot;
  progress: ProgressState;
  playback: PlaybackModeState;
  /** 可跳转 = `unavailableReason(media) === ""`（权限、连接、在播、有总时长）。 */
  seekable: boolean;
  /** 直播 / 电台流：在播且没有总时长。不可跳转，进度只显示已播时长。 */
  live: boolean;
  /** 房间无播放：只留标题位与模式开关。 */
  idle: boolean;
  /** 读屏状态区文本：待命原因、最后一条会话消息与点击提示并列拼出。 */
  status: string;
  toggle: (kind: PlaybackModeKind, returnFocus?: HTMLElement | null) => void;
  progressSession: ProgressSession;
}

/** 同一原因 10 秒内只提示一次（与 `neteaseRequest` 批量失败同一窗口）。 */
const NOTICE_INTERVAL = 10_000;
const FALLBACK_NOTICE = "暂时无法调整播放模式";

/**
 * 订阅会话 → 建一个 `ProgressSession` → 订 `PlaybackMode.state`。
 * 会话或进度任一未就绪时返回 null（底部条不渲染）：快照只有一个订阅来源
 * （`ProgressSession`），不在渲染期自己 `read()`，避免出现两份互不同步的状态。
 * 会话提供后订阅回调立即触发，无需重开面板。
 */
export function useDeck(): DeckModel | null {
  const [session, setSession] = useState<MediaSessionHandle | null>(
    mediaSession,
  );
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [progressSession, setProgressSession] =
    useState<ProgressSession | null>(null);
  const [playback, setPlayback] = useState<PlaybackModeState | null>(null);
  const [notice, setNotice] = useState("");
  /** 本次待命期间是否已当面说明过原因：首次点按只说明，再点才熄灭。 */
  const standby = useRef(false);
  const explained = useRef(false);
  const notices = useRef(new Map<string, number>());

  useEffect(() => subscribeMediaSession(setSession), []);

  useEffect(() => {
    if (!session) {
      setPlayback(null);
      return undefined;
    }
    return session.playback.subscribe((state) => {
      // 待命状态一变就重新允许「首次点按只说明」。
      if (state.standby !== standby.current) {
        standby.current = state.standby;
        explained.current = false;
      }
      setPlayback(state);
    });
  }, [session]);

  useEffect(() => {
    if (!session) {
      setProgressSession(null);
      setProgress(null);
      return undefined;
    }
    const active = new ProgressSession(session.bridge, setProgress);
    setProgressSession(active);
    setProgress(active.state);
    return () => {
      active.dispose();
      setProgressSession((current) => (current === active ? null : current));
      setProgress(null);
    };
  }, [session]);

  const message = (text: string, dedupe = true) => {
    const now = Date.now();
    // 键是原因文案，随会话增长：写入前先丢弃已过窗口的旧键。
    for (const [reason, at] of notices.current)
      if (now - at >= NOTICE_INTERVAL) notices.current.delete(reason);
    if (dedupe && notices.current.has(text)) return;
    if (dedupe) notices.current.set(text, now);
    setNotice(text);
    ShowMessage.show(text);
  };

  const toggle = (kind: PlaybackModeKind, returnFocus?: HTMLElement | null) => {
    if (!session) return;
    const mode = session.playback;
    const availability = mode.state[kind];
    if (!availability.enabled) {
      message(availability.reason || FALLBACK_NOTICE);
      return;
    }
    const state = mode.state;
    // 已点亮但待命：首次点按只说明原因，再点才熄灭（触屏没有悬停，title 读不到）。
    if (state.mode === kind && state.standby && !explained.current) {
      explained.current = true;
      message(state.standbyReason, false);
      return;
    }
    // 熄灭态随机：先开选择面板，确认后才点亮；取消什么都不改。
    if (kind === "shuffle" && state.mode !== kind) {
      session.pickShuffle(() => {
        const next = mode.state.shuffle;
        // 面板打开期间可能换房、断线或收藏清空：确认后再判一次。
        if (!next.enabled) {
          message(next.reason || FALLBACK_NOTICE);
          return;
        }
        if (mode.state.mode === "shuffle") return;
        mode.toggle("shuffle");
        const after = mode.state;
        if (after.mode === "shuffle" && after.standby) {
          explained.current = true;
          message(after.standbyReason, false);
        }
      }, returnFocus);
      return;
    }
    mode.toggle(kind);
    // 亲手点亮即进入待命：当场说明，下一次点按直接熄灭。
    const next = mode.state;
    if (next.mode === kind && next.standby) {
      explained.current = true;
      message(next.standbyReason, false);
    }
  };

  // 快照、进度会话都就绪后才出模型：媒体信息只从 `progress` 取。
  if (!session || !progress || !progressSession) return null;
  const playbackState = playback ?? session.playback.state;
  const live = progress.media.playing && progress.media.duration === null;

  // 三条来源并列拼出，旧的一条不会把后到的那条盖住；同样的文本只留一份。
  const parts = [playbackState.standbyReason, progress?.message, notice].filter(
    (text): text is string => !!text,
  );
  const status = [...new Set(parts)].join("；");

  return {
    media: progress.media,
    progress,
    playback: playbackState,
    seekable: unavailableReason(progress.media) === "",
    live,
    idle: !progress.media.playing,
    status,
    toggle,
    progressSession,
  };
}
