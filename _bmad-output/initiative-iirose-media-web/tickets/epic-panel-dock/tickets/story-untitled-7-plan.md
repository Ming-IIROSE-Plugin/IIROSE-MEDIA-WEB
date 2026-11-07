---
title: '胶囊和粘连画成同一条轮廓'
type: 'refactor'
ticket: '7'
created: '2026-11-07'
status: 'built'
baseline_revision: '6a921462bc74b99d86109d7ea04b1884a74f5337'
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

**Problem:** 胶囊和粘连是两个形状，靠 CSS 和 TS 各写一遍才对齐，于是上边收起时露方角、右边上下沿有约 1px 凹陷。

**Approach:** 只留一条 SVG 轮廓，由纯函数按「边、离边距离、展开程度」算出；文字和图标只是压在上面的内容。手感照维护者认可的原型（`dock-lab-a`）。

## Boundaries & Constraints

**Always:** 胶囊 1:1 跟手，不加阻尼或追赶；离边 56px 断开，没断就弹回；存档 `imwPanelDockPosition` 的键和格式不变；`left/top` 仍表示展开时的左上角；减少动态效果时没有动画也没有拉丝；宿站侧栏平移时层继续裁切。

**Decision:** 下边不粘：仍是图标圆钮，没有耳朵和拉丝（`#moveinputDisplay` 占满整条底栏，贴上去会悬空）。上下边的胶囊以中心为基准展开，图标在可见部分正中。

**Never:** 不改面板开合动画和 `writeDockFlight` 的终点算法；不新增运行时依赖；不再让 CSS 负责胶囊的形状和收起。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 贴左右上，静止 | 存档带 `edge` | 一条轮廓：胶囊加两个耳朵，沿线没有台阶 | 无 |
| 悬停 / 按住 / 键盘聚焦 | 贴边 | 轮廓和内容同一帧展开；移开同帧收回，无方角 | 触屏不响应悬停 |
| 往外拉 | 未到 56px | 同一条轮廓拉出丝，胶囊中心跟手 | 松手弹回 |
| 拉断 | 到 56px | 变回完整胶囊，两端尖头各自缩回 | 无 |
| 下边 | `edge: bottom` | 圆钮，悬停展开，没有耳朵和拉丝 | 无 |
| 旧存档 | 已有 `{x,y,edge}` | 原样读出，位置和边不变 | 坏数据按现有 `normalizeStoredDock` |

</frozen-after-approval>

## Code Map

- `panel-window/dockLiquid.ts` -- 纯几何。`neckPath`、`stretchScale` 换成 `dockOutline`、`dockCapsule`、`dockShape`；留 `wallBumpPath`、`pillTailPath`、`stuckPull`、`wallOf`、`nearbyWall`、`isStickyEdge`。算法照 `dock-lab-a.html` 的 `outline()`、`sizes()`、`placeContent()`。
- `panel-window/dockNeck.ts` -- 改名 `dockPainter.ts`：持有展开程度、落定、尖头三个动画，一个 rAF 循环，每帧调 `dockShape` 再写路径和内容样式。减少动态效果时直接到终点。
- `panel-window/dockMeasure.ts` -- `dockNominalSize` 扩成 `dockMetrics`（宽、高、peek、内边距、间距、图标），桌面 87/38/34/12/6/16，手机和粗指针 110/54/54/16/8/20。`dockSize`、`writeDockFlight`、存档函数不动。
- `panel-window/PanelDock.tsx` -- 事件留这里，形状交给 painter。去掉 `ResizeObserver`、`DOCK_HEIGHT_CLASS`、胶囊底色和 `scale`，新增悬停和聚焦事件；按钮去掉 `h-*`、`px-*`、`gap-*`（Tailwind 带 `!important`，会压过内联样式），胶囊和文字加 `transition-none`；`imwRiseIn` 移到层上，让形状一起上升。保留 `data-imw-dock-edge`、`data-imw-dock-held`；路径加 `data-imw-dock-shape`。
- `src/app.css` -- 删整段胶囊规则（约 558–705 行），保留 `#imw-panel-dock-root` 的边框和盒模型基线。
- `dockLiquid.test.ts`、`PanelDock.test.ts` -- 改掉 `neckPath`、`style.scale`、settling、CSS 文本断言；位置和存档用例不动。
- `MainAppControlLayer.test.ts` -- 只读胶囊属性，改完确认仍过。
- `scripts/verify/dock.mjs` -- 主题改查路径填充色，加轮廓和图标检查。
- `AGENTS.md` -- 改写「常驻胶囊」和蜂蜜拉丝两段。

## Tasks & Acceptance

**Execution:**
- [ ] `panel-window/dockLiquid.ts` + `dockLiquid.test.ts` -- 写 `dockShape` 并覆盖矩阵 -- 所有几何集中成纯函数。
- [ ] `panel-window/dockMeasure.ts` -- 加 `dockMetrics` -- 尺寸只留一处。
- [ ] `panel-window/dockNeck.ts` → `dockPainter.ts` -- 动画和写 DOM -- 形状和内容同帧更新。
- [ ] `panel-window/PanelDock.tsx` + `PanelDock.test.ts` -- 接 painter，改事件和样式类。
- [ ] `src/app.css` -- 删胶囊规则。
- [ ] `scripts/verify/dock.mjs` -- 按验收标准加检查，并用改坏的副本确认能报 FAIL。
- [ ] `AGENTS.md` -- 同步约定。

