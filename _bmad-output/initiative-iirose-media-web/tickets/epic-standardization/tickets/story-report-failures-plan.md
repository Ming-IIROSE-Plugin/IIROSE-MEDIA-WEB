---
ticket: 4
title: 错误提示收敛
type: feature
status: done
baseline_revision: dd08a6a
route: oneshot
review: quick
lenses_ran:
- quick
context:
- src/tools/reportFailure.ts
---
# Story 4 — 错误提示收敛

## Intent

把平台层散落的 `catch + ShowMessage` 收敛到一个入口，用户可见文案不变。

## Implementation Notes

- 新增 `src/tools/reportFailure.ts`：`failureMessage(error)` 与 `reportFailure(error, fallbackMessage?)`；后者内部只调一次 `ShowMessage.show`。
- 替换 19 处（基线 18 处同款调用，另含 `RadioPlatform` / `AllVideosPlatform` 各自的 `ShowMessage` 直接调用）；不再使用 `ShowMessage` 的文件同步删掉了 import。
- 保留：`SendFetch.neteaseFailureToast` 的同因 10 秒去重、批量端点静默、风控码与 HTTP 433 归类、以及「先报错因再报建议」的两条式提示。
- 保留未替换：`NetEasePlatform` 里带 `|| "点播失败"` 空值兜底的那处（换成入口会把 falsy 抛出物变成 `"undefined"`，属文案变更）。
- 新增 `reportFailure.test.ts` 4 条：`Error` 实例、非 `Error` 值、fallback 优先、只弹一条。
- 验证：`grep "ShowMessage.show((error as Error).message)"` 归零；`tsc` 无告警；`npm test` 75 文件 / 1289 用例全绿；`npm run build` 通过，435.85 kB / gzip 132.48 kB。
