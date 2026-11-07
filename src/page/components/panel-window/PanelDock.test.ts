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

/** 把媒体查询打桩：`matches` 决定哪些查询算命中。 */
const stubMedia = (matches: (query: string) => boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: matches(query) }));

describe("胶囊尺寸", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("桌面 38px 高；手机和粗指针上 54px 高，内容也跟着放大", () => {
    mount();
    expect(dock().style.height).toBe("38px");
    expect(dock().style.width).toBe("87px");
    releasePanelDock();
    stubMedia((query) => query.includes("max-width: 768px"));
    mount();
    expect(dock().style.height).toBe("54px");
    expect(dock().style.width).toBe("110px");
    const button = dock().querySelector("button")!;
    expect(button.style.gap).toBe("8px");
    expect(button.style.fontSize).toBe("15px");
    expect(button.querySelector("svg")!.style.width).toBe("20px");
    // 尺寸只写在 TS 里：工具类带 !important，留着会压过内联样式
    expect(button.className).not.toMatch(
      /(^|[\s:])(h-\d|px-\d|gap-\d|size-\d|text-\[|rounded-)/,
    );
  });
});

describe("停靠件定位", () => {
  it("贴在输入框左上方", () => {
    addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    mount();
    expect(position()).toEqual({ x: 312, y: 794 });
  });

  it("宿站侧栏平移 body：位置不变，层自己裁切藏着的部分", () => {
    // body 和里面的输入框一起被推了 275
    addInput({ left: 575, top: 800, right: 1675, bottom: 850 });
    const rect = vi
      .spyOn(document.body, "getBoundingClientRect")
      .mockReturnValue({ left: 275, top: 0 } as DOMRect);
    mount();
    expect(position()).toEqual({ x: 312, y: 794 });
    expect(dock().parentElement!.className).toContain("overflow-hidden");
    rect.mockRestore();
  });

  it("没有输入框 / 尺寸为 0：底部居中留 12px", () => {
    mount();
    expect(position()).toEqual({ x: 756.5, y: 888 });
    releasePanelDock();
    addInput({ left: 0, top: 0, right: 0, bottom: 0 });
    mount();
    expect(position()).toEqual({ x: 756.5, y: 888 });
  });

  it("`visibility: hidden` 的输入框算缺失", () => {
    const input = addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    input.style.visibility = "hidden";
    mount();
    expect(position()).toEqual({ x: 756.5, y: 888 });
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
    expect(position()).toEqual({ x: 756.5, y: 888 });
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
    const layer = () => dock().closest("[data-imw-theme]");
    expect(layer()?.getAttribute("data-imw-theme")).toBe("light");
    page.theme = 0;
    vi.advanceTimersByTime(600);
    expect(layer()?.getAttribute("data-imw-theme")).toBe("dark");
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

  it("只有胶囊接收点击：外层铺满但不拦指针", () => {
    mount();
    const root = document.getElementById(PANEL_DOCK_ROOT_ID)!;
    expect(root.parentElement).toBe(document.body);
    const layer = root.firstElementChild!;
    expect(layer.className).toContain("pointer-events-none");
    expect(dock().className).toContain("pointer-events-auto");
    expect(layer.querySelector("svg")!.parentElement).toBe(layer);
    expect(dock().parentElement).toBe(layer);
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
    expect(dock().parentElement!.classList.contains("z-[90009]")).toBe(true);
  });
});

describe("飞行变量", () => {
  it("全屏：视口中心到胶囊中心", () => {
    addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    const panel = document.createElement("div");
    Object.defineProperty(panel, "offsetWidth", { value: 1600 });
    writeDockFlight(panel, null);
    // 胶囊标称 87×38：中心 (355.5, 775)，视口中心 (800, 450)
    expect(panel.style.getPropertyValue("--imw-dock-x")).toBe("-444.5px");
    expect(panel.style.getPropertyValue("--imw-dock-y")).toBe("325px");
  });

  it("窗口展开时的中心到胶囊中心", () => {
    addInput({ left: 300, top: 800, right: 1400, bottom: 850 });
    const panel = document.createElement("div");
    Object.defineProperty(panel, "offsetWidth", { value: 1000 });
    writeDockFlight(panel, WINDOW_RECT);
    // 胶囊标称 87×38：x 312..399、y 756..794
    expect(panel.style.getPropertyValue("--imw-dock-x")).toBe("-244.5px");
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

  it("存储写不进去：拖完的位置不会被下一次跟随覆盖回默认位置", () => {
    addInput(input);
    mount();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    try {
      dragBy(100, -200);
      expect(position()).toEqual({ x: 412, y: 594 });
      window.dispatchEvent(new Event("resize"));
      expect(position()).toEqual({ x: 412, y: 594 });
    } finally {
      setItem.mockRestore();
    }
  });

  it("拖拽被取消、没有随后的点击：之后的键盘激活仍能打开", () => {
    vi.useFakeTimers();
    addInput(input);
    mount();
    pointer("pointerdown", restore(), 400, 700);
    pointer("pointermove", restore(), 500, 600);
    pointer("pointercancel", restore(), 500, 600);
    vi.advanceTimersByTime(150);
    restore().click();
    expect(onOpen).toHaveBeenCalledTimes(1);
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

  const edge = () => dock().getAttribute("data-imw-dock-edge");

  it("拖到边缘：吸附、收起并连同边一起存档；刷新后还是收起", () => {
    addInput(input);
    mount();
    dragBy(1300, -100);
    expect(position()).toEqual({ x: 1513, y: 694 });
    expect(edge()).toBe("right");
    expect(stored()).toEqual({ x: 1513, y: 694, edge: "right" });
    releasePanelDock();
    mount();
    expect(edge()).toBe("right");
    expect(position()).toEqual({ x: 1513, y: 694 });
  });

  it("拖到上边和输入框上方：吸附、存档；靠右时也给展开留足宽度", () => {
    addInput(input);
    mount();
    dragBy(800, -780);
    expect(edge()).toBe("top");
    expect(position()).toEqual({ x: 1112, y: 0 });
    expect(stored()).toEqual({ x: 1112, y: 0, edge: "top" });
    dragBy(1000, 0);
    expect(edge()).toBe("right");
    localStorage.setItem(
      PANEL_DOCK_POSITION_KEY,
      JSON.stringify({ x: 1590, y: 0, edge: "top" }),
    );
    releasePanelDock();
    mount();
    // 展开宽 87：不能贴到 1600 上
    expect(position().x).toBe(1513);
    dragBy(-800, 790);
    expect(edge()).toBe("bottom");
    expect(position().y).toBe(794);
  });

  const shape = () =>
    document.querySelector("[data-imw-dock-shape]")!.getAttribute("d")!;
  const tips = () =>
    document.querySelector("[data-imw-dock-tips]")!.getAttribute("d")!;
  /** 路径里出现过的所有 x（点按 x y 成对）。 */
  const xs = (path: string) =>
    (path.match(/-?\d+(\.\d+)?/g) ?? [])
      .map(Number)
      .filter((_, i) => i % 2 === 0);
  /** 胶囊内容在屏幕上的矩形：left / top 是展开时的位置，再加上画师写的 translate。 */
  const box = () => {
    const [dx, dy] = (dock().style.translate || "0px 0px")
      .split(" ")
      .map(parseFloat);
    return {
      x: position().x + dx,
      y: position().y + dy,
      width: parseFloat(dock().style.width),
    };
  };

  describe("液体粘连", () => {
    const seedEdge = (edge: string, x = 0, y = 500) =>
      localStorage.setItem(
        PANEL_DOCK_POSITION_KEY,
        JSON.stringify({ x, y, edge }),
      );

    describe("展开和收起", () => {
      const hover = (type: string) =>
        dock().dispatchEvent(new MouseEvent(type, { bubbles: false }));
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.unstubAllGlobals());

      it("悬停：轮廓和内容逐帧一起展开，中心不动；移开收回", () => {
        stubMedia((query) => query === "(hover: hover)");
        addInput(input);
        seedEdge("top", 500, 0);
        mount();
        expect(box().width).toBe(38);
        const center = box().x + 19;
        hover("pointerenter");
        for (let frame = 0; frame < 30; frame++) {
          vi.advanceTimersByTime(16);
          const width = box().width;
          // 内容的宽度和轮廓的宽度是同一个数，所以每一帧都对得上
          const path = xs(shape());
          expect(Math.max(...path) - Math.min(...path)).toBeCloseTo(
            width + 16,
            0,
          );
          expect(box().x + width / 2).toBeCloseTo(center, 1);
        }
        expect(box().width).toBe(87);
        hover("pointerleave");
        vi.advanceTimersByTime(500);
        expect(box().width).toBe(38);
      });

      it("触屏没有悬停：只有按住才展开，松手收回", () => {
        stubMedia(() => false);
        addInput(input);
        seedEdge("right", 0, 500);
        mount();
        expect(box().width).toBe(34);
        hover("pointerenter");
        vi.advanceTimersByTime(500);
        expect(box().width).toBe(34);
        pointer("pointerdown", restore(), 1590, 500);
        vi.advanceTimersByTime(500);
        expect(box().width).toBe(87);
        pointer("pointerup", restore(), 1590, 500);
        vi.advanceTimersByTime(500);
        expect(box().width).toBe(34);
      });

      it("键盘聚焦展开；鼠标点击留下的焦点不展开", () => {
        addInput(input);
        seedEdge("right", 0, 500);
        mount();
        const button = dock().querySelector("button")!;
        const focus = (visible: boolean) => {
          button.matches = () => visible;
          button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
          vi.advanceTimersByTime(500);
        };
        focus(false);
        expect(box().width).toBe(34);
        focus(true);
        expect(box().width).toBe(87);
        button.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
        vi.advanceTimersByTime(500);
        expect(box().width).toBe(34);
      });

      it("减少动态效果：直接到位，不留动画", () => {
        stubMedia((query) => !query.includes("max-width"));
        addInput(input);
        seedEdge("top", 500, 0);
        mount();
        expect(vi.getTimerCount()).toBe(1);
        hover("pointerenter");
        expect(box().width).toBe(87);
        expect(vi.getTimerCount()).toBe(1);
      });

      it("减少动态效果：拖离和拖近边缘都不画拉丝", () => {
        stubMedia((query) => !query.includes("max-width"));
        addInput(input);
        seedEdge("left");
        mount();
        pointer("pointerdown", restore(), 10, 500);
        pointer("pointermove", restore(), 20, 500);
        // 一动就离开这条边，胶囊还是完整的胶囊
        expect(edge()).toBeNull();
        expect(Math.min(...xs(shape()))).toBe(position().x);
        expect(tips()).toBe("");
        pointer("pointerup", restore(), 20, 500);
      });

      it("卸载时停掉动画", () => {
        stubMedia((query) => query === "(hover: hover)");
        addInput(input);
        seedEdge("top", 500, 0);
        const unmount = mount();
        hover("pointerenter");
        unmount();
        expect(vi.getTimerCount()).toBe(0);
      });
    });

    it("贴边静止：同一条轮廓连着边缘，胶囊本身不带底色；贴下边没有耳朵", () => {
      addInput(input);
      seedEdge("left");
      mount();
      expect(Math.min(...xs(shape()))).toBe(0);
      expect(shape().match(/M/g)).toHaveLength(1);
      expect(dock().className).not.toMatch(/\bbg-/);
      releasePanelDock();
      seedEdge("bottom", 500, 300);
      mount();
      expect(Math.min(...xs(shape()))).toBeGreaterThan(500);
    });

    it("没拉到阈值：胶囊中心跟手、内容不变形，还算贴在这条边上", () => {
      addInput(input);
      seedEdge("left");
      mount();
      pointer("pointerdown", restore(), 10, 500);
      expect(dock().hasAttribute("data-imw-dock-held")).toBe(true);
      pointer("pointermove", restore(), 40, 500);
      expect(edge()).toBe("left");
      // 胶囊 1:1 跟手，粘只表现在形状上
      expect(position().x).toBe(30);
      expect(box().x + box().width / 2).toBeCloseTo(30 + 87 / 2, 5);
      expect(box().width).toBeGreaterThan(87);
      expect(dock().style.scale).toBeFalsy();
      // 丝从边缘连到胶囊
      expect(Math.min(...xs(shape()))).toBe(0);
    });

    it("没拉到阈值就松手：弹回边缘，存档的边不变，也不算点击", () => {
      vi.useFakeTimers();
      addInput(input);
      seedEdge("left");
      mount();
      pointer("pointerdown", restore(), 10, 500);
      pointer("pointermove", restore(), 40, 460);
      pointer("pointerup", restore(), 40, 460);
      restore().click();
      expect(position()).toEqual({ x: 0, y: 460 });
      expect(edge()).toBe("left");
      expect(stored()).toEqual({ x: 0, y: 460, edge: "left" });
      expect(dock().hasAttribute("data-imw-dock-held")).toBe(false);
      expect(onOpen).not.toHaveBeenCalled();
      // 存档马上到位，看到的胶囊从松手的地方走回去，丝也一起收回
      expect(box().x).toBeGreaterThan(20);
      vi.advanceTimersByTime(600);
      expect(box()).toMatchObject({ x: 0, y: 460, width: 34 });
    });

    it("拉过阈值：断开，不再贴边；尖头缩完只剩胶囊", () => {
      vi.useFakeTimers();
      addInput(input);
      seedEdge("left");
      mount();
      pointer("pointerdown", restore(), 10, 500);
      pointer("pointermove", restore(), 40, 500);
      pointer("pointermove", restore(), 100, 500);
      expect(edge()).toBeNull();
      expect(position().x).toBe(90);
      // 手指还在拖：胶囊就在指针下，没有位置动画
      expect(box()).toMatchObject({ x: 90, width: 87 });
      expect(shape().match(/M/g)).toHaveLength(1);
      expect(tips().match(/M/g)).toHaveLength(2);
      vi.advanceTimersByTime(400);
      expect(tips()).toBe("");
      expect(box()).toMatchObject({ x: 90, width: 87 });
      pointer("pointerup", restore(), 100, 500);
      expect(position()).toEqual({ x: 90, y: 500 });
      expect(stored()).toEqual({ x: 90, y: 500 });
    });

    it("自由拖近边缘：边缘提前伸出来；拖远又收回去", () => {
      addInput(input);
      localStorage.setItem(
        PANEL_DOCK_POSITION_KEY,
        JSON.stringify({ x: 400, y: 400 }),
      );
      mount();
      expect(Math.min(...xs(shape()))).toBe(400);
      pointer("pointerdown", restore(), 400, 400);
      pointer("pointermove", restore(), 10, 400);
      expect(Math.min(...xs(shape()))).toBe(0);
      expect(position().x).toBe(10);
      pointer("pointermove", restore(), 300, 400);
      expect(Math.min(...xs(shape()))).toBe(300);
      pointer("pointerup", restore(), 300, 400);
    });
  });

  it("拖离边缘：拖动中就伸出，松手不再收起", () => {
    addInput(input);
    localStorage.setItem(
      PANEL_DOCK_POSITION_KEY,
      JSON.stringify({ x: 0, y: 500, edge: "left" }),
    );
    mount();
    expect(edge()).toBe("left");
    expect(position().x).toBe(0);
    pointer("pointerdown", restore(), 10, 500);
    pointer("pointermove", restore(), 400, 500);
    expect(edge()).toBeNull();
    pointer("pointerup", restore(), 400, 500);
    expect(edge()).toBeNull();
    expect(stored()).toEqual({ x: 390, y: 500 });
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
    // 胶囊标称 87×38：中心 (543.5, 319)，窗口中心 (600, 400)
    expect(panel.style.getPropertyValue("--imw-dock-x")).toBe("-56.5px");
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
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.IIROSE_MEDIA_CONTAINER,\s*\.IIROSE_MEDIA_CONTAINER\.ShowIIROSE_MEDIA_CONTAINER \{\s*translate: none;\s*scale: none;\s*transition: none/,
    );
  });

  it("胶囊的形状和收起都不归 CSS 管", () => {
    expect(css).not.toContain("data-imw-panel-dock");
    expect(css).not.toContain("data-imw-dock-edge");
    expect(css).not.toContain("data-imw-dock-label");
  });

  it("独立根进了边框基线和盒模型两条选择器", () => {
    expect(css).toMatch(/#imw-panel-dock-root \* \{\s*border: 0 solid/);
    expect(css).toMatch(/#imw-panel-dock-root \*::after \{\s*box-sizing/);
  });

  it("打开停稳没有 transform；收起不用滑动，也不再推走聊天区", () => {
    const openRule = css.match(
      /\.IIROSE_MEDIA_CONTAINER\.ShowIIROSE_MEDIA_CONTAINER \{[^}]*\}/,
    )![0];
    expect(openRule).toMatch(/translate: none/);
    expect(openRule).toMatch(/scale: none/);
    expect(openRule).not.toMatch(/\btransform:/);
    expect(css).not.toContain("translateX(100%)");
    expect(css).not.toContain("hidemainHolder");
  });
});
