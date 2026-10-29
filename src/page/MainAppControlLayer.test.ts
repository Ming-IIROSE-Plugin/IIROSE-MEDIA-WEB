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
  delete (window as ThemeWindow).theme;
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
