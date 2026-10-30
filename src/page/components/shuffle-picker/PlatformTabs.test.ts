import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { PlatformTabs, type PlatformTabItem } from "./PlatformTabs";

const ITEMS: PlatformTabItem[] = [
  { id: "a", label: "甲" },
  { id: "b", label: "乙" },
  { id: "c", label: "丙" },
  { id: "d", label: "丁" },
  { id: "e", label: "戊" },
  { id: "f", label: "己" },
];

let host: HTMLDivElement;
let selected: string;
let disabled: boolean;
let onSelect: (id: string) => void;
let scrollIntoView: ReturnType<typeof vi.fn>;
const saved: Array<[object, string, PropertyDescriptor | undefined]> = [];

/** 伪布局：每个标签宽 100、依次排开，标签行可视宽 200。 */
function stub(
  target: object,
  name: string,
  get: (this: HTMLElement) => number,
) {
  saved.push([target, name, Object.getOwnPropertyDescriptor(target, name)]);
  Object.defineProperty(target, name, { configurable: true, get });
}
const indexOf = (node: HTMLElement) =>
  node.parentElement
    ? Array.from(node.parentElement.children).indexOf(node)
    : 0;

function mount(count: number, initial = "a") {
  const items = ITEMS.slice(0, count);
  selected = initial;
  const draw = () =>
    render(
      h(PlatformTabs, {
        items,
        selected,
        disabled,
        tabId: (id: string) => `tab-${id}`,
        controls: "panel",
        ariaLabel: "平台",
        onSelect: (id: string) => {
          onSelect(id);
          selected = id;
          draw();
        },
      }),
      host,
    );
  act(() => draw());
}

const tablist = () => host.querySelector('[role="tablist"]');
const tabs = () =>
  Array.from(host.querySelectorAll<HTMLElement>('[role="tab"]'));
const current = () =>
  host.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
const segment = (index: number) =>
  tabs()[index].querySelector("span")!.className.split(/\s+/);

async function key(element: Element, value: string) {
  await act(async () => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  disabled = false;
  onSelect = vi.fn();
  scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollIntoView =
    scrollIntoView as unknown as HTMLElement["scrollIntoView"];
  stub(HTMLElement.prototype, "offsetLeft", function () {
    return indexOf(this) * 100;
  });
  stub(HTMLElement.prototype, "offsetWidth", () => 100);
  stub(Element.prototype, "clientWidth", function () {
    return this.getAttribute("role") === "tablist" ? 200 : 0;
  });
  stub(Element.prototype, "scrollWidth", function () {
    return this.getAttribute("role") === "tablist"
      ? this.children.length * 100
      : 0;
  });
});

afterEach(() => {
  act(() => render(null, host));
  host.remove();
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  for (const [target, name, descriptor] of saved.reverse()) {
    if (descriptor) Object.defineProperty(target, name, descriptor);
    else delete (target as Record<string, unknown>)[name];
  }
  saved.length = 0;
  vi.unstubAllGlobals();
});

