import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const DB_NAME = "IIROSE_MEDIA_DB";
const UID_A = "6e3f0a1b2c4d5";
const UID_B = "aaaabbbbcccc1";
const TTL = 30 * 24 * 60 * 60 * 1000;

type Service =
  typeof import("./FavoritesStorageService").FavoritesStorageService;

/** 每例一份全新模块实例：服务内部缓存了 dbPromise 与 ID 缓存 */
async function freshService(): Promise<Service> {
  vi.resetModules();
  const mod = await import("./FavoritesStorageService");
  return mod.FavoritesStorageService;
}

function setUid(uid: string | undefined) {
  (globalThis as any).window.uid = uid;
}

function song(id: string, title = id) {
  return {
    title,
    coverImg: "",
    author: "作者",
    websiteUrl: "",
    neteaseMusic: { id },
  } as any;
}

/**
 * 每例换一个全新的 IndexedDB 实例，而不是删库：
 * 服务内部长期持有连接，deleteDatabase 会被它阻塞，后续 open 也跟着卡死。
 */
function resetDb() {
  const factory = new IDBFactory();
  (globalThis as any).indexedDB = factory;
  if ((globalThis as any).window)
    (globalThis as any).window.indexedDB = factory;
}

function openRaw(
  version?: number,
  upgrade?: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version
      ? indexedDB.open(DB_NAME, version)
      : indexedDB.open(DB_NAME);
    req.onupgradeneeded = () => upgrade?.(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAll(db: IDBDatabase): Promise<any[]> {
  return new Promise((resolve) => {
    const req = db
      .transaction("favorites", "readonly")
      .objectStore("favorites")
      .getAll();
    req.onsuccess = () => resolve(req.result as any[]);
    req.onerror = () => resolve([]);
  });
}

function putRaw(db: IDBDatabase, records: any[]): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction("favorites", "readwrite");
    for (const r of records) tx.objectStore("favorites").put(r);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** v2 时期的老库：主键是裸逻辑主键，已有 updatedAt/dirty，没有 ownerUid/index */
function upgradeToV2(db: IDBDatabase) {
  const store = db.createObjectStore("favorites", { keyPath: "id" });
  store.createIndex("platform", "platform", { unique: false });
  store.createIndex("type", "type", { unique: false });
  store.createIndex("platform_type", ["platform", "type"], { unique: false });
  store.createIndex("createdAt", "createdAt", { unique: false });
}

function v2Record(id: string, createdAt: number) {
  return {
    id,
    platform: "netease",
    type: "song",
    title: `标题-${id}`,
    coverImg: "https://example.com/a.jpg",
    author: "作者",
    websiteUrl: "https://music.163.com/song?id=1",
    createdAt,
    updatedAt: createdAt,
    dirty: true,
    platformData: { title: `标题-${id}` },
  };
}

beforeEach(async () => {
  resetDb();
  localStorage.clear();
  setUid(UID_A);
});

describe("v2 → v3 原地升级与账号隔离", () => {
  it("老记录保留、主键改写为 <uid>|<逻辑键>、旧裸键不残留", async () => {
    const old = await openRaw(2, upgradeToV2);
    await putRaw(old, [
      v2Record("netease:song:1", 111),
      v2Record("netease:song:2", 222),
    ]);
    old.close();

    const svc = await freshService();
    await svc.init();

    // 对外（快照）用的是**逻辑主键**；带前缀的存库主键只在库里
    const records = await svc.getAllForSync();
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.id).sort()).toEqual([
      "netease:song:1",
      "netease:song:2",
    ]);
    // 内容没丢
    const one = records.find((r) => r.id.endsWith("netease:song:1"))!;
    expect(one.title).toBe("标题-netease:song:1");
    expect(one.coverImg).toBe("https://example.com/a.jpg");
    expect(one.createdAt).toBe(111);

    // 旧裸键必须已被删除，否则同一条会以两个键重复出现
    const db = await openRaw();
    const all = await readAll(db);
    db.close();
    expect(all.map((r) => r.id).sort()).toEqual([
      `${UID_A}|netease:song:1`,
      `${UID_A}|netease:song:2`,
    ]);
    expect(all.every((r) => r.ownerUid === UID_A)).toBe(true);
  });

  it("升级时 uid 无效则保持未归属，首次有效 uid 时一次性归属", async () => {
    setUid(undefined);
    const old = await openRaw(2, upgradeToV2);
    await putRaw(old, [v2Record("netease:song:7", 700)]);
    old.close();

    const svc = await freshService();
    await svc.init();

    let db = await openRaw();
    let all = await readAll(db);
    db.close();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("netease:song:7");
    expect(all[0].ownerUid).toBeUndefined();

    // 出现有效 uid → 归属，且只发生一次
    setUid(UID_B);
    await svc.query();
    db = await openRaw();
    all = await readAll(db);
    db.close();
    expect(all[0].id).toBe(`${UID_B}|netease:song:7`);
    expect(all[0].ownerUid).toBe(UID_B);
  });
});

