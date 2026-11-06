---
epic: epic-media-desk-redesign
date: 2026-10-31
verdict: accepted-with-open-items
criteria: declared
headless: false
---
# 复盘：插件主面板「点歌台 Media Desk」重新设计（spec-media-desk-redesign）

## Epic summary

- **形态**：stories 模式（无 `sprint-status.yaml`），spec 目录 `_bmad-output/specs/spec-media-desk-redesign/`。
- **契约**：`SPEC.md`（CAP-1..CAP-14，逐条 success 判据）+ `brownfield.md` + 两个 companion（`ux-media-desk/DESIGN.md`、`EXPERIENCE.md`，视觉与行为的唯一来源）。验收标准**声明式**。
- **故事**：8 篇，全部 `status: 'done'`；标题与提交一一对应：
  1. 新令牌 / 面板外壳 / 导航 / 搜索栏 / 范围行 → `00fd926`、`e71ec58`
  2. 结果区（曲目表、网格、视频卡、内页、状态）→ `6eb0fc4`、`fd2cf31`、`5d08a8c`、`aba2f98`
  3. 底部条 / 迷你条 / 展开条 → `8526e0e`、`893ada5`
  4. 手机操作条与逐层关闭 → `89e0a94`、`f7b818e`、`17ffe07`
  5. 选集面板替代 `buildSelect2` → `100edad`、`217d18f`、`39490e9`
  6. 收藏 / 电台 / 最近点播 → `f87519a`、`8465c3a`
  7. 设置与关于 → `f9d61a7`、`4549b25`、`367672f`、`dabe865`
  8. 两个浮窗换色与总验收 → `d4f886a`、`2ea97ae`、`03ecee6`、`981db68`
- **diff 范围**：`8f1b865..981db68`（story 1 基线 → story 8 末次提交），25 个提交、116 文件、+16524 / −4529。取 981db68 为终点是因为 story 8 之后的 31 个提交（`981db68..c00a528`）属改版收尾与后续 epic，见 A5。
- **未完成故事**：无。
- **证据清单**：SPEC + 2 companion + brownfield、`stories.yaml`、8 份 story 产物、`git_evidence.py`（25 提交、0 合并）、真站截图历史（`/tmp/iirose-verify/final-*`、`variant-*`）、`deferred-work.md`。**缺失**：story 5–8 的产物**没有 `baseline_commit`**（只有 1–4 有）；story 2 记录的基线 `5d08a8c` 在它自己的首批提交（`6eb0fc4`）**之后**，与实际提交序矛盾；逐条 session 日志未落盘。因此 story 级归属按提交主题推定，epic 级范围可靠。

## Findings

**先说明一处方法差异**：`bmad-review` 读的是历史 diff，本环境 HEAD 已在其后又走了 40+ 提交。逐条到 HEAD 复核后，**5 条在 HEAD 上已不存在**，另有若干仍成立；下表把两类都列出来，避免下一轮重复报告或误修。

### 仍然成立

