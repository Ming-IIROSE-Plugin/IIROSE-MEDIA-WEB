// story 8：两个浮窗（播放进度、收藏随机）换新配色后的可验证契约（CAP-12）。
// 覆盖 I/O 矩阵的主题取值、零裸色值与「外框无投影 + 实底蔷薇红焦点环」。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, render } from "preact";
import { act } from "preact/test-utils";
import type { MediaHost } from "../../../media-progress/HostMediaBridge";
import { HostMediaBridge } from "../../../media-progress/HostMediaBridge";
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import { MediaProgress } from "../media-progress/MediaProgress";
import { ShufflePicker } from "../shuffle-picker/ShufflePicker";
import {
  deskFocusRingOnRose,
  deskInk,
  deskOnRose,
  deskRoseSolid,
} from "./tokens";

let host: MediaHost;
let root: HTMLDivElement;

const hostElement = (id: string) => document.getElementById(id)!;
const progressPanel = () => hostElement("imw-media-progress");
const shuffleDialog = () => hostElement("imw-shuffle-picker");
const shuffleLayer = () => root.querySelector<HTMLElement>("[data-imw-theme]")!;

/** 渲染结果里的全部 class 串（只查配色来源，不查几何）。 */
const classes = (node: Element) =>
  [node, ...Array.from(node.querySelectorAll("*"))]
    .map((element) => element.getAttribute("class") ?? "")
    .join(" ");

const classesOf = (element: Element) =>
  (element.getAttribute("class") ?? "").split(/\s+/);

/** 桥接宿站主题：`theme` 为假值时深色（与宿站语义一致）。 */
function makeHost(): MediaHost {
  return {
    theme: 1,
    shareMediaCurrentTime: 30,
    shareMediaDuration: 120,
    socket: { readyState: 1, send: () => {} },
    mediaShareRoom: true,
    rank: "0",
    myself: "",
    Info: { room: { identity: 1 } },
    Utils: {
      service: {
        isShareMediaPlaying: () => true,
        seekDemandMedia: () => {},
      },
    },
  };
}

function mountProgress() {
  const bridge = new HostMediaBridge(host, document, () => {});
  act(() => {
    render(h(MediaProgress, { bridge, close: () => {} }), root);
  });
  return bridge;
}

