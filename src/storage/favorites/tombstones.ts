// src/storage/favorites/tombstones.ts
// 墓碑的物理清理。规则的核心不是「过期就删」，而是「只删已同步上云的墓碑」：
// 从没上传过的墓碑一旦被清掉，下次并集合并就会用云端的活记录把已删条目复活。
import type { FavoriteRecord } from "../FavoritesStorageService";
import { tryReadString } from "../localStore";

/** 墓碑保留期：满 30 天在**下一次写事务**中物理清除（仅限已同步上云的墓碑） */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 云端是否可能已有副本：以「同步盐/上次同步时间已存在」为准
 * （启用时写入 salt，关闭同步不清除）。读不出来时按「可能有副本」保守处理。
 */
export function cloudCopyMayExist(): boolean {
  const stored = tryReadString("imwPluginSetting");
  // 读不出来时按「可能有副本」保守处理
  if (!stored.ok) return true;
  if (!stored.value) return false;
  try {
    const sync = (
      JSON.parse(stored.value) as {
        sync?: { salt?: unknown; lastSyncAt?: unknown; enabled?: unknown };
      }
    ).sync;
    if (!sync) return false;
    return !!sync.salt || !!sync.lastSyncAt || sync.enabled === true;
  } catch {
    return true;
  }
}

/**
 * 物理清除满 30 天的墓碑；由写事务顺带执行，不单独触发上传。
 * **只清理已同步上云的墓碑**（`dirty` 已清除）。
 */
export function purgeTombstones(store: IDBObjectStore): void {
  try {
    if (!store.indexNames.contains("deletedAt")) return;
    const cutoff = Date.now() - TOMBSTONE_TTL_MS;
    // 守卫只对「云端可能已有副本」的用户生效：从未启用过同步时云端没有副本，
    // 清掉本地墓碑不会被任何云端活记录复活，因此不受 dirty 限制
    //（否则这些墓碑会无限累积，与 512KB 快照额度冲突）。
    const guardDirty = cloudCopyMayExist();
    const req = store
      .index("deletedAt")
      .openCursor(IDBKeyRange.upperBound(cutoff));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const record = cursor.value as FavoriteRecord | undefined;
      if (guardDirty && record && record.dirty === true) {
        // 还没同步上云：留着，等上传成功后再清理（否则会被云端活记录复活）
        cursor.continue();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
  } catch (e) {
    console.error("[FavoritesStorage] 清理过期墓碑失败:", e);
  }
}
