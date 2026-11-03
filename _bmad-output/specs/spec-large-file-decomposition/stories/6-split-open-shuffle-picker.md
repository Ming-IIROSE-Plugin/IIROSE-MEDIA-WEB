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
---

# Story 6 — 拆分 openShufflePicker（补做）

## Intent

`openShufflePicker.tsx` 411 行，虽不在原四个目标文件内，但同样超过 400 行阈值；把宿站接线（单例、返回键包装、焦点判定）抽出去。

## Implementation Notes

- 新增 `shufflePickerHost.ts`（84 行）：`SHUFFLE_PICKER_ROOT_ID`、`PickerHandle`、`PICKER_KEY`/`PickerWindow`、`BACK_SLOT_KEY`/`BackWindow`、`ensureBackHook`、`releaseShufflePicker`、`canRestoreFocus`。
- 主文件 411 → 356 行，保留 `releaseShufflePicker` 与 `SHUFFLE_PICKER_ROOT_ID` 的再导出，`src/page/index.tsx` 与测试的导入路径不变。
- 验证：`tsc` 无告警；`npm test` 69 文件 / 1253 用例全绿；`npm run build` 通过，437.25 kB / gzip 131.99 kB（与拆分前一致）。
