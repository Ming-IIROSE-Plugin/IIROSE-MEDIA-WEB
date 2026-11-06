---
ticket: 11
title: 选择面板非模态化
type: feature
created: '2026-10-27'
status: done
baseline_revision: af282bec6f941756851f9f3c9da1d17ef8d8ccfd
route: dispatch
review_loop_iteration: 0
context:
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-playback-loop-shuffle/shuffle-picker-panel.md'
---
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 选择面板是模态的：全屏遮罩挡住聊天室，点面板外就关闭（用户感觉像「返回」），打开期间不能回复消息或操作宿站。

**Approach:** 把面板改成非模态浮动工具窗：去掉遮罩与点外部取消，面板外的点击、输入、滚动全部交给宿站；不锁 Tab，Esc 只在焦点位于面板内时关闭；手机首次打开（无已存位置）时面板停在上半部，不挡底部聊天输入栏。

## Boundaries & Constraints

**Always:** 根节点与定位容器不拦截面板外的指针事件（`pointer-events: none`，面板自身 `auto`），无遮罩底色；关闭方式只剩 ✕、取消、确认、Esc（事件目标在面板内）、系统返回（`Utils.backward` 接管保持不变）；去掉 `aria-modal` 与 Tab 循环陷阱，保留 `role="dialog"` 与 `aria-labelledby`；打开时焦点照旧进面板（桌面到搜索框、移动端不自动聚焦），关闭时仅当焦点仍在面板内才还给侧栏按钮，焦点已在宿站元素上则不抢回；拖动所需的视口缩放换算改为在面板根（或 `document.documentElement`）上测量，不能依赖已删除的遮罩元素；无已存位置时桌面仍居中，移动端（`max-[768px]`）改为浮动卡片停在视口上半部（距顶 12px 起、宽度 ≤ 视口 − 24px），有已存位置照旧；面板内的键盘事件不冒泡触发插件主面板的全局热键（如 Esc 关闭主面板）。

**Never:** 不改系统返回机制、拖动与位置记忆、平台标签与选择逻辑；不新增依赖；不新增 SCSS。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 点外部 | 面板打开，点聊天区空白处 | 面板保持打开，宿站照常响应 | N/A |
| 操作宿站 | 面板打开，点宿站输入框输入并发送 | 输入与发送正常，面板保持打开 | N/A |
| 滚动聊天 | 面板打开，在面板外滚轮/滑动 | 聊天区滚动，面板不动 | N/A |
| 关闭方式 | ✕ / 取消 / 确认 / 面板内 Esc / 系统返回 | 关闭（确认另行保存并点亮） | N/A |
| 外部 Esc | 焦点在宿站输入框按 Esc | 面板不关闭 | N/A |
| Tab 离开 | 焦点在面板最后一个元素按 Tab | 焦点离开面板到宿站 | N/A |
| 焦点归还 | 关闭时焦点在面板内 / 在宿站输入框 | 前者还给侧栏按钮；后者不动 | N/A |
| 手机首开 | 400×800、无已存位置 | 卡片在上半部，底部输入栏可见可点 | N/A |
| 拖动 | 去掉遮罩后拖动头部 | 行为与之前一致（含宿站缩放） | N/A |

</frozen-after-approval>

## Code Map

- `src/page/components/shuffle-picker/ShufflePicker.tsx:774-795` -- 遮罩 `div`（`ref={backdrop}`，`fixed inset-0 … bg-black/55|40 … max-[768px]:items-end`，点击取消）与对话框（`aria-modal="true"`）；改为不拦截指针、无底色、无点击取消，移动端默认摆放改为上半部浮动卡片。
- `ShufflePicker.tsx:285,661-690` -- `FOCUSABLE` 与 `onKeyDown` 的 Esc + Tab 循环陷阱；去掉 Tab 陷阱，Esc 保留（面板内触发）并 `stopPropagation`。
- `ShufflePicker.tsx:336,531,566,607-640` -- `backdrop` ref 被拖动与视口约束用于测量宿站缩放；改为在不受入场 `scale` 影响的元素上测量（根节点容器或 `document.documentElement`）。
- `src/page/components/shuffle-picker/openShufflePicker.tsx` -- `close()` 里的焦点归还（`canRestoreFocus(returnFocus)`）：仅当 `document.activeElement` 在面板内或为 `body` 时归还。
- `src/page/MainAppControlLayer.tsx:63,190` -- 插件主面板的 window 级 `keydown`（Esc）；确认面板内 Esc 不会同时关主面板。
- 测试：`openShufflePicker.test.ts` 中依赖遮罩取消、Tab 循环、`aria-modal` 的用例按新规则改写；拖动用例的缩放测量改到新元素。

## Tasks & Acceptance

