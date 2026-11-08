---
title: '点歌台入口：胶囊和双指下滑可在设置里选'
type: 'feature'
ticket: '9'
created: '2026-11-08'
status: 'built'
baseline_revision: 'c65f6d35d24312709da404ac6ecb829e7ebf167e'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 胶囊已经能替代双指下滑，有用户反馈希望显示胶囊时让双指下滑失效（误触）；现在胶囊一律常驻、双指下滑一律能开能关，没得选。

**Approach:** 设置「聊天框」组加一行「点歌台入口」（宿站单选框，四选一，见 epic R6）：胶囊 + 双指下滑（默认）/ 胶囊 + 双指下滑只收起 / 只用胶囊 / 只用双指下滑。存进插件设置，选完立即生效。

## Boundaries & Constraints

**Always:** 默认「胶囊 + 双指下滑」，与现状完全一致；旧存档缺这项或值不认识时按默认（单点归一化，默认值两处一致：`loadSettings` 与 `LocalStorageUtils`）；写盘失败提示「设置保存失败，请重试」并保持原值；Alt+S、聊天框 `@词`、页头最小化、Esc、宿站返回键在任何档位都照常。

**Decision (2026-11-08):** 「只用双指下滑」没有胶囊时，打开从胶囊本该在的位置的中心（一个点）长出来，收起缩回那个中心点后消失；没有胶囊淡入淡出的交接。其余三档的开合不变。

**Never:** 不提供「既无胶囊也无双指下滑」；不改双指下滑本身的判定（两指、下滑超过视口 1/5）；不改胶囊的拖动、吸附、外观；不新增 SCSS，不借宿站 `mdi-*` 类。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 默认 | 无存档 / 旧存档 | 胶囊在；面板关着双指下滑打开，开着双指下滑收起 | — |
| 只收起 | `胶囊 + 双指下滑只收起` | 胶囊在；面板关着双指下滑无反应；开着双指下滑收起 | — |
| 只用胶囊 | `只用胶囊` | 胶囊在；双指下滑开、关都无反应 | — |
| 只用双指下滑 | `只用双指下滑` | 面板收起后不出现胶囊；双指下滑能开能关；开合从胶囊本该在处的中心点长出 / 缩回 | — |
| 改选项 | 在设置页（面板开着）改选项 | 不刷新：下次收起按新选项决定胶囊在不在，双指下滑立即按新档位 | — |
| 非法值 | 存档里是 `"abc"` | 按默认 | 不报错 |
| 写盘失败 | 存储不可用 | 行标题保持原值 | 提示「设置保存失败，请重试」 |

</frozen-after-approval>

## Code Map

- `src/settings/pluginSettings/normalize.ts` -- 加类型 `PanelEntry` 与 `normalizePanelEntry`（照 `normalizePanelDisplay`），`PluginSettingsInterface` 加 `panelEntry`。
- `src/settings/pluginSettings/loadSettings.ts` -- 读档归一化 + 无存档默认值（:77 / :93 旁）。
- `src/settings/localStorageUtils/LocalStorageUtils.ts:158` -- 第二处默认值。
- `src/settings/pluginSettings/PluginSettings.ts` -- 照 `setAnnounceMode`（`buildSelect2` 单选，选项第三项是图标 HTML）写 `setPanelEntry`；照 `togglePanelDisplay` / `onPanelDisplayChange` 写盘失败不生效、成功才通知订阅方；加 `parsePanelEntry` 文案，以及两个判定 `panelEntryShowsPill(entry)`、`panelEntryAllowsSwipe(entry, panelOpen)`（纯函数，放 normalize.ts 便于测）。
- `src/page/MainAppContainerServices/settingsPluginSection.ts` -- 「聊天框」组在 `panelDisplay` 行后加 `kind: "value"` 行，key `panelEntry`，标题「点歌台入口」，icon 用胶囊上的品牌标 `mark`。
- `src/app.css` 「mdi 图标内容表」 -- 四个选项图标类（码点对 @mdi/font 7.3.67 核实，写注释）。
- `src/listener/Gesture.ts` -- `handleTouchStart` 开头按当前设置和 `isPanelOpen()`（`listener/panelPresence.ts`）判定，不允许就不挂 touchmove；`IMCActiveEventHandler` 走同一入口。
- `src/page/MainAppControlLayer.tsx` -- `syncDock`（:141）与 `startGrow` 收起分支（:190）按 `panelEntryShowsPill` 决定挂不挂胶囊；订阅入口变化后 `syncDock`，卸载时退订（照 `unsubscribePanelDisplay`）。
- 无胶囊时的起点 / 终点：把 `restingDockSilhouette(container)` 的结果收成它中心处宽高为 0 的形状再交给 `grow.start`（`onDock` 传空操作），`panelGrow` 本身不改。
- 不要动：`panelGrow.ts` 的曲线与时长、`PanelDock.tsx`、`dockPlacement.ts`。
- 测试：`src/page/MainAppControlLayer.test.ts`（胶囊与开合组）、`src/page/index.test.ts`（Gesture 已有用例 :374、:435）、`src/settings/pluginSettings/*.test.ts`。

