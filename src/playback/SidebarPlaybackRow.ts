import { ShowMessage } from "../iirose_func/ShowMessage";
import type {
  PlaybackMode,
  PlaybackModeKind,
  PlaybackModeState,
} from "./PlaybackMode";

interface PlaybackControl {
  mode: PlaybackModeKind;
  id: string;
  label: string;
  // MDI repeat / shuffle 路径，图标随按钮自包含，不借用宿站 mdi-* 类。
  icon: string;
}

// 注册表驱动：只决定布局与图标；模式行为（点亮/互斥/可用性）仍由 PlaybackMode 提供。
// 新增按钮追加一条注册项即可，点击白名单也由这张表派生。
const CONTROLS: PlaybackControl[] = [
  {
    mode: "loop",
    id: "imw-toggle-loop",
    label: "单曲循环",
    // Material repeat-one：双向循环箭头 + 中央「1」，与「单曲」语义一致。
    icon: "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z",
  },
  {
    mode: "shuffle",
    id: "imw-toggle-shuffle",
    label: "收藏随机",
    icon: "M14.83,13.41L13.42,14.82L16.55,17.95L14.5,20H20V14.5L17.96,16.54L14.83,13.41M14.5,4L16.54,6.04L4,18.59L5.41,20L17.96,7.46L20,9.5V4M10.59,9.17L5.41,4L4,5.41L9.17,10.58L10.59,9.17Z",
  },
];

const NOTICE_INTERVAL = 10_000;
const FALLBACK_NOTICE = "暂时无法调整播放模式";

// DOM 残留或注册表改名时 dataset 可能是任意字符串，只认注册过的模式。
function isPlaybackModeKind(
  value: string | undefined,
): value is PlaybackModeKind {
  return CONTROLS.some((control) => control.mode === value);
}

// 纯 DOM 行：宿站侧栏布局不进 Preact，只把状态映射到 aria 属性。
export class SidebarPlaybackRow {
  readonly element: HTMLDivElement;
  private buttons = new Map<PlaybackModeKind, HTMLButtonElement>();
  private pressed = new Map<PlaybackModeKind, boolean>();
  private notices = new Map<string, number>();
  private unsubscribe: () => void;
  private status: HTMLSpanElement;
  private standby = false;
  private standbyReason = "";
  // 本次待命期间是否已当面说明过原因：触屏无 hover、title 长按也不弹，
  // 亲手点亮即待命时当场说明；自动转入待命的，首次点按只说明不切换，再点才熄灭。
  private standbyExplained = false;
  private clearedId = 0;
  private disposed = false;

  constructor(
    private mode: PlaybackMode,
    private doc: Document = document,
  ) {
    this.element = doc.createElement("div");
    this.element.id = "imw-playback-controls";
    this.element.setAttribute("role", "group");
    this.element.setAttribute("aria-label", "播放模式");
    for (const control of CONTROLS) this.element.append(this.create(control));
    // 读屏可播报的原因文本：ShowMessage 走宿主 _alert，缺失时不能连读屏也静默。
    this.status = doc.createElement("span");
    this.status.setAttribute("role", "status");
    this.element.append(this.status);
    this.element.addEventListener("click", this.onClick);
    this.element.addEventListener("keydown", this.onKeyDown);
    this.unsubscribe = mode.subscribe((state) => this.render(state));
  }

  private buttonFrom(target: EventTarget | null): HTMLButtonElement | null {
    const button =
      target instanceof Element
        ? target.closest<HTMLButtonElement>("button[data-imw-mode]")
        : null;
    return button && this.element.contains(button) ? button : null;
  }

  private onClick = (event: Event) => {
    const button = this.buttonFrom(event.target);
    if (button) this.activate(button);
  };

