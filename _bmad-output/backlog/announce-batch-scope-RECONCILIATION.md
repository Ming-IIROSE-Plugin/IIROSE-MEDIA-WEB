# 契约对账：播报批量点播的批次作用域（spec-announce-batch-scope）

日期：2026-10-31　　方式：逐 CAP 对照 HEAD 代码与测试；**只出结论，未改任何代码**。

本目录没有 `stories.yaml` 与 story 产物（它是 `spec-request-announce-modes` 复盘派生出的后续契约，由一次连续实现完成），因此按「契约对账」结算，不套用 stories 模式的复盘流程。

## 结论

**3 条 CAP 全部已实现，无偏差。** 约束里两处「数量」表述已随代码演进失效（不属于缺陷），见下表。

| CAP | 结论 | 证据 |
|---|---|---|
| **CAP-1** 批量执行中手动点播单曲，卡片照常发送 | 已实现 | 判定链 `Announce.shouldSendCard()`（`src/iirose_func/Socket/Announce/index.ts:41-52`）：静默档 → `forceDepth > 0` → 批次快照 → 放行。手动入口用 `runSingleAnnounce` 包住发送（13 处调用，覆盖 `MOD`/`MVOD`/`@` 直链/收藏/电台/选集等）；`forceDepth` 用 `try/finally` 关闭。测试：`Announce.test.ts:371`（批间手动点播放行、批量其余仍抑制）、`:403`（静默档优先于单曲窗口）、`:551`（loop 抛异常也关窗） |
| **CAP-2** 批量循环内单项失败：提示一次、无 unhandled rejection、其余行为不变 | 已实现 | 平台层逐项 `catch` → `Announce.showBatchItemError`（同因 10 秒窗口去重）；`runBatchAnnounce` 外层 `try/catch` 兜底、任何路径不上抛（`index.ts` 的 catch 分支）。测试：`Announce.test.ts:312`（循环抛异常 → 无 unhandled rejection、提示一次、finally 关窗）、`:468`（逐项失败跳过、剩余照播）、`:488`/`:522`（同因去重窗口内/到期） |
| **CAP-3** 一次批量全程按入口档位快照，中途切档不影响进行中批次 | 已实现 | `batchModeSnapshots` 栈：入口压栈、`finally` 弹栈；`shouldSendCard` 只消费栈顶快照。测试：`Announce.test.ts:414`（批量中切 card，本批剩余仍抑制；下一批按新档位）、`:442`（切 silent 立即生效） |

## 约束核对

| 约束 | 结论 |
|---|---|
| 抑制判定收敛为批次作用域，全局深度不再吞非本批发送点 | 已实现：`batchDepth` 在 HEAD 中**零引用**（`grep -rn batchDepth src` = 0），改为 `batchModeSnapshots` 栈 + `forceDepth` |
| `mediaEvent` 逐项照发、永不跳过 | 已实现：`Announce` 只门控卡片（`sendMediaCard`），`mediaEvent` 由平台层直接 `socket.send`（如 `NetEasePlatform.ts:1064`） |
| 静默档读实时值且优先于一切窗口与快照 | 已实现：`shouldSendCard` 第一行读实时 `announceMode`，`silent` 直接返回 false；测试 `:442` 覆盖「刻意不对称」 |
| 三档语义与总结消息格式不变 | 已实现：总结报文格式测试仍为原期望（`Announce.test.ts:143-157`） |
| 失败提示同因去重、不得刷屏 | 已实现：`showBatchItemError` 的 10 秒同因窗口 + `ShowMessage.shownCount` 记账 |
| 「必须覆盖全部 10 处 `runBatchAnnounce` 调用与 8 个 `sendMediaCard` 发送点」 | **表述已过期，非偏差**：HEAD 是 **6** 处 `runBatchAnnounce`（平台入口收敛：整张 / 多选 / 选集共用 `playSongIds` 与 `playCollectionAll`）与 **7** 处 `sendMediaCard`（`InputPlatformAnalysis` 1、`AllVideosPlatform` 1、`BilibiliPlatform` 2、`NetEasePlatform` 2、`RadioPlatform` 1）。逐处核对均在 `Announce` 之后经统一判定，无绕过 |

## 后续增量（不在本 spec 范围，已由其它 epic 改动）

- `runBatchAnnounce` 的 loop 现在可以回传 `BatchSendOutcome`，并在 `stopped`/`failed` 时补发一条群消息校正（`spec-collection-inner-batch` 引入，`9ac89be`）。**这不改变 CAP-1..CAP-3 的三档语义**：总结消息格式未变，校正只在总结已发出的前提下追加。
- 该校正的判定曾以「实发数 < 总数」推断，导致跑完但跳过几首时误报「已停止」；已在 `9ac89be` 改为按停止原因判定，并由 `Announce.test.ts:619`（有无版权跳过 → 绝不发「已停止」）钉住。

## 真机验证状态

- **CAP-1 已真机观察**（2026-10-31，iirose.com，summary 档）：对 99 首歌单点「全部播放」，运行中切回单曲范围手动点播一首，聊天区出现新的单曲卡片，批量继续。同批次期间也观察到部分批量卡片被放行——与 `## Assumptions` 已记录的竞态一致：手动入口只能把整个点播动作包进 `runSingleAnnounce`，窗口开启期间并行批量的逐卡发送会被一并放行，这是设计上接受的代价。
- **CAP-3 已真机验证**（2026-10-31，维护者实测）：批量执行中「批量总结 → 发卡片」，本批剩余**不**转逐卡；「发卡片 → 静默」则**立即**静默。两条与设计一致（快照 vs 实时档的不对称）。
- **CAP-2 部分验证**：用请求拦截打掉 `api/song/detail` 后整张点播 → 用户收到失败提示、群内补发「因错误中断，实际提交 0 / 99 项」、控制台无 `pageerror` / unhandled rejection。**「逐项异常」这一具体路径仍未真机复现**（数据侧已加固，手造异常困难）；单元测试按 CAP 命名覆盖（`Announce.test.ts:312/468/488`）。
- 复验中还发现一处小瑕疵：同一条失败提示按节点重试各弹一次，10 秒同因去重没覆盖到，已记入 `deferred-work.md` 的「待真机验证」。
- 真机证据此前只有 `spec-request-announce-modes` 时期的冒烟记录；本轮补了 CAP-1 一条。全量三条的复验仍列在 `deferred-work.md` 的「待真机验证」清单。

## 结算

- 该 spec 目录**已结算**（契约实现完成、无待修偏差）；无需补 `stories.yaml`，后续若再改播报作用域，按新的 spec 走。
