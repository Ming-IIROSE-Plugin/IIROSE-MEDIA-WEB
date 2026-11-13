---
epic: epic-panel-dock
date: 2026-11-13
verdict: accepted-with-open-items
criteria: declared
headless: false
---
# 复盘：点歌台窗口模式与常驻胶囊（epic-panel-dock）

本文件有两轮。**第二轮（2026-11-13）** 复盘第一轮之后新增的 12.7–12.9，以及第一轮收尾后的提交；第一轮（2026-11-06，12.1–12.6）原文保留在文末。frontmatter 的 `verdict` 以第二轮为准。

## 第二轮（2026-11-13）

### Epic summary

- **票**（`tickets.py status epic-panel-dock`：9 张全 `done`，`pending_tickets` 为空，没有停在 `built` 的票）。第二轮新增三张：
  1. 12.7 胶囊和粘连画成同一条轮廓：`5409d2b`
  2. 12.8 面板从胶囊长出来：`6232630`，随后提速 `e999f19`、`030aa7d`
  3. 12.9 点歌台入口：`eb9ce3c`，加上 grow.mjs 检查修复 `0f79322`
- **范围**（按各 plan 的 `baseline_revision`）：
  - `6a92146..376c53a`（12.7）
  - `376c53a..c65f6d3`（12.8）
  - `c65f6d3..0f79322`（12.9，终点按最后一个属于本 epic 的提交截断，之后只有改票状态的 `3ce59fa`）
- **切掉的提交**：`970c03c`（换图标）和 `2bd955b`（加载骨架对齐）落在这些范围里，但都不属于本 epic，聚合视图和审查都没算它们。12.7 的 plan 已经注明了 `970c03c`。
- **证据**：
  - epic 文件，含 R6 与更新后的 R3。
  - 三份 plan，都有冻结块、Implementation Notes 和 Review Triage Log；三张票各做过一轮独立快速审查。
  - `git_evidence.py` 三段输出、`deferred-work.md` 的三条记录、本次真站重跑（见 Behavior verification）、本次三镜头审查（见 Findings）。
- **缺失**：
  - 没有会话日志落盘，过程类教训只引用 plan 和提交，不引用对话。
  - 12.9 验收时用的真站四档脚本只在会话临时目录（`entry-phone.mjs`），没有进仓库（见 F-V2）。

### Findings

#### 聚合视图

- **B1 体量**（HEAD 行数，和第一轮比）：
  - `dockLiquid.ts` 497（第一轮 176）。12.7 把所有几何都收进了这个纯函数文件，测试 490 行和它对应。
  - `MainAppControlLayer.tsx` 473（第一轮 365）：12.8 的开合驱动接线加上 12.9 的入口判定。
  - `PanelDock.tsx` 378（第一轮拆分后约 330）。
  - `panelGrow.ts` 379，`dockPainter.ts` 280。

  `MainAppControlLayer.tsx` 是下一个该盯的，它同时管开合动画、胶囊挂卸、主题、手势和窗口摆放。没超出任何仓库规则，只记录。**处置：接受，观察。**
- **B2 架构**：`madge --circular` 筛 `panel-window/`、`MainAppControlLayer`、`Gesture`、`pluginSettings`，命中的循环全部是第一轮就记过的 `PluginSettings ↔ Input-Behavior-Module` 那一串，没有新的。`Gesture.ts` 直接读 `loadSettings` 和 `normalize`，没有引入 `PluginSettings`（12.9 plan 的 Implementation Notes 写明是有意为之）。**处置：干净。**
- **B3 收尾后的提交**（AGENTS.md「观察两日」规则）：
  - 第一轮在 `7469e98`（11-06）收尾，之后同一批文件又有三次提交：`7abd2c6` 新功能、`02a6061` 撤回、`a751944` 修复。第二天 12.7 把这一块整个重写成一条轮廓。这印证了那条规则：第一轮判「稳定」判早了。
  - 12.9 之后，从 `0f79322`（11-08）到今天，`panel-window/`、`MainAppControlLayer.tsx`、`Gesture.ts` 没有任何源码提交，五天没有再冒同类问题。**处置：记录，本轮可判稳定。**
