import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, render, type VNode } from "preact";
import { act } from "preact/test-utils";
import { MediaCardImg, isVideoCover } from "./MediaCardImg";
import { MediaCardInfo } from "./MediaCardInfo";
import { MediaCardButton } from "./MediaCardButton";
import { MediaCardMessage } from "./MediaCardMessage";
import { MediaListRow } from "./MediaListRow";
import { MediaCard } from "./MediaCard";
import { Provider } from "../media-container-context/MediaContainerContext";
import { themedCard } from "../floating-panel/floatingPanel";
import { FavoriteStarButton } from "./FavoriteStarButton";
import { FavoritesStorageService } from "../../../storage/FavoritesStorageService";

// 结果卡片、列表行、空状态与加载（spec-main-panel-visual-unify story 2）：
// 浅色白卡片/深色次级表面、封面裁切（视频 16:9、音乐方形）、时长胶囊、强调色按钮。
let host: HTMLDivElement;
const classesOf = (el: Element) => el.className.split(/\s+/);

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  render(null, host);
  host.remove();
});

const song = {
  title: "晴天",
  author: "周杰伦",
  coverImg: "https://example.com/a.jpg",
  websiteUrl: "https://music.163.com/song?id=1",
  duration: 269,
  neteaseMusic: { id: 1, fee: 0 },
} as unknown as PlatformData;

const video = {
  title: "视频",
  author: "UP",
  coverImg: "https://example.com/b.jpg",
  websiteUrl: "https://www.bilibili.com/video/BV1",
  duration: 65,
  bilibili: { bvid: "BV1" },
} as unknown as PlatformData;

const ctx = {
  switchToMultiPage: () => {},
  currentOnDemandPlay: vi.fn(),
  updateCurrentInMultiPageStatus: () => {},
  ShowOrHideIMC: vi.fn(),
};
const withCtx = (child: VNode<any>) => h(Provider, { value: ctx }, child);

describe("卡片表面令牌", () => {
  it("浅色白底 + black/8 描边 + 轻阴影；深色次级表面 + white/10 描边、无阴影", () => {
    expect(themedCard.split(" ")).toEqual(
      expect.arrayContaining([
        "bg-white",
        "border-black/8",
        "imw-dark:bg-white/[0.04]",
        "imw-dark:border-white/10",
        "imw-dark:shadow-none",
      ]),
    );
  });
});

describe("封面", () => {
  it("视频来源 16:9、音乐方形，均 object-cover 无黑底", () => {
    expect(isVideoCover(video)).toBe(true);
    expect(
      isVideoCover({
        ...song,
        neteaseMusic: { id: 2, fee: 0, isMV: true },
      } as PlatformData),
    ).toBe(true);
    expect(
      isVideoCover({ ...song, playList: [{}] } as unknown as PlatformData),
    ).toBe(true);
    expect(
      isVideoCover({ ...song, playList: [] } as unknown as PlatformData),
    ).toBe(false);
    expect(
      isVideoCover({
        ...song,
        neteaseMusic: undefined,
        bilibiliLive: { roomid: 1 },
      } as unknown as PlatformData),
    ).toBe(true);
    expect(isVideoCover(song)).toBe(false);

    render(h(MediaCardImg, { src: video.coverImg, platformData: video }), host);
    expect(classesOf(host.firstElementChild!)).toContain("aspect-video");
    const img = host.querySelector("img")!;
    expect(classesOf(img)).toContain("object-cover");
    expect(classesOf(img)).not.toContain("object-contain");
    expect(img.style.backgroundColor).toBe("");

    render(h(MediaCardImg, { src: song.coverImg, platformData: song }), host);
    expect(classesOf(host.firstElementChild!)).toContain("aspect-square");
  });

  it("时长为右下角深色半透明胶囊；空值不渲染", () => {
    render(h(MediaCardImg, { src: video.coverImg, platformData: video }), host);
    const chip = host.firstElementChild!.lastElementChild!;
    expect(chip.textContent).toBe("视频 / 01:05");
    expect(classesOf(chip)).toEqual(
      expect.arrayContaining([
        "absolute",
        "bottom-2",
        "right-2",
        "rounded-full",
        "bg-black/60",
        "text-white",
      ]),
    );
    const bare = {
      title: "x",
      author: "",
      coverImg: "https://e/x.jpg",
      websiteUrl: "",
    } as unknown as PlatformData;
    render(h(MediaCardImg, { src: bare.coverImg, platformData: bare }), host);
    expect(host.firstElementChild!.querySelectorAll("div")).toHaveLength(0);
  });

  it("点击封面与胶囊仍打开网页", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(h(MediaCardImg, { src: video.coverImg, platformData: video }), host);
    (host.querySelector("img") as HTMLElement).click();
    (host.firstElementChild!.lastElementChild as HTMLElement).click();
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith(video.websiteUrl);
  });

  it("列表小图仍为固定尺寸并裁切", () => {
    render(
      h(MediaCardImg, {
        src: song.coverImg,
        platformData: song,
        compact: true,
      }),
      host,
    );
    expect(classesOf(host.firstElementChild!)).toEqual(
      expect.arrayContaining(["w-[72px]", "h-[72px]", "max-[768px]:w-[56px]"]),
    );
    expect(classesOf(host.querySelector("img")!)).toContain("object-cover");
  });
});