## Tasks & Acceptance

**Execution:**
- [ ] `normalize.ts` / `loadSettings.ts` / `LocalStorageUtils.ts` -- 加 `panelEntry` 字段、归一化、两处默认 -- 旧存档与非法值落默认。
- [ ] `PluginSettings.ts` -- `setPanelEntry`、`parsePanelEntry`、订阅 -- 设置页行与面板共用一个真相。
- [ ] `settingsPluginSection.ts` + `app.css` -- 「点歌台入口」行与选择框图标 -- 用户可选。
- [ ] `Gesture.ts` -- 按档位放行双指下滑 -- 只收起 / 只用胶囊。
- [ ] `MainAppControlLayer.tsx` -- 胶囊挂载与收起交接按档位 -- 只用双指下滑。
- [ ] 测试 -- 覆盖 I/O 矩阵每一行（含选择框回调写盘、文案端到端）。

**Acceptance Criteria:**
- Given 默认设置，when 跑 `node scripts/verify/dock.mjs`，then 全过（行为与现状一致）。
- Given 手机尺寸真站、模拟触屏，when 四档各试双指下滑开 / 关与胶囊有无，then 与 I/O 矩阵一致，切换后不刷新即生效。

## Implementation Notes

- 直接在主会话实现（没有另起实现子代理）：调查结果已在上下文里，改动集中。
- 档位判定写成 `normalize.ts` 的两个纯函数，`Gesture` 只读存档（`loadPluginSetting`，避开 `PluginSettings` 引入输入模块的依赖），`MainAppControlLayer` 用 `showsPill()` 与订阅。
- 打开分支按「此刻有没有胶囊」（`this.dock`）选起点，收起分支按设置：打开时屏幕上没有胶囊，就该从中心点长出。
- 选择框图标：宿站 `md` 字体版本不明，`pill-off`（F1A5C）可能没有，改用早于 F0CB8 的码点（gesture-swipe-vertical / arrow-collapse-down / pill / gesture-swipe-down）；真站截图四个字形都在。设置行图标用胶囊上的品牌标 `mark`。
- 验证：`npm test` 1595 过、`npm run build` 过；`dock.mjs` 19 PASS；真站 390×844 模拟双指（CDP），从设置里逐档切换，17/17 过（含切换后不刷新生效、刷新后保持、Alt+S、点胶囊）。
- `grow.mjs` 有一项「打开头一段：胶囊冻在半途还看得见」FAIL，在改动前的基线 bundle 上同样 FAIL（12.8 把时长改到 100ms 后冻结点落在淡出末尾），与本票无关，已记 deferred-work。
- 反向验证：去掉 `Gesture` 的档位判定，「各档下双指下滑打开 / 收起」测试失败。

## Plan Change Log

## Review Triage Log

- 2026-11-08 quick 一轮：high 0 / medium 1 / low 3 / false 2 / maybe-false 0
  - medium · defer（改 AGENTS.md 属 agent-context）· AGENTS.md「常驻胶囊」仍写胶囊一律常驻、开合一律从胶囊长出 — 属实；已随本次提交补上「点歌台入口」子条并改「只要面板没开着就显示」一句。
  - low · reject · 另一个标签页改档位时，本页双指下滑立即按新档位、胶囊不跟着挂卸，可能短暂既无胶囊也无下滑 — 属实但要同源两个标签页且在另一页改设置，刷新即恢复，Alt+S、`@词` 仍可用；修复要加 `storage` 监听，按规则驳回。
  - low · reject · 开合 100ms 期间改档位，`syncDock` 因动画中提前返回而漏掉 — 改档位只能在面板开着的设置页里经宿站选择框完成，与 100ms 开合重叠几乎不可能；修复要在多个 `onDone` 里补调用，驳回。
  - false · 打开分支用 `!this.dock` 而非设置判断 — 打开时屏幕上没有胶囊就该从中心点长出，按「有没有胶囊」选起点正是想要的；两者只在上一条的竞态里不一致，那时按 `this.dock` 反而对。
  - low · patch · 写盘失败测试注册的订阅没有退订，静态 Set 跨用例残留 — 已补 `off()`。
  - false · 验收标准没跑 — 已跑：dock.mjs 19 PASS、真站手机四档 17/17、npm test / build 通过（见 Implementation Notes）；grow.mjs 唯一 FAIL 在基线上同样出现。

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 成功
- `node scripts/verify/dock.mjs` -- expected: 全过
- `node scripts/verify/grow.mjs` -- expected: 全过（默认档）

**Manual checks (if no CLI):**
- 真站 390×844 模拟触屏：四档逐一切换，试双指下滑开、关和胶囊有无，不刷新。
