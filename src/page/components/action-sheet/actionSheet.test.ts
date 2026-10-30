import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { ShowMessage } from "../../../iirose_func/ShowMessage";
import { FavoritesStorageService } from "../../../storage/FavoritesStorageService";
import { ActionSheet } from "./ActionSheet";
import actionSheetSrc from "./ActionSheet.tsx?raw";

// 手机操作条（story 4 I/O 矩阵）：三选项与显隐、灰化与提示、点外侧 / Esc 收起、
// 焦点移入与归还、Tab 循环、44px、零裸值。

let host: HTMLDivElement;

const song = {
  title: "鱼",
  author: "陈绮贞",
  coverImg: "https://example.com/a.jpg",
  websiteUrl: "https://music.163.com/#/song?id=1",
  duration: 269,
  neteaseMusic: { id: 1, fee: 0 },
} as unknown as PlatformData;

const multiVideo = {
  title: "某多 P 视频",
  author: "某 UP",
  coverImg: "",
  websiteUrl: "https://www.bilibili.com/video/BV1",
  duration: 65,
  bilibili: { bvid: "BV1" },
  multiPage: Promise.resolve({ platform: "bilibili" }),
} as unknown as PlatformData;

const plain = {
  title: "无来源",
  author: "",
  coverImg: "",
  websiteUrl: "",
} as unknown as PlatformData;

const labels = () =>
  Array.from(host.querySelectorAll<HTMLButtonElement>("button")).map((el) =>
    (el.textContent ?? "").trim(),
  );
const option = (label: string) =>
  Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
    (el) => (el.textContent ?? "").trim() === label,
  )!;
const sheet = () => host.querySelector<HTMLElement>('[role="dialog"]');

interface Callbacks {
  onClose: ReturnType<typeof vi.fn>;
  onPlay: ReturnType<typeof vi.fn>;
  onSelectEpisodes: ReturnType<typeof vi.fn>;
}

/** 挂载操作条，返回三个回调；`settle` 用于等 `multiPage` 落地。 */
const mount = async (
  platformData: PlatformData,
  extra: Record<string, unknown> = {},
  settle?: Promise<unknown>,
): Promise<Callbacks> => {
  const callbacks: Callbacks = {
    onClose: vi.fn(),
    onPlay: vi.fn(),
    onSelectEpisodes: vi.fn(),
  };
  await act(async () => {
    render(
      h(ActionSheet, { platformData, ...callbacks, ...extra } as never),
      host,
    );
  });
  await act(async () => {
    await settle;
  });
  return callbacks;
};

const pressEscape = async () => {
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
};

