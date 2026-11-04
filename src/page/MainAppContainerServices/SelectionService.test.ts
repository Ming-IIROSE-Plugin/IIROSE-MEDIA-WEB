import { describe, expect, it } from "vitest";
import { SelectionService } from "./SelectionService";
import { requestKey as baseRequestKey } from "../../playback/RequestGuard";

// 内页多选的纯逻辑：勾选按绝对位置记、序号即数组下标、发送后只摘掉本次发出的。
// 状态归容器，这里只验证数组变换。

/** 曲目行：`id` 缺省时就是「没有网易云 id」的不可选行。 */
const row = (title: string, id?: number): PlatformData =>
  ({
    title,
    coverImg: "",
    author: "",
    websiteUrl: "https://music.163.com/song?id=1",
    ...(id === undefined ? {} : { neteaseMusic: { id, fee: 0 } }),
  }) as PlatformData;

/** 内页来源（歌单 / 专辑）：`requestKey` 靠它的网易云 id 定身份。 */
const collection = (id: number): PlatformData =>
  ({
    title: "某歌单",
    coverImg: "",
    author: "",
    websiteUrl: `https://music.163.com/playlist?id=${id}`,
    neteaseMusic: { id, isSongList: true, fee: 0 },
  }) as PlatformData;

describe("能不能勾", () => {
  it("只有带网易云曲目 id 的行可选", () => {
    expect(SelectionService.canSelect(row("甲", 1))).toBe(true);
    expect(SelectionService.canSelect(row("乙"))).toBe(false);
  });

  it("没有 id 的行 toggle 原样返回，调用方可据此跳过 setState", () => {
    const empty: InnerSelectionItem[] = [];
    expect(SelectionService.toggle(empty, 3, row("乙"))).toBe(empty);

    const picked = SelectionService.toggle(empty, 0, row("甲", 1));
    expect(SelectionService.toggle(picked, 3, row("乙"))).toBe(picked);
    expect(SelectionService.ids(picked)).toEqual([1]);
  });
});

describe("勾选顺序", () => {
  it("按点选顺序追加，序号从 1 起，没勾选的位置没有序号", () => {
    let selection = SelectionService.toggle([], 0, row("甲", 1));
    selection = SelectionService.toggle(selection, 1, row("乙", 2));
    selection = SelectionService.toggle(selection, 2, row("丙", 3));

    expect(selection.map((item) => item.position)).toEqual([0, 1, 2]);
    expect(selection[0]).toEqual({ position: 0, id: 1, title: "甲" });
    expect(SelectionService.orderOf(selection, 0)).toBe(1);
    expect(SelectionService.orderOf(selection, 2)).toBe(3);
    expect(SelectionService.orderOf(selection, 9)).toBeUndefined();
    expect(SelectionService.hasPosition(selection, 1)).toBe(true);
    expect(SelectionService.hasPosition(selection, 9)).toBe(false);
  });

  it("点已勾选的位置即取消，后面的序号前移", () => {
    let selection = SelectionService.toggle([], 0, row("甲", 1));
    selection = SelectionService.toggle(selection, 1, row("乙", 2));
    selection = SelectionService.toggle(selection, 2, row("丙", 3));

    // 取消中间那一项
    selection = SelectionService.toggle(selection, 1, row("乙", 2));
    expect(SelectionService.hasPosition(selection, 1)).toBe(false);
    expect(SelectionService.orderOf(selection, 2)).toBe(2);

    // 再取消第一项，剩下那项的序号继续前移
    selection = SelectionService.toggle(selection, 0, row("甲", 1));
    expect(SelectionService.orderOf(selection, 2)).toBe(1);
    expect(selection).toHaveLength(1);
  });

  it("同一首歌重复出现时按绝对位置各自可选、各自计序", () => {
    const song = row("甲", 7);
    let selection = SelectionService.toggle([], 4, song);
    selection = SelectionService.toggle(selection, 9, song);

    expect(selection.map((item) => item.position)).toEqual([4, 9]);
    expect(SelectionService.ids(selection)).toEqual([7, 7]);
    expect(SelectionService.orderOf(selection, 4)).toBe(1);
    expect(SelectionService.orderOf(selection, 9)).toBe(2);

    // 只取消其中一个位置，另一个留着
    selection = SelectionService.toggle(selection, 4, song);
    expect(selection.map((item) => item.position)).toEqual([9]);
  });

  it("ids 按点选顺序给出，不是列表顺序", () => {
    let selection = SelectionService.toggle([], 2, row("丙", 3));
    selection = SelectionService.toggle(selection, 0, row("甲", 1));
    expect(SelectionService.ids(selection)).toEqual([3, 1]);
    expect(SelectionService.ids([])).toEqual([]);
  });

  it("clear 给空数组（不是 undefined），离开内页后能直接当现场用", () => {
    const cleared = SelectionService.clear();
    expect(Array.isArray(cleared)).toBe(true);
    expect(cleared).toEqual([]);
    expect(SelectionService.ids(cleared)).toEqual([]);
  });
});

describe("发送后的收尾", () => {
  const sent: InnerSelectionItem[] = [
    { position: 0, id: 1, title: "甲" },
    { position: 1, id: 2, title: "乙" },
  ];
  const waiting: InnerSelectionItem = { position: 5, id: 9, title: "后勾" };

  it("只去掉本次发出的，等待期间新勾的保留", () => {
    const page = collection(501);
    const current = {
      innerCollection: page,
      innerSelection: [...sent, waiting],
    };

    expect(SelectionService.afterSend(sent, current, page)).toEqual([waiting]);
  });

  it("期间已换到别的内页：那些勾选属于原来那张列表，一律不动", () => {
    const page = collection(501);
    const current = {
      innerCollection: page,
      innerSelection: [...sent, waiting],
    };

    // 同一个 source 的另一份实例也算换过内页（按引用比）
    expect(SelectionService.afterSend(sent, current, collection(501))).toBe(
      current.innerSelection,
    );
    expect(SelectionService.afterSend(sent, current, collection(777))).toBe(
      current.innerSelection,
    );
  });
});

describe("点播所选", () => {
  it("守卫键带 :selected 后缀，与整张播放各自独立", () => {
    const page = collection(501);
    const key = SelectionService.requestKey(page);

    expect(key).toBe(`${baseRequestKey(page)}:selected`);
    expect(key.endsWith(":selected")).toBe(true);
    // 同一张列表稳定、不同列表不同键
    expect(SelectionService.requestKey(collection(501))).toBe(key);
    expect(SelectionService.requestKey(collection(502))).not.toBe(key);
  });
});
