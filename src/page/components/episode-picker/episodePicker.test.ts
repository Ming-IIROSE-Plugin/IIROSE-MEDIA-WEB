import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import { ShowMessage } from "../../../iirose_func/ShowMessage";
import { pushOverlayLayer } from "../desk/overlayLayers";
import {
  EPISODE_PICKER_ROOT_ID,
  openEpisodePicker,
  releaseEpisodePicker,
  type EpisodePickEntry,
} from "./openEpisodePicker";
import {
  resolveEpisodeOrder,
  selectAllEpisodes,
  toggleEpisode,
  type EpisodePickerProps,
} from "./EpisodePicker";
import { EpisodePicker, RENDER_BATCH } from "./EpisodePicker";
import { h, render } from "preact";
import episodePickerSrc from "./EpisodePicker.tsx?raw";
import openEpisodePickerSrc from "./openEpisodePicker.tsx?raw";

// 选集面板（story 5 I/O 矩阵）：标题与集数、点选顺序徽章与前移、全选 / 取消全选、
// 正序 / 乱序、未选禁用、三种加载态、取消四路径、房间不支持、焦点与 44px、
// 零裸值 / 无 emoji / 无宿站 mdi 类。

const entries = (count: number): EpisodePickEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `e${index + 1}`,
    title: `第 ${index + 1} 集`,
    duration: 60 + index,
  }));

const root = () => document.getElementById(EPISODE_PICKER_ROOT_ID);
const layer = () =>
  document.querySelector<HTMLElement>("[data-imw-episode-picker]")!;
const dialog = () => layer()?.querySelector<HTMLElement>('[role="dialog"]')!;
const rows = () =>
  Array.from(dialog().querySelectorAll<HTMLElement>('[role="checkbox"]'));
const row = (title: string) =>
  rows().find((node) => node.getAttribute("aria-label")?.startsWith(title))!;
const buttons = () =>
  Array.from(dialog().querySelectorAll<HTMLButtonElement>("button"));
const button = (text: string) =>
  buttons().find((node) => (node.textContent ?? "").trim() === text)!;
const byLabel = (label: string) =>
  dialog().querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
const text = () => dialog()?.textContent ?? "";
/** 行上读屏的「第 N 个」；未选为 null。 */
const orderOf = (title: string) => {
  const match = row(title)
    .getAttribute("aria-label")
    ?.match(/第 (\d+) 个/);
  return match ? Number(match[1]) : null;
};

