---
ticket: 3
title: 收藏云同步：首次合并预览与确认
type: feature
created: '2026-10-19'
status: done
baseline_revision: 1e557332c713d6e732183b4aab24468cb468d25c
route: dispatch
review_loop_iteration: 0
context: []
---
<frozen-after-approval reason="human-owned intent — do not modify unless user renegotiates">

## Intent

**Problem:** 首次启用同步时，云端与本地被**静默并集后直接上传**——用户只在事后从提示条看到「云端 137 / 本地 89 / 合并后 152」这几个数字，而那时数据已经写进云端了。并集不是你想要的，也没有回头路。更麻烦的是 `enable()` 在 `performSync` **之前**就把 `enabled` 置真，于是预览若停留几秒，任何一次收藏增删都会让 5 秒防抖把**未经确认**的合并结果写上去。

**Approach:** 把首次启用拆成两段：先纯读地算出合并结果并弹确认框显示三个数字，**确认后**才真正写入并持久化启用状态；取消则本地与云端都不发生任何变化、回到未启用。入口与交互仍只在设置面板。

## Boundaries & Constraints

**Always:**
- 预览必须是**纯读**：算「云端 N / 本地 M / 合并后 K」的过程不写云端、不翻转 `enabled`、不写本机密钥缓存。
- **确认前不得有任何上传**：预览期间必须抑制防抖上传（现存路径是 `enabled` 提前置真触发的，本次要消除）。
- 确认框只给**两个选项**：「合并并上传」/「取消」。
- 取消 → 本地与云端**均无变化**，同步保持**未启用**；下次点启用重新预览。
- 确认后复用预览阶段已解密的结果继续，**不得二次 GET**。
- 云端为空（`snapshot: null`）时**跳过确认**，直接上传并提示「已同步 N 条」（没有合并可确认）。
- 状态与失败提示沿用既有 `SYNC_ERROR_MESSAGES` 九类文案；本轮**不**新增面板状态显示（已 defer）。
- 确认框复用 `buildSelect2`（参照 `src/platforms/NetEasePlatform.ts:61-88`）；若在回调里再开弹窗必须包 `setTimeout(..., 300)`。
- 入口与交互**只在设置面板**：不动 Row 2 工具栏与 `AGENTS.md` 冻结的布局约定。

**Never:**
- 不做「以本地为准覆盖云端」（服务端 409 会挡，属另一件事）。
- 不修改 `cloud/sync/`、`scripts/`、`SyncCrypto` 与 `SyncMerge` 的裁决规则。
- 不做面板的实时状态显示 / `onStateChange` 订阅 / 「同步中…」「待重试」（已 defer 到下一轮）。
- 不做 Row 2 常驻状态按钮、不做带图标的富提示。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 首次启用，云端有数据 | 本地 89 / 云端 137 / 重叠 74 | 弹确认框显示「云端 137 / 本地 89 / 合并后 152」，**不上传、不置 enabled** | 计算失败 → 提示并保持未启用 |
| 确认合并 | 上一步的确认 | 复用预览结果直接上传，成功后置 `enabled`、写密钥缓存，提示三个数字 | 上传失败 → 保持未启用并提示，可重试 |
| 取消合并 | 上一步的取消 | 本地与云端均无变化，卡片回到「未启用」 | — |
| 预览停留期间发生收藏增删 | 确认框还没答 | **零 PUT**（防抖被抑制），取消后这些改动仍留在本地 | — |
| 首次启用，云端为空 | 已登录、本地 N 条 | 跳过确认，直接上传并提示「已同步 N 条」 | 同上传失败路径 |
| 未登录账号 | 无 `window.uid` | 卡片「未登录账号」，动作给原因 | 不发请求 |
| 已在进行中 | `busy === true` | 拒绝并发的启用/预览 | 提示「请稍候」 |

</frozen-after-approval>

## Code Map

