// src/storage/favorites/writes.ts
// 收藏的写入路径：新增（封面 HTTPS 升级 + platformData 脱钩）与软删墓碑。
// 与 database.ts 的分工一致：这里只做「写一条记录」，变更通知由服务层传入回调，
// 监听器单例仍然只属于 FavoritesStorageService。
import type { FavoriteRecord } from "../FavoritesStorageService";
import {
  currentValidUid,
  deriveFavoriteId,
  getCurrentOwnerUid,
  storageId as toStorageId,
  toPublicRecord,
} from "./recordUtils";
import { STORE_NAME, dbState, ensureOwnerScope } from "./database";
import { purgeTombstones } from "./tombstones";

/**
 * 添加收藏（归属当前账号）
 */
export async function addFavorite(
  data: PlatformData,
  emitChange: () => void,
): Promise<FavoriteRecord | null> {
  await ensureOwnerScope();
  const meta = deriveFavoriteId(data);
  if (!meta) {
    console.warn("[FavoritesStorage] 无法提取有效收藏主键", data);
    return null;
  }

  // 解析并升级 HTTPS 封面
  let resolvedCover = "";
  try {
    resolvedCover =
      typeof data.coverImg === "string" ? data.coverImg : await data.coverImg;
  } catch {
    resolvedCover = "";
  }
  if (resolvedCover) {
    resolvedCover = resolvedCover.replace(/^http:\/\//, "https://");
  }

  // 复制 platformData，剥离无法序列化的 Promise 属性
  const sanitizedPlatformData: PlatformData = {
    ...data,
    coverImg: resolvedCover,
    multiPage: undefined, // 存库时脱钩，恢复时重组
  };

  const ownerUid = currentValidUid();
  const storageId = ownerUid ? toStorageId(ownerUid, meta.id) : meta.id;
  const now = Date.now();
  const record: FavoriteRecord = {
    id: storageId,
    ...(ownerUid ? { ownerUid } : {}),
    platform: meta.platform,
    type: meta.type,
    title: data.title,
    subtitle: data.subtitle,
    coverImg: resolvedCover,
    author: data.author || "",
    websiteUrl: data.websiteUrl || "",
    duration: data.duration,
    trackCount: data.trackCount,
    createdAt: now,
    updatedAt: now,
    // 同键再次收藏：写入的新记录天然覆盖旧墓碑
    deletedAt: undefined,
    dirty: true,
    platformData: sanitizedPlatformData,
  };

  dbState.cachedIds.add(storageId);

  if (dbState.useFallback) {
    dbState.memoryFallback.set(storageId, record);
    emitChange();
    return toPublicRecord(record);
  }

  const db = await dbState.dbPromise;
  if (!db) {
    dbState.memoryFallback.set(storageId, record);
    emitChange();
    return toPublicRecord(record);
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      purgeTombstones(store);
      const req = store.put(record);
      req.onsuccess = () => {
        emitChange();
        resolve(toPublicRecord(record));
      };
      req.onerror = (e) => {
        console.error("[FavoritesStorage] 写入 IndexedDB 失败:", e);
        dbState.memoryFallback.set(storageId, record);
        emitChange();
        resolve(toPublicRecord(record));
      };
    } catch (e) {
      dbState.memoryFallback.set(storageId, record);
      emitChange();
      resolve(toPublicRecord(record));
    }
  });
}

/**
 * 移除收藏：不物理删除，改写入软删墓碑（deletedAt + updatedAt + dirty），
 * 作用域限定在当前账号。
 */
export async function removeFavorite(
  target: string | PlatformData,
  emitChange: () => void,
): Promise<void> {
  await ensureOwnerScope();
  const logicalId =
    typeof target === "string" ? target : deriveFavoriteId(target)?.id;
  if (!logicalId) return;

  // 与 isFavorited() 对称：优先当前账号的键；未归属记录（游客态/升级时 uid 无效）
  // 的键就是裸逻辑主键，必须回退到它，否则取消收藏会静默失败、星标反弹。
  const ownerKey = toStorageId(getCurrentOwnerUid(), logicalId);
  const storageId = dbState.cachedIds.has(ownerKey) ? ownerKey : logicalId;

  dbState.cachedIds.delete(ownerKey);
  dbState.cachedIds.delete(logicalId);

  const now = Date.now();

  if (dbState.useFallback) {
    const existing = dbState.memoryFallback.get(storageId);
    if (existing && !existing.deletedAt) {
      dbState.memoryFallback.set(storageId, {
        ...existing,
        deletedAt: now,
        updatedAt: now,
        dirty: true,
      });
      emitChange();
    }
    return;
  }

  const db = await dbState.dbPromise;
  if (!db) {
    const existing = dbState.memoryFallback.get(storageId);
    if (existing && !existing.deletedAt) {
      dbState.memoryFallback.set(storageId, {
        ...existing,
        deletedAt: now,
        updatedAt: now,
        dirty: true,
      });
      emitChange();
    }
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      purgeTombstones(store);
      const getReq = store.get(storageId);
      getReq.onsuccess = () => {
        const existing = getReq.result as FavoriteRecord | undefined;
        if (!existing || existing.deletedAt) {
          resolve();
          return;
        }
        const putReq = store.put({
          ...existing,
          deletedAt: now,
          updatedAt: now,
          dirty: true,
        });
        putReq.onsuccess = () => {
          emitChange();
          resolve();
        };
        putReq.onerror = () => resolve();
      };
      getReq.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
