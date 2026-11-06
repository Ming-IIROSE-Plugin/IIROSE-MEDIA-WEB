---
ticket: 1
title: 窗口模式
type: feature
status: done
baseline_revision: 600225b
route: oneshot
review: quick
lenses_ran:
- quick
context:
- AGENTS.md
---
# Story 1 — 窗口模式

## Intent

给主面板加可选窗口模式：可拖动、八向缩放、记住矩形，视口放不下自动全屏；开合有动画，标题栏只留一个收起入口。

## Implementation Notes

- 新增 `src/page/components/panel-window/`：`geometry`（纯函数）、`PanelWindowPlacement`（存档 `imwPanelWindowRect`、视口监听、手势并命令式写容器 `style`）、`PanelWindowChrome`（标题栏与八个抓取区）。
- 开合与窗口态在 `src/listener/panelPresence.ts`；body 拦截只在全屏态。
- 键盘弹起与触屏下窗口保持稳定（`9d8d01e`）。
- 开合动画与单一关闭入口（`695db96`）。

## Commits

- 0498428 feat: add an optional window mode for the main panel
- 9d8d01e fix: keep the window panel stable on keyboards and touch
- 695db96 feat: animate the window panel and keep one close button

## Verification

- 事后登记：实现与验证发生在登记之前；每项都在真站实测过（窗口 / 全屏 / 手机尺寸，真实鼠标与 CDP 触摸），凭据只在 `.secrets/`。
- `npm test` 与 `npm run build` 通过；审查见 story 6。
