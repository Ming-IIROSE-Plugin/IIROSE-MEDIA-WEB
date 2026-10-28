import { Component, ComponentChild } from "preact";
import { MainApp } from "./MainApp";
import { Input_Behavior_Module } from "../input-behavior-module/Input-Behavior-Module";
import { closeSidebar } from "../iirose_func/CloseSideBar";
import { Gesture } from "../listener/Gesture";
import { SyncManager } from "../sync/SyncManager";
import { hostIsDark } from "../iirose_func/HostTheme";
import { themeAttr } from "./components/floating-panel/floatingPanel";

interface MainAppControlLayerState {
  mainAppDisplay: boolean;
  init: boolean;
  searchKeyword: string;
}

export class MainAppControlLayer extends Component<
  object,
  MainAppControlLayerState
> {
  private mainHolder: HTMLElement | null = null;
  constructor(props: undefined) {
    super(props);
  }

  state = {
    mainAppDisplay: false,
    init: false,
    searchKeyword: "",
  };

  render(): ComponentChild {
    const { mainAppDisplay, init, searchKeyword } = this.state;
    const { changeSearchKeyword } = this.controller;
    const activeClass = mainAppDisplay
      ? "ShowIIROSE_MEDIA_CONTAINER"
      : "IIROSE_MEDIA_CONTAINER";
    return (
      <div
        id="IIROSE_MEDIA_CONTAINER"
        class={`IIROSE_MEDIA_CONTAINER ${activeClass}`}
      >
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

    // 2. 初始化其他模块
    const { changeSearchKeyword } = this.controller;
    Input_Behavior_Module.init(changeSearchKeyword, this.ShowHideMainApp);

    // 3. 注册全局事件
    window.addEventListener("keydown", this.hotkeyControlApp);
    window.addEventListener("touchstart", Gesture.handleTouchStart);
    window.addEventListener("touchend", Gesture.touchEnd);
  }

  componentWillUnmount(): void {
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

    // 3. 面板开着时被卸载（重复注入接管）：归还宿站聊天区，否则会一直隐藏
    this.mainHolder?.classList.remove("hidemainHolder");

    // 4. 引用清理
    Gesture.ShowHideMainApp = undefined;
  }

  /** 按宿站当前主题写 `data-imw-theme`（与浮窗同一判定）；面板打开期间不跟随。 */
  private applyTheme() {
    document
      .getElementById("IIROSE_MEDIA_CONTAINER")
      ?.setAttribute("data-imw-theme", themeAttr(hostIsDark()));
  }

  // 将副作用逻辑提取成一个独立方法
  private applyDisplaySideEffects(isShowing: boolean) {
    const el = document.getElementById("IIROSE_MEDIA_CONTAINER");
    if (el) {
      isShowing
        ? el.classList.add("ShowIIROSE_MEDIA_CONTAINER")
        : el.classList.remove("ShowIIROSE_MEDIA_CONTAINER");
    }

    // 云端同步：打开 UI 时静默拉一次并启动兜底定时器，关闭时停掉
    // （聊天站里页面常驻可见，可见性事件不会触发，兜底定时器是关键）
    if (isShowing) SyncManager.onUiOpened();
    else SyncManager.onUiClosed();

    if (this.mainHolder) {
      if (isShowing) {
        this.mainHolder.classList.add("hidemainHolder");
        document.body.addEventListener(
          "mousedown",
          Gesture.IMCActiveEventHandler,
        );
        document.body.addEventListener(
          "touchstart",
          Gesture.IMCActiveEventHandler,
        );
      } else {
        this.mainHolder.classList.remove("hidemainHolder");
        document.body.removeEventListener(
          "mousedown",
          Gesture.IMCActiveEventHandler,
        );
        document.body.removeEventListener(
          "touchstart",
          Gesture.IMCActiveEventHandler,
        );
      }
      closeSidebar();
    }
  }

  shouldComponentUpdate(
    _nextProps: object,
    nextState: MainAppControlLayerState,
  ) {
    // 1. 初始化检查（与打开合批时也要先按当前主题着色）
    if (!this.state.init && nextState.init) {
      if (nextState.mainAppDisplay) this.applyTheme();
      return true;
    }

    // 2. 核心：只要显示状态发生了变化，就执行副作用
    if (this.state.mainAppDisplay !== nextState.mainAppDisplay) {
      // 只在关→开时读宿站主题：面板开着期间（如搜索词变化）不跟随
      if (nextState.mainAppDisplay) this.applyTheme();
      this.applyDisplaySideEffects(nextState.mainAppDisplay);
      // 注意：如果 searchKeyword 没变，我们可以拦截 render
      if (this.state.searchKeyword === nextState.searchKeyword) {
        return false;
      }
    }

    // 3. 业务逻辑检查：如果搜索词变了，必须允许 render 以更新子组件列表
    if (this.state.searchKeyword !== nextState.searchKeyword) {
      // 额外保险：确保在 render 前，容器样式是正确的
      this.applyDisplaySideEffects(nextState.mainAppDisplay);
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

  controller = {
    /**
     * @description 更新搜索词
     * @param keyword
     * @returns
     */
    changeSearchKeyword: (keyword: string | null) => {
      if (keyword !== null && keyword !== "")
        this.setState({ searchKeyword: keyword });
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
      this.setState({ mainAppDisplay: false });
    }
  };
}
