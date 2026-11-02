---
title: '内页勾选多选点播'
type: 'feature'
created: '2026-10-31'
status: 'done'
baseline_commit: '9f567d5f8050b3792cf0068f69dabc831e5fff27'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-collection-inner-batch/SPEC.md'
  - '{project-root}/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 网易云歌单/专辑「查看」内页只能逐首点播或「全部播放」，挑 2、3、10 首得逐个点（SPEC CAP-1）。

**Approach:** 内页每行与网格卡前常驻勾选框，点选即记序号（跨页保留）；选中 ≥1 首时选择条取代底部条（桌面）/ 迷你条（手机），显示「已选 N 首 · 清空 · 点播所选」，按点选顺序点播。不设上限、不提供乱序、只能选已显示的曲目。

## Boundaries & Constraints

**Always:**
- 只在网易云歌单/专辑内页（`innerCollection` 非空）出现；搜索结果、B 站多 P、收藏、电台行不变。
- 选择键 = 曲目在整张列表中的绝对位置（`pageOffset + i`），不是歌曲 id——同一首歌在歌单里出现两次时两行可分别勾选；发送用各行的 `neteaseMusic.id`，按点选顺序。
- 勾选框：未选为细线空框，选中为蔷薇红实底 + 白色序号（同选集面板徽章）；`role="checkbox"` + `aria-checked` + 含曲名与序号的 `aria-label`；点勾选框 `stopPropagation`，不触发点播、不触发网格卡的首点显示「点播」胶囊。手机可点区 ≥44px，行标题仍单行。
- 取消某首后，后面的序号前移（12345 去掉 2 → 1234）。
- 「点播所选」包 `guardedRequest`（key `${requestKey(collection)}:selected`）：1 首走 `runSingleAnnounce`，多首走 `startBatch` + `runBatchAnnounce` + `finalODSONG`（与选集面板同一路径）；结果为 `sent`/`handoff` 后清空选择，`failed`/`busy` 保留。房间不支持时按钮灰化、可点、只提示。
- 选择在离开内页、打开另一内页、搜索、换来源、换范围时清空；切模式再回来保留。
- 只拼 `tokens.ts` 令牌与 `DeskIcon`；断点 `max-[768px]`；选择条不新增浮层层级、不改 `overlayLayers`。

**Never:** 不加乱序 / 全选 / 上限；不改选集面板外观与行为（只允许把它的发送逻辑抽成共用函数）；不走 `buildSelect2`；不改「全部播放」与 `OrderMenu`；不新增依赖。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 跨页点选 | 第 1 页勾第 3、1 行，翻到第 2 页勾第 5 行 | 徽章依次 1、2、3；选择条「已选 3 首」；翻回第 1 页徽章仍在 | — |
| 按序点播 | 上述选择点「点播所选」 | 发送顺序 = 第 3 首、第 1 首、第 15 首；浮窗批量进度 3 首；完成后选择清空、选择条消失、底部条回来 | — |
| 单首 | 只选 1 首点播 | 走单曲播报，不建批量进度卡 | — |
| 取消 | 选 A B C，取消 B | A=1、C=2，「已选 2 首」；全部取消后选择条消失 | — |
| 重复曲目 | 歌单第 4、第 40 位是同一首 | 两行可分别勾选，各自有序号；发送 2 次 | — |
| 点勾选框 | 点行/卡上的勾选框 | 只切换选择，不点播、不显示网格「点播」胶囊 | — |
| 网格视图 | 切到网格勾选 | 与列表共享同一选择与序号，视图切换不丢 | — |
| 房间不支持 | `mediaShareRoom === false` | 勾选可用；「点播所选」灰化，点击提示房间不支持 | — |
| 守卫中 | 点播所选进行中再点 | 无效，按钮「点播中」转圈 | 失败走 `ShowMessage`，选择保留 |
| 离开 | 有选择时 ‹ 返回 / 搜索 / 开另一内页 | 选择清空 | — |

</frozen-after-approval>

## Code Map

- `src/platforms/NetEasePlatform.ts:232-251` `selectEpisodes` 的 `onConfirm` -- 抽成公开 `playSongIds(ids, title, description?) => Promise<void>`（单首 / 多首两路，返回发送过程的 Promise），选集面板改调它，行为不变。
- `src/page/MainAppContainer.tsx` -- state 增 `innerSelection`（`{ position, id, title }[]`，按点选顺序），放进 `ModeSnapshot`（`:76` 起、`takeSnapshot` `:529`）；`switchToMultiPage`、`switchToOutFromMultiPage`、`runSearch`、`selectSource`、`selectScope` 处清空。`:272` `playCollectionAll` 旁加 `playSelection`（`guardedRequest` + `playSongIds`）。`:423` `<RoomDeck>`：内页且有选择时换成选择条。经 `MediaContainerContext` 或 props 把选择与 toggle 交给 ResultsArea。
- `src/page/components/media-card-container/ResultsArea.tsx:249` `renderRows`、`:283` `renderTiles` -- 内页集合时给行/卡传 `selectionOrder`（1 起，未选 undefined）与 `onToggleSelect`；位置 = `pageOffset + index`。选择状态不能放在 ResultsArea（随 `mediaData` 重置）。
- `TracklistRow.tsx:38` `trackColumns` 与 `TracklistHeader` -- 可选择时用加了勾选列的列模板（桌面在序号列前、手机在封面前）；无选择能力时列模板不变。
- `MusicTile.tsx` -- 封面左上角勾选框（左下已被正在播放徽章占用）。
- 新文件 `src/page/components/media-card-container/SelectBox.tsx`（勾选框）、`SelectionBar.tsx`（选择条：桌面沿用 `#imw-desk-room-deck` 的高度与外观令牌，手机沿用迷你条 58px）。徽章样式参照 `EpisodePicker.tsx:310-333`。
- `src/page/components/media-card-container/mediaCards.test.ts:254` -- 令牌纪律表要加入新组件文件。

