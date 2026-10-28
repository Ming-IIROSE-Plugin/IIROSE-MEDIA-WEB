import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef, h, render, type ComponentType } from "preact";
import { act } from "preact/test-utils";

// 只验证强调色写入：子组件与有副作用的服务替换为空壳（子组件挂载会发起搜索）。
vi.mock("./components/mediaContainerBar/MediaSearchBar", () => ({
  MediaSearchBar: () => null,
}));
vi.mock("./components/mediaContainerBar/PlatformSelector", () => ({
  PlatformSelector: () => null,
}));
vi.mock("./components/mediaContainerBar/MediaContainerSubNavBar", () => ({
  MediaContainerSubNavBar: () => null,
}));
vi.mock("./components/media-card-container/MediaCard", () => ({
  MediaCard: () => null,
}));
vi.mock("../playback/PanelFocus", () => ({ setPanelFocus: () => {} }));
vi.mock("../storage/FavoritesStorageService", () => ({
  FavoritesStorageService: {
    init: async () => null,
    onExternalChange: () => {},
  },
}));
vi.mock("../sync/SyncManager", () => ({
  SyncManager: { init: async () => {} },
}));

import { MainAppContainer } from "./MainAppContainer";
import { readableAccent } from "./components/floating-panel/accent";

type Controller = { controller: { switchPlatform: (index: number) => void } };
const Container = MainAppContainer as unknown as ComponentType<object>;

let root: HTMLDivElement;
const brandVars = () => ({
  fill: root.style.getPropertyValue("--imw-brand"),
  ink: root.style.getPropertyValue("--imw-brand-ink"),
});
const props = (CategoriesIndex: number) => ({
  CategoriesIndex,
  needOutFromMultiPage: false,
  needOutFromSettings: false,
  searchKeyword: "",
  active: true,
  changeSearchKeyword: () => {},
  ShowOrHideIMC: async () => {},
});

beforeEach(() => {
  root = document.createElement("div");
  root.id = "IIROSE_MEDIA_CONTAINER";
  document.body.append(root);
});
afterEach(() => {
  render(null, root);
  root.remove();
});

describe("主面板强调色 --imw-brand / --imw-brand-ink", () => {
  it("挂载写入当前平台品牌色（压深后），切平台与分类时更新", async () => {
    const ref = createRef<MainAppContainer>();
    render(h(Container, { ...props(0), ref } as object), root);
    // 音乐分类首个平台：网易云
    expect(brandVars()).toEqual(readableAccent("rgb(221, 28, 4)"));

    // 切到第二个平台：无线电（浅色，需压深）
    await act(async () => {
      (ref.current as unknown as Controller).controller.switchPlatform(1);
    });
    expect(brandVars()).toEqual(readableAccent("rgb(100, 149, 237)"));
    expect(brandVars().fill).not.toBe("rgb(100, 149, 237)");
    expect(brandVars().ink).not.toBe(brandVars().fill);

    // 切到视频分类：平台回到首个（B 站）
    await act(async () => {
      render(h(Container, { ...props(1), ref } as object), root);
    });
    expect(brandVars()).toEqual(readableAccent("rgb(209, 79, 118)"));
  });
});
