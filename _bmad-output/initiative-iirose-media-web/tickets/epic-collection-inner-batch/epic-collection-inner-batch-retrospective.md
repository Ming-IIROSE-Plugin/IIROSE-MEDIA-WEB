---
epic: epic-collection-inner-batch
date: 2026-10-31
verdict: accepted-with-open-items
criteria: declared
headless: false
---
# 复盘：歌单/专辑内页多选点播、分段加载与批量即停（spec-collection-inner-batch）

## Epic summary

- **形态**：stories 模式（无 `sprint-status.yaml`），spec 目录 `_bmad-output/specs/spec-collection-inner-batch/`。
- **契约**：`SPEC.md`（CAP-1 多选 / CAP-2 分段加载 / CAP-3 停止即停 / CAP-4 边取边发）+ `brownfield.md`（三处根因）。验收标准为**声明式**（`## Success signal`，SPEC.md:46-48）。
- **故事与提交**：3 篇，全部 `status: 'done'`。
  - story 1 批量即停与边取边发：`c00a528..a4c17d6`（e9621e9 实现、a4c17d6 审查修复）
  - story 2 内页分段加载：`a4c17d6..9f567d5`（db6bb2e 实现、9f567d5 审查修复）
  - story 3 内页勾选多选：`9f567d5..7f31111`（7791674 实现、4c3fa2b 审查修复；本段另含 epic 收尾提交 05ed416 / f750750 / 9af5181 / 0d236ec / 7f31111）
  - 区间终点 `7f31111` 为**推断**（最后一篇 story 未记录结束基线，取 HEAD）。
- **未完成故事**：无（`stories.yaml` 3 条全部 `done`）。
- **变更体量**：23 文件、+2496 / −233 行（`git_evidence.py --range c00a528..7f31111`，11 提交，0 合并提交）。改动集中在 `MainAppContainer.tsx`（+229/−53）、`NetEasePlatform.ts`（+137/−132）、以及三个新文件 `CollectionSegments.ts` / `SelectBox.tsx` / `SelectionBar.tsx`。测试新增 1296 行（`NetEasePlatform.test.ts` 396、`MainAppContainer.test.ts` 761、`mediaCards.test.ts` 236），测试总量 1094 → 1161。
- **证据清单**：SPEC + companion、`stories.yaml`、3 份 story 产物（含 I/O 矩阵与审查留痕）、`git_evidence.py` 分段统计、`deferred-work.md`（本 epic 追加 7 条）、真站端到端验证（本轮，桌面 1400×900 与手机 400/470px）。**缺失**：逐条 session 日志未落盘，过程教训只能从提交串与审查记录反推；CAP-1 的「点播所选」在真机房间未实际发送（房间只做了勾选与选择条验证）。

## Findings

分组按聚合视图与审查镜头；每条给来源与处置。**处置**：fix now＝本 epic 引入、需要修；defer＝已记入 `deferred-work.md` 或有前置依赖；accept＝接受为偏差（记录以免后续重复标记）。

### 聚合视图

