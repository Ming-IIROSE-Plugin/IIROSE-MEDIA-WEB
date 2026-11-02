---
title: 'story 1 · 新令牌、面板外壳、导航、搜索栏与范围行，同轮改写 AGENTS.md'
type: 'feature'
created: '2026-10-29'
status: 'done'
route: 'dispatch'
baseline_commit: '8f1b865374c73911378ece3aaaaea19143a3c4b1'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-media-desk-redesign/SPEC.md'
  - '{project-root}/_bmad-output/initiative-media-desk-redesign/ux-media-desk/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-media-desk-redesign/ux-media-desk/EXPERIENCE.md'
  - '{project-root}/_bmad-output/specs/spec-media-desk-redesign/brownfield.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 主面板仍是旧四行顶栏（导航、工具栏、平台、分类）叠前轮天蓝强调色：平台占整行、搜索只是宿站弹窗、导航只有四项、没有模式概念。结果是修 story 2–8 时没有统一的令牌与外壳可依附，且 AGENTS.md 仍在要求 `themed*` 与 Row 1–4。

**Approach:** 先把外观地基换掉——在 `floating-panel` 模块落地 DESIGN.md 的纸/墨/蔷薇红令牌，主面板改为「桌面竖栏 / 手机底部标签栏 + 页头 + 宽搜索栏 + 范围行」外壳，六种模式各自保留关键词、范围与页码；同轮改写 AGENTS.md。结果区外观留给 story 2。

## Boundaries & Constraints

**Always:**
- 令牌唯一来源：新模块只导出 Tailwind 类串（浅色类 + `imw-dark:` 类成对），组件不得裸写颜色、`rgba`、`themed*`、`accentVar`。
- 六模式顺序固定：音乐、视频、电台、收藏（桌面竖栏，其后设置、关于）；手机五项：音乐、视频、电台、收藏、设置。手机断点一律 `max-[768px]`，可点区 ≥44px。
- 现有行为存活：各平台搜索与分页、`Alt+S`、双指下滑、`@` 链接拦截、云同步、收藏存储、`switchToMultiPage` 钻取、宿站主题写入、单实例。
- 搜索为面板内联输入，提交仍走 `changeSearchKeyword` → `searchAction` 链路。
- 本 story 的收藏模式复用现有收藏数据（单来源「全部」），电台模式复用现有「无线电广播」平台；来源筛选、本地即时过滤、最近点播属 story 6。范围标签计数只留位置，数据由 story 2 提供，不得为此新增请求。
- 真站验证后停下等维护者确认方向（`spec_checkpoint` + `done_checkpoint`）。

**Never:**
- 不重写结果区卡片（story 2）、底部条（story 3）、操作条（story 4）、选集面板（story 5）、设置/关于页（story 7）、浮窗配色（story 8）。
- 不新增依赖、不新增 SCSS、不加载网络字体、不借用宿站 `mdi-*` 类、不用 emoji。
- 不改侧栏播放行与侧栏进度入口。
- 不改宿站弹窗与提示层（设置取值类仍用宿站弹窗）；不自绘 toast。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| 桌面打开 | 视口 >768px，`Alt+S` | 面板出现，焦点在搜索栏输入区 | 宿站遮罩存在时先移除 |
| 手机打开 | 视口 ≤768px，双指下滑 | 底部标签栏在列，搜索栏不自动聚焦 | 同上 |
| 提交搜索 | 输入「陈绮贞」+ Enter 或点「搜索」 | 走现有搜索链路，结果区更新，页码归 1 | 现有失败提示与重试不变 |
| 键位提示与 `/` | 输入为空 / 有内容；焦点不在输入框 | 提示 `/` / `Enter`；按 `/` 聚焦搜索栏且不输入字符 | 输入框内 `/` 照常输入 |
| 粘贴视频链接 | 音乐模式粘贴 BV 号或 bilibili 链接 | 切到视频模式并在该模式提交 | 无效 BV → 现有无结果文案 |
| 切换范围 | 点另一范围标签 | 页码归 1、滚到顶部、按关键词重取 | 请求失败沿用现有提示 |
| 切换模式 / 重开 | 竖栏或标签栏点另一模式；关闭后再打开 | 该模式恢复自己的关键词、范围、页码（无历史用默认） | — |
| 分页 | 点上一页/下一页 | 等宽 `01 / 28` 同步更新，结果区滚顶 | 越界不动作 |
| 房间不支持点播 | `mediaShareRoom` 为 false | 本 story 不改点播入口外观；点播链路照旧 | — |

