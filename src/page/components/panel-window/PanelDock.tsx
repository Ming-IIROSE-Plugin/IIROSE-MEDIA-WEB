// 常驻的胶囊：面板没开着时显示，点它打开。默认贴在输入框左上方，可拖动并记住位置，但进不了输入框；
// 拖到边缘时吸附并收起，悬停展开；粘在边上像蜂蜜，拉出一条丝后断开（几何在 `dockLiquid.ts`）。
// 挂在 body 独立根上（宿站主容器会平移），只占胶囊自己的矩形，其余区域的点击和按键都归宿站。
// 不改宿站输入框 DOM。
import { render } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { hostIsDark } from "../../../iirose_func/HostTheme";
import { pointerPosition } from "../../../media-progress/viewport";
import { stopHostGestures, themeAttr } from "../floating-panel/floatingPanel";
import {
  DeskIcon,
  deskFocusRing,
  deskDockShadow,
  deskInk,
  deskSheet,
  deskSheetFill,
  typeButtonSm,
} from "../floating-panel/tokens";
import {
  DOCK_DETACH_PULL,
  isStickyEdge,
  stretchScale,
  stuckPull,
  type StickyEdge,
} from "./dockLiquid";
import {
  dockFrame,
  dockSize,
  forgetUnsavedDock,
  measureDock,
  PANEL_DOCK_POSITION_KEY,
  readStoredDock,
  saveStoredDock,
  writeDockEdge,
  writeDockFlight,
} from "./dockMeasure";
import { createNeckController, prefersReducedMotion } from "./dockNeck";
import {
  clampDockPoint,
  dockBounds,
  pinToEdge,
  snapDockEdge,
  type DockEdge,
  type DockPoint,
  type StoredDock,
} from "./dockPlacement";

export const PANEL_DOCK_ROOT_ID = "imw-panel-dock-root";
// 量取与存档在 `dockMeasure.ts`；这里转出去，调用方和测试仍从 `PanelDock` 取
export { PANEL_DOCK_POSITION_KEY, writeDockFlight };
/** 按下后移动超过它才算拖动，否则是点击还原。 */
const DOCK_DRAG_THRESHOLD = 4;
/**
 * 按钮高度类。手机和粗指针上要好点：52px 高，比其它目标的 44px 更大。
 * 与 `dockMeasure.ts` 的 `DOCK_NOMINAL_SIZE(_LARGE)` 是同一件事的两处写法（高度 + 上下 2px 边框），
 * 测试会核对两边，改一处另一处不跟就会失败。
 */
export const DOCK_HEIGHT_CLASS =
  "h-9 max-[768px]:h-13 [@media(pointer:coarse)]:h-13";
/** 聊天区尺寸变化没有事件可听（输入框上方的内容也会把它顶走），低频轮询兜底。 */
const DOCK_FOLLOW_MS = 500;

export interface PanelDockProps {
  onOpen: () => void;
  /** 胶囊摆好或移动后调用：窗口缩放的终点要跟上。 */
  onPlaced: () => void;
}

interface DockDrag {
  pointer: number;
  x: number;
  y: number;
  left: number;
  top: number;
  moved: boolean;
  /** 还粘着的边；断开后为 null。 */
  stuck: StickyEdge | null;
  /** 当前离粘住那条边的距离。 */
  stuckDistance: number;
}