| # | 视图 | 发现 | 来源 | 处置 |
|---|------|------|------|------|
| A1 | 神类增长 | 组合根 `MainAppContainer.tsx` 从约 1104 行增至 1287 行，本 epic 又给它加了内页分段加载器（含每模式票号）、内页选择态、选择条与底部条的互斥渲染、`playSelection` 四条职责；它现在同时持有「模式快照 / 内页加载 / 选择 / 批量 / 搜索」五套状态机 | `src/page/MainAppContainer.tsx`（1287 行）；提交 db6bb2e、7791674 | fix now（抽 service，不阻塞） |
| A2 | 重复实现 | 「每 100 首一段」这一常量存在四处独立定义：`NeteaseMusic/index.ts:63` 的 `CHUNK_SIZE`、`NetEasePlatform.DETAIL_CHUNK`、`CollectionSegments.segmentSize` 默认值、`fetchSongDetailsPooled` 的 `DETAIL_CHUNK` 引用。改段大小时只有一处会生效 | `src/Api/NeteaseAPI/NeteaseMusic/index.ts:63`、`src/platforms/NetEasePlatform.ts:105`、`src/platforms/CollectionSegments.ts:26` | fix now |
| A3 | 架构增量 | 依赖方向未被破坏：`CollectionSegments` 落在 platform 层、由平台与容器单向引用，无环；两个新 UI 组件只依赖 `tokens.ts` 与 `DeskIcon`，令牌纪律测试（`mediaCards.test.ts` 的源码扫描表）已把新文件纳入 | `src/platforms/CollectionSegments.ts`、`SelectBox.tsx`、`SelectionBar.tsx` | accept |
| A4 | 规格对账 | CAP-1..CAP-4 与 `## Success signal` 均有对应实现与真站证据（见 Behavior verification）。规格未写、实现新增的只有一条：批量被截断时补发群消息校正（9af5181），已在 `deferred-work.md` 与 AGENTS.md 记录 | SPEC.md:16-29、`Announce/index.ts:110-119` | accept（记为本 epic 的合理增量） |
| A5 | 模式分叉 | 三处「单首 vs 多首」的分派现在统一走 `NetEasePlatform.playSongIds`（选集面板与内页多选共用），但 `playCollectionAll` 仍是另一条入口，两者的并发去重与标题来源不一致（见 B1/B2） | `NetEasePlatform.ts:246-273` vs `:854-870` | fix now（并入 B1） |

### 对抗镜头

- **B1【high】校正消息会误报「已停止」**：`sendSongs` 返回的是**成功发出的报文数**（`NeteasePlatform.ts:1136`、`:1149`），无版权跳过与单项失败都不会计入；`runBatchAnnounce` 只按 `typeof sent === "number" && sent < count` 判定截断（`Announce/index.ts:115`）。于是一个跑到底、只掉了几首歌的千首批量，会在房间里收到「🎵《X》已停止，实际提交 998 / 1000 项」——并没有人停止过。这正是最常发生的结局。来源：`src/iirose_func/Socket/Announce/index.ts:115`、`src/platforms/NetEasePlatform.ts:1136`。
- **B2【medium】`playSongIds` 没有并发守卫**：兄弟入口 `playCollectionAll` 在 `NeteasePlatform.ts:854` 用 `isBatchActive(title)` 去重，`playSongIds`（:246）没有。守卫在第一条报文即解锁（`RequestGuard.ts`），选择清空后重新勾选再点「点播所选」就能开出第二批，两批的 `&1` 报文交错、两张进度卡、停止只能停其一。来源：`NetEasePlatform.ts:246-273` 与 `:854`。
- **B3【low】批量身份用标题字符串**：`playCollectionAll` 用接口详情名（`NeteasePlatform.ts:867`），`playSongIds` 用搜索行标题（`:250`）。即便补上 B2 的守卫，同一张歌单的两轮也拦不住。来源同上。
- **B4【high】`filterLive` 在内页时打乱页码与选择**：收藏/电台的「输入即过滤」只改 `searchKeyword` 与 `currentPage: 1`（`MainAppContainer.tsx:814-819`），不清 `innerCollection` / `collectionSegments` / `innerSelection`；`FavoritesService` 又因 `isCurrentInMultiPage` 早退（`FavoritesService.ts:85`），于是表头变成「01 / N」压着第 N 页的行，选择序号全部错位——点某个可见行的勾选框会删掉另一页同槽位那首歌的选择。来源：`MainAppContainer.tsx:814`、`FavoritesService.ts:85`。
- **B5【medium】`switchToOutFromMultiPage` 的早退跳过了清理**：`if (!oldItems) return;`（`MainAppContainer.tsx:1006`）在 `oldItems` 未落地的那一帧直接返回，`dropSegments()`、`innerSelection: []` 都不会执行；返回/Esc 变成空操作且段请求继续跑。来源：`MainAppContainer.tsx:1006-1010`。
- **B6【medium】`duration` 仍是裸字段**：`songPlatformData` 用 `Math.ceil(item.duration / 1000)`（`NetEasePlatform.ts:750`）、发送侧用 `item.duration / 1000`（`:1122`）；残缺详情被「容忍」后得到 `NaN`，`JSON.stringify` 变 `null`，宿站进度条拿不到时长。提交 f750750 宣称的「一律可选读」并未覆盖这一字段。来源：`NetEasePlatform.ts:750`、`:1122`。
- **B7【low】勾选框没拦触摸起手**：`SelectBox` 只在 `click` 上 `stopPropagation`（`SelectBox.tsx:43`），而翻页手势挂在容器的 `onTouchStart` / `onMouseDown`（`MainAppContainer.tsx:419-431`，底部条的同类控件用 `stopHostGestures` 正是为此）。从勾选框起手横向滑动仍会翻页。来源：`SelectBox.tsx:28-46`、`MainAppContainer.tsx:419`。

