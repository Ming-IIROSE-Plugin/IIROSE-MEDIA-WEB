# 收藏系统 IndexedDB 存储架构规范 (storage-schema.md)

## 1. 存储选型与考量

- **为什么不用 LocalStorage？**
  - LocalStorage 同步阻塞主线程，上限仅 5MB，若存储大量携带封面 URL、歌曲信息及分 P 详情的条目极易抛出 `QuotaExceededError`。
- **为什么选择 IndexedDB？**
  - **容量庞大**：通常允许使用可用磁盘空间的 50% 以上（几百 MB 至 GB 级），满足用户数千条媒体收藏；
  - **异步非阻塞**：基于事务的异步 Event/Promise 模型，避免卡顿聊天室与播放交互；
  - **索引快速检索**：支持对 `platform`、`type`、`createdAt` 建立多维索引，实现毫秒级分页与组合查询。

---

## 2. 数据库与对象仓库定义

- **Database Name**: `IIROSE_MEDIA_DB`
- **Current Version**: `1`
- **Object Store**: `favorites`
- **KeyPath**: `id` (字符串复合主键)

### 2.1 复合主键生成规则
格式为：`${platform}:${type}:${originalIdentifier}`
- 网易云单曲：`netease:song:${id}`（例：`netease:song:186016`）
- 网易云专辑：`netease:album:${id}`（例：`netease:album:34521`）
- 网易云歌单：`netease:playlist:${id}`（例：`netease:playlist:282988`）
- JOOX 音乐：`joox:song:${id}`（例：`joox:song:s098f`）
- 哔哩哔哩视频：`bilibili:video:${bvid}` 或 `bilibili:video:${aid}`（例：`bilibili:video:BV1xx411c7mD`）

复合主键彻底避免了不同平台或同平台不同类型 ID 碰撞的问题。

---

## 3. 数据表结构 (TypeScript Interface)

```typescript
export interface FavoriteRecord {
  /** 复合唯一标识: platform:type:rawId */
  id: string;

  /** 所属平台 */
  platform: 'netease' | 'joox' | 'bilibili';

  /** 媒体形态 */
  type: 'song' | 'album' | 'playlist' | 'video';

  /** 媒体主标题 */
  title: string;

  /** 媒体副标题/描述 */
  subtitle?: string;

  /** 封面图片（存储前完成 HTTPS 协议升级） */
  coverImg: string;

  /** 作者/歌手/UP 主 */
  author: string;

  /** 源站链接 */
  websiteUrl: string;

  /** 时长（秒） */
  duration?: number;

  /** 曲目/分P总数展示文本 */
  trackCount?: string;

  /** 收藏时间戳（用于时间线倒序排列） */
  createdAt: number;

  /** 完整的 PlatformData 序列化镜像，确保点播/选集与原生 100% 同构 */
  platformData: PlatformData;
}
```

---

## 4. 索引设计 (Indexes)

在 `favorites` store 初始化时创建以下二级索引：

1. `platformIndex`
   - KeyPath: `platform`
   - 用途：快速提取指定平台（如仅网易云或仅 B站）的全部收藏。
2. `typeIndex`
   - KeyPath: `type`
   - 用途：跨平台筛选所有单曲、所有视频。
3. `platformTypeIndex` (复合索引)
   - KeyPath: `['platform', 'type']`
   - 用途：精准查询「网易云的歌单」或「网易云的专辑」。
4. `createdAtIndex`
   - KeyPath: `createdAt`
   - 用途：时间线倒序（Cursor `prev`）分页遍历。

---

## 5. 存储服务接口定义 (`FavoritesStorageService`)

系统封装单例 `FavoritesStorageService` 提供 Promise 风格 API：

```typescript
export class FavoritesStorageService {
  /** 初始化并打开数据库（自动处理 upgrade） */
  static init(): Promise<IDBDatabase>;

  /** 添加或更新收藏项 */
  static add(data: PlatformData): Promise<FavoriteRecord>;

  /** 移除收藏项 */
  static remove(id: string): Promise<void>;

  /** 判断某个媒体项是否已收藏 */
  static isFavorited(id: string): Promise<boolean>;

  /** 获取所有已收藏项的 ID 集合（内存 Set，用于快速同步渲染心形图标） */
  static getAllIds(): Promise<Set<string>>;

  /**
   * 按平台、类型、关键词检索收藏列表
   */
  static query(options: {
    platform?: 'all' | 'netease' | 'joox' | 'bilibili';
    type?: 'all' | 'song' | 'album' | 'playlist' | 'video';
    keyword?: string;
  }): Promise<FavoriteRecord[]>;
}
```

---

## 6. 异常处理与降级机制

1. **隐私模式/不支持 IndexedDB 环境**：
   - 若 `window.indexedDB` 缺失或抛出 SecurityError，服务抛出捕获异常，并使用内存 `Map` 作为当前会话临时备选，界面弱提示「浏览器限制本地数据库，仅本次会话生效」。
2. **封面图混合内容升级**：
   - 存入数据库前，强制执行 `coverImg.replace(/^http:\/\//, 'https://')`，确保持久化内容始终符合 HTTPS 上下文安全规范。