- **B4 规格对账**（epic 的 Requirements 与 Done when）：
  - R1–R5：仍成立，`dock.mjs` 19 项、`grow.mjs` 全过（见 Behavior verification）。
  - R6：四档、立即生效、刷新后保持、旧存档按默认。真站四档 17/17；单测 `panelEntry.test.ts`、`PluginSettings.test.ts`、`SettingsService.test.ts`、`MainAppControlLayer.test.ts` 覆盖。
  - **Done when 文字已过时**：写的是「1520 个用例」「`dock.mjs` 6 项全过」，现在是 1595 个用例、`dock.mjs` 19 项，而且没有提到 `grow.mjs` 和 R6 的验证。
  - **Boundaries 也过时**：「未做：真机触屏验证…手机端宿站侧栏开合的单独验证」在第一轮 V1 已由维护者在真机上补了；Notes 里「本 epic 未做过 `bmad-review` 之外的独立审查」在 12.7–12.9 也已不成立。

  **处置：规格对账，交 Sofia（行动项 5）。**
- **B5 产物体积（观察）**：`dist/bundle.js` 469.70 kB，gzip 141.34 kB；第一轮是 460.26 / 137.11 kB。增量里混着本 epic 之外的提交，没有单独构建对比，所以不归因。体积守门已取消（9.3 `dropped`），只记录。

#### 本次审查（三镜头：adversarial / edge-case / verification-gap，重点是票与票的交界）

各条都已对 HEAD 复核过，只列核实成立或值得记录的。

| # | 发现 | 来源 | 处置 |
|---|---|---|---|
| F-V1 | **双击检查在 100ms 下已经测不到要测的东西**。两下点击隔 90ms，再加上点击本身的延迟，第二下落在 100ms 开合结束前后，盖住形状的那层可能已经清掉了。而且点到面板内容上的点击不计入（只记宿站），所以第二下落到「点播」上也会判通过。 | `scripts/verify/grow.mjs:384`（`waitForTimeout(90)`）、`:372-377`；`030aa7d` 只改了 plan 和单测，没动 grow.mjs | **建议修**（行动项 1）：用 `freezeWhen("open")` 冻在开合中途再点第二下，同时断言第二下没落到面板内容上 |
| F-V2 | **真站脚本不固定「点歌台入口」档位，也没有覆盖「只用双指下滑」的开合形状**。`grow.mjs`、`dock.mjs` 都从持久化 profile 读设置。如果 profile 里留着 `swipe`，就没有胶囊，脚本会直接崩，而不是报一项失败。无胶囊时从中心点长出、缩回，只在 jsdom 里测过（只测全屏）；窗口模式下中心点通常在窗口外，要靠 translate 挪过去，这个组合没在浏览器里跑过。12.9 用的四档脚本没进仓库。 | `grep panelEntry scripts/verify/*.mjs` 无命中；`MainAppControlLayer.test.ts:815-845`；12.9 plan Implementation Notes | **建议修**（行动项 2） |
| F-V3 | 「只用双指下滑」的**收起终点**没有断言：单测只查胶囊不存在、样式已清，没查最后一帧缩到中心点 | `MainAppControlLayer.test.ts:837-844` | **建议修**（并入行动项 2，补一条单测） |
| F-E1 | **存储写不进去时，拖完的胶囊收起一次后就忘了位置**。每次收起都会重新挂胶囊，`mountPanelDock` 先调 `releasePanelDock()`，后者会清掉内存兜底 `unsavedDock`。第一轮 F1 只修好了 500ms 轮询那条路。 | `PanelDock.tsx:344`、`:372`；`dockMeasure.ts:100`；早在 `e2a230e` 就是这样 | **建议修**（行动项 3）：清兜底只放在页面卸载（`index.tsx:291`），挂载时不清 |
| F-A4 | 桌面没有触屏时选「只用双指下滑」，就只剩 Alt+S 和聊天框 `@词` 能打开面板。改回设置要先打开面板。 | `PluginSettings.ts:350-356` 四档无条件提供；`normalize.ts:21` | **已做（票 10，2026-11-13）**：没有触屏时只给「显示胶囊」「隐藏胶囊（Alt+S / @词 打开）」两档 |
| F-V4 | 开合起点只在胶囊静止时测过：真站先悬停 500ms 再点，单测也都是静止的剪影。胶囊正在展开或落定的途中被点开时，起点有没有跟上，没人测过 | `grow.mjs:428-435`；`PanelDock.test.ts:191-221` | **推迟**：交界上没看到具体错误，只是覆盖缺口 |
| F-A1 | 面板开着时宿站换了深浅主题，收起时缩回去的形状还是旧主题（底色照抄容器），新挂的胶囊已经是新主题，交接那 20ms 颜色对不上 | `MainAppControlLayer.tsx:293-297`、`panelGrow.ts:245-248`、`PanelDock.tsx:139` | **接受**：要在面板开着时换主题才出现，只持续交接那几帧 |
| F-A3 | 中途反向时形状是连续的，但胶囊的透明度按新曲线直接取值，可能跳一下 | `panelGrow.ts:120`、`:364` | **接受**：12.8 Design Notes 已允许「内容透明度小跳」，胶囊同理 |
| F-A5 | 双指下滑只在按下时判档位，移动到阈值时执行的是「开合切换」。「只收起」档下，如果下滑途中面板被 Esc 关掉，这一下会反过来把面板打开。没有 `touchcancel`。 | `Gesture.ts:22-41`、`:50-58` | **接受**：要在一次双指下滑的过程中用别的方式关面板才会触发；切换写法在本 epic 之前就是这样 |
| F-A8 | 用键盘收起后，焦点没回到胶囊上 | `MainAppControlLayer.tsx:238-249` | **推迟**：第一轮挂胶囊时就没有移焦点，不是本轮交界引入的 |
| F-A9 | 「只用双指下滑」时，开合仍按胶囊存档里的 `edge` 定中心点：之前贴过左边，就从屏幕左缘长出来，而用户已经看不到胶囊了 | `dockMeasure.ts:123-134`、`MainAppControlLayer.tsx:201,230` | **接受**：符合 12.9 冻结块的决定「从胶囊本该在的位置的中心」 |

