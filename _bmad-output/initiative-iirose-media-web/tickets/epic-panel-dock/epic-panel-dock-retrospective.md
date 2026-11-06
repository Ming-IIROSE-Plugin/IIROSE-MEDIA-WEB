---
epic: epic-panel-dock
date: 2026-11-06
verdict: accepted
criteria: declared
headless: false
---
# 复盘：点歌台窗口模式与常驻胶囊（epic-panel-dock）

## Epic summary

- **形态**：事后登记的 epic（`82b7956`）。实现在 2026-11-06 一天内完成并上线，随后才建 epic 与六张票；Requirements 来自对话，不是事先的 spec。
- **票**（`tickets.py status` 全部 `done`，`pending_tickets` 为空，无 `built` 状态的票）：
  1. 12.1 窗口模式 — `0498428`、`9d8d01e`、`695db96`
  2. 12.2 最小化为输入框上方的胶囊 — `0272a62`、`ae03cff`
  3. 12.3 常驻胶囊：拖动、记住位置、全屏原地展开 — `70461e6`、`bdd78be`、`e70ae8c`
  4. 12.4 边缘吸附与收起 — `5480dbf`、`3aeeca0`、`7ff089d`
  5. 12.5 蜂蜜拉丝与手机放大 — `1c0b614`、`7e643af`、`71e9d04`、`d25b3a3`、`376d714`
  6. 12.6 审查收口与真站回归脚本 — `e2a230e`
- **diff 范围**（取自各 plan 的 `baseline_revision`，终点在 `e2a230e`；其后的 `82b7956` 只是登记本 epic 的文档，已切掉）：
  `600225b..695db96`(12.1)、`695db96..ae03cff`(12.2)、`ae03cff..bdd78be`(12.3)、`bdd78be..e70ae8c`(12.4)、`e70ae8c..551fdaf`(12.5)、`551fdaf..e2a230e`(12.6)。整体 `600225b..e2a230e` 共 20 个提交、0 个合并。
- **证据清单**：epic 文件（有 Done when）、6 份 plan、`git_evidence.py`（整体范围）、本日 `bmad-code-review` 一轮四镜头审查（`0498428^..7ff089d`）、`scripts/verify/dock.mjs`、AGENTS.md 两条约定。
- **缺失**：
  - 原 plan（`plan-main-panel-window-mode`、`plan-panel-window-minimize`）在 v7 迁移时丢失，只能从提交说明与 AGENTS.md 还原。
  - 六份 plan 是登记时事后补写的：各票首个提交的父提交作 `baseline_revision`，相邻票的范围有重叠（12.4 的 `3aeeca0` 与 12.3 的 `e70ae8c` 在时间上交错），所以**票级归属按提交主题推定，epic 级范围可靠**。
  - 提交主题没有票号，`git_evidence.py` 里每个提交的 `stories` 都是空的。
  - 没有会话日志落盘，过程类教训只能引用本会话记忆，不作为带来源的发现。
- **未完成票**：无。

## Findings

### 聚合视图

