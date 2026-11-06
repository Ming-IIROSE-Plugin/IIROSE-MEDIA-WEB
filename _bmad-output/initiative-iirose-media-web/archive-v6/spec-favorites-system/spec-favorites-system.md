---
title: '媒体收藏系统（IndexedDB 本地持久化与双态切换）'
type: 'feature'
created: '2026-10-12'
status: 'done'
baseline_commit: '728e23edbbba46bf9d9f4001c5dd96eaa7c413af'
route: 'oneshot'
review_loop_iteration: 1
context:
  - '_bmad-output/specs/spec-favorites-system/SPEC.md'
  - '_bmad-output/specs/spec-favorites-system/navigation-and-ia.md'
  - '_bmad-output/specs/spec-favorites-system/storage-schema.md'
  - '_bmad-output/specs/spec-favorites-system/interaction-specs.md'
  - '_bmad-output/specs/spec-favorites-system/stories.yaml'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 蔷薇花园聊天室插件用户在点播音乐与视频后缺乏个人资产留存机制，每次重复点播需重新搜索；同时需要在不破坏顶栏原生「音乐 vs 视频」最高级分类的前提下，提供多平台（网易云单曲/专辑/歌单、JOOX单曲、B站视频）的持久化收藏与点播支持。

**Approach:** 基于客户端原生 IndexedDB 构建 FavoritesStorageService 异步持久化层；在 Row 2 工具栏引入点亮/点暗模式切换按钮（严格按「卡片/列表 -> ⭐收藏模式 -> 搜索框 -> xx/xx -> 上一页 -> 下一页」顺序排布）；在卡片与列表行集成零延迟乐观星标按钮；在收藏模式下联动 Row 3 平台与 Row 4 格式标签并支持本地毫秒级过滤，复用原生点播与高级有序选集能力。

</frozen-after-approval>

## Implementation Notes

- 实现 `src/storage/FavoritesStorageService.ts`：
  - 基于 IndexedDB（`IIROSE_MEDIA_DB`, v1）构建 `favorites` 对象仓库；
  - 采用复合主键 `platform:type:rawId`（网易云单曲/专辑/歌单、JOOX 单曲、B站视频），彻底规避跨平台 ID 碰撞；
  - 建立 `platform`、`type`、`platform_type`、`createdAt` 多维索引，数据按创建时间倒序排列；
  - 封面写入前自动升级为 HTTPS 协议，剥离 Promise 并持久化；
  - 维护全量已收藏 ID 的内存缓存 `Set<string>`，提供 `isFavorited` 纳秒级同步判别；支持隐私模式下 `Map` 优雅降级；
  - `restorePlatformData` 在还原数据时自动为专辑/歌单/多分 P 重新装载 `multiPage` 探测 Promise。
- 在 `src/app.css` 注入自包含 MDI 图标：
  - `.starOutlineIcon::before { content: "\F04CF"; }`（空心星）
  - `.starSolidIcon::before { content: "\F04CE"; }`（实心星）
  - 均绑定 `font-family: "md"`，严禁借用宿站未知样式。
- 实现 `src/page/components/media-card-container/FavoriteStarButton.tsx`：
  - 卡片视图（Card View）采用右上角 36×36px 半透明磨砂玻璃圆钮；
  - 列表视图（List Row）采用右侧内联紧凑方块；
  - 点击时立即乐观切换图标高亮并触发微动效，后台异步同步 IndexedDB，调用宿站 `ShowMessage.show` 弱提示；
  - 在不支持收藏的平台上自动隐藏。
- 在 `src/page/components/media-card-container/MediaCard.tsx` 与 `MediaListRow.tsx` 集成 `FavoriteStarButton`。
- 重构 `src/page/components/mediaContainerBar/MediaSearchBar.tsx`：
  - Row 2 水平序列严格排列为：`[卡片/列表] [⭐收藏模式] [🔍 搜索] [xx/xx] [上一页] [下一页]`；
  - 实现「⭐收藏模式」点亮（明黄实心星 + 深色底）与点暗（白色空心星 + 浅色底）双态切换；
  - 移动端保持 44×44px 触控尺寸，搜索框占位符随模式动态切换为「过滤收藏」。
- 实现 `src/page/MainAppContainerServices/FavoritesService.ts`：
  - 封装通用收藏分页加载器，连接 IndexedDB 查询与各平台点播分发器（NetEase MOD/AOD/MLOD/MVOD, JOOX MOD, Bilibili VOD）。