| # | 视图 / 镜头 | 发现 | 来源 | 处置 |
|---|---|---|---|---|
| F1 | 对抗 | `OrderMenu` 是面板内唯一没有铺 `stopHostGestures` 的浮层（`ActionSheet` 已随 story 4 删除，`RoomDeck` / `EpisodePicker` / 选择条都有）。菜单打开时横向滑动会漏到容器的 `onTouchStart`，翻掉背后的页，或直接 `ShowOrHideIMC()` 关掉整个面板 | `src/page/components/media-card-container/OrderMenu.tsx:107`（`stopHostGestures` 出现 0 次）、`src/page/MainAppContainer.tsx:419` | fix now |
| F2 | 边界 | `ResultsArea` 的 `load.status === "idle"` 没有分支，落到 `items = []` → 渲染空态文案（「没有找到结果。换个关键词试试。」）而不是骨架；首次进入某模式或恢复 `mediaData: null` 的快照时会闪一帧假空态 | `src/page/components/media-card-container/ResultsArea.tsx:348-397` | fix now |
| F3 | 边界 | `FavoritesService.loadFavorites` 先 `setState({ updating: true })` 再 `await FavoritesStorageService.query`，整段没有 `try/catch`/`finally`；调用点（`searchAction`）也不接 `.catch`。一次 IndexedDB 拒绝就让 `updating` 永久为真（分页守卫此后一直早退）并留下未处理拒绝。story 6 之后这条路径**每敲一个键**都跑一次 | `src/page/MainAppContainerServices/FavoritesService.ts:96-108`、`src/page/MainAppContainer.tsx:627` | fix now |
| F4 | 模式分叉 | 默认页面有两个归一器：`PluginSettings.normalizeDefaultPage` 硬编码 `0..5` 与自己的中文标签表，`deskModes.ts` 的 `normalizeMode` 用 `DESK_MODES.length`。两套对同一索引空间，加第七个模式时就会打架；更实际的问题是**模式从旧编号（0 视频/1 音乐/2 设置/3 关于）重排为新编号后没有迁移**，老用户存的 `defaultPage: 2/3` 在新版落到「电台/收藏」而不是原来的「设置/关于」 | `src/settings/pluginSettings/PluginSettings.ts:223-226`、`src/page/components/desk/deskModes.ts:40-48` | fix now（迁移策略需人定） |
| F5 | 对抗 | `RequestHistory.recordPayload` 每条报文做一次 `localStorage.getItem → JSON.parse → filter → stringify → setItem`，且挂在 `Socket.observe` 上对**每条出站报文**执行。整张 1000 首点播 = 1000 次同步全量重写（50 条上限），与本 epic 后续的边取边发节奏叠在同一主线程 | `src/history/RequestHistory.ts:170-183`、`src/page/index.tsx:165` | fix now（节流或批量落盘） |
| F6 | 边界 | `RadioService` 用 `allMediaData.length > 0 \|\| currentPage <= maxPage` 判断「已加载」，合法返回 0 个电台时两者都不成立，于是**每次按键**都重新发请求（`filterLive` 无防抖） | `src/page/MainAppContainerServices/RadioService.ts:30` | fix now |
| F7 | 边界 | `searchIntent` 的 BV 正则未加词界（同文件的 AVID 有 `\b`），粘贴任何含 `bv` + 10 位字母数字的文本都会 `preventDefault()` 并改发视频搜索 | `src/page/components/desk/searchIntent.ts:4-5` | fix now |
| F8 | 边界 + 验证 | 粘贴带 `?p=2` 的 B 站长链会被截成裸 BV，页参数静默丢弃；`searchBar.test.ts` 恰好把这个「丢失」断言成了期望，将来修正是红 | `src/page/components/desk/searchIntent.ts:4-10`、`src/page/components/desk/searchBar.test.ts:186-190` | fix now（语义需人确认） |
| F9 | 边界 | `OrderMenu` 用 `useState(matchMedia(...))` 只读一次断点、不订阅 `change`，旋转/缩放时形态停在旧布局直到重开 | `src/page/components/media-card-container/OrderMenu.tsx:52-58` | fix now（低） |
| F10 | 对抗 | `SearchBar.panelVisible()` 靠读 DOM class `ShowIIROSE_MEDIA_CONTAINER` 判断面板是否打开，而全 epic 其余地方都走 `active` prop；面板可见性出现两个独立来源，改类名或纯 CSS 隐藏会让 `/` 快捷键静默失效 | `src/page/components/desk/SearchBar.tsx:59-63` | defer（需先定「单源」方案） |

### HEAD 上已不成立（审查基于历史 diff，逐条复核后排除）