### 边界镜头

- **C1【low】卸载只中止当前模式的加载器**：`componentWillUnmount` 只 `dropSegments()` 当前 `activeSegments`（`MainAppContainer.tsx:175-178`），切模式留在快照里的 loader 永不被 abort，面板关闭后其段请求继续跑、继续持有最多万条缓存。
- **C2【low】空数组被当成成功缓存**：`CollectionSegments.ensure` 只在 `!songs` 时判失败（`CollectionSegments.ts:82-86`），接口回 `[]` 会被永久缓存，该段再也无法重试。
- **C3【low】越界页与整页缺失渲染成空态**：`loadPage` 在 `start >= end` 时返回 `[]`（`CollectionSegments.ts:43`），整页 id 全部缺详情时也返回 `[]`；结果区按空列表显示「这张列表没有曲目。」（`ResultsArea.tsx:246`）而非可重试的失败态。
- **C4【low】选择槽位与 `pageSizeFor` 耦合**：选择按 `pageOffset + index` 记，`pageOffset` 取自 `pageSizeFor(mode)`；收藏模式下内页/外层每页条数不同（10 vs 用户设置），从内页返回那一帧若还有残存选择，徽章会落到别的行。来源：`MainAppContainer.tsx:290-296`、`:497`。

### 已接受的偏差（记录以免后续重复标记）

- **D1**：选择条**原位取代** `RoomDeck`，勾选期间看不到房间播放进度与传输控制。这是用户在 story 3 规划时明确拍板的交互（SPEC.md:56「选择条占用底部条/迷你条位置而非叠加」），不是缺陷。
- **D2**：点「点播所选」后，**第一条报文发出即清空选择**（`MainAppContainer.tsx:347-363`）。中途停止后剩下未发的曲目不会留在选择里——这与 SPEC「点播后…即恢复底部条」一致；作为已知取舍记录。
- **D3**：多选只按点选顺序、不提供乱序；只能选已取回详情的曲目（SPEC.md:52-53）。

### 验证缺口（测试无法失败的地方）

- **V1**：`playSongIds` 无「同名批量进行中」用例；`isBatchActive` 的唯一断言在 `playCollectionAll` 的用例里。
- **V2**：校正消息的两端各测一半——`Announce.test.ts:336-357` 手工喂 `sent` 数字，`NetEasePlatform.test.ts` 的「返回实际发出数」只断言返回值，**从不经过 `runBatchAnnounce`**；因此 B1 的错误文案被现有断言钉成了期望值。
- **V3**：`filterLive` 在内页的行为无用例（`MainAppContainer.test.ts:1276-1294` 枚举的五条清理路径正好不含它）。
- **V4**：卸载中止只覆盖「当前模式」的 loader。
- **V5**：段内缺 id 的过滤（`CollectionSegments.test.ts`）与容器侧的位置/序号（`MainAppContainer.test.ts` 的 `fillSegment` 原样回填）从未在同一用例里相遇。
- **V6**：`BatchProgress.remove()` 只 `controllers.delete(id)` 不 abort（`BatchProgress.ts:74-79`）；当前 UI 在运行态不提供「×」，该路径不可达，但没有测试守住这条不变式。