async function flush(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function click(element: Element | undefined) {
  await act(async () => {
    (element as HTMLElement).click();
  });
  await flush();
}

/** 点按：先 pointerdown 再 click（外框按「按下点」判定，不能只发 click）。 */
async function tap(element: Element) {
  await act(async () => {
    element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  });
  await click(element);
}

async function press(key: string, element: EventTarget = document) {
  await act(async () => {
    (element as HTMLElement).dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await flush();
}

interface Opened {
  onConfirm: ReturnType<typeof vi.fn>;
  onCancel: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
}

async function open(
  list: EpisodePickEntry[] | (() => Promise<EpisodePickEntry[]>) = entries(3),
  options: Partial<Parameters<typeof openEpisodePicker>[0]> = {},
): Promise<Opened> {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const load =
    typeof list === "function"
      ? vi.fn(list)
      : vi.fn(async () => list as EpisodePickEntry[]);
  await act(async () => {
    openEpisodePicker({ unit: "集", load, onConfirm, onCancel, ...options });
  });
  await flush();
  return { onConfirm, onCancel, load };
}

/** 宿站返回键：`openEpisodePicker` 打开时接管了 `Utils.backward`。 */
function hostBack() {
  (
    window as Window & { Utils?: { backward?: () => void } }
  ).Utils?.backward?.();
}

let opener: HTMLButtonElement;

beforeEach(() => {
  // `Utils.backward` 的包装每页只装一次：对象跨用例保持同一份，只清调用记录。
  const page = window as unknown as { Utils?: { backward?: () => void } };
  if (!page.Utils) page.Utils = { backward: () => {} };
  (window as Window & { theme?: unknown }).theme = 1;
  opener = document.createElement("button");
  opener.textContent = "点播到房间";
  document.body.appendChild(opener);
  opener.getClientRects = () =>
    [{ width: 1, height: 1 }] as unknown as DOMRectList;
  opener.focus();
});

afterEach(() => {
  act(() => releaseEpisodePicker());
  opener.remove();
  delete (window as Window & { mediaShareRoom?: boolean }).mediaShareRoom;
  vi.restoreAllMocks();
});

describe("纯逻辑：点选顺序、全选、正序 / 乱序", () => {
  it("点选顺序：追加到末尾；取消某项后其余序号前移", () => {
    let selected = toggleEpisode([], "e3");
    selected = toggleEpisode(selected, "e1");
    expect(selected).toEqual(["e3", "e1"]);
    selected = toggleEpisode(selected, "e3");
    expect(selected).toEqual(["e1"]);
  });

  it("全选按列表顺序", () => {
    expect(selectAllEpisodes(entries(3))).toEqual(["e1", "e2", "e3"]);
  });

  it("正序 = 点选顺序；乱序是同一集合的置换（Fisher–Yates，无重复无遗漏）", () => {
    const list = entries(4);
    const selected = ["e3", "e1", "e4", "e2"];
    expect(
      resolveEpisodeOrder(list, selected, "asc").map((entry) => entry.id),
    ).toEqual(selected);

    // 固定随机序列，断言的是「置换」而不是具体分布
    const random = () => 0;
    const shuffled = resolveEpisodeOrder(list, selected, "shuffle", random).map(
      (entry) => entry.id,
    );
    expect(shuffled).toHaveLength(4);
    expect([...shuffled].sort()).toEqual(["e1", "e2", "e3", "e4"]);
    expect(new Set(shuffled).size).toBe(4);
  });
});

describe("标题行与列表", () => {
  it("标题「选集」+ 等宽集数 + 全选 + 关闭钮", async () => {
    await open(entries(5));
    expect(text()).toContain("选集");
    expect(text()).toContain("5 集");
    expect(button("全选")).not.toBeUndefined();
    expect(byLabel("关闭选集")).not.toBeNull();
    expect(rows()).toHaveLength(5);
  });

  it("单位由打开方给：网易云曲目为「首」", async () => {
    await open(entries(3), { unit: "首" });
    expect(text()).toContain("3 首");
  });

  it("行内显示集名与等宽时长", async () => {
    await open(entries(2));
    expect(row("第 1 集").textContent).toContain("01:00");
    expect(row("第 2 集").textContent).toContain("01:01");
  });

  it("有副行的条目（网易云曲目）渲染歌手行", async () => {
    await open([{ id: "e1", title: "晴天", meta: "周杰伦", duration: 269 }]);
    expect(row("晴天").textContent).toContain("周杰伦");
    expect(row("晴天").textContent).toContain("04:29");
  });
});

describe("点选顺序徽章", () => {
  it("依次点第 3、1 集：徽章为 1、2；取消第 3 集后第 1 集徽章前移为 1", async () => {
    await open(entries(3));
    await click(row("第 3 集"));
    await click(row("第 1 集"));
    expect(orderOf("第 3 集")).toBe(1);
    expect(orderOf("第 1 集")).toBe(2);
    expect(row("第 3 集").textContent).toContain("1");
    expect(
      row("第 3 集").querySelector('[aria-hidden="true"]')?.textContent,
    ).toBe("1");

    await click(row("第 3 集"));
    expect(orderOf("第 1 集")).toBe(1);
    expect(orderOf("第 3 集")).toBeNull();
  });

  it("未选行是描边方块，选中行是蔷薇红实底徽章 + 读屏「第 N 个」", async () => {
    await open(entries(2));
    const unchecked = row("第 1 集").querySelector('[aria-hidden="true"]')!;
    expect(unchecked.getAttribute("class")).not.toContain("bg-");
    await click(row("第 1 集"));
    const badge = row("第 1 集").querySelector('[aria-hidden="true"]')!;
    expect(badge.getAttribute("class")).toContain("h-5");
    expect(badge.getAttribute("class")).toContain("w-5");
    expect(row("第 1 集").getAttribute("role")).toBe("checkbox");
    expect(row("第 1 集").getAttribute("aria-checked")).toBe("true");
  });
});

describe("大歌单：分批渲染与后台补歌名", () => {
  const list = () =>
    layer()!.querySelector<HTMLElement>('[data-imw-episode-list="true"]')!;
  const scrollNearBottom = () =>
    act(() => {
      const el = list();
      Object.defineProperty(el, "scrollHeight", {
        value: 10_000,
        configurable: true,
      });
      Object.defineProperty(el, "clientHeight", {
        value: 400,
        configurable: true,
      });
      el.scrollTop = 9_500;
      el.dispatchEvent(new Event("scroll"));
    });

  it("上万行只先画一批，滚到底再追加；全选仍选中全部", async () => {
    await open(entries(10_000));
    expect(rows()).toHaveLength(RENDER_BATCH);
    expect(text()).toContain("10000 集");

    scrollNearBottom();
    expect(rows()).toHaveLength(RENDER_BATCH * 2);

    // 全选作用于数据，不受已画行数限制
    act(() => button("全选").click());
    expect(text()).toContain("取消全选");
    expect(rows()[0].getAttribute("aria-label")).toContain("第 1 个");
  });

  it("后台补歌名：逐批刷新标题与进度，已点选的项不丢；补完进度消失", async () => {
    let apply!: (changes: Map<string, Partial<EpisodePickEntry>>) => void;
    let report!: (done: number, total: number) => void;
    let finish!: () => void;
    await open(entries(3), {
      enrich: (_entries, api) => {
        apply = api.patch;
        report = api.progress;
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      },
    });
    act(() => row("第 2 集").click()); // 先点选第 2 行
    act(() => report(0, 3));
    expect(
      layer()!.querySelector("[data-imw-episode-progress]")!.textContent,
    ).toContain("歌名加载中 0 / 3");

    act(() => {
      apply(new Map([["e2", { title: "晴天" }]]));
      report(1, 3);
    });
    expect(text()).toContain("晴天");
    expect(text()).toContain("歌名加载中 1 / 3");
    // 已选仍是这一行（id 不变）
    expect(byLabel("晴天，第 1 个")).toBeTruthy();

    await act(async () => {
      finish();
    });
    expect(layer()!.querySelector("[data-imw-episode-progress]")).toBeNull();
  });

  it("关闭面板时中止后台补充（不再请求）", async () => {
    let signal!: AbortSignal;
    await open(entries(3), {
      enrich: (_entries, api) => {
        signal = api.signal;
        return new Promise<void>(() => {});
      },
    });
    expect(signal.aborted).toBe(false);
    act(() => byLabel("关闭选集").click());
    expect(signal.aborted).toBe(true);
  });
});

describe("全选", () => {
  it("按列表顺序出现徽章 1…N，文案变「取消全选」；再点清空", async () => {
    await open(entries(3));
    await click(button("全选"));
    expect(orderOf("第 1 集")).toBe(1);
    expect(orderOf("第 2 集")).toBe(2);
    expect(orderOf("第 3 集")).toBe(3);
    expect(button("取消全选")).not.toBeUndefined();

    await click(button("取消全选"));
    for (const title of ["第 1 集", "第 2 集", "第 3 集"])
      expect(orderOf(title)).toBeNull();
    expect(button("全选")).not.toBeUndefined();
  });
});

describe("确认", () => {
  it("未选任何项：「点播所选」禁用且点击无动作、面板不关", async () => {
    const { onConfirm } = await open(entries(3));
    const confirm = button("点播所选");
    expect(confirm.disabled).toBe(true);
    expect(confirm.getAttribute("class")).toContain("opacity-40");
    await click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(root()).not.toBeNull();
  });

  it("只选 1 集：按点选顺序回调一条", async () => {
    const { onConfirm } = await open(entries(3));
    await click(row("第 2 集"));
    await click(button("点播所选"));
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ id: "e2" }),
    ]);
  });

  it("选 ≥2 集：按点选顺序回调（不是列表顺序）", async () => {
    const { onConfirm } = await open(entries(3));
    await click(row("第 3 集"));
    await click(row("第 1 集"));
    await click(button("点播所选"));
    expect(
      (onConfirm.mock.lastCall?.[0] as EpisodePickEntry[]).map(
        (entry) => entry.id,
      ),
    ).toEqual(["e3", "e1"]);
  });

  it("全选 + 乱序：同一集合的随机置换，数量不变", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const { onConfirm } = await open(entries(4));
    await click(button("全选"));
    await click(button("乱序"));
    expect(button("乱序").getAttribute("aria-checked")).toBe("true");
    expect(button("正序").getAttribute("aria-checked")).toBe("false");
    await click(button("点播所选"));
    const ids = (onConfirm.mock.lastCall?.[0] as EpisodePickEntry[]).map(
      (entry) => entry.id,
    );
    expect(ids).toHaveLength(4);
    expect([...ids].sort()).toEqual(["e1", "e2", "e3", "e4"]);
  });

  it("方向键在两段之间移动并切换顺序（radiogroup）", async () => {
    await open(entries(2));
    const asc = button("正序");
    asc.focus();
    await press("ArrowRight", asc);
    expect(button("乱序").getAttribute("aria-checked")).toBe("true");
    expect(button("正序").getAttribute("aria-checked")).toBe("false");
    expect(document.activeElement).toBe(button("乱序"));
  });

  it("默认正序", async () => {
    await open(entries(2));
    expect(button("正序").getAttribute("aria-checked")).toBe("true");
    expect(button("乱序").getAttribute("aria-checked")).toBe("false");
  });
});