审查里核实后驳回的条目：
- 跨视口阈值时开合矩形不更新：100ms 内几乎碰不到。
- 拖着胶囊时按 Alt+S 丢位置：要一边按住鼠标拖、一边按快捷键。
- 每次双指按下都读一次设置：只是一次 localStorage 解析，迁移重写只在存储不可用时发生。
- 「打开时按 hovered 状态反向」：12.8 分诊第 2 条已处理。
- `liveSilhouette` 模块级变量会竞态：没找到能触发的路径。

### Behavior verification

本次（2026-11-13，HEAD `3ce59fa` 构建）在真站重跑：

- `npm test`：93 个文件、1595 个用例全过。`npm run build` 成功。
- `node scripts/verify/dock.mjs`：**19/19 PASS**，包括凹陷与方角 0.00px、跟手偏差 0.00px、侧栏、深浅主题、手机。
- `node scripts/verify/grow.mjs`：**全 PASS**。全屏、窗口、手机、贴上边、减少动态效果、交接（打开时藏掉 0.2 对比 0.5 时 16.7，收起时 0.0 对比 23.4）、双击（但见 F-V1）都过了。
  - **帧间隔**：桌面打开最长 33.3–33.4ms（只有首次打开和贴上边各出现一次），其余全部 16.7–16.8ms。`deferred-work.md` 里「桌面每帧 ≤ 34ms 没在真机上确认」那条，在本机这一次的测量里达标了。仍是无显卡的 headless，不等于真机。
- 真站手机 390×844、CDP 模拟双指（会话临时脚本 `entry-phone.mjs`）：**17/17 PASS**，四档逐一切换，不刷新就生效，刷新后保持。
- 范围外的观察：`scripts/verify/skeleton.mjs` 17/18，「手机视频网格：两行标题那排行高」有一排是 157px，骨架是 160px。这属于 `2bd955b`（加载骨架），不在本 epic，**单独报给维护者**，不计入本 epic 的判定。

### Previous-retro follow-through

上一轮是本 epic 第一轮复盘（2026-11-06）的五条行动项，逐条看 HEAD：

