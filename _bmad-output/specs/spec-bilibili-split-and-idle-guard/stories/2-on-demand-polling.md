---
status: built
route: oneshot
review: quick
lenses_ran:
  - quick
baseline_revision: ee38ed7
ticket: null
spec: ../SPEC.md
story: 2
context:
  - src/media-progress/HostMediaBridge.ts
  - src/page/index.tsx
---

# Story 2 — 媒体轮询按需降频

## Intent

没有人观察时把媒体轮询降到 1 秒，面板打开 / 浮窗打开 / 模式点亮时恢复 250ms。

## Implementation Notes

- `HostMediaBridge` 增加 `activeTags` 引用计数与 `retune()`：标签为空时 1000ms，否则 250ms；间隔不变时不重建定时器。新增 `setActive(tag, on)` 与 `poke()`（事件驱动立即刷新，带防重入）。
- 接线：`MainAppControlLayer` 面板开合 → `setActive("panel")`；`PlaybackMode` 订阅 → `setActive("loop"|"shuffle")`；浮窗的 `ProgressSession` → `setActive("progress")`；面板底条的 `ProgressSession` 传 `readsProgress: false`（它随面板常驻，不能把节奏按在 250ms）。
- 事件补偿：插件自己发报文（`Socket.observe`）与侧栏媒体卡增删后 `poke()`，不必等下一拍。
- 首版实现（完全停表 + 被动订阅 + 事件取样）经审查证伪并回退：宿站不提供媒体事件，停表会让别人点歌、切歌、播放结束、换房、断线全部不被发现；且同一监听器双注册会在面板关闭时被误删、polling 计数不对称会泄漏定时器。
- 验证：`npm test` 70 文件 / 1258 用例全绿；`npm run build` 通过，438.69 kB / gzip 132.49 kB；真机 hook `setInterval` 实测——空闲只有 `[1000]`，打开面板后为 `[1000, 250]`，侧栏两个开关状态正确。

## Review Triage Log

- 零轮询方案：reject，理由见 Implementation Notes。
- 底条 `ProgressSession` 常驻会把节奏永久按在 250ms：patch，新增 `readsProgress` 参数，底条传 false。
- `componentWillUnmount` 不撤 `"panel"` 标记、会话后到时状态不重放：patch，卸载时 `setPanelOpen(false)`，并订阅 `subscribeMediaSession` 重放当前开合状态。
- 同名 tag 被两个会话共用、重复 dispose 误删：patch，浮窗与底条改为不同语义（底条不计活跃）。
- `poke()` 在 `Socket.observe` 里可能重入 `emit`：patch，加 `poking` 闸。
- `dispose()` 不清 `activeTags`：patch。
- `polling.test.ts` 的原「退订后停表」用例无断言：patch，补成「停表 + 重新订阅按当前标记起表」。
- 测试契约一处变更：`HostMediaBridge.test.ts` 的周期性 `installHooks` 用例由 250ms 改为 1000ms（该用例直接订阅、没有活跃标签）。
