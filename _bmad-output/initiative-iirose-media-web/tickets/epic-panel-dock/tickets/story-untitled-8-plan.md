---
title: '面板从胶囊长出来'
type: 'feature'
ticket: '8'
created: '2026-11-07'
status: done
baseline_revision: '376c53a9de7f29e0793d00e00a41dc5bf53685a3'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 现在打开是面板缩到 0.2 倍、从胶囊中心淡入，点下去胶囊直接消失，看着不像从胶囊里出来。

**Approach:** 照维护者在试玩页选定的方案 A：胶囊本身撑大成面板，露出的圆角矩形从胶囊看得见的那块长到面板矩形，内容途中浮现；收起反过来缩回收起的胶囊。全屏、窗口、手机共用。

## Boundaries & Constraints

**Always:** 打开 100ms `cubic-bezier(.2,0,0,1)`，收起 100ms `cubic-bezier(.3,0,.8,.15)`；内容在打开的 10%–50%、收起的前 38% 淡入淡出；胶囊在打开前 22% 淡出、收起最后 20% 淡入，交接期间点不到；起点和终点按胶囊当时露出的形状算（悬停展开、收起只露 peek、上边的圆钮，靠墙一侧直角）；停稳后容器没有 clip-path、translate、transform、scale；减少动态效果时直接到位；开合中途反向时从当前形状接着走。

**Never:** 不改胶囊的形状、手势和存档；不改面板内部 DOM 和样式；不新增运行时依赖；不推送，维护者确认后再上线。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 点胶囊打开 | 贴边，悬停展开 | 第一帧露出的就是展开的胶囊，再长成面板 | 无 |
| Alt+S / `@词` 打开 | 胶囊收起 | 从露出的 peek（上边是圆钮）长出来 | 无 |
| 窗口模式 | 胶囊在窗口范围外 | 露出的那块边长边移到窗口位置 | 无 |
| 收起 | 任一入口 | 缩回收起的胶囊，胶囊淡入后可点 | 无 |
| 中途反向 | 动画没走完又切换 | 从当前形状反向，不跳回起点 | 无 |
| 减少动态效果 | `prefers-reduced-motion` | 直接到位，没有裁切 | 无 |

</frozen-after-approval>

## Code Map

- `panel-window/panelGrow.ts`（新）-- 纯函数：形状插值、clip-path inset 与 translate 换算（胶囊在面板范围内时 translate 恒为 0）、时间曲线（照试玩页 `VERSIONS.A`）。驱动：rAF 写容器 `clip-path`、`translate`，外加两个跟着形状走的 fixed 元素：上层 `deskSheet` 底色盖住内容（透明度 = 1 − 内容），下层 `deskMenuShadow` 投影；结束全部清掉。
- `panel-window/dockLiquid.ts` -- 加 `dockSilhouette`：胶囊露出的矩形和四角圆角（不含耳朵），与 `dockShape` 同一套数。
- `panel-window/dockPainter.ts` -- 加 `silhouette()`，含当前展开程度和落定偏移。
- `panel-window/dockMeasure.ts` -- 删 `writeDockFlight`；加按存档算收起终点的函数。
- `panel-window/dockPlacement.ts` -- 删 `dockFlight` 及其测试。
- `panel-window/PanelDock.tsx` -- 删 `onPlaced`；`mountPanelDock` 返回 `{ unmount, reveal(amount) }`（写根节点 opacity，<1 时 `inert`）；`entrance: "rise" | "handover"`，handover 不播 `imwRiseIn`、从透明开始；导出读当前剪影的函数。
- `MainAppControlLayer.tsx` -- 删 `writeFlight`；开合分支（约 265 行）启动驱动：打开时胶囊留到动画结束再卸载，收起时以 handover 挂载；首次挂载仍是 rise。面板矩形用 `placement.rect`，全屏用 `viewportMetrics`；窗口圆角 12 放进 `geometry.ts`，测试钉住与 `roundedLg` 相同。
- `src/app.css` -- 容器收起态只留 `opacity: 0`、`visibility: hidden`、`pointer-events: none`，删 `--imw-dock-x/y`、缩放和过渡（约 424–460、546–553 行）。
- 不动：`viewport.ts`、`PanelWindowPlacement`（只读 `rect`）。

