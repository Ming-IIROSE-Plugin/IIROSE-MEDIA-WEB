---
status: built
route: oneshot
review: quick
lenses_ran:
  - quick
baseline_revision: 713a520
ticket: null
spec: ../SPEC.md
story: 6
context:
  - src/page/components/shuffle-picker/openShufflePicker.tsx
  - src/page/components/shuffle-picker/shufflePickerHost.ts
---

# Story 6 — 拆分 openShufflePicker（补做）

## Intent

`openShufflePicker.tsx` 411 行，不在原四个目标文件内（CAP-1 只约束那四个），属于自愿扩展：把宿站接线（单例、返回键包装、焦点判定）抽出去。注意这不是全局阈值——同一次交付里仍有 5 个文件 >400 行，按全局口径 CAP-1 不通过。

## Implementation Notes

- 新增 `shufflePickerHost.ts`（实测 74 行）：`SHUFFLE_PICKER_ROOT_ID`、`PickerHandle`、`PICKER_KEY`/`PickerWindow`、`BACK_SLOT_KEY`/`BackWindow`、`ensureBackHook`、`releaseShufflePicker`、`canRestoreFocus`。
- 主文件 411 → 356 行，保留 `releaseShufflePicker` 与 `SHUFFLE_PICKER_ROOT_ID` 的再导出，`src/page/index.tsx` 与测试的导入路径不变。
- 验证：`tsc` 无告警；`npm test` 69 文件 / 1253 用例全绿；`npm run build` 通过，437.25 kB / gzip 131.99 kB（与拆分前一致）。

## Review Triage Log

（复盘补记）本 story 交付时没有跑审查，`review: quick` 与 `lenses_ran` 是抄自前序 story。复盘时核对：

- 抽出的是纯宿站接线（`PICKER_KEY` 单例、`Utils.backward` 包装、`canRestoreFocus`），不读组件状态，行为与原实现逐行一致。
- `releaseShufflePicker` / `SHUFFLE_PICKER_ROOT_ID` 仍在原路径再导出，`openShufflePicker.tsx` 的调用点与 `openShufflePicker.test.ts` 均未改动。
- 未新增循环依赖：`shufflePickerHost.ts` 只依赖 `document` / `window`。
