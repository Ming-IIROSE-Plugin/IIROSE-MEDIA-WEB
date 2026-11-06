import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import {
  clearDockFlight,
  mountPanelDock,
  PANEL_DOCK_ROOT_ID,
  releasePanelDock,
  writeDockFlight,
} from "./PanelDock";

// jsdom 没有布局：胶囊尺寸是 0×0，输入框矩形按需打桩。视口 1600×900。
const dock = () =>
  document.querySelector("[data-imw-panel-dock]") as HTMLElement;
const position = () => ({
  x: parseFloat(dock().style.left),
  y: parseFloat(dock().style.top),
});
const addInput = (rect: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}) => {
  const input = document.createElement("div");
  input.id = "moveinputDisplay";
  input.getBoundingClientRect = () => rect as DOMRect;
  document.body.append(input);
  return input;
};
const onRestore = vi.fn();
const onClose = vi.fn();
const mount = () => mountPanelDock({ onRestore, onClose });

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1600,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 900,
  });
});

afterEach(() => {
  releasePanelDock();
  document.getElementById("moveinputDisplay")?.remove();
  delete (window as Window & { theme?: unknown }).theme;
  vi.useRealTimers();
});

describe("停靠件定位", () => {
  it("贴在输入框右上方", () => {
    addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    mount();
    expect(position()).toEqual({ x: 1400, y: 794 });
  });

  it("没有输入框 / 尺寸为 0：底部居中留 12px", () => {
    mount();
    expect(position()).toEqual({ x: 800, y: 888 });
    releasePanelDock();
    addInput({ left: 0, top: 0, right: 0, bottom: 0 });
    mount();
    expect(position()).toEqual({ x: 800, y: 888 });
  });

  it("`visibility: hidden` 的输入框算缺失", () => {
    const input = addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    input.style.visibility = "hidden";
    mount();
    expect(position()).toEqual({ x: 800, y: 888 });
  });

  it("视口变化时跟随输入框", () => {
    const input = addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    mount();
    input.getBoundingClientRect = () =>
      ({ left: 100, top: 500, right: 900, bottom: 550 }) as DOMRect;
    window.dispatchEvent(new Event("resize"));
    expect(position()).toEqual({ x: 900, y: 494 });
  });

  it("聊天区顶动输入框没有事件：低频轮询跟上，输入框后出现也跟上；卸载后停", () => {
    vi.useFakeTimers();
    const unmount = mount();
    expect(position()).toEqual({ x: 800, y: 888 });
    addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    vi.advanceTimersByTime(600);
    expect(position()).toEqual({ x: 1400, y: 794 });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(document.getElementById(PANEL_DOCK_ROOT_ID)).toBeNull();
  });
});

describe("停靠件外观与交互", () => {
  it("配色跟随宿站主题，最小化期间宿站切换也跟上", () => {
    vi.useFakeTimers();
    const page = window as Window & { theme?: unknown };
    page.theme = 1;
    mount();
    expect(dock().getAttribute("data-imw-theme")).toBe("light");
    page.theme = 0;
    vi.advanceTimersByTime(600);
    expect(dock().getAttribute("data-imw-theme")).toBe("dark");
  });

  it("点胶囊还原，旁边的钮关闭；不显示歌名", async () => {
    mount();
    expect(dock().textContent).toBe("点歌台");
    const [restore, close] = dock().querySelectorAll("button");
    await act(async () => restore.click());
    expect(onRestore).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => close.click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("独立根只有胶囊一个孩子，没有铺满的遮罩", () => {
    mount();
    const root = document.getElementById(PANEL_DOCK_ROOT_ID)!;
    expect(root.parentElement).toBe(document.body);
    expect(root.children).toHaveLength(1);
    expect(root.firstElementChild).toBe(dock());
    expect(dock().className).not.toMatch(/inset-/);
  });

  it("重复挂载只留一个，被替换的停靠件停掉定时器", () => {
    vi.useFakeTimers();
    mount();
    expect(vi.getTimerCount()).toBe(1);
    mount();
    expect(document.querySelectorAll(`#${PANEL_DOCK_ROOT_ID}`)).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("压在批量进度（90008）之上、选集面板（90010）之下", () => {
    mount();
    expect(dock().classList.contains("z-[90009]")).toBe(true);
  });
});

describe("飞行变量", () => {
  it("窗口中心到胶囊中心，收起前写好、撤掉后不留", () => {
    addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    const panel = document.createElement("div");
    panel.getBoundingClientRect = () =>
      ({ left: 100, top: 100, width: 1000, height: 600 }) as DOMRect;
    Object.defineProperty(panel, "offsetWidth", { value: 1000 });
    writeDockFlight(panel);
    // 胶囊标称 114×38：x 1286..1400、y 756..794
    expect(panel.style.getPropertyValue("--imw-dock-x")).toBe("743px");
    expect(panel.style.getPropertyValue("--imw-dock-y")).toBe("375px");
    clearDockFlight(panel);
    expect(panel.style.getPropertyValue("--imw-dock-x")).toBe("");
  });
});

describe("样式表", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app.css"), "utf8");

  it("减少动态效果时最小化没有位移和缩放，也没有过渡", () => {
    const reduced = css.slice(
      css.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reduced).toMatch(
      /\.imw-panel-minimized \{\s*translate: none;\s*scale: none;/,
    );
    expect(reduced).toMatch(/transition: none/);
  });

  it("独立根进了边框基线和盒模型两条选择器", () => {
    expect(css).toMatch(/#imw-panel-dock-root \* \{\s*border: 0 solid/);
    expect(css).toMatch(/#imw-panel-dock-root \*::after \{\s*box-sizing/);
  });

  it("打开态的 transform 与 scale / translate 分属两条规则（lightningcss 否则合并）", () => {
    const openRule = css.match(
      /\.IIROSE_MEDIA_CONTAINER\.imw-panel-window\.ShowIIROSE_MEDIA_CONTAINER \{[^}]*\}/,
    )![0];
    expect(openRule).toContain("transform: none");
    expect(openRule).not.toMatch(/\b(scale|translate): none/);
    expect(css).toMatch(
      /\n\.imw-panel-window\.ShowIIROSE_MEDIA_CONTAINER \{\s*scale: none;\s*translate: none;/,
    );
  });
});
