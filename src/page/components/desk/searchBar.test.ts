import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef, h, render } from "preact";
import { act } from "preact/test-utils";
import { SearchBar, type SearchBarProps, type SearchSource } from "./SearchBar";
import { detectVideoTarget } from "./searchIntent";

const SOURCES: SearchSource[] = [
  { label: "网易云音乐", short: "网易云", dot: "netease" },
];

let host: HTMLDivElement;
const input = () => host.querySelector("input")!;
const kbd = () => host.querySelector("kbd")!;
const draw = (props: Partial<SearchBarProps> = {}) => {
  const ref = createRef<SearchBar>();
  const onSubmit = vi.fn();
  render(
    h(SearchBar, {
      keyword: "",
      placeholder: "搜索歌名或歌手",
      sources: SOURCES,
      sourceIndex: 0,
      onSelectSource: () => {},
      onSubmit,
      ...props,
      ref,
    } as SearchBarProps),
    host,
  );
  return { ref, onSubmit };
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  // `/` 只在面板打开时抢焦点
  const panel = document.createElement("div");
  panel.id = "IIROSE_MEDIA_CONTAINER";
  panel.className = "ShowIIROSE_MEDIA_CONTAINER";
  document.body.append(panel);
});
afterEach(() => {
  render(null, host);
  host.remove();
  document.getElementById("IIROSE_MEDIA_CONTAINER")?.remove();
});

describe("搜索栏", () => {
  it("来源切换器带圆点与简称，只有一个来源也显示", () => {
    draw();
    expect(host.textContent).toContain("网易云音乐");
    expect(host.textContent).toContain("网易云");
    const dot = host.querySelector('[aria-hidden="true"]')!;
    expect(dot.getAttribute("class")).toContain("bg-[#D7371F]");
    const select = host.querySelector("select")!;
    expect(select.getAttribute("aria-label")).toBe("来源");
  });

  it("来源切换回调下标", () => {
    const onSelectSource = vi.fn();
    draw({ onSelectSource });
    const select = host.querySelector("select")!;
    select.value = "0";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onSelectSource).toHaveBeenCalledWith(0);
  });

  it("键位提示：为空显示 /，有内容显示 Enter", () => {
    draw();
    expect(kbd().textContent).toBe("/");
    act(() => {
      input().value = "陈绮贞";
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(kbd().textContent).toBe("Enter");
  });

  it("Enter 与「搜索」按钮都提交当前输入", () => {
    const { onSubmit } = draw();
    act(() => {
      input().value = "陈绮贞";
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      input().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(onSubmit).toHaveBeenLastCalledWith("陈绮贞");

    const button = Array.from(host.querySelectorAll("button")).find(
      (el) => el.textContent?.trim() === "搜索",
    )!;
    act(() => {
      (button as HTMLButtonElement).click();
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("粘贴 BV 号 / 哔哩哔哩链接自动识别并提交", () => {
    const { onSubmit } = draw();
    const paste = (text: string) => {
      const event = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", {
        value: { getData: () => text },
      });
      input().dispatchEvent(event);
      return event;
    };

    const bv = paste("BV1xx411c7mD");
    expect(bv.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith("BV1xx411c7mD");

    paste("看看这个 https://www.bilibili.com/video/BV1xx411c7mD?p=2");
    expect(onSubmit).toHaveBeenLastCalledWith("BV1xx411c7mD");

    // 普通文本照常粘贴，不抢提交
    const plain = paste("陈绮贞");
    expect(plain.defaultPrevented).toBe(false);
  });

  it("按 / 聚焦搜索栏，输入框内的 / 照常输入", () => {
    const { ref } = draw();
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "/", bubbles: true }),
      );
    });
    expect(document.activeElement).toBe(input());

    // 焦点已在输入框：不拦截，不 preventDefault
    const event = new KeyboardEvent("keydown", {
      key: "/",
      bubbles: true,
      cancelable: true,
    });
    input().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);

    // focus() 由容器在打开面板时调用
    (document.activeElement as HTMLElement).blur();
    act(() => ref.current!.focus());
    expect(document.activeElement).toBe(input());
  });

  it("手机端不显示键位提示与搜索按钮", () => {
    draw();
    expect(kbd().getAttribute("class")).toContain("max-[768px]:hidden");
    const button = Array.from(host.querySelectorAll("button")).find(
      (el) => el.textContent?.trim() === "搜索",
    )!;
    expect(button.getAttribute("class")).toContain("max-[768px]:hidden");
  });

  it("手机搜索字号 16px", () => {
    draw();
    expect(input().getAttribute("class")).toContain("max-[768px]:text-[16px]");
  });
});

describe("视频目标识别", () => {
  it("BV 号、av 号、哔哩哔哩链接都认，其余不认", () => {
    expect(detectVideoTarget("BV1xx411c7mD")).toBe("BV1xx411c7mD");
    // 前缀大小写归一，后面的 id 保持原样（BV 号区分大小写）
    expect(detectVideoTarget("bv1xx411c7mD")).toBe("BV1xx411c7mD");
    expect(detectVideoTarget("av170001")).toBe("av170001");
    expect(
      detectVideoTarget("https://www.bilibili.com/video/BV1xx411c7mD"),
    ).toBe("BV1xx411c7mD");
    expect(detectVideoTarget("https://b23.tv/abcd")).toBe(
      "https://b23.tv/abcd",
    );
    expect(detectVideoTarget("陈绮贞")).toBeNull();
    expect(detectVideoTarget("   ")).toBeNull();
  });
});