- **A1 体量增长**：`git_evidence.py` 按变更量排前几位的是 `PanelDock.tsx`(+790/−263)、`PanelDock.test.ts`(+594)、`MainAppControlLayer.test.ts`(+520)、`app.css`(+411/−150)。读 HEAD 实际行数：`PanelDock.tsx` 527、`PanelDock.test.ts` 501、`MainAppControlLayer.tsx` 365、`PanelWindowPlacement.ts` 225、`dockLiquid.ts` 176、`geometry.ts` 171、`dockPlacement.ts` 160；`app.css` 778。**`PanelDock.tsx` 是最大的单文件**，同时装着拖动手势、颈的几何绘制、落定动画、轮询跟随、挂载 / 卸载。`epic-large-file-decomposition` 的 ≤400 行目标只是那个 epic 的范围，不是全仓规则，所以这不算违规，但它是下一个会长成神类的候选。→ 处置：**已处理**（行动项 2：拆成 `dockMeasure.ts` 与 `dockNeck.ts`，`PanelDock.tsx` 527 → 约 330 行）。
- **A2 架构增量**：`madge --circular` 在 `MainAppControlLayer.tsx` 与 `panel-window/` 上筛出的循环里，没有一条经过这两处（`grep -ci` 命中 0）；`panel-window/` 只向外依赖 `storage/localStore`、`iirose_func/HostTheme`、`floating-panel`、`media-progress`，被 `MainAppControlLayer`、`index.tsx` 用（`PageHeader.tsx` 只写了一个类名字符串，不是导入）。方向单一。仓库里其它地方 madge 报的循环（如 `PluginSettings ↔ Input-Behavior-Module`）不属本 epic，未处理。
- **A3 重复 / 双源**：胶囊的尺寸有两个来源——TS 里的 `DOCK_NOMINAL_SIZE`(87×38) / `DOCK_NOMINAL_SIZE_LARGE`(110×54)（`PanelDock.tsx:61-62`）与按钮上的 Tailwind 类 `h-9 max-[768px]:h-13`（`:391`）。代码注释写了「尺寸同 `DOCK_NOMINAL_SIZE_LARGE`」，但没有任何东西强制两边一致；改一边，边界与飞行终点就悄悄错位。`dock.mjs` 只断言手机高度 ≥ 52px，覆盖不到桌面尺寸。→ 处置：**已处理**（行动项 3：`PanelDock.test.ts` 核对「按钮高度类 + 2px 边框 = 标称尺寸」，`dock.mjs` 实测桌面 38px / 展开 87px / 手机 54px）。
- **A4 规格对账**（对照 epic 的 Done when）：
  1. 三形态开合都从胶囊出发回到胶囊、面板上没有 X —— 成立：`PageHeader.tsx:39` 的关闭钮在窗口态被 `[.imw-panel-window_&]:hidden` 藏起，全屏页头是最小化，标题栏只有最小化（`PanelWindowChrome.tsx`）。
  2. 胶囊可拖动、记住位置、不能进输入框、吸附 / 收起 / 展开 / 粘连在真站实测通过 —— 成立：本次重跑 `dock.mjs` 6 项全 PASS（贴右边露出 34px、悬停 87px、跟手最大偏差 0.00px、侧栏打开层左缘 275px 且仍只露 34px、手机高度 54px）。
  3. `npm test`（1520 个用例）与 `npm run build` 通过 —— 成立：审查收口那次已跑，`e2a230e` 之后没有源码改动。
  4. 已推送并部署 —— 成立：`e2a230e` 的 CI 为 success。
  - 与 epic 的「未做」清单一致：窗口键盘移动 / 缩放没做；真机触屏与手机端侧栏已由维护者在真机上验证（见 V1）。
- **A5 产物体积（观察）**：HEAD 构建 `dist/bundle.js` 460.26 kB，gzip 137.11 kB，高于 `epic-bundle-and-startup-perf` 和 `epic-large-file-decomposition` 的 Done when 里记的 ≤450 kB / ≤134 kB gzip。体积守门已被维护者取消（票 9.3 为 `dropped`），所以不是违规，**也没有测过这个数字有多少来自本 epic**（没有对 `600225b` 单独构建），因此不归因于本 epic，只记录。
- **A6 模式分叉**：胶囊的大量逻辑用命令式 DOM 写入（`element.style.left`、`setAttribute`），不走 Preact 状态。这是有意的（拖动不重渲染），并已写进 AGENTS.md 与文件内注释；视为**接受的偏差**，以后不再重复报告。

### 带来源的发现（来自本日独立审查，已逐条对 HEAD 核实）

审查范围 `0498428^..7ff089d`，四个独立审查者；14 条被排除（8 条不成立，6 条成立但不值得修），5 条补丁已应用，1 条决策不改。详见下表与 `e2a230e`。

