import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, render, type ComponentChild } from "preact";
import { act } from "preact/test-utils";
import * as tokens from "../floating-panel/tokens";
import { MediaContainerContext } from "../media-container-context/MediaContainerContext";
import { MODE } from "../desk/deskModes";
import { ShowMessage } from "../../../iirose_func/ShowMessage";
import { NetEasePlatform } from "../../../platforms/NetEasePlatform";
import { FavoritesStorageService } from "../../../storage/FavoritesStorageService";
import { Cover, upgradeCoverUrl } from "./Cover";
import { CollectionHeader } from "./CollectionHeader";
import { CollectionRow } from "./CollectionRow";
import { FavoriteStar } from "./FavoriteStar";
import { MusicTile } from "./MusicTile";
import { ResultsArea, shapeOf } from "./ResultsArea";
import { SkeletonRows, SkeletonTiles } from "./Skeletons";
import {
  NowPlayingBars,
  RequestButton,
  TracklistHeader,
  TracklistRow,
} from "./TracklistRow";
import { VideoTile } from "./VideoTile";
import { hasOverlayLayers } from "../desk/overlayLayers";
import {
  formatDuration,
  isCollectionItem,
  isLiveItem,
  isTapToReveal,
  trackCountLabel,
} from "./mediaFormat";
import { isNowPlayingTitle } from "./nowPlaying";
import { notifyRoomUnsupported, roomSupportsRequest } from "./roomSupport";
import collectionHeaderSrc from "./CollectionHeader.tsx?raw";
import collectionRowSrc from "./CollectionRow.tsx?raw";
import coverSrc from "./Cover.tsx?raw";
import favoriteStarSrc from "./FavoriteStar.tsx?raw";
import musicTileSrc from "./MusicTile.tsx?raw";
import orderMenuSrc from "./OrderMenu.tsx?raw";
import resultsAreaSrc from "./ResultsArea.tsx?raw";
import skeletonsSrc from "./Skeletons.tsx?raw";
import stateMessageSrc from "./StateMessage.tsx?raw";
import tracklistSrc from "./TracklistRow.tsx?raw";
import videoTileSrc from "./VideoTile.tsx?raw";

// 结果区（spec-media-desk-redesign story 2）：令牌纪律、封面、曲目表、网格卡、
// 专辑/歌单行与内页头、顺序菜单、状态与重试。断言覆盖 story 的 I/O 矩阵。
let host: HTMLDivElement;

const classesOf = (el: Element) =>
  (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
const allClasses = () =>
  Array.from(host.querySelectorAll("*"))
    .map((el) => el.getAttribute("class") ?? "")
    .join(" ");

const song = {
  title: "晴天",
  author: "周杰伦",
  coverImg: "https://example.com/a.jpg",
  websiteUrl: "https://music.163.com/#/song?id=1",
  duration: 269,
  neteaseMusic: { id: 1, fee: 0 },
} as unknown as PlatformData;

const secondSong = {
  ...song,
  title: "鱼",
  neteaseMusic: { id: 2, fee: 0 },
} as unknown as PlatformData;

const video = {
  title: "某视频",
  author: "某 UP",
  coverImg: "https://example.com/b.jpg",
  websiteUrl: "https://www.bilibili.com/video/BV1",
  duration: 65,
  bilibili: { bvid: "BV1" },
} as unknown as PlatformData;

const live = {
  title: "正在直播",
  author: "主播",
  coverImg: "https://example.com/c.jpg",
  websiteUrl: "https://live.bilibili.com/1",
  bilibiliLive: { roomid: 1 },
} as unknown as PlatformData;

const album = {
  title: "华丽的冒险",
  author: "陈绮贞",
  coverImg: "https://example.com/a.jpg",
  websiteUrl: "https://music.163.com/#/album?id=3",
  trackCount: "24",
  multiPage: Promise.resolve({ platform: "neteasemusic" }),
  neteaseMusic: { id: 3, fee: 0, isAlbum: true },
} as unknown as PlatformData;

const context = () => ({
  switchToMultiPage: vi.fn(),
  switchToOutFromMultiPage: vi.fn(),
  currentOnDemandPlay: vi.fn(),
  updateCurrentInMultiPageStatus: vi.fn(),
  onRowActivate: vi.fn(),
  ShowOrHideIMC: vi.fn(),
});

let ctx: ReturnType<typeof context>;

const withCtx = (child: ComponentChild) =>
  h(MediaContainerContext.Provider, { value: ctx }, child);

/** 挂载并把组件内部的 effect / 状态更新冲干净；给了 settle 时等数据落地。 */
const mount = async (node: ComponentChild, settle?: Promise<unknown>) => {
  await act(async () => {
    render(node, host);
  });
  await act(async () => {
    await settle;
  });
};

const ready = (platformData: PlatformData[], totalPage = 1) =>
  Promise.resolve({ platformData, totalPage });

const results = (props: Record<string, unknown>) =>
  withCtx(h(ResultsArea, props as never));

const resultsBase = {
  settingsData: null,
  viewMode: "list" as const,
  mode: MODE.music,
  scopeIndex: 0,
  keyword: "",
  onRetry: () => {},
  onClearSearch: () => {},
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  ctx = context();
  delete (window as Window & { mediaShareRoom?: boolean }).mediaShareRoom;
  document.getElementById("shareMediaSongName")?.remove();
});

afterEach(() => {
  render(null, host);
  host.remove();
  document.getElementById("shareMediaSongName")?.remove();
  vi.unstubAllGlobals();
});

describe("纯函数派生", () => {
  it("时长 mm:ss、曲目数「N 首」", () => {
    expect(formatDuration(269)).toBe("04:29");
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(undefined)).toBe("");
    expect(trackCountLabel("24")).toBe("24 首");
    expect(trackCountLabel(undefined)).toBe("");
  });

  it("专辑 / 歌单与直播条目可识别", () => {
    expect(isCollectionItem(album)).toBe(true);
    expect(isCollectionItem(song)).toBe(false);
    expect(isLiveItem(live)).toBe(true);
    expect(isLiveItem(video)).toBe(false);
  });

  it("形态由模式 / 范围 / 视图 / 内页派生", () => {
    const base = {
      mode: MODE.music,
      scopeIndex: 0,
      viewMode: "list" as const,
      isInnerPage: false,
    };
    expect(shapeOf(base)).toBe("tracklist");
    expect(shapeOf({ ...base, viewMode: "card" })).toBe("musicGrid");
    expect(shapeOf({ ...base, scopeIndex: 1 })).toBe("collections");
    expect(shapeOf({ ...base, scopeIndex: 2 })).toBe("collections");
    expect(shapeOf({ ...base, scopeIndex: 3 })).toBe("videoGrid");
    expect(shapeOf({ ...base, isInnerPage: true, scopeIndex: 3 })).toBe(
      "tracklist",
    );
    // 视频：列表 / 网格都跟着视图切换走（音乐 MV 只有网格）
    expect(shapeOf({ ...base, mode: MODE.video })).toBe("tracklist");
    expect(shapeOf({ ...base, mode: MODE.video, viewMode: "card" })).toBe(
      "videoGrid",
    );
    expect(shapeOf({ ...base, mode: MODE.radio })).toBe("radio");
    expect(shapeOf({ ...base, mode: MODE.favorites })).toBe("favorites");
    // 收藏网格：混排条目统一方形卡
    expect(shapeOf({ ...base, mode: MODE.favorites, viewMode: "card" })).toBe(
      "favoritesGrid",
    );
    expect(shapeOf({ ...base, mode: MODE.settings })).toBe("settings");
  });

  it("无悬停宽屏才点按选中；jsdom 无 matchMedia 时按有悬停处理", () => {
    expect(isTapToReveal()).toBe(false);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("hover"),
    }));
    expect(isTapToReveal()).toBe(true);
  });
});

