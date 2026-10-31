import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, render } from "preact";
import { act } from "preact/test-utils";

// 只验证「竖栏 / 底部标签栏 → MainApp.switchMode → mode 实参 → MainAppContainer.applyMode
// → 页面」这一段接线：各 Service 与平台换成 spy，结果区与存储层替换为空壳。
// 页头由真实容器按 `mode` 渲染（`modeTitle`），因此「回调接了但状态没落地」会直接失败。
const netease = vi.hoisted(() => ({
  searchMusic: vi.fn(),
  searchAlbum: vi.fn(),
  searchPlaylist: vi.fn(),
  searchMV: vi.fn(),
}));
const bilibili = vi.hoisted(() => ({
  snbclickRecommand: vi.fn(),
  snbclickSearchVideo: vi.fn(),
  snbclickSearchLive: vi.fn(),
}));
const allvideos = vi.hoisted(() => ({ searchAllVideos: vi.fn() }));
const radio = vi.hoisted(() => ({ search: vi.fn() }));
const favorites = vi.hoisted(() => ({
  loadFavorites: vi.fn(),
  reloadLastQuery: vi.fn(),
}));
const recent = vi.hoisted(() => ({ load: vi.fn() }));
const settings = vi.hoisted(() => ({
  showBilibili: vi.fn(),
  showNetEaseMusic: vi.fn(),
  showRadio: vi.fn(),
  showPluginSettings: vi.fn(),
  release: vi.fn(),
}));
const about = vi.hoisted(() => ({ showAbout: vi.fn() }));
const neteasePlatform = vi.hoisted(() => ({
  getAlbumMultiPageData: vi.fn(),
  getSongListMultiPageData: vi.fn(),
  playCollectionAll: vi.fn(),
  playSongIds: vi.fn(),
  MOD: vi.fn(),
  selectEpisodes: vi.fn(),
}));
const allVideosPlatform = vi.hoisted(() => ({
  selectEpisodes: vi.fn(),
  VOD: vi.fn(),
}));
const bilibiliPlatform = vi.hoisted(() => ({
  getMultiPageBasicsData: vi.fn(async () => ({
    platformData: [],
    allPlatformData: [],
    totalPage: 0,
  })),
  VOD: vi.fn(),
  selectEpisodes: vi.fn(),
}));

vi.mock("./MainAppContainerServices/NetEaseService", () => ({
  NetEaseService: netease,
}));
vi.mock("./MainAppContainerServices/BilibiliService", () => ({
  BilibiliService: bilibili,
}));
vi.mock("./MainAppContainerServices/AllVideoService", () => ({
  AllVideosService: allvideos,
}));
vi.mock("./MainAppContainerServices/RadioService", () => ({
  RadioService: radio,
}));
vi.mock("./MainAppContainerServices/FavoritesService", () => ({
  FavoritesService: favorites,
}));
vi.mock("./MainAppContainerServices/RecentService", () => ({
  RecentService: recent,
}));
vi.mock("./MainAppContainerServices/SettingsService", () => ({
  SettingsService: settings,
}));
vi.mock("./MainAppContainerServices/AboutService", () => ({
  AboutService: about,
}));
vi.mock("./components/media-card-container/ResultsArea", async () => {
  const { h: build } = await import("preact");
  return {
    ResultsArea: () =>
      build("div", { "data-imw-stub-results": "true" }, "结果"),
    RADIO_MIN_PENDING_MS: 1_000,
    shapeOf: () => "tracklist",
  };
});
vi.mock("../platforms/NetEasePlatform", () => ({
  NetEasePlatform: neteasePlatform,
}));
vi.mock("../platforms/BilibiliPlatform", () => ({
  BilibiliPlatform: bilibiliPlatform,
}));
vi.mock("../platforms/AllVideosPlatform", () => ({
  AllVideosPlatform: allVideosPlatform,
}));
vi.mock("../playback/PanelFocus", () => ({ setPanelFocus: () => {} }));
vi.mock("../storage/FavoritesStorageService", () => ({
  FavoritesStorageService: {
    init: async () => null,
    onExternalChange: () => () => {},
    onChange: () => () => {},
  },
}));
vi.mock("../sync/SyncManager", () => ({
  SyncManager: { init: async () => {} },
}));

