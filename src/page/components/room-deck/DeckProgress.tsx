// 底部条 / 展开的底部条共用的进度部件（DESIGN.md `room-deck` 中栏）。
// 可跳转时是 `role="slider"`：指针拖动走 `ProgressSession.begin/preview/commit`，
// 取消走 `cancel`；←→ 每次 5 秒、Shift ∓30 秒。不可跳转（无权限、直播、未在播）
// 时不渲染拖柄、不带 `role="slider"`、不可聚焦，点击与拖动都不发报文。
import { useEffect, useRef } from "preact/hooks";
import type {
  ProgressSession,
  ProgressState,
} from "../../../media-progress/ProgressSession";
import { clamp, formatTime } from "../../../media-progress/model";
import {
  deskDeckProgress,
  deskDeckThumbRing,
  deskDeckTrack,
  deskFocusRingOnDeck,
  deskRoseFill,
  typeMonoNumSm,
} from "../floating-panel/tokens";

export interface DeckProgressProps {
  state: ProgressState;
  session: ProgressSession;
  seekable: boolean;
  className?: string;
}

const STEP = 5;
const STEP_LARGE = 30;

export function DeckProgress({
  state,
  session,
  seekable,
  className = "",
}: DeckProgressProps) {
  const track = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const media = state.media;
  const duration = media.duration ?? 0;
  // 没有当前时间也没有预览时不留 0:00 与空轨：与迷你条（不显示时间）口径一致。
  const current = state.preview ?? media.current;
  const position = current === null ? 0 : clamp(current, 0, duration);
  const ratio = duration > 0 ? position / duration : 0;

  // 窗口失焦 = 手势被打断：回到原时间，不提交。
  useEffect(() => {
    if (!seekable) return undefined;
    const cancel = () => {
      if (pointer.current === null) return;
      pointer.current = null;
      session.cancel();
    };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, [session, seekable]);

  const targetOf = (clientX: number) => {
    const element = track.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (!rect.width) return null;
    return ((clientX - rect.left) / rect.width) * duration;
  };

  const slider = seekable
    ? {
        role: "slider" as const,
        tabIndex: 0,
        // 本人点播模式下调整会在房间发公聊消息：与进度浮窗同一句提示。
        title: media.controlNotice || undefined,
        "aria-label": "媒体播放位置",
        "aria-valuemin": 0,
        "aria-valuemax": Math.round(duration),
        "aria-valuenow": Math.round(position),
        "aria-valuetext": `${formatTime(current)} / ${formatTime(duration)}`,
        onPointerDown: (event: PointerEvent) => {
          if (!event.isPrimary || event.button !== 0) return;
          if (!session.begin()) return;
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
          pointer.current = event.pointerId;
          (event.currentTarget as HTMLElement).setPointerCapture?.(
            event.pointerId,
          );
          const target = targetOf(event.clientX);
          if (target !== null) session.preview(target);
        },
        onPointerMove: (event: PointerEvent) => {
          if (pointer.current !== event.pointerId) return;
          const target = targetOf(event.clientX);
          if (target !== null) session.preview(target);
        },
        onPointerUp: (event: PointerEvent) => {
          if (pointer.current !== event.pointerId) return;
          pointer.current = null;
          const target = targetOf(event.clientX);
          if (target !== null) session.preview(target);
          session.commit();
        },
        onPointerCancel: () => {
          if (pointer.current === null) return;
          pointer.current = null;
          session.cancel();
        },
        onLostPointerCapture: () => {
          if (pointer.current === null) return;
          pointer.current = null;
          session.cancel();
        },
        onKeyDown: (event: KeyboardEvent) => {
          if (event.isComposing) return;
          const step = event.shiftKey ? STEP_LARGE : STEP;
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          session.step(event.key === "ArrowRight" ? step : -step);
        },
      }
    : {};

  return (
    <div className={`flex w-full items-center gap-3 ${className}`}>
      <span className={`shrink-0 opacity-80 ${typeMonoNumSm}`}>
        {formatTime(current)}
      </span>
      <div
        ref={track}
        {...slider}
        data-imw-deck-track="true"
        className={`group relative flex h-11 min-w-0 flex-1 touch-none items-center ${
          seekable ? `cursor-pointer ${deskFocusRingOnDeck}` : ""
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full ${deskDeckTrack}`}
        />
        {/* 填充与拖柄每 250ms 改一次宽度/位置：显式 `transition: none`，拖动预览不滞后。 */}
        <span
          aria-hidden="true"
          data-imw-deck-fill="true"
          className={`absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full ${deskDeckProgress}`}
          style={{ width: `${ratio * 100}%`, transition: "none" }}
        />
        {seekable && (
          <span
            aria-hidden="true"
            className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 hov:group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 max-[768px]:opacity-100 ${deskRoseFill} ${deskDeckThumbRing}`}
            style={{ left: `${ratio * 100}%`, transition: "none" }}
          />
        )}
      </div>
      <span className={`shrink-0 opacity-80 ${typeMonoNumSm}`}>
        {formatTime(duration || null)}
      </span>
    </div>
  );
}