describe("收藏读写与账号隔离", () => {
  it("同一浏览器换账号后互不可见，切回原账号仍可见", async () => {
    const svc = await freshService();
    await svc.init();
    await svc.add(song("1001", "A 的歌"));

    expect((await svc.query()).map((r) => r.title)).toEqual(["A 的歌"]);
    expect(svc.isFavorited(`${UID_A}|netease:song:1001`)).toBe(true);

    setUid(UID_B); // 同一模块实例、同一个库，只换账号
    expect(await svc.query()).toEqual([]);
    expect((await svc.getAllIds()).size).toBe(0);

    setUid(UID_A);
    expect((await svc.query()).map((r) => r.title)).toEqual(["A 的歌"]);
  });

  it("两个账号收藏同一首歌互不覆盖（主键带归属前缀的意义）", async () => {
    const svc = await freshService();
    await svc.init();

    setUid(UID_A);
    await svc.add(song("1001", "A 的歌"));
    setUid(UID_B);
    await svc.add(song("1001", "B 的歌"));

    setUid(UID_A);
    expect((await svc.query()).map((r) => r.title)).toEqual(["A 的歌"]);
    setUid(UID_B);
    expect((await svc.query()).map((r) => r.title)).toEqual(["B 的歌"]);
  });

  it("游客态也能取消收藏（回退裸逻辑主键，不再静默失败）", async () => {
    setUid(undefined);
    const svc = await freshService();
    await svc.init();
    await svc.add(song("2002", "游客的歌"));
    expect(await svc.query()).toHaveLength(1);

    await svc.remove(`${"netease:song:2002"}`);
    expect(await svc.query()).toEqual([]);
    expect(svc.isFavorited("netease:song:2002")).toBe(false);
  });
});

describe("收藏查询", () => {
  it("types 合并范围（歌单与专辑）与 type / platform / 关键词一起取交集", async () => {
    const svc = await freshService();
    await svc.init();
    await svc.add(song("6001", "某单曲"));
    await svc.add({
      title: "某专辑",
      coverImg: "",
      author: "作者",
      websiteUrl: "https://music.163.com/#/album?id=9",
      neteaseMusic: { id: 9, fee: 0, isAlbum: true },
    } as any);
    await svc.add({
      title: "某歌单",
      coverImg: "",
      author: "作者",
      websiteUrl: "https://music.163.com/#/playlist?id=8",
      neteaseMusic: { id: 8, fee: 0, isSongList: true },
    } as any);
    // 另一来源的记录：用来验证「来源筛选」真的筛库，而不是只在调用参数上出现过
    await svc.add({
      title: "Vocaloid Live",
      coverImg: "",
      author: "UP主",
      websiteUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
      bilibili: { aid: 7, bvid: "BV1xx411c7mD" },
    } as any);

    const collection = await svc.query({ types: ["album", "playlist"] });
    expect(collection.map((r) => r.type).sort()).toEqual(["album", "playlist"]);

    // 来源筛选：只剩该平台的记录，合并范围下也不会混进别的来源
    expect(
      (await svc.query({ platform: "bilibili" })).map((r) => r.title),
    ).toEqual(["Vocaloid Live"]);
    expect(
      await svc.query({ platform: "bilibili", types: ["album", "playlist"] }),
    ).toEqual([]);
    expect(
      (await svc.query({ platform: "netease", types: ["album", "playlist"] }))
        .map((r) => r.type)
        .sort(),
    ).toEqual(["album", "playlist"]);

    // 与 type 并用取交集：视频类型下没有专辑/歌单
    expect(
      await svc.query({ type: "video", types: ["album", "playlist"] }),
    ).toEqual([]);
    // 与关键词取交集
    expect(
      (await svc.query({ types: ["album", "playlist"], keyword: "专辑" })).map(
        (r) => r.title,
      ),
    ).toEqual(["某专辑"]);
    // 关键词不区分大小写（收藏即时过滤的约定）
    expect(
      (await svc.query({ keyword: "vocaloid" })).map((r) => r.title),
    ).toEqual(["Vocaloid Live"]);

    // 墓碑不进合并范围
    await svc.remove({
      title: "某专辑",
      coverImg: "",
      author: "作者",
      websiteUrl: "https://music.163.com/#/album?id=9",
      neteaseMusic: { id: 9, fee: 0, isAlbum: true },
    } as any);
    expect(
      (await svc.query({ types: ["album", "playlist"] })).map((r) => r.type),
    ).toEqual(["playlist"]);
  });
});

describe("墓碑语义", () => {
  it("删除写墓碑：不进列表、isFavorited 为假，但记录仍在库里", async () => {
    const svc = await freshService();
    await svc.init();
    await svc.add(song("3003"));
    await svc.remove(song("3003"));

    expect(await svc.query()).toEqual([]);
    expect(svc.isFavorited(`${UID_A}|netease:song:3003`)).toBe(false);

    const records = await svc.getAllForSync();
    expect(records).toHaveLength(1);
    expect(records[0].deletedAt).toBeTypeOf("number");
  });

  it("云端可能存在副本时，未同步的墓碑不被清理", async () => {
    localStorage.setItem(
      "imwPluginSetting",
      JSON.stringify({ sync: { enabled: true } }),
    );
    const svc = await freshService();
    await svc.init();
    await svc.add(song("4004"));
    await svc.remove(song("4004"));

    // 把墓碑做旧到 30 天以前
    let db = await openRaw();
    let all = await readAll(db);
    await putRaw(db, [{ ...all[0], deletedAt: Date.now() - TTL - 1000 }]);
    db.close();

    // 触发一次写事务（add 内部会跑清理）
    await svc.add(song("9999"));
    db = await openRaw();
    all = await readAll(db);
    db.close();
    expect(all.some((r) => r.id.endsWith("netease:song:4004"))).toBe(true);
  });

  it("云端不可能有副本（从未启用同步）时，做旧墓碑照常清理", async () => {
    const svc = await freshService();
    await svc.init();
    await svc.add(song("5005"));
    await svc.remove(song("5005"));

    let db = await openRaw();
    let all = await readAll(db);
    await putRaw(db, [{ ...all[0], deletedAt: Date.now() - TTL - 1000 }]);
    db.close();

    await svc.add(song("8888"));
    db = await openRaw();
    all = await readAll(db);
    db.close();
    expect(all.some((r) => r.id.endsWith("netease:song:5005"))).toBe(false);
  });
});
