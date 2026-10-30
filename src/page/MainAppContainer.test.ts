import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const settings = vi.hoisted(() => ({
  showBilibiliAccount: vi.fn(),
  showBilibiliVideo: vi.fn(),
  showNetEaseMusic: vi.fn(),
  showRadio: vi.fn(),
  showPluginSettings: vi.fn(),
  showSyncSettings: vi.fn(),
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
vi.mock("./MainAppContainerServices/SettingsService", () => ({
  SettingsService: settings,
}));
vi.mock("./MainAppContainerServices/AboutService", () => ({
  AboutService: about,
}));
const resultsAreaProps = vi.hoisted(() => ({
  last: null as Record<string, unknown> | null,
}));
/** 桩渲染的那一行用的条目（与下面用例里的 `song` 一致）。 */
const stubRow = vi.hoisted(() => ({
  item: {
    title: "鱼",
    author: "陈绮贞",
    coverImg: "",
    websiteUrl: "",
    duration: 240,
    neteaseMusic: { id: 11, fee: 0 },
  },
}));

vi.mock("./components/media-card-container/ResultsArea", async () => {
  const { h } = await import("preact");
  const { useContext } = await import("preact/hooks");
  const { MediaContainerContext } =
    await import("./components/media-container-context/MediaContainerContext");
  return {
    // 桩记录实参（onRetry / onClearSearch / pageOffset 直接调这些实参验证），
    // 并渲染一行：行体点击经真实上下文到达容器，`onRowActivate` 的接线由此可验。
    ResultsArea: (props: Record<string, unknown>) => {
      resultsAreaProps.last = props;
      const ctx = useContext(MediaContainerContext);
      return h(
        "button",
        {
          type: "button",
          "data-imw-stub-row": "true",
          onClick: (event: MouseEvent) =>
            ctx.onRowActivate(
              stubRow.item as PlatformData,
              event.currentTarget as HTMLElement,
            ),
        },
        "行",
      );
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
    runSearch: (keyword: string, options?: { propagate?: boolean }) => void;
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
  it("音乐模式首次进入即执行第一个范围（单曲）", async () => {
    const { ref } = await mount(MODE.music);
    expect(ref.current!.state.mode).toBe(MODE.music);
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

  it("收藏模式是单来源「全部」，加载本地收藏", async () => {
    await mount(MODE.favorites);
    expect(favorites.loadFavorites).toHaveBeenCalled();
    expect(favorites.loadFavorites.mock.calls[0][1]).toBe("all");
  });

  it("电台模式复用无线电广播平台", async () => {
    const { ref } = await mount(MODE.radio);
    expect(radio.search).toHaveBeenCalledWith(expect.anything(), 10, "japan");
    expect((ref.current as unknown as Harness).state.mode).toBe(MODE.radio);
  });

  it("离开设置模式释放同步订阅，回到设置模式重跑当前范围", async () => {
    const { ref } = await mount(MODE.settings);
    expect(settings.showBilibiliAccount).toHaveBeenCalled();

    await act(async () => {
      render(h(Container, { ...props(MODE.music), ref } as object), root);
    });
    expect(settings.release).toHaveBeenCalled();

    settings.showBilibiliAccount.mockClear();
    await act(async () => {
      render(h(Container, { ...props(MODE.settings), ref } as object), root);
    });
    expect(settings.showBilibiliAccount).toHaveBeenCalled();
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

  it("电台模式不分页，收藏只有列表视图", async () => {
    await mount(MODE.radio);
    expect(root.querySelector('[role="tablist"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="上一页"]')).toBeNull();

    render(null, root);
    await mount(MODE.favorites);
    expect(root.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it("视图切换：视频显示，音乐的 MV 范围不显示", async () => {
    const { ref } = await mount(MODE.video);
    expect(root.querySelector('[role="radiogroup"]')).not.toBeNull();

    const controller = (ref.current as unknown as Harness).controller;
    render(null, root);
    const music = await mount(MODE.music);
    expect(root.querySelector('[role="radiogroup"]')).not.toBeNull();
    await act(async () => {
      (music.ref.current as unknown as Harness).controller.selectScope(3); // MV
    });
    expect(root.querySelector('[role="radiogroup"]')).toBeNull();
    void controller;
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
      expect(root.querySelector('[data-imw-deck="expanded"]')).toBeNull();
    } finally {
      releaseMediaSession();
    }
  });
});

describe("手机操作条", () => {
  const song = {
    title: "鱼",
    author: "陈绮贞",
    coverImg: "",
    websiteUrl: "",
    duration: 240,
    neteaseMusic: { id: 11, fee: 0 },
  } as unknown as PlatformData;

  const album = {
    title: "华丽的冒险",
    author: "陈绮贞",
    coverImg: "",
    websiteUrl: "",
    trackCount: "2",
    multiPage: Promise.resolve({ platform: "neteasemusic" }),
    neteaseMusic: { id: 9, fee: 0, isAlbum: true },
  } as unknown as PlatformData;

  const sheet = () =>
    root.querySelector<HTMLElement>("[data-imw-action-sheet]");
  const labels = () =>
    Array.from(sheet()!.querySelectorAll("button")).map((el) =>
      (el.textContent ?? "").trim(),
    );
  const option = (label: string) =>
    Array.from(sheet()!.querySelectorAll("button")).find(
      (el) => (el.textContent ?? "").trim() === label,
    )!;

  /** 行 / 卡主体点击：直接用结果区拿到的那个上下文回调。 */
  const activate = async (
    ref: { current: MainAppContainer | null },
    platformData: PlatformData,
    trigger: HTMLElement | null = null,
  ) => {
    await act(async () => {
      (ref.current as unknown as Harness).handleRowActivate(
        platformData,
        trigger,
      );
    });
  };

  afterEach(() => {
    delete (window as Window & { mediaShareRoom?: boolean }).mediaShareRoom;
  });

  it("结果区的行体点击经上下文到达容器：打开操作条", async () => {
    await mount(MODE.music);
    const row = root.querySelector<HTMLElement>("[data-imw-stub-row]")!;
    expect(row).not.toBeNull();

    await act(async () => {
      row.click();
    });
    expect(sheet()).not.toBeNull();
    expect(sheet()!.textContent).toContain("鱼");
  });

  it("点行体打开操作条：条目摘要 + 点播到房间 / 收藏，焦点在首项", async () => {
    const { ref } = await mount(MODE.music);
    const trigger = document.createElement("div");
    root.append(trigger);

    await activate(ref, song, trigger);

    expect(sheet()).not.toBeNull();
    expect(sheet()!.textContent).toContain("鱼");
    expect(sheet()!.textContent).toContain("陈绮贞");
    expect(labels()).toEqual(["点播到房间", "收藏"]);
    // 行内没有多出按钮：只在浮层里
    expect(document.activeElement).toBe(option("点播到房间"));
    expect(trigger.querySelectorAll("button")).toHaveLength(0);
    // 浮层挂在主面板内部：`fixed` 相对面板、与顺序菜单同为 z-40，不新设 z-index 根
    expect(root.contains(sheet())).toBe(true);
    expect(sheet()!.getAttribute("class")).toContain("fixed");
    expect(sheet()!.getAttribute("class")).toContain("z-40");
  });

  it("点「点播到房间」走行内点播同一路径并收起，焦点归还触发元素", async () => {
    const { ref } = await mount(MODE.music);
    const play = vi.fn();
    await act(async () => {
      ref.current!.setState({ currentOnDemandPlay: play });
    });

    // 触发元素本身不可聚焦（手机曲目行体是 div）：归还给它内部第一个可聚焦后代
    const trigger = document.createElement("div");
    const inner = document.createElement("button");
    inner.textContent = "点播";
    trigger.append(inner);
    root.append(trigger);

    await activate(ref, song, trigger);
    await act(async () => {
      (option("点播到房间") as HTMLButtonElement).click();
    });

    expect(play).toHaveBeenCalledWith(song);
    expect(sheet()).toBeNull();
    expect((ref.current as unknown as Harness).state.sheetItem).toBeNull();
    expect(document.activeElement).toBe(inner);
  });

  it("房间不支持点播：首项灰化，点击只提示、不发报文、不收起", async () => {
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    (window as Window & { mediaShareRoom?: boolean }).mediaShareRoom = false;
    const { ref } = await mount(MODE.music);
    const play = vi.fn();
    await act(async () => {
      ref.current!.setState({ currentOnDemandPlay: play });
    });

    await activate(ref, song);
    const primary = option("点播到房间") as HTMLButtonElement;
    expect(primary.getAttribute("aria-disabled")).toBe("true");
    expect(primary.getAttribute("class")).toContain("opacity-40");
    await act(async () => {
      primary.click();
    });

    expect(show).toHaveBeenCalledWith("这个房间不支持点播");
    expect(play).not.toHaveBeenCalled();
    expect(sheet()).not.toBeNull();
  });

  it("已收藏条目第二项为「取消收藏」；点击即切换并收起", async () => {
    favoriteStorage.favorited = true;
    try {
      const { ref } = await mount(MODE.music);
      await activate(ref, song);
      expect(labels()).toEqual(["点播到房间", "取消收藏"]);

      await act(async () => {
        (option("取消收藏") as HTMLButtonElement).click();
      });
      expect(favoriteStorage.toggle).toHaveBeenCalledWith(song);
      expect(sheet()).toBeNull();
    } finally {
      favoriteStorage.favorited = false;
    }
  });

  it("多 P / 多集条目多一行「选集」，点击调平台 selectEpisodes、不开内页", async () => {
    const { ref } = await mount(MODE.music);
    await activate(ref, song);
    expect(labels()).toEqual(["点播到房间", "收藏"]);

    // 换了条目：多集条目在 `multiPage` 落地后才出现「选集」
    await act(async () => {
      (ref.current as unknown as Harness).handleRowActivate(album, null);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(labels()).toEqual(["点播到房间", "收藏", "选集"]);

    await act(async () => {
      (option("选集") as HTMLButtonElement).click();
    });
    // 委托给网易云平台的选集面板（不再 `switchToMultiPage` 钻取内页）
    expect(neteasePlatform.selectEpisodes).toHaveBeenCalledWith(album);
    const state = (ref.current as unknown as Harness).state;
    expect(state.isCurrentInMultiPage).toBe(false);
    expect(state.innerCollection).toBeNull();
    expect(sheet()).toBeNull();
    expect(root.querySelector("[data-imw-collection-header]")).toBeNull();
  });

  it("B 站多 P 条目：选集走平台 selectEpisodes，不开内页", async () => {
    const multiVideo = {
      title: "某多 P 视频",
      author: "某 UP",
      coverImg: "",
      websiteUrl: "https://www.bilibili.com/video/BV1",
      duration: 60,
      bilibili: { bvid: "BV1" },
      multiPage: Promise.resolve({ platform: "bilibili" }),
    } as unknown as PlatformData;
    const { ref } = await mount(MODE.video);
    await activate(ref, multiVideo);
    await act(async () => {
      await Promise.resolve();
    });
    expect(labels()).toContain("选集");

    await act(async () => {
      (option("选集") as HTMLButtonElement).click();
    });
    expect(bilibiliPlatform.selectEpisodes).toHaveBeenCalledWith(multiVideo);
    expect((ref.current as unknown as Harness).state.isCurrentInMultiPage).toBe(
      false,
    );
    expect(sheet()).toBeNull();
  });

  it("B 站课程没有分 P 接口：仍按内页钻取", async () => {
    const course = {
      title: "某课程",
      author: "某 UP",
      coverImg: "",
      websiteUrl: "https://www.bilibili.com/cheese/play/ss1",
      bilibili: { aid: 1, course_id: 9 },
      multiPage: Promise.resolve({ platform: "bilibili" }),
    } as unknown as PlatformData;
    const { ref } = await mount(MODE.video);
    await activate(ref, course);
    await act(async () => {
      await Promise.resolve();
    });
    expect(labels()).toContain("选集");

    await act(async () => {
      (option("选集") as HTMLButtonElement).click();
    });
    expect(bilibiliPlatform.selectEpisodes).not.toHaveBeenCalled();
    expect(bilibiliPlatform.getMultiPageBasicsData).toHaveBeenCalledWith(
      course,
    );
    expect((ref.current as unknown as Harness).state.isCurrentInMultiPage).toBe(
      true,
    );
    expect(sheet()).toBeNull();
  });

  it("Esc 只关操作条；切模式与关面板也一并收起", async () => {
    const { ref } = await mount(MODE.music);
    await activate(ref, song);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(sheet()).toBeNull();

    await activate(ref, song);
    await act(async () => {
      render(h(Container, { ...props(MODE.video), ref } as object), root);
    });
    expect(sheet()).toBeNull();

    await activate(ref, song);
    await act(async () => {
      render(
        h(Container, { ...props(MODE.video), active: false, ref } as object),
        root,
      );
    });
    expect(sheet()).toBeNull();
  });
});
