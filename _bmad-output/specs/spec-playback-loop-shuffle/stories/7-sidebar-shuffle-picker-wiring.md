---
title: '侧栏随机按钮接入选择面板'
type: 'feature'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'f61c89996080c27d3828a98d0a50a5a254814046'
context:
  - '{project-root}/_bmad-output/specs/spec-playback-loop-shuffle/sidebar-controls.md'
  - '{project-root}/_bmad-output/specs/spec-playback-loop-shuffle/shuffle-picker-panel.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 选择面板（story 6）与按选择抽取（story 5）都已就绪，但侧栏「收藏随机」按钮仍是一点即亮，用户在站内没有入口选择范围；手机上也无法用系统返回关闭面板。

**Approach:** 熄灭态点随机改为打开选择面板，确认后刷新随机控制器并点亮（熄灭循环），取消不变；点亮态与待命规则保持现状。面板打开时登记一条浏览历史，系统返回即取消面板，面板以其他方式关闭时撤回这条历史。

## Boundaries & Constraints

**Always:** 行为以 `sidebar-controls.md` 为准——随机不可用时点击只报原因不开面板；熄灭态点击只开面板不改状态；确认时若随机已不可用（换房、断线、收藏清空）则报原因、不点亮；确认点亮前先 `ShuffleController.invalidate()`；亲手确认后若当下即待命，当场提示一次且下次点按直接熄灭（复用现有逻辑）；点亮态点击熄灭，自动转入待命的首次点按只说明；面板已开时再点只聚焦面板；关闭后焦点还给侧栏随机按钮；面板平台取 `platformOf(readPanelFocus(), defaultPage)`。系统返回：打开时 `history.pushState` 一条带插件标记的状态，`popstate` 弹出它即按取消处理；✕/取消/Esc/遮罩/确认关闭时，若当前历史状态仍是本面板标记则 `history.back()` 撤回且不把随之而来的 `popstate` 当作其他操作；重复注入接管只解绑监听、不动历史。历史条目不分视口（桌面浏览器返回同样只关面板），避免按视口分支。`SidebarPlaybackRow` 不直接依赖面板模块：经构造参数注入「点亮前选择」回调，未注入时随机按钮保持直接切换（兼容既有用法与测试）。

**Never:** 不改 `PlaybackMode` 状态机、`ShuffleController` 抽取逻辑与面板视觉；不改循环按钮行为；不拦截或改写宿站自身的 `popstate`/`hashchange` 处理；不新增依赖。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 开面板 | 随机熄灭且可用，点随机 | 打开面板，按钮仍熄灭 | N/A |
| 确认 | 面板中确认 | invalidate → 随机点亮、循环熄灭，焦点回按钮 | N/A |
| 确认即待命 | 他人曲目在播时确认 | 点亮并当场提示一次；再点即熄灭 | N/A |
| 取消 | ✕/取消/Esc/遮罩 | 不点亮、循环原状保持，焦点回按钮 | N/A |
| 循环亮时取消 | 循环点亮，点随机后取消 | 循环保持点亮 | N/A |
| 不可用 | 随机灰化时点击 | 只报原因，不开面板 | N/A |
| 确认时已不可用 | 面板打开期间断线/换房 | 报原因，不点亮 | N/A |
| 重复点击 | 面板已开再点随机 | 不新建面板，聚焦面板 | N/A |
| 点亮态点击 | 随机已亮 | 熄灭，不开面板 | 自动待命首次点按只说明 |
| 系统返回 | 面板打开时按返回 | 等同取消；不触发宿站返回 | N/A |
| 其他方式关闭 | ✕/确认等关闭 | 撤回本面板历史条目，之后再按返回由宿站照常处理 | 历史已被他人改动则不撤回 |
| 未注入回调 | 无选择回调的开关行 | 随机按钮直接切换（旧行为） | N/A |

</frozen-after-approval>

## Code Map

- `src/playback/SidebarPlaybackRow.ts:98-122` -- `activate`：现有可用性、待命说明、`toggle` 与亲手点亮即待命提示；在此加入「熄灭态随机 → 调注入回调」，确认回调里复检可用性后走现有点亮路径。构造参数 `(mode, doc)` 后追加可选 options。
- `src/page/index.tsx:111-130` -- 组合根：`new SidebarPlaybackRow(playback)` 与 `shuffle = new ShuffleController(...)`；在此注入回调，回调内 `openShufflePicker({ platform, returnFocus: 按钮, onConfirm })`，`onConfirm` 里 `shuffle?.invalidate()` 后通知行点亮。注意 `shuffle` 在行之后构造（回调运行时读取即可）。
- `src/page/components/shuffle-picker/openShufflePicker.tsx` -- `openShufflePicker`/`releaseShufflePicker`、`close()`/`cancel()`、单例句柄；在此加历史条目登记、`popstate` 监听与关闭时撤回。
- `src/playback/PanelFocus.ts` -- `platformOf(readPanelFocus(), defaultPage)`。
- 测试：`src/playback/SidebarPlaybackRow.test.ts`（既有随机按钮直接切换用例应在未注入回调时保持通过）、`src/page/components/shuffle-picker/openShufflePicker.test.ts`（jsdom 支持 `history.pushState`/`back` 与 `popstate`）、`src/media-progress/MediaProgress.test.ts`（组合根装配开关行）。

## Tasks & Acceptance

**Execution:**
- [x] `src/playback/SidebarPlaybackRow.ts` -- 可选 `pickShuffle(done)` 注入；熄灭态随机点击调用它，`done()` 时复检可用性后点亮并沿用待命提示 -- CAP-1/CAP-8 时机
- [x] `src/page/index.tsx` -- 注入回调：取平台、开面板、确认时 invalidate 再点亮；焦点还给随机按钮 -- 接线
- [x] `src/page/components/shuffle-picker/openShufflePicker.tsx` -- 历史条目登记 / `popstate` 取消 / 关闭撤回 / 接管只解绑 -- 系统返回
- [x] 单测 -- 覆盖 I/O 矩阵全部行 -- 回归

