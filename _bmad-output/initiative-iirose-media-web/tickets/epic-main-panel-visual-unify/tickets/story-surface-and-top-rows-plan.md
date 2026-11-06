---
ticket: 1
title: 设计底座、主面板表面与顶部四行
type: feature
created: '2026-10-28'
status: done
baseline_revision: 30900a8a788dc9b4f8b17e99255af5241d0b8a5b
route: dispatch
review_loop_iteration: 0
context:
- '{project-root}/_bmad-output/initiative-iirose-media-web/archive-v6/spec-main-panel-visual-unify/SPEC.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-main-panel-visual-unify/visual-language.md'
- '{project-root}/AGENTS.md'
---
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 插件主面板的顶部四行（Row1 导航、Row2 工具栏、Row3 平台、Row4 分类）与内容区底色仍是旧审美：透出宿站木纹、整条刷平台品牌色、实心药丸按钮，与收藏随机/播放进度两个浮窗像两个产品。

**Approach:** 在共享浮窗模块里补齐主题令牌与 `imw-dark` 变体，主面板根节点按宿站主题打 `data-imw-theme`；主面板改为实色表面，顶部四行改用浮窗控件语言（描边次要按钮、天蓝主态、带放大镜的搜索框、相连分段标签），强调色天蓝、平台只靠图标区分；AGENTS.md 的各行尺寸与布局约定不变。

## Boundaries & Constraints

**Always:** 主题：`src/app.css` 注册 `@custom-variant imw-dark (&:where([data-imw-theme="dark"], [data-imw-theme="dark"] *))`；主面板每次打开时在 `.IIROSE_MEDIA_CONTAINER` 上写 `data-imw-theme`（判定与浮窗一致：宿站 `window.theme` 假值即深色）；令牌：`floating-panel` 模块新增主题变体版常量（表面、正文、描边、次要文字、悬停/按压、选中段），值与 `visual-language.md` 一致，浮窗现有常量与外观不变；表面：主面板整体（含 Row1 与内容区）为实色表面，内容区不再透出宿站背景（替换 `MainAppContainer.tsx` 的 `bg-[rgba(224,224,224,0.8)]` 与 Row1 透明底）；Row1：导航按钮改为图标按钮语言，选中项天蓝（文字或底），未选中正文色，标题区不再用 `bg-white/20`；Row2：视图切换/收藏/搜索/分页改为描边次要按钮或图标按钮，收藏开启态用天蓝（取代黄色发光），搜索关键词区呈带放大镜的描边输入样式，分页药丸改为次要按钮（尺寸约定不变）；Row3：平台选择器改为相连长方形分段标签（无 gap、首尾圆角、选中天蓝实底白字），平台图标保留；Row4：分类标签同为相连分段样式，选中天蓝；Row2-4 不再使用 `style={{ backgroundColor: color }}` 的品牌色整条底（`color` 字段保留在数据里，不再用于整条背景）；所有布局约定（Row1 44px、Row2 48px 与分页 48×44/25.6%、Row3 40px 相连无 gap、Row4 36px `px-3.5` 12px、`mr-auto` 撑开、`max-[768px]` 断点）实测不变；快反馈按压用 `duration-N!`；同属性类不并存。

**Never:** 不改任何功能、点击语义、aria、Alt+S 与双指手势、搜索/分页/收藏流程；不改内容区卡片与列表（story 2）、设置/关于页内部（story 3）；不新增依赖或 SCSS；不借用宿站 `mdi-*` 类。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 浅色主题 | 宿站浅色，打开主面板 | 表面 `#fafbfe`、正文 `#253047`、描边 black/10 | N/A |
| 深色主题 | 宿站深色，打开主面板 | 表面 `#242a34`、正文 `#f4f6fa`、描边 white/15 | N/A |
| 主题切换 | 关闭主面板、宿站切主题、再打开 | 按新主题渲染 | N/A |
| 平台切换 | 网易云 → B 站 → 无线电 | 顶部不再变色，平台标签选中段天蓝 | N/A |
| 收藏模式 | 开/关收藏 | 开启态天蓝，关闭态正文色 | N/A |
| 移动端 | 400×800 | Row1 44、Row2 48、Row3 40、Row4 36 高度不变，分页药丸宽度占比不变，无横向溢出 | N/A |

