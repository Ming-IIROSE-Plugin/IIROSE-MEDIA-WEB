---
title: '选择面板可拖动并记住位置'
type: 'feature'
created: '2026-10-27'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '769e4481dd8cea91ddfb16ef54fdd7bfc9ffb4d7'
context:
  - '{project-root}/_bmad-output/specs/spec-playback-loop-shuffle/shuffle-picker-panel.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 随机选择面板固定在桌面居中、移动贴底，会挡住用户想看的聊天内容，且每次打开都回到原处。

**Approach:** 面板头部作为拖动手柄，拖到哪里就停在哪里；松手把位置存进本机，刷新或再次打开时恢复，并始终约束在视口内。拖动约束与 iirose 缩放换算复用播放进度浮窗的现有实现。

## Boundaries & Constraints

**Always:** 手柄 = 头部（图标、标题、空白处）与移动端顶部拖拽条；关闭钮、平台标签、搜索框等可交互元素按下不触发拖动；`touch-none` 只在手柄上，列表滚动不受影响；拖动用指针事件 + `setPointerCapture`，中途失焦/`pointercancel` 结束拖动；常态 `cursor-grab`、拖动中 `cursor-grabbing`；松手保存 `{x,y}` 到 `localStorage` 键 `imwShufflePickerPosition`（不分账号），读写异常忽略、非法值按无记录；位置与尺寸约束复用 `constrainPosition`（四边 12px）与播放进度浮窗的视口缩放换算（宿站对 iframe 的 zoom），打开时、窗口 `resize` 时把位置收回视口内；无已存位置时保持现有默认摆放（桌面居中、移动贴底抽屉）；有已存位置时移动端也作浮动卡片（宽度 ≤ 视口 − 24px，保留圆角与底边框），入场改为淡入 + `scale-95→100`，`prefers-reduced-motion` 只淡入；面板其余行为（焦点、Esc/返回、确认取消、标签）不变。

**Never:** 不改播放进度浮窗的行为与存储键；不做缩放/改尺寸；不新增依赖；不新增 SCSS。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 首次打开 | 无已存位置 | 桌面居中、移动贴底（与现状一致） | N/A |
| 拖动 | 按住头部空白处拖动 | 面板跟随指针移动，松手保存位置 | N/A |
| 刷新恢复 | 已存位置后刷新再打开 | 面板出现在已存位置 | N/A |
| 越界约束 | 拖向视口外 / 已存位置超出当前视口 | 停在距边 12px 内 | N/A |
| 视口变化 | 打开期间缩小窗口或旋转手机 | 面板收回视口内 | N/A |
| 按钮不拖 | 在关闭钮、标签、搜索框按下拖动 | 不移动，按钮照常工作 | N/A |
| 列表滚动 | 手机上在列表区上下滑 | 列表滚动，面板不移动 | N/A |
| 存储异常 | 已存值非法 / `localStorage` 抛错 | 按无记录摆放，拖动照常，只是不保存 | 不抛错 |
| 中断 | 拖动中窗口失焦或 `pointercancel` | 结束拖动，面板停在当前位置 | N/A |

</frozen-after-approval>

## Code Map

- `src/page/components/shuffle-picker/ShufflePicker.tsx:588,606` -- 遮罩用 `flex items-center justify-center`（移动 `items-end`）定位卡片；改为有已存位置时 `position: fixed` + `left/top`；头部元素在此文件内（拖拽条、标题行），给它们挂指针事件。
- `src/page/components/media-progress/MediaProgress.tsx:23-60,106-118,148-175,240-290` -- `viewportMetrics`、`currentViewportPosition`、`resize`/`scroll` 收回逻辑、头部拖动的指针事件写法；把 `viewportMetrics` 与视口偏移换算抽到共享模块（如 `src/media-progress/viewport.ts`）后两处复用，进度浮窗行为不得改变。
- `src/media-progress/model.ts:181` -- `constrainPosition`（直接复用）。
- `src/media-progress/PositionStorage.ts` -- 存取写法参照；新建 `src/page/components/shuffle-picker/pickerPosition.ts`（键 `imwShufflePickerPosition`），或把现有函数泛化为按键存取（进度浮窗的键与格式不变）。
- 测试：`openShufflePicker.test.ts`（`.test.ts` 内用 `act` 派发 `pointerdown/move/up`）、新增存取单测；`src/media-progress/MediaProgress.test.ts` 须保持通过以证明进度浮窗未受影响。

## Tasks & Acceptance

