---
epic: epic-favorites-system
date: 2026-10-12
verdict: accepted
criteria: declared
headless: false
---
# Retrospective: 跨平台媒体收藏系统 (IndexedDB & 现场快照)

## Epic Summary

* **Epic 范围**: 媒体收藏系统（`spec-favorites-system`），支持网易云（单曲/专辑/歌单）、JOOX（单曲）、Bilibili（视频）基于 IndexedDB 本地持久化与 Row 2 工具栏双态切换。
* **Diff 范围**: `728e23edbbba46bf9d9f4001c5dd96eaa7c413af..a2736f6`（6 个提交，变更 15 个文件，+1115 / -26 行）。
* **完成故事**: 
  1. Story 1: IndexedDB 基础存储层与数据访问服务（`FavoritesStorageService.ts`）
  2. Story 2: 卡片与列表行的收藏触发按钮与全局状态同步（`FavoriteStarButton.tsx`, `MediaCard.tsx`, `MediaListRow.tsx`）
  3. Story 3: Row 2 工具栏「⭐收藏模式」点亮/点暗双态开关与精确排版（`MediaSearchBar.tsx`）
  4. Story 4: 收藏模式下平台与子分类联动过滤及收藏内本地实时搜索（`FavoritesService.ts`, `MainAppContainer.tsx`）
  5. Story 5: 收藏条目的同构直接点播与多集/歌单有序选集流转（`MainAppContainer.tsx`, `OldItems` 规范复用）
* **未完成故事 (`pending_stories`)**: 无（所有故事均已完整交付与验证）。
* **证据清单**:
  * 规格契约: `_bmad-output/specs/spec-favorites-system/SPEC.md`
  * 交互与架构规范: `navigation-and-ia.md`, `storage-schema.md`, `interaction-specs.md`, `design.md`
  * 实现记录: `_bmad-output/implementation-artifacts/spec-favorites-system.md`
  * 编译构建: `npm run build`（退出码 0，产出 `dist/bundle.js` 247.67 kB）
  * 代码提交: `db6e340`, `a2736f6`（已推送至 `origin/main`）

---

## Findings

### 1. 架构与设计模式收敛 (Aggregate Views)
* **复用 `OldItems` 现场快照模式 [Source: `src/types/mainAppContainer/MainAppContainer.d.ts` & `src/page/MainAppContainer.tsx`]**:
  * **发现**: 原生代码库在多集选集时使用了 `oldItems: OldItems` 暂存媒体列表现场（`switchToMultiPage` / `switchToOutFromMultiPage`）。收藏模式此前尝试用独立的 `savedDiscoveryState`，导致无法与既有状态生命周期融合。
  * **处置**: 扩展 `OldItems` 接口包含 `PlatformIndex`, `SubNavBarIndex`, `searchKeyword`，并在收藏模式中复用该规范定义 `discoveryOldItems`，与原生选集现场恢复保持完全同构。*(Disposition: Accept as-is)*
  * **Upstream Lesson**: 在同一组件树内存在类似「离开/返回子视图」需求时，应优先复用既有设计的数据结构与恢复范式，避免重复造轮子。

### 2. 生命周期与跨组件副作用隔离 (Lens Findings)
* **`PlatformSelector` 切换副作用导致页码和缓存被重置 [Source: `src/page/components/mediaContainerBar/PlatformSelector.tsx#L26-L34`]**:
  * **发现**: 从收藏切回全网时，因 `categories.platform` 引用改变触发了 `componentDidUpdate`，自动执行 `this.handleSwitchPlatform(0)`，造成 `currentPage` 被重置为 1，`allMediaData` 被清空，引发「第二页内容但页码显示 1/29」及「再次切回全网触发网络重搜」。
  * **处置**: 在 `PlatformSelector` 中传入 `PlatformIndex` 与 `favoritesMode`，并在 `componentDidUpdate` 顶端拦截 `prevProps.favoritesMode !== this.props.favoritesMode`，禁止调用 `switchPlatform(0)`。*(Disposition: Fix now - 已在 commit `db6e340` 彻底修复)*
* **`MediaContainerSubNavBar` 关键词抢先触发检索 [Source: `src/page/components/mediaContainerBar/MediaContainerSubNavBar.tsx#L45-L68`]**:
  * **发现**: 关键词从收藏模式的空字符串切回全网搜索词时，排在最前的 `prevProps.searchKeyword !== searchKeyword` 抢先触发了 `searchAction()`。
  * **处置**: 将 `favoritesMode` 模式切换拦截置于生命周期最顶端，切回全网时仅同步高亮 Tab 索引并立即 `return`。*(Disposition: Fix now - 已在 commit `db6e340` 彻底修复)*
* **切回全网后首次搜索命中旧数据分页缓存 [Source: `src/page/MainAppContainer.tsx#L340-L360`]**:
  * **发现**: 用户搜索新词时，`NetEaseService` 判断 `currentPage <= maxPage && allMediaData.length > 0`，因未及时清空旧缓存误判为分页已拉取。
  * **处置**: 在 `handleSearchKeywordChange` 中同步清空 `this.state.allMediaData.length = 0`，迫使网络请求穿透。*(Disposition: Fix now - 已在 commit `db6e340` 彻底修复)*

