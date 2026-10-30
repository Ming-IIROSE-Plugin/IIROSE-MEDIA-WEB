import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Socket } from "../iirose_func/Socket";
import { act } from "preact/test-utils";
import { IMCInit } from "./index";
import { RequestHistory } from "../history/RequestHistory";
import {
  FavoritesStorageService,
  type FavoriteRecord,
} from "../storage/FavoritesStorageService";
import { ShuffleController } from "../playback/ShuffleController";
import {
  loadShufflePlatform,
  loadShuffleSelection,
  saveShufflePlatform,
} from "../playback/ShuffleSelection";
import { resetPanelFocus, setPanelFocus } from "../playback/PanelFocus";
import { releaseShufflePicker } from "./components/shuffle-picker/openShufflePicker";
import { mediaSession } from "../media-progress/MediaSession";
import { Gesture } from "../listener/Gesture";

const sent = vi.fn();
const payload = `&1${JSON.stringify({
  s: "https://a/b.mp3",
  d: 300,
  c: "https://a/c.jpg",
  n: "甲",
  r: "歌手",
  b: "@0",
  o: "https://music.163.com/#/song?id=1",
  l: "",
})}`;

const loop = () =>
  document.getElementById("imw-toggle-loop") as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", function WebSocketStub() {});
  sent.mockClear();
  Object.assign(window, {
    shareMediaCurrentTime: 80,
    shareMediaDuration: 300,
    socket: { readyState: 1, send: sent },
    // 无媒体管理权限且非本人点播：循环是否可用完全取决于报文缓存。
    rank: "0",
    myself: "",
    roomnFull: "wiring-room",
    Info: { room: { identity: 0 } },
    shareMedia: () => {},
    Utils: {
      service: { isShareMediaPlaying: () => true, seekDemandMedia: () => {} },
    },
  });
  document.body.innerHTML =
    '<div id="mainContainer"></div><div id="functionHolder"><div id="functionHolderExtBox">' +
    '<div class="functionButtonExt"><div id="shareMediaBox">' +
    '<div id="shareMediaSongName">甲</div><div id="shareMediaUserName"></div>' +
    "</div></div></div></div>";
});

afterEach(() => {
  window.dispatchEvent(
    new PageTransitionEvent("pagehide", { persisted: false }),
  );
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Socket.observe = undefined;
  document.body.innerHTML = "";
});

describe("播放报文观察接线", () => {
  it("插件自己发出的报文让循环可用，卸载后钩子被摘除", () => {
    IMCInit.init(document.getElementById("mainContainer") as HTMLDivElement);
    expect(typeof Socket.observe).toBe("function");
    vi.advanceTimersByTime(250);
    expect(loop().getAttribute("aria-disabled")).toBe("true");

    new Socket().send(payload);
    vi.advanceTimersByTime(250);
    expect(loop().getAttribute("aria-disabled")).toBe("false");
    loop().click();
    expect(loop().getAttribute("aria-pressed")).toBe("true");

    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false }),
    );
    expect(Socket.observe).toBeUndefined();
  });

  it("发送 &1 后写入本地点播历史；卡片报文不写；卸载后不再写", () => {
    localStorage.clear();
    IMCInit.init(document.getElementById("mainContainer") as HTMLDivElement);

    new Socket().send(payload);
    expect(RequestHistory.load()).toHaveLength(1);
    expect(RequestHistory.load()[0]).toMatchObject({
      title: "甲",
      artist: "歌手",
      link: "https://music.163.com/#/song?id=1",
    });

    // 卡片报文（宿站自己的 `m__4@0>…` 卡片）不进历史
    new Socket().send(
      JSON.stringify({
        m: "m__4@0>甲>歌手>https://a/c.jpg>000000>320",
        mc: "000000",
        i: "1",
      }),
    );
    expect(RequestHistory.load()).toHaveLength(1);

    // 卸载后观察钩子被摘除：不再写入
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false }),
    );
    expect(Socket.observe).toBeUndefined();
    new Socket().send(
      payload
        .replace('"n":"甲"', '"n":"乙"')
        .replace("#/song?id=1", "#/song?id=2"),
    );
    expect(RequestHistory.load().map((entry) => entry.title)).toEqual(["甲"]);
  });
});

