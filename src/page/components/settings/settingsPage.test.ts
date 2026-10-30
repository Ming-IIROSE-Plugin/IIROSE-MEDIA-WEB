import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, render, type ComponentChild } from "preact";
import { act } from "preact/test-utils";
import * as tokens from "../floating-panel/tokens";
import { AboutCard, SettingsGroup } from "./SettingsGroup";
import { SettingsSwitch } from "./SettingsSwitch";
import settingsGroupSrc from "./SettingsGroup.tsx?raw";
import settingsRowSrc from "./SettingsRow.tsx?raw";
import settingsSwitchSrc from "./SettingsSwitch.tsx?raw";
import resultsAreaSrc from "../media-card-container/ResultsArea.tsx?raw";

// 设置 / 关于页（CAP-11，story 7）：组卡 → 行，行语义由数据声明（kind），
// 渲染层只做四种分支；令牌只从 tokens.ts 来，图标自包含、零 emoji。
let host: HTMLDivElement;

const classesOf = (el: Element) =>
  (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
const allClasses = () =>
  Array.from(host.querySelectorAll("*"))
    .map((el) => el.getAttribute("class") ?? "")
    .join(" ");

const row = (kind: string) =>
  host.querySelector(`[data-imw-settings-row="${kind}"]`) as HTMLElement;

const item = (overrides: Partial<SettingData> = {}): SettingData => ({
  key: "preset",
  title: "测试项",
  actionTitle: "1080P",
  icon: "film",
  action: () => {},
  ...overrides,
});

const group = (items: SettingData[], title = "视频设置"): SettingGroupData => ({
  title,
  items,
});

/** 挂载并把行内的数据同步 effect 冲干净（先冲挂载 effect，再看交互结果）。 */
const draw = async (node: ComponentChild) => {
  await act(async () => {
    render(node, host);
  });
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  render(null, host);
  host.remove();
});

describe("设置组卡", () => {
  it("组名在卡片上方：label-strong + ink2；卡是 sheet 底 + 细线描边 + lg 圆角", async () => {
    await draw(h(SettingsGroup, { group: group([item()]) }));
    const section = host.querySelector("[data-imw-settings-group]")!;
    expect(section.getAttribute("data-imw-settings-group")).toBe("视频设置");
    const title = section.querySelector("h2")!;
    expect(title.textContent).toBe("视频设置");
    expect(classesOf(title)).toEqual(
      expect.arrayContaining([
        ...tokens.typeLabelStrong.split(" "),
        ...tokens.deskInk2.split(" "),
      ]),
    );

    const card = section.querySelector("div")!;
    expect(classesOf(card)).toEqual(
      expect.arrayContaining([
        ...tokens.deskSheet.split(" "),
        ...tokens.deskRule.split(" "),
        ...tokens.roundedLg.split(" "),
        "border",
        "overflow-hidden",
      ]),
    );
  });

  it("卡内每行一张设置行，行间 1px 细线、末行无", async () => {
    await draw(
      h(SettingsGroup, {
        group: group([item({ key: "a" }), item({ key: "b" })]),
      }),
    );
    const rows = Array.from(
      host.querySelectorAll("[data-imw-settings-row]"),
    ) as HTMLElement[];
    expect(rows).toHaveLength(2);
    expect(classesOf(rows[0])).toEqual(
      expect.arrayContaining(["border-b", ...tokens.deskRule.split(" ")]),
    );
    // 末行不画底线（卡片的圆角由卡自己收口）
    expect(classesOf(rows[1])).not.toContain("border-b");
  });

  it("行高 ≥56px（手机 ≥44px），左右内边距 16px", async () => {
    await draw(h(SettingsGroup, { group: group([item()]) }));
    expect(classesOf(row("value"))).toEqual(
      expect.arrayContaining(["min-h-[56px]", "max-[768px]:min-h-11", "px-4"]),
    );
  });
});

describe("值行", () => {
  it("标签 + 当前值 + 右向 chev，整行可点并回报新值（无「保存」）", async () => {
    const action = vi.fn((report?: (title?: string) => void) => report?.("4K"));
    await draw(h(SettingsGroup, { group: group([item({ action })]) }));
    const el = row("value");
    expect(el.tagName).toBe("BUTTON");
    expect(el.textContent).toContain("测试项");
    expect(el.textContent).toContain("1080P");
    // 行图标 + chev 两个自包含 SVG
    expect(el.querySelectorAll("svg")).toHaveLength(2);

    await act(async () => el.click());
    expect(action).toHaveBeenCalledOnce();
    expect(el.textContent).toContain("4K");
  });

  it("父级重建数据时值跟着数据走", async () => {
    await draw(h(SettingsGroup, { group: group([item()]) }));
    expect(row("value").textContent).toContain("1080P");
    await draw(
      h(SettingsGroup, { group: group([item({ actionTitle: "720P" })]) }),
    );
    expect(row("value").textContent).toContain("720P");
  });
});

