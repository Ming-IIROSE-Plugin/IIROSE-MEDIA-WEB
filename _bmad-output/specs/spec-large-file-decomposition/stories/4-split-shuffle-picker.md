---
status: built
route: oneshot
review: quick
lenses_ran:
  - quick
baseline_revision: 81ee86c
ticket: null
spec: ../SPEC.md
story: 4
context:
  - src/page/components/shuffle-picker/ShufflePicker.tsx
---

# Story 4 — 拆分 ShufflePicker

## Intent

把 1068 行的随机选择面板拆成外壳、列表、工具栏、拖拽定位与数据接线，每个文件 ≤400 行，`openShufflePicker` / `releaseShufflePicker` 与 `ShufflePicker` 的 props 不变。

## Implementation Notes

- `ShufflePicker.tsx` 340 行；新增 `PickerList.tsx` 260、`PickerToolbar.tsx` 145、`PickerRowParts.tsx` 86、`pickerChrome.tsx` 79、`useShufflePlacement.ts` 198、`usePickerTabs.ts` 213。
- 拖动与定位仍复用既有 `pickerPosition.ts`，未复制逻辑；分批渲染与 `trackLoader` 缓存语义未动；`openShufflePicker.tsx`（411 行，改动前已超 400）不在本 story 范围，未动。
- 审查后补注释：把「拖动手柄里按下这些元素不触发拖动」的悬空说明删除（其描述的 `dragHandle` 已整体搬走），恢复「焦点交给面板，否则 Esc 与 Tab 循环会掉到 body」的完整理由，并在 `PickerList` 的空合集判定旁注明与父组件 `empty()` 需同步。
- 验证：`tsc` 无告警；`npm test` 69 文件 / 1253 用例全绿（未改测试）；`npm run build` 通过，444.78 kB / **gzip 134.25 kB**。

## Review Triage Log

- 无行为差异：逐行集合比对未发现逻辑/JSX/文案丢失；hook 调用顺序、effect 顺序、拖动与退场监听、key 与类名均与原文件一致。
- 三条结构提醒已处理或记录：焦点交接约定移到父组件（已补完整注释）、空合集判定跨文件重复（已加同步注释）、悬空注释（已删）。
- **CAP-3 偏差**：vite 报表口径 gzip 134.25 kB，超 134 上限 0.25 kB；`gzip -9` 实测 133,431 B（133.43 kB）。差额来自拆分本身（跨模块 props 与解构键名），继续压需要牺牲可读性，未做；记录为已知偏差。