  // Enter 在原生按钮上会派发 click；这里显式接管并阻止默认，避免重复触发。
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.defaultPrevented || event.isComposing)
      return;
    const button = this.buttonFrom(event.target);
    if (!button) return;
    event.preventDefault();
    this.activate(button);
  };

  private activate(button: HTMLButtonElement) {
    if (this.disposed) return;
    const kind = button.dataset.imwMode;
    if (!isPlaybackModeKind(kind)) return;
    const availability = this.mode.state[kind];
    if (!availability.enabled) {
      this.notice(availability.reason || FALLBACK_NOTICE);
      return;
    }
    const state = this.mode.state;
    if (state.mode === kind && state.standby && !this.standbyExplained) {
      this.standbyExplained = true;
      this.notice(state.standbyReason, false);
      return;
    }
    this.mode.toggle(kind);
    // 亲手点亮即进入待命：当场说明，下一次点按直接熄灭。
    const next = this.mode.state;
    if (next.mode === kind && next.standby) {
      this.standbyExplained = true;
      this.notice(next.standbyReason, false);
    }
  }

  private create(control: PlaybackControl): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.id = control.id;
    button.dataset.imwMode = control.mode;
    // 窄侧栏只显示图标时仍保留可访问名称。
    button.setAttribute("aria-label", control.label);
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-disabled", "false");
    const icon = this.doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "currentColor");
    const path = this.doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", control.icon);
    icon.append(path);
    const label = this.doc.createElement("span");
    label.textContent = control.label;
    button.append(icon, label);
    this.buttons.set(control.mode, button);
    return button;
  }

  private render(state: PlaybackModeState) {
    if (this.disposed) return;
    this.renderStandby(state);
    // 守卫清灭（如换房）自带一次性原因：令牌变化才提示，避免轮询刷屏；
    // 同一帧不再叠加「转为不可用」的原因，一次事件只提示一次。
    const cleared = state.cleared;
    const clearedNow = !!cleared && cleared.id !== this.clearedId;
    if (cleared) {
      this.clearedId = cleared.id;
      // 令牌本身已保证同一 id 只消费一次；换房文案重复出现时不能被 10 秒文本去重吞掉。
      if (clearedNow) this.notice(cleared.reason, false);
    }
    for (const control of CONTROLS) {
      const button = this.buttons.get(control.mode);
      if (!button) continue;
      const availability = state[control.mode];
      // 不可用时 aria-pressed 恒为 false，点亮由 enabled 前提保证。
      const pressed = state.mode === control.mode && availability.enabled;
      // 上一帧点亮、这一帧转为不可用：状态机已清灭，由行补一次原因提示。
      if (
        !clearedNow &&
        !pressed &&
        this.pressed.get(control.mode) &&
        !availability.enabled
      )
        this.notice(availability.reason || FALLBACK_NOTICE);
      this.pressed.set(control.mode, pressed);
      button.setAttribute("aria-pressed", pressed ? "true" : "false");
      button.setAttribute(
        "aria-disabled",
        availability.enabled ? "false" : "true",
      );
      // 待命（点亮但不动作）与生效态共用点亮视觉，只以 title 说明差异，不灰化。
      button.title =
        pressed && state.standby
          ? state.standbyReason
          : availability.reason || control.label;
    }
  }

  // 待命不弹提示：只在进入/退出时改写读屏状态区，避免别人每点一首就刷屏。
  private renderStandby(state: PlaybackModeState) {
    if (state.standby === this.standby) return;
    this.standby = state.standby;
    this.standbyExplained = false;
    if (state.standby) {
      this.standbyReason = state.standbyReason;
      this.status.textContent = state.standbyReason;
      return;
    }
    // 状态区可能已被后来的提示覆盖，只清理仍属于待命的那条。
    if (this.status.textContent === this.standbyReason)
      this.status.textContent = "";
    this.standbyReason = "";
  }

  // 同一原因 10 秒内只提示一次，避免连点灰化按钮或反复转不可用时刷屏。
  // 带令牌的守卫提示（如换房）传 dedupe=false：由令牌保证只消费一次。
  private notice(message: string, dedupe = true) {
    const now = Date.now();
    // 键是原因文案，随会话增长：写入前先丢弃已过窗口的旧键。
    for (const [reason, at] of this.notices)
      if (now - at >= NOTICE_INTERVAL) this.notices.delete(reason);
    if (dedupe && this.notices.has(message)) return;
    if (dedupe) this.notices.set(message, now);
    this.status.textContent = message;
    ShowMessage.show(message);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.element.removeEventListener("click", this.onClick);
    this.element.removeEventListener("keydown", this.onKeyDown);
    this.element.remove();
    this.notices.clear();
  }
}