describe("PlatformTabs", () => {
  it("只有一项（或没有）：不渲染标签行", () => {
    mount(1);
    expect(tablist()).toBeNull();
    expect(host.innerHTML).toBe("");
    mount(0);
    expect(host.innerHTML).toBe("");
  });

  it("两项：等宽分段，首尾圆角", () => {
    mount(2);
    expect(tablist()!.getAttribute("data-layout")).toBe("segmented");
    expect(tabs().every((tab) => tab.className.includes("flex-1"))).toBe(true);
    expect(segment(0)).toContain("rounded-l-lg");
    expect(segment(0)).not.toContain("rounded-r-lg");
    expect(segment(1)).toContain("rounded-r-lg");
    expect(segment(1)).not.toContain("rounded-l-lg");
  });

  it("三项：等宽分段，首尾圆角、中间无圆角", () => {
    mount(3);
    expect(tablist()!.getAttribute("data-layout")).toBe("segmented");
    expect(segment(0)).toContain("rounded-l-lg");
    const middle = segment(1);
    expect(middle).not.toContain("rounded-l-lg");
    expect(middle).not.toContain("rounded-r-lg");
    expect(middle).toContain("border-l-0");
    expect(segment(2)).toContain("rounded-r-lg");
  });

  it.each([4, 5, 6])(
    "%i 项：横向滑动胶囊，触控高 ≥44px，不出纵向滚动",
    (count) => {
      mount(count);
      const list = tablist()!;
      expect(list.getAttribute("data-layout")).toBe("pills");
      const classes = list.className.split(/\s+/);
      expect(classes).toContain("overflow-x-auto");
      expect(classes).toContain("overflow-y-hidden");
      expect(tabs()).toHaveLength(count);
      for (const tab of tabs()) {
        expect(tab.className).toContain("min-h-[44px]");
        expect(tab.className).toContain("shrink-0");
        expect(tab.className).not.toContain("flex-1");
        expect(tab.querySelector("span")!.className).toContain("rounded-full");
      }
    },
  );

  it("胶囊：切换后选中项滚入可见区，只改标签行的 scrollLeft", async () => {
    mount(6);
    const list = tablist() as HTMLDivElement;
    expect(list.scrollLeft).toBe(0);
    await act(async () => tabs()[4].click());
    expect(current()).toBe("戊");
    expect(list.scrollLeft).toBe(300);
    await act(async () => tabs()[3].click());
    expect(list.scrollLeft).toBe(300);
    await act(async () => tabs()[0].click());
    expect(list.scrollLeft).toBe(0);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("胶囊：初始选中项不在可视区时滚到它", () => {
    mount(6, "f");
    expect((tablist() as HTMLDivElement).scrollLeft).toBe(400);
  });

  it("胶囊：尺寸变化后重新判断渐隐；卸载时断开观察", async () => {
    let notify!: () => void;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    mount(5);
    const list = tablist() as HTMLDivElement;
    expect(list.className).toContain("mask-image");
    Object.defineProperty(list, "clientWidth", { value: 600 });
    await act(async () => notify());
    expect(list.className).not.toContain("mask-image");
    act(() => render(null, host));
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("胶囊：右侧还有被遮住的标签时渐隐提示，滑到底后取消", async () => {
    mount(5);
    const list = tablist() as HTMLDivElement;
    await act(async () => {
      list.dispatchEvent(new Event("scroll"));
    });
    expect(list.className).toContain("mask-image");
    list.scrollLeft = 300;
    await act(async () => {
      list.dispatchEvent(new Event("scroll"));
    });
    expect(list.className).not.toContain("mask-image");
  });

  it("分段：不动 scrollLeft、无渐隐", async () => {
    mount(3, "c");
    const list = tablist() as HTMLDivElement;
    expect(list.scrollLeft).toBe(0);
    expect(list.className).not.toContain("mask-image");
  });

  it("selected 不在 items 里：第一项仍可聚焦，无选中项", () => {
    mount(3, "zz");
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    expect(current()).toBeUndefined();
  });

  it("tablist 语义：aria-orientation、选中项可聚焦、aria-controls", () => {
    mount(4, "c");
    const list = tablist()!;
    expect(list.getAttribute("aria-orientation")).toBe("horizontal");
    expect(list.getAttribute("aria-label")).toBe("平台");
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([-1, -1, 0, -1]);
    expect(tabs()[2].id).toBe("tab-c");
    expect(tabs()[0].getAttribute("aria-controls")).toBe("panel");
  });

  it.each([2, 3, 5])(
    "%i 项：←/→ 循环、Home/End 首尾，焦点随之移动；上下键不切换",
    async (count) => {
      mount(count);
      tabs()[0].focus();
      await key(tabs()[0], "ArrowRight");
      expect(current()).toBe("乙");
      expect(document.activeElement).toBe(tabs()[1]);
      await key(tabs()[1], "ArrowLeft");
      await key(tabs()[0], "ArrowLeft");
      expect(current()).toBe(ITEMS[count - 1].label);
      expect(document.activeElement).toBe(tabs()[count - 1]);
      await key(tabs()[count - 1], "Home");
      expect(current()).toBe("甲");
      await key(tabs()[0], "End");
      expect(current()).toBe(ITEMS[count - 1].label);
      expect(document.activeElement).toBe(tabs()[count - 1]);
      await key(tabs()[count - 1], "ArrowDown");
      expect(current()).toBe(ITEMS[count - 1].label);
    },
  );

  it("点已选中的项不回调", async () => {
    mount(3);
    await act(async () => tabs()[0].click());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("disabled：标明不可用、无悬停样式，点击与按键都不切换", async () => {
    disabled = true;
    mount(4);
    for (const tab of tabs()) {
      expect(tab.getAttribute("aria-disabled")).toBe("true");
      expect(tab.className).toContain("cursor-not-allowed");
      expect(tab.className).toContain("opacity-50");
      expect(tab.querySelector("span")!.className).not.toContain("hov:");
    }
    await act(async () => tabs()[2].click());
    await key(tabs()[0], "End");
    expect(onSelect).not.toHaveBeenCalled();
    expect(current()).toBe("甲");
  });
});
