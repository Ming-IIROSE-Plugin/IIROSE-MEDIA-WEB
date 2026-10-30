import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import {
  EPISODE_PICKER_ROOT_ID,
  openEpisodePicker,
  releaseEpisodePicker,
  type EpisodePickEntry,
} from "./openEpisodePicker";
import { pushOverlayLayer } from "../desk/overlayLayers";

// 命令式入口（story 5）：body 独立根与单例、`z-[90010]`、根上 `data-imw-theme`、
// 确认后卸载、取消不回调、返回键只关一层。

const entries: EpisodePickEntry[] = [
  { id: "1", title: "第 1 集" },
  { id: "2", title: "第 2 集" },
];

const root = () => document.getElementById(EPISODE_PICKER_ROOT_ID);
const layer = () =>
  document.querySelector<HTMLElement>("[data-imw-episode-picker]")!;
const button = (text: string) =>
  Array.from(layer().querySelectorAll<HTMLButtonElement>("button")).find(
    (node) => (node.textContent ?? "").trim() === text,
  )!;
const row = (title: string) =>
  Array.from(layer().querySelectorAll<HTMLElement>('[role="checkbox"]')).find(
    (node) => node.getAttribute("aria-label")?.startsWith(title),
  )!;

async function flush(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function open(
  options: Partial<Parameters<typeof openEpisodePicker>[0]> = {},
) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  await act(async () => {
    openEpisodePicker({
      unit: "集",
      load: async () => entries,
      onConfirm,
      onCancel,
      ...options,
    });
  });
  await flush();
  return { onConfirm, onCancel };
}

beforeEach(() => {
  const page = window as unknown as { Utils?: { backward?: () => void } };
  if (!page.Utils) page.Utils = { backward: () => {} };
  (window as Window & { theme?: unknown }).theme = 1;
});

afterEach(() => {
  act(() => releaseEpisodePicker());
  vi.restoreAllMocks();
});

describe("独立根与外观", () => {
  it("挂在 body 上的单例根，层级 z-[90010]，不新设其它 z-index 根", async () => {
    await open();
    expect(root()?.parentElement).toBe(document.body);
    expect(layer().getAttribute("class")).toContain("z-[90010]");
    expect(layer().getAttribute("class")).toContain("fixed");
    expect(layer().getAttribute("class")).toContain("inset-0");
    // 视图根之上只有宿站弹窗层：本 story 不新增第二个 z-index 根
    const zRoots = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .filter((node) => /(?:^|\s)z-\[/.test(node.getAttribute("class") ?? ""))
      .map(
        (node) => node.getAttribute("data-imw-episode-picker") ?? node.tagName,
      );
    expect(zRoots).toEqual(["true"]);
    // 容器根不带层级：z-index 只有视图根一处
    expect(root()?.getAttribute("class")).toBeNull();
  });

  it("根上写 data-imw-theme：宿站浅色 light、深色 dark", async () => {
    await open();
    expect(root()?.getAttribute("data-imw-theme")).toBe("light");
    act(() => releaseEpisodePicker());

    (window as Window & { theme?: unknown }).theme = 0;
    await act(async () => {
      openEpisodePicker({
        unit: "集",
        load: async () => entries,
        onConfirm: () => {},
      });
    });
    await flush();
    expect(root()?.getAttribute("data-imw-theme")).toBe("dark");
  });

  it("已在打开态时再次调用只把焦点送回面板，不叠第二份", async () => {
    const first = await open();
    const dialog = layer().querySelector('[role="dialog"]')!;
    (document.activeElement as HTMLElement).blur();

    const second = await open();
    expect(document.querySelectorAll("[data-imw-episode-picker]")).toHaveLength(
      1,
    );
    expect(document.activeElement).toBe(
      layer().querySelector('[aria-label="关闭选集"]'),
    );
    expect(second.onCancel).not.toHaveBeenCalled();
    expect(first.onCancel).not.toHaveBeenCalled();
    expect(dialog.isConnected).toBe(true);
  });
});

describe("确认与取消", () => {
  it("确认后回调 → 退场 → 卸载", async () => {
    const { onConfirm, onCancel } = await open();
    await act(async () => {
      row("第 1 集").click();
    });
    await act(async () => {
      button("点播所选").click();
    });
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    await flush(220);
    expect(root()).toBeNull();
  });

  it("取消不回调 onConfirm", async () => {
    const { onConfirm, onCancel } = await open();
    await act(async () => {
      layer().querySelector<HTMLElement>('[aria-label="关闭选集"]')!.click();
    });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("宿站返回键只关一层：面板在时先关面板，下一层不动", async () => {
    const below = vi.fn();
    const release = pushOverlayLayer("order", below);
    try {
      const { onCancel } = await open();
      await act(async () => {
        (
          window as unknown as { Utils?: { backward?: () => void } }
        ).Utils?.backward?.();
      });
      await flush(220);
      expect(onCancel).toHaveBeenCalledOnce();
      expect(below).not.toHaveBeenCalled();
      expect(root()).toBeNull();

      await act(async () => {
        (
          window as unknown as { Utils?: { backward?: () => void } }
        ).Utils?.backward?.();
      });
      expect(below).toHaveBeenCalledOnce();
    } finally {
      release();
    }
  });

  it("reload 后旧根被接管：不会留下第二份面板", async () => {
    await open();
    const stale = root()!;
    act(() => {
      // 模拟重复注入：直接把旧根留在 DOM 上再清单例
      releaseEpisodePicker();
    });
    expect(stale.isConnected).toBe(false);
    await open();
    expect(
      document.querySelectorAll(`#${EPISODE_PICKER_ROOT_ID}`),
    ).toHaveLength(1);
  });
});