describe("动作行与只读行", () => {
  it("动作行显示现有状态文字、无 chev，点整行执行既有动作", async () => {
    const action = vi.fn();
    await draw(
      h(SettingsGroup, {
        group: group([
          item({ key: "now", title: "立即同步", kind: "action", action }),
        ]),
      }),
    );
    const el = row("action");
    expect(el.tagName).toBe("BUTTON");
    expect(el.querySelectorAll("svg")).toHaveLength(1); // 只有行图标，没有 chev
    await act(async () => el.click());
    expect(action).toHaveBeenCalledOnce();
  });

  it("只读行：静态行、无 chev、不可聚焦、点击无动作", async () => {
    await draw(
      h(SettingsGroup, {
        group: group([
          item({
            key: "last",
            title: "上次同步时间",
            kind: "readonly",
            actionTitle: "从未同步",
            icon: "clock",
          }),
        ]),
      }),
    );
    const el = row("readonly");
    expect(el.tagName).toBe("DIV");
    expect(el.querySelectorAll("button")).toHaveLength(0);
    expect(el.querySelectorAll("svg")).toHaveLength(1);
    expect(el.hasAttribute("tabindex")).toBe(false);
    expect(el.hasAttribute("role")).toBe(false);
    expect(el.textContent).toContain("从未同步");
    await act(async () => el.click());
    expect(host.querySelector("[data-imw-settings-row]")).toBe(el);
  });
});

describe("开关行", () => {
  it("整行即 role=switch：aria-checked 随 checked，回报新值后翻转", async () => {
    const action = vi.fn((report?: (t?: string, checked?: boolean) => void) =>
      report?.(undefined, true),
    );
    await draw(
      h(SettingsGroup, {
        group: group([
          item({
            key: "proxy",
            title: "代理蔷薇@输入",
            kind: "switch",
            checked: false,
            actionTitle: undefined,
            icon: "at",
            action,
          }),
        ]),
      }),
    );
    const el = row("switch");
    expect(el.tagName).toBe("BUTTON");
    expect(el.getAttribute("role")).toBe("switch");
    expect(el.getAttribute("aria-checked")).toBe("false");
    expect(
      host.querySelector('[data-imw-settings-switch="off"]'),
    ).not.toBeNull();

    await act(async () => el.click());
    expect(action).toHaveBeenCalledOnce();
    expect(el.getAttribute("aria-checked")).toBe("true");
    expect(
      host.querySelector('[data-imw-settings-switch="on"]'),
    ).not.toBeNull();
  });

  it("动作未回报时保持关：点「云端同步」不会自说自话点亮", async () => {
    await draw(
      h(SettingsGroup, {
        group: group([
          item({
            key: "syncEnabled",
            title: "云端同步",
            kind: "switch",
            checked: false,
            actionTitle: undefined,
            icon: "cloud",
            action: () => {},
          }),
        ]),
      }),
    );
    const el = row("switch");
    await act(async () => el.click());
    expect(el.getAttribute("aria-checked")).toBe("false");
  });

  it("开关视觉：36×20 圆角full 轨道 + 14px 圆钮，开态蔷薇红实底", async () => {
    await draw(h(SettingsSwitch, { checked: false }));
    const off = host.querySelector('[data-imw-settings-switch="off"]')!;
    expect(classesOf(off)).toEqual(
      expect.arrayContaining([
        "h-5",
        "w-9",
        "rounded-full",
        "border-[1.5px]",
        ...tokens.deskInk3Border.split(" "),
      ]),
    );
    const offKnob = off.firstElementChild as HTMLElement;
    expect(offKnob.getAttribute("class")).toContain("h-[14px]");
    expect(offKnob.getAttribute("class")).toContain(
      tokens.deskInk3Fill.split(" ")[0],
    );

    render(null, host);
    await draw(h(SettingsSwitch, { checked: true }));
    const on = host.querySelector('[data-imw-settings-switch="on"]')!;
    expect(classesOf(on)).toEqual(
      expect.arrayContaining(tokens.deskRoseSolid.split(" ")),
    );
    expect(
      (on.firstElementChild as HTMLElement).getAttribute("class"),
    ).toContain(tokens.deskOnRoseFill.split(" ")[0]);
  });
});

