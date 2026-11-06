---
ticket: 6
title: 审查收口与真站回归脚本
type: feature
status: done
baseline_revision: 551fdaf
route: oneshot
review: quick
lenses_ran:
- quick
context:
- AGENTS.md
---
# Story 6 — 审查收口与真站回归脚本

## Intent

对上面五张票的实现做一轮独立审查（4 个审查者），修掉核实成立的问题，并把真站手感验证沉淀成仓库里可重跑的脚本。

## Implementation Notes

- 审查：`bmad-code-review`（blind / edge-case / verification-gap / intent-alignment），14 条排除，5 条补丁，1 条决策不改。
- 修复：存储写失败时内存兜底（`unsavedDock`）、`justDragged` 100ms 自动清除、一条永不失败的测试断言、一处过时注释。
- 新增 `scripts/verify/dock.mjs`：跟手、贴边收起 / 展开、侧栏裁剪、手机尺寸四类共 6 项，全部量 `getBoundingClientRect`。
- 不改：关闭动画飞向未收起的胶囊位置（偏差很小，改它要把 CSS 偏移搬进 TS）。

## Commits

- e2a230e fix: keep the dragged pill when storage is blocked and add a real-site dock check

## Verification

- 事后登记：实现与验证发生在登记之前；每项都在真站实测过（窗口 / 全屏 / 手机尺寸，真实鼠标与 CDP 触摸），凭据只在 `.secrets/`。
- `npm test` 与 `npm run build` 通过；审查见 story 6。
