// src/storage/FavoritesStorageService.ts
import {
  currentValidUid,
  deriveFavoriteId as deriveFavoriteIdImpl,
  inScope,
  storageId as toStorageId,
  getCurrentOwnerUid as currentOwnerUid,
  toPublicRecord,
} from "./favorites/recordUtils";
import {
  dbState,
  ensureOwnerScope as ensureOwnerScopeImpl,
  openDatabase,
  readAll as readAllImpl,
} from "./favorites/database";
import { restorePlatformData as restorePlatformDataImpl } from "./favorites/restorePlatformData";
import { TOMBSTONE_TTL_MS } from "./favorites/tombstones";
import { addFavorite, removeFavorite } from "./favorites/writes";
import { applyRemoteMerge as applyRemoteMergeImpl } from "./favorites/merge";

export interface FavoriteRecord {
  /**
   * 对外的主键（逻辑复合主键 `platform:type:rawId`）。存库时写入 IndexedDB 的主键是
   * `<ownerUid>|<逻辑主键>`；本服务对外一律只暴露逻辑主键（云同步的条目键也是它）。
   */
  id: string;
  /**
   * 归属账号：创建这条收藏时的 `window.uid`。**缺省 = 未归属**（升级瞬间或创建时 uid 无效），
   * 这类记录对当前作用域可见，并在首次出现有效 uid 时一次性归给该 uid（延迟归属），
   * 之后严格按账号隔离、不再变更。
   */
  ownerUid?: string;
  platform: "netease" | "bilibili";
  type: "song" | "album" | "playlist" | "video";
  title: string;
  subtitle?: string;
  coverImg: string;
  author: string;
  websiteUrl: string;
  duration?: number;
  trackCount?: string;
  createdAt: number;
  /** 本条最后修改时间；用于上传落地时的防覆盖判定（同键冲突裁决用的是 createdAt） */
  updatedAt: number;
  /** 软删墓碑时间；有值即视为已删除（不进列表、参与合并；只有**已同步**的墓碑才允许物理清理） */
  deletedAt?: number;
  /** 尚未同步到云端；只有上传成功后才会被清除，未清除的墓碑不得物理清理（否则会被云端复活） */
  dirty?: boolean;
  /** 本条上次成功同步时间（诊断用） */
  syncedAt?: number;
  platformData: PlatformData;
}

/** 云同步的条目形态：墓碑条目 `record` 为 null，只保留 key 与 deletedAt */
export interface FavoriteSyncItem {
  key: string;
  record: FavoriteRecord | null;
  deletedAt: number | null;
}

/** 归属分隔符：主键值 = `<ownerUid>|<逻辑主键>`（逻辑主键里不会出现 `|`） */
const OWNER_SEPARATOR = "|";

export class FavoritesStorageService {
  /** 墓碑保留期：满 30 天在**下一次写事务**中物理清除（仅限已同步上云的墓碑） */
  public static readonly TOMBSTONE_TTL_MS = TOMBSTONE_TTL_MS;

  // 收藏变更监听（云同步据此做 5 秒防抖上传；存储层本身不认识同步模块）
  private static changeListeners: Array<() => void> = [];
  // 外部变更监听（云端拉取落地时触发，供已渲染的收藏列表刷新；**不得**与变更监听混用）
  private static externalChangeListeners: Array<() => void> = [];

  /**
   * 当前读写作用域：有效的 `window.uid`，否则哨兵（游客/未登录）。
   * 注意「延迟归属」：升级时 uid 无效的遗留记录**不写归属**，它们在首次出现有效 uid 时
   * 一次性归给该 uid（见 `attributeUnowned`）；在那之前对当前作用域可见。
   */
  public static getCurrentOwnerUid(): string {
    return currentOwnerUid();
  }

  /**
   * 初始化并打开数据库
   */
  public static async init(): Promise<IDBDatabase | null> {
    return openDatabase();
  }

  /**
   * 注册收藏变更监听（add / remove 后触发，供云同步做防抖上传）
   */
  public static onChange(listener: () => void): () => void {
    if (!this.changeListeners.includes(listener)) {
      this.changeListeners.push(listener);
    }
    return () => {
      this.changeListeners = this.changeListeners.filter(
        (item) => item !== listener,
      );
    };
  }

  /**
   * 注册「外部变更」监听：云端拉取落地后触发，供已渲染的收藏列表刷新。
   * 刻意与 `onChange` 分开——外部变更绝不能反过来触发上传（会形成循环）。
   */
  public static onExternalChange(listener: () => void): () => void {
    if (!this.externalChangeListeners.includes(listener)) {
      this.externalChangeListeners.push(listener);
    }
    return () => {
      this.externalChangeListeners = this.externalChangeListeners.filter(
        (item) => item !== listener,
      );
    };
  }

  private static emitChange(): void {
    for (const listener of this.changeListeners.slice()) {
      try {
        listener();
      } catch (e) {
        console.error("[FavoritesStorage] 变更监听回调异常:", e);
      }
    }
  }

  private static emitExternalChange(): void {
    for (const listener of this.externalChangeListeners.slice()) {
      try {
        listener();
      } catch (e) {
        console.error("[FavoritesStorage] 外部变更监听回调异常:", e);
      }
    }
  }

  /**
   * 根据 PlatformData 生成规范化的唯一标识符
   */
  public static deriveFavoriteId(data: PlatformData): {
    id: string;
    platform: "netease" | "bilibili";
    type: "song" | "album" | "playlist" | "video";
  } | null {
    return deriveFavoriteIdImpl(data);
  }