</frozen-after-approval>

## Code Map

- `floating-panel/floatingPanel.tsx` -- 浮窗共用外观、`Svg`、拖动/手势隔离；保留，`accentVar` 删除。
- `floating-panel/accent.ts` `accent.test.ts` -- 品牌色压深；整体删除（`readableAccent` 仅被 `MainAppContainer` 使用）。
- `MainAppControlLayer.tsx` -- 根节点、`data-imw-theme`、`Alt+S`/`Esc`、`ShowHideMainApp`；删 `accentVar`，`Esc` 仍关面板（逐层关闭在 story 4）。
- `MainApp.tsx` -- 现在是导航 + 容器；改为竖栏/标签栏 + 主列（页头、搜索栏、范围行、内容区）。
- `MainAppContainer.tsx` -- `categories`（音乐=网易云+广播；视频=B站+多源；设置；关于）、`favoritesCategories`、`controller`、`favoritesMode` 布尔。删 `applyBrandAccent`/`appliedBrand`/`currentBrandColor`；收藏升一级模式、广播移入电台模式、加按模式快照。
- `navigationBar/main/MainNavigationBar.tsx` -- 旧四项导航（mdi id）；重写为 `desk/DeskNavigation.tsx`。
- `mediaContainerBar/MediaSearchBar.tsx` `PlatformSelector.tsx` `MediaContainerSubNavBar.tsx` -- 旧 Row2–4；被 `desk/SearchBar.tsx`、`desk/ScopeRow.tsx` 取代后删除。取词现经 `IIROSEUtils.sync`（宿站弹窗）。
- `src/app.css` -- 保留变体、`ShowIIROSE_MEDIA_CONTAINER`、宿站元素、通配过渡；删仅旧行组件使用的 mdi 码点（先 grep 确认）。
- `PanelFocus.ts` `ShuffleSelection.ts` `PluginSettings.ts` -- `defaultPage` 按分类下标：保持 0=音乐、1=视频，新增 2–5，非法回退 0，随机平台回退网易云。
- `media-card-container/` -- 结果区，本 story 不动（`themed*` 暂留到 story 2/7）。
- 测试：改写 `topRows.test.ts`（旧四行/强调色断言）与 `MainAppContainer.test.ts`（`--imw-brand` 断言），删 `accent.test.ts`。

## Tasks & Acceptance