| 审查意见 | 复核结论 |
|---|---|
| `app.css` 里 story 1 的 `--imw-accent` 兼容块承诺 story 7 后删除却仍在 | **false**：`grep --  --imw-accent src/` 只剩两处测试断言其**不存在**，变量定义已删 |
| `viewToggleMode()` 用 `shortTitle === "多源"` 判两视图 | **false**：该函数与这段比较在 HEAD 已不存在 |
| `selectEpisodes` 以 `playlist.tracks` 为准，10 首截断时面板只给 10 行 | **false**：HEAD 用 `playlist.trackIds`（`NetEasePlatform.ts:898`），与 AGENTS「完整列表以 trackIds 为准」一致 |
| `ActionSheet` / `EpisodePicker` / `OrderMenu` 三张卡 `overflow-hidden` 裁掉焦点环 | **部分 false**：`ActionSheet` 已删除（story 4 的产物后被 `5031813` 移除，SPEC CAP-7 已改写为「操作条已取消」）；其余按 F1 处理 |
| `TracklistRow` 行体是裸 `div onClick`，键盘无法进入手机操作条 | **false**：行内可点元素是 `<button>`（`RequestButton`），且 story 4 的弹层已不存在 |

### 聚合视图

- **A1 神类/体量**：`MainAppContainer.tsx` 1290 行（本 epic 期间 +902/−809），`NetEasePlatform.ts` 1187 行；测试侧 `MainAppContainer.test.ts` 1923 行、`mediaCards.test.ts` 1885 行、`tokens.ts` 447 行。容器承载模式快照、内页、选择、批量、搜索五套状态——上一个 epic 的复盘已把它列为 A1，本次只做了有限抽取（`InnerPageService` / `SelectionService`）。**处置**：defer（已排程）。
- **A2 重复**：默认页面两套归一（F4）；`DESK_MODES` 与 `PluginSettings` 各存一份模式标签。其余「同一问题两种写法」在 epic 内多已收敛（令牌、`overlayLayers`、`guardedRequest`）。
- **A3 架构增量**：令牌纪律**成立**——组件里裸写颜色/`rgba` 的处数为 **0**（`grep 'bg-\[#\|text-\[#\|border-\[#' src/page`）；浮层面板统一走 `overlayLayers`，例外只有 F1 与 F10 两处「双源/漏接」。
- **A4 规格对账**：CAP-7 的「手机操作条」实现后又取消，SPEC 已同步改写为「取代原操作条；操作条已取消，ID 沿用」——这是**改版期内的正经对账**，不需再修。CAP-13（AGENTS.md 同轮改写）已落地。
- **A5 epic 边界（过程）**：epic 正式结束（`981db68`）之后，同一批文件又被 31 个提交继续改（`981db68..c00a528`：请求守卫反馈、视图切换常驻、动效基线、底部条贴底、收藏每页条数、来源菜单……）。说明「8 个 story 全绿」不等于改版稳定，真正的验收是在随后两天的连续修补里完成的。**处置**：记为过程教训（见行动项 9）。

### 验证缺口

- **V1**：`MainApp.tsx`（竖栏点击 → `switchMode` → `applyMode`）没有自己的测试；`MainAppContainer.test.ts` 总是显式传 `mode` 且 `switchMode` 是空 mock，`deskShell.test.ts` 只断言导航回调。把 `switchMode` 改成空函数，全套测试仍绿，导航全挂。
- **V2**：`idle` 态没有测试（F2 因此可长期存在）。
- **V3**：`OrderMenu` 的触摸隔离没有测试（F1 同源）。
- **V4**：`FavoritesService` 的拒绝路径没有测试（F3 同源）。
- **V5**：`searchBar.test.ts` 把「丢 `?p=`」钉成期望（F8），属「验证方向错了」。

## Behavior verification

