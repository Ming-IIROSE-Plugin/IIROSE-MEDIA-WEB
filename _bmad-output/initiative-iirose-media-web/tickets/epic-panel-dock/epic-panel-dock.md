---
id: epic-panel-dock
type: epic
title: 点歌台窗口模式与常驻胶囊
parent: initiative-iirose-media-web
covers: []
after: []
refined: true
risk: low
status: in-progress
---
# 点歌台窗口模式与常驻胶囊

## Description

主面板原来只有全屏一种形态，开合是整页滑动，关闭只能 X 或 Alt+S。本 epic 补上可拖动缩放的窗口模式，并把「收起」做成一个常驻的胶囊（点歌台）：面板没开着的任何时候都有，可拖动、记住位置、不能进输入框；靠近屏幕边缘会像蜂蜜一样吸住并收起，拉远一小段才断开。窗口、全屏、手机三种形态共用同一套开合：从胶囊展开、缩回胶囊，面板上只有最小化，没有 X。

这批工作是 2026-11-06 一天内按维护者的逐轮反馈迭代出来的，**事后**登记进票据树，Requirements 来自对话而不是事先的 spec；提交序和每张票的归属见各 plan。

## Outcome

维护者在宿站里随时能从胶囊打开点歌台、最小化回到胶囊，窗口与全屏的开合有动画；胶囊的位置、吸附状态跟着他走，手指或鼠标拖动时胶囊始终贴着指针；宿站侧栏打开、手机尺寸、触屏三种环境下外观与操作都正确。

## Requirements

1. R1 (conversation): 主面板有可选窗口模式（可拖动、缩放、记住矩形），视口放不下时自动全屏，选择与存档不改。 — 成功标准:窗口开合有动画；窗口态只有一个收起入口；键盘与触屏下窗口保持稳定。
2. R2 (conversation): 面板可最小化为输入框左上方的胶囊，点胶囊还原；最小化在数据上等同关闭，聊天完全可用。 — 成功标准:最小化后宿站返回键与 Esc 交还宿站；Alt+S、`@词` 从胶囊状态仍能打开。
3. R3 (conversation): 胶囊默认常驻（面板没开着就显示，窗口、全屏、手机都有；可在设置里换，见 R6），可拖动并记住位置，底缘不能越过输入框顶边；面板上没有 X，只有最小化；全屏从胶囊原地展开，不滑动、不推走宿站聊天区。 — 成功标准:刷新后胶囊仍在；位置存 `imwPanelDockPosition`，松手才写盘。
4. R4 (conversation): 胶囊靠近屏幕边缘（24px 内）吸附并收起：左右滑出只露图标，上下缩成图标圆钮；悬停、按住、键盘聚焦展开；触屏也收起；宿站侧栏把 body 平移 275px 时仍被正确裁住。 — 成功标准:真站实测贴右边只露约 34px、悬停展开约 87px；侧栏打开时层贴在侧栏右缘。
5. R5 (conversation): 贴边时有蜂蜜拉丝的粘连感，但拉出必须短距离断开，且胶囊始终 1:1 跟手，不得有阻尼或追赶；手机上胶囊更大。 — 成功标准:拉出时胶囊中心与指针偏差 ≤ 2px（量 `getBoundingClientRect`）；手机尺寸胶囊高度 ≥ 52px。
6. R6 (conversation 2026-11-08，用户反馈): 设置「聊天框」组有一行「点歌台入口」，四选一：胶囊 + 双指下滑（默认，双指下滑能打开也能收起）/ 胶囊 + 双指下滑只收起（面板关着时双指下滑没反应）/ 只用胶囊（双指下滑完全不响应）/ 只用双指下滑（不显示胶囊）。不提供「两样都没有」。 — 成功标准:选了立刻生效、不用刷新，刷新后保持；旧存档没有这项或值不认识时按默认；Alt+S 与聊天框 `@词` 照常能打开面板。

## Constraints