/** 一条最小可用收藏：把列表与勾选框渲染出来（配色断言需要真实节点）。 */
const favorite = {
  id: "netease:song:1",
  platform: "netease",
  type: "song",
  title: "晴天",
  coverImg: "http://p1.music.126.net/cover.jpg",
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

async function mountShuffle(
  dark: boolean,
  options: { records?: FavoriteRecord[]; error?: string } = {},
) {
  await act(async () => {
    render(
      h(ShufflePicker, {
        platforms: ["netease"],
        initialPlatform: "netease",
        dark,
        load: async () => ({ records: options.records ?? [], saved: null }),
        error: options.error,
        onConfirm: () => {},
        onCancel: () => {},
      }),
      root,
    );
  });
  // 收藏在 `load` 的 then 里落地：每拍单独 act，等列表/勾选框真正渲染。
  for (let tick = 0; tick < 4; tick += 1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
  host = makeHost();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  root = document.createElement("div");
  document.body.appendChild(root);
});

afterEach(() => {
  render(null, root);
  root.remove();
  vi.unstubAllGlobals();
});

describe("浮窗根节点的 data-imw-theme", () => {
  it("播放进度：宿站浅色写 light，深色写 dark", () => {
    const light = mountProgress();
    expect(progressPanel().getAttribute("data-imw-theme")).toBe("light");
    render(null, root);
    light.dispose();

    host.theme = 0;
    const dark = mountProgress();
    try {
      expect(progressPanel().getAttribute("data-imw-theme")).toBe("dark");
    } finally {
      dark.dispose();
    }
  });

  it("播放进度：打开期间宿站换主题，下一次快照后跟着变", () => {
    const bridge = mountProgress();
    try {
      expect(progressPanel().getAttribute("data-imw-theme")).toBe("light");
      host.theme = 0;
      act(() => {
        host.Utils!.service!.seekDemandMedia!();
      });
      expect(progressPanel().getAttribute("data-imw-theme")).toBe("dark");
      host.theme = 1;
      act(() => {
        host.Utils!.service!.seekDemandMedia!();
      });
      expect(progressPanel().getAttribute("data-imw-theme")).toBe("light");
    } finally {
      render(null, root);
      bridge.dispose();
    }
  });

  it("收藏随机：根节点取打开时算好的 dark，打开期间不跟随", async () => {
    await mountShuffle(true);
    expect(shuffleLayer().getAttribute("data-imw-theme")).toBe("dark");
    await mountShuffle(false);
    expect(shuffleLayer().getAttribute("data-imw-theme")).toBe("light");
  });
});

describe("两个浮窗外框与强调色", () => {
  it("播放进度：sheet 底 + rule 描边 + xl 圆角，无投影", () => {
    const bridge = mountProgress();
    try {
      const panel = progressPanel();
      const list = classesOf(panel);
      expect(list).toEqual(
        expect.arrayContaining([
          "rounded-2xl",
          "border",
          "border-solid",
          "bg-[#FBFAF7]",
          "imw-dark:bg-[#1C1A18]",
          "border-[#E2DCD1]",
          "imw-dark:border-[#2B2825]",
          "text-[#1C1916]",
          "imw-dark:text-[#EDE7DD]",
        ]),
      );
      expect(classes(panel)).not.toContain("shadow-[0_12");
      // 头部图标与滑块强调色：蔷薇红，不是天蓝。
      expect(classes(panel)).toContain("text-[#B42F3E]");
      expect(classes(panel)).toContain("accent-[#B42F3E]");
    } finally {
      render(null, root);
      bridge.dispose();
    }
  });

  it("收藏随机：sheet 底 + rule 描边 + xl 圆角，无投影", async () => {
    await mountShuffle(true);
    const list = classesOf(shuffleDialog());
    expect(list).toEqual(
      expect.arrayContaining([
        "rounded-2xl",
        "border",
        "border-solid",
        "bg-[#FBFAF7]",
        "imw-dark:bg-[#1C1A18]",
        "border-[#E2DCD1]",
        "imw-dark:border-[#2B2825]",
      ]),
    );
    expect(classes(shuffleDialog())).not.toContain("shadow-[0_12");
  });

  it("实底蔷薇红主按钮：on-rose 字色 + paper 内环焦点环", async () => {
    await mountShuffle(true);
    const primary = Array.from(
      shuffleDialog().querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.trim() === "开始随机")!;
    const list = classesOf(primary);
    for (const token of `${deskRoseSolid} ${deskOnRose} ${deskFocusRingOnRose}`.split(
      /\s+/,
    ))
      expect(list).toContain(token);
    expect(list).toEqual(
      expect.arrayContaining([
        "focus-visible:outline-[#1C1916]",
        "imw-dark:focus-visible:outline-[#EDE7DD]",
        "focus-visible:shadow-[inset_0_0_0_2px_#F5F2EC]",
        "imw-dark:focus-visible:shadow-[inset_0_0_0_2px_#141312]",
      ]),
    );
  });
});

describe("实底蔷薇红零件（勾选、权重分段、错误行）", () => {
  const solidTokens = `${deskRoseSolid} ${deskOnRose}`.split(/\s+/);

  it("勾选选中：描边与实底取蔷薇红、字色 on-rose", async () => {
    await mountShuffle(true, { records: [favorite] });
    // 单条收藏初始即选中：勾选框内层方块直接取实底蔷薇红。
    const box = shuffleDialog().querySelector<HTMLElement>(
      '[role="checkbox"][aria-checked="true"] > span',
    )!;
    const list = classesOf(box);
    expect(list).toContain("border-[#B42F3E]");
    expect(list).toContain("imw-dark:border-[#E3606C]");
    for (const token of solidTokens) expect(list).toContain(token);
  });

  it("权重分段选中：实底蔷薇红；未选中走按压底色", async () => {
    await mountShuffle(true);
    const radios = Array.from(
      shuffleDialog().querySelectorAll<HTMLElement>('[role="radio"]'),
    );
    const selected = radios.find(
      (radio) => radio.getAttribute("aria-checked") === "true",
    )!;
    const idle = radios.find(
      (radio) => radio.getAttribute("aria-checked") === "false",
    )!;
    for (const token of solidTokens)
      expect(classesOf(selected)).toContain(token);
    expect(classesOf(idle)).toContain("hov:hover:bg-[#EFEBE3]");
    expect(classesOf(idle)).not.toContain("bg-[#B42F3E]");
  });

  it("底栏错误行：保留 role=alert，字色取 ink 令牌（不用蔷薇红）", async () => {
    await mountShuffle(true, {
      records: [favorite],
      error: "保存失败，请重试",
    });
    const alert = shuffleDialog().querySelector<HTMLElement>('[role="alert"]')!;
    expect(alert.textContent).toBe("保存失败，请重试");
    for (const token of deskInk.split(/\s+/))
      expect(classesOf(alert)).toContain(token);
    expect(classesOf(alert)).not.toContain("text-red-500");
    expect(classesOf(alert)).not.toContain("text-[#B42F3E]");
  });
});

describe("零裸色值", () => {
  it("渲染结果里没有 sky- / themed / accentVar / rgba", async () => {
    const bridge = mountProgress();
    const progress = classes(progressPanel());
    render(null, root);
    bridge.dispose();
    await mountShuffle(true);
    const shuffle = classes(shuffleLayer());
    for (const dump of [progress, shuffle])
      expect(dump).not.toMatch(/sky-|themed|accentVar|rgba\(/);
  });

  it("源码里不出现裸颜色值（颜色只来自 tokens.ts）", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const base = join(process.cwd(), "src", "page", "components");
    const dirs = ["floating-panel", "media-progress", "shuffle-picker"];
    const files: string[] = [];
    for (const dir of dirs) {
      const path = join(base, dir);
      for (const name of readdirSync(path) as string[]) {
        if (!name.endsWith(".tsx")) continue;
        // 面板的装配层不含样式；浮窗源码只扫组件本身。
        if (name === "openShufflePicker.tsx") continue;
        files.push(join(path, name));
      }
    }
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const name = file.slice(file.lastIndexOf("/") + 1);
      expect(
        `${name}: ${source.match(/#[0-9a-fA-F]{3,8}/g) ?? "无裸色值"}`,
      ).toBe(`${name}: 无裸色值`);
      expect(source).not.toMatch(/sky-|themed|accentVar|rgba\(|mdi-/);
    }
  });
});