- `src/sync/SyncManager.ts` -- `enable()`(:334，**在 performSync 前就写 `enabled: true`** :373-377，是要拆掉的点)、`performSync`(三条分支 :805/:810/:837-840 算完 `items`/`stats` 后才 :863 加密 :876 上传)、`PrefetchedRemote`(:77-84，已解密 snapshot 可复用)、`MergeStats` 来自 `SyncMerge.ts:23-30`、`describeStats`(:189-194)、变更监听(:257-261)、`UPLOAD_DEBOUNCE_MS = 5000`(:37)、`busy` 守卫(:350)、`rememberUnlocked`(:约 371 后)
- `src/sync/SyncClient.ts` -- `SYNC_ERROR_MESSAGES`(:39-49)、`describeSyncError`(:58-66)
- `src/page/MainAppContainerServices/SettingsService.ts` -- `showSyncSettings`(:201-203)、`buildSyncSettings`(:205-339)、`refresh`(:208)、「云端同步」卡片的 action(:229-253)、口令输入助手(:217-226)
- `src/platforms/NetEasePlatform.ts:61-88` -- 两选项 `buildSelect2` 的可复制范式
- `src/iirose_func/IIROSEUtils.ts` -- `sync`(:10-37)、`buildSelect2`(:51-64)、参数含义(:42-49)
- `src/settings/commonSettings/CommonSettings.ts` -- 隐私政策里的同步条款（本轮补一句「先预览确认再上传」）
- `_bmad-output/specs/spec-favorites-cloud-sync/SPEC.md` -- CAP-3（预览确认）、`sync-protocol.md` §4.1

## Tasks & Acceptance

**Execution:**
- [x] `src/sync/SyncManager.ts` -- `performSync` 加 `dryRun` 选项：三条分支算完 `items`/`stats` 后提前返回，不加密、不上传（提前返回点位于 `const updatedAt = ...` 之前） -- 预览的纯读基础
- [x] `src/sync/SyncManager.ts` -- 新增 `previewEnable(passphrase)`：完成口令校验与 `resolveContext`，返回 `{ stats, cloudEmpty }` 且**不写任何持久化状态**（缺省的 `deviceId` 也只在本轮内存里生成，确认时才落盘）；已解密的 `PrefetchedRemote` 暂存到模块级 `pendingEnable` -- 让确认框有数字、且确认时不必二次 GET
- [x] `src/sync/SyncManager.ts` -- 新增 `commitEnable()`：复用暂存结果直接上传，成功后才置 `enabled`、写 `salt`/密钥缓存；新增 `cancelEnable()` 清暂存、不改状态 -- 消除「确认前上传」
- [x] `src/sync/SyncManager.ts` -- 预览期间抑制防抖：新增纯函数门 `shouldUpload(gate)` + 模块级 `canAutoUpload()`，`scheduleUpload` / `uploadPendingChanges` / `flushPendingUpload` 一律先过这道门；`enabled` 不再提前置真 -- 保证零 PUT
- [x] `src/page/MainAppContainerServices/SettingsService.ts` -- 「云端同步」卡片的启用动作改为 `previewThenEnable`：云端非空 → 先 `previewEnable` → 300ms 后弹两选项确认框（`confirmMerge`）→ 确认走 `commitEnable`、取消走 `cancelEnable` 并 refresh；云端为空直接 `commitEnable` -- CAP-3 的交互落点
- [x] `src/settings/commonSettings/CommonSettings.ts` -- 隐私政策第 3 条补一句「首次启用会先显示合并结果，确认后才上传」 -- 与行为一致

**Acceptance Criteria:**
- Given 云端 137 / 本地 89 / 重叠 74，when 首次启用，then 确认框显示「云端 137 / 本地 89 / 合并后 152」，且**确认前抓包无任何 PUT**、设置面板仍显示「未启用」。
- Given 确认框，when 选择取消，then 云端对象字节未变、本地收藏未变、卡片回到「未启用」，且再次启用会重新预览。
- Given 预览停留期间连续收藏两条并等 10 秒，when 观察网络，then 仍无 PUT；取消后这两条仍在本地。
- Given 确认合并，when 上传成功，then 卡片变「已启用」、出现「已解锁」，提示条报同一组数字；抓包只有**一次** PUT、且无第二次 GET。
- Given 云端为空，when 首次启用，then 不弹确认框，直接上传并提示「已同步 N 条」。
- Given 确认后上传失败（503），when 观察，then 保持未启用并给出可行动文案，且重试仍会重新走预览。