### 3. 用户体验与视觉规范 (UX Findings)
* **静默收藏交互优化 [Source: `src/page/components/media-card-container/FavoriteStarButton.tsx`]**:
  * **发现**: 收藏/取消收藏原先调用 `ShowMessage.show` 产生弹窗提示，打断浏览沉浸感。
  * **处置**: 彻底移除弹窗 Toast，依赖星标高亮微动效实现 0 干扰静默收藏。*(Disposition: Fix now - 已在 commit `27c70ec` 修复)*
* **列表视图收藏按钮比例与材质 [Source: `src/page/components/media-card-container/MediaListRow.tsx`]**:
  * **发现**: 列表视图收藏按钮曾因尺寸较细显得瘦长突兀。
  * **处置**: 调整为 `rounded-xl` 半透明微质感圆角块，低饱和度暖金与半透明灰交替，符合整体视觉风格。*(Disposition: Fix now - 已在 commit `57468bf` 修复)*

---

## Behavior Verification

* **端到端流程验证**:
  1. **跨平台收藏与取消**: 在网易云、JOOX、B站各格式条目上点按星标，数据即时写入 IndexedDB 并同步内存 `Set`，刷新页面后状态依然保持；
  2. **Row 2 模式切换**: 点击 ⭐ 收藏按钮，在「全网」与「已藏」间流畅双态切换；Row 1 顶栏保持纯粹；
  3. **搜索现场无损保留**: 在全网搜索「周杰伦」翻至第 2 页（显示 `2/29`），任意多次切入「已藏」再切回「全网」，第 2 页卡片与 `2/29` 页码稳定还原，零网络冗余请求；
  4. **全网新词检索**: 切回全网后在搜索栏输入新词（如「林俊杰」），旧缓存即时清空并顺利向网络发起新请求，卡片立即更新；
  5. **收藏内即时过滤**: 在收藏模式下输入关键词，0 延迟本地模糊匹配标题与作者，并自适应更新页码。
* **构建与兼容性**:
  * `npm run build`（`tsc -b && vite build`）通过，无类型报错，单文件 `dist/bundle.js` 产物正常生成。

---

## Previous-retro Follow-through

* 本项目前期为单功能或连续开发迭代，无遗留未关闭的 Action Items。

---

## Action Items

1. **[架构/规范] 跨模式状态暂存统一参考 `oldItems` 范式**
   * **描述**: 未来新增需要暂存/恢复全网主列表状态的扩展模式（如稍后播放列表、历史记录视图等），统一复用 `OldItems` 规范与属性，并遵循「子组件阻断重置生命周期」模式。
   * **负责人**: Winston (Architect) & Amelia (Dev)
   * **状态**: Closed (已在本次收藏系统中树立为标准范式)

2. **[文档/知识库] 更新并维护 `AGENTS.md` 陷阱记录**
   * **描述**: 将「子组件 `PlatformSelector` 与 `SubNavBar` 监听分类变化时容易误触发 `switchPlatform(0)` 与重搜」的排查心得与规避方案记入 `AGENTS.md`，防后续重构引入退化。
   * **负责人**: John (PM) / Amelia (Dev)
   * **状态**: Open (可随日常维护追加至项目 context)

---

## Acceptance Verdict

* **判定结果**: **Accepted**
* **标准来源**: Declared（对应 `SPEC.md` 中的 CAP-1 至 CAP-5 及约束条件）
* **判定依据**:
  1. CAP-1 (IndexedDB 存储与持久化): `FavoritesStorageService` 实现标准 IndexedDB 存储，复合主键 `platform:type:rawId`，HTTPS 升级完备；
  2. CAP-2 (全平台卡片/列表星标触发): 网易云单曲/专辑/歌单、JOOX 单曲、B 站视频均具备自包含星标按钮，无侵扰静默切换；
  3. CAP-3 (Row 2 工具栏排布与双态开关): 严格按 `[卡片/列表] [⭐收藏模式] [🔍 搜索] [xx/xx] [上一页] [下一页]` 顺序排布，点亮/点暗模式自由流转；
  4. CAP-4 (平台子分类联动与收藏内实时过滤): 收藏模式下 Row 3/Row 4 动态切换，搜索框转为本地毫秒级过滤；
  5. CAP-5 (同构直接点播与选集流转): 收藏条目直接下发点播包，歌单/专辑/多 P 视频完整拉起有序多选选集弹窗；
  6. 现场恢复机制完善: 复用 `oldItems` 规范，多次来回切换不丢失分页和缓存，无遗留阻塞性缺陷；
  7. 所有 5 个 Story 均完成，构建通过并已推送至 `main`。

---

## Open Questions

* 暂无。所有设计、交互与现场保存边界问题均已完全解决并经用户验证确认可用。
