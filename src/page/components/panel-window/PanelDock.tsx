// 最小化停靠件：窗口让开聊天时贴在输入框右上方的胶囊。挂在 body 独立根上（宿站主容器
// 会平移），只占胶囊自己的矩形，其余区域的点击和按键都归宿站。不改宿站输入框 DOM。
import { render } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { hostIsDark } from "../../../iirose_func/HostTheme";
import { viewportMetrics } from "../../../media-progress/viewport";
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
  dockFlight,
  dockPosition,
  type DockAnchor,
  type DockPoint,
  type DockSize,
} from "./dockPlacement";
import type { PanelViewport } from "./geometry";

export const PANEL_DOCK_ROOT_ID = "imw-panel-dock-root";
/** 真站 `#moveinput` 的外层；`#mainHolder` 隐藏时尺寸为 0，按缺失处理。 */
const DOCK_ANCHOR_ID = "moveinputDisplay";
/** 聊天区尺寸变化没有事件可听（输入框上方的内容也会把它顶走），低频轮询兜底。 */
const DOCK_FOLLOW_MS = 500;
/** 飞行开始时胶囊还没挂载，用标称尺寸算终点。 */
const DOCK_NOMINAL_SIZE: DockSize = { width: 114, height: 38 };

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
 * 胶囊该摆的位置（`fixed` 只看可视视口的平移，不加页面滚动）。`reference` 用来量宿站缩放，
 * 要够宽：`offsetWidth` 是取整的，拿胶囊自己量（约 113px）在 1.15 倍下会差出 4px。
 */
function measureDock(reference: HTMLElement, size: DockSize): DockPoint {
  const { scale, width, height } = viewportMetrics(reference);
  const viewport: PanelViewport = {
    width,
    height,
    offsetX: (window.visualViewport?.offsetLeft || 0) / scale,
    offsetY: (window.visualViewport?.offsetTop || 0) / scale,
  };
  return dockPosition(readAnchor(scale), size, viewport);
}

/** 写窗口缩向胶囊的位移（CSS 变量，见 `app.css` 的 `.imw-panel-minimized`）。要在窗口收起前量。 */
export function writeDockFlight(container: HTMLElement): void {
  const { scale } = viewportMetrics(container);
  const rect = container.getBoundingClientRect();
  const flight = dockFlight(
    {
      x: rect.left / scale,
      y: rect.top / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    },
    measureDock(container, DOCK_NOMINAL_SIZE),
    DOCK_NOMINAL_SIZE,
  );
  container.style.setProperty("--imw-dock-x", `${flight.x}px`);
  container.style.setProperty("--imw-dock-y", `${flight.y}px`);
}

export function clearDockFlight(container: HTMLElement): void {
  container.style.removeProperty("--imw-dock-x");
  container.style.removeProperty("--imw-dock-y");
}

export interface PanelDockProps {
  onRestore: () => void;
  onClose: () => void;
}

export function PanelDock({ onRestore, onClose }: PanelDockProps) {
  const pill = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = pill.current;
    if (!element) return;
    const sync = () => {
      const { x, y } = measureDock(element.parentElement ?? element, {
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      // 最小化可以停很久，聊天照常用：期间宿站换主题也要跟上
      element.setAttribute("data-imw-theme", themeAttr(hostIsDark()));
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
  }, []);
  // 视口变小时胶囊还在，手机上也要够得着：与其它粗指针目标同为 44px
  const controlHeight = "h-9 max-[768px]:h-11 [@media(pointer:coarse)]:h-11";
  return (
    <div
      ref={pill}
      role="group"
      aria-label="点歌台已最小化"
      data-imw-panel-dock="true"
      className={`fixed z-[90009] flex rounded-full border border-solid whitespace-nowrap animate-[imwRiseIn_200ms_ease-out] motion-reduce:animate-none ${deskRule} ${deskSheet} ${deskInk} ${deskMenuShadow}`}
      {...stopHostGestures}
    >
      <button
        type="button"
        aria-label="还原点歌台"
        className={`m-0 flex cursor-pointer items-center gap-1.5 rounded-l-full border-0 bg-transparent pr-1.5 pl-3 text-inherit ${controlHeight} ${typeButtonSm} ${deskPressTone} ${deskFocusRing}`}
        onClick={onRestore}
      >
        <DeskIcon name="mark" size={16} />
        点歌台
      </button>
      <button
        type="button"
        aria-label="关闭点歌台"
        className={`m-0 flex w-8 cursor-pointer items-center justify-center rounded-r-full border-0 bg-transparent p-0 text-inherit max-[768px]:w-11 [@media(pointer:coarse)]:w-11 ${controlHeight} ${deskPressTone} ${deskFocusRing}`}
        onClick={onClose}
      >
        <DeskIcon name="close" size={14} />
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