describe("三种非就绪状态", () => {
  it("加载中：骨架行 + 底栏禁用", async () => {
    const pending = new Promise<EpisodePickEntry[]>(() => {});
    const onConfirm = vi.fn();
    await act(async () => {
      openEpisodePicker({ unit: "集", load: () => pending, onConfirm });
    });
    expect(rows()).toHaveLength(0);
    expect(
      dialog().querySelectorAll('[data-imw-episode-list] [aria-hidden="true"]')
        .length,
    ).toBeGreaterThan(0);
    expect(button("点播所选").disabled).toBe(true);
    expect(button("正序").disabled).toBe(true);
  });

  it("加载失败：「加载失败」+「重试」，重试重新取；失败不点播", async () => {
    let attempt = 0;
    const load = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("boom");
      return entries(2);
    });
    const { onConfirm, onCancel } = await open(load);
    expect(text()).toContain("加载失败");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    await click(button("重试"));
    expect(load).toHaveBeenCalledTimes(2);
    expect(rows()).toHaveLength(2);
    expect(button("点播所选").disabled).toBe(true);
    // 重试重新取数后不带上一次的点选：全部行未选、全选可用
    expect(
      rows().every((node) => node.getAttribute("aria-checked") === "false"),
    ).toBe(true);
    expect(button("全选").disabled).toBe(false);
    expect(button("全选")).not.toBeUndefined();
  });

  it("0 集：文案按单位（集 / 首），只能关闭", async () => {
    const { onCancel } = await open([]);
    expect(text()).toContain("没有可点播的分集");
    expect(button("全选").disabled).toBe(true);
    expect(button("点播所选").disabled).toBe(true);
    await click(byLabel("关闭选集"));
    expect(onCancel).toHaveBeenCalledOnce();

    act(() => releaseEpisodePicker());
    await open([], { unit: "首" });
    expect(text()).toContain("没有可点播的曲目");
  });
});

