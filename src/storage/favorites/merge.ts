// src/storage/favorites/merge.ts
// 云端合并结果的本地落地：活记录覆盖写回并清 dirty、墓碑只影响本地同键记录、
// 快照之后被本地改动过的条目跳过、顺带物理清理已同步墓碑。
// 「外部变更」通知由服务层传入回调——它绝不能反过来触发上传。
import type {
  FavoriteRecord,
  FavoriteSyncItem,
} from "../FavoritesStorageService";
import {
  currentValidUid,
  normalizeRecord,
  storageId as toStorageId,
} from "./recordUtils";
import {
  STORE_NAME,
  dbState,
  ensureOwnerScope,
  readAll,
  rebuildFallbackIdCache,
  refreshIdCache,
} from "./database";
import { purgeTombstones } from "./tombstones";

/**
 * 把「已成功写入云端」的合并结果批量落地到当前账号：
 * - 活记录 → 覆盖写回并**清除 dirty**、写 `syncedAt`（30 天墓碑清理的前提）；
 * - 墓碑条目 → 只影响本地已有的同键记录（本地没有则该墓碑对本地无意义）；
 * - `snapshotUpdatedAt` 之后被本地改动过的记录跳过，避免用旧快照覆盖新改动；
 * - 顺带物理清理满 30 天的**已同步**墓碑；
 * - 落地后发出「外部变更」通知，供已渲染的收藏列表刷新。
 *
 * @param snapshotUpdatedAt 本次快照的 `updatedAt`（判断本地改动是否更新）
 * @param syncedAt 本次写入云端被服务端确认的时间（缺省用当前时间）
 */
export async function applyRemoteMerge(
  items: FavoriteSyncItem[],
  snapshotUpdatedAt: number,
  syncedAt: number | undefined,
  emitExternalChange: () => void,
): Promise<void> {
  if (!items || items.length === 0) return;
  await ensureOwnerScope();
  const owner = currentValidUid();
  if (!owner) return;

  const now = typeof syncedAt === "number" ? syncedAt : Date.now();
  const existing = await readAll();
  const existingMap = new Map(existing.map((record) => [record.id, record]));

  const nextRecords: FavoriteRecord[] = [];
  for (const item of items) {
    if (!item || typeof item.key !== "string") continue;
    const storageId = toStorageId(owner, item.key);
    const previous = existingMap.get(storageId);
    const previousUpdatedAt = previous
      ? (previous.updatedAt ?? previous.createdAt ?? 0)
      : 0;
    if (previous && previousUpdatedAt > snapshotUpdatedAt) continue;

    if (item.record) {
      nextRecords.push(
        normalizeRecord({
          ...item.record,
          id: storageId,
          ownerUid: owner,
          deletedAt: undefined,
          dirty: false,
          syncedAt: now,
        }),
      );
    } else if (item.deletedAt && previous) {
      nextRecords.push(
        normalizeRecord({
          ...previous,
          deletedAt: item.deletedAt,
          updatedAt: item.deletedAt,
          dirty: false,
          syncedAt: now,
        }),
      );
    }
  }

  if (dbState.useFallback) {
    for (const record of nextRecords) {
      dbState.memoryFallback.set(record.id, record);
    }
    rebuildFallbackIdCache();
    emitExternalChange();
    return;
  }

  const db = await dbState.dbPromise;
  if (!db) {
    for (const record of nextRecords) {
      dbState.memoryFallback.set(record.id, record);
    }
    rebuildFallbackIdCache();
    emitExternalChange();
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      purgeTombstones(store);
      for (const record of nextRecords) {
        store.put(record);
      }
      tx.oncomplete = () => {
        void refreshIdCache(db).then(() => {
          emitExternalChange();
          resolve();
        });
      };
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