## Implementation Notes

- `enable()` 已被拆成 `previewEnable()` / `commitEnable()` / `cancelEnable()` 三件套并从代码里移除（唯一调用方是设置面板）；任何「确认前上传」的旁路都不再存在。
- 预览的纯读边界：`previewEnable` 只发一次 GET，`performSync(..., { dryRun: true })` 在三条分支算完 `items`/`stats` 后提前返回；不调 `encrypt`/`put`/`applyRemoteMerge`/`setRemoteRev`/`rememberUnlocked`，不写 `enabled`/`salt`。缺 `deviceId` 时只在本轮内存里生成候选值，直到 `commitEnable` 成功才随 `enabled`/`salt` 一起落盘。
- 零 PUT 的门是 `shouldUpload(gate)`（纯函数，已单测）与模块级 `canAutoUpload()`（唯一调用点：`scheduleUpload` / `uploadPendingChanges` / `flushPendingUpload`）。预览期间 `pendingEnable` 非空即一律拦下，与 `enabled` 无关——这正是原实现「提前置 enabled 让防抖把未确认结果写上去」的根因，已消除。
- 确认后复用 `pendingEnable` 里的 `ctx` 与 `PrefetchedRemote`，`performSync` 从 `attempt === 0` 直接用这份快照，因此无第二次 GET；`PendingEnable` 不再记录预览时刻的变更代数——`performSync` 上传前会重新读本地收藏，预览期间的新增/删除自然进入合并结果。
- 失败语义：`commitEnable` 上传失败即作废预览并保持未启用（下次启用重新预览）；`cancelEnable` 清暂存与防抖计时器；`disable()` / `forgetLocalKey()` 也顺手清 `pendingEnable`，避免跨状态残留。
- 确认框复用 `buildSelect2`（两选项 + 顶端 HTML 摘要），沿用 `NetEasePlatform.buildOrderConfirmSelect` 的内联 `font-family:md` 图标写法；`previewThenEnable` 在打开它之前 `setTimeout(..., 300)`，避开宿站 prompt 关闭后的 `fadeOut + empty()`。点空白/关闭按「取消」处理，且用 `answered` 标志保证回调只生效一次（宿站可能同时触发选项回调与空白回调）。
- 本轮**没有**新增面板状态显示（不订阅 `onStateChange`、不显示「同步中…」），Row 2 工具栏与 `AGENTS.md` 的布局约定未动。
- `performSync` 的 `dryRun` 与 `pullOnly` 互不影响；`pullOnly` 的提前返回仍在其前，语义未变。
- 评审补丁：隐私政策第 3 条按实现重写（预览会发一次 GET、云端为空跳过确认），`PrivacyVersion` 随之升到 1.0.4 让老用户重新确认；`commitEnable` 里只有上传失败才作废预览，本机密钥缓存写失败单独 `try` 住并 `console.warn`，不再把「已启用」报成失败；面板路由抽成纯函数 `chooseEnableStep(preview)`（`abort` / `commit` / `confirm`）并补测，避免空云端分支被写反而无人发现。

## Verification

**Commands (实跑):**

