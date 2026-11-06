---
ticket: 2
title: 最小化为输入框上方的胶囊
type: feature
status: done
baseline_revision: 695db96
route: oneshot
review: quick
lenses_ran:
- quick
context:
- AGENTS.md
---
# Story 2 — 最小化为输入框上方的胶囊

## Intent

窗口标题栏加最小化钮；最小化时窗口缩向输入框并隐藏，输入框左上方留下一个可还原的胶囊。

## Implementation Notes

- 新增 `PanelDock.tsx` 与 `dockPlacement.ts`：body 独立根 `#imw-panel-dock-root`，500ms 轮询加视口事件跟随 `#moveinputDisplay`。
- 开合动画改为容器收起态的 `translate`（`--imw-dock-x/y`）加 `scale: 0.2`，打开停稳后都是 `none`。
- `viewportMetrics` 除掉元素自身 `scale`（否则收起的窗口会把视口算大 5 倍）。
- 胶囊按用户要求改到输入框左侧（`ae03cff`）。

## Commits

- 0272a62 feat: minimize the window panel above the chat input
- ae03cff fix: dock the minimized panel pill on the left of the chat input

## Verification

- 事后登记：实现与验证发生在登记之前；每项都在真站实测过（窗口 / 全屏 / 手机尺寸，真实鼠标与 CDP 触摸），凭据只在 `.secrets/`。
- `npm test` 与 `npm run build` 通过；审查见 story 6。