1. 改 `epic-media-desk-redesign` 复盘里那句过时的话：已落地，第一轮记为已做，`025afce` 前后。
2. `PanelDock.tsx` 拆分：**已落地，后来又被 12.7 取代**。`dockNeck.ts` 已删，改成 `dockPainter.ts`（`git_evidence` 12.7：`dockNeck.ts +0 −180`、`dockPainter.ts +265`）；`PanelDock.tsx` 现在 378 行。
3. 胶囊尺寸两处写法的一致性：**已落地，并且根因已消除**。12.7 把尺寸统一由 `dockMetrics` 写成内联样式，不再有 Tailwind 高度类（AGENTS.md「数据只单向流动」一条）；`dock.mjs` 仍实测 38 / 87 / 54px，本次通过。
4. `dock.mjs` 加深色主题和手机侧栏：已落地，本次两项 PASS。
5. AGENTS.md「新特性先建票再做」：已落地，并且被遵守了。12.7、12.8、12.9 都是先建票（`6a92146`、`376c53a`、`c65f6d3`）再实现。

### Action items

维护者 2026-11-13 要求「这些问题都修一下」，行动项 1–6 都已执行，结果附在每条后面。F-A4 已由票 10 处理；决策记录仍待决定（见 Open questions）。

1. **（修，grow.mjs）** 双击检查改成冻在开合中途再点第二下，并且记录落到面板内容上的点击；改完用「第二下延后到动画之后」的改坏版本确认会报 FAIL。负责人：开发（bmad-build 或直接小修）。来源：F-V1。 **已做**：用 `freezeWhen` 冻在交接中途再点；捕获阶段记下每一下点到了谁，另记点底色的点击有没有冒泡出去。要求第二下落在底色上、宿站和面板内容都没收到。真站 PASS（`["dock","veil"]`，漏出 0）；让底色不吞点击后报 FAIL。
2. **（修，真站脚本）**
   - `grow.mjs`、`dock.mjs` 在 `boot` 里固定 `panelEntry: "pillSwipe"`，结束时还原。
   - `grow.mjs` 加一轮「只用双指下滑」：全屏、窗口、手机各开合一次，断言第一帧和最后一帧是以胶囊本该在处为中心的点，全程没有胶囊。
   - 把 `entry-phone.mjs` 收进 `scripts/verify/entry.mjs`。
   - `MainAppControlLayer.test.ts` 补一条无胶囊收起终点的断言。

   负责人：开发。来源：F-V2、F-V3。 **已做**：两个脚本启动时写死默认档、结束时还原。`grow.mjs` 在全屏、手机、窗口各加一轮「只用双指下滑」，收起最后一帧和打开第一帧都正好是中心点（误差 0），全程没有胶囊；把收起终点改成胶囊形状后三轮都报 FAIL。`scripts/verify/entry.mjs` 已进仓库，17/17 通过。单测补了收起终点，同样的改坏会让它失败。
3. **（修，一行级）** 内存兜底 `unsavedDock` 只在页面卸载时清，`mountPanelDock` 不再清；补一条「存储失败 → 拖动 → 开 → 收 → 位置还在」的单测。负责人：开发。来源：F-E1。 **已做**：`mountPanelDock` 只卸旧的根、不清兜底，清兜底只在页面卸载时做。补了两条单测（重新挂上后位置还在、页面卸载时清掉），去掉修复后第一条失败。
4. **（流程教训）** 改动画或交互时长时，凡是按时间写死的真站检查都要跟着改。这次 12.8 把 450ms 改成 100ms，有两项检查悄悄失效：交接冻帧（`deferred-work.md` 已记，`0f79322` 修了）和双击（F-V1）。提议在 AGENTS.md「面板从胶囊长出来」一条补一句：「`grow.mjs` 里与时长有关的等待按 `GROW_OPEN_MS` / `GROW_CLOSE_MS` 推算或用冻帧，改时长后重跑 grow.mjs」。负责人：维护者确认后由开发改 AGENTS.md。 **已做**：写进 AGENTS.md「面板从胶囊长出来」一条，同时登记了 `entry.mjs`。
5. **（规格对账）** epic 文件的 Done when 改成现状：1595 个用例，`dock.mjs` 19 项，`grow.mjs` 全过，R6 有真站四档验证。删掉 Boundaries 里已被第一轮 V1 补上的「未做：真机触屏…」，并更新 Notes 里「未做过独立审查」那句。负责人：Sofia（`bmad-agent-po`），维护者确认。来源：B4。 **已做**（维护者同意直接改）：epic 文件的 Done when、Boundaries、References 和那句 Open question 已更新。
6. **（推迟，记 deferred-work）** F-V4（开合起点只测过静止的胶囊）、F-A8（键盘收起后焦点不回胶囊）。`deferred-work.md` 里「≤ 34ms」那条可以附上本次测量结果。负责人：开发。 **已做**：两条已记进 `deferred-work.md`，「≤ 34ms」那条附上了本次测量结果。

