import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DECK_COLLAPSE_MS } from "./components/room-deck/RoomDeck";
import { resetRequestGuard } from "../playback/RequestGuard";
import { createRef, h, render, type ComponentType } from "preact";
import { act } from "preact/test-utils";

// 只验证模式现场（关键词 / 范围 / 页码 / 数据）与切模式行为：
// 各 Service 换成 spy，子组件与有副作用的存储层替换为空壳。
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
vi.mock("./MainAppContainerServices/AboutService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("./MainAppContainerServices/AboutService")
    >();
  const Real = actual.AboutService;
  return {
    AboutService: {
      // 记录调用 + 跑真实实现：关于数据是本 story 的产物，容器用例要看到真实的空组名卡
      showAbout: (
        ctx: MainAppContainerActionContext,
        ShowOrHideIMC: () => Promise<void>,
      ) => {
        about.showAbout(ctx, ShowOrHideIMC);
        Real.showAbout(ctx, ShowOrHideIMC);
      },
    },
  };
});
const resultsAreaProps = vi.hoisted(() => ({
  last: null as Record<string, unknown> | null,
}));
/** 桩渲染的那一行用的条目（与下面用例里的 `song` 一致）。 */

vi.mock("./components/media-card-container/ResultsArea", async () => {
  const { h } = await import("preact");
  const { SettingsCards } = await import("./components/settings/SettingsGroup");
  return {
    // 桩记录实参（onRetry / onClearSearch / pageOffset 直接调这些实参验证）。
    // 设置 / 关于的数据交给真实的 `SettingsCards` 渲染，容器用例因此能看到卡片 DOM。
    ResultsArea: (props: Record<string, unknown>) => {
      resultsAreaProps.last = props;
      const groups = props.settingsData as SettingGroupData[] | null;
      if (groups) return h(SettingsCards, { groups });
      return h("div", { "data-imw-stub-results": "true" }, "结果");
    },
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
const favoriteStorage = vi.hoisted(() => ({
  toggle: vi.fn(async () => ({ isFavorited: true })),
  /** 操作条读到的收藏状态（用例按需改写）。 */
  favorited: false,
}));
vi.mock("../storage/FavoritesStorageService", () => ({
  // 操作条读收藏状态、写切换；其余方法给空壳（本文件只验证接线）。
  FavoritesStorageService: {
    init: async () => null,
    onExternalChange: () => () => {},
    onChange: () => () => {},
    deriveFavoriteId: () => ({
      id: "netease:song:11",
      platform: "netease",
      type: "song",
    }),
    isFavorited: () => favoriteStorage.favorited,
    toggle: favoriteStorage.toggle,
  },
}));
vi.mock("../sync/SyncManager", () => ({
  SyncManager: { init: async () => {} },
}));

import { MainAppContainer } from "./MainAppContainer";
import { MODE } from "./components/desk/deskModes";
import { pushOverlayLayer } from "./components/desk/overlayLayers";
import type { HostMediaBridge } from "../media-progress/HostMediaBridge";
import {
  provideMediaSession,
  releaseMediaSession,
} from "../media-progress/MediaSession";
import { PlaybackMode } from "../playback/PlaybackMode";
import { snapshot } from "../playback/fixtures";
import { ShowMessage } from "../iirose_func/ShowMessage";

interface Harness {
  state: MainAppContainerState;
  controller: {
    runSearch: (
      keyword: string,
      options?: { propagate?: boolean; reloadEmpty?: boolean },
    ) => void;
    /** 收藏 / 电台的输入即过滤（不发网络请求）。 */
    filterLive: (keyword: string) => void;
    selectScope: (index: number) => void;
    selectSource: (index: number) => void;
    submitSearch: (text: string) => void;
    changecurrentPage: (page: number) => Promise<void>;
    switchToMultiPage: (platformData: PlatformData) => Promise<void>;
    switchToOutFromMultiPage: () => void;
    updateCurrentInMultiPageStatus: (status: boolean) => void;
  };
  /** 结果区行 / 卡主体点击的落点（操作条挂点）。 */
  handleRowActivate: (
    platformData: PlatformData,
    trigger?: HTMLElement | null,
  ) => void;
}

type Controller = Harness["controller"];
const Container = MainAppContainer as unknown as ComponentType<object>;

let root: HTMLDivElement;

const props = (mode: number) => ({
  mode,
  switchMode: vi.fn(),
  searchKeyword: "",
  active: true,
  changeSearchKeyword: vi.fn(),
  ShowOrHideIMC: async () => {},
});

const mount = async (mode: number) => {
  const ref = createRef<MainAppContainer>();
  const p = props(mode);
  await act(async () => {
    render(h(Container, { ...p, ref } as object), root);
  });
  return { ref, props: p };
};

beforeEach(() => {
  root = document.createElement("div");
  root.id = "IIROSE_MEDIA_CONTAINER";
  document.body.append(root);
  vi.clearAllMocks();
});
afterEach(() => {
  render(null, root);
  root.remove();
});

describe("六种模式的现场", () => {
  it("音乐模式首次进入即执行单曲范围：关键词为空时走「最近点播」", async () => {
    const { ref } = await mount(MODE.music);
    expect(ref.current!.state.mode).toBe(MODE.music);
    expect(recent.load).toHaveBeenCalled();
    expect(netease.searchMusic).not.toHaveBeenCalled();

    const controller = (ref.current as unknown as Harness).controller;
    await act(async () => {
      controller.runSearch("陈绮贞");
    });
    expect(netease.searchMusic).toHaveBeenCalled();
  });

  it("各模式各自保留关键词、范围与页码", async () => {
    const { ref } = await mount(MODE.music);
    const controller = (ref.current as unknown as Harness).controller;

    await act(async () => {
      controller.runSearch("陈绮贞");
    });
    await act(async () => {
      controller.selectScope(2); // 歌单
    });
    await act(async () => {
      await controller.changecurrentPage(2);
    });
    expect(netease.searchPlaylist).toHaveBeenCalled();

    const music = (ref.current as unknown as Harness).state;
    expect(music.searchKeyword).toBe("陈绮贞");
    expect(music.SubNavBarIndex).toBe(2);
    expect(music.currentPage).toBe(2);

    // 切到视频：现场清空，执行「推荐」
    await act(async () => {
      render(h(Container, { ...props(MODE.video), ref } as object), root);
    });
    const video = (ref.current as unknown as Harness).state;
    expect(video.mode).toBe(MODE.video);
    expect(video.searchKeyword).toBe("");
    expect(video.SubNavBarIndex).toBe(0);
    expect(bilibili.snbclickRecommand).toHaveBeenCalled();

    // 切回音乐：关键词、范围、页码原样恢复，且不重新请求
    netease.searchPlaylist.mockClear();
    await act(async () => {
      render(h(Container, { ...props(MODE.music), ref } as object), root);
    });
    const restored = (ref.current as unknown as Harness).state;
    expect(restored.mode).toBe(MODE.music);
    expect(restored.searchKeyword).toBe("陈绮贞");
    expect(restored.SubNavBarIndex).toBe(2);
    expect(restored.currentPage).toBe(2);
    expect(netease.searchPlaylist).not.toHaveBeenCalled();
  });

  it("音乐模式粘贴视频链接：先切视频模式，切过去后按该链接提交", async () => {
    const { ref, props: musicProps } = await mount(MODE.music);
    const controller = (ref.current as unknown as Harness).controller;

    await act(async () => {
      controller.submitSearch("BV1xx411c7mD");
    });
    expect(musicProps.switchMode).toHaveBeenCalledWith(MODE.video);
    // 还没切过去：音乐模式现场不动
    expect((ref.current as unknown as Harness).state.mode).toBe(MODE.music);

    await act(async () => {
      render(h(Container, { ...props(MODE.video), ref } as object), root);
    });
    const video = (ref.current as unknown as Harness).state;
    expect(video.mode).toBe(MODE.video);
    expect(video.searchKeyword).toBe("BV1xx411c7mD");
    expect(video.currentPage).toBe(1);
    expect(bilibili.snbclickSearchVideo).toHaveBeenCalled();
  });

  it("视频模式里的普通关键词就地搜索", async () => {
    const { ref, props: videoProps } = await mount(MODE.video);
    const controller = (ref.current as unknown as Harness).controller;
    await act(async () => {
      controller.submitSearch("界面的设计");
    });
    expect(videoProps.switchMode).not.toHaveBeenCalled();
    expect((ref.current as unknown as Harness).state.searchKeyword).toBe(
      "界面的设计",
    );
  });

  it("切来源：页码归 1、回到第一个范围并重取", async () => {
    const { ref } = await mount(MODE.video);
    const controller = (ref.current as unknown as Harness).controller;
    await act(async () => {
      controller.selectScope(1);
    });
    await act(async () => {
      await controller.changecurrentPage(2);
    });

    await act(async () => {
      controller.selectSource(1); // 多源剧集
    });
    const state = (ref.current as unknown as Harness).state;
    expect(state.PlatformIndex).toBe(1);
    expect(state.SubNavBarIndex).toBe(0);
    expect(state.currentPage).toBe(1);
    expect(allvideos.searchAllVideos).toHaveBeenCalled();
  });

  it("收藏是三来源 × 四范围：来源落平台过滤，「歌单与专辑」是合并范围", async () => {
    const { ref } = await mount(MODE.favorites);
    expect(favorites.loadFavorites).toHaveBeenCalled();
    expect(favorites.loadFavorites.mock.calls[0][1]).toBe("all");
    expect(favorites.loadFavorites.mock.calls[0][2]).toBe("all");

    const controller = (ref.current as unknown as Harness).controller;
    await act(async () => {
      controller.selectSource(2); // B 站
    });
    expect(favorites.loadFavorites).toHaveBeenLastCalledWith(
      expect.anything(),
      "bilibili",
      "all",
      10,
    );

    await act(async () => {
      controller.selectScope(2); // 歌单与专辑
    });
    expect(favorites.loadFavorites).toHaveBeenLastCalledWith(
      expect.anything(),
      "bilibili",
      "collection",
      10,
    );
  });

  it("收藏 / 电台输入即过滤：只改关键词与页码、重跑当前范围（不带网络请求）", async () => {
    const { ref } = await mount(MODE.favorites);
    const controller = (ref.current as unknown as Harness).controller;
    const before = favorites.loadFavorites.mock.calls.length;
    // 已渲染的结果与本地缓存必须原样留着：逐字过滤不清列表、不闪骨架
    const rendered = Promise.resolve({
      platformData: [] as PlatformData[],
      totalPage: 0,
    });
    const cached = [{ title: "某收藏" }] as unknown as PlatformData[];
    await act(async () => {
      ref.current!.setState({ mediaData: rendered, allMediaData: cached });
    });

    await act(async () => {
      controller.filterLive("周杰伦");
    });
    const state = (ref.current as unknown as Harness).state;
    expect(state.searchKeyword).toBe("周杰伦");
    expect(state.currentPage).toBe(1);
    expect(favorites.loadFavorites).toHaveBeenCalledTimes(before + 1);
    expect(
      favorites.loadFavorites.mock.lastCall?.[0].getState().searchKeyword,
    ).toBe("周杰伦");
    // 即时过滤只改关键词：不清已渲染结果（清掉就每键闪一次骨架）
    expect(state.mediaData).toBe(rendered);
    expect(state.allMediaData).toBe(cached);
    // 只在本地收藏里过滤：网易云 / B 站搜索接口一次都没碰
    expect(netease.searchMusic).not.toHaveBeenCalled();
    expect(bilibili.snbclickSearchVideo).not.toHaveBeenCalled();
  });

  it("电台输入即过滤：重跑电台范围（过滤同一份本地列表）", async () => {
    const { ref } = await mount(MODE.radio);
    const controller = (ref.current as unknown as Harness).controller;
    expect(radio.search).toHaveBeenCalledTimes(1);
    // 本地列表是即时过滤的唯一数据源：清掉它会落回网络分支重新出网
    const cached = [
      { title: "Listen.moe" },
      { title: "Vocaloid Radio" },
    ] as unknown as PlatformData[];
    const rendered = Promise.resolve({
      platformData: cached,
      totalPage: 1,
    });
    await act(async () => {
      ref.current!.setState({ mediaData: rendered, allMediaData: cached });
    });

    await act(async () => {
      controller.filterLive("vocaloid");
    });
    const state = (ref.current as unknown as Harness).state;
    expect(radio.search).toHaveBeenCalledTimes(2);
    expect(radio.search).toHaveBeenLastCalledWith(
      expect.anything(),
      10,
      "japan",
    );
    expect(state.searchKeyword).toBe("vocaloid");
    expect(state.allMediaData).toBe(cached);
    expect(state.mediaData).toBe(rendered);
  });

  it("进入收藏模式与关键词为空的音乐首屏都重跑当前范围", async () => {
    const { ref } = await mount(MODE.favorites);
    const favoriteCalls = favorites.loadFavorites.mock.calls.length;

    await act(async () => {
      render(h(Container, { ...props(MODE.music), ref } as object), root);
    });
    await act(async () => {
      render(h(Container, { ...props(MODE.favorites), ref } as object), root);
    });
    // 有快照也要重跑：取消收藏的行重新出现在列表里
    expect(favorites.loadFavorites.mock.calls.length).toBe(favoriteCalls + 1);

    const musicCalls = recent.load.mock.calls.length;
    await act(async () => {
      render(h(Container, { ...props(MODE.video), ref } as object), root);
    });
    await act(async () => {
      render(h(Container, { ...props(MODE.music), ref } as object), root);
    });
    // 回到首屏按最新的点播历史重取
    expect(recent.load.mock.calls.length).toBe(musicCalls + 1);
  });

  it("关键词非空的音乐模式切回来不重跑（首屏才反映历史）", async () => {
    const { ref } = await mount(MODE.music);
    const controller = (ref.current as unknown as Harness).controller;
    await act(async () => {
      controller.runSearch("陈绮贞");
    });
    // 记录检索次数：切回音乐模式不该再提交一次
    const searches = netease.searchMusic.mock.calls.length;
    const recentCalls = recent.load.mock.calls.length;

    await act(async () => {
      render(h(Container, { ...props(MODE.video), ref } as object), root);
    });
    await act(async () => {
      render(h(Container, { ...props(MODE.music), ref } as object), root);
    });
    expect(netease.searchMusic.mock.calls.length).toBe(searches);
    expect(recent.load.mock.calls.length).toBe(recentCalls);
    expect((ref.current as unknown as Harness).state.searchKeyword).toBe(
      "陈绮贞",
    );
  });

  it("电台模式复用无线电广播平台", async () => {
    const { ref } = await mount(MODE.radio);
    expect(radio.search).toHaveBeenCalledWith(expect.anything(), 10, "japan");
    expect((ref.current as unknown as Harness).state.mode).toBe(MODE.radio);
  });

  it("离开设置模式释放同步订阅，回到设置模式重跑当前范围", async () => {
    const { ref } = await mount(MODE.settings);
    expect(settings.showBilibili).toHaveBeenCalled();

    await act(async () => {
      render(h(Container, { ...props(MODE.music), ref } as object), root);
    });
    expect(settings.release).toHaveBeenCalled();

    settings.showBilibili.mockClear();
    await act(async () => {
      render(h(Container, { ...props(MODE.settings), ref } as object), root);
    });
    expect(settings.showBilibili).toHaveBeenCalled();
  });

  it("设置范围：桌面四项（哔哩哔哩视频 / 网易云音乐 / 无线电广播 / 插件设置），无「关于」", async () => {
    const { props: p } = await mount(MODE.settings);
    const tabs = Array.from(
      root.querySelectorAll('[role="tab"]'),
    ) as HTMLElement[];
    expect(tabs.map((el) => (el.textContent ?? "").trim())).toEqual([
      "哔哩哔哩视频",
      "网易云音乐",
      "无线电广播",
      "插件设置",
    ]);

    // 接线：点哪个标签就执行哪个范围（标签文字对不代表接对了服务）
    settings.showNetEaseMusic.mockClear();
    settings.showRadio.mockClear();
    settings.showPluginSettings.mockClear();
    await act(async () => {
      tabs[1].click();
    });
    expect(settings.showNetEaseMusic).toHaveBeenCalledOnce();
    expect(settings.showRadio).not.toHaveBeenCalled();
    await act(async () => {
      tabs[2].click();
    });
    expect(settings.showRadio).toHaveBeenCalledOnce();
    await act(async () => {
      tabs[3].click();
    });
    expect(settings.showPluginSettings).toHaveBeenCalledOnce();
    expect(settings.showPluginSettings.mock.calls[0]).toEqual([
      expect.anything(),
      p.changeSearchKeyword,
      p.ShowOrHideIMC,
    ]);
  });

  it("设置范围：手机末项为「关于」，点它显示无组名的关于卡", async () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMedia);
    try {
      await mount(MODE.settings);
      const tabs = Array.from(
        root.querySelectorAll('[role="tab"]'),
      ) as HTMLElement[];
      expect(tabs.map((el) => (el.textContent ?? "").trim())).toEqual([
        "哔哩哔哩视频",
        "网易云音乐",
        "无线电广播",
        "插件设置",
        "关于",
      ]);
      // 点之前还没有关于卡（设置范围的数据由 Service 提供，本用例只验接线）
      expect(root.querySelector("[data-imw-about-card]")).toBeNull();

      about.showAbout.mockClear();
      settings.release.mockClear();
      await act(async () => {
        tabs[4].click();
      });
      expect(about.showAbout).toHaveBeenCalledOnce();
      // 先释放「插件设置」装的同步订阅，再出关于卡（否则后续同步状态变化会把它顶掉）
      expect(settings.release).toHaveBeenCalledOnce();
      expect(settings.release.mock.invocationCallOrder[0]).toBeLessThan(
        about.showAbout.mock.invocationCallOrder[0],
      );

      // 手机在设置内点「关于」= 一张无组名的关于卡（与桌面独立关于模式同一张卡）
      expect(root.querySelector("[data-imw-about-card]")).not.toBeNull();
      expect(root.querySelector("[data-imw-settings-group]")).toBeNull();
      expect(root.querySelector("[data-imw-about-card] h2")).toBeNull();
      expect(root.textContent).toContain("项目源代码地址");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("设置范围标签：手机上停在「关于」时视口变宽，传下去的下标夹回有效范围", async () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMedia);
    try {
      const { ref } = await mount(MODE.settings);
      const tabs = Array.from(
        root.querySelectorAll('[role="tab"]'),
      ) as HTMLElement[];
      await act(async () => {
        tabs[4].click();
      });
      expect((ref.current as unknown as Harness).state.SubNavBarIndex).toBe(4);

      // 视口越过 768px：桌面只有四个标签，下标 4 越界
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
      await act(async () => {
        render(h(Container, { ...props(MODE.settings), ref } as object), root);
      });
      const desktopTabs = Array.from(
        root.querySelectorAll('[role="tab"]'),
      ) as HTMLElement[];
      expect(desktopTabs.map((el) => (el.textContent ?? "").trim())).toEqual([
        "哔哩哔哩视频",
        "网易云音乐",
        "无线电广播",
        "插件设置",
      ]);
      // tablist 仍可键盘进入：恰好一个 tabIndex=0
      expect(
        desktopTabs.filter((el) => el.getAttribute("tabindex") === "0"),
      ).toHaveLength(1);
      expect(desktopTabs[3].getAttribute("aria-selected")).toBe("true");

      // 越界下标只夹显示还不够：重进设置时执行的范围动作也必须是「插件设置」，
      // 否则桌面标签停在「插件设置」却弹出关于卡（并对关于卡做 release）
      settings.showPluginSettings.mockClear();
      about.showAbout.mockClear();
      await act(async () => {
        render(h(Container, { ...props(MODE.music), ref } as object), root);
      });
      await act(async () => {
        render(h(Container, { ...props(MODE.settings), ref } as object), root);
      });
      expect(settings.showPluginSettings).toHaveBeenCalledOnce();
      expect(about.showAbout).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("关于模式读取关于数据，且没有搜索栏", async () => {
    await mount(MODE.about);
    expect(about.showAbout).toHaveBeenCalled();
    expect(root.querySelector("input")).toBeNull();
  });

  it("桌面打开面板把焦点放进搜索栏", async () => {
    await mount(MODE.music);
    expect(document.activeElement).toBe(root.querySelector("input"));
  });

  it("手机打开面板不自动聚焦搜索栏", async () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMedia);
    try {
      await mount(MODE.music);
      expect(document.activeElement).not.toBe(root.querySelector("input"));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("电台模式不分页，视图切换锁定为列表；收藏可切换", async () => {
    await mount(MODE.radio);
    expect(root.querySelector('[role="tablist"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="上一页"]')).toBeNull();
    const radioGroup = root.querySelector('[role="radiogroup"]')!;
    expect(radioGroup.getAttribute("title")).toBe("这里只有列表视图");
    expect(
      radioGroup
        .querySelector('[aria-label="网格"]')!
        .getAttribute("aria-disabled"),
    ).toBe("true");

    render(null, root);
    await mount(MODE.favorites);
    const favorites = root.querySelector('[role="radiogroup"]')!;
    expect(favorites.getAttribute("title")).toBeNull();
    expect(
      favorites
        .querySelector('[aria-label="网格"]')!
        .hasAttribute("aria-disabled"),
    ).toBe(false);
  });

  it("设置页没有视图切换（不是结果列表）", async () => {
    await mount(MODE.settings);
    expect(root.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it("视图切换常驻：视频、音乐首屏可切，MV 锁定为网格，不会消失", async () => {
    await mount(MODE.video);
    expect(root.querySelector('[role="radiogroup"]')).not.toBeNull();

    render(null, root);
    const music = await mount(MODE.music);
    // 音乐首屏（最近点播）也能切列表 / 网格
    const home = root.querySelector('[role="radiogroup"]')!;
    expect(home).not.toBeNull();
    expect(home.getAttribute("title")).toBeNull();
    await act(async () => {
      (music.ref.current as unknown as Harness).controller.runSearch("陈绮贞");
    });
    expect(root.querySelector('[role="radiogroup"]')).not.toBeNull();
    await act(async () => {
      (music.ref.current as unknown as Harness).controller.selectScope(3); // MV
    });
    const mv = root.querySelector('[role="radiogroup"]')!;
    expect(mv).not.toBeNull();
    expect(mv.getAttribute("title")).toBe("这里只有网格视图");
  });

  it("底部条挂载点随容器渲染：没有会话时整块空渲染，不影响其余布局", async () => {
    await mount(MODE.music);
    // 未提供 MediaSession：底部条不渲染（没有占位 div 也没有内容）
    expect(root.querySelector("[data-imw-deck]")).toBeNull();
    expect(root.querySelector("#imw-desk-room-deck")).toBeNull();
    // 结果区与页头照常
    expect(root.querySelector("h1")).not.toBeNull();
  });
});

describe("搜索框到即时过滤的接线", () => {
  /** 向容器里真实的 SearchBar 派发输入事件（与用户逐字输入同一条路径）。 */
  const typeInSearchBar = async (text: string) => {
    const input = root.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return input;
  };

  it("收藏模式逐字输入：经容器接到 filterLive，按原始关键词与页码 1 重跑", async () => {
    const { ref } = await mount(MODE.favorites);
    const before = favorites.loadFavorites.mock.calls.length;

    // 带前导空格的原始输入：不能被 trim 回写（否则空格被吞、光标跳到末尾）
    const input = await typeInSearchBar(" 周杰伦");
    const state = (ref.current as unknown as Harness).state;
    expect(state.searchKeyword).toBe(" 周杰伦");
    expect(state.currentPage).toBe(1);
    expect(favorites.loadFavorites).toHaveBeenCalledTimes(before + 1);
    expect(
      favorites.loadFavorites.mock.lastCall?.[0].getState().searchKeyword,
    ).toBe(" 周杰伦");
    expect(input.value).toBe(" 周杰伦");
  });

  it("电台模式逐字输入：重跑电台范围（本地过滤同一份列表）", async () => {
    await mount(MODE.radio);
    expect(radio.search).toHaveBeenCalledTimes(1);

    await typeInSearchBar("vocaloid");
    expect(radio.search).toHaveBeenCalledTimes(2);
    expect(radio.search).toHaveBeenLastCalledWith(
      expect.anything(),
      10,
      "japan",
    );
  });

  it("音乐模式打字不触发网易云搜索（只有 Enter 才提交）", async () => {
    await mount(MODE.music);
    netease.searchMusic.mockClear();

    await typeInSearchBar("陈绮贞");
    expect(netease.searchMusic).not.toHaveBeenCalled();
  });

  it("电台模式提交 / 清除搜索不清空已加载的本地列表（不会落回网络分支）", async () => {
    const { ref } = await mount(MODE.radio);
    const controller = (ref.current as unknown as Harness).controller;
    const cached = [
      { title: "Listen.moe" },
      { title: "Vocaloid Radio" },
    ] as unknown as PlatformData[];
    await act(async () => {
      ref.current!.setState({ allMediaData: cached });
    });

    await act(async () => {
      controller.runSearch("vocaloid");
    });
    expect((ref.current as unknown as Harness).state.allMediaData).toBe(cached);

    await act(async () => {
      controller.runSearch("", { reloadEmpty: true });
    });
    expect((ref.current as unknown as Harness).state.allMediaData).toBe(cached);
  });
});

describe("专辑 / 歌单内页", () => {
  const albumData = {
    title: "华丽的冒险",
    author: "陈绮贞",
    coverImg: "",
    websiteUrl: "https://music.163.com/#/album?id=9",
    trackCount: "2",
    neteaseMusic: { id: 9, fee: 0, isAlbum: true },
  } as unknown as PlatformData;

  const trackData = {
    title: "旅行的意义",
    author: "陈绮贞",
    coverImg: "",
    websiteUrl: "",
    duration: 240,
    neteaseMusic: { id: 11, fee: 0 },
  } as unknown as PlatformData;

  const enterInnerPage = async (ref: { current: MainAppContainer | null }) => {
    const controller = (ref.current as unknown as Harness).controller;
    await act(async () => {
      controller.updateCurrentInMultiPageStatus(true);
    });
    await act(async () => {
      await controller.switchToMultiPage(albumData);
    });
    return controller;
  };

  beforeEach(() => {
    neteasePlatform.getAlbumMultiPageData.mockResolvedValue({
      platformData: [trackData],
      totalPage: 1,
      allPlatformData: [trackData],
    });
  });

  it("进入内页保存集合，范围行换成内页头", async () => {
    const { ref } = await mount(MODE.music);
    await enterInnerPage(ref);

    const state = (ref.current as unknown as Harness).state;
    expect(state.isCurrentInMultiPage).toBe(true);
    expect(state.innerCollection).toBe(albumData);
    // 外层现场留给「‹ 返回」
    expect(state.oldItems).not.toBeNull();

    const header = root.querySelector("[data-imw-collection-header]");
    expect(header).not.toBeNull();
    expect(header!.textContent).toContain("华丽的冒险");
    expect(header!.textContent).toContain("2 首");
    // 内页时范围标签行被内页头取代
    expect(root.querySelector('[role="tablist"]')).toBeNull();
  });

  it("‹ 返回清空内页标记与集合，图纸回到外层", async () => {
    const { ref } = await mount(MODE.music);
    const before = (ref.current as unknown as Harness).state.mediaData;
    const controller = await enterInnerPage(ref);

    await act(async () => {
      controller.switchToOutFromMultiPage();
    });
    const state = (ref.current as unknown as Harness).state;
    expect(state.isCurrentInMultiPage).toBe(false);
    expect(state.innerCollection).toBeNull();
    expect(state.oldItems).toBeNull();
    // 回到进入内页前的现场（同一份数据承诺，不重新请求）
    expect(state.mediaData).toBe(before);
    expect(state.currentPage).toBe(1);
    expect(root.querySelector("[data-imw-collection-header]")).toBeNull();
    expect(root.querySelector('[role="tablist"]')).not.toBeNull();
  });

  it("Esc 在内页返回外层；顺序菜单开着时只关菜单", async () => {
    const { ref } = await mount(MODE.music);
    await enterInnerPage(ref);

    // 顺序菜单登记为层级栈最上层：Esc 只关它，内页不动
    const dismissMenu = vi.fn();
    const releaseMenu = pushOverlayLayer("order", dismissMenu);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(dismissMenu).toHaveBeenCalledOnce();
    expect((ref.current as unknown as Harness).state.isCurrentInMultiPage).toBe(
      true,
    );
    releaseMenu();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    const state = (ref.current as unknown as Harness).state;
    expect(state.isCurrentInMultiPage).toBe(false);
    expect(state.innerCollection).toBeNull();
  });

  it("「全部播放」按所选顺序委托 NetEasePlatform.playCollectionAll", async () => {
    neteasePlatform.playCollectionAll.mockResolvedValue(undefined);
    const { ref } = await mount(MODE.music);
    await enterInnerPage(ref);

    const trigger = Array.from(root.querySelectorAll("button")).find((el) =>
      el.textContent?.includes("全部播放"),
    )!;
    await act(async () => {
      trigger.click();
    });
    const shuffle = Array.from(
      document.querySelectorAll('[role="menuitem"]'),
    ).find((el) => el.textContent === "乱序播放") as HTMLElement;
    await act(async () => {
      shuffle.click();
    });
    expect(neteasePlatform.playCollectionAll).toHaveBeenCalledWith(
      albumData,
      "shuffle",
    );

    // 点播守卫：上一次整张播放还没有结果时，再点被锁住，不会再发一整张
    const lockedTrigger = Array.from(root.querySelectorAll("button")).find(
      (el) => el.textContent?.includes("全部播放"),
    )!;
    await act(async () => {
      lockedTrigger.click();
    });
    const lockedAsc = Array.from(
      document.querySelectorAll('[role="menuitem"]'),
    ).find((el) => el.textContent === "正序播放") as HTMLElement;
    await act(async () => {
      lockedAsc.click();
    });
    expect(neteasePlatform.playCollectionAll).toHaveBeenCalledTimes(1);

    resetRequestGuard();
    const triggerAgain = Array.from(root.querySelectorAll("button")).find(
      (el) => el.textContent?.includes("全部播放"),
    )!;
    await act(async () => {
      triggerAgain.click();
    });
    const asc = Array.from(document.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent === "正序播放",
    ) as HTMLElement;
    await act(async () => {
      asc.click();
    });
    expect(neteasePlatform.playCollectionAll).toHaveBeenLastCalledWith(
      albumData,
      "asc",
    );
  });

  it("内页多于一页时头部给出本地分页，翻页只切片不发请求", async () => {
    neteasePlatform.getAlbumMultiPageData.mockResolvedValue({
      platformData: [trackData],
      totalPage: 3,
      allPlatformData: [trackData, trackData, trackData],
    });
    const { ref } = await mount(MODE.music);
    await enterInnerPage(ref);

    expect(root.textContent).toContain("01 / 03");
    netease.searchAlbum.mockClear();
    await act(async () => {
      (root.querySelector('[aria-label="下一页"]') as HTMLElement).click();
    });
    const state = (ref.current as unknown as Harness).state;
    expect(state.currentPage).toBe(2);
    expect(root.textContent).toContain("02 / 03");
    expect(netease.searchAlbum).not.toHaveBeenCalled();
  });

  it("内页重试只重载内页", async () => {
    const { ref } = await mount(MODE.music);
    await enterInnerPage(ref);
    neteasePlatform.getAlbumMultiPageData.mockClear();
    netease.searchAlbum.mockClear();

    // 结果区的「重试」经 onRetry 到达容器：这里直接点结果区桩收到的那个回调
    await act(async () => {
      (resultsAreaProps.last!.onRetry as () => void)();
    });
    expect(neteasePlatform.getAlbumMultiPageData).toHaveBeenCalled();
    expect(netease.searchAlbum).not.toHaveBeenCalled();
  });

  it("结果区拿到的 pageOffset 跟着当前页走（序号续接）", async () => {
    neteasePlatform.getAlbumMultiPageData.mockResolvedValue({
      platformData: [trackData],
      totalPage: 3,
      allPlatformData: [trackData, trackData, trackData],
    });
    const { ref } = await mount(MODE.music);
    await enterInnerPage(ref);
    expect(resultsAreaProps.last!.pageOffset).toBe(0);

    await act(async () => {
      (root.querySelector('[aria-label="下一页"]') as HTMLElement).click();
    });
    expect((ref.current as unknown as Harness).state.currentPage).toBe(2);
    expect(resultsAreaProps.last!.pageOffset).toBe(10);
  });
});

describe("清除搜索", () => {
  it("收藏过滤无结果点「清除搜索」按清空后的关键词重取（回到全量）", async () => {
    const { ref } = await mount(MODE.favorites);
    const controller = (ref.current as unknown as Harness).controller;
    await act(async () => {
      controller.runSearch("abc");
    });
    expect(favorites.loadFavorites).toHaveBeenLastCalledWith(
      expect.anything(),
      "all",
      "all",
      10,
    );
    const keywordBeforeClear =
      favorites.loadFavorites.mock.lastCall?.[0].getState().searchKeyword;
    expect(keywordBeforeClear).toBe("abc");

    // 结果区的「清除搜索」经 onClearSearch 到达容器（接线在容器里）
    await act(async () => {
      (resultsAreaProps.last!.onClearSearch as () => void)();
    });
    expect(
      favorites.loadFavorites.mock.lastCall?.[0].getState().searchKeyword,
    ).toBe("");
    expect(favorites.loadFavorites).toHaveBeenCalledTimes(3);
  });
});

describe("底部条接线", () => {
  // 最小会话替身：底部条只要 `read` / `subscribe` 与一份 PlaybackMode。
  function deckSession() {
    const media = snapshot();
    const bridge = {
      current: media,
      read: () => ({ ...bridge.current }),
      subscribe(listener: (next: typeof media) => void) {
        listener(bridge.current);
        return () => {};
      },
      send: () => true,
      controlUnavailable: false,
      controlUnavailableMessage: "",
    };
    const playback = new PlaybackMode();
    playback.setMediaPresent(true);
    playback.applySnapshot(media);
    return {
      bridge: bridge as unknown as HostMediaBridge,
      playback,
      pickShuffle: () => {},
    };
  }

  it("关面板与切模式都收起展开层（active / mode 透传到 RoomDeck）", async () => {
    provideMediaSession(deckSession());
    try {
      const { ref } = await mount(MODE.music);
      const miniBody = () =>
        root.querySelector<HTMLElement>('[data-imw-deck="mini"] button')!;
      expect(miniBody()).not.toBeNull();

      act(() => miniBody().click());
      expect(root.querySelector('[data-imw-deck="expanded"]')).not.toBeNull();

      // 关面板：active=false 透传下去，展开层收起
      await act(async () => {
        render(
          h(Container, { ...props(MODE.music), active: false, ref } as object),
          root,
        );
      });
      expect(root.querySelector('[data-imw-deck="expanded"]')).toBeNull();

      // 重新打开并切模式：mode 变化同样收起
      await act(async () => {
        render(h(Container, { ...props(MODE.music), ref } as object), root);
      });
      act(() => miniBody().click());
      expect(root.querySelector('[data-imw-deck="expanded"]')).not.toBeNull();
      await act(async () => {
        render(h(Container, { ...props(MODE.video), ref } as object), root);
      });
      // 切模式收起带滑出动画：等动画走完再断言已卸载
      await act(async () => {
        await new Promise((resolve) =>
          setTimeout(resolve, DECK_COLLAPSE_MS + 20),
        );
      });
      expect(root.querySelector('[data-imw-deck="expanded"]')).toBeNull();
    } finally {
      releaseMediaSession();
    }
  });
});
