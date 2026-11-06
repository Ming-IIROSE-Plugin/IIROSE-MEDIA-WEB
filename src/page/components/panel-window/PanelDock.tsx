// 窗口模式常驻的胶囊：窗口没开着时显示，点它打开。默认贴在输入框左上方，可拖动并记住位置，但进不了输入框；
// 拖到边缘时吸附并收起，悬停展开。
// 挂在 body 独立根上（宿站主容器会平移），只占胶囊自己的矩形，其余区域的点击和按键都归宿站。
// 不改宿站输入框 DOM。
import { render } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { hostIsDark } from "../../../iirose_func/HostTheme";
import {
  pointerPosition,
  viewportMetrics,
} from "../../../media-progress/viewport";
import { readJson, writeJson } from "../../../storage/localStore";
import { stopHostGestures, themeAttr } from "../floating-panel/floatingPanel";
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskMenuShadow,
  deskPressTone,
  deskRule,
  deskSheet,
  typeButtonSm,
} from "../floating-panel/tokens";
import {
  clampDockPoint,
  dockFlight,
  dockPosition,
  normalizeStoredDock,
  pinToEdge,
  snapDockEdge,
  type DockAnchor,
  type DockEdge,
  type DockPoint,
  type DockSize,
} from "./dockPlacement";
import type { PanelRect, PanelViewport } from "./geometry";

export const PANEL_DOCK_ROOT_ID = "imw-panel-dock-root";
export const PANEL_DOCK_POSITION_KEY = "imwPanelDockPosition";
/** 按下后移动超过它才算拖动，否则是点击还原。 */
const DOCK_DRAG_THRESHOLD = 4;
/** 真站 `#moveinput` 的外层；`#mainHolder` 隐藏时尺寸为 0，按缺失处理。 */
const DOCK_ANCHOR_ID = "moveinputDisplay";
/** 聊天区尺寸变化没有事件可听（输入框上方的内容也会把它顶走），低频轮询兜底。 */
const DOCK_FOLLOW_MS = 500;
/** 胶囊展开时的尺寸：窗口收起时胶囊还没挂载，用它算终点。 */
const DOCK_NOMINAL_SIZE: DockSize = { width: 87, height: 38 };

function readAnchor(scale: number): DockAnchor | null {
  const anchor = document.getElementById(DOCK_ANCHOR_ID);
  if (!anchor || getComputedStyle(anchor).visibility === "hidden") return null;
  const { left, top, right, bottom } = anchor.getBoundingClientRect();
  return {
    left: left / scale,
    top: top / scale,
    right: right / scale,
    bottom: bottom / scale,
  };
}

/**
 * 胶囊摆放要参考的输入框和视口（`fixed` 只看可视视口的平移，不加页面滚动）。`reference` 用来量
 * 宿站缩放，要够宽：`offsetWidth` 是取整的，拿胶囊自己量（约 113px）在 1.15 倍下会差出 4px。
 */
function dockFrame(reference: HTMLElement) {
  const { scale, width, height } = viewportMetrics(reference);
  const viewport: PanelViewport = {
    width,
    height,
    offsetX: (window.visualViewport?.offsetLeft || 0) / scale,
    offsetY: (window.visualViewport?.offsetTop || 0) / scale,
  };
  return { anchor: readAnchor(scale), viewport };
}

/** 贴上下边时胶囊缩成图标，范围要按展开后算，否则靠右时悬停会伸出视口。 */
function dockSize(element: HTMLElement): DockSize {
  return {
    width: Math.max(element.offsetWidth, DOCK_NOMINAL_SIZE.width),
    height: element.offsetHeight,
  };
}

function readStoredDock() {
  return normalizeStoredDock(readJson(PANEL_DOCK_POSITION_KEY, null));
}

/** 吸附在边缘的胶囊由 `app.css` 收起，悬停时伸出。 */
function writeDockEdge(
  element: HTMLElement,
  edge: DockEdge | null | undefined,
) {
  if (edge) element.setAttribute("data-imw-dock-edge", edge);
  else element.removeAttribute("data-imw-dock-edge");
}

/** 胶囊该摆的位置：输入框移动或视口变化只改显示，存档留着等放得下时恢复。 */
function measureDock(reference: HTMLElement, size: DockSize): DockPoint {
  const { anchor, viewport } = dockFrame(reference);
  return dockPosition(anchor, size, viewport, readStoredDock());
}

