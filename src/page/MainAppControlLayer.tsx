import { Component, ComponentChild } from "preact";
import { MainApp } from "./MainApp";
import {
  mediaSession,
  subscribeMediaSession,
} from "../media-progress/MediaSession";
import { Input_Behavior_Module } from "../input-behavior-module/Input-Behavior-Module";
import { closeSidebar } from "../iirose_func/CloseSideBar";
import { Gesture } from "../listener/Gesture";
import { isHostTextTarget, setPanelPresence } from "../listener/panelPresence";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import { SyncManager } from "../sync/SyncManager";
import { hostIsDark } from "../iirose_func/HostTheme";
import { themeAttr } from "./components/floating-panel/floatingPanel";
import {
  closePanelTier,
  hasOverlayLayers,
  setPanelBackHandler,
} from "./components/desk/overlayLayers";
import {
  mountPanelDock,
  readDockSilhouette,
  type PanelDockHandle,
} from "./components/panel-window/PanelDock";
import { restingDockSilhouette } from "./components/panel-window/dockMeasure";
import { prefersReducedMotion } from "./components/panel-window/dockPainter";
import { PANEL_WINDOW_RADIUS } from "./components/panel-window/geometry";
import { createPanelGrow } from "./components/panel-window/panelGrow";
import { PanelWindowChrome } from "./components/panel-window/PanelWindowChrome";
import { PanelWindowPlacement } from "./components/panel-window/PanelWindowPlacement";
import { viewportMetrics } from "../media-progress/viewport";
import {
  deskMenuShadow,
  deskRule,
  roundedLg,
} from "./components/floating-panel/tokens";

interface MainAppControlLayerState {
  mainAppDisplay: boolean;
  init: boolean;
  searchKeyword: string;
  /** 面板按窗口显示（设置开启且视口放得下）；由 `PanelWindowPlacement` 回报。 */
  windowed: boolean;
}

/** 窗口态的容器外观：状态类见 `app.css`，颜色只拼令牌。 */
const WINDOW_CLASS = `imw-panel-window border border-solid ${roundedLg} ${deskRule} ${deskMenuShadow}`;

export class MainAppControlLayer extends Component<
  object,
  MainAppControlLayerState
