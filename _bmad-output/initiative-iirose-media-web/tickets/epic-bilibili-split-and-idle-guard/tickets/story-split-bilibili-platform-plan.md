---
ticket: 1
title: 拆分 BilibiliPlatform
type: refactor
status: done
baseline_revision: eb59dba
route: oneshot
review: quick
lenses_ran:
- quick
context:
- src/platforms/BilibiliPlatform.ts
---
# Story 1 — 拆分 BilibiliPlatform

## Intent

把 782 行的平台类按用途拆开，每个文件 ≤400 行；公开静态方法签名与调用点不变。

## Implementation Notes

- 主文件 116 行（类 + 薄委托）；新增 `src/platforms/bilibili/`：`shared` 45、`search` 164、`pages` 127、`playback` 267、`episodes` 234。
- spy 兼容：`playBiliPage` / `prepareAndSendMedia` 留在类上；`vodDeps()` 在调用时现取类成员，`selectEpisodes` 改为接收 `() => playBiliPage` 并在确认那一刻取。
- 审查后修正：`selectEpisodes` 原先把 `playBiliPage` 在打开面板时快照，改为确认时现取；删除 `playBiliPage` 上失效的「弹出选择框」注释；`getStreamPlatform` 不再导出。
- 测试守卫扩展（加强，非放宽）：`BilibiliPlatform.test.ts` 的 `?raw` 源码检查原先只扫主文件，拆分后会把 `buildSelect2` 等回归守卫漏掉；现扫主文件 + 5 个子模块。
- 验证：`tsc` 无告警；`npm test` 69 文件 / 1253 用例全绿；`npm run build` 通过，437.63 kB / gzip 132.15 kB。

## Review Triage Log

- `selectEpisodes` 提前快照 `playBiliPage`：patch，改为确认时现取。
- `vodDeps()` 在 VOD 入口快照发送点：记录不修——现有测试都在调用前装 spy，只有「VOD 中途替换」窗口被收窄，属可接受。
- `?raw` 守卫只覆盖主文件：patch，扩展为 6 个文件（测试是加强而非放宽）。
- `splitByPage` 与网易云同名工具重复：记录不修——跨平台目录复用会把两个平台耦在一起，收益不足。
- `getStreamPlatform` 无谓导出、`playBiliPage` 失效注释：patch。
