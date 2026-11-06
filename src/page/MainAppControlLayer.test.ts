import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef, h, render, type ComponentType } from "preact";
import { act } from "preact/test-utils";

// 只验证主题属性写入：主面板内容与宿站联动模块替换为空壳。
const mainAppMounts = vi.hoisted(() => ({ count: 0 }));
vi.mock("./MainApp", async () => {
  const { Component } = await import("preact");
  return {
    MainApp: class extends Component {
      componentDidMount() {
        mainAppMounts.count += 1;
      }
      render() {
        return null;
      }
    },
  };
});
const inputModule = vi.hoisted(() => ({
  changeSearchKeyword: undefined as
    ((keyword: string | null) => void) | undefined,
  showOrHide: undefined as (() => Promise<void>) | undefined,
}));
vi.mock("../input-behavior-module/Input-Behavior-Module", () => ({
  Input_Behavior_Module: {
    init: (
      changeSearchKeyword: (keyword: string | null) => void,
      showOrHide: () => Promise<void>,
    ) => {
      inputModule.changeSearchKeyword = changeSearchKeyword;
      inputModule.showOrHide = showOrHide;
    },
  },
}));
vi.mock("../iirose_func/CloseSideBar", () => ({ closeSidebar: () => {} }));
vi.mock("../sync/SyncManager", () => ({
  SyncManager: { onUiOpened: () => {}, onUiClosed: () => {} },
}));

import { MainAppControlLayer } from "./MainAppControlLayer";
import {
  provideMediaSession,
  releaseMediaSession,
} from "../media-progress/MediaSession";
import {
  pushOverlayLayer,
  setPanelBackHandler,
} from "./components/desk/overlayLayers";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import { isPanelOpen, isPanelWindowed } from "../listener/panelPresence";
import { PANEL_WINDOW_RECT_KEY } from "./components/panel-window/PanelWindowPlacement";
import { InputPlatformAnalysis } from "../input-behavior-module/InputPlatformAnalysis";

// 构造函数签名写的是 props: undefined，这里只按无 props 组件挂载。
const Layer = MainAppControlLayer as unknown as ComponentType<object>;

type ThemeWindow = Window & { theme?: unknown };
let host: HTMLDivElement;
const panel = () =>
  document.getElementById("IIROSE_MEDIA_CONTAINER") as HTMLElement;
const toggle = async () => {
  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", altKey: true }),
    );
  });
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  render(null, host);
  host.remove();
  setPanelBackHandler(null);
  delete (window as ThemeWindow).theme;
  delete (window as unknown as Record<string, unknown>).Utils;
  delete (window as unknown as Record<string, unknown>)
    .__imwOverlayBackDispatch;
  releaseMediaSession();
});

describe("面板开合驱动媒体轮询节奏", () => {
  it("会话晚于组件提供时补上当前状态（未打开 → false）", () => {
    render(h(Layer, {}), host);
    const setPanelOpen = vi.fn();
    provideMediaSession({
      bridge: {} as never,
      playback: {} as never,
      pickShuffle: () => {},
      setPanelOpen,
    });
    expect(setPanelOpen).toHaveBeenLastCalledWith(false);
  });

  // 「打开 → 250ms / 关闭 → 1s」这条端到端接线由真机脚本覆盖：
  // scripts/verify/media-polling.mjs 会 hook setInterval，实测 idle=[1000]、
  // 打开面板后出现 250。单测里 toggle 走 Alt+S，两次 setState 的批处理时序
  // 不稳定，写在这里只会锁住时序而不是行为。
});