- `npm run build` -- 通过（`tsc -b` + `vite build`，133 modules）。
- `npm test` -- 7 个测试文件 / 83 个用例全绿。新增：
  - `src/sync/SyncManager.test.ts`：`shouldUpload` 门（预览待确认时不放行，即使 enabled 为真）+ `formatMergeStats` 口径 + `chooseEnableStep`（失败→abort / 云端为空→commit / 云端非空→confirm）。
  - `src/sync/SyncManagerPreview.test.ts`（真实加解密 + 假 fetch）：预览只 GET 且 `localStorage` 一个字节都没写（`enabled` 仍 false、无密钥缓存）；取消后零 PUT 且 `commitEnable` 被拒；再次预览→确认只有一次 PUT、零二次 GET，成功后 `enabled=true`、`getState().unlocked===true` 且写入密钥缓存，提示条与确认框同组数字；云端为空时 `cloudEmpty=true`、提交后提示「已同步 2 条收藏」且只 PUT 一次；确认后 503 → 保持未启用、不写缓存、`PUT` 仍只有一次，重试必须重新预览；守卫与零 PUT 三条——预览停留期间 `uploadPendingChanges` 被拦且不回写本地、未登录不发请求、并发预览被拒且不重复 GET。

**Manual checks (真机，2026-10-19，iirose.com + 注入 dist/bundle.js):**

- 插件加载、设置面板「云端同步」卡仍显示「未启用 / 上次同步时间 / 无本机密钥」，布局未受影响。
- 错误口令走预览：抓包只有一次 `GET /v1/favorites`、**零 PUT**；提示「同步口令不正确，云端数据未被修改」；卡片仍「未启用」，`imwPluginSetting.sync` 的 `enabled`/`salt`/`lastSyncAt` 均未变（预览纯读得到真机确认）。
- 确认框渲染：用与 `confirmMerge` 完全相同的 HTML 调宿站 `buildSelect2`，桌面 1280 与移动 390 两档：顶端摘要三段文字完整、两个选项（合并并上传 / 取消）可点、`scrollWidth - clientWidth = 0`（无横向溢出）、图标字体解析为 `md` 且字形正常；点击「取消」回调收到 `1`（与 `Number(value) === 0` 的判定一致）。
- 2026-10-19 补验（见 `_bmad-output/specs/spec-favorites-cloud-sync/RETROSPECTIVE.md` 第 2 轮 Behavior verification）：用自建口令在测试账号上跑通成功合并——预览 1 GET、确认框「云端 3 / 本地 4 / 合并后 4」、停留 10 秒零 PUT、确认后 1 PUT 且无二次 GET。取消路径仍沿用本轮的真机核对结果。

## Review Triage Log

**第 1 轮**（diff：`/tmp/opencode/spec-favorites-cloud-sync-experience-review-1792425462.patch`，34.7 kB；三层评审：blind-hunter 15 条、edge-case-hunter 7 条、verification-gap 4 条）