**Execution:**
- [x] `floating-panel/tokens.ts`（新）-- DESIGN.md frontmatter 的颜色/字号/间距/圆角与关键 `components.*` 各导出浅深成对的 Tailwind 类常量，另导出 `deskFocusRing` 与外壳内联 SVG 图标（note/film/radio/star/starf/gear/info/search/chev/left/right/play/close/mark） -- 组件零裸值。
- [x] `floating-panel/floatingPanel.tsx` -- 删 `accentVar`，`focusRing` 换新环 -- 浮窗配色归 story 8。
- [x] `floating-panel/accent.ts` `accent.test.ts` -- 删除 -- 品牌强调色退役。
- [x] `MainAppControlLayer.tsx` -- 去掉 `accentVar` 类名 -- 逐层关闭归 story 4。
- [x] `desk/DeskNavigation.tsx`（新）-- 竖栏（品牌标、四模式、弹性空白、设置/关于、选中 sheet 底 + 细线环 + 左缘蔷薇红竖条）与手机五项标签栏（`aria-current`、44px） -- CAP-2。
- [x] `desk/PageHeader.tsx`（新）-- 眉题（桌面 `IIROSE · Media Desk` / 手机 `Media Desk`）+ 宋体模式名 + 描边关闭钮 -- CAP-2/3。
- [x] `desk/SearchBar.tsx`（新）-- 来源切换器（圆点 + 简称）+ 内联输入（蔷薇红光标、桌面自动聚焦、手机不聚焦）+ 键位提示 + 墨底搜索钮；Enter/按钮提交；粘贴 BV/链接自动识别并在音乐模式先切视频；`/` 聚焦 -- CAP-3。
- [x] `desk/ScopeRow.tsx`（新）-- 范围标签（`tablist`、方向键、选中下划线、可选计数）+ 视图切换（仅有两种视图时）+ 分页 `01 / 28`；手机标签横滚、右侧固定 -- CAP-4。
- [x] `MainApp.tsx` -- 组装外壳：竖栏 + 主列（页头、搜索栏、范围行、结果区、底部条占位）；手机单列 + 标签栏 -- CAP-1/2。
- [x] `MainAppContainer.tsx` -- 六模式化（收藏一级模式、广播入电台、按模式快照、`switchMode`、重开恢复），换用新外壳组件，删品牌强调写入 -- CAP-2/3/4。
- [x] `PanelFocus.ts` `ShuffleSelection.ts` `PluginSettings.ts` -- 分类下标扩到 2–5，0/1 语义不变 -- 防随机与焦点错乱。
- [x] `src/app.css` -- 删旧导航/工具栏独占的 mdi 码点与类 -- 死码清理。
- [x] `AGENTS.md` -- 删「主面板颜色取 `themed*`」与 Row 1–4，改写新令牌来源、竖栏/标签栏、搜索栏、范围行、底部条与「选集不再走 `buildSelect2`」，保留 44px 与 `max-[768px]` -- CAP-13，与本 story 同一提交。
- [x] 测试 -- 新增 `desk/*.test.ts`（令牌成对、六模式 `aria-current`、搜索提交/键位提示/粘贴识别、范围切换归页、模式快照），改写 `topRows.test.ts` 与 `MainAppContainer.test.ts`，删 `accent.test.ts` -- 覆盖 I/O 矩阵。
- [x] 真站验证 -- 1280×720 与 400×800 × 浅/深色：打开、切六模式、搜索、切范围、分页、关闭重开；以 `div.msgholderBox` 判定点播未回归；完成后停下等确认方向。

**Acceptance Criteria:**
- Given 桌面宽度 >768px，when 打开面板，then 显示 84px 竖栏六项 + 页头 + 搜索栏 + 范围行，焦点已在搜索栏。
- Given 手机宽度 ≤768px，when 打开面板，then 显示五项底部标签栏与迷你条占位，搜索栏未聚焦。
- Given 任一模式，when 切换模式再切回，then 该模式的关键词、范围与页码与离开时一致。
- Given 音乐模式已输入关键词，when 粘贴 bilibili 链接，then 切到视频模式并提交该链接。
- Given 输入为空，when 观察搜索栏右端，then 键位提示为 `/`；有内容时为 `Enter`。
- Given 任一界面元素，when 检查源码，then 组件不出现 `themed*`、`accentVar`、`bg-[#…]`、`rgba(` 裸值（结果区与设置组件在 story 2/7 前除外）。
- Given 仓库，when 运行 `npm test` 与 `npm run build`，then 全绿。

## Implementation Notes

**落地情况**

