// 常驻的胶囊：面板没开着时显示，点它打开。默认贴在输入框左上方，可拖动并记住位置，但进不了输入框；
// 拖到边缘时吸附并收起，悬停展开；粘在边上像蜂蜜，拉出一条丝后断开。这里只管手势和存档，
// 胶囊的形状是一条 SVG 轮廓（`dockLiquid.ts` 算，`dockPainter.ts` 画），DOM 上的胶囊只放文字和图标。
// 面板开合时和胶囊交接（`panelGrow.ts`）：打开时胶囊在面板长出来的头一段淡出，收起时最后淡入。
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
  deskSheetFill,
  fontSans,
} from "../floating-panel/tokens";
import {
  DOCK_DETACH_PULL,
  isStickyEdge,
  stuckPull,
  type DockSilhouette,
  type StickyEdge,
} from "./dockLiquid";
import {
  dockFrame,
  dockMetrics,
  dockSize,
  forgetUnsavedDock,
  measureDock,
  PANEL_DOCK_POSITION_KEY,
  readStoredDock,
  saveStoredDock,
  writeDockEdge,
} from "./dockMeasure";
import { createDockPainter, prefersReducedMotion } from "./dockPainter";
import {
  clampDockPoint,
  pinToEdge,
  snapDockEdge,
  type DockEdge,
  type DockPoint,
  type StoredDock,
} from "./dockPlacement";

export const PANEL_DOCK_ROOT_ID = "imw-panel-dock-root";
// 量取与存档在 `dockMeasure.ts`；这里转出去，调用方和测试仍从 `PanelDock` 取
export { PANEL_DOCK_POSITION_KEY };
/** 按下后移动超过它才算拖动，否则是点击还原。 */
const DOCK_DRAG_THRESHOLD = 4;
/** 聊天区尺寸变化没有事件可听（输入框上方的内容也会把它顶走），低频轮询兜底。 */
const DOCK_FOLLOW_MS = 500;

export interface PanelDockProps {
  onOpen: () => void;
  /**
   * 怎么出现：`rise` 从下往上浮出（页面刚加载）；`handover` 先藏着，等面板缩回来再由
   * `reveal` 淡入（面板收起时）。
   */
  entrance?: "rise" | "handover";
}

/** 当前挂着的胶囊此刻露出的那块：面板从这里长出来。没有胶囊时为 null。 */
let liveSilhouette: (() => DockSilhouette | null) | null = null;