### Decision records

按「难以回退、脱离上下文令人意外、是真实权衡的结果、仓库里还没有 `adr-*.md`」筛：

1. **面板打开「只裁不缩」：用 clip-path 从胶囊看得见的那块长到面板矩形，内容始终原尺寸**。来源：12.8 plan 冻结块与 Design Notes、`6232630`。维护者在试玩页比较过现在、A 撑开、B 放大、C 顺边拉出、D 回弹五个版本，选了 A（epic Notes 2026-11-07）。脱离上下文的话，后人很可能「优化」成 scale 动画。现有的 `adr-panel-rests-without-transform.md` 只管停稳时的状态，不管开合方式。AGENTS.md 有这条约定，但没写为什么不用缩放。**待维护者决定是否写入**（`src/page/components/panel-window/adr-panel-grows-by-clipping.md`）。

其余决定不单独提议：
- 12.7「一条轮廓、几何单向流动」和 12.9「不提供两样都没有」：AGENTS.md 已写明原因。
- 第一轮维护者的口径是「AGENTS.md 里记着就不另立 ADR」。

### Acceptance verdict

**accepted-with-open-items**（criteria: declared）

- Done when 四条都有证据：三种形态都从胶囊开合；胶囊行为真站 19/19；`npm test` 1595 个用例和 build 通过；已部署（`0f79322` CI success）。R6 真站四档 17/17。
- 9 张票全 `done`，`pending_tickets` 为空。
- 收尾后五天，本 epic 的源码没有新的提交（B3）。
- **开放项**：行动项 1–6 已于 2026-11-13 执行完（见 Action items）；F-A4 由票 10 处理，F-V4、F-A8 记在 deferred-work。没有阻塞项。

### Open questions

1. ~~F-A4：桌面没有触屏时，「只用双指下滑」要不要藏掉，或者在选项里提示「电脑上只能用 Alt+S 打开」？~~ 已决定（2026-11-13）：没有触屏时只给显示 / 隐藏胶囊两档，见票 10。
2. ~~行动项 1–3 现在修还是推迟~~：已全部修好（见 Action items）。
3. 决策记录「只裁不缩」要不要写入？
4. epic 本身要不要交给 Sofia 关掉（`status: done`）？

---

## 第一轮（2026-11-06，12.1–12.6，原文）

### Epic summary

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

### Findings

#### 聚合视图

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

#### 带来源的发现（来自本日独立审查，已逐条对 HEAD 核实）

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

#### 验证缺口

- **V1（已补，2026-11-06）**：维护者在真实手机上逐步走完胶囊大小、点开 / 最小化、拖动跟手、吸附（左 / 右 / 上）、宿站侧栏，六项全部「没问题」；深色主题与模拟 390 宽视口的侧栏另由 `dock.mjs` 在真站覆盖。
- **V2（已确认并接受，2026-11-06）**：批量进度卡（`#imw-batch-progress-root`，右下角，z 90008）与胶囊（z 90009）在胶囊被拖到右下角时会重叠，胶囊盖在卡片上，被盖住的按钮点不到。维护者真机确认并表示「无所谓」，记为**接受的偏差**，以后不再重复报告。没有测试。
- **V3（已补）**：`dock.mjs` 的「1:1 跟手」检查没做过反向验证。**本次已做**：在注入后加一条 `[data-imw-panel-dock]{transition:left .3s,top .3s}`，该项报 **FAIL，最大偏差 150.55px**；去掉后恢复 PASS。这证明它对「过渡造成的滞后」敏感。
- **V4（接受）**：`dock.mjs` 不在 `npm test` / CI 里，需要真站和已登录的 profile，只能手动跑；AGENTS.md 已写明改胶囊或其 CSS 后要跑。

### Behavior verification