## Behavior verification

真站（iirose.com，房间 Harborage，注入 `dist/bundle.js`，桌面 1400×900 / 手机 400 与 470px）实测：

- **CAP-2 分段加载**：9614 首的歌单进内页只发 2 个请求（歌单详情 + 前 100 首），约 3.7 秒出首屏，分页 `01 / 962`；第 2→9 页翻页 0 个新请求；停在第 10 页时预取下一段 1 次，翻到第 11 页不再请求。与 `## Success signal` 完全一致。
- **CAP-3 停止即停**：99 首歌单整张正序点播，停止前 14 个请求；点「停止」后 14 秒内 0 个新请求，飞行中的那个被 abort（`net::ERR_ABORTED`），房间不再收到新歌，进度卡收起。
- **CAP-1 多选**：桌面跨页勾选 3 首，徽章 1/2/3 正确、选择条取代底部条（`#imw-desk-room-deck` 消失）；手机 400px 下勾选框可点区 44px、标题全部单行省略、选择条取代迷你条。**未做**：真机实际点「点播所选」把多首发进房间（只在单元测试里覆盖）。
- **CAP-4 边取边发**：由 CAP-3 的实测间接印证（停止前已发出前几首，说明首段到达即发送）；未单独测量「第 1 首在第 1 段返回后即发出」的时间点。
- **收尾修复**：400px 下内页头溢出 67px、「全部播放」被裁；修复后溢出降到 7px（44px 点击区外扩所致，视觉无裁切），470px 溢出 0。

## Previous-retro follow-through

上一篇：`_bmad-output/specs/spec-playback-loop-shuffle/RETROSPECTIVE.md`（2026-10-24，accepted）。

| 上次行动项 | 是否落地 | 证据 |
|---|---|---|
| 1. 修正 story 3 产物状态为 `done` | 是 | `stories/3-loop-seek-and-replay.md:5` 现为 `status: 'done'` |
| 2. 抽出共享时间阈值工具 | 是 | `src/playback/endWindow.ts`（14fb2d8） |
| 3. 把 `prepareShuffleTarget` 移出组合根 | 是 | `src/playback/shuffleTargets.ts`（14fb2d8） |
| 4. 流程门：UI 接线型 story 必须在规格里点名信号源并强制一条组合根断言 | **部分** | 本 epic 三篇 story 的 Code Map 都点名了文件与符号，选择条替换底部条也有组合根断言；但 B4/V3 与 C1/V4 说明「清理时机」「卸载中止」这类组合根职责仍未进门 |
| 5. 真机联调补完循环与随机 | 无证据 | 本 epic 的真站验证只覆盖内页与批量，未复验循环/随机 |
| 6. 记录两条已接受偏差 | 是 | 该文档 Findings 已记录，本 epic 未重复标记 |

## Action items

按优先级；标「提议」的是需要人决定是否执行的整改或规格对账。