describe("取消路径（都不点播）", () => {
  it("关闭钮", async () => {
    const { onConfirm, onCancel } = await open();
    await click(byLabel("关闭选集"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("点面板外侧（按按下点判定）", async () => {
    const { onCancel } = await open();
    await tap(layer());
    expect(onCancel).toHaveBeenCalledOnce();

    // 从行内按下、在外框上松开：click 落在公共祖先上，不算点外侧
    act(() => releaseEpisodePicker());
    const again = await open();
    await act(async () => {
      row("第 1 集").dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    await click(layer());
    expect(again.onCancel).not.toHaveBeenCalled();
    expect(root()).not.toBeNull();
  });

  it("Esc 只关这一层：面板在时下一层不动，再按一次才关下一层", async () => {
    const below = vi.fn();
    const release = pushOverlayLayer("source", below);
    try {
      const { onCancel } = await open();
      await press("Escape");
      expect(onCancel).toHaveBeenCalledOnce();
      expect(below).not.toHaveBeenCalled();
      await flush(220);
      expect(root()).toBeNull();

      await press("Escape");
      expect(below).toHaveBeenCalledOnce();
    } finally {
      release();
    }
  });

  it("宿站返回键只关面板、不点播", async () => {
    const { onConfirm, onCancel } = await open();
    await act(async () => {
      hostBack();
    });
    await flush();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("房间不支持点播", () => {
  it("「点播所选」灰化但仍可点：只提示，不发报文、不关面板", async () => {
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    (window as Window & { mediaShareRoom?: boolean }).mediaShareRoom = false;
    const { onConfirm } = await open(entries(2));
    await click(row("第 1 集"));

    const confirm = button("点播所选");
    expect(confirm.disabled).toBe(false);
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    expect(confirm.getAttribute("class")).toContain("opacity-40");

    await click(confirm);
    expect(show).toHaveBeenCalledWith("这个房间不支持点播");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(root()).not.toBeNull();
  });
});

describe("焦点与触控目标", () => {
  it("打开后焦点在关闭钮；关闭后退还触发元素", async () => {
    let { onCancel } = await open();
    expect(document.activeElement).toBe(byLabel("关闭选集"));
    await click(byLabel("关闭选集"));
    expect(onCancel).toHaveBeenCalledOnce();
    // 退场动效结束后卸载并归还焦点
    await flush(220);
    expect(root()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("打开时焦点在 body（移动端点按不聚焦）：不把 body 当归还点", async () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    (document.activeElement as HTMLElement | null)?.blur?.();

    const { onCancel } = await open(entries(2));
    expect(document.activeElement).toBe(byLabel("关闭选集"));

    await click(byLabel("关闭选集"));
    expect(onCancel).toHaveBeenCalledOnce();
    await flush(220);
    expect(root()).toBeNull();
    // 关闭时不往 body 上塞焦点（body 不是触发元素）
    expect(focus.mock.contexts).not.toContain(document.body);
  });

  it("returnFocus 已卸载（宿站弹窗确认钮被清空）时不归还、不抛错", async () => {
    const gone = document.createElement("button");
    await open(entries(2), { returnFocus: gone });
    await click(byLabel("关闭选集"));
    await flush(220);
    expect(root()).toBeNull();
    expect(document.activeElement).not.toBe(gone);
  });

  it("returnFocus 覆盖打开时的焦点元素", async () => {
    const target = document.createElement("div");
    const inner = document.createElement("button");
    inner.textContent = "行";
    target.append(inner);
    document.body.append(target);
    try {
      await open(entries(2), { returnFocus: target });
      await click(byLabel("关闭选集"));
      await flush(220);
      expect(document.activeElement).toBe(inner);
    } finally {
      target.remove();
    }
  });

  it("Tab 在面板内首尾循环", async () => {
    await open(entries(2));
    // 与 `focusableWithin` 同口径：禁用的不算，`tabIndex=-1` 的分段项不算
    const focusables = buttons().filter(
      (node) => !node.disabled && node.tabIndex >= 0,
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    expect(first).not.toBe(last);

    last.focus();
    await press("Tab", last);
    expect(document.activeElement).toBe(first);

    await act(async () => {
      first.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(document.activeElement).toBe(last);
  });

  it("行与可点目标 ≥44px，手机断点用 max-[768px]", async () => {
    await open(entries(2));
    for (const node of rows())
      expect(node.getAttribute("class")).toContain("min-h-[44px]");
    expect(button("点播所选").getAttribute("class")).toContain("h-11");
    expect(byLabel("关闭选集").getAttribute("class")).toContain(
      "max-[768px]:h-11",
    );
    expect(dialog().getAttribute("class")).toContain("max-[768px]:");
  });
});

describe("零裸值 / 无 emoji / 无宿站 mdi 类", () => {
  it("渲染结果里没有 themed / accentVar / rgba", async () => {
    await open(entries(2));
    const dump = Array.from(root()!.querySelectorAll("*"))
      .map((node) => node.getAttribute("class") ?? "")
      .join(" ");
    expect(dump).not.toMatch(/rgba\(|themed|accentVar/);
  });

  it("源码里不出现裸颜色值、emoji 与 mdi 类", () => {
    for (const [name, source] of [
      ["EpisodePicker.tsx", episodePickerSrc],
      ["openEpisodePicker.tsx", openEpisodePickerSrc],
    ] as const) {
      expect(
        `${name}:${source.match(/#[0-9a-fA-F]{3,8}/g) ?? "无裸色值"}`,
      ).toBe(`${name}:无裸色值`);
      expect(source).not.toMatch(/rgba\(|themed|accentVar/);
      expect(source).not.toMatch(/\bmdi-/);
      expect(source).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });
});

describe("受控视图（EpisodePicker）", () => {
  let host: HTMLDivElement;
  const props = (patch: Partial<EpisodePickerProps> = {}) => ({
    unit: "集",
    status: "ready" as const,
    entries: entries(2),
    selected: [] as string[],
    order: "asc" as const,
    onToggle: vi.fn(),
    onToggleAll: vi.fn(),
    onOrderChange: vi.fn(),
    onRetry: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...patch,
  });

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it("是受控视图：点行、全选、顺序都只派发回调", () => {
    const p = props();
    render(h(EpisodePicker, p), host);
    const nodes = Array.from(
      host.querySelectorAll<HTMLElement>('[role="checkbox"]'),
    );
    nodes[0].click();
    expect(p.onToggle).toHaveBeenCalledWith("e1");
    (
      Array.from(host.querySelectorAll("button")).find(
        (node) => node.textContent === "全选",
      ) as HTMLButtonElement
    ).click();
    expect(p.onToggleAll).toHaveBeenCalledOnce();
    (
      host.querySelector('[role="radio"][aria-checked="false"]') as HTMLElement
    ).click();
    expect(p.onOrderChange).toHaveBeenCalledWith("shuffle");
  });

  it("标题行与底栏固定、只有列表区滚动", () => {
    render(h(EpisodePicker, props()), host);
    const list = host.querySelector("[data-imw-episode-list]")!;
    expect(list.getAttribute("class")).toContain("overflow-y-auto");
    expect(
      host.querySelector('[role="dialog"]')!.getAttribute("class"),
    ).toContain("flex-col");
  });
});
