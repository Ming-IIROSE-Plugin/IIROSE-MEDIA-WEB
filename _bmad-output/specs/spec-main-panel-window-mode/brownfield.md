# 现状与改动落点

规格的实现参考，行号以 2026-11-06 的 `600225b` 为准。

## 必改

| 位置 | 现状 | 窗口模式下的问题 |
| --- | --- | --- |
| `src/page/MainAppControlLayer.tsx:141-151` | 打开面板时给 `#mainHolder` 加 `hidemainHolder`，并在 body 上挂 `IMCActiveEventHandler` | 聊天区被移出屏幕，页面上的 `mousedown` / `touchstart` 全被拦截；要改成只拦窗口内部的事件 |
| `src/page/MainAppControlLayer.tsx:242` | Esc 不看焦点位置就关闭面板 | 在聊天框按 Esc 会关窗口 |
| `src/page/components/desk/overlayLayers.ts:69` | Esc 在捕获阶段按层关闭，不看焦点位置 | 同上 |
| `src/app.css:421-436` | 容器 `fixed` 全屏，`translateX(100%)` 收起 | 窗口要有自己的几何尺寸，收起时不得挡住页面 |
| `src/page/components/room-deck/RoomDeckDesktop.tsx:51,85` | 视口 ≤900px 时左右栏收窄 | 按视口判断，窄窗口在大屏上不收窄，中栏进度轨被挤没 |
| `src/input-behavior-module/InputPlatformAnalysis.ts:28` | `@` 搜索调用开关切换 | 窗口开着时在聊天框 `@` 会关窗口 |

窗口打开时 `transform: none`，`fixed` 以视口为基准，所以 `OrderMenu`、`SourceMenu` 的定位和遮罩都不用改；菜单开着时点窗口外，这一下只收起菜单。

## 可复用

- `src/media-progress/viewport.ts`：宿站缩放换算（`currentViewportPosition` / `pointerPosition`）。
- `src/media-progress/model.ts:184` 的 `constrainPosition`：收回视口，留 12px 边距。
- `src/page/components/shuffle-picker/useShufflePlacement.ts`：拖动范式——指针捕获、移动过才保存、失焦结束拖动、视口变化只改内存。
- `src/page/components/floating-panel/`：`startsOnControl`、拖动手柄与外框样式；颜色和图标走 `tokens.ts`。
- `src/storage/localStore.ts`：本机键值的唯一入口。

## 设置项落点

- `src/settings/pluginSettings/normalize.ts`、`loadSettings.ts`：新字段的归一化和默认值，非法值回退全屏。
- `src/settings/pluginSettings/PluginSettings.ts`：写盘失败提示「设置保存失败，请重试」，沿用现有写法。
- `src/page/components/settings/SettingsRow.tsx`、`SettingsSwitch.tsx`：设置行。目前没看到灰显属性，可能要新增。

## 验证

jsdom 没有真实布局。几何计算、存档归一化可写单元测试；拖动、缩放、宿站缩放和聊天区可用性要走 `iirose-plugin-verify` 真机验证。