- 本轮**未**对该 epic 单独做端到端复验（改版距今两天、代码又被动过 40+ 提交，单独复验会复验到别的 epic 的改动）。
- 可引用的既有实测（同一构建环境、本会话内完成）：面板开合与竖栏、搜索栏、结果区曲目表与网格、专辑/歌单内页头、底部条与迷你条、选择条取代底部条、批量进度卡与停止——这些均为本 epic 的产物，在最近两轮真站验证（96 14 首歌单内页、多选按序点播、停止即停）中被实际执行且表现正确。
- **粘贴识别（F7/F8）真机验证到环境边界**（2026-10-31）：粘贴带 `?p=` 的 B 站链接被接管（`paste` 的 `defaultPrevented` 为真、输入框清空、结果区不进搜索），链路走到 `api.bilibili.com/x/web-interface/view` 被 412 拦下并弹出「获取视频信息失败」。该 412 是**环境性**的：从服务器直连同一接口同样 412，切到 HK 节点仍 412，普通视频点播也一样失败——B 站按 IP 风控机房出口。因此「直达该分 P」的实际起播需在住宅网络下复验，不是粘贴代码的问题。
- **仍未实测**：CAP-8 选集面板的万首列表与后台补名、CAP-12 两个浮窗的配色与拖动、CAP-2 的「恢复上次状态」跨刷新。

## Previous-retro follow-through

上一篇（按时间序，本 epic 之前）：`spec-playback-loop-shuffle/RETROSPECTIVE.md`（2026-10-24）。另有 `spec-main-panel-visual-unify`（10-28，3 个 story 全 done）**没有复盘**，其成果随后被本 epic 的令牌体系取代——建议并入本 epic 结算，不单开。

| 上次行动项 | 是否落地 | 证据 |
|---|---|---|
| 1. 修正 story 3 产物状态 | 是 | `stories/3-loop-seek-and-replay.md:5` = `done` |
| 2. 抽出共享时间阈值工具 | 是 | `src/playback/endWindow.ts`（14fb2d8） |
| 3. `prepareShuffleTarget` 移出组合根 | 是 | `src/playback/shuffleTargets.ts`（14fb2d8） |
| 4. UI 接线型 story 强制组合根断言 | **部分** | 本 epic 的接线测试做得更厚（`MainAppContainer.test.ts` + `deskShell.test.ts`），但 **V1** 说明「导航 → 模式」这条最外层契约仍无测试 |
| 5. 真机联调补完循环与随机 | 是（本会话补做） | 循环：自然播完后同曲从头重播；随机：确认后待命，上一首剩约 29 秒时发出下一首 |
| 6. 记录并停止复查两条已接受偏差 | 是 | 两篇复盘均已记录，本 epic 未重复提出 |

## Action items

1. **`OrderMenu` 接 `stopHostGestures`**（owner：开发）+ V3 测试。来源 F1。
2. **`FavoritesService.loadFavorites` 加 `try/finally`**（owner：开发）：失败时复原 `updating` 并给出一次提示，配 V4 测试。来源 F3。
3. **默认页面归一收敛 + 编号迁移**（owner：开发，迁移策略需维护者定）：`PluginSettings` 复用 `deskModes`，并给旧编号加一次性迁移。来源 F4。
4. **`RequestHistory.recordPayload` 节流/批量写**（owner：开发）：批量点播期间合并写入，退出后补一次。来源 F5。
5. **`RadioService` 区分「已加载一次」与「列表非空」**（owner：开发）。来源 F6。
6. **`searchIntent` 的 BV 词界与 `?p=` 保留**（owner：开发，需确认 `?p=` 是否要驱动单 P 直达）+ 修正 V5 的测试期望。来源 F7、F8。
7. **`ResultsArea` 的 `idle` 走骨架**（owner：开发）+ V2 测试。来源 F2。
8. **`MainApp` 组合根测试**（owner：开发）：点竖栏「视频」后断言页头为「视频」。来源 V1。
9. **流程：epic 结束不等于改版稳定**（owner：规格/流程）：本 epic 后又 31 个提交收尾。建议「设计/重构型 epic」在最后一篇 story 里增加一道「连续两日不再产生同类修补」的观察窗，或在复盘时把 post-epic 提交单列成 A5 这类视图。来源 A5。
10. **流程：审查结论必须对 HEAD 复核**（owner：审查）：本轮 5 条审查意见在 HEAD 已不成立（删掉的模块、不再使用的函数）。建议 `bmad-review` 的产物在汇总前先做一次「编译/存在性」过滤。来源 Findings「已不成立」表。
11. **`SearchBar.panelVisible` 改单源**（owner：开发，提议）：由 `active` prop 驱动。来源 F10。