describe("卡片文字", () => {
  it("标题 14px semibold、作者 12px 次要色，颜色随面板主题继承", () => {
    render(h(MediaCardInfo, { platformData: song }), host);
    const root = host.firstElementChild!;
    expect(root.className).not.toMatch(/text-\[rgba/);
    expect(classesOf(root)).toContain("grow");
    const title = root.firstElementChild!;
    expect(classesOf(title)).toContain("font-semibold");
    expect(classesOf(title.firstElementChild!)).toContain("text-[14px]");
    const author = root.lastElementChild!;
    expect(author.textContent).toBe("周杰伦");
    expect(classesOf(author)).toEqual(
      expect.arrayContaining(["text-[12px]", "opacity-65"]),
    );
  });
});

describe("播放按钮", () => {
  it("播放为强调色实心白字、44px 高，无行内品牌色；点击照常点播", async () => {
    render(withCtx(h(MediaCardButton, { platformData: song })), host);
    await act(async () => {});
    const play = host.querySelector(".MediaCardButtonContainer") as HTMLElement;
    expect(classesOf(play)).toEqual(
      expect.arrayContaining([
        "bg-(color:--imw-accent)",
        "text-white",
        "h-11",
        "rounded-lg",
      ]),
    );
    expect(play.getAttribute("style")).toBeNull();
    play.click();
    expect(ctx.ShowOrHideIMC).toHaveBeenCalled();
    expect(ctx.currentOnDemandPlay).toHaveBeenCalledWith(song);
  });

  it("有选集时第二钮为强调色描边次要钮", async () => {
    const multi = {
      ...video,
      multiPage: Promise.resolve({ platform: "bilibili" }),
    } as unknown as PlatformData;
    render(withCtx(h(MediaCardButton, { platformData: multi })), host);
    await act(async () => {
      await multi.multiPage;
    });
    const buttons = host.querySelectorAll(".MediaCardButtonContainer");
    expect(buttons).toHaveLength(2);
    expect(buttons[1].textContent).toBe("选集");
    expect(classesOf(buttons[1])).toEqual(
      expect.arrayContaining([
        "border-(color:--imw-accent)/45",
        "text-(color:--imw-accent-ink)",
        "bg-transparent",
      ]),
    );
  });

  it("列表行内联按钮：强调色淡底与图标，无行内品牌色", async () => {
    render(
      withCtx(h(MediaCardButton, { platformData: song, variant: "compact" })),
      host,
    );
    await act(async () => {});
    const group = host.firstElementChild!;
    expect(classesOf(group)).toEqual(
      expect.arrayContaining([
        "bg-(color:--imw-accent)/10",
        "text-(color:--imw-accent-ink)",
        "h-[72px]",
      ]),
    );
    expect(host.querySelectorAll("[style]")).toHaveLength(0);
  });
});

describe("列表行", () => {
  it("与卡片同表面令牌，文字继承主题色", async () => {
    render(withCtx(h(MediaListRow, { platformData: song })), host);
    await act(async () => {});
    const row = host.firstElementChild!;
    for (const c of themedCard.split(" ")) expect(classesOf(row)).toContain(c);
    expect(row.className).not.toMatch(/bg-white\/50|text-\[rgba/);
    expect(row.textContent).toContain("晴天");
  });
});

describe("结果网格", () => {
  it("卡片用表面令牌，网格行保持 max-content", async () => {
    const data = Promise.resolve({ platformData: [song, video], totalPage: 1 });
    const draw = (mediaData: typeof data | null) =>
      render(
        withCtx(
          h(MediaCard, { mediaData, settingsData: null, viewMode: "card" }),
        ),
        host,
      );
    // 数据经 componentDidUpdate 载入（与面板实际流程一致）
    draw(null);
    await act(async () => {
      draw(data);
      await data;
    });
    const grid = host.firstElementChild!;
    expect(classesOf(grid)).toContain("[grid-auto-rows:max-content]");
    expect(grid.children).toHaveLength(2);
    for (const card of Array.from(grid.children)) {
      expect(classesOf(card)).toEqual(
        expect.arrayContaining([
          "rounded-xl",
          "bg-white",
          "imw-dark:bg-white/[0.04]",
        ]),
      );
      expect(card.className).not.toMatch(/backdrop-blur|bg-white\/50/);
    }
  });
});

describe("空状态与加载", () => {
  it.each([0, 1, 2])(
    "message=%i 用强调色（浅色品牌、深色天蓝），无行内品牌色",
    (message) => {
      render(withCtx(h(MediaCardMessage, { message })), host);
      const wrapper = host.firstElementChild!;
      // 图形与转圈用 fill，说明文字用 ink
      expect(classesOf(wrapper)).toContain("text-(color:--imw-accent)");
      const caption = wrapper.querySelector(".font-bold");
      if (caption)
        expect(classesOf(caption)).toContain("text-(color:--imw-accent-ink)");
      expect(wrapper.getAttribute("style")).toBeNull();
    },
  );
});

describe("列表行内联收藏星标", () => {
  const draw = async (favorited: boolean) => {
    vi.spyOn(FavoritesStorageService, "init").mockResolvedValue(null);
    vi.spyOn(FavoritesStorageService, "isFavorited").mockReturnValue(favorited);
    render(
      h(FavoriteStarButton, { platformData: song, variant: "inline" }),
      host,
    );
    await act(async () => {});
    return host.querySelector(`[title]`)!.firstElementChild!;
  };

  it("已收藏：金色星标，无行内样式", async () => {
    const icon = await draw(true);
    expect(classesOf(icon)).toContain("text-[#fbc02d]");
    expect(icon.getAttribute("style")).toBeNull();
  });

  it("未收藏：浅色 black/45、深色 white/55，无行内样式", async () => {
    const icon = await draw(false);
    expect(classesOf(icon)).toEqual(
      expect.arrayContaining(["text-black/45", "imw-dark:text-white/55"]),
    );
    expect(classesOf(icon)).not.toContain("text-[#fbc02d]");
    expect(icon.getAttribute("style")).toBeNull();
  });
});
