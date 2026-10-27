import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import { FavoritesStorageService } from "../../../storage/FavoritesStorageService";
import { NeteaseMusicAPI } from "../../../Api/NeteaseAPI/NeteaseMusic";
import {
  loadShufflePlatform,
  loadShuffleSelection,
  saveShufflePlatform,
  saveShuffleSelection,
  SHUFFLE_PLATFORMS,
} from "../../../playback/ShuffleSelection";
import {
  PREPARE_TIMEOUT_MS,
  SHUFFLE_PICKER_ROOT_ID,
  openShufflePicker,
  releaseShufflePicker,
} from "./openShufflePicker";
import { clearTrackCache } from "./trackLoader";

vi.mock("../../../storage/FavoritesStorageService", () => ({
  FavoritesStorageService: { query: vi.fn() },
}));
vi.mock("../../../Api/NeteaseAPI/NeteaseMusic", () => ({
  NeteaseMusicAPI: {
    getSongListDetail: vi.fn(),
    getAlbumDetail: vi.fn(),
    getNeteaseSongDetail: vi.fn(),
  },
}));

const query = FavoritesStorageService.query as unknown as ReturnType<
  typeof vi.fn
>;
const songList = NeteaseMusicAPI.getSongListDetail as unknown as ReturnType<
  typeof vi.fn
>;
const album = NeteaseMusicAPI.getAlbumDetail as unknown as ReturnType<
  typeof vi.fn
>;
const songDetail =
  NeteaseMusicAPI.getNeteaseSongDetail as unknown as ReturnType<typeof vi.fn>;

function record(
  type: FavoriteRecord["type"],
  raw: string,
  patch: Partial<FavoriteRecord> = {},
): FavoriteRecord {
  return {
    id: `netease:${type}:${raw}`,
    platform: "netease",
    type,
    title: `标题${raw}`,
    coverImg: "http://p1.music.126.net/cover.jpg",
    author: "作者",
    websiteUrl: "",
    createdAt: 1,
    updatedAt: 1,
    platformData: {
      title: "",
      coverImg: "",
      author: "",
      websiteUrl: "",
      neteaseMusic: { id: Number(raw), fee: 0 },
    },
    ...patch,
  } as FavoriteRecord;
}

const A = record("song", "1", { title: "晴天", author: "周杰伦" });
const P = record("playlist", "2", { title: "通勤歌单", trackCount: "3" });
const B = record("song", "3", { title: "后来", author: "刘若英" });
const tracks = [
  { id: 11, name: "七里香", ar: [{ name: "周杰伦" }] },
  { id: 12, name: "夜曲", ar: [{ name: "周杰伦" }] },
  { id: 13, name: "红豆", ar: [{ name: "王菲" }] },
];

/** 只确认网易云标签时的回调参数。 */
const confirmed = (selection: unknown) => ({
  platform: "netease",
  selections: { netease: selection },
});

/** 某平台被读取收藏的次数。 */
const calls = (platform: string) =>
  query.mock.calls.filter(([filter]) => filter?.platform === platform).length;

const root = () => document.getElementById(SHUFFLE_PICKER_ROOT_ID);
const dialog = () => document.getElementById("imw-shuffle-picker")!;
const buttons = () =>
  Array.from(dialog().querySelectorAll<HTMLButtonElement>("button"));
const button = (text: string) =>
  buttons().find((node) => node.textContent?.trim() === text)!;
const byLabel = (label: string) =>
  dialog().querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
const checkbox = (label: string) =>
  dialog().querySelector<HTMLElement>(
    `[role="checkbox"][aria-label="${label}"]`,
  )!;
const text = () => dialog().textContent ?? "";

