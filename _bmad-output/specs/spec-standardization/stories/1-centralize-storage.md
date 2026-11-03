---
status: built
route: oneshot
review: quick
lenses_ran:
  - quick
baseline_revision: c118fc8
ticket: null
spec: ../SPEC.md
story: 1
context:
  - src/storage/localStore.ts
---

# Story 1 — 存储访问收敛

## Intent

生产代码不再直接调用 `localStorage`，统一走 `src/storage/localStore.ts`；key 与落盘格式不变。

## Implementation Notes

- 入口 API：`readString` / `writeString` / `readJson` / `writeJson` / `removeKey` / `tryReadString`（区分「读不出来」与「没有记录」，只服务墓碑的保守分支）。
- 16 个文件、约 70 处改为调用入口，`grep localStorage.` 在生产代码只剩 `localStore.ts` 一处。
- 兼容要点：JSON 值仍是 `JSON.stringify` 结果、纯字符串键仍走 `writeString`（`imwSettingsRev`、`imwShufflePlatform:*`）；`RequestHistory` 不双重编码；写盘失败仍返回 false 由调用方决定。
- 审查后补：账号存档写失败不再改标题（避免「显示已登录但未落盘」）；`settingsRev()` 读不到时回落 `NaN` 而不是 `0`；`tryReadString`、`writeJson(undefined)`、falsy 合法值补了用例。
- 验证：`tsc` 无告警；`npm test` 71 文件 / 1267 用例全绿（新增 9 条 localStore 用例，未改既有测试）；`npm run build` 通过，436.46 kB / gzip 132.31 kB。

## Review Triage Log

- `tryReadString` 零覆盖：patch，补用例（含 `getItem` 抛错）。
- `writeJson(undefined)` 未测：patch。
- falsy 合法值（0 / false / ""）未断言：patch。
- `settingsRev` 存储不可用时回落 0：patch，改 `NaN`。
- `BiliBiliSettings` 写失败仍报成功：patch，写入成功才更新标题。
- `openShufflePicker` 的异常边界由 try/catch 收窄为布尔判定：记录不修——写链路已全 try，当前无可抛路径；若将来出现，`confirming` 会卡住的隐患记在此处。
- `LocalStorageUtils` 损坏存档提前一次启动弹协议：记录不修。结论修正——旧实现解析失败时只写回默认值、不弹窗，新实现当场弹；**存储不可用（隐私模式）时每次刷新都会重弹一次 TOS + 隐私协议**，这是新行为取代旧行为（旧实现是 `getItem` 直接抛错、初始化中断），不是「结果一致」。
- `SyncSettingsStore` 注释与事实不符：patch。