const pressTab = async (shiftKey = false) => {
  await act(async () => {
    sheet()!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  vi.spyOn(FavoritesStorageService, "init").mockResolvedValue(null);
  vi.spyOn(FavoritesStorageService, "onChange").mockReturnValue(() => {});
  vi.spyOn(FavoritesStorageService, "onExternalChange").mockReturnValue(
    () => {},
  );
});

afterEach(() => {
  render(null, host);
  host.remove();
  delete (window as Window & { mediaShareRoom?: boolean }).mediaShareRoom;
});

describe("选项与显隐", () => {
  it("曲目条目：条目摘要 + 点播到房间 / 收藏", async () => {
    await mount(song);
    expect(sheet()).not.toBeNull();
    expect(sheet()!.getAttribute("aria-modal")).toBe("true");
    expect(sheet()!.getAttribute("aria-label")).toBe("鱼 的操作");
    expect(sheet()!.textContent).toContain("鱼");
    expect(sheet()!.textContent).toContain("陈绮贞");
    expect(sheet()!.textContent).toContain("04:29");
    expect(labels()).toEqual(["点播到房间", "收藏"]);
  });

  it("已收藏：第二项为「取消收藏」", async () => {
    vi.spyOn(FavoritesStorageService, "isFavorited").mockReturnValue(true);
    await mount(song);
    expect(labels()).toEqual(["点播到房间", "取消收藏"]);
  });

  it("不可收藏的条目没有收藏项", async () => {
    await mount(plain);
    expect(labels()).toEqual(["点播到房间"]);
  });

  it("多 P 条目多一行「选集」；multiPage 拒绝或为空时没有", async () => {
    await mount(multiVideo, {}, multiVideo.multiPage);
    expect(labels()).toEqual(["点播到房间", "收藏", "选集"]);

    render(null, host);
    let reject: (error: Error) => void = () => {};
    const pending = new Promise<undefined>((_resolve, r) => {
      reject = r;
    });
    await mount({ ...multiVideo, multiPage: pending } as PlatformData);
    await act(async () => {
      reject(new Error("分 P 探测失败"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(labels()).toEqual(["点播到房间", "收藏"]);

    render(null, host);
    await mount({ ...multiVideo, multiPage: Promise.resolve(undefined) });
    await act(async () => {
      await Promise.resolve();
    });
    expect(labels()).toEqual(["点播到房间", "收藏"]);
  });
});

describe("执行选项", () => {
  it("点播到房间：交给外层同一链路", async () => {
    const { onPlay, onClose } = await mount(song);
    await act(async () => {
      option("点播到房间").click();
    });
    expect(onPlay).toHaveBeenCalledOnce();
    // 收起由外层决定（容器清掉条目即卸载）
    expect(onClose).not.toHaveBeenCalled();
  });

  it("房间不支持点播：首项灰化，点击只提示、不发报文、不收起", async () => {
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    (window as Window & { mediaShareRoom?: boolean }).mediaShareRoom = false;
    const { onPlay, onClose } = await mount(song);

    const primary = option("点播到房间");
    expect(primary.getAttribute("aria-disabled")).toBe("true");
    expect(primary.getAttribute("class")).toContain("opacity-40");
    await act(async () => {
      primary.click();
    });
    expect(show).toHaveBeenCalledWith("这个房间不支持点播");
    expect(onPlay).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("收藏 / 取消收藏：立即切换并收起，失败不刷屏", async () => {
    const toggle = vi
      .spyOn(FavoritesStorageService, "toggle")
      .mockResolvedValue({ isFavorited: true } as never);
    const { onClose } = await mount(song);
    await act(async () => {
      option("收藏").click();
    });
    expect(toggle).toHaveBeenCalledWith(song);
    expect(onClose).toHaveBeenCalledOnce();

    // 写入失败：不抛错、不提示
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    toggle.mockRejectedValueOnce(new Error("quota"));
    await act(async () => {
      option("收藏").click();
      await Promise.resolve();
    });
    expect(show).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("选集：交给外层的钻取", async () => {
    const { onSelectEpisodes } = await mount(
      multiVideo,
      {},
      multiVideo.multiPage,
    );
    await act(async () => {
      option("选集").click();
    });
    expect(onSelectEpisodes).toHaveBeenCalledOnce();
  });
});

describe("收起", () => {
  it("点操作条外收起；点条目内部不冒泡", async () => {
    const { onClose } = await mount(song);
    await act(async () => {
      sheet()!.click();
    });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      host.querySelector<HTMLElement>("[data-imw-action-sheet]")!.click();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Esc 只关操作条（离开层级栈的一层）", async () => {
    const { onClose } = await mount(song);
    await pressEscape();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("焦点", () => {
  it("打开后焦点在「点播到房间」，Tab / Shift+Tab 在浮层内首尾循环", async () => {
    await mount(song);
    const primary = option("点播到房间");
    const last = option("收藏");
    expect(document.activeElement).toBe(primary);

    last.focus();
    await pressTab();
    expect(document.activeElement).toBe(primary);

    primary.focus();
    await pressTab(true);
    expect(document.activeElement).toBe(last);
  });

  it("关闭后归还触发元素；触发元素不可聚焦时取内部第一个可聚焦后代", async () => {
    const trigger = document.createElement("div");
    const inner = document.createElement("button");
    inner.textContent = "点播";
    trigger.append(inner);
    // 触发器挂在结果区里（不是操作条内部），卸载操作条不会带走它
    document.body.append(trigger);

    try {
      await mount(song, { returnFocus: trigger });
      expect(document.activeElement).not.toBe(inner);

      render(null, host);
      expect(document.activeElement).toBe(inner);
    } finally {
      trigger.remove();
    }
  });
});

describe("触控目标与零裸值", () => {
  it("选项整行 ≥44px", async () => {
    await mount(song);
    for (const label of ["点播到房间", "收藏"]) {
      expect(option(label).getAttribute("class")).toContain("min-h-[44px]");
    }
  });

  it("渲染结果不含 themed / accentVar / 裸色值与 rgba，无 emoji 与宿站 mdi 类", async () => {
    await mount(song);
    const dump = Array.from(host.querySelectorAll("*"))
      .map((el) => el.getAttribute("class") ?? "")
      .join(" ");
    expect(dump).not.toMatch(/rgba\(|themed|accentVar|mdi-/);
    expect(dump).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it("源码零裸值：颜色只来自 tokens.ts", () => {
    expect(actionSheetSrc.match(/#[0-9a-fA-F]{3,8}/g) ?? "无裸色值").toBe(
      "无裸色值",
    );
    expect(actionSheetSrc).not.toMatch(/rgba\(|themed|accentVar|mdi-/);
    expect(actionSheetSrc).not.toMatch(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    );
  });
});