**Acceptance Criteria:**
- Given 胶囊贴右边并展开，when 沿轮廓逐列量上沿，then 从胶囊走向边缘时上沿只升不降（无凹陷）。
- Given 胶囊贴上边，when 收起、展开及其中间帧，then 每行宽度连续变化，没有方角式的突变。
- Given 胶囊贴上边，when 收起，then 图标中心和轮廓中心偏差 ≤ 0.5px。
- Given 贴边或自由状态，when 拖动，then `getBoundingClientRect` 量到的胶囊中心偏离指针 ≤ 2px。
- Given 宿站浅色或深色，when 胶囊显示，then 轮廓填充分别是纸色和墨色。

## Implementation Notes

- 没按流程开实现子代理，主流程直接按方案做：要反复对照真站调形状，冷启动的子代理要重新摸一遍。审查仍由独立子代理做。
- `dockSize` 改成只按 `dockMetrics().width` 算宽度，方案里写的是不动：胶囊被拉长时 `offsetWidth` 会变大，范围跟着缩，胶囊会抖。
- 去掉拖动中的 `scale`：拉长只在轮廓上，文字和图标不变形。`data-imw-dock-dragging`、`data-imw-dock-settling` 只服务已删除的 CSS，一起删了。
- 自由状态和上下边的内容居中，手机标称宽 110 比内容宽 107 多 3px，这样两边对称。
- 上下边的胶囊以中心展开时用 `left + 展开宽度 / 2` 作中心，存档格式不变。
- 基线之后维护者另外选定了图标（`970c03c`），不属于本票，但在 `baseline_revision..HEAD` 的范围里。
- 反向验证：单测对「丝比胶囊窄」「图标不居中」「拉长不补偿」三种改坏都报错；`dock.mjs` 对换成带台阶的轮廓、注入位置过渡、图标错位都报 FAIL（跟手偏差 188px，凹陷 1px，图标偏 3.5px）。
- 审查后的调整：断开后的两个尖头改成单独一条路径（`[data-imw-dock-tips]`）；胶囊和按钮的圆角、字号、图标大小也改由 `dockMetrics` / `dockShape` 写成内联样式，靠边那侧是直角。

## Plan Change Log

## Review Triage Log

Pass 1（quick，独立子代理）：high 0，medium 3，low 4，false 0，maybe-false 0。

| # | 发现 | 判定 | 去向 | 证据 / 处理 |
|---|------|------|------|-------------|
| 1 | 从左边拉断时胶囊身上有洞 | medium | patch | 真站 `isPointInFill` 连续 8 帧都是 false：尖头和胶囊在同一条路径里绕向相反。尖头改成单独一条路径，修后 12/12 帧实心，`dock.mjs` 加了这项。 |
| 2 | 减少动态效果时拖近边缘仍画丝 | medium | patch | `dockPainter.ts` 算 `approach` 时没查减少动态效果，违反方案的 Always。加判断和用例。 |
| 3 | 靠墙的角点不到 | medium | patch | 真站靠墙 1px、偏离中心 12–18px 的 `elementFromPoint` 都不是胶囊：`rounded-full` 让靠墙的角也圆了。靠边一侧改直角，`dock.mjs` 加了这项；收起和展开的圆角一致后，悬停抖动的前提也没了。 |
| 4 | 上边收起时胶囊的盒子比轮廓多 4px | low | reject | 那 4px 只多一点可点范围，日常碰不到；要改就得让高度随帧变，又会影响 `dockSize`。 |
| 5 | 图标大小两处写法，768px 整时不一致 | low | patch | 构建产物里 `max-[768px]` 确实是 `not all and (min-width:768px)`。字号和图标大小都改由 `dockMetrics` 给，去掉工具类。 |
| 6 | 两处注释还在讲已删除的 CSS | low | patch | `dockMeasure.ts`、`PanelDock.tsx` 的注释已改。 |
| 7 | 按钮带 `h-full`，和新规则的字面矛盾 | low | patch | `h-full` 没有冲突，是规则写得太宽：`AGENTS.md` 改成只禁固定尺寸类。 |

矩阵逐行都有用例：静止（`dockLiquid.test.ts`「贴边的轮廓」、`PanelDock.test.ts`「贴边静止」）、悬停 / 按住 / 聚焦（「展开和收起」）、往外拉（「往外拉」「没拉到阈值」）、拉断（「拉过阈值」）、下边（「不贴边」「贴边静止」）、旧存档（「拖到边缘」「重新挂载」、`dockPlacement.test.ts`）。全部跑过并通过。

## Design Notes

数据只单向流动：几何算出尺寸，再写给 DOM，不从 DOM 量回胶囊的宽度。这样形状和内容不会分家，也不用再对齐两处。内边距和间距改由 `dockMetrics` 给，按钮只留文字和图标尺寸类。

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 成功
- `node scripts/verify/dock.mjs` -- expected: 真站全部 PASS

**Manual checks (if no CLI):**
- 维护者在电脑和手机上试手感：悬停、拉丝、断开、弹回、上边收起。