- `floating-panel/tokens.ts`：DESIGN.md frontmatter 颜色全部落成「浅 + `imw-dark:`」成对类串（含 `deck-*`、`cover-ring`、`focus-ring`、`rose-fill-dark`、`source-*`），另有字号/圆角/间距/`deskFocusRing`/`deskFocusRingOnRose`/`deskFocusRingOnInk` 与 `DeskIcon`（mock symbol 原路径，`currentColor`，`dangerouslySetInnerHTML` 写在 `.ts` 里所以不用 JSX）。字体栈用 Tailwind 任意值 `font-['PingFang_SC',…]`，构建产物已核对（`font-family:PingFang SC,Microsoft YaHei,sans-serif`）。
- `desk/`：`deskModes.ts`（六模式下标、标题、导航分组）、`DeskNavigation.tsx`、`PageHeader.tsx`、`SearchBar.tsx`、`ScopeRow.tsx`、`searchIntent.ts`。
- 来源切换器用**原生 `<select>` 覆盖在装饰层上**（圆点 + 简称 + chev）：键盘/读屏/系统选择器都可用，不需要自绘下拉。手机隐藏竖分隔线、键位提示与「搜索」按钮。
- 范围行：`tablist` + 方向键环形移动、选中项 2px 墨色下划线；视图切换仅音乐「单曲」范围出现；分页 `01 / 28`（`tabular-nums`，越界不动作）；手机标签区横滚 + 右侧固定（补了 24px 渐隐提示）。
- `MainAppContainer`：`mode` 从 props 受控，切模式 = 快照当前现场 → 恢复目标现场 → 首次进入跑首个范围；`snapshots` 里复制 `allMediaData`（分页缓存是原地追加的）。搜索提交统一走 `controller.runSearch`；浏览型范围（视频「推荐」）在有关键词时自动落到第一个可搜索范围（旧 SubNavBar 的自动切换语义）。粘贴/输入 BV 号或链接在 `submitSearch` 里先 `switchMode(视频)`，切过去后按链接提交。
- 模式数据：音乐 = 网易云（单曲/专辑/歌单/MV），视频 = 哔哩哔哩（推荐/视频/直播）+ 多源剧集（三个资源站作范围），电台 = 无线电广播（日本），收藏 = 单来源「全部」（全部/单曲/专辑/歌单/视频，未加来源筛选与聚合查询），设置 = 把现有四组设置的六个子分组摊平成范围标签（搜索栏隐藏，否则后三组无法到达），关于 = 关于卡。
- 删除：`accent.ts`/`accent.test.ts`、`mediaContainerBar/*`、`navigationBar/*`、`accentVar`、`applyBrandAccent`/`appliedBrand`/`currentBrandColor`、`discoveryOldItems`、`favoritesMode`/`favoritesSearchKeyword` 状态；`FavoritesService` 改用模式自己的关键词并支持 `platform: "all"`。
- 过渡：结果区 / 设置卡仍用 `floatingPanel` 的 `themed*`，它们消费 `--imw-accent*`；`accentVar` 删除后由 `src/app.css` 给这两个变量钉上 ink/ink3 的中性值（story 2/7 完成后连 `themed*` 一起删）。`floatPanel` 里只被旧四行用到的 `themedSurface`/`themedBorder`/`selectedSegment`/`idleSegment`/`segmentEdge`/`themedSecondaryButton*` 一并删除。
- `MainAppControlLayer.shouldComponentUpdate`：显示状态变化时不再拦截 render——否则 `active` 永远是 false，打开面板时无法把焦点放进搜索栏。
- `PluginSettings.defaultPage` 归一化到 0–5，`setDefaultPage` 选择框补全六个模式（图标用自包含 `imwMode*` 码点，不借宿站 `mdi-*`）。
- AGENTS.md 同轮改写：删 `themed*` 与 Row 1–4，写新令牌来源、竖栏/标签栏、搜索栏、范围行、底部条、44px 与 `max-[768px]`、集合面板取代 `buildSelect2` 的方向。

**真站验证**（1280×720 / 400×800 × 宿站浅/深，练歌房）