- 面板停稳时不能带 `transform`，`scale` / `translate` 也必须是 `none`（`fixed` 子元素以视口为基准）；`transform: none` 与 `scale: none` 不能写进同一条规则（lightningcss 会合并成 `transform: scale(1)`）。
- 胶囊的层自带 `overflow-hidden`，位置量取要减去 `body` 的偏移（宿站侧栏的 `translateX(275px)`）。
- 拖动中不得开 `left/top/translate` 过渡；验证跟手只量 `getBoundingClientRect`，读 `style.left` 看不出滞后。
- 不新增 SCSS；颜色只拼令牌；断点用 `max-[768px]`。

## Done when

- 窗口、全屏、手机三种形态的开合都从胶囊出发、回到胶囊，面板上没有 X。
- 胶囊可拖动、记住位置、不能进输入框；吸附、收起、展开、粘连与断开在真站实测通过。
- `npm test` 与 `npm run build` 通过；真站 `scripts/verify/dock.mjs`、`grow.mjs`、`entry.mjs` 全过（2026-11-13 第二轮复盘时：1597 个用例，`dock.mjs` 19 项，`entry.mjs` 17 项）。
- 「点歌台入口」四档（R6）切换不刷新即生效、刷新后保持。
- 已推送到 `origin main` 并部署（CI 成功）。

## Boundaries

- 不在本 epic：点歌台内部页面、搜索、播放控制；它们只是被窗口承载。
- Touch point: 宿站 `#moveinputDisplay`（输入框外层）与侧栏 `translateX(275px)` — 只读位置，不改 DOM；owner: 宿站。
- Touch point: `src/media-progress/viewport.ts` — 为排除元素自身 `scale` 做了一处改动；owner: epic-media-desk-redesign。
- Must not change: 面板内容布局与 `AGENTS.md` 的外壳尺寸约定。
- 未做：窗口键盘移动 / 缩放。（真机触屏与手机端宿站侧栏已由维护者在真机上验证，见复盘第一轮 V1。）

## References

- parent — _bmad-output/initiative-iirose-media-web/initiative-iirose-media-web.md
- code — src/page/components/panel-window/、src/page/MainAppControlLayer.tsx、src/app.css（窗口态与胶囊）
- guide — AGENTS.md「主面板窗口模式」「常驻胶囊」两条
- verify — scripts/verify/dock.mjs、scripts/verify/grow.mjs、scripts/verify/entry.mjs

## Notes

- Decision: 2026-11-06 事后登记。实现已全部完成并上线，六张票都以 `done` 登记，plan 的 `baseline_revision` 取各票首个提交的父提交，范围按提交主题划分，彼此相邻处有重叠。
- Decision: 2026-11-06 维护者指定切成：窗口模式、最小化、常驻胶囊、吸附、蜂蜜拉丝，外加审查收口一张。
- Open question: 原 plan（`plan-main-panel-window-mode`、`plan-panel-window-minimize`）在 v7 迁移时丢失，内容只能从提交说明与 AGENTS.md 还原。
- Open question（已解决）: 第一轮只做过一次独立审查（记在「审查收口」票里）；12.7–12.9 各做过一轮独立快速审查，2026-11-13 第二轮复盘又做了一次跨票的三镜头审查。
- Decision: 2026-11-07 贴边的胶囊反复露出接缝和方角（上边收起时的方块、右边上下沿约 1px 的凹陷），根因是胶囊和粘连是两个要靠 CSS 和 TS 各写一遍才对齐的形状。维护者在原型上比较后选定「一笔画」（同一条轮廓），新增票 7；要求不变，只换实现。
- Decision: 2026-11-07 下边不做粘连。`#moveinputDisplay` 占满整条底栏（灰框只是其中会随打字变长的 `#moveinputBubble`），贴输入栏顶边会悬空，贴屏幕底又要进入输入区；维护者决定不做。
- Decision: 2026-11-07 维护者想让面板「像是从胶囊长出来」。在试玩页（真站截图，胶囊用插件同一个形状函数）比较了现在、A 撑开、B 放大、C 顺边拉出、D 回弹，选定 A，新增票 8；做好先不推送，等维护者确认再上线。
- Decision: 2026-11-08 用户反馈胶囊已经能替代双指下滑，希望显示胶囊时可以让双指下滑失效。维护者定为一行「点歌台入口」四选一（失效程度也能选：只收起 / 完全不响应），默认胶囊 + 双指下滑；不提供「两样都没有」（手机上会没有入口）。新增 R6 与票 9，放进本 epic。