describe("关于卡与外链行", () => {
  it("外链行：值位蔷薇红 + 外链图标（不是右向 chev）", async () => {
    await draw(
      h(SettingsGroup, {
        group: group([
          item({
            key: "aboutSource",
            title: "项目源代码地址",
            actionTitle: "GitHub",
            external: true,
            icon: "github",
          }),
        ]),
      }),
    );
    const el = row("value");
    const value = Array.from(el.querySelectorAll("span")).find(
      (span) => span.textContent === "GitHub",
    )!;
    expect(classesOf(value)).toEqual(
      expect.arrayContaining(tokens.deskRose.split(" ")),
    );
    // 两个 SVG：github 行图标 + 外链图标
    const icons = Array.from(el.querySelectorAll("svg"));
    expect(icons).toHaveLength(2);
    expect(icons[1].getAttribute("class")).toContain(
      tokens.deskRose.split(" ")[0],
    );
    expect(el.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("关于卡：每行都按数据里的行语义渲染，没有组名标题", async () => {
    await draw(
      h(AboutCard, {
        items: [
          item({ key: "aboutAuthor", title: "作者", actionTitle: "铭" }),
          item({
            key: "aboutDonate",
            title: "投喂我",
            actionTitle: "投喂",
            icon: "coffee",
          }),
        ],
      }),
    );
    const card = host.querySelector("[data-imw-about-card]")!;
    expect(card.querySelector("h2")).toBeNull();
    expect(host.querySelectorAll("[data-imw-settings-row]")).toHaveLength(2);
    expect(classesOf(card)).toEqual(
      expect.arrayContaining([
        ...tokens.deskSheet.split(" "),
        ...tokens.roundedLg.split(" "),
      ]),
    );
  });
});

describe("令牌纪律", () => {
  it("渲染结果里没有 themed / accentVar / rgba / mdi- 字形", async () => {
    await draw(
      h(SettingsGroup, {
        group: group([
          item({ key: "a" }),
          item({ key: "b", kind: "action", icon: "trash" }),
          item({ key: "c", kind: "readonly", icon: "clock" }),
          item({ key: "d", kind: "switch", checked: true, icon: "cloud" }),
        ]),
      }),
    );
    const rendered = `${allClasses()} ${host.innerHTML}`;
    expect(rendered).not.toContain("themed");
    expect(rendered).not.toContain("accentVar");
    expect(rendered).not.toContain("rgba(");
    expect(rendered).not.toContain("mdi-");
    // 悬停效果一律在 hov: 门控下（触屏不触发、不残留）
    for (const cls of allClasses()
      .split(/\s+/)
      .filter((c) => c.includes("hover:")))
      expect(cls).toContain("hov:");
  });

  it("组件源码不出现 rgba( / themed / accentVar / mdi- / emoji", () => {
    const sources: Record<string, string> = {
      "SettingsGroup.tsx": settingsGroupSrc,
      "SettingsRow.tsx": settingsRowSrc,
      "SettingsSwitch.tsx": settingsSwitchSrc,
      "ResultsArea.tsx": resultsAreaSrc,
    };
    for (const [name, source] of Object.entries(sources)) {
      expect(`${name} themed: ${/themed|accentVar/.test(source)}`).toBe(
        `${name} themed: false`,
      );
      expect(`${name} rgba: ${/rgba\(/.test(source)}`).toBe(
        `${name} rgba: false`,
      );
      expect(`${name} mdi: ${/mdi-/.test(source)}`).toBe(`${name} mdi: false`);
      expect(
        `${name} emoji: ${/\p{Extended_Pictographic}/u.test(source)}`,
      ).toBe(`${name} emoji: false`);
    }
  });

  it("设置行图标都在 DeskIcon 的 symbol 表里（零 mdi 字形、零 emoji）", () => {
    for (const name of [
      "user",
      "users",
      "film",
      "signal",
      "clock",
      "wrench",
      "code",
      "note",
      "radio",
      "layout",
      "list",
      "send",
      "at",
      "cloud",
      "key",
      "refresh",
      "trash",
      "coffee",
      "github",
      "external",
    ] as const) {
      render(null, host);
      render(h(tokens.DeskIcon, { name }), host);
      expect(host.querySelector("svg")).not.toBeNull();
    }
  });
});