**Execution:**
- [x] `ShufflePicker.tsx` -- 去遮罩与外部取消、去 Tab 陷阱与 `aria-modal`、Esc 限面板内、移动端默认上半部、缩放测量改元素 -- CAP-14
- [x] `openShufflePicker.tsx` -- 焦点归还条件 -- CAP-14
- [x] 单测 -- 覆盖 I/O 矩阵全部行，改写旧用例 -- 回归

**Acceptance Criteria:**
- Given 真站 400×800 与 1280×720 在房间内，when 面板打开后点聊天区、在宿站输入框打字，then 面板不关闭且宿站输入正常；手机首开时底部输入栏未被遮挡。
- Given 改动完成，when 运行 `npm test`、`npm run build`、改动文件 `prettier --check`，then 全部通过。

## Implementation Notes

- 遮罩元素改为定位层（`fixed inset-0 pointer-events-none`、无底色、无 transform、无点击处理），仍作为宿站缩放的测量元素（`layer` ref）；面板自身 `pointer-events-auto`，退场中 `pointer-events-none`。
- 面板 `onKeyDown` 对所有按键 `stopPropagation`（不只 Esc），面板内的 Alt+S 等也不会触发主面板全局热键；Esc 仅在面板内触发关闭，Tab 循环与 `FOCUSABLE` 删除。
- 移动端默认摆放：定位层 `max-[768px]:items-start`，卡片 `max-[768px]:mt-3 w-[calc(100%-24px)] max-h-[60%] origin-top`，入场与浮动卡片相同（淡入 + scale-95→100），不再有贴底抽屉与 `translate-y-full`；浮动卡片（有已存位置）类名不变。
- 焦点归还：根节点上 focusin/focusout 跟踪焦点最后是否在面板内（打开时记为在内；focusout 到面板外元素、或在面板外按下指针记为在外），`close()` 只在最后在面板内时还给打开者——点过聊天区空白（焦点落 body）后系统返回不再抢焦点。
- 面板 `touchstart/touchmove/touchend` 只 `stopPropagation`（不 preventDefault），主面板 window 级双指手势不被面板上的触摸触发；指针拖动不受影响。
- 移动端默认卡片顶距改为 `max-[768px]:mt-[max(12px,env(safe-area-inset-top))]`，兼顾顶部安全区。
- 「操作宿站」「滚动聊天」「外部 Esc」三行在 jsdom 无命中测试、旧代码也能通过，不设单测，由真站运行验证覆盖。

- 审查后主会话真机复核（400×800）：首开面板位于 (12,12,376×352)，底部输入栏未遮挡；面板下方 elementFromPoint 命中宿站元素而非插件图层；无 aria-modal；单实例。
- 验证：`npm test` 645 通过，`npm run build` 通过，改动文件 prettier 通过。

## Spec Change Log

## Review Triage Log

| # | 来源 | 发现 | 判定 | 依据 / 去向 |
|---|------|------|------|------|
| 1 | BH/EC | 焦点在 body（点了聊天空白处）时系统返回仍把焦点抢回侧栏按钮 | low | `focusInPanel` 把 body 算作面板内；patch：用 focusin/focusout 记录最后焦点 |
| 2 | BH/VG/EC | 「操作宿站」「滚动聊天」「外部 Esc」用例在旧模态代码上也能通过；「焦点在宿站时点 ✕」路径在真浏览器不可达 | medium | VG 换回旧代码实跑确认；patch：删除空用例，改测系统返回路径；真实穿透由真站验证 |
| 3 | BH | 面板上的触摸仍冒泡到主面板的双指手势 | low | 非模态后面板浮在可用页面上；patch：面板内 touch 事件不冒泡 |
| 4 | BH | 移动端顶部默认位置未考虑顶部安全区 | low | 直接修正；patch |
| 5 | BH | story 文件未记录真站验证 | low | 实现子代理已在「与世隔绝」房间实测两种视口，补记入 Implementation Notes |
| 6 | BH | story 7/10 与 stories.yaml 仍描述遮罩/贴底抽屉 | low | 已在相应文件补「由 story 11 取代」注记 |
| 7 | EC | 面板打开期间点了循环再确认，随机覆盖循环 | false | 确认即用户明确选择随机，互斥熄灭循环是既定语义 |
| 8 | EC | 面板 z-index 高于主面板与宿站弹窗 | maybe-false | 需实测宿站弹窗层级；defer |
| 9 | EC | 旧存位置偏低时仍会挡住输入栏 | low | 用户可拖开，驳回 |
| 10 | BH | 退场期间指针穿透/重复回调无测试 | false | `close()` 由 `handle.closing` 保证只执行一次 |
| 11 | BH | 面板已开时再点侧栏按钮现在可达但无测试 | false | story 6 已有「重复打开：不新建，焦点移回面板」用例 |
| 12 | BH | EXIT_MS 与退场时长两个常量可能漂移 | low | 驳回 |

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 构建成功
- `npx prettier --check <改动文件>` -- expected: 通过