| # | 发现 | 来源 | 处置 |
|---|---|---|---|
| F1 | 存储写不进去时，拖完的胶囊在下一次 500ms 轮询里弹回默认位置 | `PanelDock.tsx` 保存处忽略了 `writeJson` 的返回值 | **已修**：`unsavedDock` 内存兜底，附测试（去掉修复即失败） |
| F2 | 拖拽被 `pointercancel` 结束、没有后续点击时，`justDragged` 一直为真，下一次键盘 Enter 被吞 | `PanelDock.tsx` 的 `endDrag` | **已修**：100ms 后清除，附测试（去掉修复即失败） |
| F3 | `PanelDock.test.ts` 一条断言匹配的字符串旧 CSS 里本来就没有，永远不会失败 | `PanelDock.test.ts:468` | **已修**：改为整份 CSS 不含 `translateX(100%)` |
| F4 | `PanelWindowChrome.tsx` 开头注释还写着「关闭钮」 | `PanelWindowChrome.tsx:1` | **已修** |
| F5 | 手感类需求只被 jsdom 内联样式和对 `app.css` 的正则文本断言覆盖，没有渲染面回归 | 意图对齐审查者 | **已修**：新增 `scripts/verify/dock.mjs`；本次又做了**反向验证**（见下） |
| F6 | 关闭动画飞向未收起的胶囊位置，贴边时终点偏约 25px（上边 8px） | `PanelDock.tsx` `measureDock` | **接受**（维护者决定不改：偏差小，改它要把 CSS 偏移搬进 TS 两处会漂） |
| F7 | 6 条低严重度已排除：每 500ms 轮询都 `onPlaced`、`shouldComponentUpdate` 里写 `setPanelPresence`、无障碍细节、写死的圆角、靠中文注释切 CSS 的测试、拖到一半面板被打开时位置未存 | 审查 R7–R12 | **接受**：记录在此，以后不再重复报告 |

### 验证缺口

- **V1（已补，2026-11-06）**：维护者在真实手机上逐步走完胶囊大小、点开 / 最小化、拖动跟手、吸附（左 / 右 / 上）、宿站侧栏，六项全部「没问题」；深色主题与模拟 390 宽视口的侧栏另由 `dock.mjs` 在真站覆盖。
- **V2（已确认并接受，2026-11-06）**：批量进度卡（`#imw-batch-progress-root`，右下角，z 90008）与胶囊（z 90009）在胶囊被拖到右下角时会重叠，胶囊盖在卡片上，被盖住的按钮点不到。维护者真机确认并表示「无所谓」，记为**接受的偏差**，以后不再重复报告。没有测试。
- **V3（已补）**：`dock.mjs` 的「1:1 跟手」检查没做过反向验证。**本次已做**：在注入后加一条 `[data-imw-panel-dock]{transition:left .3s,top .3s}`，该项报 **FAIL，最大偏差 150.55px**；去掉后恢复 PASS。这证明它对「过渡造成的滞后」敏感。
- **V4（接受）**：`dock.mjs` 不在 `npm test` / CI 里，需要真站和已登录的 profile，只能手动跑；AGENTS.md 已写明改胶囊或其 CSS 后要跑。

## Behavior verification

- 重跑 `node scripts/verify/dock.mjs`（真站，持久化 profile，`dist/bundle.js` 为 `e2a230e` 构建）：6 项全 PASS，数据见 A4。
- 反向验证：见 V3，`dock.mjs` 在被注入滞后后报 FAIL(150.55px)，说明脚本不是恒真。
- **没有**重新验证的：窗口模式拖动缩放、最小化动画、全屏原地展开、Alt+S / `@词` 的开合。这些在登记之前的各轮里在真站验证过，但本次没有再跑；它们由 `MainAppControlLayer.test.ts`、`PanelDock.test.ts` 的 jsdom 用例保护。

