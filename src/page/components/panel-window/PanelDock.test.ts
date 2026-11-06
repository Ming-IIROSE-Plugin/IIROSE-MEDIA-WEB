import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import {
  mountPanelDock,
  PANEL_DOCK_POSITION_KEY,
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
const onOpen = vi.fn();
const onPlaced = vi.fn();
const mount = () => mountPanelDock({ onOpen, onPlaced });
const WINDOW_RECT = { x: 100, y: 100, width: 1000, height: 600 };

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
  localStorage.removeItem(PANEL_DOCK_POSITION_KEY);
  document.getElementById("moveinputDisplay")?.remove();
  delete (window as Window & { theme?: unknown }).theme;
  vi.useRealTimers();
});

describe("停靠件定位", () => {
  it("贴在输入框左上方", () => {
    addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    mount();
    expect(position()).toEqual({ x: 312, y: 794 });
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
    expect(position()).toEqual({ x: 112, y: 494 });
  });

  it("聊天区顶动输入框没有事件：低频轮询跟上，输入框后出现也跟上；卸载后停", () => {
    vi.useFakeTimers();
    const unmount = mount();
    expect(position()).toEqual({ x: 800, y: 888 });
    addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    vi.advanceTimersByTime(600);
    expect(position()).toEqual({ x: 312, y: 794 });
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

  it("点胶囊打开；只有一个按钮，没有关闭钮和歌名", async () => {
    mount();
    expect(dock().textContent).toBe("点歌台");
    const buttons = dock().querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    await act(async () => buttons[0].click());
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("摆好和拖完都通知窗口更新缩放终点", () => {
    mount();
    expect(onPlaced).toHaveBeenCalled();
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
  it("窗口展开时的中心到胶囊中心", () => {
    addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    const panel = document.createElement("div");
    Object.defineProperty(panel, "offsetWidth", { value: 1000 });
    writeDockFlight(panel, WINDOW_RECT);
    // 胶囊标称 82×38：x 312..394、y 756..794
    expect(panel.style.getPropertyValue("--imw-dock-x")).toBe("-247px");
    expect(panel.style.getPropertyValue("--imw-dock-y")).toBe("375px");
  });
});

describe("拖动", () => {
  const input = { left: 300, top: 800, right: 1400, bottom: 850 };
  const pointer = (type: string, target: Element, x: number, y: number) => {
    const event = new MouseEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      button: 0,
    });
    Object.assign(event, { isPrimary: true, pointerId: 1 });
    target.dispatchEvent(event);
  };
  const restore = () =>
    dock().querySelector('[aria-label="打开点歌台"]') as HTMLElement;
  const stored = () =>
    JSON.parse(localStorage.getItem(PANEL_DOCK_POSITION_KEY) ?? "null");
  /** 从胶囊上按下、移动、松手，再触发浏览器随后的点击。 */
  const dragBy = (dx: number, dy: number) => {
    pointer("pointerdown", restore(), 400, 700);
    pointer("pointermove", restore(), 400 + dx, 700 + dy);
    pointer("pointerup", restore(), 400 + dx, 700 + dy);
    restore().click();
  };

  it("拖动跟手、松手写盘，随后的点击不打开", () => {
    addInput(input);
    mount();
    dragBy(100, -200);
    expect(position()).toEqual({ x: 412, y: 594 });
    expect(stored()).toEqual({ x: 412, y: 594 });
    expect(onOpen).not.toHaveBeenCalled();
    expect(onPlaced).toHaveBeenCalledTimes(2);
  });

  it("往下拖进不了输入框", () => {
    addInput(input);
    mount();
    dragBy(0, 500);
    expect(position().y).toBe(794);
    expect(stored().y).toBe(794);
  });

  it("移动不到 4px 算点击：打开，不写盘", () => {
    addInput(input);
    mount();
    dragBy(2, 1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(stored()).toBeNull();
  });

  it("重新挂载（含刷新后）回到存档位置；存档也是窗口的缩放终点", () => {
    addInput(input);
    localStorage.setItem(
      PANEL_DOCK_POSITION_KEY,
      JSON.stringify({ x: 500, y: 300 }),
    );
    mount();
    expect(position()).toEqual({ x: 500, y: 300 });
    const panel = document.createElement("div");
    Object.defineProperty(panel, "offsetWidth", { value: 1000 });
    writeDockFlight(panel, WINDOW_RECT);
    // 胶囊标称 82×38：中心 (541, 319)，窗口中心 (600, 400)
    expect(panel.style.getPropertyValue("--imw-dock-x")).toBe("-59px");
    expect(panel.style.getPropertyValue("--imw-dock-y")).toBe("-81px");
  });

  it("输入框升高只改显示，存档不动；降回去恢复", () => {
    vi.useFakeTimers();
    const box = addInput(input);
    localStorage.setItem(
      PANEL_DOCK_POSITION_KEY,
      JSON.stringify({ x: 500, y: 700 }),
    );
    mount();
    box.getBoundingClientRect = () =>
      ({ left: 300, top: 600, right: 1400, bottom: 650 }) as DOMRect;
    vi.advanceTimersByTime(600);
    expect(position().y).toBe(594);
    expect(stored()).toEqual({ x: 500, y: 700 });
    box.getBoundingClientRect = () => input as DOMRect;
    vi.advanceTimersByTime(600);
    expect(position().y).toBe(700);
  });
});

describe("样式表", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app.css"), "utf8");

  it("减少动态效果时开合没有位移和缩放，也没有过渡", () => {
    const reduced = css.slice(
      css.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reduced).toMatch(
      /imw-panel-window\.ShowIIROSE_MEDIA_CONTAINER \{\s*translate: none;\s*scale: none;\s*transition: none/,
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