- 重跑 `node scripts/verify/dock.mjs`（真站，持久化 profile，`dist/bundle.js` 为 `e2a230e` 构建）：6 项全 PASS，数据见 A4。
- 反向验证：见 V3，`dock.mjs` 在被注入滞后后报 FAIL(150.55px)，说明脚本不是恒真。
- **没有**重新验证的：窗口模式拖动缩放、最小化动画、全屏原地展开、Alt+S / `@词` 的开合。这些在登记之前的各轮里在真站验证过，但本次没有再跑；它们由 `MainAppControlLayer.test.ts`、`PanelDock.test.ts` 的 jsdom 用例保护。

### Previous-retro follow-through

按 `status` 的 epic 顺序，上一个 epic 是 `epic-main-panel-visual-unify`（11）。它的复盘文件 `epic-main-panel-visual-unify-retrospective.md` 是一篇「复盘结算说明」，标题为「为什么 / 结论 / 本文件的作用 / 参考」，**没有 Action items 章节**，所以这次无事可跟进——是**文件存在但没有行动项**，不是文件缺失。

### Action items

以下五条在复盘当日（2026-11-06）由维护者要求执行，状态如下：

1. **（已做）** `epic-media-desk-redesign` 复盘增补里那句过时的话，改成指向本 epic。
2. **（已做）** `PanelDock.tsx` 拆成三份：量取与存档 `dockMeasure.ts`、颈的绘制与落定动画 `dockNeck.ts`、组件本体（527 → 约 330 行）；对外导出不变，全量测试 91 个文件 / 1521 个用例通过。
3. **（已做）** 胶囊尺寸两处写法的一致性由两道检查守着：`PanelDock.test.ts` 核对「按钮高度类 + 2px 边框 = 标称尺寸」（把标称高度改成 40 后该用例失败，已验证），`dock.mjs` 真站实测桌面 38px、展开 87px、手机 54px。
4. **（已做）** 验证缺口：`dock.mjs` 新增深色主题（墨色 `rgb(28, 26, 24)`）与手机尺寸下宿站侧栏打开（层左缘 275px、只露 54px）两项，真站通过；真机触屏与进度卡重叠由维护者在真实手机上走完，结果见 V1、V2。
5. **（已做）** AGENTS.md「BMAD 流程约定」补一条：新特性先建票再做。

### Decision records

按「难以回退、脱离上下文令人意外、是真实权衡的结果、仓库里尚无 `adr-*.md` 记录」的标准，提议两条（维护者 2026-11-06 确认：第 1 条不写，第 2 条写入）：

1. **胶囊位置 1:1 跟手，粘连只表现在形状上（不做阻尼 / 追赶 / 橡皮筋）**。来源：`71e9d04`、`376d714`（12.5），维护者两次明确否决橡皮筋与「慢一步」的手感；现已写进 AGENTS.md。属真实权衡（粘连感 vs 跟手），脱离上下文会被后人当成「缺个缓动」。**维护者决定不写**（已在 AGENTS.md 里记着，不另立 ADR）。
2. **面板停稳时 `transform` / `scale` / `translate` 都是 `none`，缩放只存在于开合动画期间**。来源：`app.css` 的容器规则与 12.2 的实现；原因是 `OrderMenu` 的坐标和 `fixed inset-0` 遮罩依赖「`fixed` 以视口为基准」，且 lightningcss 会把同规则里的 `transform:none` 与 `scale:none` 合并成 `transform:scale(1)`。AGENTS.md 的 Known pitfalls 已记，但没有 ADR。已写入同目录 `adr-panel-rests-without-transform.md`。

### Acceptance verdict

**accepted**（criteria: declared）

- Done when 的四条都有证据（见 A4）：三形态开合与无 X、胶囊行为真站实测、1520 个测试与构建通过、已部署。
- 所有 6 张票为 `done`，`pending_tickets` 为空，所以没有触发「未完成票 → rejected」。
- 此前挂着的开放项都已收口：真机触屏与手机侧栏由维护者验证通过（V1）；进度卡重叠确认后接受（V2）；A1 的单文件体量与 A3 的双源已处理；F6 与另 6 条低严重度发现按维护者决定接受。
- 剩下的限制不影响验收：这是事后登记的 epic，票级归属只能推定（见 Epic summary 的「缺失」）；窗口键盘移动 / 缩放不在本 epic 范围。
- 没有阻塞性的未决发现。

### Open questions

无。两条 ADR 已处理（第 1 条不写、第 2 条已写入），真机触屏与进度卡重叠已验证 / 接受。