import { MainApp } from "./MainApp";
import { MODE, modeTitle } from "./components/desk/deskModes";

let root: HTMLDivElement;

/** 页头文字：真实容器按 `modeTitle(mode)` 渲染。 */
const title = () => (root.querySelector("h1")?.textContent ?? "").trim();

/** 第 `index` 个 nav 里文字为 `label` 的按钮（0 = 桌面竖栏，1 = 手机标签栏）。 */
const navButton = (index: number, label: string) => {
  const nav = root.querySelectorAll("nav")[index];
  return Array.from(nav.querySelectorAll("button")).find(
    (el) => (el.textContent ?? "").trim() === label,
  ) as HTMLButtonElement;
};
const rail = (label: string) => navButton(0, label);
const tab = (label: string) => navButton(1, label);

const mountApp = async () => {
  await act(async () => {
    render(
      h(MainApp, {
        ShowHideMainApp: async () => {},
        searchKeyword: "",
        changeSearchKeyword: () => {},
        mainAppDisplay: true,
      }),
      root,
    );
  });
};

const click = async (button: HTMLButtonElement) => {
  await act(async () => {
    button.click();
  });
};

beforeEach(() => {
  root = document.createElement("div");
  document.body.append(root);
  vi.clearAllMocks();
});
afterEach(() => {
  render(null, root);
  root.remove();
});

describe("导航 → 面板的模式传播", () => {
  it("点竖栏「视频」：面板页头真的换成视频（不是只触发回调）", async () => {
    await mountApp();
    expect(title()).toBe(modeTitle(MODE.music));
    bilibili.snbclickRecommand.mockClear();

    await click(rail("视频"));

    // 页头来自容器的 state.mode：回调接了但状态没落地 / mode 实参被丢掉时这里仍是「点歌台」
    expect(title()).toBe(modeTitle(MODE.video));
    expect(rail("视频").getAttribute("aria-current")).toBe("page");
    expect(rail("音乐").getAttribute("aria-current")).toBeNull();
    // applyMode 在容器里真的跑过：视频模式的首个范围（推荐）被执行
    expect(bilibili.snbclickRecommand).toHaveBeenCalledOnce();
  });

  it("点竖栏「收藏」：传播对别的模式同样成立", async () => {
    await mountApp();
    favorites.loadFavorites.mockClear();

    await click(rail("收藏"));

    expect(title()).toBe(modeTitle(MODE.favorites));
    // 收藏模式的首个来源 / 范围（全部 × 全部）被执行
    expect(favorites.loadFavorites.mock.calls[0][1]).toBe("all");
    expect(favorites.loadFavorites.mock.calls[0][2]).toBe("all");
  });

  it("手机底部标签栏也传播到面板", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    try {
      await mountApp();
      expect(title()).toBe(modeTitle(MODE.music));

      await click(tab("视频"));

      expect(title()).toBe(modeTitle(MODE.video));
      expect(tab("视频").getAttribute("aria-current")).toBe("page");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("来回切：页头跟着模式翻回去，回到音乐重跑首屏", async () => {
    await mountApp();
    await click(rail("视频"));
    expect(title()).toBe(modeTitle(MODE.video));

    const recentCalls = recent.load.mock.calls.length;
    await click(rail("音乐"));

    expect(title()).toBe(modeTitle(MODE.music));
    expect(rail("音乐").getAttribute("aria-current")).toBe("page");
    expect(recent.load.mock.calls.length).toBe(recentCalls + 1);
  });

  // 负向对照：把 switchMode 的落点本身变成可观察的，钉住「点了 → setState({ mode }) → 页面」。
  // 只断言回调被调用（或只断言 aria-current）都留不住这个契约：前者放过「状态没落地」，
  // 后者放过「mode 实参没传到容器」。
  it("负向对照：点当前模式不产生状态变更，点别的模式才落到页面", async () => {
    await mountApp();
    const setState = vi.spyOn(MainApp.prototype, "setState");

    await click(rail("音乐"));
    expect(setState).not.toHaveBeenCalled();
    expect(title()).toBe(modeTitle(MODE.music));

    await click(rail("视频"));
    expect(
      setState.mock.calls.map(
        ([next]) => (next as { mode?: number } | null)?.mode,
      ),
    ).toContain(MODE.video);
    expect(title()).toBe(modeTitle(MODE.video));
  });
});
