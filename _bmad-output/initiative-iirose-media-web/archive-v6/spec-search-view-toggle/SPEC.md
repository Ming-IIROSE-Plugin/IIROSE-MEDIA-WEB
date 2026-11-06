---
id: SPEC-search-view-toggle
companions: []
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# 搜索结果视图切换（卡片 / 列表）

## Why

**要解决的痛点**：搜索结果目前只有卡片视图——以方形封面为主的网格，浏览直观但信息密度低。当用户想在一页结果里快速按标题/作者定位某条内容时，卡片网格需要反复扫视大图，效率低。高密度列表视图让"找特定条目"的场景更快，两种视图覆盖两类浏览意图。

## Capabilities

- **CAP-1**
  - **intent:** 用户可在搜索结果页将结果在卡片视图（默认）与列表视图之间切换，切换即时作用于当前已加载的结果集。
  - **success:** 搜索出结果后点击任一切换入口，结果区立即在卡片网格与列表之间切换，无需重新搜索或整页刷新。

- **CAP-2**
  - **intent:** 用户可通过两个入口切换视图——搜索栏上的快捷切换按钮、设置页的开关——且两处显示的状态始终一致。
  - **success:** 在搜索栏切换后打开设置页，开关状态与当前视图一致；反之在设置页切换后返回搜索页，结果视图随之改变。

- **CAP-3**
  - **intent:** 插件记住用户上次的视图选择，重新打开或刷新后无需重新设置。
  - **success:** 切到列表视图后刷新页面/重新呼出插件，搜索结果仍以列表视图呈现。

## Constraints

- 默认视图为卡片；现有卡片网格的布局与行为不变（对未使用新功能的用户零感知变化）。
- 列表行不得被 `overflow:hidden` 裁切——行容器必须保持 `grid-auto-rows:max-content` 或等效的自适应高度约束（项目已记载的坑）。
- 图标自包含：新图标必须在 `src/app.css` 注册 `::before` content + `font-family:"md"`，禁止借用宿站 `mdi-*` 类（会渲染成无字形）。
- 移动端（`max-[768px]`，本仓统一断点）与桌面端的切换入口均可见且可用。
- 不新增依赖；样式一律 Tailwind 任意值类，不新增 SCSS；状态管理沿用现有 class 组件 + context/prop 传递模式。
- 持久化走现有 `imwPluginSetting` 通道：`PluginSettingsInterface`、`LocalStorageUtils.setPluginSetting()` 默认值、`PluginSettings.getPluginSetting()` 兜底三处同步加字段。

## Non-goals

- 不做第三种及以上视图模式（紧凑网格、封面墙等）。
- 视图偏好是全局单一值，不做按平台或按搜索会话的独立记忆。
- 不改动卡片视图的现有布局与交互。

## Success signal

搜索后在任一入口切换，结果即时换视图且两处入口状态同步；切到列表后刷新页面，列表视图保持；768px 以下窄屏切换按钮可用、列表行完整不裁切；`npm run build` 通过。

## Assumptions

- 列表行保留每条结果的全部动作：播放、选集/选歌（multiPage 时）、封面跳转链接。
- loading / error / 空结果的占位样式不随视图切换变化。

<!-- Open Questions 已于 2026-10-10 拍板：列表行 72px 缩略图 / 行高约 96px、移动端切换按钮固定搜索栏最左缘（空间不足只留 44px 图标），均已实现，列表不再保留。 -->