describe("主面板主题属性", () => {
  it("挂载时按宿站主题写入：window.theme 假值即深色", () => {
    delete (window as ThemeWindow).theme;
    render(h(Layer, {}), host);
    expect(panel().getAttribute("data-imw-theme")).toBe("dark");
  });

  it("每次打开都重新读取宿站主题", async () => {
    (window as ThemeWindow).theme = 1;
    render(h(Layer, {}), host);
    expect(panel().getAttribute("data-imw-theme")).toBe("light");

    await toggle(); // 打开（浅色）
    expect(panel().classList.contains("ShowIIROSE_MEDIA_CONTAINER")).toBe(true);
    expect(panel().getAttribute("data-imw-theme")).toBe("light");

    await toggle(); // 关闭
    (window as ThemeWindow).theme = 0;
    // 面板关着时宿站切到深色：关着不改，再次打开才跟随
    expect(panel().getAttribute("data-imw-theme")).toBe("light");
    await toggle();
    expect(panel().getAttribute("data-imw-theme")).toBe("dark");
  });

  it("首次打开（与初始化合批）按打开那一刻的主题着色", async () => {
    (window as ThemeWindow).theme = 1;
    render(h(Layer, {}), host);
    expect(panel().getAttribute("data-imw-theme")).toBe("light");
    (window as ThemeWindow).theme = 0;
    await toggle();
    expect(panel().getAttribute("data-imw-theme")).toBe("dark");
  });

  it("面板开着时搜索词变化不重读宿站主题", async () => {
    (window as ThemeWindow).theme = 1;
    const ref = createRef<MainAppControlLayer>();
    render(h(Layer, { ref } as object), host);
    await toggle();
    expect(panel().getAttribute("data-imw-theme")).toBe("light");
    (window as ThemeWindow).theme = 0;
    await act(async () => {
      ref.current!.controller.changeSearchKeyword("关键词");
    });
    expect(ref.current!.state.searchKeyword).toBe("关键词");
    expect(panel().getAttribute("data-imw-theme")).toBe("light");
  });

  it("全局搜索词接受空串、忽略 null（清除后再 @ 同一个词才会触发）", async () => {
    const ref = createRef<MainAppControlLayer>();
    render(h(Layer, { ref } as object), host);
    await act(async () => {
      ref.current!.controller.changeSearchKeyword("关键词");
    });
    await act(async () => {
      ref.current!.controller.changeSearchKeyword(null);
    });
    expect(ref.current!.state.searchKeyword).toBe("关键词");
    const sideEffects = vi.spyOn(
      ref.current as unknown as {
        applyDisplaySideEffects(show: boolean): void;
      },
      "applyDisplaySideEffects",
    );
    await act(async () => {
      ref.current!.controller.changeSearchKeyword("");
    });
    expect(ref.current!.state.searchKeyword).toBe("");
    // 清除不能带出云同步拉取、收起侧栏这些显示副作用
    expect(sideEffects).not.toHaveBeenCalled();
  });

  it("品牌强调色已退役：根节点不带任何强调色变量类", () => {
    render(h(Layer, {}), host);
    const classes = panel().className.split(/\s+/);
    expect(classes.some((name) => name.includes("--imw-accent"))).toBe(false);
    expect(classes.some((name) => name.includes("--imw-brand"))).toBe(false);
  });
});

describe("Esc 与宿站返回键", () => {
  const escape = async () => {
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
  };
  const isOpen = () => panel().classList.contains("ShowIIROSE_MEDIA_CONTAINER");

  it("Esc 在无浮层时关面板；浮层登记后只关那一层", async () => {
    render(h(Layer, {}), host);
    await toggle();
    expect(isOpen()).toBe(true);

    const dismiss = vi.fn();
    const release = pushOverlayLayer("source", dismiss);
    await escape();
    expect(dismiss).toHaveBeenCalledOnce();
    expect(isOpen()).toBe(true);
    release();

    await escape();
    expect(isOpen()).toBe(false);
  });

  it("返回键：层开着只关层、面板不动；无层时关面板；面板关着时交还宿站", async () => {
    const hostBackward = vi.fn();
    // 宿站的 Utils 在全局有完整类型声明：这里按无类型对象替换 backward
    const hostWindow = window as unknown as Record<string, unknown>;
    const callBack = () =>
      (hostWindow.Utils as { backward: () => unknown }).backward();
    hostWindow.Utils = { backward: hostBackward };
    render(h(Layer, {}), host);
    // 打开 → 关闭 → 再打开：初始化渲染总是先落地，返回键接管发生在显示状态变化分支
    await toggle();
    await toggle();
    await toggle();
    expect(isOpen()).toBe(true);

    const dismiss = vi.fn();
    const release = pushOverlayLayer("order", dismiss);
    await act(async () => {
      callBack();
    });
    expect(dismiss).toHaveBeenCalledOnce();
    expect(hostBackward).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
    release();

    await act(async () => {
      callBack();
    });
    expect(isOpen()).toBe(false);
    expect(hostBackward).not.toHaveBeenCalled();

    // 面板关着：宿站返回照常执行
    await act(async () => {
      callBack();
    });
    expect(hostBackward).toHaveBeenCalledOnce();
  });
});

