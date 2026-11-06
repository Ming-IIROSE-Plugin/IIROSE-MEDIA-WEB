// 主面板窗口的摆放：存档、视口监听和拖动 / 缩放手势。
// 几何直接写容器 `style`，只有「是否按窗口显示」变化时才回调，所以拖动不触发重渲染。
// 手势结束才写盘；视口变化只改显示，存档留着等视口恢复。
import {
  currentViewportPosition,
  viewportMetrics,
  pointerPosition,
} from "../../../media-progress/viewport";
import { readJson, writeJson } from "../../../storage/localStore";
import { startsOnControl } from "../floating-panel/floatingPanel";
import { isPhoneLayout } from "../media-card-container/mediaFormat";
import {
  defaultRect,
  dragRect,
  fitRect,
  normalizeStoredRect,
  resizeRect,
  viewportFitsWindow,
  type PanelRect,
  type PanelViewport,
  type ResizeEdge,
} from "./geometry";

export const PANEL_WINDOW_RECT_KEY = "imwPanelWindowRect";

type HandleEvent = Pick<
  PointerEvent,
  | "isPrimary"
  | "button"
  | "pointerId"
  | "clientX"
  | "clientY"
  | "target"
  | "currentTarget"
>;

export interface PanelWindowHandle {
  onPointerDown: (event: HandleEvent) => void;
  onPointerMove: (event: HandleEvent) => void;
  onPointerUp: (event: HandleEvent) => void;
  onPointerCancel: () => void;
  onLostPointerCapture: () => void;
}

interface WindowGesture {
  pointer: number;
  /** `move` = 拖标题栏，其余是缩放的方向。 */
  kind: "move" | ResizeEdge;
  x: number;
  y: number;
  start: PanelRect;
}

const sameRect = (a: PanelRect, b: PanelRect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export class PanelWindowPlacement {
  private enabled = false;
  private windowed = false;
  /** 存档：用户最后摆好的位置，视口变小时也不动。 */
  private stored: PanelRect | null = null;
  /** 当前显示的矩形；全屏时为 null。 */
  private shown: PanelRect | null = null;
  private gesture: WindowGesture | null = null;

  constructor(
    private readonly element: HTMLElement,
    private readonly onWindowedChange: (windowed: boolean) => void,
  ) {}

  start(enabled: boolean): void {
    this.enabled = enabled;
    this.stored = normalizeStoredRect(readJson(PANEL_WINDOW_RECT_KEY, null));
    window.addEventListener("resize", this.sync);
    window.addEventListener("scroll", this.sync, { passive: true });
    window.addEventListener("blur", this.endGesture);
    window.visualViewport?.addEventListener("resize", this.sync);
    window.visualViewport?.addEventListener("scroll", this.sync);
    this.sync();
  }

  dispose(): void {
    window.removeEventListener("resize", this.sync);
    window.removeEventListener("scroll", this.sync);
    window.removeEventListener("blur", this.endGesture);
    window.visualViewport?.removeEventListener("resize", this.sync);
    window.visualViewport?.removeEventListener("scroll", this.sync);
    this.gesture = null;
    this.clearStyle();
  }

  /** 当前显示的矩形；全屏时为 null。收起的窗口量不准，缩向胶囊的终点要用它算。 */
  get rect(): PanelRect | null {
    return this.shown;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.sync();
  }

  /** 按当前视口重算显示；视口变化时不写盘，也不打断手势。 */
  private sync = (): void => {
    const viewport = this.viewport();
    // 放不放得下看布局视口：键盘和捏合只缩小可视视口，不该把窗口变成全屏、藏起聊天区。
    const { scale } = viewportMetrics(this.element);
    const windowed =
      this.enabled &&
      !isPhoneLayout() &&
      viewportFitsWindow({
        ...viewport,
        width: window.innerWidth / scale,
        height: window.innerHeight / scale,
      });
    if (windowed) {
      this.show(
        fitRect(
          (this.gesture && this.shown) || this.stored || defaultRect(viewport),
          viewport,
        ),
      );
    } else {
      // 手势进行中变成全屏：这次手势作废，不写盘。
      this.gesture = null;
      this.shown = null;
      this.clearStyle();
    }
    if (windowed === this.windowed) return;
    this.windowed = windowed;
    this.onWindowedChange(windowed);
  };

  private viewport(): PanelViewport {
    const { metrics, offsetLeft, offsetTop } = currentViewportPosition(
      this.element,
    );
    return {
      width: metrics.width,
      height: metrics.height,
      offsetX: offsetLeft,
      offsetY: offsetTop,
    };
  }

  private show(rect: PanelRect): void {
    this.shown = rect;
    const { style } = this.element;
    style.left = `${rect.x}px`;
    style.top = `${rect.y}px`;
    style.width = `${rect.width}px`;
    style.height = `${rect.height}px`;
  }

  private clearStyle(): void {
    const { style } = this.element;
    style.removeProperty("left");
    style.removeProperty("top");
    style.removeProperty("width");
    style.removeProperty("height");
  }

  /** 结束手势（松手、取消、失焦、丢失捕获、关窗口）：矩形真的变了才写盘。 */
  endGesture = (): void => {
    const gesture = this.gesture;
    if (!gesture) return;
    this.gesture = null;
    if (!this.shown || sameRect(this.shown, gesture.start)) return;
    this.stored = this.shown;
    writeJson(PANEL_WINDOW_RECT_KEY, this.stored);
  };

  private handle(kind: WindowGesture["kind"]): PanelWindowHandle {
    return {
      onPointerDown: (event) => {
        if (!event.isPrimary || event.button !== 0 || !this.shown) return;
        if (kind === "move" && startsOnControl(event)) return;
        const pointer = pointerPosition(
          this.element,
          event.clientX,
          event.clientY,
        );
        this.gesture = {
          pointer: event.pointerId,
          kind,
          x: pointer.x,
          y: pointer.y,
          start: this.shown,
        };
        (event.currentTarget as Element | null)?.setPointerCapture?.(
          event.pointerId,
        );
      },
      onPointerMove: (event) => {
        const gesture = this.gesture;
        if (!gesture || gesture.pointer !== event.pointerId) return;
        const pointer = pointerPosition(
          this.element,
          event.clientX,
          event.clientY,
        );
        const dx = pointer.x - gesture.x;
        const dy = pointer.y - gesture.y;
        const viewport = this.viewport();
        this.show(
          gesture.kind === "move"
            ? dragRect(gesture.start, dx, dy, viewport)
            : resizeRect(gesture.start, gesture.kind, dx, dy, viewport),
        );
      },
      onPointerUp: (event) => {
        if (this.gesture?.pointer === event.pointerId) this.endGesture();
      },
      onPointerCancel: this.endGesture,
      onLostPointerCapture: this.endGesture,
    };
  }

  /** 标题栏的指针事件（从关闭钮按下不算拖动）。 */
  readonly moveHandle = this.handle("move");

  /** 缩放抓取区的指针事件。 */
  resizeHandle(edge: ResizeEdge): PanelWindowHandle {
    return this.handle(edge);
  }
}
