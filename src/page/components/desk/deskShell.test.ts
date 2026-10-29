import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, render } from "preact";
import * as tokens from "../floating-panel/tokens";
import { DeskIcon } from "../floating-panel/tokens";
import { DeskNavigation } from "./DeskNavigation";
import { PageHeader } from "./PageHeader";

let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  render(null, host);
  host.remove();
});

/** 渲染产生的每个节点的 class（SVG 的 className 不是字符串，统一取属性）。 */
const classes = () =>
  Array.from(host.querySelectorAll("*"))
    .map((el) => el.getAttribute("class") ?? "")
    .join(" ");

describe("外观令牌成对", () => {
  it("颜色类串都带 imw-dark: 成对（不随主题变化的两个除外）", () => {
    const singleTheme = new Set<string>([
      "deskOnRose", // on-rose：白字
      "deskOnRoseFill", // on-rose 实色：时长胶囊上的白音柱
      "deskDurationPill", // 视频时长胶囊底（半透明黑，两套主题同值）
      "deskVideoScrim", // 视频悬停遮罩（两套主题同值）
      "deskSearchShadow", // 搜索栏几乎不可见的抬升线
    ]);
    for (const [name, value] of Object.entries(tokens)) {
      if (typeof value !== "string") continue;
      if (singleTheme.has(name)) continue;
      const isColor =
        /(bg|text|border|caret|outline|shadow|placeholder:text)-\[#/.test(
          value,
        );
      if (!isColor) continue;
      expect(`${name}: ${value}`).toContain("imw-dark:");
    }
  });

  it("品牌强调色与旧主题令牌已退役", () => {
    expect(tokens).not.toHaveProperty("accentVar");
    for (const value of Object.values(tokens))
      if (typeof value === "string") {
        expect(value).not.toContain("--imw-accent");
        expect(value).not.toContain("themed");
      }
  });

  it("焦点环 = 2px 外圈 + 2px 间隔，实底另有 paper 内环", () => {
    expect(tokens.deskFocusRing).toContain("focus-visible:outline-2");
    expect(tokens.deskFocusRing).toContain("focus-visible:outline-offset-2");
    expect(tokens.deskFocusRingOnRose).toContain("inset_0_0_0_2px");
  });

  it("图标自包含：currentColor 着色、无 emoji、无宿站 mdi 类", () => {
    render(h(DeskIcon, { name: "note", size: 22 }), host);
    const svg = host.querySelector("svg")!;
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector("path")).not.toBeNull();
  });
});

describe("竖栏 / 底部标签栏", () => {
  const rail = () => host.querySelectorAll("nav")[0];
  const tabs = () => host.querySelectorAll("nav")[1];
  const labels = (nav: Element) =>
    Array.from(nav.querySelectorAll("button")).map((el) =>
      (el.textContent ?? "").trim(),
    );

  it("桌面竖栏六项：音乐/视频/电台/收藏 + 设置/关于", () => {
    render(h(DeskNavigation, { mode: 0, onSelectMode: () => {} }), host);
    expect(Array.from(rail().querySelectorAll("button"))).toHaveLength(6);
    expect(labels(rail())).toEqual([
      "音乐",
      "视频",
      "电台",
      "收藏",
      "设置",
      "关于",
    ]);
    // 手机标签栏五项，关于并入设置
    expect(labels(tabs())).toEqual(["音乐", "视频", "电台", "收藏", "设置"]);
  });

  it("aria-current 只落在当前模式；手机端停在关于时设置标签仍算当前", () => {
    render(h(DeskNavigation, { mode: 2, onSelectMode: () => {} }), host);
    const current = Array.from(
      rail().querySelectorAll('[aria-current="page"]'),
    );
    expect(current.map((el) => el.textContent?.trim())).toEqual(["电台"]);
    expect(rail().querySelectorAll('[aria-current="page"]')).toHaveLength(1);

    render(h(DeskNavigation, { mode: 5, onSelectMode: () => {} }), host);
    const tabCurrent = Array.from(
      tabs().querySelectorAll('[aria-current="page"]'),
    );
    expect(tabCurrent.map((el) => el.textContent?.trim())).toEqual(["设置"]);
  });

  it("单击即切换模式", () => {
    const onSelectMode = vi.fn();
    render(h(DeskNavigation, { mode: 0, onSelectMode }), host);
    (rail().querySelectorAll("button")[3] as HTMLButtonElement).click();
    expect(onSelectMode).toHaveBeenCalledWith(3);
    (tabs().querySelectorAll("button")[4] as HTMLButtonElement).click();
    expect(onSelectMode).toHaveBeenCalledWith(4);
  });

  it("手机可点区 ≥44px，断点用 max-[768px]", () => {
    render(h(DeskNavigation, { mode: 0, onSelectMode: () => {} }), host);
    for (const button of Array.from(tabs().querySelectorAll("button"))) {
      const cls = button.getAttribute("class") ?? "";
      expect(cls).toContain("min-h-[44px]");
      expect(cls).toContain("min-w-[44px]");
    }
    expect(tabs().getAttribute("class")).toContain("max-[768px]:grid");
  });

  it("品牌标是纯标识：不可聚焦、无操作", () => {
    render(h(DeskNavigation, { mode: 0, onSelectMode: () => {} }), host);
    const mark = rail().querySelector('[aria-hidden="true"]')!;
    expect(mark.tagName).not.toBe("BUTTON");
  });
});

describe("页头", () => {
  it("眉题 + 宋体模式名 + 描边关闭钮", () => {
    const onClose = vi.fn();
    render(h(PageHeader, { title: "点歌台", onClose }), host);
    expect(host.querySelector("h1")!.textContent).toBe("点歌台");
    expect(host.textContent).toContain("IIROSE · Media Desk");
    expect(host.textContent).toContain("Media Desk");
    const title = host.querySelector("h1")!.getAttribute("class")!;
    expect(title).toContain("Songti_SC");
    const close = host.querySelector('[aria-label="关闭点歌台"]')!;
    expect(close.getAttribute("class")).toContain("w-10");
    (close as HTMLButtonElement).click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("外壳组件零裸值", () => {
  it("渲染结果里没有 themed* / accentVar / rgba", () => {
    render(
      h("div", {}, [
        h(PageHeader, { title: "点歌台", onClose: () => {} }),
        h(DeskNavigation, { mode: 1, onSelectMode: () => {} }),
      ]),
      host,
    );
    const dump = classes();
    expect(dump).not.toMatch(/rgba\(|themed|accentVar/);
  });

  it("源码里不出现裸颜色值（颜色只来自 tokens.ts）", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "src", "page", "components", "desk");
    const files = (readdirSync(dir) as string[]).filter(
      (name) =>
        name.endsWith(".tsx") ||
        (name.endsWith(".ts") && !name.endsWith(".test.ts")),
    );
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const name of files) {
      const source = readFileSync(join(dir, name), "utf8");
      expect(
        `${name}: ${source.match(/#[0-9a-fA-F]{3,8}/g) ?? "无裸色值"}`,
      ).toBe(`${name}: 无裸色值`);
      expect(source).not.toMatch(/rgba\(|themed|accentVar/);
    }
  });
});