**Execution:**
- [x] 共享视口换算 -- 从 `MediaProgress.tsx` 抽出 `viewportMetrics` 与偏移换算，进度浮窗改为引用 -- 复用
- [x] `src/page/components/shuffle-picker/pickerPosition.ts` -- 位置存取（含非法值与异常兜底） -- 记忆
- [x] `ShufflePicker.tsx` -- 头部拖动、定位模式切换、打开与 `resize` 时约束、入场动效调整 -- CAP-13
- [x] 单测 -- 覆盖 I/O 矩阵全部行 -- 回归

**Acceptance Criteria:**
- Given 真站 400×800 与 1280×720，when 拖动面板后刷新再打开，then 面板在原位置且完整可见；在列表区滑动只滚动列表。
- Given 改动完成，when 运行 `npm test`、`npm run build`、改动文件 `prettier --check`，then 全部通过（含既有 `MediaProgress.test.ts`）。

## Implementation Notes

- 注：面板已由 story 11 改为非模态（无遮罩、点外部不关闭、移动端默认上半部浮动卡片），本文中「遮罩」「贴底抽屉」相关描述以 story 11 与 shuffle-picker-panel.md 为准。

- 视口换算抽到 `src/media-progress/viewport.ts`，进度浮窗与面板共用；`PositionStorage.ts` 泛化为按键存取（进度浮窗键与格式不变），面板经 `pickerPosition.ts` 存 `imwShufflePickerPosition`。
- 缩放比例在遮罩（无 transform）上实测，避免面板入场 `scale-95` 让比例失真。
- 从默认摆放起拖：按下即取面板 `getBoundingClientRect` 经缩放换算为起点，并立即切成浮动卡片（停在原视觉位置，首次移动再约束），手指下不跳；未移动就松手退回默认摆放。
- 只有移动过的拖动才保存，所有结束路径（松手、`pointercancel`、失焦、丢失捕获、面板退场）一致；点按不覆盖存储。打开/视口变化/滚动/面板尺寸变化时的约束只改显示，不写存储。
- 视口 `resize`/`scroll` 只收回位置，不打断拖动（移动端键盘、地址栏伸缩）；面板退场时结束拖动，之后指针事件忽略。
- 浮动卡片在移动端保留 `pb-[env(safe-area-inset-bottom)]`。

- 审查后主会话真机复核（400×800）：从贴底抽屉拖动标题上移 → 变为浮动卡片 (12, 288, 376×352) 并保存；刷新重新注入后打开，面板恢复在 (12, 288)；单实例；测试位置已清除。
- 验证：`npm test` 643 通过，`npm run build` 通过，改动文件 prettier 通过。

## Spec Change Log

## Review Triage Log

| # | 来源 | 发现 | 判定 | 依据 / 去向 |
|---|------|------|------|------|
| 1 | BH/EC | pointercancel/失焦/丢失捕获/resize 结束的拖动不保存；无移动的轻点会把内存中被约束的位置写回存储 | medium | 只有 pointerup 保存；patch：moved 标记 + 各结束路径保存 |
| 2 | BH | 视口 resize（手机键盘收起、地址栏折叠）即中断拖动 | medium | patch：resize 只重新约束不取消；补 scroll 监听 |
| 3 | BH/EC | 从默认抽屉首次拖动时宽度切换且忽略入场位移，面板在手指下跳动 | medium | 用户主要用手机；patch：按下即切浮动、起点取实际矩形 |
| 4 | EC | 拖动中退出（Esc/返回/确认）仍移动并可能保存 | low | 直接修正；patch |
| 5 | BH | 浮动卡片在移动端丢失安全区底部内边距 | low | 直接修正；patch |
| 6 | VG/BH | 面板的宿站缩放换算从未在非 1 比例下测试 | medium | patch：1.15 比例用例 |
| 7 | VG | 面板自身尺寸变化的 ResizeObserver 收回路径未测试 | medium | patch：补用例 |
| 8 | BH/EC | fixed 定位与文档滚动偏移混用 | low | 与播放进度浮窗同源的既有换算，宿站 iframe 文档不滚动；defer |
| 9 | EC/BH | 无法恢复默认摆放、无键盘移动方式 | low | 超出本 story 意图；交用户决定是否加「双击头部复位」 |
| 10 | BH | 拖动逻辑只共享了视口换算，其余仍两份 | low | 重构范围，驳回 |
| 11 | BH | 每次移动重复测量视口 | low | 性能可忽略，驳回 |
| 12 | 实现子代理 | 在面板搜索框/关闭钮上按住拖动会弹出宿站房间菜单 | low | 基线提交同样存在（指针事件冒泡到宿站），defer |

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 构建成功
- `npx prettier --check <改动文件>` -- expected: 通过

**Manual checks (if no CLI):**
- 真站两种视口：拖动头部、刷新后恢复、拖到边缘被挡住、在按钮上按下不拖、列表可滚动。