1. **校正消息改由停止原因驱动**（owner：开发）：让 `sendSongs` 回传 `completed | stopped | failed`（或让 `Announce` 收 `batch` 句柄），校正只在确属停止/失败时发。来源：B1。**已修：`9ac89be`**（改由 `BatchSendOutcome.reason` 驱动）。
2. **`playSongIds` 加并发守卫并统一批量身份键**（owner：开发）：入口处 `isBatchActive`，身份键改 `neteaseMusic.id + isSongList/isAlbum` 而不是标题。来源：B2、B3。**已修：`9ac89be`**（`isBatchActive` + `${id}:list|album` 身份键）。
3. **`filterLive` 在内页时的处理**（owner：开发）：与 `runSearch`/`selectScope` 同构地清理内页现场，或内页时禁用输入即过滤；配 V3 的用例。来源：B4。**已修：`9ac89be`**（内页时先回外层再过滤）。
4. **`switchToOutFromMultiPage` 早退前清理**（owner：开发）：`dropSegments()` 与 `innerSelection: []` 移到早退之前。来源：B5。**已修：`9ac89be`**（清理提到早退之前）。
5. **`duration` 与其余裸字段兜底**（owner：开发）：非有限值回退 0，并补一条残缺详情能点播且时长可用的用例。来源：B6。**已修：`9ac89be`**（`millisOrZero`）。
6. **勾选框拦截触摸起手**（owner：开发）：补 `stopHostGestures` 或 `onTouchStart`/`onMouseDown` 的 `stopPropagation`。来源：B7。**已修：`9ac89be`**（`stopHostGestures`）。
7. **卸载与快照加载器**（owner：开发）：卸载时遍历 `this.snapshots` 逐个 abort；配 V4 的用例。来源：C1。**已修：`9ac89be`**（卸载遍历快照）。
8. **段加载器的空结果与越界页**（owner：开发）：`[]` 不缓存、越界页按可重试失败处理；配 V5 的用例。来源：C2、C3。**已修：`9ac89be`**（空段不缓存、越界页可重试）。
9. **收拢 100 分段常量**（owner：开发）：以 `DETAIL_CHUNK` 为唯一来源，API 层只做兜底并在注释里写明。来源：A2。**已修：`9ac89be`**（`NeteaseMusicAPI.CHUNK_SIZE` 单一来源）。
10. **组合根瘦身**（owner：开发，提议）：把内页加载与选择状态抽成 `InnerPageService` / `SelectionService`，容器只做装配。来源：A1。**已做（有限）：`9ac89be`** 抽出 `InnerPageService` / `SelectionService`，未改状态归属。
11. **流程门（过程教训）**（owner：规格撰写 / 审查）：用户可见文案类改动（群消息、提示）必须在链路末端断言——两端各测一半会让错误文案被钉成期望值（V2 即是如此）。写进 `bmad-build` 的 review 清单或本仓 AGENTS.md 的测试约定。**已完成：`cddbf45`**（AGENTS.md「提交纪律」新增该条）。
12. **补真机**（owner：开发 / 验证）：在多首点播路径上实际发一次「点播所选」，复验循环/随机（上次行动项 5 仍未做）。**已完成**：多选路径真站发出、循环/随机复验通过（见 Follow-up）；CAP-2 的逐项异常仍只能在单元测试覆盖。

## Acceptance verdict

**accepted-with-open-items**（criteria: declared）

- 三条用户诉求及其在 `## Success signal` 中的判据，全部在真站复现通过：内页首屏请求数、翻页/预取时机、停止后请求归零、跨页多选与按序发送（发送链路由单元测试覆盖）。CAP-1..CAP-4 均有实现与证据。
- 无未完成故事，取消评价不成立。
- 未达「accepted」的原因：本 epic 引入或暴露的 4 条缺陷（B1 群消息误报、B2 批量无并发守卫、B4 内页过滤打乱页码与选择、B5 早退跳过清理）尚未修复，另有 8 条低危项与 6 条验证缺口；这些不推翻已交付的目标，但都在修复清单里。

## Follow-up（复盘当日执行，2026-10-31）

复盘后按行动项逐条修复，代码提交 `9ac89be`（fix）、`cddbf45`（docs），已推送 `origin main`。测试 1161 → 1180。

