---
ticket: 1
title: 批量点播即停与边取边发
type: bugfix
created: '2026-10-31'
status: done
baseline_revision: c00a528ab3c00263348ac94d2206f6505f1f3aa3
route: dispatch
review_loop_iteration: 0
context:
- '{project-root}/_bmad-output/initiative-iirose-media-web/archive-v6/spec-collection-inner-batch/SPEC.md'
---
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 批量点播（整张正序/乱序、选集多选）点「停止」后房间不再发歌，但插件仍在发网易云请求：发送前要串行取完全部曲目详情且期间不查停止，飞行中请求无法中止；停止标记约 1.4 秒后随浮窗卡片移除被清掉，准备阶段停止的批次会在详情取回后复活发歌（SPEC CAP-3、CAP-4）。

**Approach:** 批次句柄带一个停止即 abort 的信号，停止标记对句柄永久有效；`neteaseRequest` 接受外部信号；发送循环改为每 100 首取一段详情、边取边发，每段与每首前查停止，请求都带信号。

## Boundaries & Constraints

**Always:** 网易云请求只经 `SendFetch.neteaseRequest`；外部中止与 5s 超时区分——外部中止立即返回 `null`、不换节点、不弹提示。发送顺序 = 入参顺序（正序/乱序/点选顺序）。BatchProgress 现有语义保持：已停止不被 `step`/`setTotal` 改回进行中、停止后 1.2s 收起、一首未发显示「失败」。单曲点播（无 batch）行为不变。

**Never:** 不改浮窗 UI、不改选集面板、不改内页加载（story 2）；不撤回已发出的点播；不新增依赖；不在平台层自拼代理前缀。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 准备中停止 | 首段详情请求飞行中点停止，之后超过 1.4s 详情才「返回」 | 详情请求被 abort；不取歌词、不发任何报文；卡片「已停止」后收起 | 不弹失败提示 |
| 发送中停止 | 第 k 首取歌词时停止 | 该歌词请求 abort，第 k 首及之后不发；不再请求后续段详情 | 不弹提示 |
| 句柄移除后 | 停止后卡片已移除 | `handle.cancelled` 仍为 true、`signal.aborted` 仍为 true | — |
| 边取边发 | 250 首 | 详情按 100/100/50 三段依次请求；第 1 首在第 1 段返回后发出，第 2 段请求在第 1 段全部处理后才发起 | — |
| 段失败 | 第 2 段详情返回 null（非中止） | 停止后续段；总数校正为已处理数；已发曲目保留 | 失败提示由 `neteaseRequest` 发出（已有去重） |
| 首段失败 | 第 1 段返回 null | 不发报文，卡片显示「失败」 | 同上 |
| 外部中止请求 | `neteaseRequest(..., signal)` 期间 signal abort | 立即返回 null，fetch 只调用 1 次，不 toast | — |

</frozen-after-approval>

## Code Map

- `src/playback/BatchProgress.ts` -- 模块级 `cancelled` Set 在 `remove()` 中删除 id，`handle.cancelled` 读该 Set → 复活根因。加每批 `AbortController`（Map 按 id），`stopBatch` abort；句柄闭包持有 controller，`cancelled` 读 `signal.aborted`；`BatchHandle` 增 `readonly signal: AbortSignal`。`liveStatus` 可继续用 Set。
- `src/Api/index.ts:343` `neteaseRequest(url, params, method, headers?)` -- 每节点自建 controller 做超时；新增可选第 5 参 `signal`：入口已中止直接返回 null；外部 abort 时联动中止当前节点 controller，`catch`/`aborted` 分支判外部中止 → `return null`（跳过 `showNeteaseFailure`）。监听器在 finally 移除。
- `src/Api/NeteaseAPI/NeteaseMusic/index.ts` -- `getNeteaseSongDetail(ids, signal?)`（每段前查中止，透传）、`getLyric(id, signal?)` 透传。其余调用点不传，行为不变。
- `src/platforms/NetEasePlatform.ts:1071` `sendSongs` -- 现为一次取全部详情再循环；改为按 `DETAIL_CHUNK`(100) 分段：段前查 `batch?.cancelled`；取段 `getNeteaseSongDetail(chunk, batch?.signal)`；null 时若已中止 break，否则校正总数后结束；段内按 chunk 顺序经 Map 重排后逐首发送（原逻辑：无版权计数、歌词、发送前再查停止、单项失败提示）。`setTotal` 改为随段失败/缺详情累减。无 batch（单曲）同样适用，只是一段。
- `src/platforms/NetEasePlatform.test.ts:419` -- 现有「中途停止」用例；新用例沿用其写法（`finalODSONG.mockRestore()` + 真实循环，`neteaseMusic` mock）。
- `src/playback/BatchProgress.test.ts`、`src/Api/NeteaseRequest.test.ts` -- 补用例处。
- 不改：`openEpisodePicker`、`Announce`、`playCollectionAll`/`selectEpisodes` 的调用形状（`finalODSONG(ids, batch)` 不变）。

## Tasks & Acceptance

