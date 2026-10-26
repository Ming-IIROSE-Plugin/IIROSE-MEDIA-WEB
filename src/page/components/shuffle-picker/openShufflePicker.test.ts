import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import { FavoritesStorageService } from "../../../storage/FavoritesStorageService";
import { NeteaseMusicAPI } from "../../../Api/NeteaseAPI/NeteaseMusic";
import {
  loadShuffleSelection,
  saveShuffleSelection,
} from "../../../playback/ShuffleSelection";
import {
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
    expect(onConfirm).toHaveBeenCalledWith({
      weight: "entry",
      items: [{ id: P.id }],
    });
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
    expect(query).toHaveBeenCalledTimes(1);
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
    expect(onConfirm).toHaveBeenCalledWith(expected);
    expect(onCancel).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
    await flush(150);
    expect(root()).toBeNull();
  });

  it("确认时丢弃打开期间被删除的收藏", async () => {
    const { onConfirm } = await open();
    query.mockResolvedValue([A, P]);
    await click(button("开始随机"));
    expect(onConfirm).toHaveBeenCalledWith({
      weight: "entry",
      items: [{ id: A.id }, { id: P.id }],
    });
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
    expect(onConfirm).toHaveBeenCalledWith({
      weight: "entry",
      items: [{ id: P.id }],
    });
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

  it.each([
    ["读取失败", () => query.mockRejectedValue(new Error("idb"))],
    ["没有收藏", () => query.mockResolvedValue([])],
  ])("收藏为空（%s）：提示且开始随机不可点", async (_, arrange) => {
    arrange();
    await open();
    expect(text()).toContain("当前平台还没有收藏");
    expect(button("开始随机").disabled).toBe(true);
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
    expect(query).toHaveBeenCalledTimes(1);
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

describe("系统返回与历史条目", () => {
  const marker = () =>
    (history.state as Record<string, unknown> | null)?.__imwShufflePickerEntry;
  const pendingRetract = () =>
    (window as unknown as Record<string, unknown>).__imwShufflePickerRetract;
  // 等 history.back() 引起的 popstate 落地（jsdom 异步派发）。
  async function settleHistory() {
    for (let index = 0; index < 300; index++) {
      if (!pendingRetract()) break;
      await flush(5);
    }
    await flush(5);
  }
  async function systemBack() {
    await act(async () => {
      const popped = new Promise((resolve) =>
        window.addEventListener("popstate", resolve, { once: true }),
      );
      history.back();
      await popped;
    });
    await flush();
  }

  beforeEach(async () => {
    // 前面用例的撤回可能还没落地：等它结束，避免串扰。
    await settleHistory();
    history.replaceState(null, "");
  });

  it("打开时登记一条带插件标记的历史条目", async () => {
    const before = history.length;
    await open();
    expect(history.length).toBe(before + 1);
    expect(marker()).toBeTruthy();
  });

  it("系统返回等同取消：面板关闭、不保存、焦点回打开者，不再回退", async () => {
    const back = vi.spyOn(history, "back");
    const { onConfirm, onCancel } = await open();
    await systemBack();
    back.mockClear();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(marker()).toBeUndefined();
    expect(document.activeElement).toBe(opener);
    await flush(150);
    expect(root()).toBeNull();
    // 条目已被返回弹出：不得再撤回一次（否则会退掉宿站的条目）。
    expect(back).not.toHaveBeenCalled();
    expect(loadShuffleSelection("netease")).toBeNull();
    back.mockRestore();
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
  ])(
    "%s 关闭时撤回本面板条目，随之而来的 popstate 不当作其他操作",
    async (_label, action) => {
      const back = vi.spyOn(history, "back");
      const { onCancel } = await open();
      await action();
      expect(back).toHaveBeenCalledOnce();
      await settleHistory();
      expect(marker()).toBeUndefined();
      expect(onCancel).toHaveBeenCalledOnce();
      back.mockRestore();
    },
  );

  it("确认关闭同样撤回条目", async () => {
    const back = vi.spyOn(history, "back");
    const { onConfirm } = await open();
    await click(button("开始随机"));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(back).toHaveBeenCalledOnce();
    await settleHistory();
    expect(marker()).toBeUndefined();
    back.mockRestore();
  });

  it("历史已被他人改动则不撤回", async () => {
    const back = vi.spyOn(history, "back");
    await open();
    history.pushState({ host: 1 }, "");
    await click(button("取消"));
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("打开期间新增条目（宿站改 hash）不关闭面板，关闭时也不回退", async () => {
    const { onCancel } = await open();
    // 新条目 + 一次 popstate（jsdom 对 hash 变化未必派发，显式补一次）。
    await act(async () => {
      history.pushState({ host: 2 }, "", "#imw-test");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    await flush();
    expect(onCancel).not.toHaveBeenCalled();
    expect(root()).not.toBeNull();
    const back = vi.spyOn(history, "back");
    await click(button("取消"));
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("联合历史变长（他人登记条目）后关闭：不回退", async () => {
    const back = vi.spyOn(history, "back");
    const { onCancel } = await open();
    const token = marker();
    history.pushState({ other: 1 }, "");
    // 当前条目恢复为本面板标记，但会话历史已变长。
    history.replaceState({ __imwShufflePickerEntry: token }, "");
    await click(button("取消"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("撤回超时后迟到的 popstate 仍被忽略，不取消期间新开的面板", async () => {
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      await act(async () => {
        openShufflePicker({ platform: "netease" });
      });
      await act(async () => {
        button("取消").click();
      });
      expect(back).toHaveBeenCalledOnce();
      const onCancel = vi.fn();
      const before = marker();
      await act(async () => {
        openShufflePicker({ platform: "netease", onCancel });
      });
      // 撤回未落地：新面板等待，尚未登记条目。
      expect(marker()).toBe(before);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(marker()).toBeTruthy();
      expect(marker()).not.toBe(before);
      expect(pendingRetract()).toBeUndefined();
      // 迟到的回退 popstate（当前条目已不是新面板的）：被标记忽略，新面板保持打开。
      await act(async () => {
        history.replaceState({ host: 1 }, "");
        window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      });
      expect(onCancel).not.toHaveBeenCalled();
      expect(root()).not.toBeNull();
    } finally {
      vi.useRealTimers();
      back.mockRestore();
    }
  });

  it("撤回未落地时立即重开：新面板不被那次 popstate 取消，落地后再登记条目", async () => {
    await open();
    await act(async () => {
      button("取消").click();
    });
    const second = await open();
    expect(root()).not.toBeNull();
    await settleHistory();
    expect(second.onCancel).not.toHaveBeenCalled();
    expect(dialog()).toBeTruthy();
    expect(marker()).toBeTruthy();
    // 新条目照常响应系统返回；旧条目已撤回，返回后不残留任何面板条目。
    await systemBack();
    expect(second.onCancel).toHaveBeenCalledOnce();
    expect(marker()).toBeUndefined();
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
  });

  it("重复注入接管只解绑监听、不动历史", async () => {
    const back = vi.spyOn(history, "back");
    const { onCancel } = await open();
    act(() => releaseShufflePicker());
    expect(back).not.toHaveBeenCalled();
    expect(marker()).toBeTruthy();
    back.mockRestore();
    await systemBack();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