export function PanelDock({ onOpen, onPlaced }: PanelDockProps) {
  const layer = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const neck = useRef<SVGPathElement>(null);
  const drag = useRef<DockDrag | null>(null);
  const justDragged = useRef(false);

  const reference = () => layer.current as HTMLElement;

  // 颈的绘制与落定动画在 `dockNeck.ts`；组件只拿它的方法
  const neckRef = useRef<ReturnType<typeof createNeckController>>();
  if (!neckRef.current)
    neckRef.current = createNeckController(reference, () => neck.current);
  const {
    writeNeck,
    drawNeck,
    animating,
    stop: stopNeckAnimation,
    animate: animateNeck,
    settle,
    cancelSettle,
    detach,
    drawApproach,
  } = neckRef.current;

  const place = (element: HTMLElement, { x, y }: DockPoint) => {
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  };

  useLayoutEffect(() => {
    const element = pill.current;
    if (!element) return;
    const sync = () => {
      if (drag.current) return;
      const { x, y } = measureDock(reference(), dockSize(element));
      place(element, { x, y });
      const edge = readStoredDock()?.edge;
      writeDockEdge(element, edge);
      if (!animating()) {
        if (isStickyEdge(edge)) drawNeck(element, edge, 0);
        else writeNeck("");
      }
      // 胶囊常驻：宿站换主题也要跟上
      layer.current?.setAttribute("data-imw-theme", themeAttr(hostIsDark()));
      onPlaced();
    };
    sync();
    const timer = window.setInterval(sync, DOCK_FOLLOW_MS);
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    return () => {
      window.clearInterval(timer);
      cancelSettle();
      stopNeckAnimation();
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, [onPlaced]);

  const endDrag = () => {
    const finished = drag.current;
    const element = pill.current;
    drag.current = null;
    if (!element) return;
    element.removeAttribute("data-imw-dock-held");
    element.removeAttribute("data-imw-dock-dragging");
    if (!finished?.moved) return;
    justDragged.current = true;
    // 取消拖拽后不会再有点击：标记不清掉的话，下一次键盘激活会被吞一次
    window.setTimeout(() => {
      justDragged.current = false;
    }, 100);
    const size = dockSize(element);
    const { anchor, viewport } = dockFrame(reference());
    const point = {
      x: parseFloat(element.style.left),
      y: parseFloat(element.style.top),
    };
    // 还粘着就松手：弹回那条边
    const edge = snapDockEdge(point, anchor, size, viewport) ?? finished.stuck;
    const final = clampDockPoint(
      edge ? pinToEdge(point, edge) : point,
      anchor,
      size,
      viewport,
    );
    // 落定前离边缘多远：颈从这里收回弯月面
    const bounds = dockBounds(anchor, size, viewport);
    const gap = !isStickyEdge(edge)
      ? 0
      : edge === "left"
        ? point.x - bounds.minX
        : edge === "right"
          ? bounds.maxX - point.x
          : point.y - bounds.minY;
    settle(element, "place");
    element.style.removeProperty("scale");
    place(element, final);
    writeDockEdge(element, edge);
    if (isStickyEdge(edge)) {
      animateNeck((remaining) => drawNeck(element, edge, gap * remaining));
    } else if (!animating()) {
      writeNeck("");
    }
    const saved: StoredDock = edge ? { ...final, edge } : final;
    saveStoredDock(saved);
    onPlaced();
  };

  const controlHeight = DOCK_HEIGHT_CLASS;
  return (
    <div
      ref={layer}
      data-imw-dock-layer="true"
      // overflow-hidden：收起靠裁切。宿站侧栏把 body 推走时，屏幕边缘裁不到它，藏着的部分会露在侧栏上
      className={`pointer-events-none fixed inset-0 z-[90009] overflow-hidden ${deskDockShadow}`}
    >
      {/* 只占 1px、靠 overflow 画出去：铺满全屏的话，外层投影滤镜每帧都要处理整个屏幕，拖动会卡 */}
      <svg
        aria-hidden="true"
        className="absolute top-0 left-0 h-px w-px overflow-visible"
      >
        <path ref={neck} d="" className={deskSheetFill} />
      </svg>
      <div
        ref={pill}
        role="group"
        aria-label="点歌台"
        data-imw-panel-dock="true"
        className={`pointer-events-auto fixed flex touch-none select-none rounded-full border border-solid border-transparent whitespace-nowrap animate-[imwRiseIn_200ms_ease-out] motion-reduce:animate-none ${deskSheet} ${deskInk}`}
        {...stopHostGestures}
        onPointerDown={(event) => {
          const element = pill.current;
          if (!element || !event.isPrimary || event.button !== 0) return;
          justDragged.current = false;
          // 上一次松手的落定还没结束就又按下：不能带着过渡拖
          cancelSettle();
          element.removeAttribute("data-imw-dock-settling");
          const pointer = pointerPosition(
            reference(),
            event.clientX,
            event.clientY,
          );
          const edge = element.getAttribute(
            "data-imw-dock-edge",
          ) as DockEdge | null;
          drag.current = {
            pointer: event.pointerId,
            x: pointer.x,
            y: pointer.y,
            left: parseFloat(element.style.left),
            top: parseFloat(element.style.top),
            moved: false,
            stuck: isStickyEdge(edge) && !prefersReducedMotion() ? edge : null,
            stuckDistance: 0,
          };
          // 按住就展开（触屏没有悬停）
          element.setAttribute("data-imw-dock-held", "true");
          // 一按下就捕获：快速拖出胶囊也不丢。捕获后点击可能落在胶囊上，所以打开写在外层的 onClick
          element.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          const element = pill.current;
          if (!current || !element || current.pointer !== event.pointerId)
            return;
          const pointer = pointerPosition(
            reference(),
            event.clientX,
            event.clientY,
          );
          const dx = pointer.x - current.x;
          const dy = pointer.y - current.y;
          if (!current.moved && Math.hypot(dx, dy) < DOCK_DRAG_THRESHOLD)
            return;
          current.moved = true;
          element.setAttribute("data-imw-dock-dragging", "true");
          const size = dockSize(element);
          const { anchor, viewport } = dockFrame(reference());
          const docked = { x: current.left, y: current.top };
          const raw = { x: current.left + dx, y: current.top + dy };
          // 胶囊始终 1:1 跟手，粘只表现在形状上
          const point = clampDockPoint(raw, anchor, size, viewport);
          place(element, point);
          if (current.stuck) {
            const pull = stuckPull(current.stuck, docked, point);
            if (pull < DOCK_DETACH_PULL) {
              const distance = Math.max(pull, 0);
              current.stuckDistance = distance;
              element.style.scale = stretchScale(current.stuck, distance);
              drawNeck(element, current.stuck, distance);
              return;
            }
            detach(element, current);
            return;
          }
          writeDockEdge(element, null);
          drawApproach(element, point);
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointer === event.pointerId) endDrag();
        }}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onClick={() => {
          if (justDragged.current) {
            justDragged.current = false;
            return;
          }
          onOpen();
        }}
      >
        <button
          type="button"
          aria-label="打开点歌台"
          className={`m-0 flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-3 text-inherit max-[768px]:gap-2 max-[768px]:px-4 max-[768px]:text-[15px] max-[768px]:[&>svg]:size-5 [@media(pointer:coarse)]:gap-2 [@media(pointer:coarse)]:px-4 [@media(pointer:coarse)]:text-[15px] [@media(pointer:coarse)]:[&>svg]:size-5 ${controlHeight} ${typeButtonSm} ${deskFocusRing}`}
        >
          <DeskIcon name="mark" size={16} />
          <span data-imw-dock-label="true">点歌台</span>
        </button>
      </div>
    </div>
  );
}

/** 挂到 body；返回卸载函数。 */
export function mountPanelDock(props: PanelDockProps): () => void {
  releasePanelDock();
  const root = document.createElement("div");
  root.id = PANEL_DOCK_ROOT_ID;
  document.body.appendChild(root);
  render(<PanelDock {...props} />, root);
  return () => {
    render(null, root);
    root.remove();
  };
}

export function releasePanelDock(): void {
  forgetUnsavedDock();
  for (const node of document.querySelectorAll(`#${PANEL_DOCK_ROOT_ID}`)) {
    // 先卸载：停掉跟随用的定时器和视口监听
    render(null, node);
    node.remove();
  }
}