**Execution:**
- [x] `src/playback/BatchProgress.ts` -- 句柄加永久 `signal`/`cancelled`，`stopBatch` abort -- 修复活、给请求层中止源
- [x] `src/Api/index.ts` -- `neteaseRequest` 支持外部信号，外部中止静默返回 null -- 飞行中请求可中止
- [x] `src/Api/NeteaseAPI/NeteaseMusic/index.ts` -- `getNeteaseSongDetail`/`getLyric` 透传可选信号 -- 连通
- [x] `src/platforms/NetEasePlatform.ts` -- `sendSongs` 分段边取边发、段前/首前查停止、请求带信号 -- CAP-3/4
- [x] 测试三文件 -- 覆盖 I/O 矩阵全部行 -- 回归保护

**Acceptance Criteria:**
- Given 一个 200 首批次在发送中, when 点停止, then 之后 `NeteaseMusicAPI` 的详情/歌词 mock 不再被调用且无新的 `sendMediaCard`。
- Given 现有测试套件, when `npm test` 与 `npm run build`, then 全部通过。

## Implementation Notes

- `BatchProgress` 用按 id 的 `AbortController` 表取代 `cancelled` Set；句柄闭包持有 controller，`remove()` 只删表项，句柄的 `cancelled`/`signal` 永久有效。
- `neteaseRequest` 外部信号与节点超时共用每节点 controller（外部 abort 联动），各出口先判 `signal.aborted` → `null`，循环结束后再判一次再提示。
- `sendSongs` 去掉一次性全量详情；`processed` 计数用于段失败时 `setTotal`；缺详情曲目逐段从 `total` 扣除。
- `fetchSongDetailsPooled`（选集面板补名）未接信号——超出本故事范围。

## Spec Change Log

## Review Triage Log

| # | 来源 | 位置 | 意见 | 判定 | 去向 | 依据 |
|---|------|------|------|------|------|------|
| 1 | blind / edge | NetEasePlatform.ts:1092 | 段失败后卡片显示「完成」而非部分失败 | low | reject | I/O 矩阵「段失败」冻结规定为校正总数为已处理数；改为部分失败态需改 spec 与浮窗 UI（Never 不改浮窗） |
| 2 | blind / edge | NeteaseMusic/index.ts:85 | code 200 无 songs / catch 返回 null 无 toast，后续段静默丢弃 | low | reject | 真实但罕见（接口 200 却无 songs）；修复需新增提示分支；10 秒去重只吞掉用户刚看过的同因提示 |
| 3 | blind / edge | NetEasePlatform.ts:243/889/907 | 汇总消息按 ids.length 预报，停止/段失败时与实发不符 | medium | defer | 基线 c00a528 已按 ids.length 预报，预先存在 |
| 4 | blind / verif | NetEasePlatform.ts:130、trackLoader.ts:47 | 选集面板 fetchSongDetailsPooled 未把 signal 传给新参数 | medium | defer | 预先存在（关面板只停新批次）；非本 story 引入，记入 deferred-work |
| 5 | blind | NeteaseMusic/index.ts:63 | CHUNK_SIZE 注释「最多 150」过时，与 DETAIL_CHUNK 双源 | low | patch | 注释为直接修正；调大 DETAIL_CHUNK 时会误导维护者 |
| 6 | blind | NetEasePlatform.ts:1103 | 段内缺详情扣减总数的分支无测试 | low | patch | 新增用例全为全量返回，分支未覆盖 |
| 7 | blind | api/index.ts neteaseRequest | 读 body 期间中止、节点间中止两条分支无测试 | low | patch | 新测试只覆盖飞行中/入口/不中止三种 |
| 8 | blind | NetEasePlatform.test.ts 准备中停止 | 依赖单次微任务时序；注释 1.4s 与实际 2.2s 不符 | low | patch | `await Promise.resolve()` 后即断言 seen，多一个 await 即失败 |
| 9 | blind | BatchProgress.ts resetBatches | 清表不 abort，残留循环可串扰后续用例 | low | patch | 一行 abort 即可，直接修正 |
| 10 | blind | NetEasePlatform.ts:1159 | 停止后仍弹「已跳过 N 首无版权曲目」 | low | patch | 违反 I/O 矩阵「发送中停止 → 不弹提示」 |
| 11 | blind | AGENTS.md | 批量点播进度条目未写 signal / 边取边发 | low | defer | 修复编辑 agent-context 文件 |
| 12 | edge | NetEasePlatform.ts:236 | 无 batch 时后续段失败无提示 | false | reject | 无 batch 的调用只在 ids.length===1 时，只有一段 |
| 13 | edge | BatchProgress.ts:150 | failed 卡片可被 stopBatch 改为已停止 | false | reject | 停止按钮只在 preparing/running 显示（BatchProgressStack.tsx:54），failed 时不可达 |
| 14 | verif | NeteaseMusic/index.ts:75、:172 | getLyric/getNeteaseSongDetail 透传 signal 无测试，删掉透传测试仍过 | medium | patch | 预验证 gap |
| 15 | verif | NetEasePlatform.test.ts 准备中停止 | 未覆盖中止后详情返回 null 时卡片 total 不被 setTotal(0) 改写 | medium | patch | 预验证 gap |

## Verification

**Commands:**
- `npm test` -- expected: 全部通过，含新增停止/分段用例
- `npm run build` -- expected: tsc 与 vite 构建成功