  /**
   * 判断指定资源或逻辑 ID 在当前账号下是否已收藏（墓碑视为未收藏）
   */
  public static isFavorited(target: string | PlatformData): boolean {
    const logicalId =
      typeof target === "string" ? target : this.deriveFavoriteId(target)?.id;
    if (!logicalId) return false;
    const storageId = toStorageId(this.getCurrentOwnerUid(), logicalId);
    // 未归属记录（键就是逻辑主键）同样算「已收藏」，等待延迟归属
    if (dbState.useFallback) {
      const record =
        dbState.memoryFallback.get(storageId) ??
        dbState.memoryFallback.get(logicalId);
      return !!record && !record.deletedAt;
    }
    return dbState.cachedIds.has(storageId) || dbState.cachedIds.has(logicalId);
  }

  /**
   * 获取当前账号所有已收藏的逻辑 ID 集合（墓碑视为未收藏；不含其他账号与哨兵归属的收藏）
   */
  public static async getAllIds(): Promise<Set<string>> {
    await this.ensureOwnerScope();
    const prefix = `${this.getCurrentOwnerUid()}${OWNER_SEPARATOR}`;
    const ids = new Set<string>();
    for (const key of dbState.cachedIds) {
      if (key.startsWith(prefix)) {
        ids.add(key.slice(prefix.length));
      } else if (key.indexOf(OWNER_SEPARATOR) === -1) {
        // 未归属记录：键就是逻辑主键
        ids.add(key);
      }
    }
    return ids;
  }

  /**
   * 添加收藏（归属当前账号）
   */
  public static async add(data: PlatformData): Promise<FavoriteRecord | null> {
    return addFavorite(data, () => this.emitChange());
  }

  /**
   * 移除收藏：不物理删除，改写入软删墓碑（deletedAt + updatedAt + dirty），
   * 作用域限定在当前账号。
   */
  public static async remove(target: string | PlatformData): Promise<void> {
    return removeFavorite(target, () => this.emitChange());
  }

  /**
   * 切换收藏状态（如果已收藏则删除，未收藏则添加）
   */
  public static async toggle(
    data: PlatformData,
  ): Promise<{ isFavorited: boolean; record?: FavoriteRecord | null }> {
    const meta = this.deriveFavoriteId(data);
    if (!meta) return { isFavorited: false };

    if (this.isFavorited(meta.id)) {
      await this.remove(meta.id);
      return { isFavorited: false };
    } else {
      const record = await this.add(data);
      return { isFavorited: true, record };
    }
  }

  /**
   * 按平台、类型、关键词检索**当前账号**的收藏数据（按时间倒序排列）
   */
  public static async query(options?: {
    platform?: "all" | "netease" | "bilibili";
    type?: "all" | "song" | "album" | "playlist" | "video";
    /** 合并范围（如「歌单与专辑」）；与 `type` 并用时取交集。 */
    types?: FavoriteRecord["type"][];
    keyword?: string;
  }): Promise<FavoriteRecord[]> {
    await this.ensureOwnerScope();
    const platform = options?.platform || "all";
    const type = options?.type || "all";
    const types = options?.types;
    const keyword = options?.keyword?.trim().toLowerCase();
    const owner = this.getCurrentOwnerUid();

    const all = await readAllImpl();
    const records = all.filter((rec) => inScope(rec, owner));

    // 按条件在内存中高效过滤（墓碑不进收藏列表）
    const filtered = records.filter((rec) => {
      if (rec.deletedAt) return false;
      if (platform !== "all" && rec.platform !== platform) return false;
      if (type !== "all" && rec.type !== type) return false;
      if (types && !types.includes(rec.type)) return false;
      if (keyword) {
        const matchTitle = rec.title?.toLowerCase().includes(keyword);
        const matchAuthor = rec.author?.toLowerCase().includes(keyword);
        if (!matchTitle && !matchAuthor) return false;
      }
      return true;
    });

    // 按创建时间倒序（最新收藏在最前）
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    return filtered.map((rec) => toPublicRecord(rec));
  }

  /**
   * 需要当前账号作用域的操作入口：先打开数据库，再完成一次「延迟归属」。
   */
  private static async ensureOwnerScope(): Promise<void> {
    await ensureOwnerScopeImpl();
  }

  public static async getAllForSync(): Promise<FavoriteRecord[]> {
    await this.ensureOwnerScope();
    const owner = currentValidUid();
    if (!owner) return []; // 游客态不参与任何同步
    const all = await readAllImpl();
    return all
      .filter((record) => inScope(record, owner))
      .map((record) => toPublicRecord(record));
  }

  /**
   * 当前账号是否有尚未同步成功的记录（含墓碑）。
   * 用于判断稳态 304 之后是否还需要写回云端。
   */
  public static async hasDirtyRecords(): Promise<boolean> {
    await this.ensureOwnerScope();
    const owner = currentValidUid();
    if (!owner) return false;
    const all = await readAllImpl();
    return all.some(
      (record) => inScope(record, owner) && record.dirty === true,
    );
  }

  /**
   * 把「已成功写入云端」的合并结果批量落地到当前账号（落地细节见 `favorites/merge`）。
   *
   * @param snapshotUpdatedAt 本次快照的 `updatedAt`（判断本地改动是否更新）
   * @param syncedAt 本次写入云端被服务端确认的时间（缺省用当前时间）
   */
  public static async applyRemoteMerge(
    items: FavoriteSyncItem[],
    snapshotUpdatedAt: number,
    syncedAt?: number,
  ): Promise<void> {
    return applyRemoteMergeImpl(items, snapshotUpdatedAt, syncedAt, () =>
      this.emitExternalChange(),
    );
  }

  /**
   * 将 FavoriteRecord 还原为可直接驱动播放/选集的同构 PlatformData
   */
  public static restorePlatformData(record: FavoriteRecord): PlatformData {
    return restorePlatformDataImpl(record);
  }
}
