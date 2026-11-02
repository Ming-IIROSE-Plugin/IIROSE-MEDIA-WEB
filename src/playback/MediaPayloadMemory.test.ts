import { beforeEach, describe, expect, it } from "vitest";
import { MediaPayloadMemory } from "./MediaPayloadMemory";

beforeEach(() => {
  // 默认存储器是 sessionStorage：每个用例都从干净状态开始。
  sessionStorage.clear();
});

const payload = (title: string) =>
  `&1${JSON.stringify({
    s: "https://a/b.mp3",
    d: 200,
    c: "https://a/c.jpg",
    n: title,
    r: "歌手",
    b: "@0",
    o: "https://music.163.com/#/song?id=1",
    l: "",
  })}`;
const card = (title: string) =>
  JSON.stringify({
    m: `m__4@0>${title}>歌手>https://a/c.jpg>000000>320`,
    mc: "000000",
    i: "1",
  });

describe("播放报文缓存", () => {
  it("只缓存播放报文；同曲再记录会覆盖成最新一条", () => {
    const memory = new MediaPayloadMemory(() => "room-a");
    memory.record(payload("甲"));
    expect(memory.hit("room-a", "甲")).toEqual({ payload: payload("甲") });
  });

  it("卡片报文不进缓存（循环重播从不发卡片）", () => {
    const memory = new MediaPayloadMemory(() => "room-a");
    memory.record(card("甲"));
    expect(memory.hit("room-a", "甲")).toBeNull();
  });

  it("换房间清空缓存，之后重新记录才可命中", () => {
    let room: string | null = "room-a";
    const memory = new MediaPayloadMemory(() => room);
    memory.record(payload("甲"));
    room = "room-b";
    expect(memory.hit("room-a", "甲")).toBeNull();
    memory.record(payload("乙"));
    expect(memory.hit("room-b", "乙")?.payload).toBe(payload("乙"));
  });

  it("房间标识瞬时缺失时既不写入也不清空", () => {
    let room: string | null = "room-a";
    const memory = new MediaPayloadMemory(() => room);
    memory.record(payload("甲"));
    room = null;
    memory.record(payload("乙"));
    // 房间未知时不做判定；缓存也没被清掉，房间恢复后仍可命中。
    expect(memory.hit("room-a", "甲")).toBeNull();
    room = "room-a";
    expect(memory.hit("room-a", "甲")?.payload).toBe(payload("甲"));
  });

  it("忽略非点播报文与缺标题的报文", () => {
    const memory = new MediaPayloadMemory(() => "room-a");
    memory.record('!15["<","1s"]');
    memory.record('{"m":"普通消息","mc":"008000","i":"1"}');
    memory.record("&1不是JSON");
    memory.record(`&1${JSON.stringify({ s: "x" })}`);
    expect(memory.hit("room-a", "任意")).toBeNull();
  });

  it("超过有效期的报文不再命中", () => {
    let clock = 1_000_000;
    const memory = new MediaPayloadMemory(
      () => "room-a",
      () => clock,
    );
    memory.record(payload("甲"));
    expect(memory.hit("room-a", "甲")).not.toBeNull();
    clock += 6 * 60 * 60 * 1000 + 1;
    expect(memory.hit("room-a", "甲")).toBeNull();
  });

  it("标题比较忽略首尾空白，clear 后不再命中", () => {
    const memory = new MediaPayloadMemory(() => "room-a");
    memory.record(payload("甲"));
    expect(memory.hit("room-a", " 甲 ")?.payload).toBe(payload("甲"));
    memory.clear();
    expect(memory.hit("room-a", "甲")).toBeNull();
  });

  it("last 不看标题：cut 之后歌名被清空也能取到上一条", () => {
    const memory = new MediaPayloadMemory(() => "room-a");
    memory.record(payload("甲"));
    expect(memory.last("room-a")?.payload).toBe(payload("甲"));
    expect(memory.hit("room-a", "")).toBeNull();
  });
});

function memoryStore(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

describe("刷新后恢复报文缓存", () => {
  it("新实例读到上一页留下的报文", () => {
    const store = memoryStore();
    const first = new MediaPayloadMemory(
      () => "room-a",
      () => 1000,
      store,
    );
    first.record(payload("甲"));

    const second = new MediaPayloadMemory(
      () => "room-a",
      () => 2000,
      store,
    );
    expect(second.hit("room-a", "甲")).toEqual({ payload: payload("甲") });
  });

  it("旧存档里的 card 字段被忽略，不影响报文命中", () => {
    const store = memoryStore();
    store.setItem(
      "imwMediaPayload",
      JSON.stringify({
        version: 1,
        roomKey: "room-a",
        payload: { text: payload("甲"), title: "甲", at: 1000 },
        card: { text: card("甲"), title: "甲" },
      }),
    );
    const memory = new MediaPayloadMemory(
      () => "room-a",
      () => 2000,
      store,
    );
    expect(memory.hit("room-a", "甲")).toEqual({ payload: payload("甲") });
  });

  it("换房间后存档不再命中，新房间重新记录才生效", () => {
    const store = memoryStore();
    const first = new MediaPayloadMemory(
      () => "room-a",
      () => 1000,
      store,
    );
    first.record(payload("甲"));

    const other = new MediaPayloadMemory(
      () => "room-b",
      () => 2000,
      store,
    );
    expect(other.hit("room-b", "甲")).toBeNull();
    other.record(payload("乙"));
    expect(other.hit("room-b", "乙")?.payload).toBe(payload("乙"));
  });

  it("存档过期后不再命中", () => {
    const store = memoryStore();
    const first = new MediaPayloadMemory(
      () => "room-a",
      () => 1000,
      store,
    );
    first.record(payload("甲"));
    const later = new MediaPayloadMemory(
      () => "room-a",
      () => 1000 + 7 * 60 * 60 * 1000,
      store,
    );
    expect(later.hit("room-a", "甲")).toBeNull();
  });

  it("clear 会清掉存档，损坏存档按空处理", () => {
    const store = memoryStore();
    const memory = new MediaPayloadMemory(
      () => "room-a",
      () => 1000,
      store,
    );
    memory.record(payload("甲"));
    memory.clear();
    expect(store.getItem("imwMediaPayload")).toBeNull();

    store.setItem("imwMediaPayload", "{bad json");
    expect(
      new MediaPayloadMemory(
        () => "room-a",
        () => 1000,
        store,
      ).hit("room-a", "甲"),
    ).toBeNull();
  });
});
