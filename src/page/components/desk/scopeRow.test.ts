import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, render } from "preact";
import { ScopeRow } from "./ScopeRow";

let host: HTMLDivElement;
const tabs = () =>
  Array.from(host.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
const tabText = () => tabs().map((el) => (el.textContent ?? "").trim());

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  render(null, host);
  host.remove();
});

const draw = (props: Partial<Parameters<typeof ScopeRow>[0]> = {}) =>
  render(
    h(ScopeRow, {
      items: [{ title: "单曲" }, { title: "专辑" }, { title: "歌单" }],
      activeIndex: 0,
      onChange: () => {},
      currentPage: 1,
      totalPage: 28,
      onPageChange: () => {},
      ...props,
    }),
    host,
  );

describe("范围行", () => {
  it("范围标签是 tablist，选中项 aria-selected + 墨色下划线", () => {
    draw();
    const list = host.querySelector('[role="tablist"]')!;
    expect(list.getAttribute("aria-label")).toBe("范围");
    expect(tabText()).toEqual(["单曲", "专辑", "歌单"]);
    expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs()[1].getAttribute("aria-selected")).toBe("false");
    // 下划线只在选中项
    expect(tabs()[0].querySelector("span")).not.toBeNull();
    expect(tabs()[1].querySelector("span")).toBeNull();
  });

  it("单击切换范围", () => {
    const onChange = vi.fn();
    draw({ onChange });
    tabs()[2].click();
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("方向键在标签间移动并切换", () => {
    const onChange = vi.fn();
    draw({ onChange });
    tabs()[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(onChange).toHaveBeenCalledWith(1);

    render(
      h(ScopeRow, {
        items: [{ title: "单曲" }, { title: "专辑" }, { title: "歌单" }],
        activeIndex: 2,
        onChange,
        currentPage: 1,
        totalPage: 28,
        onPageChange: () => {},
      }),
      host,
    );
    tabs()[2].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    // 环形：最后一项的下一项是第一项
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("分页等宽 01 / 28，越界不动作", () => {
    const onPageChange = vi.fn();
    draw({ onPageChange });
    expect(host.textContent).toContain("01 / 28");
    const [prev, next] = Array.from(
      host.querySelectorAll('[aria-label="上一页"], [aria-label="下一页"]'),
    ) as HTMLButtonElement[];

    prev.click();
    expect(onPageChange).not.toHaveBeenCalled();

    next.click();
    expect(onPageChange).toHaveBeenCalledWith(2);

    render(
      h(ScopeRow, {
        items: [{ title: "单曲" }],
        activeIndex: 0,
        onChange: () => {},
        currentPage: 28,
        totalPage: 28,
        onPageChange,
      }),
      host,
    );
    (host.querySelector('[aria-label="下一页"]') as HTMLButtonElement).click();
    expect(onPageChange).toHaveBeenCalledOnce();
  });

  it("页码补零：一位数页也显示 03 / 28", () => {
    draw({ currentPage: 3 });
    expect(host.textContent).toContain("03 / 28");
  });

  it("分页可关闭（设置 / 关于不分页）", () => {
    draw({ showPager: false });
    expect(host.querySelector('[aria-label="上一页"]')).toBeNull();
  });

  it("视图切换只在有两种视图时出现", () => {
    draw({ viewMode: null });
    expect(host.querySelector('[role="radiogroup"]')).toBeNull();

    draw({ viewMode: "list" });
    const group = host.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute("aria-label")).toBe("视图");
    const cells = Array.from(
      group.querySelectorAll('[role="radio"]'),
    ) as HTMLButtonElement[];
    expect(cells.map((el) => el.getAttribute("aria-label"))).toEqual([
      "列表",
      "网格",
    ]);
    expect(cells[0].getAttribute("aria-checked")).toBe("true");
  });

  it("点另一视图才触发切换（点当前视图不重复写设置）", () => {
    const onToggleView = vi.fn();
    draw({ viewMode: "list", onToggleView });
    const [list, grid] = Array.from(
      host.querySelectorAll('[role="radio"]'),
    ) as HTMLButtonElement[];
    list.click();
    expect(onToggleView).not.toHaveBeenCalled();
    grid.click();
    expect(onToggleView).toHaveBeenCalledOnce();
  });

  it("结果计数只占位置：传了才渲染", () => {
    draw({ items: [{ title: "单曲", count: 300 }, { title: "专辑" }] });
    expect(tabText()[0]).toBe("单曲300");
    expect(tabText()[1]).toBe("专辑");
  });

  it("手机标签区可横滚、按钮可点区 ≥44px", () => {
    draw({ viewMode: "list" });
    const list = host.querySelector('[role="tablist"]')!;
    expect(list.getAttribute("class")).toContain("overflow-x-auto");
    const cell = host.querySelector('[role="radiogroup"] [role="radio"]')!;
    expect(cell.getAttribute("class")).toContain("max-[768px]:w-11");
  });
});