- 面板单实例、`data-imw-theme` 随宿站 `window.theme`；桌面打开后焦点在搜索栏（`INPUT:搜索歌名或歌手`），手机不聚焦。
- 六模式切换、范围切换（页码归 1）、分页 `01 / 28` → `02 / 31`、切模式再切回恢复「陈绮贞 / 歌单 / 02」均已实测。
- 点播未回归：搜索后点第一条的播放按钮，聊天区 `div.msgholderBox` 子节点 54 → 55，末条为「太聪明 陈绮贞 网易云音乐 • 320K」。
- 关闭后 `#mainHolder` 去掉 `hidemainHolder`（聊天区回来），再开恢复模式与关键词。
- 与 DESIGN 对照：竖栏 84px/选中 sheet 底+细线环+左缘蔷薇红条、页头宋体 30/26、搜索栏 56/50 + 42/38 来源切换器 + 墨底搜索钮、范围标签下划线、等宽分页、手机五项标签栏与 44px 点击区均一致。结果区卡片与空态仍是旧外观（story 2）。

**偏离 / 待后续 story**

- 「底部条占位」只留了 `#imw-desk-room-deck` / `#imw-desk-mini-deck` 两个 0 高度挂载点（story 3 填充），因此手机验收里「迷你条占位」在 DOM 上存在但不可见。
- 设置模式的范围标签是摊平的六个子分组（而非「平台分组 + 组内卡片」），story 7 会改成最终形态；手机设置末项「关于」同样留到 story 7。
- 视图切换只控制既有的 `searchViewMode` 设置；「音乐默认列表 / 视频默认网格」的结果区渲染属 story 2。
- 空态 / 加载 / 错误文案与骨架仍是旧实现（story 2）。音乐首屏的旧空态文案「请点击搜索图标进行搜索！」现在与实际交互（内联输入框）不符，story 2 换状态部件时一并替换。

**story 1 收尾修正（评审自查后补）**

- 视图切换：视频模式（哔哩哔哩三个范围）也显示列表/网格切换，多源剧集与收藏、音乐专辑/歌单/MV 维持不显示——旧实现只在音乐「单曲」显示，会丢掉视频既有的视图切换。
- 电台模式隐藏分页（EXPERIENCE：地区列表不分页），原先 `hasPager` 只排除了设置/关于。
- 空关键词提交不再发起检索（沿用旧搜索栏「清空后提交无动作」），`runSearch` 只在有关键词时执行当前范围动作。
- `src/app.css`：`.listViewIcon` / `.cardViewIcon` 的 `font-family: "md"` 被误删（设置页「搜索结果视图」与收藏随机面板仍在用这两个码点），已补回。
- 测试补 4 条：桌面打开聚焦搜索栏、手机不聚焦、电台不分页 + 收藏无视图切换、视频有视图切换而音乐 MV 没有（`MainAppContainer.test.ts`）。

## Spec Change Log

## Review Triage Log

## Design Notes

令牌导出「成对的完整类串」而非散装色值，例如 `surfaceSheet = "bg-[#FBFAF7] imw-dark:bg-[#1C1A18]"`：Tailwind 能扫描到字面量，组件无法拼错深色值，也天然满足「深色取同名 `-dark`」。焦点环（外圈、间隔、实底内环）单独一个常量，组件不重写。

## Verification

**Commands:**
- `npm test` -- expected: 全部通过（含新外壳测试）
- `npm run build` -- expected: `tsc -b && vite build` 无错误
- `npx prettier --check src/page/components/desk src/page/components/floating-panel/tokens.ts` -- expected: 无差异

**Manual checks (if no CLI):**
- 真站 1280×720 / 400×800 × 宿站浅/深色：竖栏与标签栏选中态、搜索栏取色、范围标签下划线、等宽分页与 DESIGN.md 一致；面板打开推走聊天区、关闭恢复。