</frozen-after-approval>

## Code Map

- `src/page/components/floating-panel/floatingPanel.tsx` -- 共享令牌与控件常量（`panelTheme(dark)`、`borderTone`、`secondaryButton(dark)`、`primaryButton`、`iconButton` 等）；新增 `imw-dark` 变体版常量，供主面板使用。
- `src/app.css:274-295` -- 主面板容器样式与通配过渡；在文件中按惯例注册自定义变体（同 `hov`）。
- `src/page/MainAppControlLayer.tsx:33,96` -- 主面板显隐切换处，打开时写 `data-imw-theme`。
- `src/page/MainApp.tsx:55` -- 主面板根布局；`src/page/components/navigationBar/main/MainNavigationBar.tsx:29-130` -- Row1（`navButtonClass` 用 `bg-[#00000080]`/`bg-[#fff3]` 与白字）。
- `src/page/MainAppContainer.tsx:282-283` -- 内容区 `bg-[rgba(224,224,224,0.8)]` 与 Row2-4 外层 `style={{ backgroundColor: color }}`；`color` 定义在约 699–1030 行的平台数据里。
- `src/page/components/mediaContainerBar/MediaSearchBar.tsx:60-160` -- Row2 各按钮与搜索关键词区、分页药丸（白字、`bg-[#fff3]`/`bg-[#00000080]`、收藏黄色发光）。
- `src/page/components/mediaContainerBar/PlatformSelector.tsx:55-70` -- Row3（毛玻璃、白底选中 + 阴影）。
- `src/page/components/mediaContainerBar/MediaContainerSubNavBar.tsx:170-190` -- Row4（选中白底深字、未选 `bg-black/30`）。
- 参照：`src/page/components/shuffle-picker/PlatformTabs.tsx`（分段标签外观）、`ShufflePicker.tsx` 搜索框。

## Tasks & Acceptance

**Execution:**
- [x] `floatingPanel.tsx` + `src/app.css` -- 主题变体令牌与 `imw-dark` 变体 -- 单一来源
- [x] `MainAppControlLayer.tsx` -- 打开时写 `data-imw-theme` -- 主题跟随
- [x] `MainApp.tsx` / `MainAppContainer.tsx` -- 实色表面，去掉品牌色整条底 -- CAP-1
- [x] `MainNavigationBar.tsx`、`MediaSearchBar.tsx`、`PlatformSelector.tsx`、`MediaContainerSubNavBar.tsx` -- 浮窗控件语言 -- CAP-2
- [x] 单测 -- 主题属性写入、关键控件类名（选中天蓝、无品牌色底），既有测试全部通过 -- 回归

**Acceptance Criteria:**
- Given 真站 1280×720 与 400×800、宿站浅色与深色，when 打开主面板并切换音乐/视频/设置与各平台，then 顶部四行与表面符合 visual-language.md，Row1–4 高度与分页宽度实测符合 AGENTS.md，无横向溢出。
- Given 改动完成，when 运行 `npm test`、`npm run build`、改动文件 `prettier --check`，then 全部通过。

## Implementation Notes

- 令牌：`floatingPanel.tsx` 新增 `hostIsDark`（浮窗 openShufflePicker 改用它，判定不变）、`themeAttr`、`themedSurface`、`themedBorder`、`themedDividerBottom`、`mutedText`、`pressTone`、`themedSubtleSurface`、`themedSelectedRow`、`selectedSegment`、`idleSegment`、`segmentEdge`、`themedSecondaryButton(On)`；原有常量未改。
- 分隔线用内阴影（`themedDividerBottom`）而非 border：本插件无 preflight，且 border 会把 Row1 撑高 1px。
- `data-imw-theme` 在挂载、首次打开（与 init 合批时）与每次打开时写入；面板开着时不跟随。
- Row2–4 外层加 `gap-1 pb-1`，避免 Row3/Row4 两条分段标签贴在一起；各行自身高度不变。
- 返回钮（Row1 最左）按未选中态渲染（原先恒为选中色）。
- 桌面端 Row2 按钮高 32px（`h-8`，行高仍 36px），按钮内图标与文字间距 22px→12px，分页双钮桌面端加 6px 间距；移动端尺寸未动。
- 搜索区空关键词时显示次要色占位「搜索」（收藏模式「过滤收藏」同为次要色）。

