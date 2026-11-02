// 收藏随机面板的拖动与定位：位置存本机（不分账号），拖动只在移动过时保存。
// 面板有已存位置时作浮动卡片（fixed + left/top），否则保持默认摆放。
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { JSX, RefObject } from "preact";
import {
  constrainPosition,
  type MediaProgressPosition,
} from "../../../media-progress/model";
import {
  currentViewportPosition,
  pointerPosition,
} from "../../../media-progress/viewport";
import { startsOnControl } from "../floating-panel/floatingPanel";
import {
  readShufflePickerPosition,
  saveShufflePickerPosition,
} from "./pickerPosition";

export interface ShufflePlacement {
  /** 定位层：铺满视口但不拦截指针（非模态），也不带 transform，用于实测宿站缩放。 */
  layer: RefObject<HTMLDivElement>;
  dialog: RefObject<HTMLDivElement>;
  position: MediaProgressPosition | null;
  floating: boolean;
  dragging: boolean;
  dragHandle: {
    onPointerDown: (event: JSX.TargetedPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: JSX.TargetedPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: JSX.TargetedPointerEvent<HTMLDivElement>) => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
  };
}

/** 面板的定位与拖动交互；`exiting` 在退场动效期间忽略指针事件并结束拖动。 */
export function useShufflePlacement(exiting: boolean): ShufflePlacement {
  // 拖动位置：有已存位置时作浮动卡片（fixed + left/top），否则保持默认摆放。
  const [position, setPosition] = useState<MediaProgressPosition | null>(
    () => readShufflePickerPosition() ?? null,
  );
  const positionRef = useRef(position);
  const [dragging, setDragging] = useState(false);
  // 定位层：铺满视口但不拦截指针（非模态），也不带 transform，用于实测宿站缩放。
  const layer = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const move = useRef<{
    pointer: number;
    x: number;
    y: number;
    left: number;
    top: number;
    /** 指针真的移动过：只有移动过的拖动才保存位置。 */
    moved: boolean;
    /** 从默认摆放起拖：未移动就结束时退回默认摆放。 */
    fromDefault: boolean;
  }>();
  const floating = position !== null;

  const place = (next: MediaProgressPosition) => {
    const previous = positionRef.current;
    if (previous && previous.x === next.x && previous.y === next.y) return;
    positionRef.current = next;
    setPosition(next);
  };

  // 缩放比例取定位层（无 transform）：面板入场的 scale 会让面板自身的实测比例失真。
  const clampToViewport = (x: number, y: number) => {
    const element = dialog.current!;
    const { metrics, offsetLeft, offsetTop } = currentViewportPosition(
      layer.current!,
    );
    return constrainPosition(
      x,
      y,
      element.offsetWidth,
      element.offsetHeight,
      metrics.width,
      metrics.height,
      offsetLeft,
      offsetTop,
    );
  };

  // 结束拖动（松手、取消、失焦、丢失捕获、面板退场）：移动过才保存；
  // 从默认摆放起拖却没移动（单纯点按）则退回默认摆放，存储不动。
  const endDrag = () => {
    const drag = move.current;
    if (!drag) return;
    move.current = undefined;
    setDragging(false);
    if (drag.moved) {
      if (positionRef.current) saveShufflePickerPosition(positionRef.current);
    } else if (drag.fromDefault) {
      positionRef.current = null;
      setPosition(null);
    }
  };

  // 打开时、视口变化/滚动与面板尺寸变化时把位置收回视口内（只改内存，不写存储）。
  // 视口变化不打断拖动（移动端键盘收起、地址栏伸缩会在触摸拖动开始时触发 resize）。
  useLayoutEffect(() => {
    if (!floating) return;
    const constrain = () => {
      const current = positionRef.current;
      if (!current || !dialog.current || !layer.current) return;
      place(clampToViewport(current.x, current.y));
    };
    // 拖动起点切换成浮动卡片时不立即收回：卡片停在原视觉位置，首次移动再约束。
    if (!move.current) constrain();
    window.addEventListener("resize", constrain);
    window.addEventListener("scroll", constrain, { passive: true });
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", constrain);
    viewport?.addEventListener("scroll", constrain);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(constrain);
    if (dialog.current) observer?.observe(dialog.current);
    return () => {
      window.removeEventListener("resize", constrain);
      window.removeEventListener("scroll", constrain);
      viewport?.removeEventListener("resize", constrain);
      viewport?.removeEventListener("scroll", constrain);
      observer?.disconnect();
    };
  }, [floating]);

  useEffect(() => {
    window.addEventListener("blur", endDrag);
    return () => window.removeEventListener("blur", endDrag);
  }, []);

  // 拖动中面板开始退场（Esc、返回、确认）：结束拖动，之后的指针事件一律忽略。
  useEffect(() => {
    if (exiting) endDrag();
  }, [exiting]);

  const dragHandle = {
    onPointerDown: (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || event.button !== 0 || exiting) return;
      if (startsOnControl(event)) return;
      const element = dialog.current;
      if (!element || !layer.current) return;
      const pointer = pointerPosition(
        layer.current,
        event.clientX,
        event.clientY,
      );
      const fromDefault = !positionRef.current;
      // 默认摆放时取面板当前的视觉位置（含入场缩放），按定位层实测缩放换算，
      // 并立即切成浮动卡片，让布局变化发生在移动之前，手指下不跳。
      let start = positionRef.current;
      if (!start) {
        const rect = element.getBoundingClientRect();
        start = pointerPosition(layer.current, rect.left, rect.top);
        positionRef.current = start;
        setPosition(start);
      }
      move.current = {
        pointer: event.pointerId,
        x: pointer.x,
        y: pointer.y,
        left: start.x,
        top: start.y,
        moved: false,
        fromDefault,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging(true);
    },
    onPointerMove: (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
      const start = move.current;
      if (!start || start.pointer !== event.pointerId || exiting) return;
      if (!dialog.current || !layer.current) return;
      const pointer = pointerPosition(
        layer.current,
        event.clientX,
        event.clientY,
      );
      if (pointer.x === start.x && pointer.y === start.y) return;
      start.moved = true;
      place(
        clampToViewport(
          start.left + pointer.x - start.x,
          start.top + pointer.y - start.y,
        ),
      );
    },
    onPointerUp: (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
      if (move.current?.pointer === event.pointerId) endDrag();
    },
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
  };

  return { layer, dialog, position, floating, dragging, dragHandle };
}