describe("窗口模式", () => {
  let mainHolder: HTMLDivElement;
  let chat: HTMLTextAreaElement;
  const bodyMouseDown = vi.fn();

  const seedDisplay = (panelDisplay: string) =>
    localStorage.setItem(
      "imwPluginSetting",
      JSON.stringify({ panelDisplay, chatBox: { isProxyAtInput: true } }),
    );
  const setWidth = (width: number) =>
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
  const mount = async () => {
    await act(async () => {
      render(h(Layer, {}), host);
    });
  };
  const isOpen = () => panel().classList.contains("ShowIIROSE_MEDIA_CONTAINER");
  const isWindow = () => panel().classList.contains("imw-panel-window");
  const hostGetsMouseDown = (target: Element) => {
    bodyMouseDown.mockClear();
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    return bodyMouseDown.mock.calls.length > 0;
  };
  // 第一次打开（与初始化合批）不走显示副作用：开 → 关 → 开之后才是稳定态
  const open = async () => {
    await toggle();
    await toggle();
    await toggle();
  };
  const pressEscape = async (target: Element) => {
    await act(async () => {
      target.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
  };

  beforeEach(() => {
    localStorage.clear();
    setWidth(1600);
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
    });
    mainHolder = document.createElement("div");
    mainHolder.id = "mainHolder";
    chat = document.createElement("textarea");
    mainHolder.append(chat);
    document.body.append(mainHolder);
    // 宿站的监听挂在 document 上：body 的拦截是用 stopImmediatePropagation 不让它收到
    document.addEventListener("mousedown", bodyMouseDown);
  });

  afterEach(() => {
    document.removeEventListener("mousedown", bodyMouseDown);
    mainHolder.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("设置关闭：藏聊天区并拦截页面点击，没有标题栏和内联几何", async () => {
    await mount();
    await open();
    expect(isOpen()).toBe(true);
    expect(isWindow()).toBe(false);
    expect(mainHolder.classList.contains("hidemainHolder")).toBe(true);
    expect(hostGetsMouseDown(chat)).toBe(false);
    expect(panel().querySelector("[data-imw-panel-titlebar]")).toBeNull();
    expect(panel().style.left).toBe("");

    await toggle();
    expect(mainHolder.classList.contains("hidemainHolder")).toBe(false);
    expect(hostGetsMouseDown(chat)).toBe(true);
  });

  it("窗口态：聊天区露出，窗口外宿站收得到点击，窗口内收不到", async () => {
    seedDisplay("window");
    await mount();
    await open();
    expect(isWindow()).toBe(true);
    expect(mainHolder.classList.contains("hidemainHolder")).toBe(false);
    expect(hostGetsMouseDown(chat)).toBe(true);
    expect(hostGetsMouseDown(panel())).toBe(false);
    expect(panel().style.width).toBe("1000px");
  });

  it("窗口只有八个抓取区和一个标题栏，关闭钮关窗口但保留挂载", async () => {
    seedDisplay("window");
    await mount();
    await open();
    expect(panel().querySelectorAll("[data-imw-grip]")).toHaveLength(8);
    const mounts = mainAppMounts.count;
    const close = panel().querySelector(
      '[data-imw-panel-titlebar] button[aria-label="关闭窗口"]',
    ) as HTMLButtonElement;
    await act(async () => close.click());
    expect(isOpen()).toBe(false);
    expect(isPanelOpen()).toBe(false);
    expect(mainAppMounts.count).toBe(mounts);
  });

  it("设置开关立即切换，且 MainApp 不重挂载", async () => {
    await mount();
    await open();
    const mounts = mainAppMounts.count;

    await act(async () => {
      PluginSettings.togglePanelDisplay();
    });
    expect(isOpen()).toBe(true);
    expect(isWindow()).toBe(true);
    expect(isPanelWindowed()).toBe(true);
    expect(mainHolder.classList.contains("hidemainHolder")).toBe(false);
    expect(hostGetsMouseDown(chat)).toBe(true);

    await act(async () => {
      PluginSettings.togglePanelDisplay();
    });
    expect(isOpen()).toBe(true);
    expect(isWindow()).toBe(false);
    expect(panel().style.left).toBe("");
    expect(mainHolder.classList.contains("hidemainHolder")).toBe(true);
    expect(hostGetsMouseDown(chat)).toBe(false);
    expect(mainAppMounts.count).toBe(mounts);
  });

  it("视口放不下：自动全屏并藏聊天区，选择和存档不变；恢复后回窗口", async () => {
    const saved = { x: 40, y: 50, width: 900, height: 600 };
    localStorage.setItem(PANEL_WINDOW_RECT_KEY, JSON.stringify(saved));
    seedDisplay("window");
    await mount();
    await open();
    expect(panel().style.left).toBe("40px");

    setWidth(800);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(isWindow()).toBe(false);
    expect(mainHolder.classList.contains("hidemainHolder")).toBe(true);
    expect(hostGetsMouseDown(chat)).toBe(false);
    expect(
      JSON.parse(localStorage.getItem("imwPluginSetting")!).panelDisplay,
    ).toBe("window");
    expect(JSON.parse(localStorage.getItem(PANEL_WINDOW_RECT_KEY)!)).toEqual(
      saved,
    );

    setWidth(1600);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(isWindow()).toBe(true);
    expect(mainHolder.classList.contains("hidemainHolder")).toBe(false);
    expect(panel().style.left).toBe("40px");
  });

  it("焦点在聊天框按 Esc：面板和内层都不响应，也不拦下事件", async () => {
    seedDisplay("window");
    await mount();
    await open();

    const dismiss = vi.fn();
    const release = pushOverlayLayer("inner", dismiss);
    await pressEscape(chat);
    expect(dismiss).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
    release();

    await pressEscape(chat);
    expect(isOpen()).toBe(true);

    // 焦点不在宿站输入框：照常先关层、再关窗口
    const release2 = pushOverlayLayer("inner", dismiss);
    await pressEscape(document.body);
    expect(dismiss).toHaveBeenCalledOnce();
    expect(isOpen()).toBe(true);
    release2();
    await pressEscape(document.body);
    expect(isOpen()).toBe(false);
  });

  it("全屏时 Esc 不看焦点位置（与原版一致）", async () => {
    await mount();
    await open();
    await pressEscape(chat);
    expect(isOpen()).toBe(false);
  });

  it("卸载时撤掉内联几何和 presence", async () => {
    seedDisplay("window");
    await mount();
    await open();
    const container = panel();
    render(null, host);
    expect(container.style.left).toBe("");
    expect(isPanelOpen()).toBe(false);
    expect(isPanelWindowed()).toBe(false);
  });

  describe("最小化", () => {
    const button = (label: string) =>
      document.querySelector(
        `button[aria-label="${label}"]`,
      ) as HTMLButtonElement | null;
    const click = async (label: string) => {
      await act(async () => button(label)!.click());
    };
    const dock = () => document.querySelector("[data-imw-panel-dock]");
    const isMinimized = () => panel().classList.contains("imw-panel-minimized");
    const openAndMinimize = async () => {
      seedDisplay("window");
      await mount();
      await open();
      await click("最小化窗口");
    };

    it("最小化等同关闭：藏窗口、出停靠件，保留挂载、不写盘", async () => {
      const saved = { x: 40, y: 50, width: 900, height: 600 };
      localStorage.setItem(PANEL_WINDOW_RECT_KEY, JSON.stringify(saved));
      seedDisplay("window");
      await mount();
      await open();
      const mounts = mainAppMounts.count;
      const setPanelOpen = vi.fn();
      provideMediaSession({
        bridge: {} as never,
        playback: {} as never,
        pickShuffle: () => {},
        setPanelOpen,
      });
      const before = { ...localStorage };

      await click("最小化窗口");
      expect(isOpen()).toBe(false);
      expect(isPanelOpen()).toBe(false);
      expect(isMinimized()).toBe(true);
      expect(dock()).not.toBeNull();
      expect(setPanelOpen).toHaveBeenLastCalledWith(false);
      expect(mainAppMounts.count).toBe(mounts);
      expect({ ...localStorage }).toEqual(before);
      // 还留着窗口几何：还原时回原位
      expect(panel().style.left).toBe("40px");
    });

    it("点还原：停靠件消失，窗口回原位，飞行变量撤掉", async () => {
      await openAndMinimize();
      expect(panel().style.getPropertyValue("--imw-dock-x")).not.toBe("");
      const { left, width } = panel().style;
      await click("还原点歌台");
      expect(isOpen()).toBe(true);
      expect(isPanelOpen()).toBe(true);
      expect(isMinimized()).toBe(false);
      expect(dock()).toBeNull();
      expect(document.getElementById("imw-panel-dock-root")).toBeNull();
      expect(panel().style.left).toBe(left);
      expect(panel().style.width).toBe(width);
      expect(panel().style.getPropertyValue("--imw-dock-x")).toBe("");
    });

    it("Alt+S 先还原，再按才关闭，且不再出现停靠件", async () => {
      await openAndMinimize();
      await toggle();
      expect(isOpen()).toBe(true);
      expect(dock()).toBeNull();
      await toggle();
      expect(isOpen()).toBe(false);
      expect(dock()).toBeNull();
    });

    it("`@词` 还原并带上搜索词", async () => {
      const ref = createRef<MainAppControlLayer>();
      seedDisplay("window");
      await act(async () => {
        render(h(Layer, { ref } as object), host);
      });
      await open();
      await click("最小化窗口");
      await act(async () => {
        await InputPlatformAnalysis.Analysis(
          "@晴天",
          () => {},
          undefined,
          inputModule.changeSearchKeyword,
          inputModule.showOrHide,
        );
      });
      expect(isOpen()).toBe(true);
      expect(dock()).toBeNull();
      expect(ref.current!.state.searchKeyword).toBe("晴天");
    });

    it("停靠件的关闭钮：回到普通关闭态，Alt+S 正常打开", async () => {
      await openAndMinimize();
      await click("关闭点歌台");
      expect(dock()).toBeNull();
      expect(isOpen()).toBe(false);
      expect(isMinimized()).toBe(false);
      await toggle();
      expect(isOpen()).toBe(true);
      expect(dock()).toBeNull();
    });

    it("标题栏的关闭钮不出现停靠件", async () => {
      seedDisplay("window");
      await mount();
      await open();
      await click("关闭窗口");
      expect(isOpen()).toBe(false);
      expect(dock()).toBeNull();
    });

    it("全屏态没有最小化钮", async () => {
      await mount();
      await open();
      expect(isOpen()).toBe(true);
      expect(button("最小化窗口")).toBeNull();
    });

    it("视口放不下：停靠件保留；还原时按现有规则全屏", async () => {
      await openAndMinimize();
      setWidth(800);
      await act(async () => {
        window.dispatchEvent(new Event("resize"));
      });
      expect(dock()).not.toBeNull();
      expect(isWindow()).toBe(false);
      expect(isMinimized()).toBe(false);
      await click("还原点歌台");
      expect(isOpen()).toBe(true);
      expect(isWindow()).toBe(false);
      expect(mainHolder.classList.contains("hidemainHolder")).toBe(true);
      expect(hostGetsMouseDown(chat)).toBe(false);
    });

    it("聊天全归宿站：点击、Esc、返回键都不被拦，停靠件也不被 Esc 收掉", async () => {
      const hostBackward = vi.fn();
      const hostWindow = window as unknown as Record<string, unknown>;
      hostWindow.Utils = { backward: hostBackward };
      await openAndMinimize();
      expect(hostGetsMouseDown(chat)).toBe(true);
      expect(mainHolder.classList.contains("hidemainHolder")).toBe(false);
      // 停靠件自己的按下不漏给宿站的手势识别
      expect(hostGetsMouseDown(dock()!)).toBe(false);

      const escape = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        chat.dispatchEvent(escape);
      });
      expect(escape.defaultPrevented).toBe(false);
      expect(dock()).not.toBeNull();

      await act(async () => {
        (hostWindow.Utils as { backward: () => unknown }).backward();
      });
      expect(hostBackward).toHaveBeenCalledOnce();
      expect(dock()).not.toBeNull();
    });

    it("开着的菜单随最小化收起，返回键不会先落到它身上", async () => {
      seedDisplay("window");
      await mount();
      await open();
      const dismiss = vi.fn();
      const release = pushOverlayLayer("source", dismiss);
      await click("最小化窗口");
      expect(dismiss).toHaveBeenCalledOnce();
      release();
    });

    it("卸载时带走停靠件", async () => {
      await openAndMinimize();
      render(null, host);
      expect(document.getElementById("imw-panel-dock-root")).toBeNull();
    });

    it("刷新后是普通关闭态（新实例不恢复最小化）", async () => {
      await openAndMinimize();
      render(null, host);
      await mount();
      expect(isOpen()).toBe(false);
      expect(isMinimized()).toBe(false);
      expect(dock()).toBeNull();
    });
  });
});