| ID | 来源 | 位置 | 评审主张 | 判定 | 证据 | 路由 |
|----|------|------|----------|------|------|------|
| B1 | blind | `CommonSettings.ts:49` | 隐私条款称「未启用不产生同步请求」「确认后才上传」，但预览会发 GET、云端为空时直接上传 | `medium` | 属实：`previewEnable` 在 `enabled=false` 时发一次 GET（`SyncManager.ts:433`）；空云端分支直接 `commitEnable()`（`SettingsService.ts:353-358`）。条款是本轮新写的，与代码不符 | patch（与 E6 同根） |
| B2 | blind | `LocalStorageUtils.ts:149` | 隐私政策改文案但版本号仍是 1.0.3，老用户不会重新确认 | `low` | 属实：`PrivacyVersion` 按注释约定逐次升版（1.0.1→1.0.2→1.0.3），版本不等才弹重新同意（`:111-113`）。本轮新增用户可见承诺却未升版 | patch |
| B3 | blind | `SPEC.md:33-36` / `sync-protocol.md` §4.1 | 文档仍描述一次性 `enable()` 流程 | `false` | CAP-3 与 §4.1 第 1–4 步本来就写的是「预览 → 确认 → PUT」「云端为空跳过预览」，与本轮实现一致，不存在所述漂移；§4.1 第 5 步的「以本地为准」是旧文档遗留，且被本轮冻结意图明确排除 | 驳回（已驳回） |
| B4 | blind | `SettingsService.ts:402-404` | 借用宿站 `mdi-*` 类，字形可能空白 | `false` | 真机手工核验（见上文 Manual checks 第 3 条）用同一份 HTML 在宿站渲染：图标字体解析为 `md`、字形正常；`NetEasePlatform.buildOrderConfirmSelect` 同法已在线上使用 | 驳回（与 E4 同根） |
| B5 | blind | `SyncManager.ts:119-131` | `pendingEnable` 无生命周期、无可见状态，弹窗没弹出就永久残留 | `low` | 残留确实可能（`buildSelect2` 在缺 `window.Utils` 时静默返回），但此时 `enabled` 仍为 false，上传门本就关着；用户再次点「启用」会重新预览并清掉暂存。内存里留一份已解密 DEK 与确认后的缓存等价 | 驳回（修复需新增 TTL/状态字段，超出直接订正） |
| B6 | blind | `SyncManager.ts:472-478` | 空云端分支不给用户看条数就上传，预览文案成了死代码 | `false` | 冻结意图明写「云端为空时跳过确认，直接上传并提示『已同步 N 条』」；`commitEnable` 的返回文案正是「已同步 N 条收藏」，用户看到的不是无声上传 | 驳回（意图已排除） |
| B7 | blind | `SyncManager.ts:75-80` | 只显示三个计数，墓碑删除在确认时不可见 | `low` | 冻结意图规定确认框「只给两个选项」+ 三个数字，删除明细不在意图内；合并后计数 K 本身已让用户看到并集相对两侧的变化 | 驳回（意图已排除） |
| B8 | blind | `SyncManager.ts:994` | 确认后重新读本地收藏，上传集合可能不同于确认时数字 | `false` | 实现说明（非冻结）明确记录「预览期间的新增/删除自然进入合并结果」；AC 的 Given 不含「确认期间改收藏」，而矩阵行 4 的预期就是改动留在本地 | 驳回（与 E7 同根；设计已裁定） |
| B9 | blind | `SyncManager.ts:523-535` | 置 `enabled=true` 后 `rememberUnlocked` 抛错会被 catch 报成启用失败 | `medium` | 属实：`:521-528` 先落 `enabled`/`unlocked`，`:528` 抛错后 `:533-535` 返回 `ok:false`，面板刷新后却显示「已启用」，提示与状态矛盾 | patch |
| B10 | blind | `SyncManager.ts:1014-1018` | dryRun 复用上传文案；notModified 分支无 stats 会被当失败 | `false` | `previewEnable` 不采用 `preview.message`，自建「合并预览：…」（`:469-478`）；`client.get(null)` 不带 ETag，预览路径的 `notModified` 恒为 false，`prefetched` 强制 `notModified:false`（`:443-454`），所述分支不可达 | 驳回 |
| B11 | blind | `SettingsService.ts:362` | 300ms 定时器无句柄，连点会出现两个弹窗、确认到错的预览 | `low` | 成立但需连续两次走完「输口令」流程且在前一弹窗存活期间完成；宿站弹窗本身模态遮挡卡片动作，日常难以触发 | 驳回（与 E2 同根） |
| B12 | blind | 多处 | 守卫与分支缺测试（uid 切换、错误口令、防抖入口、重预览、面板接线） | `low` | 其中「面板接线」（V1）、「提交后解锁」（V2）已单独判定为 patch；其余（uid 切换、错误口令、二次预览）属锦上添花，机制已被现有用例覆盖 | 驳回（剩余部分并入 V1/V2） |
| B13 | blind | `SyncManagerPreview.test.ts:585-600` | 未按 CAP-3 夹具 89/137/74 验证 | `low` | 并集/冲突裁决在 `SyncMerge.test.ts` 已覆盖；本 spec 的 AC 验的是「确认框显示与上传门」，用小数据等价 | 驳回 |
| B14 | blind | `SyncManagerPreview.test.ts` | 用例各自重置状态、依赖执行顺序，`window.uid` 未还原 | `low` | 部分属实：`respond` 只在 `beforeAll` 初始化，重排后首条用例会继承上一条的响应；`afterAll` 未还原 `uid` | patch（与 E5 同根） |
| B15 | blind | `SettingsService.ts:396-423` | 确认框复制了 NetEase 的图标/尺寸/300ms 脚手架，将来会漂移 | `low` | 属代码整洁问题，未指出会由哪个调用方分叉；抽公共 helper 会新增对外表面 | 驳回 |
| E1 | edge | `SyncManager.ts:494-519` | 预览到确认之间别的设备写入云端，会被本轮合并结果覆盖 | `low` | 无 `If-Match` 的整包 LWW 是既有协议设计；窗口确实被拉长，但并集合并 + 对方设备下次同步会把条目带回云端，不构成永久丢失。加冲突检测需改协议（意图排除改 `cloud/sync/`） | 驳回（见 deferred 记录另议） |
| E2 | edge | `SettingsService.ts:362-376` | 300ms 内关面板或状态变化会弹出孤儿确认框 | `low` | 与 B11 同根；孤儿弹窗点「取消」即清暂存，不会产生上传 | 驳回（并入 B11） |
| E3 | edge | `SettingsService.ts:383-424` | 宿站拆掉弹窗且不回调时 `pendingEnable` 永久悬挂 | `low` | 与 B5 同根；无上传副作用，再次启用即自愈 | 驳回（并入 B5） |
| E4 | edge | `SettingsService.ts:402` | 宿站样式表无 `.mdi-cloud-upload` 规则会留空白图标位 | `false` | 真机手工核验同一份 HTML：`font-family` 为 `md`、字形正常 | 驳回（并入 B4） |
| E5 | edge | `SyncManagerPreview.test.ts:49` | 用例未在 `beforeEach` 重置 `respond`，顺序敏感 | `low` | 与 B14 同根，属实 | patch（并入 B14） |
| E6 | edge | `CommonSettings.ts:49` | 政策承诺「总是先显示条数再上传」，空云端直接上传 | `medium` | 与 B1 同根，属实 | patch（并入 B1） |
| E7 | edge | `SyncManager.ts:514` | 提示条数字可能不同于确认框（提交时重算 stats） | `false` | 设计已裁定（实现说明第 4 条）；无并发编辑时两者同源同组数字，AC 的 Given 不含编辑 | 驳回（并入 B8） |
| V1 | verify | `SettingsService.ts:347-375` | 面板层「弹框 / 直接提交」分支无测试，写反仍全绿 | `medium` | 属实：`grep SettingsService --include=*.test.ts` 零命中；把 `:353` 的 `cloudEmpty` 取反后 80/80 仍通过 | patch |
| V2 | verify | `SyncManager.ts:522` | 提交成功后未断言 `unlocked` 落地，回归会静默断掉自动同步 | `medium` | 属实：`getState().unlocked` 全仓测试零断言；删掉 `:522` 后全绿 | patch |
| V3 | verify | `SyncManager.ts:531` | 上传窗口内的补排上传无人覆盖 | `low` | 属实，但要构造「PUT 在途时触发 onChange」需先搭 `SyncManager.init()` 监听器夹具；该分支只是补排一次防抖，漏掉不会丢数据 | 驳回（修复成本超出直接订正） |
| V4 | verify | `SyncManager.ts:165` | `previewPending` 当前不可达，是死防御且写反不会被发现 | `low` | 属实：`previewEnable` 不写 `unlocked`、`commitEnable` 先清暂存再置 `enabled`，公开 API 无法同时满足三条件 | defer（评审层给出的处置） |

**分组与路由结论：**

- 无 `intent_gap`、无 `bad_spec`，不触发回退。
- `patch` 共 5 组（组内最高判定）：B1+E6（`medium`）、B9（`medium`）、V1（`medium`）、V2（`medium`）、B2（`low`）、B14+E5（`low`）；V3 单独驳回，V4 转 defer。
- `defer` 1 条（V4）。E1 的并发覆盖窗口按 `low` 驳回，若后续引入条件写（`If-Match`）再重估。

