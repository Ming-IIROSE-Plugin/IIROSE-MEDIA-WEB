import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IIROSEUtils } from "./IIROSEUtils";
import utilsSource from "./IIROSEUtils.ts?raw";

// 选集改用插件自有面板（story 5）后，`buildSelect2` 只剩透传：设置 / 关于的取值类
// 单选照旧，但 `multiSelect=true` 时不再接管宿站选项、也不再插吸底确定钮。
// 有序多选的接管代码（`selectedQueue` / 序号徽章 / 确定钮 `onclick`）已整体删除。

const options: (string | number)[][] = [
  [1, "甲", "<div></div>"],
  [2, "乙", "<div></div>"],
];

/** 宿站 `Utils` 的真实类型在 `Global.ts` 里声明；这里只借用 `buildSelect2`。 */
type HostUtils = { buildSelect2?: (...args: unknown[]) => void };
const hostWindow = () => window as unknown as { Utils?: HostUtils };

let host: ReturnType<typeof vi.fn>;

beforeEach(() => {
  host = vi.fn();
  hostWindow().Utils = {
    buildSelect2: host as unknown as HostUtils["buildSelect2"],
  };
});

afterEach(() => {
  delete hostWindow().Utils;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("buildSelect2 透传", () => {
  it("原样把九个参数交给宿站", () => {
    const cb = () => {};
    const enterCB = () => {};
    IIROSEUtils.buildSelect2(
      null,
      options,
      cb,
      false,
      true,
      null,
      false,
      null,
      enterCB,
    );

    expect(host).toHaveBeenCalledWith(
      null,
      options,
      cb,
      false,
      true,
      null,
      false,
      null,
      enterCB,
    );
  });

  it("multiSelect=true 也不再接管：不排定时器、不改宿站 DOM", () => {
    vi.useFakeTimers();
    const box = document.createElement("div");
    box.id = "selectHolderBox";
    const item = document.createElement("div");
    item.className = "selectHolderBoxItem";
    item.innerHTML = '<div class="fullBox whoisTouch3"><span></span></div>';
    box.append(item, item.cloneNode(true));
    document.body.append(box);

    try {
      IIROSEUtils.buildSelect2(
        null,
        options,
        () => {},
        false,
        true,
        null,
        true,
        null,
        () => {},
      );
      // 透传给宿站的仍是 multiSelect=true（宿站自身行为不变）
      expect(host.mock.lastCall?.[6]).toBe(true);
      // 没有 setTimeout(0) 的接管补丁：一个定时器都不该有
      expect(vi.getTimerCount()).toBe(0);

      const first = box.querySelector<HTMLElement>(".selectHolderBoxItem")!;
      expect(first.style.position).toBe("");
      expect(first.getAttribute("onclick")).toBeNull();
      first.click();
      expect(first.style.backgroundColor).toBe("");
    } finally {
      box.remove();
    }
  });

  it("宿站没有 Utils 时静默返回", () => {
    delete hostWindow().Utils;
    expect(() =>
      IIROSEUtils.buildSelect2(
        null,
        options,
        () => {},
        false,
        true,
        null,
        false,
        null,
        () => {},
      ),
    ).not.toThrow();
  });
});

describe("存量已删除", () => {
  it("接管代码与 generatePicHtml 都不在了", () => {
    expect(IIROSEUtils).not.toHaveProperty("generatePicHtml");
    expect(utilsSource).not.toMatch(/const selectedQueue/);
    expect(utilsSource).not.toMatch(/const updateVisuals/);
    expect(utilsSource).not.toMatch(/setTimeout\(/);
    expect(utilsSource).not.toMatch(/mdi-/);
    expect(utilsSource).not.toMatch(/public static generatePicHtml/);
  });
});
