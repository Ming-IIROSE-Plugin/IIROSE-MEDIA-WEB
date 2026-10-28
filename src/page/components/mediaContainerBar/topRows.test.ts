import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, render } from "preact";
import { MediaSearchBar } from "./MediaSearchBar";
import { PlatformSelector } from "./PlatformSelector";
import { MediaContainerSubNavBar } from "./MediaContainerSubNavBar";
import { MainNavigationBar } from "../navigationBar/main/MainNavigationBar";
import { themedSurface } from "../floating-panel/floatingPanel";

// 顶部四行的外观约定（spec-main-panel-visual-unify story 1）：
// 选中为强调色（--imw-accent 填充 / --imw-accent-ink 文字：浅色品牌色、深色天蓝）、无平台品牌色整条底、相连分段、各行尺寸类不变。
let host: HTMLDivElement;
const noop = () => {};
const classesOf = (el: Element) => el.className.split(/\s+/);

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  render(null, host);
  host.remove();
});

const brandBackground = () =>
  Array.from(host.querySelectorAll<HTMLElement>("*")).filter(
    (el) => el.style.backgroundColor !== "",
  );

describe("Row1 导航", () => {
  it("选中项强调色，未选中继承正文色，按钮尺寸不变", () => {
    render(
      h(MainNavigationBar, {
        switchCategories: noop,
        ShowHideMainApp: noop,
        activeButtonIndex: 1,
      }),
      host,
    );
    const music = host.querySelector('[title="音乐"]')!;
    const video = host.querySelector('[title="视频"]')!;
    expect(classesOf(video)).toContain("text-(color:--imw-accent-ink)");
    expect(classesOf(music)).toContain("text-inherit");
    expect(classesOf(music)).not.toContain("text-(color:--imw-accent-ink)");
    for (const el of [music, video]) {
      expect(classesOf(el)).toContain("max-[768px]:h-[44px]");
      expect(classesOf(el)).toContain("max-[768px]:w-[44px]");
      expect(el.className).not.toMatch(/text-white|bg-\[#/);
    }
    expect(host.querySelector("#NavBarTitle")!.className).not.toMatch(
      /bg-white|text-white/,
    );
    // 行底分隔线浅/深两套
    expect(classesOf(host.firstElementChild!)).toEqual(
      expect.arrayContaining([
        "shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]",
        "imw-dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.15)]",
      ]),
    );
  });
});

describe("主面板表面令牌", () => {
  it("浅色柔灰底 + 顶部光晕、深色中性底，与 visual-language.md 一致", () => {
    expect(themedSurface.split(" ")).toEqual(
      expect.arrayContaining([
        "bg-[#eef1f6]",
        "text-[#253047]",
        "imw-dark:bg-[#242a34]",
        "imw-dark:bg-none",
        "imw-dark:text-[#f4f6fa]",
      ]),
    );
    // 浅色顶部强调色光晕（深色由 imw-dark:bg-none 去掉）
    expect(themedSurface).toMatch(
      /bg-\[linear-gradient\(180deg,color-mix\(in_oklab,var\(--imw-accent\)_16%/,
    );
  });
});

describe("Row2 工具栏", () => {
  const draw = (favoritesMode: boolean) =>
    render(
      h(MediaSearchBar, {
        searchKeyword: "",
        currentPage: 1,
        totalPage: 3,
        isCurrentInMultiPage: false,
        viewMode: "card",
        favoritesMode,
        mediaSearchBarActions: {
          changeSearchKeyword: noop,
          changecurrentPage: noop,
          switchToOutFromMultiPage: noop,
          toggleSearchViewMode: noop,
          toggleFavoritesMode: noop,
        },
      }),
      host,
    );
  const favorite = () => host.querySelector('[title^="当前:"][title*="收藏"]')!;

  it("收藏开启态强调色，关闭态正文色描边按钮", () => {
    draw(true);
    expect(classesOf(favorite())).toContain("text-(color:--imw-accent-ink)");
    expect(classesOf(favorite())).toContain("border-(color:--imw-accent)");
    expect(classesOf(favorite())).toContain(
      "active:bg-(color:--imw-accent)/15",
    );
    expect(classesOf(favorite())).not.toContain("border-black/10");
    expect(favorite().className).not.toMatch(/fbc02d/);
    draw(false);
    expect(classesOf(favorite())).toContain("text-inherit");
    expect(classesOf(favorite())).toContain("border-black/10");
    expect(classesOf(favorite())).toContain("imw-dark:border-white/15");
    expect(classesOf(favorite())).not.toContain(
      "text-(color:--imw-accent-ink)",
    );
    expect(classesOf(favorite())).toContain("mr-auto");
  });

  it("分页为描边次要按钮，移动端 48×44 不变", () => {
    draw(false);
    for (const title of ["上一页", "下一页"]) {
      const el = host.querySelector(`[title="${title}"]`)!;
      expect(classesOf(el)).toEqual(
        expect.arrayContaining([
          "rounded-lg",
          "border",
          "border-black/10",
          "imw-dark:border-white/15",
          "active:bg-(color:--imw-accent)/15",
          "max-[768px]:w-[48px]",
          "max-[768px]:h-[44px]",
        ]),
      );
      expect(el.className).not.toMatch(/text-white|bg-\[#/);
    }
  });

  it("搜索区为带放大镜的描边输入样式", () => {
    draw(false);
    const search = host.querySelector('[title="点击搜索"]')!;
    expect(classesOf(search)).toEqual(
      expect.arrayContaining([
        "rounded-lg",
        "border",
        "border-black/10",
        "imw-dark:border-white/15",
        "hov:hover:border-(color:--imw-accent)",
        "focus-visible:border-(color:--imw-accent)",
        "active:bg-(color:--imw-accent)/15",
      ]),
    );
    expect(search.querySelector(".inputIcon")).not.toBeNull();
    // 空关键词的占位在 ≤400px 隐藏，避免被裁成省略号
    const label = search.lastElementChild!;
    expect(label.textContent).toBe("搜索");
    expect(classesOf(label)).toEqual(
      expect.arrayContaining(["opacity-65", "max-[400px]:hidden"]),
    );
  });

  it("有关键词时不隐藏、不置灰", () => {
    render(
      h(MediaSearchBar, {
        searchKeyword: "周杰伦",
        currentPage: 1,
        totalPage: 3,
        isCurrentInMultiPage: false,
        viewMode: "card",
        mediaSearchBarActions: {
          changeSearchKeyword: noop,
          changecurrentPage: noop,
          switchToOutFromMultiPage: noop,
          toggleSearchViewMode: noop,
        },
      }),
      host,
    );
    const label = host.querySelector('[title="周杰伦"]')!.lastElementChild!;
    expect(classesOf(label)).not.toContain("max-[400px]:hidden");
    expect(classesOf(label)).not.toContain("opacity-65");
  });
});

const platforms = [
  { title: "甲", iconsrc: "a.png", color: "rgb(221, 28, 4)" },
  { title: "乙", iconsrc: "b.png", color: "rgb(209, 79, 118)" },
  { title: "丙", iconsrc: "c.png", color: "rgb(1, 77, 103)" },
] as unknown as Platform[];

describe("Row3 平台", () => {
  it("相连分段：选中强调色实底白字、首尾圆角、无品牌色底", () => {
    render(
      h(PlatformSelector, {
        platform: platforms,
        switchPlatform: noop,
        isCurrentInMultiPage: false,
        PlatformIndex: 1,
      }),
      host,
    );
    const tabs = Array.from(host.firstElementChild!.children);
    expect(tabs).toHaveLength(3);
    expect(classesOf(tabs[1])).toEqual(
      expect.arrayContaining(["bg-(color:--imw-accent)", "text-white", "h-10"]),
    );
    expect(classesOf(tabs[0])).not.toContain("bg-(color:--imw-accent)");
    expect(classesOf(tabs[0])).toContain("rounded-l-lg");
    expect(classesOf(tabs[2])).toContain("rounded-r-lg");
    // 选中的非首段：描边整圈强调色、盖在相邻段之上（左缘不露出灰色）
    expect(classesOf(tabs[1])).toEqual(
      expect.arrayContaining([
        "border-(color:--imw-accent)",
        "relative",
        "z-[1]",
        "-ml-px",
      ]),
    );
    expect(classesOf(tabs[1])).not.toContain("border-l-0");
    expect(classesOf(tabs[1])).not.toContain("border-black/10");
    expect(classesOf(tabs[0])).toEqual(
      expect.arrayContaining(["border-black/10", "imw-dark:border-white/15"]),
    );
    expect(classesOf(tabs[0])).not.toContain("-ml-px");
    expect(classesOf(host.firstElementChild!)).not.toContain("gap-2");
    expect(host.querySelectorAll("img")).toHaveLength(3);
    expect(brandBackground()).toHaveLength(0);
  });

  it("整个 40px 标签（含描边）都是点击区", () => {
    const switchPlatform = vi.fn();
    render(
      h(PlatformSelector, {
        platform: platforms,
        switchPlatform,
        isCurrentInMultiPage: false,
        PlatformIndex: 0,
      }),
      host,
    );
    const tab = host.firstElementChild!.children[2] as HTMLElement;
    expect(classesOf(tab)).toContain("h-10");
    tab.click();
    expect(switchPlatform).toHaveBeenCalledWith(2);
  });

  it("多 P 页隐藏整行，不在表头留空条", () => {
    render(
      h(PlatformSelector, {
        platform: platforms,
        switchPlatform: noop,
        isCurrentInMultiPage: true,
        PlatformIndex: 0,
      }),
      host,
    );
    const row = host.firstElementChild!;
    expect(classesOf(row)).toContain("hidden");
    expect(classesOf(row)).not.toContain("flex");
    expect(row.children).toHaveLength(0);
  });
});

describe("Row4 分类", () => {
  it("相连分段：选中强调色、尺寸约定不变", () => {
    const platform = {
      ...platforms[0],
      subNavBarItems: [
        { title: "热门", class: "search", searchAction: noop },
        { title: "新歌", class: "search", searchAction: noop },
      ],
    } as unknown as Platform;
    render(
      h(MediaContainerSubNavBar, {
        platform,
        searchKeyword: "",
        categories: { platform: [platform] } as unknown as Categories,
        isCurrentInMultiPage: false,
        PlatformIndex: 0,
        SubNavBarIndex: 0,
        actions: {
          updateSubNavBarIndex: async () => {},
          updateCurrentSubNavBarAction: noop,
        },
      }),
      host,
    );
    const strip = host.querySelector(".subnavbar-mask")!;
    expect(classesOf(strip)).toContain("max-[768px]:h-[36px]");
    const tabs = Array.from(strip.children);
    expect(classesOf(tabs[0])).toEqual(
      expect.arrayContaining([
        "bg-(color:--imw-accent)",
        "text-white",
        "rounded-l-lg",
        "max-[768px]:px-3.5",
        "max-[768px]:text-xs",
      ]),
    );
    expect(classesOf(tabs[0])).toEqual(
      expect.arrayContaining([
        "relative",
        "z-[1]",
        "border-(color:--imw-accent)",
      ]),
    );
    expect(classesOf(tabs[1])).toEqual(
      expect.arrayContaining([
        "border-black/10",
        "imw-dark:border-white/15",
        "rounded-r-lg",
        "-ml-px",
      ]),
    );
    expect(tabs[1].className).not.toMatch(/bg-black\/30|text-white/);
    expect(brandBackground()).toHaveLength(0);
  });
});