**Acceptance Criteria:**
- Given 手机真机（宿站移动版或浏览器），when 打开面板后按系统返回，then 面板关闭、页面停留在当前房间；再按一次返回时宿站行为与没装插件时一致。
- Given 改动完成，when 运行 `npm test`、`npm run build`、改动文件 `prettier --check`，then 全部通过。

## Implementation Notes

- 注：面板已由 story 11 改为非模态（无遮罩、点外部不关闭、移动端默认上半部浮动卡片），本文中「遮罩」「贴底抽屉」相关描述以 story 11 与 shuffle-picker-panel.md 为准。

- `SidebarPlaybackRow` 新增可选第三参 `{ pickShuffle(done) }`；`done()` 复检可用性后点亮并沿用亲手点亮即待命提示；已亮时 `done()` 不再 toggle。未注入保持直接切换。
- 组合根注入：取焦点平台开面板，`returnFocus` 为 `#imw-toggle-shuffle`，确认时先 `shuffle.invalidate()` 再 `done()`；平台为 null 时报「当前页面没有收藏」（防竞态）。
- 系统返回：打开 `pushState({ __imwShufflePickerEntry: token })`，popstate 弹出即取消（对齐中也作废保存）；其他方式关闭时仅当当前 state 仍是本面板标记才 `history.back()`，随之而来的 popstate 打标记被所有面板忽略；撤回未落地时新开面板等 popstate（1s 超时）再登记；接管只解绑。
- 真机（子代理，独立 Playwright 资料、测试号无收藏）：控制台入口开面板 → 返回关闭、顶层 URL 不变、仍在房间；取消撤回条目。未做：侧栏确认点亮后的真实点播（需用户同意）、手机真机。
- 风险：宿站 popstate 处理器仍会收到撤回引起的 popstate（规格禁止拦截，实测无可见变化）；顶层页面在面板打开期间压历史时，撤回可能退掉对方条目（只校验 iframe 的 history.state）。
- 审查修补：外来 popstate（新增条目）不再取消面板、历史长度变化时不撤回、超时后保留一次性标记监听（捕获阶段，先于面板监听）、注释更正、测试用例间清理撤回状态、补遮罩/超时/外来条目/bilibili 平台用例；三处保护逐一撤掉均有用例失败。
- 残余风险：若 history.back() 始终不产生 popstate，一次性标记监听会吞掉下一次无关的返回（只影响一次）。
- 验证：`npm test` 551 通过（审查前 546），`npm run build` 通过，改动文件 prettier 通过。

## Spec Change Log

## Review Triage Log

| # | 来源 | 发现 | 判定 | 依据 / 去向 |
|---|------|------|------|------|
| 1 | BH/EC | 任意外来 popstate（如宿站改 hash，会新增条目）被当作返回：面板取消且本面板条目成孤儿 | medium | onPopState 只比对 token；patch：记录压入后的 history.length，长度增长即忽略 |
| 2 | BH/EC | 顶层页面在面板打开期间压历史时，撤回的 back() 退掉对方条目 | medium | 只校验 iframe 的 history.state，而 history.length 为联合会话历史；patch：长度变化则不撤回 |
| 3 | BH/EC/VG | 撤回的 popstate 晚于 1s 超时到达时未打标记，误取消期间新开的面板 | medium | 超时移除了标记监听；patch：超时只放行等待者，保留一次性标记监听 + 测试 |
| 4 | BH | 头注释称接管后新实例能认出旧条目，代码并无此能力 | low | 直接修正注释；接管遗留旧条目为既定设计，写入 companion 已知限制 |
| 5 | BH/EC | index.test 中撤回状态在用例间泄漏 | medium | 假定时器下 1s 兜底不触发，后续面板可能停在等待；patch：afterEach 清理 |
| 6 | BH/EC | 撤回路径缺遮罩用例 | low | 矩阵列出遮罩；patch：并入 it.each |
| 7 | VG | 侧栏接线的平台选择无测试（写死 netease 不报错） | medium | 子代理改写验证所有用例仍通过；patch：bilibili 用例 |
| 8 | VG | 1s 超时兜底无测试 | medium | 同 #3 一并补测试 |
| 9 | VG | 平台为 null 的提示分支无测试 | low | 仅防竞态，defer |
| 10 | BH/EC | 调试入口打开的面板上点侧栏只聚焦，确认不点亮 | low | 仅调试路径可达，驳回 |
| 11 | EC | 撤回尚在排队时用户再按返回会一次退两步 | low | 需毫秒级时序，修复需区分事件来源，驳回 |
| 12 | BH | 「取消」用例未覆盖旧 done 被后续调用 | false | 已取消面板无法再触发 onConfirm，旧 done 不可达 |
| 13 | BH | 确认对齐中按返回，退场动画显示忙碌态 | low | 纯外观，驳回 |
| 14 | EC | 撤回引起的 popstate 宿站处理器仍会收到 | low | 规格禁止拦截宿站处理；真机无可见变化，手机实测再确认 |
| 15 | BH | 契约未写历史机制与已知限制 | medium | 由 bmad-spec 在 shuffle-picker-panel.md 补「系统返回」机制与限制 |

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 构建成功
- `npx prettier --check <改动文件>` -- expected: 通过

**Manual checks (if no CLI):**
- 真机：侧栏点随机开面板、确认点亮、取消不变、返回键关闭；在公开房间确认会触发真实点播，须先征得用户同意再做。
