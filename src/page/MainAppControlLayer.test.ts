import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef, h, render, type ComponentType } from "preact";
import { act } from "preact/test-utils";

// 只验证主题属性写入：主面板内容与宿站联动模块替换为空壳。
vi.mock("./MainApp", () => ({ MainApp: () => null }));
vi.mock("../input-behavior-module/Input-Behavior-Module", () => ({
  Input_Behavior_Module: { init: () => {} },
}));
vi.mock("../iirose_func/CloseSideBar", () => ({ closeSidebar: () => {} }));
vi.mock("../sync/SyncManager", () => ({
  SyncManager: { onUiOpened: () => {}, onUiClosed: () => {} },
}));

import { MainAppControlLayer } from "./MainAppControlLayer";
import {
  pushOverlayLayer,
  setPanelBackHandler,
} from "./components/desk/overlayLayers";

// 构造函数签名写的是 props: undefined，这里只按无 props 组件挂载。
const Layer = MainAppControlLayer as unknown as ComponentType<object>;

type ThemeWindow = Window & { theme?: unknown };
type HostWindow = Window & {
  Utils?: { backward?: (...args: unknown[]) => unknown };
};
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
    const release = pushOverlayLayer("sheet", dismiss);
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
    await toggle();

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
