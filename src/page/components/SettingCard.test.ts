import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { SettingCard } from "./SettingCard";
import {
  accentText,
  mutedText,
  pressTone,
  themedCard,
  themedDividerBottom,
} from "./floating-panel/floatingPanel";

// 设置/关于卡（spec-main-panel-visual-unify story 3）：与结果卡片同一表面令牌，
// 图标与当前值用强调色 ink，动作区整块可点、悬停/按压淡强调，行为不变。
let host: HTMLDivElement;
const classesOf = (el: Element) => el.className.split(/\s+/);
const expectAll = (el: Element, token: string) => {
  for (const c of token.split(" ")) expect(classesOf(el)).toContain(c);
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  render(null, host);
  host.remove();
});

const item = (overrides: Partial<SettingData> = {}): SettingData => ({
  key: "test",
  title: "测试项",
  actionTitle: "已关闭",
  icon: "mdi-at",
  action: () => {},
  ...overrides,
});

describe("SettingCard", () => {
  it("卡片用主题表面令牌，尺寸不变，无硬编码浅色", () => {
    render(h(SettingCard, { settingsData: item() }), host);
    const card = host.firstElementChild!;
    expectAll(card, themedCard);
    expect(classesOf(card)).toEqual(
      expect.arrayContaining(["h-[200px]", "m-[12px]", "rounded-xl"]),
    );
    expect(host.innerHTML).not.toMatch(
      /#424242|bg-white\/50|bg-\[rgba|text-\[rgba|backdrop-blur/,
    );
    expect(host.querySelectorAll("[style]")).toHaveLength(0);
  });

  it("标题区：强调色图标 + 次要色标题 + 主题分隔线", () => {
    render(h(SettingCard, { settingsData: item() }), host);
    const head = host.querySelector(".commonBoxHead")!;
    expectAll(head, themedDividerBottom);
    // commonBoxHead 是宿站类：夜间主题会改它的色与底，覆盖必须强制（见 ad03018）。
    expect(classesOf(head)).toEqual(
      expect.arrayContaining(["text-inherit!", "bg-transparent!", "border-0!"]),
    );
    const [icon, title] = Array.from(head.children);
    expect(classesOf(icon)).toEqual(
      expect.arrayContaining(["mdi-at", "font-md"]),
    );
    expectAll(icon, accentText);
    expect(title.textContent).toBe("测试项");
    expectAll(title, mutedText);
  });

  it("动作区整块可点、悬停/按压淡强调，当前值强调色；点击后状态文字更新", async () => {
    const action = vi.fn((done?: (t?: string) => void) => done?.("已开启"));
    render(h(SettingCard, { settingsData: item({ action }) }), host);
    const area = host.querySelector(".IMW-SettingCard-Action") as HTMLElement;
    expectAll(area, pressTone);
    expectAll(area, accentText);
    expect(classesOf(area)).toEqual(
      expect.arrayContaining(["h-[50%]", "cursor-pointer", "duration-100!"]),
    );
    expect(area.textContent).toBe("已关闭");
    await act(async () => {
      area.click();
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(area.textContent).toBe("已开启");
  });

  it("mdi 动作标题渲染为字体图标", () => {
    render(
      h(SettingCard, { settingsData: item({ actionTitle: "mdi-music" }) }),
      host,
    );
    const glyph = host.querySelector(".IMW-SettingCard-Action > div")!;
    expect(classesOf(glyph)).toEqual(
      expect.arrayContaining(["mdi-music", "font-md", "whoisTouch2"]),
    );
  });

  it("动作回调不带标题时不报错，动作区照常渲染", async () => {
    const action = vi.fn((done?: (t?: string) => void) => done?.());
    render(h(SettingCard, { settingsData: item({ action }) }), host);
    const area = host.querySelector(".IMW-SettingCard-Action") as HTMLElement;
    await act(async () => area.click());
    expect(host.querySelector(".IMW-SettingCard-Action")).not.toBeNull();
  });
});