- 增强 `src/page/MainAppContainer.tsx`：
  - 状态新增 `favoritesMode: boolean`，在 `controller` 中提供 `toggleFavoritesMode`；
  - 定义 `favoritesCategories`，在收藏模式下联动 Row 3 平台与 Row 4 形态（网易云：全部/单曲/专辑/歌单；JOOX：全部/单曲；B站：全部/视频）；
  - `componentDidUpdate` 监听关键词在收藏模式下的变更，实现 0 延迟本地关键词过滤；监听 `CategoriesIndex` 变更自动重置平台索引；
  - 挂载 `FavoritesStorageService.init()` 预热。
- 构建验证：`npm run build` 成功通过，产出 `dist/bundle.js`（245.51 kB）。

## Review Triage Log

- **Finding 1 (NetEase onDemandPlay 分发缺失多形态)**: 已修复。在 `FavoritesService.loadFavorites` 的 `onDemandPlay` 中细分 `isAlbum -> AOD`、`isSongList -> MLOD`、`isMV -> MVOD`，单曲回退 `MOD`。
- **Finding 2 (Bilibili pagelist API 参数 aid=undefined 抛错)**: 已修复。在 `FavoritesStorageService.restorePlatformData` 中调用 `getBilibiliPagesAndCids` 时将入参修正为 `base.bilibili?.aid || null, base.bilibili?.bvid || null`，避免 `aid !== null` 条件误中后触发 `undefined.toString()` 崩溃。
- **Finding 3 (Card infoArea 遮挡右上角星标)**: 驳回（假阳性）。`MediaCard.tsx` 中 `infoArea` 位于底部绝对定位（`bottom-6`），右上角收藏星标位于 `top-2 right-2`，互不重叠。
- **Finding 4 (FavoritesStorageService.init 并发打开竞争)**: 已修复。在 `init()` 入口将判断改为 `if (this.dbPromise) return this.dbPromise;`，避免首批多个组件同时挂载时发起重复的 `indexedDB.open` 请求；同时在 `FavoriteStarButton.componentDidMount` 异步 await 初始化完成。
- **Finding 5 (FavoriteStarButton 使用 (window as any).Utils.msg)**: 已修复。替换为项目统一的标准封装 `ShowMessage.show(...)`。
- **Finding 6 (toggleFavoritesMode 未重置 multiPage 状态)**: 已修复。切换收藏模式时同步清理 `isCurrentInMultiPage: false` 与 `oldItems: null`，防止用户在选集视图切收藏模式时卡死在子页面。
- **Finding 7 (toggleFavoritesMode 冗余触发 searchAction)**: 已修复。移除手动调用 `action()`，由 `MediaContainerSubNavBar.componentDidUpdate` 在感知 `categories` 变更时统一派发。
- **Finding 8 (FavoritesService 缓存判断屏蔽子分类切换)**: 已修复。移除原先基于 `allMediaData.length > 0 && currentPage <= maxPage` 的早停切片缓存逻辑，使 Row 4 子分类切换与筛选实时生效。
- **Finding 9 (JOOX 链接 URL 正则缺失 single/ 格式)**: 已修复。在 `extractIdFromUrl` 正则中补全 `single/` 模式匹配。
- **Finding 10 (toggleFavoritesMode 未清空搜索框输入)**: 已修复。切换模式时重置 `searchKeyword: ""` 并触发 `this.props.changeSearchKeyword?.("")`。
- **Finding 11 (不支持平台展示了无法收藏的星标)**: 已修复。在 `FavoriteStarButton.render()` 中校验 `deriveFavoriteId`，若返回 null 则组件直接 render null。
- **Finding 12 (收藏与取消收藏产生弹窗干扰)**: 已修复。完全移除 `ShowMessage.show`，实现无侵扰静默收藏操作。
- **Finding 13 (列表星标按钮过瘦突兀)**: 已修复。回退并优化为 `rounded-xl` 半透明微质感圆角块，低饱和度暖金与微灰交替，视觉协调。
- **Finding 14 (切回全网后首次搜索无响应)**: 已修复。在 `handleSearchKeywordChange` 中同步清空 `allMediaData.length = 0`，使 Service 穿透缓存发起新词检索。
- **Finding 15 (切回全网页码重置为 1/xx 且多次切换触发重搜索)**: 已修复。参考并复用 `oldItems` 机制建立 `discoveryOldItems`；在 `PlatformSelector` 中阻断模式切换触发 `switchPlatform(0)`，在 `MediaContainerSubNavBar` 中置顶拦截模式切换，彻底保护 `currentPage`、`allMediaData` 与卡片现场无损还原。