## Tasks & Acceptance

**Execution:**
- [ ] `panelGrow.ts` + `panelGrow.test.ts` -- 纯函数和驱动，覆盖矩阵各行。
- [ ] `dockLiquid.ts`、`dockPainter.ts`、`dockMeasure.ts`、`dockPlacement.ts` + 测试 -- 剪影函数，删 flight。
- [ ] `PanelDock.tsx` + `PanelDock.test.ts` -- handle、entrance、剪影。
- [ ] `MainAppControlLayer.tsx` + 测试 -- 接驱动，换掉 `--imw-dock-x` 断言。
- [ ] `src/app.css` -- 收起态改写。
- [ ] `scripts/verify/grow.mjs`（新）-- 真站逐帧回归，并用改坏的 bundle 确认会报 FAIL。
- [ ] `AGENTS.md` -- 改「常驻胶囊」的开合动画一句和 `viewportMetrics` 那条坑。

**Acceptance Criteria:**
- Given 真站胶囊贴右边并悬停，when 真实点击，then 第一帧露出区域与胶囊矩形各边偏差 ≤ 1px，且胶囊仍可见。
- Given 面板开着，when 点最小化，then 最后一帧露出区域与收起的胶囊偏差 ≤ 1px，结束后胶囊可点。
- Given 开合结束，when 读计算样式，then 容器 `clip-path`、`translate`、`transform`、`scale` 都是 none，跟随元素已移除。
- Given 真站全屏和窗口，when 开合，then 脚本输出最大帧间隔（桌面 ≤ 34ms）。

## Implementation Notes

- 没按流程开实现子代理，主流程直接做：要对着真站反复调，和 12.7 一样。审查仍由独立子代理做。
- 收起的终点帧：起初画完终点就在同一帧清掉，浏览器根本画不出这一帧。真站量到屏幕上最后看到的是还有两成大的面板（离胶囊 270px），接着一下子没了。改成终点帧先画、下一帧再清，四个场景都落在胶囊上，误差 0。
- 开合期间容器 `pointer-events: none`、胶囊 `inert`：双击胶囊时，第二下不能落在刚露出来的面板上。全屏贴右边时，那一块正好是「点播」那一列。
- 动画在 `componentDidUpdate` 里按 `prevState` 启动：DOM 已提交、还没绘制，第一帧就裁好了。首次打开和初始化合批时，`shouldComponentUpdate` 的显示分支不会走，这里照样会启动。
- 「从胶囊长出来」用 `deskSheet` 底色的 fixed 元素盖在容器上面（透明度 = 1 − 内容），没有去改面板子元素的透明度：子元素受基线过渡（120ms）影响，Preact 重渲染时类名也可能被改回去。
- 控制层原有用例改在「减少动态效果」下跑，开合直接到位；动画和胶囊交接另有一组用例，用假定时器。
- 删掉了 `writeDockFlight`、`dockFlight`、`onPlaced`、`--imw-dock-x/y`；`AGENTS.md` 和 ADR 同步。新增 `scripts/verify/grow.mjs`，可用 `GROW_CPU_THROTTLE` 降速。
- 帧间隔（本机 headless Chromium）：桌面每帧 16.7–16.8ms；首次打开的第 1 帧 50ms，是初始化面板。CPU 降到 1/4：首次打开第 1 帧 233ms，之后也掉帧；再次打开和手机第 1 帧 50ms，其余 ≤ 33ms。
- 反向验证：真站脚本对「停稳不清 clip-path」「打开从收起的胶囊算起点」都报 FAIL。单测对这两种，以及「反向不续接」「交接期间胶囊点得到」「终点帧同帧清掉」都报错。`dock.mjs` 19 项照旧全过。
- 审查后的调整（见下面的分诊记录）：胶囊的透明度改写在带 z-index 的那一层上；反向时胶囊在这一段里平滑换到新的终点，露出哪一块也逐帧跟着胶囊算；盖在形状上的底色吞掉点击；第二帧才开始计时，首次打开挂上面板后的长帧不会把动画顶出一跳。`grow.mjs` 加了交接时胶囊看得见（冻在半途截图）、双击、帧间隔三项，帧间隔只打印不判。
- 试过但没留：动画期间给容器加 `will-change: transform`、把面板子元素单独提层、改用 WAAPI 动 clip-path，三种的帧间隔都没变化。机器太忙，量不出差别，都撤掉了。
- 18:00 前后这台机器上起了一个占满约 7 核的任务（维护者自己的「闲置机挖矿」项目），之后量的帧间隔都受影响；上面「桌面每帧 16.7ms」是在那之前量的。
- 矩阵逐行都有用例：点胶囊打开（`panelGrow.test.ts`「打开」、控制层「打开时胶囊留到面板长完再卸载」、`grow.mjs`）、Alt+S 打开（控制层「Alt+S 打开时胶囊是收起的」）、窗口模式（「窗口在胶囊另一边」「窗口：胶囊在窗口外时」、控制层「窗口模式」、`grow.mjs`）、收起（「收起」「终点那一帧先画出来」、`grow.mjs`）、中途反向（「中途反向」、控制层「没长完就收起」）、减少动态效果（「减少动态效果」、`grow.mjs`）。

