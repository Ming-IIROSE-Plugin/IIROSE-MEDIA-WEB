// 播放进度浮窗的指针手势：拖动定位与滑块预览/提交。纯事件工厂，不持有状态，
// 状态仍由浮窗组件的 ref 提供（hooks 顺序不变）。
import type { JSX } from "preact";
import type {
  MediaSnapshot,
  MediaProgressPosition,
} from "../../../media-progress/model";
import { constrainPosition } from "../../../media-progress/model";
import type { ProgressSession } from "../../../media-progress/ProgressSession";
import {
  currentViewportPosition,
  pointerPosition,
} from "../../../media-progress/viewport";
import {
  startsOnControl,
  type DragHandleProps,
} from "../floating-panel/floatingPanel";

type Ref<T> = { current: T };

export type DragMove = {
  pointer: number;
  x: number;
  y: number;
  left: number;
  top: number;
};

/** 这一轮预览由谁发起：指针拖动 / 键盘 / 原生输入（未归类）。 */
export type InputSource = "pointer" | "keyboard" | "native";

export interface DragDeps {
  panel: Ref<HTMLDivElement | null>;
  move: Ref<DragMove | undefined>;
  position: Ref<MediaProgressPosition>;
  updatePosition: (next: MediaProgressPosition) => void;
  setDragging: (value: boolean) => void;
}

/** 头部行与移动端拖拽条共用的拖动手柄。 */
export function createDragHandle({
  panel,
  move,
  position,
  updatePosition,
  setDragging,
}: DragDeps): DragHandleProps {
  const stop = () => {
    move.current = undefined;
    setDragging(false);
  };
  return {
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
        left: position.current.x,
        top: position.current.y,
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
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
  };
}

/** 滑块需要的指针 / 键盘 / 值变更事件。 */
export type SeekHandlers = Required<
  Pick<
    JSX.InputHTMLAttributes<HTMLInputElement>,
    | "onInput"
    | "onChange"
    | "onPointerDown"
    | "onPointerMove"
    | "onPointerUp"
    | "onPointerCancel"
    | "onLostPointerCapture"
    | "onKeyDown"
    | "onBlur"
  >
>;

export interface SeekDeps {
  session: Ref<ProgressSession | undefined>;
  media: MediaSnapshot;
  seekPointer: Ref<number | undefined>;
  inputSource: Ref<InputSource | null>;
  trailingChange: Ref<ReturnType<typeof setTimeout> | undefined>;
  startInput: (source: InputSource) => void;
  finishInput: () => void;
}

/**
 * 滑块手势：只屏蔽本轮事件的尾随 change —— `inputSource` 记录本轮来源，
 * `trailingChange` 标记刚收尾的那一帧。
 */
export function createSeekHandlers(deps: SeekDeps): SeekHandlers {
  const { session, media } = deps;
  const pointerTarget = (element: HTMLInputElement, clientX: number) => {
    const rect = element.getBoundingClientRect();
    session.current?.preview(
      ((clientX - rect.left) / rect.width) * (media.duration || 0),
    );
  };
  return {
    onInput: (event) => {
      if (
        deps.seekPointer.current !== undefined ||
        (deps.inputSource.current === "keyboard" &&
          session.current?.state.preview !== null)
      )
        return;
      const active = session.current;
      if (!active || active.state.waiting) return;
      const target = event.currentTarget.valueAsNumber;
      if (active.state.preview === null && !active.begin()) return;
      deps.startInput("native");
      active.preview(target);
    },
    onChange: (event) => {
      if (
        deps.inputSource.current === "pointer" ||
        deps.inputSource.current === "keyboard" ||
        deps.trailingChange.current !== undefined
      )
        return;
      const active = session.current;
      if (!active || active.state.waiting) return;
      const target = event.currentTarget.valueAsNumber;
      if (
        deps.inputSource.current === "native" &&
        active.state.preview === null
      )
        return;
      if (deps.inputSource.current !== "native") {
        if (
          active.state.preview !== null ||
          target === active.state.media.current ||
          !active.begin()
        )
          return;
      }
      deps.startInput("native");
      active.preview(target);
      deps.finishInput();
      active.commit();
    },
    onPointerDown: (event) => {
      if (!event.isPrimary || event.button !== 0 || !session.current?.begin())
        return;
      event.preventDefault();
      event.currentTarget.focus();
      deps.startInput("pointer");
      deps.seekPointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerTarget(event.currentTarget, event.clientX);
    },
    onPointerMove: (event) => {
      if (deps.seekPointer.current === event.pointerId)
        pointerTarget(event.currentTarget, event.clientX);
    },
    onPointerUp: (event) => {
      if (deps.seekPointer.current !== event.pointerId) return;
      pointerTarget(event.currentTarget, event.clientX);
      deps.finishInput();
      session.current?.commit();
    },
    onPointerCancel: () => {
      deps.seekPointer.current = undefined;
      session.current?.cancel();
    },
    onLostPointerCapture: () => {
      if (deps.seekPointer.current !== undefined) {
        deps.seekPointer.current = undefined;
        session.current?.cancel();
      }
    },
    onKeyDown: (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        deps.finishInput();
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
      if (session.current?.state.preview === null && !session.current.begin())
        return;
      deps.startInput("keyboard");
      const current = session.current?.state.preview ?? media.current ?? 0;
      session.current?.preview(
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? media.duration!
            : current + changes[event.key],
      );
    },
    onBlur: () => session.current?.cancel(),
  };
}