## Previous-retro follow-through

按 `status` 的 epic 顺序，上一个 epic 是 `epic-main-panel-visual-unify`（11）。它的复盘文件 `epic-main-panel-visual-unify-retrospective.md` 是一篇「复盘结算说明」，标题为「为什么 / 结论 / 本文件的作用 / 参考」，**没有 Action items 章节**，所以这次无事可跟进——是**文件存在但没有行动项**，不是文件缺失。

## Action items

以下五条在复盘当日（2026-11-06）由维护者要求执行，状态如下：

1. **（已做）** `epic-media-desk-redesign` 复盘增补里那句过时的话，改成指向本 epic。
2. **（已做）** `PanelDock.tsx` 拆成三份：量取与存档 `dockMeasure.ts`、颈的绘制与落定动画 `dockNeck.ts`、组件本体（527 → 约 330 行）；对外导出不变，全量测试 91 个文件 / 1521 个用例通过。
3. **（已做）** 胶囊尺寸两处写法的一致性由两道检查守着：`PanelDock.test.ts` 核对「按钮高度类 + 2px 边框 = 标称尺寸」（把标称高度改成 40 后该用例失败，已验证），`dock.mjs` 真站实测桌面 38px、展开 87px、手机 54px。
4. **（已做）** 验证缺口：`dock.mjs` 新增深色主题（墨色 `rgb(28, 26, 24)`）与手机尺寸下宿站侧栏打开（层左缘 275px、只露 54px）两项，真站通过；真机触屏与进度卡重叠由维护者在真实手机上走完，结果见 V1、V2。
5. **（已做）** AGENTS.md「BMAD 流程约定」补一条：新特性先建票再做。

## Decision records

按「难以回退、脱离上下文令人意外、是真实权衡的结果、仓库里尚无 `adr-*.md` 记录」的标准，提议两条（维护者 2026-11-06 确认：第 1 条不写，第 2 条写入）：

1. **胶囊位置 1:1 跟手，粘连只表现在形状上（不做阻尼 / 追赶 / 橡皮筋）**。来源：`71e9d04`、`376d714`（12.5），维护者两次明确否决橡皮筋与「慢一步」的手感；现已写进 AGENTS.md。属真实权衡（粘连感 vs 跟手），脱离上下文会被后人当成「缺个缓动」。**维护者决定不写**（已在 AGENTS.md 里记着，不另立 ADR）。
2. **面板停稳时 `transform` / `scale` / `translate` 都是 `none`，缩放只存在于开合动画期间**。来源：`app.css` 的容器规则与 12.2 的实现；原因是 `OrderMenu` 的坐标和 `fixed inset-0` 遮罩依赖「`fixed` 以视口为基准」，且 lightningcss 会把同规则里的 `transform:none` 与 `scale:none` 合并成 `transform:scale(1)`。AGENTS.md 的 Known pitfalls 已记，但没有 ADR。已写入同目录 `adr-panel-rests-without-transform.md`。

## Acceptance verdict

**accepted**（criteria: declared）

- Done when 的四条都有证据（见 A4）：三形态开合与无 X、胶囊行为真站实测、1520 个测试与构建通过、已部署。
- 所有 6 张票为 `done`，`pending_tickets` 为空，所以没有触发「未完成票 → rejected」。
- 此前挂着的开放项都已收口：真机触屏与手机侧栏由维护者验证通过（V1）；进度卡重叠确认后接受（V2）；A1 的单文件体量与 A3 的双源已处理；F6 与另 6 条低严重度发现按维护者决定接受。
- 剩下的限制不影响验收：这是事后登记的 epic，票级归属只能推定（见 Epic summary 的「缺失」）；窗口键盘移动 / 缩放不在本 epic 范围。
- 没有阻塞性的未决发现。

## Open questions

无。两条 ADR 已处理（第 1 条不写、第 2 条已写入），真机触屏与进度卡重叠已验证 / 接受。