export function readDockSilhouette(): DockSilhouette | null {
  return liveSilhouette?.() ?? null;
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

/** 只在真有悬停的设备上悬停展开：触屏的 :hover 会粘住。 */
const canHover = () => !!window.matchMedia?.("(hover: hover)")?.matches;

/** 只认键盘带来的焦点：鼠标拖动留下的焦点不能让胶囊一直展开。 */
function isKeyboardFocus(target: EventTarget | null) {
  try {
    return !!(target as HTMLElement | null)?.matches?.(":focus-visible");
  } catch {
    return false;
  }
}

export function PanelDock({ onOpen, entrance = "rise" }: PanelDockProps) {
  const layer = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const shape = useRef<SVGPathElement>(null);
  const tips = useRef<SVGPathElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const drag = useRef<DockDrag | null>(null);
  const justDragged = useRef(false);

  const reference = () => layer.current as HTMLElement;

  // 形状和动画都在 `dockPainter.ts`；这里只管手势和存档
  const painterRef = useRef<ReturnType<typeof createDockPainter>>();
  if (!painterRef.current)
    painterRef.current = createDockPainter({
      reference,
      pill: () => pill.current,
      shape: () => shape.current,
      tips: () => tips.current,
      button: () => button.current,
      label: () => label.current,
    });
  const painter = painterRef.current;

  const place = (element: HTMLElement, { x, y }: DockPoint) => {
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  };

  useLayoutEffect(() => {
    const element = pill.current;
    if (!element) return;
    const sync = () => {
      if (drag.current) return;
      // 位置要按胶囊的高度算，所以先定高度
      element.style.height = `${dockMetrics().height}px`;
      const { x, y } = measureDock(reference(), dockSize(element));
      place(element, { x, y });
      writeDockEdge(element, readStoredDock()?.edge);
      painter.refresh();
      // 胶囊常驻：宿站换主题也要跟上
      layer.current?.setAttribute("data-imw-theme", themeAttr(hostIsDark()));
    };
    sync();
    const silhouette = painter.silhouette;
    liveSilhouette = silhouette;
    const timer = window.setInterval(sync, DOCK_FOLLOW_MS);
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    return () => {
      if (liveSilhouette === silhouette) liveSilhouette = null;
      window.clearInterval(timer);
      painter.stop();
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, []);

  const endDrag = () => {
    const finished = drag.current;
    const element = pill.current;
    drag.current = null;
    if (!element) return;
    element.removeAttribute("data-imw-dock-held");
    painter.stopDragging();
    painter.setHeld(false);
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
    // 位置马上到终点，视觉上从松手的地方走回去；还粘着的话，丝也跟着收回耳朵
    painter.settleFrom({ x: point.x - final.x, y: point.y - final.y });
    place(element, final);
    writeDockEdge(element, edge);
    const saved: StoredDock = edge ? { ...final, edge } : final;
    saveStoredDock(saved);
    painter.refresh();
  };

  return (
    <div
      ref={layer}
      data-imw-dock-layer="true"
      // overflow-hidden：拉丝和展开都不能画到层外。宿站侧栏把 body 推走时，层的左缘就是胶囊贴着的那条边
      className={`pointer-events-none fixed inset-0 z-[90009] overflow-hidden ${entrance === "rise" ? "animate-[imwRiseIn_200ms_ease-out] motion-reduce:animate-none" : ""} ${deskDockShadow}`}
    >
      {/* 只占 1px、靠 overflow 画出去：铺满全屏的话，外层投影滤镜每帧都要处理整个屏幕，拖动会卡 */}
      <svg
        aria-hidden="true"
        className="absolute top-0 left-0 h-px w-px overflow-visible"
      >
        <path
          ref={shape}
          d=""
          data-imw-dock-shape="true"
          className={deskSheetFill}
        />
        <path
          ref={tips}
          d=""
          data-imw-dock-tips="true"
          className={deskSheetFill}
        />
      </svg>
      <div
        ref={pill}
        role="group"
        aria-label="点歌台"
        data-imw-panel-dock="true"
        className={`pointer-events-auto fixed flex touch-none select-none border border-solid border-transparent whitespace-nowrap transition-none ${deskInk}`}
        {...stopHostGestures}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch" && canHover())
            painter.setHovered(true);
        }}
        onPointerLeave={() => painter.setHovered(false)}
        onFocusIn={(event) => painter.setFocused(isKeyboardFocus(event.target))}
        onFocusOut={() => painter.setFocused(false)}
        onPointerDown={(event) => {
          const element = pill.current;
          if (!element || !event.isPrimary || event.button !== 0) return;
          justDragged.current = false;
          // 上一次松手的落定还没结束就又按下：直接到终点，再开始拖
          painter.cancelSettle();
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
          painter.setHeld(true);
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
          painter.startDragging();
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
              current.stuckDistance = Math.max(pull, 0);
              painter.paint();
              return;
            }
            painter.detach(current.stuck, current.stuckDistance);
            current.stuck = null;
          }
          writeDockEdge(element, null);
          painter.paint();
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
          ref={button}
          type="button"
          aria-label="打开点歌台"
          className={`m-0 flex h-full w-full cursor-pointer items-center border-0 bg-transparent text-inherit transition-none [&>svg]:shrink-0 ${fontSans} ${deskFocusRing}`}
        >
          <DeskIcon name="mark" size={16} />
          <span
            ref={label}
            data-imw-dock-label="true"
            className="inline-block overflow-hidden transition-none"
          >
            点歌台
          </span>
        </button>
      </div>
    </div>
  );
}

export interface PanelDockHandle {
  unmount(): void;
  /**
   * 和面板交接时胶囊的可见程度：0 看不见，1 正常。`interactive` 为 false 时整个胶囊 `inert`，
   * 点不到也聚焦不到；默认只有完全显示时才能点。
   */
  reveal(amount: number, interactive?: boolean): void;
}

/** 挂到 body。`handover` 挂上时是藏着的，等 `reveal(1)`。 */
export function mountPanelDock(props: PanelDockProps): PanelDockHandle {
  releasePanelDock();
  const root = document.createElement("div");
  root.id = PANEL_DOCK_ROOT_ID;
  document.body.appendChild(root);
  const handle: PanelDockHandle = {
    unmount() {
      render(null, root);
      root.remove();
    },
    reveal(amount, interactive = amount >= 1) {
      const visible = Math.min(Math.max(amount, 0), 1);
      // 透明度写在带 z-index 的那一层上。写在根节点上的话，没有定位的根会变成 z 0 的层叠上下文，
      // 整个胶囊沉到面板和盖在面板上的底色下面，淡出淡入都看不见
      const layer = root.firstElementChild as HTMLElement | null;
      if (layer) {
        if (visible >= 1) layer.style.removeProperty("opacity");
        else layer.style.opacity = `${visible}`;
      }
      root.toggleAttribute("inert", !interactive);
    },
  };
  render(<PanelDock {...props} />, root);
  // 同一个任务里藏好，浏览器还没绘制，不会闪出来
  if (props.entrance === "handover") handle.reveal(0);
  return handle;
}

export function releasePanelDock(): void {
  forgetUnsavedDock();
  for (const node of document.querySelectorAll(`#${PANEL_DOCK_ROOT_ID}`)) {
    // 先卸载：停掉跟随用的定时器和视口监听
    render(null, node);
    node.remove();
  }
}