| 行动项 | 状态 | 落地内容 |
|---|---|---|
| 1 校正文案 | 已修 | `runBatchAnnounce` 改收 `BatchSendOutcome { sent, reason }`；`completed` 不校正，`stopped` 报「已取消 / 已停止」，`failed` 报「因错误中断」；端到端用例接入真实 `sendSongs`（跳过 → 无「已停止」） |
| 2 并发守卫 + 身份键 | 已修 | `playSongIds` 多首路径加 `isBatchActive`；`startBatch`/`isBatchActive` 增可选 `key`，网易云两入口用 `${id}:list|album`，标题被截断也拦得住 |
| 3 `filterLive` | 已修 | 内页开着时先回外层（恢复现场、中止段请求、清勾选）再过滤；补用例 |
| 4 早退清理 | 已修 | `switchToOutFromMultiPage` 的清理提到 `if (!oldItems) return` 之前 |
| 5 `duration` 兜底 | 已修 | `millisOrZero` 统一处理 `duration` / `fee` / 选集 enrich / `entriesOf`；缺字段得 0 |
| 6 勾选框触摸 | 已修 | `SelectBox` 铺 `stopHostGestures`；用例断言 `touchstart/mousedown` 不冒泡 |
| 7 卸载中止 | 已修 | 卸载遍历 `snapshots` 逐模式 abort；补用例 |
| 8 空段与越界页 | 已修 | `[]` 不再当成功缓存；越界页与整页全缺改为可重试失败 |
| 9 分段常量 | 已修 | `NeteaseMusicAPI.CHUNK_SIZE` 为唯一来源，`DETAIL_CHUNK` 引用它 |
| 10 组合根瘦身 | 已做（有限） | 抽出 `InnerPageService`（90 行，内页加载编排）与 `SelectionService`（87 行，选择纯函数）；容器 1295 → 1290 行，迁出约 63 行逻辑。**未**改状态归属与 UI |
| 11 流程门 | 已做 | AGENTS.md「提交纪律」增「用户可见文案必须端到端断言」，引本篇 B1/V2 为据 |
| 12 真机补验 | 已做 | 见下（含上次遗留的循环 / 随机复验） |

**修复后的真站复验**（同一房间，桌面 1400×900）：99 首歌单内页 1.97 秒出首屏、分页 `01 / 10`；勾第 3、第 1 行 → 徽章 1/2，点「点播所选」后房间按**点选顺序**收到「红色高跟鞋」→「我怀念的」，选择条消失（story 3 此前未真发的路径首次验证通过）；随后整张正序点播、点「停止」后 12 秒内 0 个新请求。

**上次复盘遗留项 5（循环 / 随机真机复验）本轮补做**：

- **单曲循环**：点播一首后开启循环（`aria-pressed=true`），用进度浮窗「快进1分钟」推到剩余 8 秒，随后让最后几秒自然播完 —— 倒计时回跳到 4:19、同一首歌从头重播，房间未换曲。**循环可用**。
- **收藏随机**：点击后先开选择面板（这是既定交互，不是拒绝），面板「开始随机」确认后 `aria-pressed=true`，进入待命；实测在上一首剩余约 29 秒时发出下一首（`m__4@0>太聪明>陈绮贞…`），房间随之换曲。**随机可用**，且与代码注释「剩余 5 秒发出，避免宿站不切歌」一致。
- 结论：上轮记录的「循环/随机可用性口径差异」维持为**已接受**，无需再复查。

因处置已落地，重跑本篇复盘时 A1/B1/B2/B4/B5/… 等条目会转为「已修」；`verdict` 保持 `accepted-with-open-items`，因为该判定记录的是复盘当时的状态。仍未决的只剩 Open questions 的 2、3、4（口径与拆法选择）。

## Open questions

1. B1 的修正口径：房间消息是「只在真正被停止/失败时校正」，还是「跑完也如实报告实际提交数」？前者更少打扰，后者信息更完整。
2. B4 的修正方向：内页时把输入即过滤改成整页搜索（清内页），还是内页时禁用过滤、只允许搜索框提交？
3. A1 的拆法：`InnerPageService` 与选择状态分开两个 service，还是一个 `InnerPageController` 同时持有加载器与选择？（影响后续 story 的接缝）
4. 400px 极窄屏下歌单名被挤成 0 宽：是否接受，或改成手机内页头两行。