> {
  private mainHolder: HTMLElement | null = null;
  private unsubscribeSession?: () => void;
  private placement?: PanelWindowPlacement;
  private unsubscribePanelDisplay?: () => void;
  private dock?: PanelDockHandle;
  /** 开合动画：打开时胶囊撑大成面板，收起时缩回胶囊。 */
  private grow = createPanelGrow(
    () => document.getElementById("IIROSE_MEDIA_CONTAINER"),
    prefersReducedMotion,
  );
  constructor(props: undefined) {
    super(props);
  }

  state = {
    mainAppDisplay: false,
    init: false,
    searchKeyword: "",
    windowed: false,
  };

  render(): ComponentChild {
    const { mainAppDisplay, init, searchKeyword, windowed } = this.state;
    const { changeSearchKeyword } = this.controller;
    const activeClass = mainAppDisplay
      ? "ShowIIROSE_MEDIA_CONTAINER"
      : "IIROSE_MEDIA_CONTAINER";
    return (
      <div
        id="IIROSE_MEDIA_CONTAINER"
        class={`IIROSE_MEDIA_CONTAINER ${activeClass} ${windowed ? WINDOW_CLASS : ""}`}
        // 窗口态的事件隔离：范围与全屏时 body 上的拦截一致，窗口外的宿站不受影响
        onMouseDown={windowed ? Gesture.IMCActiveEventHandler : undefined}
        onTouchStart={windowed ? Gesture.IMCActiveEventHandler : undefined}
      >
        {init && windowed && this.placement ? (
          <PanelWindowChrome
            placement={this.placement}
            onMinimize={this.minimize}
          />
        ) : null}
        {init ? (
          <MainApp
            ShowHideMainApp={this.ShowHideMainApp}
            searchKeyword={searchKeyword}
            changeSearchKeyword={changeSearchKeyword}
            mainAppDisplay={mainAppDisplay}
          />
        ) : null}
      </div>
    );
  }

  componentDidMount(): void {
    // 1. 核心绑定：让手势类知道触发后该跑哪个函数
    Gesture.ShowHideMainApp = this.ShowHideMainApp;

    this.mainHolder = document.getElementById("mainHolder");
    this.applyTheme();
    this.startPlacement();
    this.syncDock();

    // 2. 初始化其他模块
    const { changeSearchKeyword } = this.controller;
    Input_Behavior_Module.init(changeSearchKeyword, this.ShowHideMainApp);

    // 会话可能晚于本组件提供（init 里两个模块先后创建）：提供时把当前开合状态补上。
    this.unsubscribeSession = subscribeMediaSession(() => {
      mediaSession()?.setPanelOpen?.(this.state.mainAppDisplay);
    });

    // 3. 注册全局事件
    window.addEventListener("keydown", this.hotkeyControlApp);
    window.addEventListener("touchstart", Gesture.handleTouchStart);
    window.addEventListener("touchend", Gesture.touchEnd);
  }

  componentDidUpdate(
    _prevProps: object,
    prevState: MainAppControlLayerState,
  ): void {
    // 已经提交 DOM、浏览器还没绘制：这时开始开合，第一帧就裁好了
    if (prevState.mainAppDisplay !== this.state.mainAppDisplay)
      this.startGrow(this.state.mainAppDisplay, this.state.windowed);
    else this.syncDock();
  }

  /** 胶囊常驻：面板没开着就显示，点它打开。开合时由 `startGrow` 交接，这里只在没有动画时对齐。 */
  private syncDock() {
    if (this.grow.running) return;
    if (!this.state.mainAppDisplay) {
      this.dock ??= mountPanelDock({ onOpen: this.ShowHideMainApp });
      this.dock.reveal(1);
      return;
    }
    this.dock?.unmount();
    this.dock = undefined;
  }

  /** 开合动画（`panelGrow.ts`）：起点和终点都是胶囊此刻露出的那块。 */
  private startGrow(open: boolean, windowed: boolean) {
    const container = document.getElementById("IIROSE_MEDIA_CONTAINER");
    if (!container) return;
    const { width, height } = viewportMetrics(container);
    const rect = (windowed && this.placement?.rect) || {
      x: 0,
      y: 0,
      width,
      height,
    };
    const radius = windowed ? PANEL_WINDOW_RADIUS : 0;
    const panel = {
      ...rect,
      radii: [radius, radius, radius, radius] as [
        number,
        number,
        number,
        number,
      ],
    };
    if (open) {
      // 胶囊留到面板长完再卸载：头一段由动画把它淡出
      const dock = this.dock;
      this.grow.start({
        direction: "open",
        capsule: readDockSilhouette() ?? restingDockSilhouette(container),
        panel,
        // 淡出期间也点不到：双击不会又把面板关上
        onDock: (amount) => dock?.reveal(amount, false),
        onDone: () => {
          if (this.dock !== dock) return;
          dock?.unmount();
          this.dock = undefined;
        },
      });
      return;
    }
    // 收起：胶囊先挂上但藏着（打开没走完时它还在），面板缩回它露出的那块后淡入
    this.dock ??= mountPanelDock({
      onOpen: this.ShowHideMainApp,
      entrance: "handover",
    });
    const dock = this.dock;
    this.grow.start({
      direction: "close",
      capsule: restingDockSilhouette(container),
      panel,
      onDock: (amount) => dock.reveal(amount),
      onDone: () => dock.reveal(1),
    });
  }

  componentWillUnmount(): void {
    this.grow.finish();
    this.dock?.unmount();
    this.dock = undefined;

    // 卸载时面板一定不可见：撤掉 250ms 的活跃标记。
    this.unsubscribeSession?.();
    this.unsubscribeSession = undefined;
    mediaSession()?.setPanelOpen?.(false);

    // 1. 基础清理
    window.removeEventListener("keydown", this.hotkeyControlApp);
    window.removeEventListener("touchstart", Gesture.handleTouchStart);
    window.removeEventListener("touchend", Gesture.touchEnd);

    // 2. 强力清理 Body 上的拦截器（防止组件销毁后拦截失效）
    document.body.removeEventListener(
      "mousedown",
      Gesture.IMCActiveEventHandler,
    );
    document.body.removeEventListener(
      "touchstart",
      Gesture.IMCActiveEventHandler,
    );

    // 3. 窗口摆放收尾
    this.unsubscribePanelDisplay?.();
    this.unsubscribePanelDisplay = undefined;
    this.placement?.dispose();
    this.placement = undefined;
    setPanelPresence({ open: false, windowed: false });

    // 4. 引用清理
    Gesture.ShowHideMainApp = undefined;
    // 5. 返回键不再归面板管（宿站照常执行返回）
    setPanelBackHandler(null);
  }

  /** 按宿站当前主题写 `data-imw-theme`（与浮窗同一判定）；面板打开期间不跟随。 */
  private applyTheme() {
    document
      .getElementById("IIROSE_MEDIA_CONTAINER")
      ?.setAttribute("data-imw-theme", themeAttr(hostIsDark()));
  }

  /** 开始摆放窗口，并跟随设置开关（无需刷新）。 */
  private startPlacement() {
    const container = document.getElementById("IIROSE_MEDIA_CONTAINER");
    if (!container) return;
    this.placement = new PanelWindowPlacement(container, (windowed) => {
      // 先写 presence：设置行紧接着要读它决定状态文字
      setPanelPresence({ windowed });
      this.setState({ windowed });
    });
    this.unsubscribePanelDisplay = PluginSettings.onPanelDisplayChange(
      (display) => this.placement?.setEnabled(display === "window"),
    );
    this.placement.start(
      PluginSettings.getPluginSetting().panelDisplay === "window",
    );
  }

  /** 全屏打开时拦截页面事件（聊天区被面板盖住，不挪动它）；窗口态和关闭时都交还宿站。 */
  private applyHostCover(isShowing: boolean, windowed: boolean) {
    if (isShowing && !windowed) {
      document.body.addEventListener(
        "mousedown",
        Gesture.IMCActiveEventHandler,
      );
      document.body.addEventListener(
        "touchstart",
        Gesture.IMCActiveEventHandler,
      );
    } else {
      document.body.removeEventListener(
        "mousedown",
        Gesture.IMCActiveEventHandler,
      );
      document.body.removeEventListener(
        "touchstart",
        Gesture.IMCActiveEventHandler,
      );
    }
  }

  // 将副作用逻辑提取成一个独立方法
  private applyDisplaySideEffects(isShowing: boolean, windowed: boolean) {
    // 面板开着才需要 250ms 的媒体刷新（底部条要显示可用性）；关掉后退回 1s。
    mediaSession()?.setPanelOpen?.(isShowing);
    const el = document.getElementById("IIROSE_MEDIA_CONTAINER");
    if (el) {
      isShowing
        ? el.classList.add("ShowIIROSE_MEDIA_CONTAINER")
        : el.classList.remove("ShowIIROSE_MEDIA_CONTAINER");
    }

    // 宿站返回键：面板开着时接管（先关面板内的层，再关面板），关着时交还宿站
    this.applyBackHandler(isShowing);

    // 云端同步：打开 UI 时静默拉一次并启动兜底定时器，关闭时停掉
    // （聊天站里页面常驻可见，可见性事件不会触发，兜底定时器是关键）
    if (isShowing) SyncManager.onUiOpened();
    else SyncManager.onUiClosed();

    this.applyHostCover(isShowing, windowed);
    if (this.mainHolder) closeSidebar();
  }

  shouldComponentUpdate(
    _nextProps: object,
    nextState: MainAppControlLayerState,
  ) {
    // `@` 搜索要问面板开没开；首次打开可能与初始化合批，放在所有分支之前
    setPanelPresence({ open: nextState.mainAppDisplay });

    // 1. 初始化检查（与打开合批时也要先按当前主题着色）
    if (!this.state.init && nextState.init) {
      if (nextState.mainAppDisplay) this.applyTheme();
      return true;
    }

    // 2. 核心：只要显示状态发生了变化，就执行副作用
    if (this.state.mainAppDisplay !== nextState.mainAppDisplay) {
      // 只在关→开时读宿站主题：面板开着期间（如搜索词变化）不跟随
      if (nextState.mainAppDisplay) this.applyTheme();
      // 拖动中关窗口（Alt+S、Esc）：手势到此结束，移动过的照常保存
      else this.placement?.endGesture();
      this.applyDisplaySideEffects(
        nextState.mainAppDisplay,
        nextState.windowed,
      );
      // 显示状态必须传给 MainApp（`active` 决定打开时是否把焦点放进搜索栏），
      // 不能像旧版那样在 searchKeyword 未变时拦截 render。
      return true;
    }

    // 窗口态变化（开关、视口跨过阈值）：只重算拦截
    if (this.state.windowed !== nextState.windowed) {
      this.applyHostCover(nextState.mainAppDisplay, nextState.windowed);
      return true;
    }

    // 3. 业务逻辑检查：如果搜索词变了，必须允许 render 以更新子组件列表
    if (this.state.searchKeyword !== nextState.searchKeyword) {
      // 额外保险：确保在 render 前，容器样式是正确的。
      // 空词只来自面板内的清除，不再走这条（它会触发云同步拉取、收起侧栏）
      if (nextState.searchKeyword)
        this.applyDisplaySideEffects(
          nextState.mainAppDisplay,
          nextState.windowed,
        );
      return true;
    }

    return true;
  }

  // ShowHideMainApp 就只需要专注处理状态
  private ShowHideMainApp = async () => {
    const { mainAppDisplay, init } = this.state;
    if (!init) await this.setState({ init: true });
    this.setState({ mainAppDisplay: !mainAppDisplay }); // 这里触发 SCU
  };

  /** 标题栏的最小化钮：窗口收回胶囊。 */
  private minimize = () => {
    // 键盘能绕过菜单遮罩点到这里：留着菜单的层，返回键和 Esc 就交还不了宿站
    closePanelTier("inner");
    this.setState({ mainAppDisplay: false });
  };

  /** 宿站返回键：面板开着时接管（层由层级栈先处理），关着时交还宿站。 */
  private applyBackHandler(isShowing: boolean) {
    setPanelBackHandler(isShowing ? this.closeFromHostBack : null);
  }

  /** 宿站返回键落在面板上时的处理器：只关面板（层与浮层由层级栈先处理）。 */
  private closeFromHostBack = () => {
    this.setState({ mainAppDisplay: false });
  };

  controller = {
    /**
     * @description 更新搜索词
     * @param keyword
     * @returns
     */
    changeSearchKeyword: (keyword: string | null) => {
      // 空串也要记下：否则清除后全局词停在旧值，再 `@` 同一个词不会触发搜索
      if (keyword !== null) this.setState({ searchKeyword: keyword });
    },
  };

  private hotkeyControlApp = (event: KeyboardEvent) => {
    if (
      (event.altKey && event.key === "s") ||
      (event.altKey && event.key === "S") ||
      (event.altKey && event.key === "ß")
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const focusedElement = document.activeElement as HTMLElement;
      if (focusedElement && focusedElement.tagName === "TEXTAREA") {
        focusedElement.blur();
      }
      this.ShowHideMainApp();
    } else if (event.key === "Escape") {
      // 层级栈非空时由栈在捕获阶段处理并拦下（外来浮层根的事件也要放行给它）；
      // 组合输入中的 Esc 不算关闭手势。
      if (event.defaultPrevented || event.isComposing) return;
      // 面板关着：这个 Esc 与面板无关
      if (!this.state.mainAppDisplay) return;
      if (hasOverlayLayers()) return;
      // 窗口开着、焦点在聊天框：这个 Esc 归宿站
      if (isHostTextTarget(event.target)) return;
      this.setState({ mainAppDisplay: false });
    }
  };
}
