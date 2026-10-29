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
import { MODE } from "./components/desk/deskModes";

interface Harness {
  state: MainAppContainerState;
  controller: {
    runSearch: (keyword: string, options?: { propagate?: boolean }) => void;
    selectScope: (index: number) => void;
    selectSource: (index: number) => void;
    submitSearch: (text: string) => void;
    changecurrentPage: (page: number) => Promise<void>;
  };
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
});