describe("主面板单实例", () => {
  const panels = () => document.querySelectorAll("#IIROSE_MEDIA_CONTAINER");
  const mainContainer = () =>
    document.getElementById("mainContainer") as HTMLDivElement;

  afterEach(() => {
    delete (window as Window & { __imwMainPanel?: () => void }).__imwMainPanel;
  });

  it("重复初始化与另一份 bundle 接管后同页只有一个主面板", async () => {
    IMCInit.init(mainContainer());
    IMCInit.init(mainContainer());
    expect(panels()).toHaveLength(1);
    expect(mainContainer().children).toHaveLength(1);

    // 另一份 bundle 实例：模块级状态全新，只能靠页面级单例键接管。
    vi.resetModules();
    const reloaded = await import("./index");
    reloaded.IMCInit.init(mainContainer());
    expect(panels()).toHaveLength(1);
    expect(mainContainer().children).toHaveLength(1);
  });

  it("没有单例键的旧版残留容器也会被清掉", () => {
    const legacy = document.createElement("div");
    legacy.innerHTML = '<div id="IIROSE_MEDIA_CONTAINER"></div>';
    mainContainer().append(legacy);
    IMCInit.init(mainContainer());
    expect(legacy.isConnected).toBe(false);
    expect(panels()).toHaveLength(1);
  });

  it("面板开着时被接管，归还宿站聊天区", () => {
    const holder = document.createElement("div");
    holder.id = "mainHolder";
    document.body.append(holder);
    IMCInit.init(mainContainer());
    holder.classList.add("hidemainHolder");
    IMCInit.init(mainContainer());
    expect(holder.classList.contains("hidemainHolder")).toBe(false);
  });
});