/** 写窗口缩向胶囊的位移（CSS 变量，见 `app.css` 的窗口态规则）。`rect` 是窗口展开时的矩形。 */
export function writeDockFlight(container: HTMLElement, rect: PanelRect): void {
  const flight = dockFlight(
    rect,
    measureDock(container, DOCK_NOMINAL_SIZE),
    DOCK_NOMINAL_SIZE,
  );
  container.style.setProperty("--imw-dock-x", `${flight.x}px`);
  container.style.setProperty("--imw-dock-y", `${flight.y}px`);
}

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
}

export function PanelDock({ onOpen, onPlaced }: PanelDockProps) {
  const pill = useRef<HTMLDivElement>(null);
  const drag = useRef<DockDrag | null>(null);
  const justDragged = useRef(false);
  useLayoutEffect(() => {
    const element = pill.current;
    if (!element) return;
    const sync = () => {
      if (drag.current) return;
      const { x, y } = measureDock(
        element.parentElement ?? element,
        dockSize(element),
      );
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      writeDockEdge(element, readStoredDock()?.edge);
      // 胶囊常驻：宿站换主题也要跟上
      element.setAttribute("data-imw-theme", themeAttr(hostIsDark()));
      onPlaced();
    };
    sync();
    const timer = window.setInterval(sync, DOCK_FOLLOW_MS);
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, [onPlaced]);
  const reference = () => {
    const element = pill.current as HTMLElement;
    return element.parentElement ?? element;
  };
  const endDrag = () => {
    const finished = drag.current;
    const element = pill.current;
    drag.current = null;
    if (!finished?.moved || !element) return;
    justDragged.current = true;
    const size = dockSize(element);
    const { anchor, viewport } = dockFrame(reference());
    const point = {
      x: parseFloat(element.style.left),
      y: parseFloat(element.style.top),
    };
    const edge = snapDockEdge(point, anchor, size, viewport);
    const { x, y } = clampDockPoint(
      edge ? pinToEdge(point, edge) : point,
      anchor,
      size,
      viewport,
    );
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    writeDockEdge(element, edge);
    writeJson(PANEL_DOCK_POSITION_KEY, edge ? { x, y, edge } : { x, y });
    onPlaced();
  };
  // 粗指针上也要够得着：与其它粗指针目标同为 44px
  const controlHeight = "h-9 max-[768px]:h-11 [@media(pointer:coarse)]:h-11";
  return (
    <div
      ref={pill}
      role="group"
      aria-label="点歌台"
      data-imw-panel-dock="true"
      className={`fixed z-[90009] flex touch-none select-none rounded-full border border-solid whitespace-nowrap animate-[imwRiseIn_200ms_ease-out] motion-reduce:animate-none ${deskRule} ${deskSheet} ${deskInk} ${deskMenuShadow}`}
      {...stopHostGestures}
      onPointerDown={(event) => {
        const element = pill.current;
        if (!element || !event.isPrimary || event.button !== 0) return;
        justDragged.current = false;
        const pointer = pointerPosition(
          reference(),
          event.clientX,
          event.clientY,
        );
        drag.current = {
          pointer: event.pointerId,
          x: pointer.x,
          y: pointer.y,
          left: parseFloat(element.style.left),
          top: parseFloat(element.style.top),
          moved: false,
        };
        // 一按下就捕获：快速拖出胶囊也不丢。捕获后点击可能落在胶囊上，所以打开写在外层的 onClick
        element.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        const element = pill.current;
        if (!current || !element || current.pointer !== event.pointerId) return;
        const pointer = pointerPosition(
          reference(),
          event.clientX,
          event.clientY,
        );
        const dx = pointer.x - current.x;
        const dy = pointer.y - current.y;
        if (!current.moved && Math.hypot(dx, dy) < DOCK_DRAG_THRESHOLD) return;
        current.moved = true;
        writeDockEdge(element, null);
        const { anchor, viewport } = dockFrame(reference());
        const { x, y } = clampDockPoint(
          { x: current.left + dx, y: current.top + dy },
          anchor,
          dockSize(element),
          viewport,
        );
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
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
        className={`m-0 flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-3 text-inherit ${controlHeight} ${typeButtonSm} ${deskPressTone} ${deskFocusRing}`}
      >
        <DeskIcon name="mark" size={16} />
        <span data-imw-dock-label="true">点歌台</span>
      </button>
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
  for (const node of document.querySelectorAll(`#${PANEL_DOCK_ROOT_ID}`)) {
    // 先卸载：停掉跟随用的定时器和视口监听
    render(null, node);
    node.remove();
  }
}
