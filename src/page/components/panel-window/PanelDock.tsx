// 常驻的胶囊：面板没开着时显示，点它打开。默认贴在输入框左上方，可拖动并记住位置，但进不了输入框；
// 拖到边缘时吸附并收起，悬停展开；粘在边上像蜂蜜，拉出一条丝后断开（几何在 `dockLiquid.ts`）。
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
  deskDockShadow,
  deskInk,
  deskSheet,
  deskSheetFill,
  typeButtonSm,
} from "../floating-panel/tokens";
import {
  DOCK_DETACH_PULL,
  isStickyEdge,
  nearbyWall,
  neckPath,
  pillTailPath,
  stretchScale,
  stuckPull,
  wallBumpPath,
  wallOf,
  type StickyEdge,
} from "./dockLiquid";
import {
  clampDockPoint,
  dockBounds,
  dockFlight,
  dockPosition,
  DOCK_SNAP_DISTANCE,
  normalizeStoredDock,
  pinToEdge,
  snapDockEdge,
  type DockAnchor,
  type DockEdge,
  type DockPoint,
  type DockSize,
  type StoredDock,
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
/** 胶囊展开时的尺寸：窗口收起时胶囊还没挂载，用它算终点。手机和粗指针上更大，见 `app.css`。 */
const DOCK_NOMINAL_SIZE: DockSize = { width: 87, height: 38 };
const DOCK_NOMINAL_SIZE_LARGE: DockSize = { width: 110, height: 54 };

const dockNominalSize = () =>
  window.matchMedia?.("(max-width: 768px), (pointer: coarse)")?.matches
    ? DOCK_NOMINAL_SIZE_LARGE
    : DOCK_NOMINAL_SIZE;
/** 颈缩回去、胶囊落定的时长；`app.css` 的 `data-imw-dock-settling` 规则与它同长。 */
const DOCK_SETTLE_MS = 300;

const prefersReducedMotion = () =>
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

function readAnchor(scale: number): DockAnchor | null {
  const anchor = document.getElementById(DOCK_ANCHOR_ID);
  if (!anchor || getComputedStyle(anchor).visibility === "hidden") return null;
  const { left, top, right, bottom } = anchor.getBoundingClientRect();
  // 宿站侧栏打开时平移整个 body，胶囊也在 body 里：要换算成相对 body 的坐标，不然平移会算两次
  const body = document.body.getBoundingClientRect();
  return {
    left: (left - body.left) / scale,
    top: (top - body.top) / scale,
    right: (right - body.left) / scale,
    bottom: (bottom - body.top) / scale,
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
    width: Math.max(element.offsetWidth, dockNominalSize().width),
    height: element.offsetHeight,
  };
}

/** 存储写不进去（隐私模式、被禁用）时的内存兜底：否则拖完的位置会在下一次轮询被默认位置覆盖。 */
let unsavedDock: StoredDock | null = null;

function readStoredDock() {
  return (
    normalizeStoredDock(readJson(PANEL_DOCK_POSITION_KEY, null)) ?? unsavedDock
  );
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

/**
 * 写面板缩向胶囊的位移（CSS 变量，见 `app.css`）。`rect` 是窗口展开时的矩形，全屏传 null。
 * 收起中的容器量不准，所以不读它的矩形。
 */
export function writeDockFlight(
  container: HTMLElement,
  rect: PanelRect | null,
): void {
  const { width, height } = viewportMetrics(container);
  const size = dockNominalSize();
  const flight = dockFlight(
    rect ?? { x: 0, y: 0, width, height },
    measureDock(container, size),
    size,
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
  const neckFrame = useRef(0);
  const settleTimer = useRef(0);

  const reference = () => layer.current as HTMLElement;

  const writeNeck = (path: string) => neck.current?.setAttribute("d", path);

  /** 这条边的颈所需的几何；胶囊的位置取当前 left / top。 */
  const neckGeometry = (element: HTMLElement, edge: StickyEdge) => {
    const size = dockSize(element);
    const { anchor, viewport } = dockFrame(reference());
    return {
      wall: wallOf(edge, dockBounds(anchor, size, viewport), size.width),
      center:
        edge === "top"
          ? parseFloat(element.style.left) + element.offsetWidth / 2
          : parseFloat(element.style.top) + element.offsetHeight / 2,
      thickness: element.offsetHeight,
    };
  };

  const drawNeck = (
    element: HTMLElement,
    edge: StickyEdge,
    distance: number,
  ) => {
    const { wall, center, thickness } = neckGeometry(element, edge);
    writeNeck(neckPath(edge, wall, center, distance, thickness));
  };

  const stopNeckAnimation = () => {
    window.cancelAnimationFrame?.(neckFrame.current);
    neckFrame.current = 0;
  };

  /** 逐帧画一段 ease-out 的收缩；减少动态效果时直接到终点。 */
  const animateNeck = (draw: (remaining: number) => void) => {
    stopNeckAnimation();
    if (prefersReducedMotion()) {
      draw(0);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DOCK_SETTLE_MS, 1);
      draw((1 - progress) ** 3);
      neckFrame.current = progress < 1 ? requestAnimationFrame(tick) : 0;
    };
    neckFrame.current = requestAnimationFrame(tick);
  };

  /**
   * 落定用的过渡，只在这一小段时间打开。断开时手指还在拖，只能弹 `scale`（`"scale"`）：
   * 带上 left / top 胶囊就会缓动着追手指；松手后才用 `"place"`。
   */
  const settle = (element: HTMLElement, kind: "scale" | "place") => {
    window.clearTimeout(settleTimer.current);
    element.setAttribute("data-imw-dock-settling", kind);
    settleTimer.current = window.setTimeout(
      () => element.removeAttribute("data-imw-dock-settling"),
      DOCK_SETTLE_MS + 40,
    );
  };

  /** 断开：丝从中间断成两个尖头，边缘那头缩回边上，胶囊那头跟着胶囊缩回去。 */
  const detach = (element: HTMLElement, current: DockDrag) => {
    const edge = current.stuck;
    if (!edge) return;
    const { wall, center, thickness } = neckGeometry(element, edge);
    const bumpLength = current.stuckDistance * 0.45 + 4;
    const tailLength = current.stuckDistance * 0.45;
    current.stuck = null;
    writeDockEdge(element, null);
    settle(element, "scale");
    element.style.removeProperty("scale");
    animateNeck((remaining) => {
      const tail = neckGeometry(element, edge);
      const left = parseFloat(element.style.left);
      const top = parseFloat(element.style.top);
      const cap =
        edge === "left"
          ? left - tail.wall
          : edge === "right"
            ? tail.wall - left - element.offsetWidth
            : top - tail.wall;
      writeNeck(
        [
          wallBumpPath(edge, wall, center, bumpLength * remaining, thickness),
          pillTailPath(
            edge,
            tail.wall,
            tail.center,
            cap,
            tailLength * remaining,
            thickness,
          ),
        ].join(" "),
      );
    });
  };

  const place = (element: HTMLElement, { x, y }: DockPoint) => {
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  };

  /** 自由拖动靠近边缘时，边缘提前伸出来接它。 */
  const drawApproach = (element: HTMLElement, point: DockPoint) => {
    if (neckFrame.current) return;
    const { anchor, viewport } = dockFrame(reference());
    const near = nearbyWall(
      point,
      dockBounds(anchor, dockSize(element), viewport),
    );
    if (near) {
      const { wall, center, thickness } = neckGeometry(element, near.edge);
      writeNeck(
        neckPath(
          near.edge,
          wall,
          center,
          near.gap,
          thickness,
          DOCK_SNAP_DISTANCE,
        ),
      );
    } else writeNeck("");
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
      if (!neckFrame.current) {
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
      window.clearTimeout(settleTimer.current);
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
    } else if (!neckFrame.current) {
      writeNeck("");
    }
    const saved: StoredDock = edge ? { ...final, edge } : final;
    unsavedDock = writeJson(PANEL_DOCK_POSITION_KEY, saved) ? null : saved;
    onPlaced();
  };

  // 手机和粗指针上要好点：52px 高，比其它目标的 44px 更大（尺寸同 `DOCK_NOMINAL_SIZE_LARGE`）
  const controlHeight = "h-9 max-[768px]:h-13 [@media(pointer:coarse)]:h-13";
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
          window.clearTimeout(settleTimer.current);
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
  unsavedDock = null;
  for (const node of document.querySelectorAll(`#${PANEL_DOCK_ROOT_ID}`)) {
    // 先卸载：停掉跟随用的定时器和视口监听
    render(null, node);
    node.remove();
  }
}