## Tasks & Acceptance

**Execution:**
- [x] `NetEasePlatform.ts` -- 抽 `playSongIds`，选集面板改用 -- 共用发送路径
- [x] `SelectBox.tsx`、`SelectionBar.tsx` -- 勾选框与选择条 -- 新 UI
- [x] `TracklistRow.tsx`、`MusicTile.tsx`、`ResultsArea.tsx` -- 接入勾选 -- 行/卡可选
- [x] `MainAppContainer.tsx` -- 选择状态、清空时机、快照、选择条替换底部条、`playSelection` -- 落地
- [ ] 测试 `mediaCards.test.ts`、`MainAppContainer.test.ts`、`NetEasePlatform.test.ts` -- 覆盖矩阵全部行 -- 回归保护

**Acceptance Criteria:**
- Given 内页已按 3→1→15 的顺序勾选, when 点「点播所选」, then `finalODSONG` 收到 `[id3, id1, id15]` 且只建一个批量进度卡。
- Given 搜索结果列表, when 渲染, then 不出现勾选框，列模板与现状一致。
- Given 现有测试套件, when `npm test` 与 `npm run build`, then 全部通过。

## Implementation Notes

- `NetEasePlatform.playSongIds(ids, title, description?)` 返回发送过程；选集面板 `onConfirm` 改为 `void playSongIds(...)`，行为不变。
- 选择状态 `innerSelection: InnerSelectionItem[]`（全局类型在 `MainAppContainer.d.ts`）放进 `ModeSnapshot`；`switchToMultiPage` / `switchToOutFromMultiPage` / `runSearch` / `selectSource` / `selectScope` 清空。
- 选择经 `ResultsArea` 的 `selection` prop（`orderOf` / `onToggle`）下发，只在 `innerCollection` 非空且在内页时给；位置 = `pageOffset + index`。
- 勾选列：`selectableTrackColumns`（桌面 32px 在序号前，手机 32px 在封面前）；勾选框视觉 32px、`after:-inset-[6px]` 外扩到 44px。网格卡勾选框在封面左上、压在遮罩之上。
- `playSelection` 的守卫键 `${requestKey(collection)}:selected`；`sent`/`handoff` 后只在选择未被改动时清空（切模式后则清对应快照）。按钮状态经新增的 `useRequestKeyStatus(key)` 读取。
- 选择条有选择时**替换** `RoomDeck` 渲染（RoomDeck 卸载，展开层随之收起），清空后 RoomDeck 重新挂载。

## Spec Change Log

## Review Triage Log

| # | 来源 | 位置 | 意见 | 判定 | 去向 | 依据 |
|---|------|------|------|------|------|------|
| 1 | blind / edge | MainAppContainer.tsx playSelection | `handoff` 也清空选择；playSongIds 总返回 Promise，此时 handoff = 一条没发且无提示（单首失败被 10 秒去重吞掉、全部被过滤、准备中停止） | medium | patch | RequestGuard.ts:186 promise 入口的 handoff 即「没发出」；违反「失败保留」 |
| 2 | blind / verif | MainAppContainer.tsx playSelection | 成功提示为「已点播《歌单名》」，与「全部播放」分不清 | low | patch | `finishSent` 用 data.title；改传带所选文案的 data 为直接修正（key 已显式传入） |
| 3 | blind | playSelection | 未传 description，与选集面板批量播报不一致 | low | reject | 内页 PlatformData 无 description 字段，补上需新增取数链路 |
| 4 | blind | toggleSelection | 无 id 行的勾选框点了无反应 | false | reject | 内页行全部由 songPlatformData 生成，必有 neteaseMusic.id |
| 5 | blind / edge | toggleSelection | 读 this.state 快照，同批两次切换丢一次 | low | patch | 改函数式 setState 为直接修正 |
| 6 | blind | InnerSelectionItem.title | 存了不用 | low | patch | 由 #2 用于单首提示文案，随之解决 |
| 7 | blind | selectionRequestKey | pending 期间改选择按钮也锁 | false | reject | 矩阵「守卫中再点无效」即此语义 |
| 8 | blind | RoomDeck 卸载 | 有选择时卸载底部条 | low | reject | 冻结意图「选择条取代底部条/迷你条」 |
| 9 | blind | 功能缺口 | 无 Esc 清空、全选、上限 | false | reject | 冻结 Never：不加全选 / 上限；不改 overlayLayers |
| 10 | blind | AGENTS.md | 未登记 SelectBox / SelectionBar / 八列六列 | low | defer | 修复编辑 agent-context 文件 |
| 11 | edge | NetEasePlatform.playSongIds 多首路径 | 选集面板 void 调用时 runBatchAnnounce reject 成未处理拒绝 | low | reject | 基线 selectEpisodes 同写法，预先存在且日常不触发 |
| 12 | verif | MainAppContainer.test.ts | 发送途中切模式清快照选择无测试 | medium | patch | 预验证 gap |
| 13 | verif | MainAppContainer.test.ts | 等待期间改选择不清空的引用比较分支无测试 | medium | patch | 预验证 gap |
| 14 | verif | MainAppContainer.test.ts | 未断言选择条出现时 `#imw-desk-room-deck` 消失、清空后回来 | medium | patch | 预验证 gap |

## Verification

**Commands:**
- `npm test` -- expected: 全部通过，含多选用例
- `npm run build` -- expected: tsc 与 vite 构建成功

**Manual checks:**
- 真站（iirose-plugin-verify）桌面与手机宽度各看一次：勾选框位置、标题单行、选择条取代底部条/迷你条。