## Plan Change Log

- 2026-11-07 维护者上线试过后觉得太慢（「感觉速度太慢了」）：打开 450ms → 300ms，收起 300ms → 220ms，曲线和各段比例不变。
- 2026-11-07 维护者要求「都改成100ms」：打开、收起都是 100ms，曲线和各段比例不变；测试里中途打断的等待改成按时长算。

## Review Triage Log

Pass 1（quick，独立子代理）：high 0，medium 2，low 1，false 0，maybe-false 1。

| # | 发现 | 判定 | 去向 | 证据 / 处理 |
|---|------|------|------|-------------|
| 1 | 胶囊的淡出淡入被面板的底色盖住，看不见 | medium | patch | 真站把打开冻在胶囊透明度 0.74 的那一帧截图，只看得到底色。透明度写在没定位的根节点上，根就成了 z 0 的层叠上下文，沉到面板下面。改写到带 z-index 的层上；修后冻在半途截图，打开和收起时胶囊的字都看得见（亮度离散 21.8、19.5，被盖住时接近 0）。`grow.mjs` 加了这两项，单测钉住写在层上。 |
| 2 | 悬停展开时打开，没长完就收起，形状会跳 | low | patch | 打开用展开的胶囊，收起用收起的胶囊，反向时只接上了开合程度，第一帧左缘跳 (1 − 开合程度) × 53px，违背冻结的「从当前形状接着走」。改成反向时在这一段里把胶囊从上一段平滑换到新的，露出哪一块也逐帧跟着算。单测按「展开打开、收起缩回」的真实组合验证：接得上、最后落在收起的胶囊上、全屏全程不挪。 |
| 3 | 交接期间双击，第二下漏到宿站 | medium | patch | 动画期间容器 `pointer-events: none`、胶囊 `inert`，点击会落到下面的宿站元素；全屏的拦截只管 body 上的 mousedown/touchstart。改由盖在形状上的底色吞掉指针和点击事件。真站双击检查：宿站收到 0 次点击，面板照常打开；单测钉住。 |
| 4 | 「桌面 ≤ 34ms」没判，也没达到 | maybe-false | defer | 脚本现在逐段打印形状在动时的最长一帧和静止时的最长一帧，但不判：这台机器没有显卡，另有任务占满约 7 核，静止的面板也会到 33ms；单独动一个裁切（不带底色和胶囊，逐帧写或用 WAAPI）同样是 33–50ms，量不准。那个任务启动前量过：再次打开每帧 16.7ms，首次打开只有第 1 帧 50ms（挂面板）。若在真机上成立是 medium，记进 deferred-work；要维护者在电脑和手机上试，或在空闲机器上重跑 `grow.mjs`。 |

## Design Notes

只裁不缩：内容始终原尺寸，不变形。胶囊在窗口外时，露出的范围贴着胶囊那侧，用 translate 挪过去，最后归零。中途反向时反解新曲线得到等效起点，形状连续，内容透明度允许小跳。

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 成功
- `node scripts/verify/dock.mjs` -- expected: 真站全部 PASS
- `node scripts/verify/grow.mjs` -- expected: 真站全部 PASS（帧间隔只打印）

**Manual checks (if no CLI):**
- 维护者在电脑和手机上试开合手感，确认后再推送上线。
