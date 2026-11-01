import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef, h, render } from "preact";
import { act } from "preact/test-utils";
import {
  noteMediaSent,
  resetRequestGuard,
  subscribeRequestToast,
} from "../../../playback/RequestGuard";
import { SearchBar, type SearchBarProps, type SearchSource } from "./SearchBar";
import { detectVideoTarget, parseBilibiliLink } from "./searchIntent";

// 分 P 链接要落到共用的点播实现上（真实实现会发网络请求并点播）
const playBilibiliLink = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../../platforms/bilibiliLink", () => ({ playBilibiliLink }));

const SOURCES: SearchSource[] = [
  { label: "网易云音乐", short: "网易云", dot: "netease" },
];

let host: HTMLDivElement;
const input = () => host.querySelector("input")!;
const kbd = () => host.querySelector("kbd")!;
const paste = (text: string) => {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { getData: () => text },
  });
  input().dispatchEvent(event);
  return event;
};
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
      active: true,
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
  playBilibiliLink.mockClear();
  resetRequestGuard();
});
afterEach(() => {
  render(null, host);
  host.remove();
  resetRequestGuard();
  document.getElementById("IIROSE_MEDIA_CONTAINER")?.remove();
});

describe("搜索栏", () => {
  it("来源切换器带圆点与简称，只有一个来源也显示", () => {
    draw();
    expect(host.textContent).toContain("网易云音乐");
    expect(host.textContent).toContain("网易云");
    const dot = host.querySelector('[aria-hidden="true"]')!;
    expect(dot.getAttribute("class")).toContain("bg-[#D7371F]");
    const trigger = host.querySelector<HTMLButtonElement>(
      '[aria-haspopup="listbox"]',
    )!;
    expect(trigger.getAttribute("aria-label")).toBe("来源：网易云音乐");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // 不再用原生 select（展开样式由系统决定）
    expect(host.querySelector("select")).toBeNull();
  });

  const TWO: SearchSource[] = [
    { label: "全部", short: "全部", dot: null },
    { label: "网易云音乐", short: "网易云", dot: "netease" },
  ];
  const trigger = () =>
    host.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"]')!;
  const options = () =>
    Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'));

  it("点切换器展开自有菜单：当前项打勾，点选项回调下标并收起", () => {
    const onSelectSource = vi.fn();
    draw({ sources: TWO, sourceIndex: 0, onSelectSource });
    act(() => trigger().click());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(options().map((el) => el.textContent)).toEqual([
      "全部",
      "网易云音乐",
    ]);
    expect(options()[0].getAttribute("aria-selected")).toBe("true");
    expect(options()[0].querySelector("svg")).not.toBeNull();
    act(() => options()[1].click());
    expect(onSelectSource).toHaveBeenCalledWith(1);
    expect(host.querySelector('[role="listbox"]')).toBeNull();
  });

  it("选当前项不重复回调", () => {
    const onSelectSource = vi.fn();
    draw({ sources: TWO, sourceIndex: 1, onSelectSource });
    act(() => trigger().click());
    act(() => options()[1].click());
    expect(onSelectSource).not.toHaveBeenCalled();
  });

  it("键盘：下键展开，上下移动，回车选中", () => {
    const onSelectSource = vi.fn();
    draw({ sources: TWO, sourceIndex: 0, onSelectSource });
    act(() => {
      trigger().dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    });
    const list = host.querySelector('[role="listbox"]')!;
    expect(list).not.toBeNull();
    act(() => {
      list.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    });
    expect(document.activeElement).toBe(options()[1]);
    act(() => {
      list.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(onSelectSource).toHaveBeenCalledWith(1);
    // 收起后焦点回到切换器
    expect(document.activeElement).toBe(trigger());
  });

  it("点菜单外侧收起，不切换来源", () => {
    const onSelectSource = vi.fn();
    draw({ sources: TWO, sourceIndex: 0, onSelectSource });
    act(() => trigger().click());
    act(() =>
      host
        .querySelector<HTMLElement>('[data-imw-source-backdrop="true"]')!
        .click(),
    );
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(onSelectSource).not.toHaveBeenCalled();
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

  it("键位提示：已聚焦且为空时不显示 /（已经在输入了），失焦后恢复", () => {
    draw();
    act(() => {
      input().focus();
    });
    expect(host.querySelector("kbd")).toBeNull();
    act(() => {
      input().value = "晴天";
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(kbd().textContent).toBe("Enter");
    act(() => {
      input().value = "";
      input().dispatchEvent(new Event("input", { bubbles: true }));
      input().blur();
    });
    expect(kbd().textContent).toBe("/");
    // 与「搜索」按钮之间留出间距
    expect(kbd().getAttribute("class")).toContain("mr-2.5");
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

  it("输入即通知 onLiveInput（不提交）；不传时行为不变", () => {
    const onLiveInput = vi.fn();
    const { onSubmit } = draw({ onLiveInput });
    act(() => {
      input().value = "周杰伦";
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onLiveInput).toHaveBeenLastCalledWith("周杰伦");
    // 逐字过滤不等于提交：Enter / 按钮才是提交路径
    expect(onSubmit).not.toHaveBeenCalled();

    render(null, host);
    draw();
    act(() => {
      input().value = "x";
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(kbd().textContent).toBe("Enter");
  });

  it("输入法组字期间不通知 onLiveInput，组字结束再通知最终值", () => {
    const onLiveInput = vi.fn();
    draw({ onLiveInput });

    act(() => {
      input().dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      );
      input().value = "zhou";
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onLiveInput).not.toHaveBeenCalled();
    expect(kbd().textContent).toBe("Enter");

    act(() => {
      input().value = "周杰伦";
      input().dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true }),
      );
    });
    expect(onLiveInput).toHaveBeenLastCalledWith("周杰伦");
  });

  it("粘贴带 ?p= 的哔哩哔哩链接：直接点播该分 P，不退化成搜索", async () => {
    const { onSubmit } = draw();
    const toasts: string[] = [];
    const off = subscribeRequestToast((toast) => toasts.push(toast.text));

    const event = paste("https://www.bilibili.com/video/BV1xx411c7mD?p=2");

    expect(event.defaultPrevented).toBe(true);
    // 搜索栏不提交、不填词：这条链接的落点是「点播 P2」
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input().value).toBe("");
    // 走点播守卫 → 共用实现（`?p=` 一路带到平台层，搜索那条路不可能做到）
    expect(playBilibiliLink).toHaveBeenCalledWith(
      "https://www.bilibili.com/video/BV1xx411c7mD?p=2",
      { requirePage: true },
    );
    // 报文发出即按手动点播收尾（成功提示），不是「什么都没发生」
    noteMediaSent("&1|video");
    await vi.waitFor(() => expect(toasts).toHaveLength(1));
    expect(toasts[0]).toContain("已点播");
    off();
  });

  it("粘贴不带分 P 的链接 / BV 号仍当搜索词提交", () => {
    const { onSubmit } = draw();

    const bv = paste("BV1xx411c7mD");
    expect(bv.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith("BV1xx411c7mD");

    paste("https://www.bilibili.com/video/BV1xx411c7mD");
    expect(onSubmit).toHaveBeenLastCalledWith("BV1xx411c7mD");
    expect(playBilibiliLink).not.toHaveBeenCalled();

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

  it("面板未打开时 / 不抢焦点（active 是唯一判据，不再读 DOM class）", () => {
    draw({ active: false });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "/", bubbles: true }),
      );
    });
    expect(document.activeElement).not.toBe(input());
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

  it("输入光标跟随当前来源的品牌色，没有来源色时退回蔷薇红", () => {
    draw();
    expect(input().getAttribute("class")).toContain("caret-[#D7371F]");
    expect(input().getAttribute("class")).not.toContain("caret-[#B42F3E]");

    render(null, host);
    draw({
      sources: [{ label: "哔哩哔哩", short: "B站", dot: "bilibili" }],
    });
    expect(input().getAttribute("class")).toContain("caret-[#E1608C]");

    // 收藏的「全部」没有来源色：光标回到面板强调色
    render(null, host);
    draw({ sources: [{ label: "全部", short: "全部" }] });
    expect(input().getAttribute("class")).toContain("caret-[#B42F3E]");
  });

  it("手机来源切换器可点区 ≥44px", () => {
    draw();
    const source = host.querySelector('[aria-label^="来源："]')!;
    expect(source.getAttribute("class")).toContain("max-[768px]:h-11");
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
    // 没有词边界时这串里藏着 `bv` + 10 位，会抢走粘贴并变成视频搜索
    expect(detectVideoTarget("xxabv1234567890yy")).toBeNull();
    expect(
      detectVideoTarget(
        "看看这个 https://www.bilibili.com/video/BV1xx411c7mD?p=2",
      ),
    ).toBe("BV1xx411c7mD");
  });

  it("哔哩哔哩链接解析出视频号与 ?p=，短链 / 非视频链接返回 null", () => {
    const link = parseBilibiliLink(
      "https://www.bilibili.com/video/BV1xx411c7mD?p=2",
    )!;
    expect(link.videoId).toBe("BV1xx411c7mD");
    expect(link.targetP).toBe(2);

    // 没带分 P：解析得到视频号，targetP 为空
    expect(
      parseBilibiliLink("https://m.bilibili.com/video/av170001")?.targetP,
    ).toBeUndefined();
    expect(
      parseBilibiliLink("https://www.bilibili.com/video/BV1xx411c7mD")?.videoId,
    ).toBe("BV1xx411c7mD");
    // 小写贴进来的 BV 前缀归一（id 本身区分大小写，保持原样）
    expect(
      parseBilibiliLink("https://www.bilibili.com/video/bv1xx411c7mD?p=3")
        ?.videoId,
    ).toBe("BV1xx411c7mD");

    // 短链里没有视频号（要先展开）、普通文本、非哔哩哔哩站点都不认
    expect(parseBilibiliLink("https://b23.tv/abcd")).toBeNull();
    expect(parseBilibiliLink("陈绮贞")).toBeNull();
    expect(
      parseBilibiliLink("https://example.com/video/BV1xx411c7mD"),
    ).toBeNull();
  });
});
