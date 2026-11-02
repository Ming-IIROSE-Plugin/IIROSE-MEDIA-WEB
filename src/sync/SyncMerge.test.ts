import { describe, expect, it } from "vitest";
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import {
  buildSnapshot,
  countLiveItems,
  itemOperationTime,
  mergeSnapshots,
  resolveConflict,
  toSnapshotItem,
  type SyncSnapshot,
} from "./SyncMerge";

const NOW = 1_800_000_000_000;

function record(
  id: string,
  createdAt: number,
  extra: Partial<FavoriteRecord> = {},
): FavoriteRecord {
  return {
    id,
    platform: "netease",
    type: "song",
    title: id,
    coverImg: "",
    author: "",
    websiteUrl: "",
    createdAt,
    updatedAt: createdAt,
    platformData: { title: id, coverImg: "", author: "", websiteUrl: "" },
    ...extra,
  };
}

function liveItem(id: string, createdAt: number) {
  return { key: id, record: record(id, createdAt), deletedAt: null };
}

function tombstone(id: string, deletedAt: number) {
  return { key: id, record: null, deletedAt };
}

describe("itemOperationTime / countLiveItems", () => {
  it("活记录取 createdAt，墓碑取 deletedAt", () => {
    expect(itemOperationTime(liveItem("a", 10))).toBe(10);
    expect(itemOperationTime(tombstone("a", 20))).toBe(20);
  });

  it("只数活记录", () => {
    expect(countLiveItems([liveItem("a", 1), tombstone("b", 2)])).toBe(1);
  });
});

describe("resolveConflict", () => {
  it("两侧都是活记录时保留 createdAt 更早的一条（冻结矩阵的规定）", () => {
    const earlier = liveItem("a", 100);
    const later = liveItem("a", 200);
    expect(resolveConflict(later, earlier).record?.createdAt).toBe(100);
    expect(resolveConflict(earlier, later).record?.createdAt).toBe(100);
  });

  it("时间相等时保留本地，避免无意义抖动", () => {
    const local = {
      key: "a",
      record: record("a", 100, { title: "本地" }),
      deletedAt: null,
    };
    const remote = {
      key: "a",
      record: record("a", 100, { title: "远端" }),
      deletedAt: null,
    };
    expect(resolveConflict(local, remote).record?.title).toBe("本地");
  });

  it("墓碑晚于活记录时删除胜出，反之收藏胜出", () => {
    const live = liveItem("a", 100);
    const laterDelete = tombstone("a", 200);
    expect(resolveConflict(live, laterDelete).deletedAt).toBe(200);

    const earlierDelete = tombstone("a", 50);
    expect(resolveConflict(live, earlierDelete).record).not.toBeNull();
  });

  it("两侧都是墓碑时保留 deletedAt 更晚的一条", () => {
    expect(
      resolveConflict(tombstone("a", 50), tombstone("a", 90)).deletedAt,
    ).toBe(90);
  });
});

describe("toSnapshotItem / buildSnapshot", () => {
  it("剥离本地同步元数据，缩小密文体积", () => {
    const item = toSnapshotItem(record("a", 1, { dirty: true, syncedAt: 5 }));
    expect(item.record).not.toBeNull();
    expect(item.record && "dirty" in item.record).toBe(false);
    expect(item.record && "syncedAt" in item.record).toBe(false);
  });

  it("墓碑条目的 record 为 null，只留 key 与 deletedAt", () => {
    const item = toSnapshotItem(record("a", 1, { deletedAt: 9 }));
    expect(item).toEqual({ key: "a", record: null, deletedAt: 9 });
  });

  it("按 key 排序，便于两端字节可比", () => {
    const snap = buildSnapshot(
      [record("c", 3), record("a", 1), record("b", 2)],
      NOW,
    );
    expect(snap.items.map((i) => i.key)).toEqual(["a", "b", "c"]);
    expect(snap.version).toBe(2);
    expect(snap.updatedAt).toBe(NOW);
  });
});

describe("mergeSnapshots", () => {
  it("云端为空时原样保留本地全量", () => {
    const local = [record("a", 1), record("b", 2)];
    const { items, stats } = mergeSnapshots(null, local);
    expect(items).toHaveLength(2);
    expect(stats).toEqual({ cloud: 0, local: 2, merged: 2 });
  });

  it("本地 89 / 云端 137 / 重叠 74 → 合并 152（验收夹具）", () => {
    const localRecords = Array.from({ length: 89 }, (_, i) =>
      record(`local-${i}`, NOW - i),
    );
    const overlap = 74;
    const remoteItems = [
      // 重叠部分：云端持有同键但 createdAt 更晚，应按规则保留本地（更早）的那份
      ...localRecords
        .slice(0, overlap)
        .map((r) => liveItem(r.id, r.createdAt + 1000)),
      ...Array.from({ length: 137 - overlap }, (_, i) =>
        liveItem(`cloud-${i}`, NOW - i),
      ),
    ];
    const remote: SyncSnapshot = {
      version: 2,
      updatedAt: NOW,
      items: remoteItems,
    };

    const { items, stats } = mergeSnapshots(remote, localRecords);

    expect(stats).toEqual({ cloud: 137, local: 89, merged: 152 });
    expect(countLiveItems(items)).toBe(152);
    const overlapped = items.find((i) => i.key === "local-0");
    expect(overlapped?.record?.createdAt).toBe(NOW);
  });

  it("云端墓碑能压过本地活记录（删除传播），且不会被本地复活", () => {
    const local = [record("a", 100), record("b", 200)];
    const remote: SyncSnapshot = {
      version: 2,
      updatedAt: NOW,
      items: [tombstone("a", 300)],
    };
    const { items } = mergeSnapshots(remote, local);
    expect(items.find((i) => i.key === "a")?.deletedAt).toBe(300);
    expect(items.find((i) => i.key === "b")?.record).not.toBeNull(); // 云端没有的本地条目保留
  });

  it("本地墓碑能压过云端活记录", () => {
    const local = [record("a", 100, { deletedAt: 400, updatedAt: 400 })];
    const remote: SyncSnapshot = {
      version: 2,
      updatedAt: NOW,
      items: [liveItem("a", 350)],
    };
    const { items } = mergeSnapshots(remote, local);
    expect(items[0].deletedAt).toBe(400);
  });

  it("忽略结构不合法的远端条目，不因此整份失败", () => {
    const remote = {
      version: 2,
      updatedAt: NOW,
      items: [
        { key: "" },
        { key: "ok", record: record("ok", 1), deletedAt: null },
        null,
      ],
    } as unknown as SyncSnapshot;
    const { items } = mergeSnapshots(remote, []);
    expect(items.map((i) => i.key)).toEqual(["ok"]);
  });
});
