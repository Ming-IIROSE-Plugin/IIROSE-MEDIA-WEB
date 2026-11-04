---
spec: spec-announce-batch-scope
date: 2026-11-04
verdict: accepted
criteria: declared
settlement: contract-reconciliation
---

# 复盘结算说明：播报批量点播的批次作用域

**本 spec 以「契约对账」结算，不套用 stories 模式的复盘流程。**

## 为什么

本目录没有 `stories.yaml` 与 story 产物——它是 `spec-request-announce-modes` 复盘派生出的后续契约，由一次连续实现完成。因此由 `RECONCILIATION.md`（2026-10-31）逐 CAP 对照 HEAD 代码与测试结算，**只出结论、未改代码**。

## 结论（引自对账，未重新审）

**3 条 CAP 全部已实现，无偏差。**

| CAP                                                        | 结论   | 关键证据                                                                                                                                                |
| ---------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAP-1 批量执行中手动点播单曲，卡片照常发送                 | 已实现 | `Announce.shouldSendCard()` 的判定链（静默档 → `forceDepth` → 批次快照 → 放行）；`runSingleAnnounce` 包住 13 处手动入口；`Announce.test.ts:371/403/551` |
| CAP-2 批量循环内单项失败：提示一次、无 unhandled rejection | 已实现 | 平台层逐项 `catch` → `showBatchItemError`（同因 10 秒去重）+ 外层 `try/catch` 兜底；`Announce.test.ts:312/468/488/522`                                  |
| CAP-3 一次批量全程按入口档位快照                           | 已实现 | `batchModeSnapshots` 栈，入口压栈 / `finally` 弹栈；`Announce.test.ts:414/442`                                                                          |

约束里唯一失效的是两处数量表述（「10 处 `runBatchAnnounce` / 8 处 `sendMediaCard`」）：HEAD 已收敛为 6 / 7 处，属代码演进，不是偏差。

## 本次补充核对（2026-11-04）

对账写于 10-31，此后 `spec-collection-inner-batch` 给 `runBatchAnnounce` 加了 `BatchSendOutcome` 与校正消息。复核 HEAD：

- `grep -rn "batchDepth" src` = 0（旧的全局深度确实已清除）；
- `Announce.shouldSendCard` 仍是静默档 → `forceDepth` → 快照的唯一判定链，未被后续 epic 绕过；
- 校正消息只在总结已发出的前提下追加，不改三档语义。

结论不变。

## 参考

- `RECONCILIATION.md`（本 spec 的正式结算）
- `../spec-request-announce-modes/RETROSPECTIVE.md`（派生来源）