## Acceptance verdict

**accepted-with-open-items**（criteria: declared）

- CAP-1..CAP-14 均有对应实现；CAP-7 的取消已回写 SPEC，CAP-13 的 AGENTS.md 改写与 story 1 同轮落地；令牌纪律零违规（裸颜色 0 处）。
- 未判 accepted 的原因：8 条仍在的缺陷（F1..F9 中可修部分）与 5 条验证缺口未修，且 epic 结束后的 31 个收尾提交说明交付面在验收时并未真正稳定。
- 无未完成 story。

## Follow-up（复盘当日执行，2026-10-31）

相邻 epic `spec-main-panel-visual-unify`（3 个 story 全 done、无复盘）按维护者决定**并入本篇结算**，不单开。

修复提交：`87c2b1d`（粘贴单 P）、`75eb8a8`（浮层/结果区/收藏/电台）、`6f626e8`（历史写入与默认页面迁移）、`841b8ad`（导航契约测试）。测试 1180 → 1211，`tsc -b` 与构建通过。

| 行动项 | 状态 | 落地内容 |
|---|---|---|
| F1 `OrderMenu` 手势隔离 | 已修 | 背景层与两种菜单形态都铺 `stopHostGestures`；测试断言 `touchstart/mousedown` 不冒泡到祖先 |
| F2 `idle` 假空态 | 已修 | `idle` 与 `loading` 同走骨架；补一条「`mediaData: null` 显示骨架、不显示空态」 |
| F3 收藏查询失败卡死 | 已修 | `try/catch` + 令牌校验：失败复原 `updating`、提示一次；迟到失败不动新一轮；补两条用例 |
| F4 默认页面归一与迁移 | 已修 | 新增 `src/settings/deskModeCatalog.ts` 作为唯一模式目录（设置与 `deskModes` 共用）；一次性迁移标记 `imwSettingsRev`，缺标记时 `defaultPage` **回落到音乐**并写入标记 |
| F5 历史全量重写 | 已修 | 内存为准、写盘节流 1 秒 + `pagehide`/`beforeunload` 兜底 flush；千首批量重写次数从 1000 降到每秒 1 次 |
| F6 电台重复请求 | 已修 | 新增「已加载一次」标记（按数据 promise 的 WeakSet），空列表也不再每次按键重取 |
| F7 BV 正则无词界 | 已修 | 改为 `\bbv([0-9a-z]{10})\b`，`xxabv1234567890yy` 不再劫持粘贴 |
| F8 粘贴丢 `?p=` | 已修 | 抽出 `src/platforms/bilibiliLink.ts`（聊天框与搜索栏共用），带 `?p=` 的链接**直达该分 P**（走 `guardedRequest`）；原来把丢参钉成期望的用例已改写 |
| F9 断点只读一次 | 已修 | `OrderMenu` 订阅 `matchMedia` 的 `change` 并在卸载时解绑；测试断言重订阅与解绑 |
| V1 导航契约无测试 | 已补 | 新增 `src/page/MainApp.test.ts`（5 例）：点竖栏/手机标签栏后页头真的变、`applyMode` 真跑；负向对照钉住「回调接了但状态没落地」 |
| V2/V3/V4/V5 | 已补 | 随各自修复补用例（含把「丢 `?p=`」的错误期望改正） |
| F10 `panelVisible` 读 DOM class | 未做 | 需要先定「面板可见性单源」方案，留在 Open questions |
| 流程约定 | 已写 | AGENTS.md「BMAD 流程约定」增两条：审查汇总前对 HEAD 复核；设计/重构型 epic 收尾后观察两日再判稳定 |

**行为变化提示**（上线后需知）：粘贴带分 P 的 B 站链接不再搜索而是直接点播该 P；旧版「启动默认页面」设置为 2/3 的用户升级后会被重置到音乐一次，之后自选值保持。

## Open questions