describe("令牌纪律", () => {
  it("新补的令牌成对（浅 / 深各一份）", () => {
    const singleTheme = new Set([
      "deskOnRose",
      "deskOnRoseFill",
      "deskDurationPill",
      "deskVideoScrim",
      "deskSearchShadow",
    ]);
    for (const [name, value] of Object.entries(tokens)) {
      if (typeof value !== "string" || singleTheme.has(name)) continue;
      if (!/(bg|text|border|caret|outline|shadow)-\[#/.test(value)) continue;
      expect(`${name}: ${value}`).toContain("imw-dark:");
    }
  });

  it("渲染结果不含 themed / accentVar / rgba，悬停类都以 hov: 开头", async () => {
    await mount(
      withCtx(
        h(TracklistRow, { platformData: song, index: 1, onPlay: () => {} }),
      ),
    );
    const rendered = allClasses();
    expect(rendered).not.toContain("themed");
    expect(rendered).not.toContain("accentVar");
    expect(rendered).not.toContain("rgba(");
    // 悬停类：含 hover: 的类必须带 hov: 前缀（触屏不触发、不残留）
    for (const cls of rendered.split(/\s+/).filter((c) => c.includes("hover:")))
      expect(cls).toContain("hov:");
  });

  it("星标、骨架、封面内环、时长胶囊、视频遮罩都用令牌", () => {
    for (const token of [
      tokens.deskStarOn,
      tokens.deskSkeleton,
      tokens.deskCoverRing,
      tokens.deskDurationPill,
      tokens.deskVideoScrim,
      tokens.deskRowHover,
      tokens.deskSendHover,
    ]) {
      expect(token).not.toContain("rgba(");
    }
  });
});

describe("组件源码的令牌纪律", () => {
  const sources: Record<string, string> = {
    "CollectionHeader.tsx": collectionHeaderSrc,
    "CollectionRow.tsx": collectionRowSrc,
    "Cover.tsx": coverSrc,
    "FavoriteStar.tsx": favoriteStarSrc,
    "MusicTile.tsx": musicTileSrc,
    "OrderMenu.tsx": orderMenuSrc,
    "ResultsArea.tsx": resultsAreaSrc,
    "Skeletons.tsx": skeletonsSrc,
    "StateMessage.tsx": stateMessageSrc,
    "TracklistRow.tsx": tracklistSrc,
    "VideoTile.tsx": videoTileSrc,
  };

  it("不裸写颜色、不引 themed / accentVar（颜色只从令牌来）", () => {
    for (const [name, source] of Object.entries(sources)) {
      expect(`${name} themed: ${/themed|accentVar/.test(source)}`).toBe(
        `${name} themed: false`,
      );
      expect(`${name} rgba: ${/rgba\(/.test(source)}`).toBe(
        `${name} rgba: false`,
      );
      expect(`${name} hex: ${/(bg|text|border)-\[#/.test(source)}`).toBe(
        `${name} hex: false`,
      );
    }
  });

  it("悬停效果一律在 hov: 下：没有裸 hover:，group-hover 只出现在 hov: 之后", () => {
    for (const [name, source] of Object.entries(sources)) {
      // 允许的两种形态剥掉后，任何残留的 `hover:` 都是漏了 hov: 门控
      const stripped = source
        .split("hov:group-hover:")
        .join("")
        .split("hov:hover:")
        .join("");
      expect(`${name}: ${stripped.includes("hover:")}`).toBe(`${name}: false`);
    }
  });
});

describe("封面", () => {
  it("http 升级为 https，裁切填满并挂内环", async () => {
    expect(upgradeCoverUrl("http://a/b.jpg")).toBe("https://a/b.jpg");
    expect(upgradeCoverUrl("https://a/b.jpg")).toBe("https://a/b.jpg");

    await mount(h(Cover, { src: "http://a/b.jpg" }));
    const img = host.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://a/b.jpg");
    expect(classesOf(img)).toContain("object-cover");
    expect(host.firstElementChild!.getAttribute("class")).toContain(
      "shadow-[inset_0_0_0_1px_#0000000F]",
    );
  });

  it("加载失败回退 thumb 底 + 自包含图标，不留破图", async () => {
    await mount(h(Cover, { src: "https://a/b.jpg", icon: "note" }));
    const img = host.querySelector("img")!;
    await act(async () => {
      img.dispatchEvent(new Event("error"));
    });
    expect(host.querySelector("img")).toBeNull();
    const fallback = host.querySelector("[data-imw-cover-fallback]")!;
    expect(fallback.querySelector("svg")).not.toBeNull();
    expect(host.firstElementChild!.getAttribute("class")).toContain(
      "bg-[#E6E0D6]",
    );
  });
});

describe("曲目表", () => {
  it("桌面七列 / 手机五列（含收藏星）；表头仅桌面", async () => {
    await mount(
      withCtx(
        h("div", {}, [
          h(TracklistHeader, { durationLabel: "时长" }),
          h(TracklistRow, { platformData: song, index: 1, onPlay: () => {} }),
        ]),
      ),
    );
    const header = host.querySelector("[data-imw-tracklist-header]")!;
    expect(classesOf(header)).toEqual(
      expect.arrayContaining([
        "grid-cols-[38px_56px_1.6fr_1fr_74px_44px_96px]",
        "max-[768px]:grid-cols-[48px_1fr_auto_40px_40px]",
        "h-[34px]",
        "max-[768px]:hidden",
      ]),
    );
    expect(header.textContent).toContain("#");
    expect(header.textContent).toContain("标题");
    expect(header.textContent).toContain("出处");
    expect(header.textContent).toContain("时长");

    const row = host.querySelector("[data-imw-tracklist-row]")!;
    expect(classesOf(row)).toEqual(
      expect.arrayContaining([
        "grid-cols-[38px_56px_1.6fr_1fr_74px_44px_96px]",
        "max-[768px]:grid-cols-[48px_1fr_auto_40px_40px]",
      ]),
    );
    expect(row.textContent).toContain("01");
    expect(row.textContent).toContain("晴天");
    expect(row.textContent).toContain("周杰伦");
    expect(row.textContent).toContain("网易云");
    expect(row.textContent).toContain("04:29");
    // 手机隐藏序号、出处、星标
    const hidden = Array.from(row.children).filter((el) =>
      classesOf(el).includes("max-[768px]:hidden"),
    );
    expect(hidden.length).toBeGreaterThanOrEqual(3);
  });

  it("房间正在播放：三根音柱替换序号、标题蔷薇红、歌手后缀", async () => {
    await mount(
      withCtx(
        h(TracklistRow, {
          platformData: song,
          index: 1,
          nowPlaying: true,
          onPlay: () => {},
        }),
      ),
    );
    const row = host.querySelector("[data-imw-tracklist-row]")!;
    expect(row.getAttribute("data-now-playing")).toBe("true");
    const bars = row.querySelectorAll("[data-imw-now-playing]");
    expect(bars).toHaveLength(1);
    expect(bars[0].children).toHaveLength(3);
    expect(row.textContent).toContain("· 房间正在播放");
    expect(row.textContent).not.toContain("01");
    expect(row.innerHTML).toContain("text-[#B42F3E]");
  });

  it("标题缺失时不误标正在播放", () => {
    expect(isNowPlayingTitle("", song)).toBe(false);
    expect(
      isNowPlayingTitle("晴天", { ...song, title: "" } as PlatformData),
    ).toBe(false);
    expect(isNowPlayingTitle("晴天", song)).toBe(true);
  });

  it("点播按钮：房间支持时调 onPlay，房间不支持时灰化并提示", async () => {
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    const onPlay = vi.fn();
    await mount(withCtx(h(RequestButton, { onPlay })));
    const button = host.querySelector("button")!;
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(button.getAttribute("title")).toBe("点播到房间");
    expect(classesOf(button)).toEqual(
      expect.arrayContaining(["h-8", "rounded-full"]),
    );
    expect(classesOf(button)).toContain("hov:group-hover:bg-[#B42F3E]");
    button.click();
    expect(onPlay).toHaveBeenCalledOnce();

    render(null, host);
    await mount(withCtx(h(RequestButton, { supported: false, onPlay })));
    const disabled = host.querySelector("button")!;
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    expect(disabled.getAttribute("title")).toBe("这个房间不支持点播");
    expect(classesOf(disabled)).toContain("opacity-40");
    expect(classesOf(disabled)).not.toContain("hov:group-hover:bg-[#B42F3E]");
    disabled.click();
    expect(show).toHaveBeenCalledWith("这个房间不支持点播");
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("点播按钮状态：点播中转圈不可再点，重试晃一下", async () => {
    const onPlay = vi.fn();
    await mount(withCtx(h(RequestButton, { onPlay, status: "pending" })));
    const pending = host.querySelector("button")!;
    expect(pending.textContent).toBe("点播中");
    expect(pending.getAttribute("aria-busy")).toBe("true");
    expect(pending.getAttribute("aria-disabled")).toBe("true");
    expect(host.querySelector("svg")!.getAttribute("class")).toContain(
      "animate-spin",
    );
    pending.click();
    expect(onPlay).not.toHaveBeenCalled();

    render(null, host);
    await mount(withCtx(h(RequestButton, { onPlay, status: "failed" })));
    const failed = host.querySelector("button")!;
    expect(failed.textContent).toBe("重试");
    expect(classesOf(failed)).toContain("animate-[imwShake_360ms_ease-in-out]");
    failed.click();
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("房间不支持点播：roomSupportsRequest / notifyRoomUnsupported 是唯一出口", () => {
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    expect(roomSupportsRequest()).toBe(true);
    (window as Window & { mediaShareRoom?: boolean }).mediaShareRoom = false;
    expect(roomSupportsRequest()).toBe(false);
    notifyRoomUnsupported();
    expect(show).toHaveBeenCalledWith("这个房间不支持点播");
  });

  it("电台行没有序号、出处与星标", async () => {
    await mount(
      withCtx(
        h(TracklistRow, {
          platformData: {
            title: "某电台",
            author: "",
            coverImg: "",
            websiteUrl: "",
            radio: { isradio: true, id: 1 },
          } as unknown as PlatformData,
          index: 1,
          variant: "radio",
          onPlay: () => {},
        }),
      ),
    );
    const row = host.querySelector("[data-imw-tracklist-row]")!;
    expect(row.querySelectorAll('button[aria-label="收藏"]')).toHaveLength(0);
    expect(row.querySelectorAll("button")).toHaveLength(1);
    expect(row.textContent).not.toContain("01");
    expect(row.textContent).not.toContain("网易云");
  });
});

describe("音乐网格卡", () => {
  it("1:1 封面、单行标题、歌手 · 等宽时长、标题行右端收藏星（手机也显示）", async () => {
    await mount(
      withCtx(
        h(MusicTile, {
          platformData: song,
          onPlay: () => {},
        }),
      ),
    );
    expect(host.querySelector(".aspect-square")).not.toBeNull();
    expect(host.textContent).toContain("晴天");
    expect(host.textContent).toContain("04:29");
    const star = host.querySelector('button[aria-label="收藏"]')!;
    expect(star.parentElement!.getAttribute("class")).not.toContain(
      "max-[768px]:hidden",
    );
  });

  it("悬停遮罩与「点播」胶囊只在 hov: 下出现，键盘聚焦同样显示", async () => {
    await mount(
      withCtx(h(MusicTile, { platformData: song, onPlay: () => {} })),
    );
    const overlay = host.querySelector(".bg-\\[\\#0A090861\\]")!;
    expect(overlay.getAttribute("class")).toContain(
      "hov:group-hover:opacity-100",
    );
    expect(overlay.getAttribute("class")).toContain(
      "group-focus-within:opacity-100",
    );
    const capsule = Array.from(host.querySelectorAll("button")).find(
      (el) => el.textContent === "点播",
    )!;
    expect(capsule.getAttribute("class")).toContain(
      "hov:group-hover:pointer-events-auto",
    );
  });

  it("16:9 缩略图 + 右下等宽时长胶囊", async () => {
    await mount(
      withCtx(h(VideoTile, { platformData: video, onPlay: () => {} })),
    );
    expect(host.querySelector(".aspect-video")).not.toBeNull();
    const pill = host.querySelector(
      ".pointer-events-none.absolute.bottom-2.right-2",
    )!;
    expect(pill.textContent).toBe("01:05");
    expect(pill.getAttribute("class")).toContain("bg-[#0C0B0AB8]");
  });

  it("直播卡换「直播」徽章、不显示时长", async () => {
    await mount(
      withCtx(h(VideoTile, { platformData: live, onPlay: () => {} })),
    );
    const badge = host.querySelector(
      ".pointer-events-none.absolute.bottom-2.right-2",
    )!;
    expect(badge.textContent).toBe("直播");
    expect(badge.getAttribute("class")).toContain("bg-[#B42F3E]");
    expect(host.textContent).not.toContain("00:00");
  });

  it("无悬停宽屏：第一次点按只选中（描边），再点按钮才点播", async () => {
    const onReveal = vi.fn();
    const onPlay = vi.fn();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("hover"),
    }));

    await mount(
      withCtx(h(VideoTile, { platformData: video, onReveal, onPlay })),
    );
    const body = host.querySelector("button[data-imw-tile-body]")!;
    // 无悬停宽屏第一次点按只是「选中」，读屏名不该说成点播
    expect(body.getAttribute("aria-label")).toBe("查看 某视频");
    (body as HTMLElement).click();
    expect(onReveal).toHaveBeenCalledOnce();
    expect(onPlay).not.toHaveBeenCalled();

    render(null, host);
    await mount(
      withCtx(h(VideoTile, { platformData: video, revealed: true, onPlay })),
    );
    expect(
      host.querySelector(".shadow-\\[0_0_0_2px_\\#1C1916\\]"),
    ).not.toBeNull();
    const overlay = host.querySelector(".bg-\\[\\#0A090861\\]")!;
    expect(overlay.getAttribute("class")).toContain("opacity-100");
    const capsule = Array.from(host.querySelectorAll("button")).find(
      (el) => el.textContent === "点播到房间",
    )!;
    capsule.click();
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("手机不常显胶囊：点卡片走操作条，胶囊只在悬停/选中时出现", async () => {
    await mount(
      withCtx(h(VideoTile, { platformData: video, onPlay: () => {} })),
    );
    const overlay = host.querySelector(".bg-\\[\\#0A090861\\]")!;
    expect(overlay.getAttribute("class")).not.toContain(
      "max-[768px]:opacity-100",
    );
  });
});

describe("专辑 / 歌单行与内页头", () => {
  it("桌面：只有封面、标题与「查看」进内页，点行空白处不进（星标好点）", async () => {
    const onOpen = vi.fn();
    await mount(
      withCtx(h(CollectionRow, { platformData: album, index: 1, onOpen })),
    );
    const row = host.querySelector("[data-imw-collection-row]")!;
    expect(row.textContent).toContain("24 首");
    expect(row.querySelector('button[aria-label^="点播"]')).toBeNull();
    (row as HTMLElement).click();
    expect(onOpen).not.toHaveBeenCalled();

    const view = host.querySelector<HTMLElement>(
      'button[aria-label="查看 华丽的冒险"]',
    )!;
    expect(view.textContent).toBe("查看");
    view.click();
    expect(onOpen).toHaveBeenCalledTimes(1);

    host.querySelector<HTMLElement>('button[title="查看 华丽的冒险"]')!.click();
    expect(onOpen).toHaveBeenCalledTimes(2);

    host.querySelector<HTMLElement>('button[title="查看"]')!.click();
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it("手机：整行点按进内页", async () => {
    const onOpen = vi.fn();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    try {
      await mount(
        withCtx(h(CollectionRow, { platformData: album, index: 1, onOpen })),
      );
      (host.querySelector("[data-imw-collection-row]") as HTMLElement).click();
      expect(onOpen).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("内页头：返回、名称、曲目数与「全部播放」", async () => {
    const onBack = vi.fn();
    await mount(
      withCtx(
        h(CollectionHeader, {
          title: album.title,
          trackCount: album.trackCount,
          onBack,
          onPlayAll: () => {},
        }),
      ),
    );
    expect(host.textContent).toContain("华丽的冒险");
    expect(host.textContent).toContain("24 首");
    const back = Array.from(host.querySelectorAll("button")).find(
      (el) => el.textContent === "返回",
    )!;
    back.click();
    expect(onBack).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("全部播放");
  });

  it("顺序菜单：正序 / 乱序；Esc 与点外侧只取消，不点播，也不碰 buildSelect2", async () => {
    const buildSelect = vi.spyOn(NetEasePlatform, "buildSelect");
    const onPlayAll = vi.fn();
    await mount(
      withCtx(
        h(CollectionHeader, {
          title: album.title,
          trackCount: album.trackCount,
          onBack: () => {},
          onPlayAll,
        }),
      ),
    );
    const trigger = Array.from(host.querySelectorAll("button")).find((el) =>
      el.textContent?.includes("全部播放"),
    )!;
    await act(async () => {
      trigger.click();
    });

    const menu = document.querySelector<HTMLElement>("[data-imw-order-menu]")!;
    expect(menu).not.toBeNull();
    expect(menu.querySelector('[role="menu"]')).not.toBeNull();
    const items = menu.querySelectorAll('[role="menuitem"]');
    expect(Array.from(items).map((el) => el.textContent)).toEqual([
      "正序播放",
      "乱序播放",
    ]);

    // Esc：只关菜单（层级栈的一层，关掉后栈为空）
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(document.querySelector("[data-imw-order-menu]")).toBeNull();
    expect(hasOverlayLayers()).toBe(false);
    expect(onPlayAll).not.toHaveBeenCalled();

    // 点外侧：取消
    await act(async () => {
      trigger.click();
    });
    await act(async () => {
      (document.querySelector("[data-imw-order-menu]") as HTMLElement).click();
    });
    expect(document.querySelector("[data-imw-order-menu]")).toBeNull();
    expect(onPlayAll).not.toHaveBeenCalled();

    // 选定乱序：按该顺序整张点播
    await act(async () => {
      trigger.click();
    });
    await act(async () => {
      const shuffle = Array.from(
        document.querySelectorAll('[role="menuitem"]'),
      ).find((el) => el.textContent === "乱序播放") as HTMLElement;
      shuffle.click();
    });
    expect(onPlayAll).toHaveBeenCalledWith("shuffle");
    expect(document.querySelector("[data-imw-order-menu]")).toBeNull();
    expect(buildSelect).not.toHaveBeenCalled();
  });

  it("房间不支持点播时「全部播放」灰化并提示", async () => {
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    (window as Window & { mediaShareRoom?: boolean }).mediaShareRoom = false;
    await mount(
      withCtx(
        h(CollectionHeader, {
          title: album.title,
          trackCount: album.trackCount,
          onBack: () => {},
          onPlayAll: () => {},
        }),
      ),
    );
    const trigger = Array.from(host.querySelectorAll("button")).find((el) =>
      el.textContent?.includes("全部播放"),
    )!;
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    expect(classesOf(trigger)).toContain("opacity-40");
    await act(async () => {
      trigger.click();
    });
    expect(show).toHaveBeenCalledWith("这个房间不支持点播");
    expect(document.querySelector("[data-imw-order-menu]")).toBeNull();
  });
});

describe("结果区状态机", () => {
  it("音乐首屏（未搜索）显示空历史文案", async () => {
    await mount(results({ ...resultsBase, mediaData: null }));
    expect(host.textContent).toContain(
      "还没有点播记录。搜索歌名或歌手，点播到房间。",
    );
  });

  it("收藏为空显示引导；有关键词时是「没有匹配的收藏」+「清除搜索」", async () => {
    const empty = ready([]);
    await mount(
      results({ ...resultsBase, mode: MODE.favorites, mediaData: empty }),
      empty,
    );
    expect(host.textContent).toContain("还没有收藏。在曲目旁点星标即可收藏。");

    render(null, host);
    const onClearSearch = vi.fn();
    const filtered = ready([]);
    await mount(
      results({
        ...resultsBase,
        mode: MODE.favorites,
        keyword: "abc",
        onClearSearch,
        mediaData: filtered,
      }),
      filtered,
    );
    expect(host.textContent).toContain("没有匹配的收藏");
    const clear = Array.from(host.querySelectorAll("button")).find(
      (el) => el.textContent === "清除搜索",
    )!;
    clear.click();
    expect(onClearSearch).toHaveBeenCalledOnce();
  });

  it("电台过滤无结果文案", async () => {
    const empty = ready([]);
    await mount(
      results({
        ...resultsBase,
        mode: MODE.radio,
        keyword: "abc",
        mediaData: empty,
      }),
      empty,
    );
    expect(host.textContent).toContain("没有匹配的电台");
  });

  it("搜索无结果文案", async () => {
    const empty = ready([]);
    await mount(
      results({ ...resultsBase, keyword: "abc", mediaData: empty }),
      empty,
    );
    expect(host.textContent).toContain("没有找到结果。换个关键词试试。");
  });

  it("加载中是静态骨架（列表骨架行 / 网格骨架瓦片）", async () => {
    const pending = new Promise<never>(() => {});
    await mount(results({ ...resultsBase, mediaData: pending }));
    expect(
      host.querySelectorAll("[data-imw-skeleton-row]").length,
    ).toBeGreaterThan(0);

    render(null, host);
    await mount(
      results({
        ...resultsBase,
        keyword: "晴天",
        viewMode: "card",
        mediaData: pending,
      }),
    );
    expect(
      host.querySelectorAll("[data-imw-skeleton-tile]").length,
    ).toBeGreaterThan(0);
  });

  it("失败显示「加载失败」+「重试」，点重试回调外层", async () => {
    const onRetry = vi.fn();
    const failing = Promise.reject(new Error("x"));
    failing.catch(() => {});
    await mount(
      results({ ...resultsBase, onRetry, mediaData: failing }),
      failing.catch(() => {}),
    );
    expect(host.textContent).toContain("加载失败");
    const retry = Array.from(host.querySelectorAll("button")).find(
      (el) => el.textContent === "重试",
    )!;
    // 手机可点目标 ≥ 44px（DESIGN text-button.hit-area）
    expect(classesOf(retry)).toContain("min-h-[44px]");
    retry.click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("结果按范围出形态：音乐列表出七列表头，网格出瓦片，专辑出专辑行", async () => {
    const songs = ready([song, secondSong]);
    await mount(results({ ...resultsBase, mediaData: songs }), songs);
    expect(host.querySelectorAll("[data-imw-tracklist-row]")).toHaveLength(2);
    expect(host.querySelector("[data-imw-tracklist-header]")).not.toBeNull();

    render(null, host);
    const oneSong = ready([song]);
    await mount(
      results({
        ...resultsBase,
        keyword: "晴天",
        viewMode: "card",
        mediaData: oneSong,
      }),
      oneSong,
    );
    expect(host.querySelectorAll("[data-imw-tile]")).toHaveLength(1);

    render(null, host);
    const collection = ready([album]);
    await mount(
      results({ ...resultsBase, scopeIndex: 1, mediaData: collection }),
      collection,
    );
    expect(host.querySelectorAll("[data-imw-collection-row]")).toHaveLength(1);
    expect(host.textContent).toContain("曲目数");
  });

  it("点播走 currentOnDemandPlay；房间不支持时只提示不发报文", async () => {
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    const songs = ready([song]);
    await mount(results({ ...resultsBase, mediaData: songs }), songs);
    (
      host.querySelector('button[aria-label="点播 晴天"]') as HTMLElement
    ).click();
    expect(ctx.currentOnDemandPlay).toHaveBeenCalledWith(song);

    render(null, host);
    (window as Window & { mediaShareRoom?: boolean }).mediaShareRoom = false;
    const again = ready([song]);
    await mount(results({ ...resultsBase, mediaData: again }), again);
    const disabled = host.querySelector('button[aria-label="点播 晴天"]')!;
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    (disabled as HTMLElement).click();
    expect(show).toHaveBeenCalledWith("这个房间不支持点播");
    expect(ctx.currentOnDemandPlay).toHaveBeenCalledTimes(1);
  });

  it("专辑行进入内页：先标记内页再载入集合", async () => {
    const collection = ready([album]);
    await mount(
      results({ ...resultsBase, scopeIndex: 1, mediaData: collection }),
      collection,
    );
    await act(async () => {
      host
        .querySelector<HTMLElement>('button[aria-label="查看 华丽的冒险"]')!
        .click();
    });
    expect(ctx.updateCurrentInMultiPageStatus).toHaveBeenCalledWith(true);
    expect(ctx.switchToMultiPage).toHaveBeenCalledWith(album);
  });

  it("房间正在播放：标题匹配的行显示音柱", async () => {
    const name = document.createElement("div");
    name.id = "shareMediaSongName";
    name.textContent = "鱼";
    document.body.append(name);
    const songs = ready([song, secondSong]);
    await mount(results({ ...resultsBase, mediaData: songs }), songs);
    const rows = host.querySelectorAll("[data-imw-tracklist-row]");
    expect(rows[0].getAttribute("data-now-playing")).toBeNull();
    expect(rows[1].getAttribute("data-now-playing")).toBe("true");
  });

  it("播放结束后宿站不清歌名：isShareMediaPlaying 为 false 时不再标「正在播放」", async () => {
    vi.useFakeTimers();
    const win = window as unknown as {
      Utils?: { service?: { isShareMediaPlaying?: () => boolean } };
    };
    let playing = true;
    win.Utils = { service: { isShareMediaPlaying: () => playing } };
    try {
      const name = document.createElement("div");
      name.id = "shareMediaSongName";
      name.textContent = "鱼";
      document.body.append(name);
      const songs = ready([song, secondSong]);
      await mount(results({ ...resultsBase, mediaData: songs }), songs);
      const rows = () => host.querySelectorAll("[data-imw-tracklist-row]");
      expect(rows()[1].getAttribute("data-now-playing")).toBe("true");

      // 放完了：歌名节点还在，但宿站说没在播
      playing = false;
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(rows()[1].getAttribute("data-now-playing")).toBeNull();
      expect(host.textContent).not.toContain("房间正在播放");

      // 又开始放：恢复
      playing = true;
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(rows()[1].getAttribute("data-now-playing")).toBe("true");
    } finally {
      delete win.Utils;
      vi.useRealTimers();
    }
  });

  it("房间切歌后 1s 内跟着切换；卸载后停止轮询", async () => {
    vi.useFakeTimers();
    try {
      const name = document.createElement("div");
      name.id = "shareMediaSongName";
      name.textContent = "晴天";
      document.body.append(name);
      const songs = ready([song, secondSong]);
      await mount(results({ ...resultsBase, mediaData: songs }), songs);
      const rows = () => host.querySelectorAll("[data-imw-tracklist-row]");
      expect(rows()[0].getAttribute("data-now-playing")).toBe("true");

      name.textContent = "鱼";
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(rows()[0].getAttribute("data-now-playing")).toBeNull();
      expect(rows()[1].getAttribute("data-now-playing")).toBe("true");

      // 卸载即退订：轮询定时器随之清掉
      render(null, host);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("分页后序号续接（pageOffset）", async () => {
    const songs = ready([song]);
    await mount(
      results({ ...resultsBase, mediaData: songs, pageOffset: 10 }),
      songs,
    );
    const row = host.querySelector("[data-imw-tracklist-row]")!;
    expect(row.textContent).toContain("11");
  });

  it("内页空列表给内页文案；专辑 / 歌单范围未搜索时不说「搜索歌名」", async () => {
    const empty = ready([]);
    await mount(
      results({ ...resultsBase, isInnerPage: true, mediaData: empty }),
      empty,
    );
    expect(host.textContent).toContain("这张列表没有曲目。");

    const emptyAlbum = ready([]);
    await mount(
      results({ ...resultsBase, scopeIndex: 1, mediaData: emptyAlbum }),
      emptyAlbum,
    );
    expect(host.textContent).not.toContain("搜索歌名或歌手");
    expect(host.textContent).toContain("没有找到结果。");
  });

  it("点封面打开来源页；没有来源网址时不渲染覆盖按钮", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await mount(
      withCtx(h(TracklistRow, { platformData: song, index: 1, onPlay() {} })),
    );
    (
      host.querySelector('button[aria-label="打开来源页：晴天"]') as HTMLElement
    ).click();
    expect(open).toHaveBeenCalledWith(song.websiteUrl);

    render(null, host);
    await mount(
      withCtx(
        h(TracklistRow, {
          platformData: { ...song, websiteUrl: "" } as PlatformData,
          index: 1,
          onPlay() {},
        }),
      ),
    );
    expect(host.querySelector('[aria-label^="打开来源页"]')).toBeNull();
  });

  it("视频卡也标「房间正在播放」", async () => {
    await mount(
      withCtx(
        h(VideoTile, { platformData: video, nowPlaying: true, onPlay() {} }),
      ),
    );
    expect(host.querySelector("[data-imw-now-playing]")).not.toBeNull();
  });

  it("内页进出保留外层滚动位置（返回同一份外层结果时）", async () => {
    const outer = ready([song]);
    await mount(results({ ...resultsBase, mediaData: outer }), outer);
    const scroller = host.querySelector<HTMLElement>("[data-imw-results]")!;
    scroller.scrollTop = 120;
    scroller.dispatchEvent(new Event("scroll"));

    const inner = ready([song]);
    await mount(
      results({ ...resultsBase, isInnerPage: true, mediaData: inner }),
      inner,
    );
    expect(scroller.scrollTop).toBe(0);

    // 返回：容器把外层那份数据承诺原样放回 → 还原位置
    await mount(
      results({ ...resultsBase, isInnerPage: false, mediaData: outer }),
      outer,
    );
    expect(scroller.scrollTop).toBe(120);

    // 内页里发起新搜索（数据承诺变了）→ 回到顶部，不还原旧位置
    const searched = ready([song]);
    await mount(
      results({ ...resultsBase, isInnerPage: false, mediaData: searched }),
      searched,
    );
    expect(scroller.scrollTop).toBe(0);
  });

  it("设置数据按组卡渲染（一组一张卡，行语义由数据声明）", async () => {
    await mount(
      results({
        ...resultsBase,
        mode: MODE.settings,
        mediaData: null,
        settingsData: [
          {
            title: "视频设置",
            items: [
              {
                key: "a",
                title: "画质",
                actionTitle: "1080P",
                icon: "film",
                action: () => {},
              },
            ],
          },
        ],
      }),
    );
    const card = host.querySelector("[data-imw-settings-group]")!;
    expect(card).not.toBeNull();
    expect(card.querySelector("h2")!.textContent).toBe("视频设置");
    expect(
      host.querySelector('[data-imw-settings-row="value"]'),
    ).not.toBeNull();

    // 页面级布局：卡列随内容区收敛（最大 760px）、卡间 24px（DESIGN `settings-group.note`）
    const page = card.parentElement!;
    expect(page.className).toContain("gap-6");
    expect(page.className).toContain("max-w-[760px]");
    expect(page.className).toContain("flex-col");
    expect(page.children).toHaveLength(1);
  });

  it("组名为空 ⇒ 关于卡：关于模式与手机在设置内点「关于」得到同一张卡", async () => {
    const aboutGroups: SettingGroupData[] = [
      {
        title: "",
        items: [
          {
            key: "aboutSource",
            title: "项目源代码地址",
            actionTitle: "GitHub",
            external: true,
            icon: "github",
            action: () => {},
          },
        ],
      },
    ];

    for (const mode of [MODE.about, MODE.settings]) {
      await mount(
        results({
          ...resultsBase,
          mode,
          mediaData: null,
          settingsData: aboutGroups,
        }),
      );
      const card = host.querySelector("[data-imw-about-card]")!;
      expect(card).not.toBeNull();
      // 没有组名标题，也不是带组名的组卡
      expect(card.querySelector("h2")).toBeNull();
      expect(host.querySelector("[data-imw-settings-group]")).toBeNull();
      await act(async () => {
        render(null, host);
      });
    }
  });
});

describe("音乐首屏「最近点播」", () => {
  it("列表视图：标题在表头之前、行照常渲染", async () => {
    const songs = ready([song]);
    await mount(
      results({ ...resultsBase, viewMode: "list", mediaData: songs }),
      songs,
    );
    const heading = host.querySelector("h2")!;
    expect(heading.textContent).toBe("最近点播");
    expect(heading.getAttribute("class")).toContain(tokens.typeLabelStrong);

    const header = host.querySelector("[data-imw-tracklist-header]")!;
    expect(header).not.toBeNull();
    expect(
      heading.compareDocumentPosition(header) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(host.querySelectorAll("[data-imw-tracklist-row]")).toHaveLength(1);
    expect(host.querySelectorAll("[data-imw-tile]")).toHaveLength(0);
  });

  it("网格视图：标题照常显示，条目渲染为方形卡", async () => {
    const songs = ready([song]);
    await mount(
      results({ ...resultsBase, viewMode: "card", mediaData: songs }),
      songs,
    );
    expect(host.querySelector("h2")!.textContent).toBe("最近点播");
    expect(host.querySelectorAll('[data-imw-tile="music"]')).toHaveLength(1);
    expect(host.querySelectorAll("[data-imw-tracklist-row]")).toHaveLength(0);
  });

  it("首屏没有历史：只给新文案，不出现「最近点播」标题", async () => {
    const empty = ready([]);
    await mount(results({ ...resultsBase, mediaData: empty }), empty);
    expect(host.textContent).toContain(
      "还没有点播记录。搜索歌名或歌手，点播到房间。",
    );
    expect(host.querySelector("h2")).toBeNull();
  });

  it("有关键词即回到普通搜索：没有标题，视图跟着切换走", async () => {
    const songs = ready([song]);
    await mount(
      results({
        ...resultsBase,
        keyword: "晴天",
        viewMode: "card",
        mediaData: songs,
      }),
      songs,
    );
    expect(host.textContent).not.toContain("最近点播");
    expect(host.querySelectorAll("[data-imw-tile]")).toHaveLength(1);
  });
});

describe("收藏模式取消收藏", () => {
  it("取消收藏后行仍留在列表里（星标转空心），不即时摘行", async () => {
    vi.spyOn(FavoritesStorageService, "init").mockResolvedValue(null);
    vi.spyOn(FavoritesStorageService, "onExternalChange").mockReturnValue(
      () => {},
    );
    vi.spyOn(FavoritesStorageService, "onChange").mockReturnValue(() => {});
    const isFavorited = vi
      .spyOn(FavoritesStorageService, "isFavorited")
      .mockReturnValue(true);
    const toggle = vi
      .spyOn(FavoritesStorageService, "toggle")
      .mockImplementation(async () => {
        isFavorited.mockReturnValue(false);
        return { isFavorited: false } as never;
      });
    const data = ready([song, secondSong]);
    await mount(
      results({ ...resultsBase, mode: MODE.favorites, mediaData: data }),
      data,
    );

    const rows = () => host.querySelectorAll("[data-imw-tracklist-row]");
    expect(rows()).toHaveLength(2);

    const star = host.querySelector<HTMLButtonElement>(
      '[aria-label="取消收藏"]',
    )!;
    await act(async () => {
      star.click();
    });

    // 行数不变：只把星标翻成空心（重新加载列表前保留该行）
    expect(toggle).toHaveBeenCalledOnce();
    expect(rows()).toHaveLength(2);
    expect(host.querySelectorAll('[aria-label="取消收藏"]')).toHaveLength(1);
  });
});

describe("收藏的出处列", () => {
  it("B 站收藏行显示 B站圆点 + 简称", async () => {
    const favorite = { ...video, title: "收藏的视频" } as PlatformData;
    const data = ready([favorite]);
    await mount(
      results({ ...resultsBase, mode: MODE.favorites, mediaData: data }),
      data,
    );
    const row = host.querySelector("[data-imw-tracklist-row]")!;
    expect(row.textContent).toContain("B站");
    expect(row.innerHTML).toContain("bg-[#E1608C]");
  });
});

describe("收藏里的专辑 / 歌单", () => {
  it("列表：与搜索结果同一种歌单行，「查看」进内页", async () => {
    const data = ready([album, song]);
    await mount(
      results({ ...resultsBase, mode: MODE.favorites, mediaData: data }),
      data,
    );
    expect(host.querySelectorAll("[data-imw-collection-row]")).toHaveLength(1);
    expect(host.querySelectorAll("[data-imw-tracklist-row]")).toHaveLength(1);
    await act(async () => {
      host
        .querySelector<HTMLElement>('button[aria-label="查看 华丽的冒险"]')!
        .click();
    });
    expect(ctx.switchToMultiPage).toHaveBeenCalledWith(album);
  });

  it("网格：专辑卡的胶囊是「查看」，点了进内页而不是点播", async () => {
    const data = ready([album]);
    await mount(
      results({
        ...resultsBase,
        mode: MODE.favorites,
        viewMode: "card",
        mediaData: data,
      }),
      data,
    );
    const capsule = Array.from(host.querySelectorAll("button")).find(
      (el) => el.textContent === "查看",
    )!;
    await act(async () => {
      capsule.click();
    });
    expect(ctx.switchToMultiPage).toHaveBeenCalledWith(album);
    expect(ctx.currentOnDemandPlay).not.toHaveBeenCalled();
  });
});

describe("内页头", () => {
  it("有视图切换；「全部播放」只在自身悬停时变实心", async () => {
    await mount(
      withCtx(
        h(CollectionHeader, {
          title: album.title,
          trackCount: album.trackCount,
          viewMode: "list",
          onToggleView: () => {},
          onBack: () => {},
          onPlayAll: () => {},
        }),
      ),
    );
    expect(host.querySelector('[role="radiogroup"]')).not.toBeNull();
    const playAll = Array.from(host.querySelectorAll("button")).find((el) =>
      el.textContent?.includes("全部播放"),
    )!;
    expect(playAll.getAttribute("class")).toContain("hov:hover:bg-[#B42F3E]");
    expect(playAll.getAttribute("class")).not.toContain("group-hover");
  });

  it("内页跟着视图切换：网格时音乐为方形卡", () => {
    const base = {
      mode: MODE.music,
      scopeIndex: 1,
      viewMode: "card" as const,
      isInnerPage: true,
    };
    expect(shapeOf(base)).toBe("musicGrid");
    expect(shapeOf({ ...base, viewMode: "list" })).toBe("tracklist");
  });
});

describe("骨架与音柱小组件", () => {
  it("骨架行与瓦片是静态色块，无动画", async () => {
    await mount(h(SkeletonRows, { count: 2 }));
    expect(host.querySelectorAll("[data-imw-skeleton-row]")).toHaveLength(2);
    expect(allClasses()).not.toContain("animate-");
    render(null, host);
    await mount(h(SkeletonTiles, { count: 2, aspect: "square" }));
    expect(host.querySelectorAll("[data-imw-skeleton-tile]")).toHaveLength(2);
    expect(host.querySelectorAll(".aspect-square")).toHaveLength(2);
  });

  it("音柱三根、可换色（时长胶囊上用 on-rose）", async () => {
    await mount(h(NowPlayingBars, { tone: tokens.deskOnRoseFill }));
    const bars = host.querySelectorAll("span");
    expect(bars).toHaveLength(4); // 容器 + 三根
    expect(host.innerHTML).toContain("bg-[#FFFFFF]");
  });
});

describe("收藏星", () => {
  const star = () => host.querySelector("button")!;

  beforeEach(() => {
    vi.spyOn(FavoritesStorageService, "init").mockResolvedValue(null);
    vi.spyOn(FavoritesStorageService, "onExternalChange").mockReturnValue(
      () => {},
    );
  });

  it("已收藏：实心星 + star 色 + aria-pressed", async () => {
    vi.spyOn(FavoritesStorageService, "isFavorited").mockReturnValue(true);
    await mount(withCtx(h(FavoriteStar, { platformData: song })));
    expect(star().getAttribute("aria-pressed")).toBe("true");
    expect(star().getAttribute("aria-label")).toBe("取消收藏");
    expect(star().getAttribute("class")).toContain(tokens.deskStarOn);
    // 实心星：路径填充实色；空心星是描边
    expect(host.innerHTML).toContain('fill="currentColor"');
  });

  it("未收藏：空心星 + ink3", async () => {
    vi.spyOn(FavoritesStorageService, "isFavorited").mockReturnValue(false);
    await mount(withCtx(h(FavoriteStar, { platformData: song })));
    expect(star().getAttribute("aria-pressed")).toBe("false");
    expect(star().getAttribute("class")).toContain(tokens.deskInk3);
    expect(host.innerHTML).toContain('fill="none"');
  });

  it("其它入口（手机操作条）切换收藏后，挂载中的星标即时跟随", async () => {
    const isFavorited = vi
      .spyOn(FavoritesStorageService, "isFavorited")
      .mockReturnValue(false);
    let notify: () => void = () => {};
    vi.spyOn(FavoritesStorageService, "onChange").mockImplementation(
      (listener) => {
        notify = listener;
        return () => {};
      },
    );
    await mount(withCtx(h(FavoriteStar, { platformData: song })));
    expect(star().getAttribute("aria-pressed")).toBe("false");
    expect(star().getAttribute("aria-label")).toBe("收藏");

    // 操作条写入收藏后存储广播变更：仍挂载的星标重读并翻转
    isFavorited.mockReturnValue(true);
    await act(async () => {
      notify();
    });
    expect(star().getAttribute("aria-pressed")).toBe("true");
    expect(star().getAttribute("aria-label")).toBe("取消收藏");
    expect(star().getAttribute("class")).toContain(tokens.deskStarOn);
  });

  it("toggle 跟随返回值；失败回滚到点击前的状态", async () => {
    vi.spyOn(FavoritesStorageService, "isFavorited").mockReturnValue(false);
    const toggle = vi
      .spyOn(FavoritesStorageService, "toggle")
      .mockResolvedValue({ isFavorited: true } as never);
    await mount(withCtx(h(FavoriteStar, { platformData: song })));

    await act(async () => {
      star().click();
    });
    expect(toggle).toHaveBeenCalledOnce();
    expect(star().getAttribute("aria-pressed")).toBe("true");

    toggle.mockRejectedValueOnce(new Error("quota exceeded"));
    await act(async () => {
      star().click();
    });
    // 乐观更新到 false 后失败 → 回到 true，不与存储脱节
    expect(star().getAttribute("aria-pressed")).toBe("true");
  });

  it("连点只认第一次：toggle 未落地前的第二次点击被丢弃", async () => {
    vi.spyOn(FavoritesStorageService, "isFavorited").mockReturnValue(false);
    let settle: (value: never) => void = () => {};
    const toggle = vi
      .spyOn(FavoritesStorageService, "toggle")
      .mockImplementation(
        () => new Promise((resolve) => (settle = resolve)) as never,
      );
    await mount(withCtx(h(FavoriteStar, { platformData: song })));

    await act(async () => {
      star().click();
      star().click();
    });
    expect(toggle).toHaveBeenCalledOnce();
    await act(async () => {
      settle({ isFavorited: true } as never);
    });
    expect(star().getAttribute("aria-pressed")).toBe("true");
  });

  it("存储层就绪后重读：慢速 IndexedDB 下已收藏的条目不会显示成空心星", async () => {
    let resolveInit: (value: null) => void = () => {};
    vi.spyOn(FavoritesStorageService, "init").mockImplementation(
      () => new Promise<null>((resolve) => (resolveInit = resolve)) as never,
    );
    const isFavorited = vi
      .spyOn(FavoritesStorageService, "isFavorited")
      .mockReturnValue(false);
    await mount(withCtx(h(FavoriteStar, { platformData: song })));
    expect(star().getAttribute("aria-pressed")).toBe("false");

    isFavorited.mockReturnValue(true);
    await act(async () => {
      resolveInit(null);
      await Promise.resolve();
    });
    expect(star().getAttribute("aria-pressed")).toBe("true");
  });

  it("不可收藏的条目返回 null", async () => {
    await mount(
      withCtx(
        h(FavoriteStar, {
          platformData: { title: "无来源", websiteUrl: "" } as PlatformData,
        }),
      ),
    );
    expect(host.querySelector("button")).toBeNull();
  });
});

describe("多 P / 多集的选集入口已退场", () => {
  it("卡片上不再有过渡「选集」钮（story 5 换成操作条 / 点播直接开面板）", async () => {
    const multi = {
      ...video,
      multiPage: Promise.resolve({ platform: "bilibili" }),
    } as unknown as PlatformData;
    await mount(
      withCtx(h(VideoTile, { platformData: multi, onPlay: () => {} })),
    );
    expect(
      Array.from(host.querySelectorAll("button")).find(
        (el) => el.textContent === "选集",
      ),
    ).toBeUndefined();

    render(null, host);
    await mount(
      withCtx(h(MusicTile, { platformData: song, onPlay: () => {} })),
    );
    expect(
      Array.from(host.querySelectorAll("button")).find(
        (el) => el.textContent === "选集",
      ),
    ).toBeUndefined();
  });

  it("多 P 条目的音乐网格卡只剩「点播」：回调照常派发（面板由平台在点播链路里开）", async () => {
    const onPlay = vi.fn();
    await mount(
      withCtx(
        h(MusicTile, {
          platformData: {
            ...song,
            multiPage: Promise.resolve({ platform: "neteasemusic" }),
          } as PlatformData,
          onPlay,
        }),
      ),
    );
    const play = Array.from(host.querySelectorAll("button")).find(
      (el) => el.textContent === "点播",
    )!;
    await act(async () => {
      play.click();
    });
    expect(onPlay).toHaveBeenCalledOnce();
    expect(
      Array.from(host.querySelectorAll("button")).find(
        (el) => el.textContent === "选集",
      ),
    ).toBeUndefined();
  });
});

describe("B 站课程卡：桌面保留内页钻取入口", () => {
  it("课程卡带「选集」文字钮，点击钻取课程分集内页（面板服务不了课程）", async () => {
    const course = {
      ...video,
      title: "某课程",
      bilibili: { aid: 1, course_id: 2 },
      multiPage: Promise.resolve({ platform: "bilibili" }),
    } as unknown as PlatformData;
    const videos = ready([course]);
    await mount(
      results({
        ...resultsBase,
        mode: MODE.video,
        viewMode: "card",
        mediaData: videos,
      }),
      videos,
    );
    const select = Array.from(host.querySelectorAll("button")).find(
      (el) => el.textContent === "选集",
    )!;
    expect(select).toBeDefined();
    // 操作条已取消：这个入口手机上也显示
    expect(select.getAttribute("class")).not.toContain("max-[768px]:hidden");
    await act(async () => {
      select.click();
    });
    expect(ctx.updateCurrentInMultiPageStatus).toHaveBeenCalledWith(true);
    expect(ctx.switchToMultiPage).toHaveBeenCalledWith(course);
  });

  it("普通多 P 卡没有这个入口：选集由面板接管", async () => {
    const multi = {
      ...video,
      multiPage: Promise.resolve({ platform: "bilibili" }),
    } as unknown as PlatformData;
    const videos = ready([multi]);
    await mount(
      results({
        ...resultsBase,
        mode: MODE.video,
        viewMode: "card",
        mediaData: videos,
      }),
      videos,
    );
    expect(
      Array.from(host.querySelectorAll("button")).find(
        (el) => el.textContent === "选集",
      ),
    ).toBeUndefined();
  });
});

describe("手机：没有操作条，收藏星与点播钮直接在行 / 卡上", () => {
  /** 只把宽度判成手机：`hover: none` 不成立。 */
  const phoneLayout = () =>
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width: 768px"),
    }));

  it("手机点音乐网格卡主体：先显示「点播」胶囊，不直接点播", async () => {
    phoneLayout();
    const songs = ready([song]);
    await mount(
      results({ ...resultsBase, viewMode: "card", mediaData: songs }),
      songs,
    );
    const tile = host.querySelector<HTMLElement>('[data-imw-tile="music"]')!;
    await act(async () => {
      tile.querySelector<HTMLElement>('[data-imw-tile-body="true"]')!.click();
    });
    expect(tile.getAttribute("data-revealed")).toBe("true");
    expect(ctx.currentOnDemandPlay).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("手机曲目行：点行体什么都不做；收藏星可见，点播钮照常点播", async () => {
    phoneLayout();
    const songs = ready([song]);
    await mount(results({ ...resultsBase, mediaData: songs }), songs);
    const row = host.querySelector<HTMLElement>("[data-imw-tracklist-row]")!;
    await act(async () => {
      row.click();
    });
    expect(ctx.currentOnDemandPlay).not.toHaveBeenCalled();
    const star = row.querySelector('button[aria-label="收藏"]')!;
    expect(star.parentElement!.getAttribute("class")).not.toContain(
      "max-[768px]:hidden",
    );
    expect(star.getAttribute("class")).toContain("max-[768px]:h-10");
    // 手机行里的星图标放大到 24px
    expect(star.querySelector("svg")!.getAttribute("class")).toContain(
      "max-[768px]:h-6",
    );
    await act(async () => {
      row.querySelector<HTMLElement>('button[aria-label^="点播 "]')!.click();
    });
    expect(ctx.currentOnDemandPlay).toHaveBeenCalledWith(song);
    vi.unstubAllGlobals();
  });
});
