import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { HostMediaBridge } from "../../../media-progress/HostMediaBridge";
import {
  ProgressSession,
  ProgressState,
} from "../../../media-progress/ProgressSession";
import {
  constrainPosition,
  formatTime,
  unavailableReason,
  type MediaProgressPosition,
} from "../../../media-progress/model";
import {
  currentViewportPosition,
  pointerPosition,
} from "../../../media-progress/viewport";
import {
  DragGrip,
  PanelHeader,
  panelFrame,
  panelTheme,
  secondaryButton,
  startsOnControl,
  stopHostGestures,
  Svg,
  type DragHandleProps,
} from "../floating-panel/floatingPanel";

// 快进快退：共享的描边次要按钮，保留原有尺寸、字号与禁用态。
const stepClass = (dark: boolean) =>
  `${secondaryButton(dark)} min-w-[44px] px-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-35`;

const ClockIcon = () => (
  <Svg size={22}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

function samePosition(
  first: MediaProgressPosition,
  second: MediaProgressPosition,
) {
  return first.x === second.x && first.y === second.y;
}

export function MediaProgress({
  bridge,
  close,
  initialPosition,
  onPositionChange,
}: {
  bridge: HostMediaBridge;
  close: () => void;
  initialPosition?: MediaProgressPosition;
  onPositionChange?: (position: MediaProgressPosition) => void;
}) {
  const [state, setState] = useState<ProgressState>({
    media: bridge.read(),
    preview: null,
    waiting: false,
    message: "",
  });
  const [position, setPosition] = useState<MediaProgressPosition>(
    initialPosition ?? { x: 12, y: 80 },
  );
  const [dragging, setDragging] = useState(false);
  const [failedCover, setFailedCover] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const positionRef = useRef(position);
  const onPositionChangeRef = useRef(onPositionChange ?? (() => {}));
  const session = useRef<ProgressSession>();
  const move = useRef<{
    pointer: number;
    x: number;
    y: number;
    left: number;
    top: number;
  }>();
  const seekPointer = useRef<number>();
  const inputSource = useRef<"pointer" | "keyboard" | "native" | null>(null);
  const trailingChange = useRef<ReturnType<typeof setTimeout>>();
  const startInput = (source: "pointer" | "keyboard" | "native") => {
    clearTimeout(trailingChange.current);
    trailingChange.current = undefined;
    inputSource.current = source;
  };
  const finishInput = () => {
    if (inputSource.current === null) return;
    inputSource.current = null;
    seekPointer.current = undefined;
    // 只屏蔽本轮事件的尾随 change；下一任务或明确的新手势可重新开始。
    clearTimeout(trailingChange.current);
    trailingChange.current = setTimeout(() => {
      trailingChange.current = undefined;
    }, 0);
  };
  const media = state.media;
  const unavailable = unavailableReason(media);
  const disabled = !!unavailable || state.waiting;
  const time = state.preview ?? media.current;
  onPositionChangeRef.current = onPositionChange ?? (() => {});

  const updatePosition = (next: MediaProgressPosition) => {
    const previous = positionRef.current;
    if (samePosition(previous, next)) return;
    positionRef.current = next;
    setPosition(next);
    onPositionChangeRef.current(next);
  };

  useEffect(() => {
    const active = new ProgressSession(bridge, (next) => {
      if (next.preview === null) finishInput();
      setState(next);
    });
    session.current = active;
    panel.current?.focus();
    const cancel = () => {
      active.cancel();
      seekPointer.current = undefined;
      move.current = undefined;
      setDragging(false);
    };
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("blur", cancel);
      active.dispose();
      clearTimeout(trailingChange.current);
      trailingChange.current = undefined;
      inputSource.current = null;
      seekPointer.current = undefined;
      session.current = undefined;
    };
  }, [bridge]);

  useLayoutEffect(() => {
    const constrain = () => {
      const element = panel.current;
      if (!element) return;
      if (move.current) {
        move.current = undefined;
        setDragging(false);
      }
      // 宿站通过 zoom 缩放 iframe 文档；offset 尺寸与 client 坐标转换用实测比例。
      const {
        metrics,
        offsetLeft: viewportOffsetX,
        offsetTop: viewportOffsetY,
      } = currentViewportPosition(element);
      element.style.maxWidth = `${Math.max(0, metrics.width - 24)}px`;
      element.style.maxHeight = `${Math.max(0, metrics.height - 24)}px`;
      updatePosition(
        constrainPosition(
          positionRef.current.x,
          positionRef.current.y,
          element.offsetWidth,
          element.offsetHeight,
          metrics.width,
          metrics.height,
          viewportOffsetX,
          viewportOffsetY,
        ),
      );
    };
    constrain();
    window.addEventListener("resize", constrain);
    window.addEventListener("scroll", constrain, { passive: true });
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", constrain);
    viewport?.addEventListener("scroll", constrain);
    const observer = new ResizeObserver(constrain);
    if (panel.current) observer.observe(panel.current);
    return () => {
      window.removeEventListener("resize", constrain);
      window.removeEventListener("scroll", constrain);
      viewport?.removeEventListener("resize", constrain);
      viewport?.removeEventListener("scroll", constrain);
      observer.disconnect();
    };
  }, []);

  const pointerTarget = (element: HTMLInputElement, clientX: number) => {
    const rect = element.getBoundingClientRect();
    session.current?.preview(
      ((clientX - rect.left) / rect.width) * (media.duration || 0),
    );
  };

  const dragHandle: DragHandleProps = {
    onPointerDown: (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      // 关闭钮在头部行内：在它上面按下不拖动。
      if (startsOnControl(event)) return;
      const pointer = pointerPosition(
        panel.current!,
        event.clientX,
        event.clientY,
      );
      move.current = {
        pointer: event.pointerId,
        x: pointer.x,
        y: pointer.y,
        left: positionRef.current.x,
        top: positionRef.current.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    },
    onPointerMove: (event) => {
      const start = move.current;
      const element = panel.current;
      if (!start || start.pointer !== event.pointerId || !element) return;
      const pointer = pointerPosition(element, event.clientX, event.clientY);
      const { metrics, offsetLeft, offsetTop } =
        currentViewportPosition(element);
      updatePosition(
        constrainPosition(
          start.left + pointer.x - start.x,
          start.top + pointer.y - start.y,
          element.offsetWidth,
          element.offsetHeight,
          metrics.width,
          metrics.height,
          offsetLeft,
          offsetTop,
        ),
      );
    },
    onPointerUp: () => {
      move.current = undefined;
      setDragging(false);
    },
    onPointerCancel: () => {
      move.current = undefined;
      setDragging(false);
    },
    onLostPointerCapture: () => {
      move.current = undefined;
      setDragging(false);
    },
  };

  return (
    <div
      ref={panel}
      id="imw-media-progress"
      role="dialog"
      aria-labelledby="imw-media-progress-title"
      tabIndex={-1}
      className={`fixed z-[90001] w-[320px] overflow-auto font-sans text-[14px] max-[768px]:w-[320px] ${panelFrame} ${panelTheme(media.dark)}`}
      style={{ left: position.x, top: position.y }}
      {...stopHostGestures}
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          event.isComposing ||
          event.defaultPrevented
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (session.current?.state.preview !== null && session.current) {
          session.current.cancel();
          seekPointer.current = undefined;
        } else if (!event.repeat) close();
      }}
    >
      <DragGrip dragging={dragging} handle={dragHandle} />
      <PanelHeader
        icon={<ClockIcon />}
        title="播放进度"
        titleId="imw-media-progress-title"
        closeLabel="关闭播放进度"
        onClose={close}
        dragging={dragging}
        handle={dragHandle}
      />
      <div className="px-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sky-500/15">
            {media.playing && media.cover && failedCover !== media.cover ? (
              <img
                className="h-full w-full object-cover"
                src={media.cover}
                alt=""
                onError={() => setFailedCover(media.cover)}
              />
            ) : (
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
              >
                <path d="M9 18V5l11-2v13M9 8l11-2" />
                <ellipse cx="6" cy="18" rx="3" ry="2.5" />
                <ellipse cx="17" cy="16" rx="3" ry="2.5" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-semibold"
              title={media.playing ? media.title : "暂无播放内容"}
            >
              {media.playing ? media.title : "暂无播放内容"}
            </div>
            <div className="mt-1 text-[12px] tabular-nums opacity-65">
              {formatTime(media.playing ? time : null)} /{" "}
              {formatTime(media.playing ? media.duration : null)}
              {state.preview !== null ? " · 预览" : ""}
            </div>
          </div>
        </div>
        <input
          type="range"
          aria-label="媒体播放位置"
          aria-valuetext={`${formatTime(time)} / ${formatTime(media.duration)}`}
          min={0}
          max={media.duration || 1}
          step={1}
          value={time ?? 0}
          disabled={disabled}
          className="m-0 mt-2 h-[44px] w-full touch-none cursor-pointer accent-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          onInput={(event) => {
            if (
              seekPointer.current !== undefined ||
              (inputSource.current === "keyboard" &&
                session.current?.state.preview !== null)
            )
              return;
            const active = session.current;
            if (!active || active.state.waiting) return;
            const target = event.currentTarget.valueAsNumber;
            if (active.state.preview === null && !active.begin()) return;
            startInput("native");
            active.preview(target);
          }}
          onChange={(event) => {
            if (
              inputSource.current === "pointer" ||
              inputSource.current === "keyboard" ||
              trailingChange.current !== undefined
            )
              return;
            const active = session.current;
            if (!active || active.state.waiting) return;
            const target = event.currentTarget.valueAsNumber;
            if (
              inputSource.current === "native" &&
              active.state.preview === null
            )
              return;
            if (inputSource.current !== "native") {
              if (
                active.state.preview !== null ||
                target === active.state.media.current ||
                !active.begin()
              )
                return;
            }
            startInput("native");
            active.preview(target);
            finishInput();
            active.commit();
          }}
          onPointerDown={(event) => {
            if (
              !event.isPrimary ||
              event.button !== 0 ||
              !session.current?.begin()
            )
              return;
            event.preventDefault();
            event.currentTarget.focus();
            startInput("pointer");
            seekPointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            pointerTarget(event.currentTarget, event.clientX);
          }}
          onPointerMove={(event) => {
            if (seekPointer.current === event.pointerId)
              pointerTarget(event.currentTarget, event.clientX);
          }}
          onPointerUp={(event) => {
            if (seekPointer.current !== event.pointerId) return;
            pointerTarget(event.currentTarget, event.clientX);
            finishInput();
            session.current?.commit();
          }}
          onPointerCancel={() => {
            seekPointer.current = undefined;
            session.current?.cancel();
          }}
          onLostPointerCapture={() => {
            if (seekPointer.current !== undefined) {
              seekPointer.current = undefined;
              session.current?.cancel();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              finishInput();
              session.current?.commit();
              return;
            }
            const changes: Record<string, number> = {
              ArrowRight: 1,
              ArrowUp: 1,
              ArrowLeft: -1,
              ArrowDown: -1,
              PageUp: 60,
              PageDown: -60,
            };
            if (
              !(event.key in changes) &&
              event.key !== "Home" &&
              event.key !== "End"
            )
              return;
            event.preventDefault();
            if (
              session.current?.state.preview === null &&
              !session.current.begin()
            )
              return;
            startInput("keyboard");
            const current =
              session.current?.state.preview ?? media.current ?? 0;
            session.current?.preview(
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? media.duration!
                  : current + changes[event.key],
            );
          }}
          onBlur={() => session.current?.cancel()}
        />
        <div className="grid grid-cols-4 gap-2">
          {([-60, -1, 1, 60] as const).map((seconds) => (
            <button
              key={seconds}
              type="button"
              disabled={disabled}
              className={stepClass(media.dark)}
              aria-label={`${seconds > 0 ? "快进" : "快退"}${Math.abs(seconds) === 60 ? "1分钟" : "1秒"}`}
              onClick={() => session.current?.step(seconds)}
            >
              {seconds > 0 ? "+" : "−"}
              {Math.abs(seconds) === 60 ? "1m" : "1s"}
            </button>
          ))}
        </div>
        {media.controlNotice && (
          <div className="mt-2 text-[11px] leading-4 opacity-65">
            {media.controlNotice}
          </div>
        )}
        <div
          className="mt-2 min-h-8 text-[11px] leading-4 opacity-65"
          role="status"
        >
          {unavailable ||
            state.message ||
            "拖动预览 · 松手提交；键盘调整后按 Enter。房间权限以宿站结果为准。"}
        </div>
      </div>
    </div>
  );
}