1. F4：迁移已按「统一回落到音乐」落地，若维护者后来想按旧含义映射，需要再改一次迁移分支。
2. F10：`SearchBar.panelVisible` 读 DOM class 与 `active` prop 双源，改成单源需要先定可见性的权威来源（prop / 状态容器）。
3. 行为变化需告知用户：粘贴带分 P 的链接改为直达点播；旧版默认页面设置会被重置一次。

## Post-epic 核对（2026-11-06，增补）

只做对照 HEAD（`d41652b`）的核对，不重做上面的分析，verdict 不变。范围：`841b8ad..HEAD`（上文修复收口之后）共 `198` 个 `src` 文件变动；这一段里 `mediaDesk` 相关目录（`media-card-container`、`desk`、`room-deck`）自 `981db68` 起另被 44 个提交触及。

**F1–F10 在 HEAD 上是否仍成立**

| 项 | 结论 | 证据 |
|---|---|---|
| F1 `OrderMenu` 手势隔离 | 仍修复 | `OrderMenu.tsx` 中 `stopHostGestures` 4 处 |
| F2 `idle` 假空态 | 仍修复（结构变了） | `ResultsArea.tsx:214` 改为 `load.status !== "ready"` 一律走占位，`idle` 不会落到空态；`ResultsArea` 已拆出 `ResultsPlaceholder/Rows/Tiles` |
| F3 收藏查询失败 | 仍修复 | `FavoritesService.ts:104-111` 有 `try/catch` |
| F4 默认页面 | 仍修复 | `src/settings/deskModeCatalog.ts`、`loadSettings.ts:28` 的 `imwSettingsRev` |
| F5 历史节流 | 仍修复 | `RequestHistory.ts` 的 `flush` 与 `pagehide` 监听 |
| F6 电台 | 未逐行复核 | 不在本次核对范围；有对应用例随测试套件通过 |
| F7/F8 粘贴识别 | 仍修复 | `searchIntent.ts:11` 词界正则；`src/platforms/bilibiliLink.ts` 存在 |
| F9 断点订阅 | 仍修复 | `OrderMenu.tsx:65-68` 订阅 `change` |
| **F10 `panelVisible` 双源** | **已关闭** | `c7aaab2`（11-01）把它改成 `active` prop 单源；`SearchBar.tsx:71,138` 与注释写明「别去读 DOM class」。**上文 Open questions 第 2 条作废** |
| V1 导航契约测试 | 仍在 | `src/page/MainApp.test.ts` |

**聚合视图更新**

- **A1 神类**：已解决。`MainAppContainer.tsx` 1290 → 398 行，`NetEasePlatform.ts` 1187 → 367 行（`24300c8`、`81ee86c`，epic `large-file-decomposition` 的成果），上文「defer（已排程）」已兑现。
- **A5 收尾稳定性**：epic 结束到 F1–F10 修复收口后，`media-desk` 目录仍在 11-01 有一批同类修补（44 个提交里的 11-01 部分：手机 44px 目标、内页返回钮、搜索提示、取消滑动翻页等），之后 11-02 至 11-04 的改动是拆分与性能，不再回头改这一层的行为。可判定：**约两到三日后收敛**，与 AGENTS.md「观察两日」的约定一致。

**这段时间进入面板外壳的新东西（不属本 epic，但共用同一批文件）**

窗口模式、常驻胶囊、吸附与蜂蜜拉丝（`0498428..7ff089d`，11-06）。它们改了 `MainAppControlLayer.tsx`、`app.css`，新增 `panel-window/`。这批工作当时没有对应的 epic（只有两份树外 plan，后来在 v7 迁移中丢失，也没做过独立审查）；2026-11-06 已登记为 `epic-panel-dock`（`82b7956`），审查与复盘见 `../epic-panel-dock/epic-panel-dock-retrospective.md`。

**验证**：`npm test` 91 个文件 / 1518 个用例通过（HEAD `d41652b`）。本次**没有**跑真站，也没有复验上文列出的三个「仍未实测」项。

**Open questions 更新**：第 2 条（F10）关闭；第 1、3 条不变。
