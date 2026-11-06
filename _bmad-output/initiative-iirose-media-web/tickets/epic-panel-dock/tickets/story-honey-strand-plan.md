---
ticket: 5
title: 蜂蜜拉丝与手机放大
type: feature
status: done
baseline_revision: e70ae8c
route: oneshot
review: quick
lenses_ran:
- quick
context:
- AGENTS.md
---
# Story 5 — 蜂蜜拉丝与手机放大

## Intent

贴边的胶囊被拉出时，边与胶囊之间拉出一根蜂蜜般的丝，56px 内断开；胶囊始终 1:1 跟手，没有阻尼或追赶；手机上胶囊更大。

## Implementation Notes

- 几何在 `dockLiquid.ts`；颈和胶囊同色，投影统一放外层 `filter: drop-shadow`。
- 被维护者否决过：橡皮筋 / 阻尼式粘连（手感滞后）；最终方案是形状上的粘连、位置 1:1。
- 滞后根因是落定过渡 `left/top` 在断开时仍开着，拆成 `scale` / `place` 两种落定，拖动中关过渡。
- 测试读 `style.left` 看不出此类滞后，已写入 AGENTS.md：验证要量 `getBoundingClientRect`。
- 手机 / 粗指针 52px 高（`DOCK_NOMINAL_SIZE_LARGE` 110×54）。

## Commits

- 1c0b614 feat: make the docked pill stick to edges like liquid
- 7e643af fix: fade the pill label while it is tucked in
- 71e9d04 fix: make the pill track the pointer with a honey-like strand
- d25b3a3 docs: note how automation reaches the real chat input
- 376d714 fix: stop the pill lagging when pulled free and enlarge it on phones

## Verification

- 事后登记：实现与验证发生在登记之前；每项都在真站实测过（窗口 / 全屏 / 手机尺寸，真实鼠标与 CDP 触摸），凭据只在 `.secrets/`。
- `npm test` 与 `npm run build` 通过；审查见 story 6。