async function flush(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function click(element: Element) {
  await act(async () => {
    (element as HTMLElement).click();
  });
  await flush();
}

async function key(element: Element, value: string, shiftKey = false) {
  await act(async () => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: value,
        shiftKey,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await flush();
}

async function pointerDown(element: Element) {
  await act(async () => {
    element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  });
}

async function type(value: string) {
  const input = dialog().querySelector("input")!;
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function open(
  options: Partial<Parameters<typeof openShufflePicker>[0]> = {},
) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  await act(async () => {
    openShufflePicker({ platform: "netease", onConfirm, onCancel, ...options });
  });
  await flush();
  return { onConfirm, onCancel };
}

let opener: HTMLButtonElement;

beforeEach(() => {
  localStorage.clear();
  clearTrackCache();
  query.mockReset();
  query.mockResolvedValue([A, P, B]);
  songList.mockReset();
  album.mockReset();
  songDetail.mockReset();
  (window as unknown as { theme: unknown }).theme = 1;
  opener = document.createElement("button");
  opener.textContent = "随机";
  document.body.appendChild(opener);
  opener.getClientRects = () =>
    [{ width: 1, height: 1 }] as unknown as DOMRectList;
  opener.focus();
});

afterEach(() => {
  act(() => releaseShufflePicker());
  opener.remove();
});

describe("openShufflePicker", () => {
  it("首次打开：全部整条勾选、按条目，摘要计数正确", async () => {
    await open();
    expect(root()?.parentElement).toBe(document.body);
    expect(dialog().getAttribute("role")).toBe("dialog");
    expect(dialog().getAttribute("aria-modal")).toBe("true");
    for (const label of ["晴天", "通勤歌单", "后来"])
      expect(checkbox(label).getAttribute("aria-checked")).toBe("true");
    expect(
      dialog()
        .querySelector('[role="radio"][aria-checked="true"]')
        ?.textContent?.trim(),
    ).toBe("按条目");
    expect(text()).toContain("已选 3 条 · 5 首");
    // 封面升级 https。
    expect(dialog().querySelector("img")?.getAttribute("src")).toBe(
      "https://p1.music.126.net/cover.jpg",
    );
  });

  it("预填：整条、部分、后来新增的收藏未勾；展开后部分曲目勾选", async () => {
    saveShuffleSelection("netease", {
      weight: "song",
      items: [{ id: A.id }, { id: P.id, tracks: ["11", "12"] }],
    });
    songList.mockResolvedValue({ playlist: { tracks } });
    await open();
    expect(checkbox("晴天").getAttribute("aria-checked")).toBe("true");
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("mixed");
    expect(checkbox("后来").getAttribute("aria-checked")).toBe("false");
    expect(text()).toContain("已选 2");
    await click(byLabel("展开通勤歌单"));
    expect(checkbox("七里香").getAttribute("aria-checked")).toBe("true");
    expect(checkbox("夜曲").getAttribute("aria-checked")).toBe("true");
    expect(checkbox("红豆").getAttribute("aria-checked")).toBe("false");
    expect(byLabel("收起通勤歌单").getAttribute("aria-expanded")).toBe("true");
  });

  it("三态切换：点部分态的框变全选，再点变未选", async () => {
    saveShuffleSelection("netease", {
      weight: "entry",
      items: [{ id: P.id, tracks: ["11"] }],
    });
    await open();
    await click(checkbox("通勤歌单"));
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("true");
    await key(checkbox("通勤歌单"), " ");
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("false");
  });

  it("展开后逐首勾满全部曲目：行转全选，确认时存为整条", async () => {
    saveShuffleSelection("netease", { weight: "entry", items: [] });
    songList.mockResolvedValue({ playlist: { tracks } });
    const { onConfirm } = await open();
    await click(byLabel("展开通勤歌单"));
    await click(checkbox("七里香"));
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("mixed");
    await click(checkbox("夜曲"));
    await click(checkbox("红豆"));
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("true");
    await click(button("开始随机"));
    expect(onConfirm).toHaveBeenCalledWith(
      confirmed({
        weight: "entry",
        items: [{ id: P.id }],
      }),
    );
    expect(loadShuffleSelection("netease")?.items).toEqual([{ id: P.id }]);
  });

  it("搜索 + 全选只勾可见行，被过滤的原勾选保留并计入摘要；无结果有提示", async () => {
    saveShuffleSelection("netease", { weight: "entry", items: [{ id: B.id }] });
    await open();
    const input = dialog().querySelector("input")!;
    await act(async () => {
      input.value = "周";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush(200);
    expect(dialog().querySelector('[aria-label="后来"]')).toBeNull();
    await click(button("全选"));
    expect(checkbox("晴天").getAttribute("aria-checked")).toBe("true");
    expect(text()).toContain("已选 2 条");
    // 初始标签复用打开时的读取，之后不再读。
    expect(calls("netease")).toBe(1);
    expect(songList).not.toHaveBeenCalled();

    await act(async () => {
      input.value = "不存在的歌";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush(200);
    expect(text()).toContain("没有匹配的收藏");
    await click(button("清除搜索"));
    expect(checkbox("后来").getAttribute("aria-checked")).toBe("true");
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("false");
  });

  it("全不选：主按钮不可点并提示「至少选择一首」", async () => {
    const { onConfirm } = await open();
    await click(button("全不选"));
    expect(button("开始随机").disabled).toBe(true);
    expect(text()).toContain("至少选择一首");
    expect(text()).toContain("未选择");
    await click(button("开始随机"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("确认：保存选择与权重 → 关闭 → onConfirm，焦点还给打开者", async () => {
    const { onConfirm, onCancel } = await open();
    await click(checkbox("后来"));
    await click(button("按歌曲"));
    expect(text()).toContain("每首歌机会相同");
    await click(button("开始随机"));
    const expected = {
      weight: "song",
      items: [{ id: A.id }, { id: P.id }],
    };
    expect(loadShuffleSelection("netease")).toEqual(expected);
    expect(onConfirm).toHaveBeenCalledWith(confirmed(expected));
    expect(onCancel).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
    await flush(150);
    expect(root()).toBeNull();
  });

  it("确认时丢弃打开期间被删除的收藏", async () => {
    const { onConfirm } = await open();
    query.mockResolvedValue([A, P]);
    await click(button("开始随机"));
    expect(onConfirm).toHaveBeenCalledWith(
      confirmed({
        weight: "entry",
        items: [{ id: A.id }, { id: P.id }],
      }),
    );
  });

  it.each([
    ["关闭钮", () => click(byLabel("关闭收藏随机"))],
    ["取消按钮", () => click(button("取消"))],
    ["Esc", () => key(dialog().querySelector("input")!, "Escape")],
    [
      "遮罩",
      async () => {
        const backdrop = root()!.firstElementChild!;
        await pointerDown(backdrop);
        await click(backdrop);
      },
    ],
  ])("取消（%s）：不保存、关闭、onCancel、焦点还给打开者", async (_, run) => {
    const { onConfirm, onCancel } = await open();
    await click(button("全不选"));
    await run();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(loadShuffleSelection("netease")).toBeNull();
    expect(document.activeElement).toBe(opener);
    await flush(150);
    expect(root()).toBeNull();
  });

  it("展开失败显示「加载失败」与「重试」，整条勾选仍可确认；重试重新请求", async () => {
    songList.mockResolvedValueOnce(null);
    const { onConfirm } = await open();
    await click(byLabel("展开通勤歌单"));
    expect(text()).toContain("加载失败");
    expect(button("开始随机").disabled).toBe(false);

    songList.mockRejectedValueOnce(new Error("timeout"));
    await click(button("重试"));
    expect(text()).toContain("加载失败");

    songList.mockResolvedValueOnce({ playlist: { tracks } });
    await click(button("重试"));
    expect(songList).toHaveBeenCalledTimes(3);
    expect(checkbox("七里香").getAttribute("aria-checked")).toBe("true");

    await click(button("开始随机"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("展开结果会话内缓存，再次打开不重复请求", async () => {
    songList.mockResolvedValue({ playlist: { tracks } });
    await open();
    await click(byLabel("展开通勤歌单"));
    await click(button("取消"));
    await flush(150);
    await open();
    await click(byLabel("展开通勤歌单"));
    expect(songList).toHaveBeenCalledTimes(1);
  });

  it("空歌单：提示没有可播放的曲目，复选框置灰且转未勾、不计入、不可确认", async () => {
    saveShuffleSelection("netease", { weight: "entry", items: [{ id: P.id }] });
    songList.mockResolvedValue({ playlist: { tracks: [] } });
    await open();
    expect(button("开始随机").disabled).toBe(false);
    await click(byLabel("展开通勤歌单"));
    expect(text()).toContain("歌单里没有可播放的曲目");
    expect(checkbox("通勤歌单").getAttribute("aria-disabled")).toBe("true");
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("false");
    await click(checkbox("通勤歌单"));
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("false");
    await click(button("全选"));
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("false");
    await click(button("全不选"));
    expect(text()).toContain("未选择");
    expect(button("开始随机").disabled).toBe(true);
  });

  it("预存的部分曲目全部不在歌单里：加载后转未勾", async () => {
    saveShuffleSelection("netease", {
      weight: "entry",
      items: [{ id: A.id }, { id: P.id, tracks: ["98", "99"] }],
    });
    songList.mockResolvedValue({ playlist: { tracks } });
    await open();
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("mixed");
    await click(byLabel("展开通勤歌单"));
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("false");
    expect(text()).toContain("已选 1 条");
  });

  it("歌单按 trackIds 展开：tracks 缺的曲目经歌曲详情补名；补名失败按加载失败", async () => {
    saveShuffleSelection("netease", { weight: "entry", items: [] });
    songList.mockResolvedValue({
      playlist: {
        tracks: [tracks[0]],
        trackIds: [{ id: 11 }, { id: 12 }, { id: 13 }],
      },
    });
    songDetail.mockResolvedValueOnce(null);
    const { onConfirm } = await open();
    await click(byLabel("展开通勤歌单"));
    expect(text()).toContain("加载失败");
    expect(songDetail).toHaveBeenCalledWith([12, 13]);

    songDetail.mockResolvedValueOnce([
      { id: 13, name: "红豆", artists: [{ name: "王菲" }] },
      { id: 12, name: "夜曲", artists: [{ name: "周杰伦" }] },
    ]);
    await click(button("重试"));
    const labels = Array.from(
      dialog().querySelectorAll('[role="group"] [role="checkbox"]'),
    ).map((node) => node.getAttribute("aria-label"));
    expect(labels).toEqual(["七里香", "夜曲", "红豆"]);
    await click(checkbox("七里香"));
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("mixed");
    await click(checkbox("夜曲"));
    await click(checkbox("红豆"));
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("true");
    await click(button("开始随机"));
    expect(onConfirm).toHaveBeenCalledWith(
      confirmed({
        weight: "entry",
        items: [{ id: P.id }],
      }),
    );
  });

  it("专辑展开取 songs；空专辑提示且转未勾", async () => {
    const L = record("album", "4", { title: "某专辑", trackCount: "2" });
    const E = record("album", "5", { title: "空专辑" });
    query.mockResolvedValue([L, E]);
    album.mockImplementation(async (id: number) =>
      id === 4 ? { songs: tracks.slice(0, 2) } : { songs: [] },
    );
    await open();
    await click(byLabel("展开某专辑"));
    expect(checkbox("七里香").getAttribute("aria-checked")).toBe("true");
    expect(checkbox("夜曲").getAttribute("aria-checked")).toBe("true");
    await click(byLabel("展开空专辑"));
    expect(text()).toContain("专辑里没有可播放的曲目");
    expect(checkbox("空专辑").getAttribute("aria-checked")).toBe("false");
    expect(album).toHaveBeenCalledWith(4);
  });

  it("没有收藏：提示且开始随机不可点", async () => {
    query.mockResolvedValue([]);
    await open();
    expect(text()).toContain("该平台还没有收藏");
    expect(button("开始随机").disabled).toBe(true);
  });

  it("读取失败：提示「读取收藏失败」，不可确认；重试重新读取", async () => {
    query.mockRejectedValueOnce(new Error("idb"));
    await open();
    expect(text()).toContain("读取收藏失败");
    expect(text()).not.toContain("该平台还没有收藏");
    expect(button("开始随机").disabled).toBe(true);
    await click(button("重试"));
    expect(calls("netease")).toBe(2);
    expect(checkbox("晴天").getAttribute("aria-checked")).toBe("true");
    expect(button("开始随机").disabled).toBe(false);
  });

  it("从面板内拖到遮罩松手不关闭", async () => {
    const { onCancel } = await open();
    await pointerDown(dialog());
    await click(root()!.firstElementChild!);
    expect(onCancel).not.toHaveBeenCalled();
    expect(root()).not.toBeNull();
  });

  it("搜索防抖期间点全选/全不选按输入框当前内容生效", async () => {
    await open();
    await type("周");
    await click(button("全不选"));
    await flush(200);
    await click(byLabel("清除搜索"));
    await flush(200);
    expect(checkbox("晴天").getAttribute("aria-checked")).toBe("false");
    expect(checkbox("后来").getAttribute("aria-checked")).toBe("true");
    expect(checkbox("通勤歌单").getAttribute("aria-checked")).toBe("true");
  });

  it("Tab 在面板内循环，Shift+Tab 反向", async () => {
    await open();
    const nodes = Array.from(
      dialog().querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
      ),
    );
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    last.focus();
    await key(last, "Tab");
    expect(document.activeElement).toBe(first);
    await key(first, "Tab", true);
    expect(document.activeElement).toBe(last);
  });

  it("权重分段：方向键切换选中与焦点", async () => {
    await open();
    const entry = button("按条目");
    entry.focus();
    await key(entry, "ArrowRight");
    expect(button("按歌曲").getAttribute("aria-checked")).toBe("true");
    expect(button("按条目").getAttribute("aria-checked")).toBe("false");
    expect(document.activeElement).toBe(button("按歌曲"));
  });

  it("保存失败：不回调、面板保留并提示；撤掉故障后可重试，取消仍可用", async () => {
    const { onConfirm, onCancel } = await open();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    await click(button("开始随机"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(root()).not.toBeNull();
    expect(text()).toContain("保存失败，请重试");
    expect(button("开始随机").disabled).toBe(false);

    setItem.mockRestore();
    await click(button("开始随机"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(loadShuffleSelection("netease")?.items).toHaveLength(3);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("保存失败后取消照常关闭", async () => {
    const { onConfirm, onCancel } = await open();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    await click(button("开始随机"));
    await click(button("取消"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    await flush(150);
    expect(root()).toBeNull();
  });

  it("确认中主按钮忙碌；所选收藏全被删除时不保存并提示", async () => {
    saveShuffleSelection("netease", { weight: "entry", items: [{ id: A.id }] });
    const { onConfirm } = await open();
    let resolve!: (records: FavoriteRecord[]) => void;
    query.mockReturnValueOnce(
      new Promise<FavoriteRecord[]>((done) => (resolve = done)),
    );
    await click(button("开始随机"));
    const busy = buttons().find((node) => node.textContent === "正在保存…")!;
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    await act(async () => resolve([P, B]));
    await flush();
    expect(text()).toContain("所选收藏已被删除，请重新选择");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(loadShuffleSelection("netease")?.items).toEqual([{ id: A.id }]);
    expect(button("开始随机").disabled).toBe(false);
  });

  it("确认对齐期间被释放（重复注入）：不保存、不回调", async () => {
    const { onConfirm } = await open();
    let resolve!: (records: FavoriteRecord[]) => void;
    query.mockReturnValueOnce(
      new Promise<FavoriteRecord[]>((done) => (resolve = done)),
    );
    await click(button("开始随机"));
    act(() => releaseShufflePicker());
    await act(async () => resolve([A, P, B]));
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(loadShuffleSelection("netease")).toBeNull();
    expect(root()).toBeNull();
  });

  it("重复打开：不新建，焦点移回面板", async () => {
    await open();
    opener.focus();
    await open();
    expect(
      document.querySelectorAll(`#${SHUFFLE_PICKER_ROOT_ID}`),
    ).toHaveLength(1);
    expect(document.activeElement).toBe(dialog());
    expect(query).toHaveBeenCalledTimes(SHUFFLE_PLATFORMS.length);
  });

  it("重复注入：释放后由新实例接管，残留旧根被清除", async () => {
    const stale = document.createElement("div");
    stale.id = SHUFFLE_PICKER_ROOT_ID;
    document.body.appendChild(stale);
    await open();
    expect(
      document.querySelectorAll(`#${SHUFFLE_PICKER_ROOT_ID}`),
    ).toHaveLength(1);
    expect(stale.isConnected).toBe(false);
    act(() => releaseShufflePicker());
    expect(root()).toBeNull();
    await open();
    expect(root()).not.toBeNull();
  });

  it("深浅主题取 !window.theme", async () => {
    (window as unknown as { theme: unknown }).theme = 0;
    await open();
    expect(dialog().className).toContain("bg-[#242a34]");
    act(() => releaseShufflePicker());
    (window as unknown as { theme: unknown }).theme = 1;
    await open();
    expect(dialog().className).toContain("bg-[#fafbfe]");
  });
});

describe("平台标签", () => {
  const V = {
    ...record("video", "BV1", { title: "某视频" }),
    id: "bilibili:video:BV1",
    platform: "bilibili",
  } as FavoriteRecord;
  const tab = (label: string) =>
    Array.from(dialog().querySelectorAll<HTMLElement>('[role="tab"]')).find(
      (node) => node.textContent?.trim() === label,
    )!;
  const selectedTab = () =>
    dialog().querySelector('[role="tab"][aria-selected="true"]')?.textContent;

  beforeEach(() => {
    query.mockImplementation(async (filter: { platform: string }) =>
      filter.platform === "bilibili" ? [V] : [A, P, B],
    );
  });

  const labels = () =>
    Array.from(dialog().querySelectorAll('[role="tablist"] [role="tab"]')).map(
      (node) => node.textContent?.trim(),
    );
  const listPlatform = () =>
    dialog()
      .querySelector("#imw-shuffle-picker-list")!
      .getAttribute("data-platform");
  /** 不指定平台，按 CAP-12 规则计算（侧栏入口的用法）。 */
  const openByRule = (defaultPage: unknown = 0) =>
    open({ platform: undefined, defaultPage });

  it("指定初始平台：停在该标签；打开时每个平台各读一次，首屏复用，其他标签首次切到时重读", async () => {
    await open({ platform: "bilibili" });
    expect(labels()).toEqual(["网易云", "B站"]);
    expect(selectedTab()).toBe("B站");
    expect(text()).toContain("某视频");
    expect(query).toHaveBeenCalledTimes(SHUFFLE_PLATFORMS.length);
    for (const platform of SHUFFLE_PLATFORMS) expect(calls(platform)).toBe(1);
    // 打开后新增的收藏：切到该标签时看得到。
    const C = record("song", "9", { title: "新收藏" });
    query.mockImplementation(async (filter: { platform: string }) =>
      filter.platform === "bilibili" ? [V] : [A, C],
    );
    await click(tab("网易云"));
    expect(text()).toContain("新收藏");
    expect(calls("netease")).toBe(2);
    expect(calls("bilibili")).toBe(1);
  });

  it("只有一个平台有收藏：不显示标签行，直接是该平台列表", async () => {
    query.mockImplementation(async (filter: { platform: string }) =>
      filter.platform === "bilibili" ? [] : [A, P, B],
    );
    await openByRule();
    expect(dialog().querySelector('[role="tablist"]')).toBeNull();
    expect(dialog().querySelector('[role="tab"]')).toBeNull();
    expect(listPlatform()).toBe("netease");
    expect(text()).toContain("晴天");
    expect(
      dialog()
        .querySelector("#imw-shuffle-picker-list")!
        .getAttribute("aria-labelledby"),
    ).toBe("imw-shuffle-picker-title");
  });

  it("两个都有收藏：两段等宽分段，首尾圆角；无记录按 defaultPage", async () => {
    await openByRule(1);
    expect(labels()).toEqual(["网易云", "B站"]);
    expect(selectedTab()).toBe("B站");
    const list = dialog().querySelector('[role="tablist"]')!;
    expect(list.getAttribute("data-layout")).toBe("segmented");
    const segments = Array.from(list.querySelectorAll('[role="tab"] > span'));
    expect(segments[0].className).toContain("rounded-l-lg");
    expect(segments[0].className).not.toContain("rounded-r-lg");
    expect(segments[1].className).toContain("rounded-r-lg");
    expect(segments[1].className).not.toContain("rounded-l-lg");
  });

  it("已存平台收藏删光：仍显示该标签，初始停在它（空态）", async () => {
    saveShufflePlatform("bilibili");
    query.mockImplementation(async (filter: { platform: string }) =>
      filter.platform === "bilibili" ? [] : [A],
    );
    await openByRule(0);
    expect(labels()).toEqual(["网易云", "B站"]);
    expect(selectedTab()).toBe("B站");
    expect(text()).toContain("该平台还没有收藏");
    expect(button("开始随机").disabled).toBe(true);
  });

  it("无记录、默认页对应平台无收藏：停在网易云", async () => {
    query.mockImplementation(async (filter: { platform: string }) =>
      filter.platform === "bilibili" ? [] : [A],
    );
    await openByRule(1);
    expect(listPlatform()).toBe("netease");
    expect(text()).toContain("晴天");
    expect(dialog().querySelector('[role="tab"]')).toBeNull();
  });

  it("全无收藏：只显示默认平台空态，无标签行", async () => {
    query.mockResolvedValue([]);
    await openByRule(1);
    expect(dialog().querySelector('[role="tablist"]')).toBeNull();
    expect(listPlatform()).toBe("bilibili");
    expect(text()).toContain("该平台还没有收藏");
    expect(button("开始随机").disabled).toBe(true);
  });

  it("打开期间收藏增减不改变标签：切到另一标签重读时仍保留已删光的标签", async () => {
    await openByRule();
    expect(labels()).toEqual(["网易云", "B站"]);
    // 打开后网易云收藏删光、B站照旧。
    query.mockImplementation(async (filter: { platform: string }) =>
      filter.platform === "bilibili" ? [V] : [],
    );
    await click(tab("B站"));
    expect(calls("bilibili")).toBe(2);
    expect(labels()).toEqual(["网易云", "B站"]);
  });

  it("打开期间收藏增减不改变标签：重试重读后不新增标签", async () => {
    query.mockImplementation(async (filter: { platform: string }) =>
      filter.platform === "bilibili" ? [] : [A],
    );
    query.mockRejectedValueOnce(new Error("idb"));
    await openByRule();
    expect(text()).toContain("读取收藏失败");
    expect(dialog().querySelector('[role="tab"]')).toBeNull();
    // 打开后 B站新增收藏：重试只重读当前平台，不出现标签行。
    query.mockImplementation(async (filter: { platform: string }) =>
      filter.platform === "bilibili" ? [V] : [A],
    );
    await click(button("重试"));
    expect(calls("netease")).toBe(2);
    expect(text()).toContain("晴天");
    expect(dialog().querySelector('[role="tab"]')).toBeNull();
  });

  it("读取尚未完成：面板已显示读取中、无标签行，可取消；释放后不再渲染", async () => {
    const pending: Array<(records: FavoriteRecord[]) => void> = [];
    query.mockImplementation(
      () => new Promise<FavoriteRecord[]>((done) => pending.push(done)),
    );
    const { onCancel } = await open({ platform: undefined });
    expect(dialog()).not.toBeNull();
    expect(text()).toContain("正在读取收藏");
    expect(dialog().querySelector('[role="tablist"]')).toBeNull();
    act(() => releaseShufflePicker());
    expect(root()).toBeNull();
    await act(async () => pending.forEach((done) => done([A])));
    await flush(150);
    expect(root()).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("读取一直不返回：面板可见可取消；超时后显示标签与读取失败、重试", async () => {
    vi.useFakeTimers();
    try {
      query.mockImplementation(() => new Promise<FavoriteRecord[]>(() => {}));
      const onCancel = vi.fn();
      await act(async () => {
        openShufflePicker({ onCancel });
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(text()).toContain("正在读取收藏");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PREPARE_TIMEOUT_MS);
      });
      // 面板读取的 effect 在下一帧后才跑。
      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });
      expect(labels()).toEqual(["网易云", "B站"]);
      expect(selectedTab()).toBe("网易云");
      expect(text()).toContain("读取收藏失败");
      // 另一标签同样超时：切过去也是失败与重试，而不是一直转圈。
      await act(async () => {
        tab("B站").click();
      });
      // 读取 effect 在 act 结束时才跑，结果再下一轮才渲染。
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(text()).toContain("读取收藏失败");
      query.mockResolvedValue([V]);
      await act(async () => {
        button("重试").click();
      });
      // 读取 effect 在 act 结束时才跑，结果再下一轮才渲染。
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(text()).toContain("某视频");
      await act(async () => {
        button("取消").click();
        await vi.advanceTimersByTimeAsync(150);
      });
      expect(onCancel).toHaveBeenCalledOnce();
      expect(root()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("读取一直不返回时 Esc 照样取消", async () => {
    query.mockImplementation(() => new Promise<FavoriteRecord[]>(() => {}));
    const { onCancel } = await open({ platform: undefined });
    await key(dialog(), "Escape");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("读取失败的平台无法排除有收藏：照常显示标签，切到它提示失败可重试", async () => {
    query.mockImplementation(async (filter: { platform: string }) => {
      if (filter.platform === "bilibili") throw new Error("idb");
      return [A];
    });
    await openByRule();
    expect(labels()).toEqual(["网易云", "B站"]);
    await click(tab("B站"));
    expect(text()).toContain("读取收藏失败");
  });

  it("切换保留各标签改动，搜索词清空；切回不再重读", async () => {
    await open();
    await click(checkbox("晴天"));
    await click(button("按歌曲"));
    await type("周");
    await flush(200);
    await click(tab("B站"));
    expect(selectedTab()).toBe("B站");
    expect(dialog().querySelector("input")!.value).toBe("");
    expect(text()).toContain("某视频");
    expect(button("按条目").getAttribute("aria-checked")).toBe("true");
    await click(tab("网易云"));
    expect(checkbox("晴天").getAttribute("aria-checked")).toBe("false");
    expect(checkbox("后来").getAttribute("aria-checked")).toBe("true");
    expect(button("按歌曲").getAttribute("aria-checked")).toBe("true");
    // 初始标签复用打开时的读取；另一标签首次切到时读一次，切回不再读。
    expect(calls("netease")).toBe(1);
    expect(calls("bilibili")).toBe(2);
  });

  it("确认：保存两个改动过的平台，随机平台 = 当前标签", async () => {
    const { onConfirm } = await open();
    await click(checkbox("晴天"));
    await click(tab("B站"));
    await click(button("按歌曲"));
    await click(button("开始随机"));
    const netease = { weight: "entry", items: [{ id: P.id }, { id: B.id }] };
    const bilibili = { weight: "song", items: [{ id: V.id }] };
    expect(loadShuffleSelection("netease")).toEqual(netease);
    expect(loadShuffleSelection("bilibili")).toEqual(bilibili);
    expect(loadShufflePlatform()).toBe("bilibili");
    expect(onConfirm).toHaveBeenCalledWith({
      platform: "bilibili",
      selections: { netease, bilibili },
    });
  });

  it("只看过没改的标签不保存", async () => {
    const { onConfirm } = await open();
    await click(tab("B站"));
    await click(tab("网易云"));
    await click(button("开始随机"));
    expect(loadShuffleSelection("bilibili")).toBeNull();
    expect(loadShufflePlatform()).toBe("netease");
    expect(onConfirm.mock.lastCall?.[0].selections).not.toHaveProperty(
      "bilibili",
    );
  });

  it("取消：改过两个平台也不保存任何平台、不改随机平台", async () => {
    const { onCancel } = await open();
    await click(checkbox("晴天"));
    await click(tab("B站"));
    await click(button("全不选"));
    await click(button("取消"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(loadShuffleSelection("netease")).toBeNull();
    expect(loadShuffleSelection("bilibili")).toBeNull();
    expect(loadShufflePlatform()).toBeNull();
  });

  it("当前标签无收藏：空态、不可确认；切到另一标签可确认", async () => {
    query.mockImplementation(async (filter: { platform: string }) =>
      filter.platform === "bilibili" ? [] : [A],
    );
    await open({ platform: "bilibili" });
    expect(text()).toContain("该平台还没有收藏");
    expect(text()).not.toContain("至少选择一首");
    expect(button("开始随机").disabled).toBe(true);
    await click(tab("网易云"));
    expect(button("开始随机").disabled).toBe(false);
  });

  it("摘要只统计当前标签", async () => {
    await open();
    expect(text()).toContain("已选 3 条");
    await click(tab("B站"));
    expect(text()).toContain("已选 1 条");
  });

  it("方向键与 Home/End 切换标签并移动焦点；上下键不切换", async () => {
    await open();
    expect(
      dialog()
        .querySelector('[role="tablist"]')!
        .getAttribute("aria-orientation"),
    ).toBe("horizontal");
    const first = tab("网易云");
    first.focus();
    await key(first, "ArrowRight");
    expect(selectedTab()).toBe("B站");
    expect(document.activeElement).toBe(tab("B站"));
    await key(tab("B站"), "ArrowRight");
    expect(selectedTab()).toBe("网易云");
    await key(tab("网易云"), "ArrowDown");
    expect(selectedTab()).toBe("网易云");
    await key(tab("网易云"), "End");
    expect(selectedTab()).toBe("B站");
    await key(tab("B站"), "Home");
    expect(selectedTab()).toBe("网易云");
    expect(document.activeElement).toBe(tab("网易云"));
  });

  it("点已选中的标签不做任何事", async () => {
    await open();
    await type("周");
    await click(tab("网易云"));
    expect(dialog().querySelector("input")!.value).toBe("周");
    expect(query).toHaveBeenCalledTimes(SHUFFLE_PLATFORMS.length);
  });

  it("其他标签选成空的不保存，保留原有选择", async () => {
    saveShuffleSelection("bilibili", {
      weight: "song",
      items: [{ id: V.id }],
    });
    await open();
    await click(tab("B站"));
    await click(button("全不选"));
    await click(tab("网易云"));
    await click(button("开始随机"));
    expect(loadShuffleSelection("bilibili")).toEqual({
      weight: "song",
      items: [{ id: V.id }],
    });
    expect(loadShufflePlatform()).toBe("netease");
  });

  it("只在网易云展开过、未改动：确认 B站 时不保存网易云", async () => {
    songList.mockResolvedValue({ playlist: { tracks } });
    const { onConfirm } = await open();
    await click(byLabel("展开通勤歌单"));
    await click(tab("B站"));
    await click(button("开始随机"));
    expect(loadShuffleSelection("netease")).toBeNull();
    expect(onConfirm.mock.lastCall?.[0].selections).not.toHaveProperty(
      "netease",
    );
    expect(loadShufflePlatform()).toBe("bilibili");
  });

  it("切走后才返回的展开结果写回原标签", async () => {
    const E = record("album", "5", { title: "空专辑" });
    query.mockImplementation(async (filter: { platform: string }) =>
      filter.platform === "bilibili" ? [V] : [A, E],
    );
    let resolve!: (value: unknown) => void;
    album.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    await open();
    expect(checkbox("空专辑").getAttribute("aria-checked")).toBe("true");
    await click(byLabel("展开空专辑"));
    await click(tab("B站"));
    await act(async () => resolve({ songs: [] }));
    await flush();
    expect(checkbox("某视频").getAttribute("aria-checked")).toBe("true");
    await click(tab("网易云"));
    expect(checkbox("空专辑").getAttribute("aria-checked")).toBe("false");
    expect(text()).toContain("专辑里没有可播放的曲目");
  });

  it("确认中切换标签被忽略；保存失败的提示在切换标签后清除", async () => {
    let release!: (records: FavoriteRecord[]) => void;
    await open();
    query.mockReturnValueOnce(
      new Promise<FavoriteRecord[]>((done) => (release = done)),
    );
    await click(button("开始随机"));
    await click(tab("B站"));
    expect(selectedTab()).toBe("网易云");
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    await act(async () => release([A, P, B]));
    await flush();
    setItem.mockRestore();
    expect(text()).toContain("保存失败，请重试");
    await click(tab("B站"));
    expect(selectedTab()).toBe("B站");
    expect(text()).not.toContain("保存失败");
  });

  it("第二次写入失败：回滚已写的键，提示失败、不回调", async () => {
    saveShuffleSelection("netease", { weight: "song", items: [{ id: A.id }] });
    const before = { ...localStorage };
    const { onConfirm } = await open();
    await click(checkbox("后来"));
    await click(tab("B站"));
    await click(button("全不选"));
    await click(checkbox("某视频"));
    await click(button("按歌曲"));
    const real = Storage.prototype.setItem;
    let writes = 0;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, name, value) {
        writes += 1;
        if (writes === 2) throw new Error("QuotaExceededError");
        real.call(this, name, value);
      });
    await click(button("开始随机"));
    setItem.mockRestore();
    expect({ ...localStorage }).toEqual(before);
    expect(text()).toContain("保存失败，请重试");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("系统返回（接管宿站 Utils.backward）", () => {
  // window.Utils 在全局有宿站类型声明；测试只需要 backward，按无类型对象读写。
  const host = window as unknown as {
    Utils?: { backward?: (...args: unknown[]) => unknown };
  };
  let hostBackward: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
  // 宿站的系统返回：onpopstate 里调 Utils.backward()。
  async function systemBack() {
    await act(async () => {
      host.Utils?.backward?.();
    });
    await flush();
  }

  beforeEach(() => {
    hostBackward = vi.fn<(...args: unknown[]) => unknown>();
    host.Utils = { backward: hostBackward };
  });
  afterEach(() => {
    delete host.Utils;
    delete (window as unknown as Record<string, unknown>)
      .__imwShufflePickerBack;
  });

  it("打开与关闭都不读写浏览历史", async () => {
    const push = vi.spyOn(history, "pushState");
    const back = vi.spyOn(history, "back");
    const before = history.length;
    await open();
    await click(button("取消"));
    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    expect(history.length).toBe(before);
    push.mockRestore();
    back.mockRestore();
  });

  it("系统返回等同取消：面板关闭、不保存、焦点回打开者，宿站不执行返回", async () => {
    const { onCancel, onConfirm } = await open();
    await systemBack();
    await flush(150);
    expect(root()).toBeNull();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(hostBackward).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it("读取未完成时系统返回：取消，读取返回后也不渲染", async () => {
    const pending: Array<(records: FavoriteRecord[]) => void> = [];
    query.mockImplementation(
      () => new Promise<FavoriteRecord[]>((done) => pending.push(done)),
    );
    const { onCancel } = await open({ platform: undefined });
    await systemBack();
    await act(async () => pending.forEach((done) => done([A])));
    await flush(150);
    expect(root()).toBeNull();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(hostBackward).not.toHaveBeenCalled();
  });

  it.each([
    ["关闭钮", () => click(byLabel("关闭收藏随机"))],
    ["取消", () => click(button("取消"))],
    ["Esc", () => key(dialog(), "Escape")],
    [
      "遮罩",
      async () => {
        const backdrop = root()!.firstElementChild!;
        await pointerDown(backdrop);
        await click(backdrop);
      },
    ],
    ["确认", () => click(button("开始随机"))],
  ])("%s 关闭后，系统返回交还宿站照常执行", async (_label, action) => {
    await open();
    await action();
    await flush(150);
    await systemBack();
    expect(hostBackward).toHaveBeenCalledOnce();
  });

  it("确认对齐期间系统返回：按取消处理，结果作废不保存", async () => {
    const { onConfirm, onCancel } = await open();
    let resolve!: (records: FavoriteRecord[]) => void;
    query.mockReturnValueOnce(
      new Promise<FavoriteRecord[]>((done) => (resolve = done)),
    );
    await click(button("开始随机"));
    await systemBack();
    expect(onCancel).toHaveBeenCalledOnce();
    await act(async () => resolve([A, P, B]));
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(loadShuffleSelection("netease")).toBeNull();
    expect(hostBackward).not.toHaveBeenCalled();
  });

  it("包装只装一次：重复打开、重复注入接管后不叠加，返回只关当前面板", async () => {
    await open();
    const wrapped = host.Utils!.backward;
    act(() => releaseShufflePicker());
    const { onCancel } = await open();
    expect(host.Utils!.backward).toBe(wrapped);
    await systemBack();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(hostBackward).not.toHaveBeenCalled();
    await flush(150);
    await systemBack();
    expect(hostBackward).toHaveBeenCalledOnce();
  });

  it("宿站没有 Utils.backward 时面板照常可用", async () => {
    delete host.Utils;
    const { onCancel } = await open();
    await click(button("取消"));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("拖动与位置记忆", () => {
  const KEY = "imwShufflePickerPosition";
  let viewport: EventTarget & { width: number; height: number };
  /** 宿站对 iframe 的缩放比例（遮罩实测 rect 宽 / offset 宽）。 */
  let scale = 1;
  /** 默认摆放时面板的视觉位置（client 坐标）。 */
  let defaultRect = { left: 300, top: 100 };
  let dialogHeight = 500;

  const header = () =>
    document.getElementById("imw-shuffle-picker-title")!.parentElement!;
  const place = () => [dialog().style.left, dialog().style.top];
  const isDialog = (node: HTMLElement) => node.id === "imw-shuffle-picker";
  const isBackdrop = (node: HTMLElement) =>
    node.firstElementChild?.id === "imw-shuffle-picker";

  function pointer(
    element: Element,
    type: string,
    x = 0,
    y = 0,
    pointerId = 5,
  ) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, {
      pointerId,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    });
    act(() => {
      element.dispatchEvent(event);
    });
  }

  beforeEach(() => {
    scale = 1;
    defaultRect = { left: 300, top: 100 };
    dialogHeight = 500;
    viewport = Object.assign(new EventTarget(), { width: 1000, height: 700 });
    vi.stubGlobal("visualViewport", viewport);
    // jsdom 无布局：面板 400×dialogHeight，默认摆放时视觉位置 defaultRect；遮罩宽 1000。
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return isDialog(this) ? 400 : isBackdrop(this) ? 1000 : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return isDialog(this) ? dialogHeight : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (isBackdrop(this)) return new DOMRect(0, 0, 1000 * scale, 0);
        if (!isDialog(this)) return new DOMRect();
        const left = this.style.left
          ? parseFloat(this.style.left) * scale
          : defaultRect.left;
        const top = this.style.top
          ? parseFloat(this.style.top) * scale
          : defaultRect.top;
        return new DOMRect(left, top, 400 * scale, dialogHeight * scale);
      },
    );
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as Partial<HTMLElement>).setPointerCapture;
  });

  it("首次打开无已存位置：保持默认摆放（不 fixed、无 left/top）", async () => {
    await open();
    expect(dialog().style.left).toBe("");
    expect(dialog().className).not.toMatch(/(^|\s)fixed(\s|$)/);
    expect(dialog().className).toContain("max-[768px]:rounded-t-2xl");
  });

  it("按住头部拖动：跟随指针，松手保存；手柄 cursor-grab / 拖动中 grabbing", async () => {
    await open();
    expect(header().className).toContain("cursor-grab");
    expect(header().className).toContain("touch-none");
    pointer(header(), "pointerdown", 350, 120);
    expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalledWith(5);
    expect(header().className).toContain("cursor-grabbing");
    // 按下即切成浮动卡片，停在原视觉位置。
    expect(place()).toEqual(["300px", "100px"]);
    expect(dialog().className).toMatch(/(^|\s)fixed(\s|$)/);
    pointer(header(), "pointermove", 400, 150);
    expect(place()).toEqual(["350px", "130px"]);
    // 浮动卡片：保留圆角与底边框，不再贴底；移动端保留安全区内边距。
    expect(dialog().className).not.toContain("max-[768px]:rounded-t-2xl");
    expect(dialog().className).toContain(
      "max-[768px]:pb-[env(safe-area-inset-bottom)]",
    );
    expect(localStorage.getItem(KEY)).toBeNull();
    pointer(header(), "pointerup", 400, 150);
    expect(localStorage.getItem(KEY)).toBe('{"x":350,"y":130}');
    expect(header().className).not.toContain("cursor-grabbing");
    // 松手后移动不再跟随。
    pointer(header(), "pointermove", 500, 300);
    expect(place()).toEqual(["350px", "130px"]);
  });

  it("移动端拖拽条也是手柄", async () => {
    await open();
    const bar = dialog().firstElementChild as HTMLElement;
    expect(bar.className).toContain("touch-none");
    pointer(bar, "pointerdown", 0, 0);
    pointer(bar, "pointermove", -20, 10);
    pointer(bar, "pointerup", -20, 10);
    expect(place()).toEqual(["280px", "110px"]);
  });

  it("移动端从贴底抽屉起拖：首次移动的 top = 起点视觉 top + 位移，不跳", async () => {
    viewport.width = 400;
    viewport.height = 800;
    defaultRect = { left: 0, top: 300 };
    await open();
    pointer(header(), "pointerdown", 200, 320);
    expect(place()).toEqual(["0px", "300px"]);
    pointer(header(), "pointermove", 200, 220);
    expect(place()).toEqual(["12px", "200px"]);
    pointer(header(), "pointerup", 200, 220);
    expect(localStorage.getItem(KEY)).toBe('{"x":12,"y":200}');
  });

  it("点按头部不移动：存储不变；从默认摆放点按退回默认摆放", async () => {
    localStorage.setItem(KEY, '{"x":3000,"y":2000}');
    await open();
    expect(place()).toEqual(["588px", "188px"]);
    pointer(header(), "pointerdown", 700, 200);
    pointer(header(), "pointerup", 700, 200);
    expect(localStorage.getItem(KEY)).toBe('{"x":3000,"y":2000}');
    expect(place()).toEqual(["588px", "188px"]);
    act(() => releaseShufflePicker());

    localStorage.clear();
    await open();
    pointer(header(), "pointerdown", 350, 120);
    pointer(header(), "pointerup", 350, 120);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(dialog().style.left).toBe("");
    expect(dialog().className).not.toMatch(/(^|\s)fixed(\s|$)/);
  });

  it("刷新恢复：已存位置再打开出现在原处", async () => {
    localStorage.setItem(KEY, '{"x":120,"y":40}');
    await open();
    expect(place()).toEqual(["120px", "40px"]);
    expect(dialog().className).toMatch(/(^|\s)fixed(\s|$)/);
  });

  it("越界约束：拖向视口外停在距边 12px；已存位置超出视口时收回", async () => {
    await open();
    pointer(header(), "pointerdown", 350, 120);
    pointer(header(), "pointermove", 5000, 5000);
    expect(place()).toEqual(["588px", "188px"]);
    pointer(header(), "pointermove", -5000, -5000);
    expect(place()).toEqual(["12px", "12px"]);
    pointer(header(), "pointerup", -5000, -5000);
    act(() => releaseShufflePicker());

    localStorage.setItem(KEY, '{"x":3000,"y":2000}');
    await open();
    expect(place()).toEqual(["588px", "188px"]);
    // 打开时的约束只改显示，不覆盖存储。
    expect(localStorage.getItem(KEY)).toBe('{"x":3000,"y":2000}');
  });

  it("视口变化：打开期间缩小窗口，面板收回视口内", async () => {
    localStorage.setItem(KEY, '{"x":500,"y":150}');
    await open();
    expect(place()).toEqual(["500px", "150px"]);
    viewport.width = 600;
    viewport.height = 600;
    act(() => {
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(place()).toEqual(["188px", "88px"]);
    viewport.width = 450;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(place()).toEqual(["38px", "88px"]);
    viewport.width = 420;
    act(() => {
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(place()).toEqual(["12px", "88px"]);
  });

  it("拖动中视口变化：收回视口内但不打断拖动", async () => {
    await open();
    pointer(header(), "pointerdown", 350, 120);
    pointer(header(), "pointermove", 360, 130);
    viewport.width = 600;
    act(() => {
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(place()).toEqual(["188px", "110px"]);
    expect(header().className).toContain("cursor-grabbing");
    pointer(header(), "pointermove", 300, 140);
    expect(place()).toEqual(["188px", "120px"]);
    pointer(header(), "pointerup", 300, 140);
    expect(localStorage.getItem(KEY)).toBe('{"x":188,"y":120}');
  });

  it("宿站缩放 1.15：位移与 12px 约束按缩放后的单位换算", async () => {
    scale = 1.15;
    viewport.width = 1150;
    viewport.height = 805;
    defaultRect = { left: 345, top: 115 };
    await open();
    pointer(header(), "pointerdown", 402.5, 138);
    expect(parseFloat(dialog().style.left)).toBeCloseTo(300);
    expect(parseFloat(dialog().style.top)).toBeCloseTo(100);
    pointer(header(), "pointermove", 460, 172.5);
    expect(parseFloat(dialog().style.left)).toBeCloseTo(350);
    expect(parseFloat(dialog().style.top)).toBeCloseTo(130);
    pointer(header(), "pointermove", 5000, 5000);
    // 视口 1150×805 / 1.15 = 1000×700：右下约束 1000-400-12、700-500-12。
    expect(parseFloat(dialog().style.left)).toBeCloseTo(588);
    expect(parseFloat(dialog().style.top)).toBeCloseTo(188);
    pointer(header(), "pointermove", -5000, -5000);
    expect(parseFloat(dialog().style.left)).toBeCloseTo(12);
    expect(parseFloat(dialog().style.top)).toBeCloseTo(12);
  });

  it("面板尺寸变化（ResizeObserver）：已存位置靠底时重新收回", async () => {
    let notify!: () => void;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    dialogHeight = 200;
    localStorage.setItem(KEY, '{"x":100,"y":480}');
    await open();
    expect(place()).toEqual(["100px", "480px"]);
    dialogHeight = 500;
    act(() => notify());
    expect(place()).toEqual(["100px", "188px"]);
    expect(localStorage.getItem(KEY)).toBe('{"x":100,"y":480}');
  });

  it("按钮不拖：关闭钮上按下拖动不移动，点击照常关闭", async () => {
    const { onCancel } = await open();
    const close = byLabel("关闭收藏随机");
    pointer(close, "pointerdown", 350, 120);
    pointer(close, "pointermove", 500, 300);
    pointer(close, "pointerup", 500, 300);
    expect(dialog().style.left).toBe("");
    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled();
    await click(close);
    expect(onCancel).toHaveBeenCalled();
  });

  it("搜索框、标签、列表不是手柄：不拖动，touch-none 不落在列表上", async () => {
    await open();
    const input = dialog().querySelector("input")!;
    pointer(input, "pointerdown", 350, 120);
    pointer(input, "pointermove", 500, 300);
    const list = document.getElementById("imw-shuffle-picker-list")!;
    pointer(list, "pointerdown", 350, 120);
    pointer(list, "pointermove", 500, 300);
    expect(dialog().style.left).toBe("");
    expect(list.closest(".touch-none")).toBeNull();
    expect(input.closest(".touch-none")).toBeNull();
  });

  it("存储异常：已存值非法按无记录；写入抛错时拖动照常、不抛错", async () => {
    localStorage.setItem(KEY, '{"x":"a","y":1}');
    await open();
    expect(dialog().style.left).toBe("");
    act(() => releaseShufflePicker());

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await open();
    expect(dialog().style.left).toBe("");
    pointer(header(), "pointerdown", 350, 120);
    pointer(header(), "pointermove", 360, 130);
    expect(() => pointer(header(), "pointerup", 360, 130)).not.toThrow();
    expect(place()).toEqual(["310px", "110px"]);
  });

  it("中断：pointercancel 或窗口失焦结束拖动，停在当前位置并保存", async () => {
    await open();
    pointer(header(), "pointerdown", 350, 120);
    pointer(header(), "pointermove", 360, 130);
    pointer(header(), "pointercancel", 360, 130);
    expect(localStorage.getItem(KEY)).toBe('{"x":310,"y":110}');
    pointer(header(), "pointermove", 500, 300);
    expect(place()).toEqual(["310px", "110px"]);
    expect(header().className).not.toContain("cursor-grabbing");

    pointer(header(), "pointerdown", 360, 130);
    pointer(header(), "pointermove", 370, 140);
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(localStorage.getItem(KEY)).toBe('{"x":320,"y":120}');
    pointer(header(), "pointermove", 500, 300);
    expect(place()).toEqual(["320px", "120px"]);
    expect(header().className).not.toContain("cursor-grabbing");
  });

  it("拖动中退场（Esc）：结束拖动并保存，之后的指针事件忽略", async () => {
    await open();
    pointer(header(), "pointerdown", 350, 120);
    pointer(header(), "pointermove", 360, 130);
    act(() => {
      dialog().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(localStorage.getItem(KEY)).toBe('{"x":310,"y":110}');
    pointer(header(), "pointermove", 500, 300);
    pointer(header(), "pointerup", 500, 300);
    expect(place()).toEqual(["310px", "110px"]);
    expect(localStorage.getItem(KEY)).toBe('{"x":310,"y":110}');
  });
});