describe("收藏随机选择面板接线", () => {
  const mainContainer = () =>
    document.getElementById("mainContainer") as HTMLDivElement;
  const pickerRoot = () => document.getElementById("imw-shuffle-picker-root");

  it("重新初始化会关掉已打开的选择面板", () => {
    IMCInit.init(mainContainer());
    window.iirosemedia?.openShufflePicker?.("netease");
    expect(pickerRoot()).not.toBeNull();
    IMCInit.init(mainContainer());
    expect(pickerRoot()).toBeNull();
  });

  it("调试入口忽略未知平台", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    IMCInit.init(mainContainer());
    (window.iirosemedia?.openShufflePicker as unknown as (p: string) => void)(
      "foo",
    );
    expect(pickerRoot()).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  describe("侧栏随机按钮", () => {
    const favorite = {
      id: "netease:song:1",
      platform: "netease",
      type: "song",
      title: "晴天",
      coverImg: "",
      author: "周杰伦",
      websiteUrl: "",
      createdAt: 1,
      updatedAt: 1,
      platformData: {
        title: "",
        coverImg: "",
        author: "",
        websiteUrl: "",
        neteaseMusic: { id: 1, fee: 0 },
      },
    } as unknown as FavoriteRecord;
    const bilibiliFavorite = {
      ...favorite,
      id: "bilibili:video:BV1",
      platform: "bilibili",
      type: "video",
      title: "某视频",
    } as unknown as FavoriteRecord;
    const shuffleButton = () =>
      document.getElementById("imw-toggle-shuffle") as HTMLButtonElement;
    const dialog = () => document.getElementById("imw-shuffle-picker");
    const footerButton = (text: string) =>
      [...dialog()!.querySelectorAll("button")].find(
        (node) => node.textContent?.trim() === text,
      )!;
    async function settle() {
      for (let index = 0; index < 5; index++)
        await vi.advanceTimersByTimeAsync(50);
    }

    afterEach(() => {
      // 清掉面板与系统返回登记，避免串扰。
      act(() => releaseShufflePicker());
      delete (window as unknown as Record<string, unknown>)
        .__imwShufflePickerBack;
      resetPanelFocus();
      localStorage.clear();
    });

    beforeEach(async () => {
      vi.spyOn(FavoritesStorageService, "query").mockImplementation(
        async (filter) =>
          filter?.platform === "bilibili" ? [bilibiliFavorite] : [favorite],
      );
      act(() => IMCInit.init(mainContainer()));
      await settle();
      shuffleButton().getClientRects = () =>
        [{ width: 1, height: 1 }] as unknown as DOMRectList;
    });

    it("重复注入：旧选集面板根被清掉（不让 z-[90010] 挡整页）", () => {
      const stale = document.createElement("div");
      stale.id = "imw-episode-picker-root";
      document.body.append(stale);

      act(() => IMCInit.init(mainContainer()));
      expect(document.getElementById("imw-episode-picker-root")).toBeNull();
    });

    it("熄灭态点击开面板不点亮；再点只聚焦面板；取消后焦点回按钮", async () => {
      expect(shuffleButton().getAttribute("aria-disabled")).toBe("false");
      act(() => shuffleButton().click());
      await settle();
      expect(pickerRoot()).not.toBeNull();
      expect(shuffleButton().getAttribute("aria-pressed")).toBe("false");
      shuffleButton().focus();
      act(() => shuffleButton().click());
      await settle();
      expect(
        document.querySelectorAll("#imw-shuffle-picker-root"),
      ).toHaveLength(1);
      expect(document.activeElement).toBe(dialog());
      act(() => footerButton("取消").click());
      await settle();
      expect(pickerRoot()).toBeNull();
      expect(document.activeElement).toBe(shuffleButton());
      expect(shuffleButton().getAttribute("aria-pressed")).toBe("false");
    });

    it("确认：先作废随机预取再点亮", async () => {
      let pressedAtInvalidate: string | null = null;
      const invalidate = vi
        .spyOn(ShuffleController.prototype, "invalidate")
        .mockImplementation(() => {
          pressedAtInvalidate = shuffleButton().getAttribute("aria-pressed");
        });
      act(() => shuffleButton().click());
      await settle();
      expect(invalidate).not.toHaveBeenCalled();
      act(() => footerButton("开始随机").click());
      await settle();
      expect(invalidate).toHaveBeenCalledOnce();
      expect(pressedAtInvalidate).toBe("false");
      expect(shuffleButton().getAttribute("aria-pressed")).toBe("true");
      expect(document.activeElement).toBe(shuffleButton());
      // 点亮态再点直接熄灭，不开面板。
      act(() => shuffleButton().click());
      await settle();
      expect(pickerRoot()).toBeNull();
      expect(shuffleButton().getAttribute("aria-pressed")).toBe("false");
    });

    const selectedTab = () =>
      dialog()?.querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent;
    const setDefaultPage = (defaultPage: number) =>
      localStorage.setItem(
        "imwPluginSetting",
        JSON.stringify({
          chatBox: { isProxyAtInput: true },
          defaultPage,
          searchViewMode: "card",
          announceMode: "card",
          sync: {},
        }),
      );

    it("首次打开按「插件启动默认页面」：视频 → B站，确认存到 bilibili 并记下平台", async () => {
      setDefaultPage(1);
      // 主面板焦点不参与：即使焦点在网易云。
      setPanelFocus({ category: 0, platform: 0 });
      const query = vi.mocked(FavoritesStorageService.query);
      query.mockClear();
      act(() => shuffleButton().click());
      await settle();
      expect(selectedTab()).toBe("B站");
      expect(query).toHaveBeenCalledWith({ platform: "bilibili" });
      expect(dialog()?.textContent).toContain("某视频");
      act(() => footerButton("开始随机").click());
      await settle();
      expect(loadShuffleSelection("bilibili")?.items).toEqual([
        { id: "bilibili:video:BV1" },
      ]);
      expect(loadShuffleSelection("netease")).toBeNull();
      expect(loadShufflePlatform()).toBe("bilibili");
    });

    it("默认页面非音乐/视频 → 网易云", async () => {
      setDefaultPage(2);
      act(() => shuffleButton().click());
      await settle();
      expect(selectedTab()).toBe("网易云");
    });

    it("记住平台：已存 B站 时停在 B站", async () => {
      setDefaultPage(0);
      saveShufflePlatform("bilibili");
      act(() => shuffleButton().click());
      await settle();
      expect(selectedTab()).toBe("B站");
    });

    it("与焦点无关：主面板停在无线电页，随机按钮可用、面板照常打开", async () => {
      setPanelFocus({ category: 2, platform: 0 });
      await settle();
      expect(shuffleButton().getAttribute("aria-disabled")).toBe("false");
      act(() => shuffleButton().click());
      await settle();
      expect(pickerRoot()).not.toBeNull();
      expect(selectedTab()).toBe("网易云");
    });

    it("全部平台都没有收藏：侧栏按钮灰化并说明原因", async () => {
      vi.mocked(FavoritesStorageService.query).mockResolvedValue([]);
      act(() => IMCInit.init(mainContainer()));
      await settle();
      expect(shuffleButton().getAttribute("aria-disabled")).toBe("true");
      expect(shuffleButton().title).toBe("收藏为空，先去收藏一些内容");
      act(() => shuffleButton().click());
      await settle();
      expect(pickerRoot()).toBeNull();
    });

    // 底部条的「收藏随机」与侧栏行共用 `openShuffle`：真实面板、真实回顾焦。
    it("底部条的收藏随机也走同一个选择面板：取消回焦点、确认点亮", async () => {
      (window as unknown as { Utils: Record<string, unknown> }).Utils.sync =
        () => {};
      const show = Gesture.ShowHideMainApp as unknown as () => Promise<void>;
      await act(async () => {
        await show();
      });
      await settle();

      const deckShuffle = () =>
        document.querySelector<HTMLButtonElement>(
          '[data-imw-deck="room"] [data-imw-mode="shuffle"]',
        )!;
      expect(deckShuffle()).not.toBeNull();
      deckShuffle().getClientRects = () =>
        [{ width: 1, height: 1 }] as unknown as DOMRectList;

      act(() => deckShuffle().click());
      await settle();
      expect(pickerRoot()).not.toBeNull();
      expect(shuffleButton().getAttribute("aria-pressed")).toBe("false");

      act(() => footerButton("取消").click());
      await settle();
      expect(pickerRoot()).toBeNull();
      expect(document.activeElement).toBe(deckShuffle());

      act(() => deckShuffle().click());
      await settle();
      act(() => footerButton("开始随机").click());
      await settle();
      expect(shuffleButton().getAttribute("aria-pressed")).toBe("true");
    });
  });
});

describe("面板底部条会话接线", () => {
  const mainContainer = () =>
    document.getElementById("mainContainer") as HTMLDivElement;

  it("会话里的 playback 就是侧栏行驱动的那一份实例", () => {
    IMCInit.init(mainContainer());
    const session = mediaSession()!;
    const row = document.getElementById("imw-toggle-loop") as HTMLButtonElement;
    // 本夹具没有播放结束报文缓存，循环默认灰化；打开可用性再点，验证两份是同一实例
    act(() =>
      session.playback.setAvailability("loop", { enabled: true, reason: "" }),
    );
    expect(row.getAttribute("aria-disabled")).toBe("false");
    act(() => row.click());
    expect(session.playback.mode).toBe("loop");
    expect(row.getAttribute("aria-pressed")).toBe("true");
  });

  it("init 后提供页面会话（底部条随之渲染），pagehide 后释放", async () => {
    IMCInit.init(mainContainer());
    const session = mediaSession();
    expect(session).not.toBeNull();
    // 快照取自宿站 DOM：标题来自 #shareMediaSongName
    expect(session!.bridge.read().title).toBe("甲");

    // 打开面板：底部条经注册表拿到会话后立即渲染
    (window as unknown as { Utils: Record<string, unknown> }).Utils.sync =
      () => {};
    const show = Gesture.ShowHideMainApp as unknown as () => Promise<void>;
    await act(async () => {
      await show();
    });
    expect(document.querySelector('[data-imw-deck="room"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: false }),
      );
    });
    expect(mediaSession()).toBeNull();
  });
});
