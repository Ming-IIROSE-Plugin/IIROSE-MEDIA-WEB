---
ticket: 3
title: 常驻胶囊：拖动、记住位置、全屏原地展开
type: feature
status: done
baseline_revision: ae03cff
route: oneshot
review: quick
lenses_ran:
- quick
context:
- AGENTS.md
---
# Story 3 — 常驻胶囊：拖动、记住位置、全屏原地展开

## Intent

胶囊在面板没开着的任何形态下常驻，可自由拖动并记住位置（不能进输入框）；面板上去掉 X 只留最小化；全屏从胶囊原地展开、不再推走宿站聊天区。

## Implementation Notes

- 存档键 `imwPanelDockPosition`，松手才写盘；底缘不能越过输入框顶边。
- `MainAppControlLayer.syncDock()` 在 `!mainAppDisplay` 时挂载胶囊；点胶囊走 `ShowHideMainApp`，首次点击才初始化 `MainApp`。
- 全屏页头的 X 换成最小化；`hidemainHolder` 与相关样式删除。
- Esc 在面板关着时直接返回。

## Commits

- 70461e6 feat: let the minimized pill be dragged and remember its position
- bdd78be feat: keep the pill while window mode is on and drop the close buttons
- e70ae8c feat: show the pill in full mode and open in place from it

## Verification

- 事后登记：实现与验证发生在登记之前；每项都在真站实测过（窗口 / 全屏 / 手机尺寸，真实鼠标与 CDP 触摸），凭据只在 `.secrets/`。
- `npm test` 与 `npm run build` 通过；审查见 story 6。
