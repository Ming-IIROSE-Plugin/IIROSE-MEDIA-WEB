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
import { currentViewportPosition } from "../../../media-progress/viewport";
import {
  DragGrip,
  PanelHeader,
  panelFrame,
  panelSurface,
  secondaryButton,
  stopHostGestures,
  themeAttr,
} from "../floating-panel/floatingPanel";
import { deskAccent, deskInk2 } from "../floating-panel/tokens";
import { ClockIcon, MediaProgressDetails } from "./MediaProgressDetails";
import {
  createDragHandle,
  createSeekHandlers,
  type DragMove,
  type InputSource,
} from "./progressGestures";

// 快进快退：共享的描边次要按钮，保留原有尺寸、字号与禁用态。
const stepClass = `${secondaryButton} min-w-[44px] px-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-35`;

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
  const move = useRef<DragMove>();
  const seekPointer = useRef<number>();
  const inputSource = useRef<InputSource | null>(null);
  const trailingChange = useRef<ReturnType<typeof setTimeout>>();
  const startInput = (source: InputSource) => {
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

  const dragHandle = createDragHandle({
    panel,
    move,
    position: positionRef,
    updatePosition,
    setDragging,
  });
  const seekHandlers = createSeekHandlers({
    session,
    media,
    seekPointer,
    inputSource,
    trailingChange,
    startInput,
    finishInput,
  });

  return (
    <div
      ref={panel}
      id="imw-media-progress"
      role="dialog"
      aria-labelledby="imw-media-progress-title"
      tabIndex={-1}
      data-imw-theme={themeAttr(media.dark)}
      className={`fixed z-[90001] w-[320px] overflow-auto font-sans text-[14px] imw-dark:[color-scheme:dark] max-[768px]:w-[320px] ${panelFrame} ${panelSurface}`}
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
        <MediaProgressDetails
          media={media}
          time={time}
          previewing={state.preview !== null}
          failedCover={failedCover}
          onCoverError={setFailedCover}
        />
        <input
          type="range"
          aria-label="媒体播放位置"
          aria-valuetext={`${formatTime(time)} / ${formatTime(media.duration)}`}
          min={0}
          max={media.duration || 1}
          step={1}
          value={time ?? 0}
          disabled={disabled}
          className={`m-0 mt-2 h-[44px] w-full touch-none cursor-pointer ${deskAccent} disabled:cursor-not-allowed disabled:opacity-40`}
          {...seekHandlers}
        />
        <div className="grid grid-cols-4 gap-2">
          {([-60, -1, 1, 60] as const).map((seconds) => (
            <button
              key={seconds}
              type="button"
              disabled={disabled}
              className={stepClass}
              aria-label={`${seconds > 0 ? "快进" : "快退"}${Math.abs(seconds) === 60 ? "1分钟" : "1秒"}`}
              onClick={() => session.current?.step(seconds)}
            >
              {seconds > 0 ? "+" : "−"}
              {Math.abs(seconds) === 60 ? "1m" : "1s"}
            </button>
          ))}
        </div>
        {media.controlNotice && (
          <div className={`mt-2 text-[11px] leading-4 ${deskInk2}`}>
            {media.controlNotice}
          </div>
        )}
        <div
          className={`mt-2 min-h-8 text-[11px] leading-4 ${deskInk2}`}
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
