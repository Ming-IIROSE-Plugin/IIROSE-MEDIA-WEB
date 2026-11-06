---
ticket: 4
title: 边缘吸附与收起
type: feature
status: done
baseline_revision: bdd78be
route: oneshot
review: quick
lenses_ran:
- quick
context:
- AGENTS.md
---
# Story 4 — 边缘吸附与收起

## Intent

胶囊松手时离可停靠范围边缘不到 24px 就吸附并收起：左右滑出只露图标，上下缩成圆钮，悬停 / 按住 / 聚焦展开，触屏也收起；宿站侧栏打开时仍被裁住。

## Implementation Notes

- `snapDockEdge` / `pinToEdge` / `clampDockPoint`（`dockPlacement.ts`）；存档带 `edge`；`app.css` 的 `data-imw-dock-edge` 规则负责收起。
- `dockSize` 按展开宽度算范围，避免收起后 `offsetWidth` 变小导致误夹。
- 侧栏：层 `overflow-hidden`，`readAnchor` 减去 `body.getBoundingClientRect()` 的偏移（`7ff089d`）。
- 手机收起时标签 `opacity: 0`，避免露出半个字。

## Commits

- 5480dbf feat: tuck the pill into the screen edge and peek out on hover
- 3aeeca0 feat: shrink the pill to an icon button on the top and bottom edges
- 7ff089d fix: keep the tucked pill clipped when the host sidebar opens

## Verification

- 事后登记：实现与验证发生在登记之前；每项都在真站实测过（窗口 / 全屏 / 手机尺寸，真实鼠标与 CDP 触摸），凭据只在 `.secrets/`。
- `npm test` 与 `npm run build` 通过；审查见 story 6。