- 审查修补（以此为准，覆盖上文冲突描述）：`hostIsDark` 移至 `src/iirose_func/HostTheme.ts`；移除未使用的 `themedSubtleSurface`/`themedSelectedRow`；分段标签改为非首个 `-ml-px` 重叠描边、选中段 `relative z-[1]` 四边天蓝（不再 `border-l-0`）；主题只在挂载、首开合并分支与关→开时读取；子页面模式第 3 行 `hidden`；≤400px 隐藏搜索占位字；第 2 行补按压态；第 3 行点击区为 40px 外层标签。
- 发布：深色主题下内容区（卡片、设置卡）在 story 2、3 前对比度不足，本 story 只本地提交，与 story 2、3 一并推送。
- 验证：`npm test` 667 通过，`npm run build` 通过，改动文件 prettier 通过。

## Spec Change Log

## Review Triage Log

| # | 来源 | 发现 | 判定 | 依据 / 去向 |
|---|------|------|------|------|
| 1 | BH/EC | 打开期间搜索词变化会重读宿站主题 | medium | `applyDisplaySideEffects` 每次显示态都调 `applyTheme`；patch：只在关→开时应用 |
| 2 | BH/EC | 深色主题下内容区卡片/设置卡文字对比度失效 | high | 根表面改实色、内容区组件仍旧样式；本 story 只本地提交不推送，与 story 2、3 一起上线 |
| 3 | BH/EC | 非首个选中段左边是灰边、右边是天蓝边 | medium | `segmentEdge` 统一 `border-l-0`；patch |
| 4 | BH/EC | 子页面模式下第 3 行空包裹参与间距，多出空带 | low | patch |
| 5 | EC | ≤400px 搜索占位字被截成省略号 | low | patch：窄屏隐藏占位字 |
| 6 | EC | 第 3 行边框使移动端点击区从 40px 缩到 38px | low | patch |
| 7 | BH | 第 2 行触屏按压反馈丢失、搜索框聚焦不变色 | medium | patch：补 active 态与 focus-visible |
| 8 | BH | `hostIsDark` 放在样式模块且读宿站全局 | low | patch：移到 iirose_func |
| 9 | BH/VG | 测试只断言浅色类名、未覆盖首开合并分支与打开期间不跟随 | medium | patch：补用例 |
| 10 | BH | 两个未使用的令牌 | low | patch：移除 |
| 11 | BH | AGENTS.md 未写主题约定 | low | 主会话已更新 |
| 12 | BH | 主题切换时颜色随通配过渡淡入 | low | 只在关闭期间宿站换主题后首开出现，驳回 |
| 13 | VG | 主面板表面与品牌色移除未被渲染测试覆盖 | medium | MainAppContainer 依赖面大；defer，真站截图已核 |
| 14 | EC | 合并分支跳过显示副作用 | low | 既有逻辑，驳回 |

## Verification

真站实测（2026-10-28，测试账号所在房间，独立 Playwright 脚本注入一次）：新旧 bundle 对比 Row1 40/44、Row2 36/48、Row3 标签 40、Row4 36（桌面 30）、移动端分页 48×44 双钮占宽 24%（400 宽视口，与基线一致），四种组合（1280×720 / 400×800 × 浅 / 深）均无横向溢出、无 `style` 品牌色底；表面与正文色实测 `#fafbfe/#253047`、`#242a34/#f4f6fa`；关闭→切宿站主题→再打开按新主题渲染。

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 构建成功
- `npx prettier --check <改动文件>` -- expected: 通过
