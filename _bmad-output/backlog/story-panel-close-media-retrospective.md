---
story: story-panel-close-media
date: 2026-11-25
verdict: accepted-with-open-items
criteria: declared
headless: false
---
# 复盘：在点歌台底部条开关本机媒体加载（story-panel-close-media）

## Epic summary

- **范围**：单票 backlog 故事 `story-panel-close-media`（`_bmad-output/backlog/story-panel-close-media.md`，独立于 `initiative-iirose-media-web` 12 个已完成 epic；维护者确认无额外入场关切）。
- **票据状态**（`tickets.py status _bmad-output/backlog`）：`story-panel-close-media.md` 当前 `status: built`、`state: review`、`refined: true`、`risk: low`。本故事范围 `pending_tickets` 为空（已完成构建与一轮 review 加固，尚未交 PO 标 `done`）。
- **实现提交范围**（按 plan `baseline_revision: d77fc2b21cc0e9da66fca60ba36294a79d11c25c` 至 `HEAD 8ebf2bf`）：共 2 个非合并提交、0 个合并提交（`merge_count: 0`、`merges_measured: 0`、`binary_revisions: 0`）：
  1. `6f83400` (`feat: add local media-loading toggle to the desk room deck`) — 16 个文件，+690 / −67
  2. `8ebf2bf` (`fix: harden room-deck media-loading toggle and expand test coverage`) — 11 个文件，+280 / −69
- **证据清单**：
  - 故事规格书：`_bmad-output/backlog/story-panel-close-media.md`（声明 `Verify`、5 条 GWT 验收标准、4 条 `Boundaries`、经真站调查确认的宿站接口契约）。
  - 施工计划：`_bmad-output/backlog/story-panel-close-media-plan.md`（本机 git-ignore，含 `<frozen-after-approval>`、`Implementation Notes`、`Design Notes`、`Review Triage Log`）。
  - `git_evidence.py --range d77fc2b21cc0e9da66fca60ba36294a79d11c25c..HEAD --stories story-panel-close-media` 确定性变更清单。
  - `d77fc2b..8ebf2bf` 导入图差异与 `madge --circular` 环检测。
  - `HEAD 8ebf2bf` 的 CI 状态（`gh run list`）、单测/构建结果与真站端到端复测（见 Behavior verification）。
  - Phase 2 独立三镜头审查（adversarial / edge-case-hunter / verification-gap），所有发现均已逐条对照 `HEAD 8ebf2bf` 源码与真站宿站源码复核。
- **缺失**：
  - 仓库内无落盘的会话日志文件；过程类教训仅依据 plan、提交记录与代码现状，不引用未落盘对话。
  - 提交标题未带票号（`git_evidence.py` 的 `stories` 为空）；范围按 plan 的 `baseline_revision` 界定，该区间内只有本票 2 次提交，无跨票混入。
  - 尚未在真实物理手机触屏设备与真实读屏软件上人工走查；无入库的专用真站回归脚本。

## Findings

### 聚合视图（覆盖全范围 `d77fc2b..8ebf2bf`）

- **A1 体量增长**：
  - `git_evidence.py` 非合并变更量排前：`roomDeck.test.ts` (+402 / −30，净 +372)、`HostMediaBridge.test.ts` (+218 / −20，净 +198)、`deckParts.tsx` (+78 / −5)、`HostMediaBridge.ts` (+75 / −6)、`useDeck.ts` (+52 / −9)、`MiniDeck.tsx` (+62 / −36)。
  - `HEAD 8ebf2bf` 实际行数：`tokens.ts` 476（+4，纯令牌/图标表）、**`HostMediaBridge.ts` 418（349 → 418，+69）**、`index.tsx` 340（+4）、`MiniDeck.tsx` 244（+26）、`model.ts` 218（+6）、`useDeck.ts` 218（+43）、`deckParts.tsx` 178（+73）、`Global.ts` 147（+7）、`RoomDeck.tsx` 141（+5）、`RoomDeckDesktop.tsx` 110（+7）、`ModeToggle.tsx` 99（+10）。
  - 结论：`room-deck/` 内各文件保持紧凑（99–244 行）；`HostMediaBridge.ts` 首次跨过 400 行参考线（`epic-large-file-decomposition` 的参考尺度，非全仓硬规），同时承担进度读取/跳转、宿站钩子观察与本机媒体开关三项职责。**处置：接受，观察。**
- **A2 架构增量**：
  - 全 11 个生产文件仅新增 1 条导入边：`src/page/components/room-deck/useDeck.ts` → `../../../tools/reportFailure`（向底层工具单向依赖）。
  - `madge --circular src/media-progress src/page/components/room-deck src/page/index.tsx` 报告的 13 条循环全部是既有循环（`Announce / PluginSettings / Input-Behavior-Module / platforms / FavoritesStorageService / SyncRuntime`），**0 条经过 `media-progress/`、`room-deck/` 或 `page/index.tsx`**。**处置：干净。**
- **A3 重复与双源**：
  - 本机媒体加载的宿站字段（`mediaRoom`、`Probe.emptyMediaPlayer`、`Probe.sleepMode`、`Objs.emptyMediaPlayer.switch`、`Utils.service.openMediaLoadingWhenSleep`）全部收口在 `HostMediaBridge.ts` 并同步于 `Global.ts`，无双源。
  - 10 秒去重逻辑（`NOTICE_INTERVAL = 10_000`）同时存在于 `useDeck.ts` 与 `SidebarPlaybackRow.ts`，属本票之前的既有结构（本票仅在 `useDeck.ts` 内抽取 `recordNotice` 复用）。
  - **异常文案掩盖**：`HostMediaBridge.ts:193,197,207` 写了三条细分的中文报错文案，但 `useDeck.ts:186` 传了 `reportFailure(error, MEDIA_LOADING_FAILED)` 第二参，而 `reportFailure.ts:22` 采用 `fallbackMessage ?? failureMessage(error)`，导致桥接层的三条细化文案永远不会展示给用户（详见 F5）。
- **A4 模式分叉**：
  - `MediaLoadingToggle`（`deckParts.tsx:159-172`）单独增加了 `onKeyDown` 阻断宿站 `window.onkeydown` 的 `Enter` `preventDefault()`，同底部条相邻的 `ModeToggle`、`MiniDeck` 的 `miniButton`（含本票放开的空闲态展开入口）与 `closeButton` 未同步处理；且 `MediaLoadingToggle` 注释写「仅阻断无修饰键的非组字 Enter」，实现漏掉了 `!event.shiftKey`（详见 F6）。
  - `useDeck.ts:186` 是全仓唯一向 `reportFailure` 传第二参 `fallbackMessage` 的调用点（`src/platforms/` 其余调用点全部单参 `reportFailure(error)`），且未留任何原始错误诊断（详见 F5）。
- **A5 规格对账**（对照 `_bmad-output/backlog/story-panel-close-media.md`、`DESIGN.md`、`EXPERIENCE.md`）：
  - Criteria 1–5 与 Boundaries 1–4 主体均已实现并经真站验证；文档存在 3 处轻度漂移：
    1. `story-panel-close-media.md:79` 的 `Open question: 两态图标方案` 尚未改为已定稿 `note` / `noteOff`（`tokens.ts:343-344,392-394`、`DESIGN.md:493,509,806` 已落盘）。
    2. `story-panel-close-media.md:49` Criterion 4 写无障碍名随动作切换（「关闭媒体」/「开启媒体」），而 `8ebf2bf` 为兼顾读屏将非媒体房 `aria-label` 扩为 `${action}，${reason}`（`deckParts.tsx:155`，已与 `EXPERIENCE.md:287` 一致）。
    3. `EXPERIENCE.md:183` 展开的底部条收起条件列表未写进 `8ebf2bf` 新增的「睡眠态点击媒体加载开关直接收起展开层（不归还焦点，让位宿站退出睡眠确认框）」（`MiniDeck.tsx:190-194`）。
    - 另：`story-panel-close-media-plan.md`（git-ignore 施工单）仍保留 `6f83400` 时的 `pr-[92px]` 与「仅 `stopPropagation()`」笔记，已被 `8ebf2bf` 取代，记录备查。
  - **处置：规格对账（行动项 5，待 PO/开发落地）。**

### 独立三镜头审查发现（已逐条对照 `HEAD 8ebf2bf` 与真站宿站源码复核）

| # | 发现 | 来源与证据 | 处置 | 预防教训 |
|---|---|---|---|---|
| F1 | **`observe(player, "switch")` 回调调用裸 `this.poke()` 而非 `this.safePoke()`**。常态下 `player.switch` 已被观察包装，若任一桥接订阅者抛错：① 宿站自身入口（侧栏/左滑/`Ctrl+M`）触发的 `switch` 会向外抛出插件异常（撞 Boundary 4）；② `toggleMediaLoading()` 内 `succeeded` 停在 `false`，`finally` 二次 `safePoke()` 且异常冒到 `useDeck.ts:184`，在宿站已成功切换的前提下误报「切换媒体加载失败」。 | Verification-Gap #4、Edge-Case #1/#10、Adversarial #1；`src/media-progress/HostMediaBridge.ts:208-215, 397-401` | **修（fix now）**（行动项 1） | 宿站函数观察钩子一律走异常隔离出口，并配「已 hooked + 订阅者抛错」单测（行动项 6） |
| F2 | **手机展开层焦点回收 `useEffect` 同时存在「跨浮层抢焦」与「失权不回收」两个边界缺陷**。① 打开展开层后点「收藏随机」弹出上层 `ShufflePicker`（`openShufflePicker` 不关展开层），播放状态变化（停播/切直播/失权）时 `!sheet.contains(document.activeElement)` 为真，会把焦点从 `ShufflePicker` 强行抢回底层 `closeButton` 并令 `openShufflePicker.tsx:185` 置 `focusInside = false`。② 播放中仅失权（`seekable: true → false`）时，`DeckProgress.tsx:125-131` 复用同一个 `<div data-imw-deck-track>` 仅摘掉 `tabIndex`，节点仍在 `sheet` 内，`sheet.contains(activeElement)` 仍为真，焦点未被回收且 `trapFocusWithin` 误判焦点仍在层内。 | Edge-Case #6/#7、Adversarial #5、Verification-Gap #5/#6；`src/page/components/room-deck/RoomDeck.tsx:86-94`、`DeckProgress.tsx:125-131`、`openShufflePicker.tsx:183-186`、`focusTrap.ts:23-35` | **修（fix now）**（行动项 2） | 焦点回收只处理「落空到 `body`」与「层内不可聚焦节点」，绝不假定层外焦点等于焦点丢失 |
| F3 | **`useDeck.ts` 清旧提示时未清 10 秒去重表，且非媒体房延迟轮询下 `useEffect` 会立刻抹掉新提示**。① 失败提示或非媒体房提示恢复清零（`setNotice("")`）后，`notices.current` 仍留时间戳；10 秒内再次失败（例如切入睡眠态缺入口）或「非媒体房→媒体房→非媒体房」会被 `recordNotice()` 静默吞掉，违反 Criterion 5「不静默」。② 切出媒体房但 250ms 轮询尚未刷出 `mediaRoom: false` 时点击开关：`toggleMediaLoading()` 返回 `false` 且未 `safePoke()`，`useEffect([progress?.media.mediaRoom, notice])` 拿着旧 `mediaRoom: true` 秒清刚写入的 `notice`，按钮也暂不灰化。③ 换房或外部切回后旧 `MEDIA_LOADING_FAILED` 仍残留于读屏区。 | Edge-Case #3/#4、Adversarial #2/#7/#8；`src/page/components/room-deck/useDeck.ts:111-125, 175-188`、`src/media-progress/HostMediaBridge.ts:189-190` | **修（fix now）**（行动项 3） | 清除 UI 提示与清除去重键封装为单一 helper，避免状态与去重表漂移 |
| F4 | **手机展开层睡眠态收起时机在调用桥接之前，依赖可能滞后的轮询快照且抛错时会误关抽屉丢焦点**。`MiniDeck.tsx:192-194` 先据旧快照 `deck.mediaLoading.supported && media.sleepMode` 执行 `onCollapse(false, false)` 再调 `deck.toggleMediaLoading()`：若 `openMediaLoadingWhenSleep` 缺失或抛错（或 250ms 内刚退睡眠/出房），抽屉已卸载且焦点掉回 `body`，同时切走了 `role="status"` 节点；若 250ms 内刚进睡眠，快照为旧 `false` 则抽屉不收起。 | Edge-Case #5、Adversarial #3、Verification-Gap #7/#8；`src/page/components/room-deck/MiniDeck.tsx:189-195` | **修（fix now）**（行动项 3） | UI 副作用以动作实际结果为准，不凭前置轮询快照预判执行 |
| F5 | **`useDeck.ts:186` 调 `reportFailure(error, MEDIA_LOADING_FAILED)` 覆盖掉了 `HostMediaBridge` 的三条细分报错文案且无诊断日志**。`HostMediaBridge.ts:193,197,207` 分别区分「探针不可用 / 退出睡眠入口不可用 / 媒体加载开关不可用」，但在 `reportFailure.ts:22`（`fallbackMessage ?? failureMessage(error)`）下全被第二参覆盖；原始宿站异常也无 `console.warn` 留痕。 | 聚合视图 A3/A4、Adversarial #8；`src/page/components/room-deck/useDeck.ts:184-187`、`src/tools/reportFailure.ts:18-23`、`HostMediaBridge.ts:193,197,207` | **修（fix now）**（行动项 3）：透出桥接层三条细分中文提示，未知宿站异常走通用兜底并 `console.warn` 留痕 | 调 `reportFailure` 时核对第二参是「无条件覆盖」而非空值回退 |
| F6 | **`MediaLoadingToggle` 的 `Enter` 守卫漏 `!event.shiftKey`，且同底条相邻按钮未同步防宿站 `Enter` 截胡**。宿站 `window.onkeydown`（`probe3.out:104`）对所有非输入焦点的 `keyCode === 13` 调 `preventDefault()`；本票在 `MediaLoadingToggle` 上阻断冒泡（但注释写「无修饰键」却漏 `!event.shiftKey`），而 `ModeToggle`、`miniButton`（含本票放开的空闲态展开入口）与 `closeButton` 在真站按 `Enter` 仍被宿站截胡。 | 聚合视图 A4、Edge-Case #9/#11、Adversarial #9、Verification-Gap #10；`src/page/components/room-deck/deckParts.tsx:159-172`、`ModeToggle.tsx:78-88`、`MiniDeck.tsx:92-100,197-206` | **修（fix now）**（行动项 3）：补 `!event.shiftKey`，抽 `guardDeckButtonEnter` 复用到 `ModeToggle`/`MiniDeck` | 将宿站 `window.onkeydown` 截胡非输入焦点 `Enter` 写入 `AGENTS.md` Known pitfalls（行动项 6） |
| F7 | **展开层 200ms 收起滑出期间（`closing: true`）仍可点击，且 `collapse(false, false)` 无法取消已在跑的 `closeTimer`**。滑出中途若点中睡眠态开关，约 150ms 后到期的 `closeTimer` 会调用 `miniButton.current?.focus()` 把焦点从宿站确认框拉回。 | Edge-Case #8、Adversarial #6；`src/page/components/room-deck/MiniDeck.tsx:146-154`、`RoomDeck.tsx:48-61` | **修（fix now）**（行动项 3）：展开层 `closing` 期间置 `inert` + `pointer-events-none`，`collapse(false, false)` 取消在途 `closeTimer` | 无 |
| F8 | **宿站原生 `#syncConfirmHolder` 确认弹窗打开在点歌台上方时，`Esc` / 宿站返回键仍先弹出点歌台内页或关掉主面板**。`8ebf2bf` 仅在手机端收起了 `"deck"` 层，但桌面与手机在歌单内页（`"inner"`）或直接打开面板时唤起宿站确认框，按 `Esc`/返回会先关内页或主面板而把确认框留在屏幕上（设置页调用 `Utils.sync` 时亦有同类全局边界）。 | Adversarial #4；`src/page/components/desk/overlayLayers.ts:56-67, 146-156`、`MainAppControlLayer.tsx:461-471` | **推迟（defer）**（行动项 7，记入 `deferred-work.md`）：全局浮层栈与宿站 `#syncHolder` 的系统边界，后续统一设计 | 无 |
| F9 | **深色模式下关闭态底色/描边在 `sheet` 上对比偏低，且关闭态缺少悬停反馈**。图标本体对比充足（浅色 ON 6.71:1 / OFF 14.72:1；深色 ON 6.57:1 / OFF 13.51:1，辅以 `note` / `noteOff` 符号差异），但深色关态 `deskHover` (`#201E1C`) vs `sheet` (`#1C1A18`) 仅 1.04:1、`deskKeyBorder` (`#45403A`) 仅 1.69:1，且关态未拼 `hov:hover:` 反馈。 | Adversarial #11；`src/page/components/room-deck/deckParts.tsx:147-149`、`tokens.ts:25,29,87`、`DESIGN.md:493` | **接受（accept as-is）**：维护者确认 `note`/`noteOff` 符号与 13.51:1 图标亮度已够清晰，后续复盘不再重复报告 | 无 |
| F10 | **回归测试覆盖缺口**：① `src/page/index.tsx:264` 的 `if (open) bridge.poke()` 无测试；② `HostMediaBridge.ts:198-202, 208-215` 的 `finally` 兜底 `safePoke()`（未 hooked 成功路径、已 hooked 抛错路径、睡眠态 `safePoke`）删掉也不红灯；③ `useDeck.ts:182-183` 成功切换保留无关播放模式提示未测；④ 缺少「真实 `HostMediaBridge` + `RoomDeck` + `LoopController`/`ShuffleController`」的端到端集成测试（对照 `AGENTS.md`「用户可见文案必须端到端断言」）。 | Verification-Gap #1–3, #9、Adversarial #13；`src/page/index.test.ts:407-448`、`HostMediaBridge.test.ts:871-1027`、`roomDeck.test.ts:1076-1392` | **修（fix now）**（行动项 4） | 二次审查加固引入的每条新防线都须配「删改即红灯」的反向单测（行动项 6） |
| F11 | **`MainAppControlLayer.shouldComponentUpdate` 在 `init` 与 `mainAppDisplay` 合批首次打开时跳过 `applyDisplaySideEffects`，且搜索词变化时重复调用 `setPanelOpen(true)`**。常规 `ShowHideMainApp` 分两步 `setState` 不触发合批，仅 `@词` 首开路径可能命中；搜索词变化会多调一次 `bridge.poke()`。 | Adversarial #10；`src/page/MainAppControlLayer.tsx:370-373, 397-406`、`src/page/index.tsx:261-265` | **推迟（defer）**（行动项 7，记入 `deferred-work.md`；`index.tsx:264` 顺手在行动项 1 内改安全调用） | 无 |

**复核后驳回的条目（已对源码证实不成立，不路由）**：
- Adversarial #12 主假设（`Objs.emptyMediaPlayer.switch(false)` 会调用 `window.shareMedia` 或 `Utils.service.seekDemandMedia` 导致 `LoopController` 熄灭）：核对真站提取的宿站完整 `Objs.emptyMediaPlayer.switch` 源码，恢复播放直接设 `player.setAttribute("src", this.src)` / `Utils.createJsPlayer` / `shareYoutube`，不调用 `shareMedia` 也不调用 `seekDemandMedia`。
- Edge-Case #2（宿站 `switch` 执行期间自我替换并注销 hook）：宿站源码证实 `switch` 不重写自身引用。
- Edge-Case #12（plan 残留 `pr-[92px]` 笔记）：plan 为本机 git-ignore 施工草稿，非生产代码或对外规范，已在 A5 记录。

## Behavior verification

本次在 `HEAD 8ebf2bf`（已构建 `dist/bundle.js` 475.50 kB / gzip 143.01 kB）上核验：

- **自动化与 CI**：
  - `npm test`：94 个测试文件、1617 个用例全部通过（提交 `8ebf2bf` 验证，此后无源码变更）。
  - `npm run build`：`tsc -b && vite build` 零错误。
  - GitHub Actions `Build and Deploy`：`6f83400` 与 `8ebf2bf` 均为 `✓`（成功部署）。
- **真站端到端复测（Playwright 无头 Chromium + 已登录持久化 profile，实测 `HEAD 8ebf2bf` 构建产物）**：
  - **桌面 1280×720 浅色（真实空闲媒体房 `58红魔馆` `5b792cb650749_5e6abf23c3c69_5f26e3204a53d`）**：
    - 布局：`deck 1196×60`、中栏 `536px`、右栏 `260×32`（`rightOverflow: 0`）、单曲循环 `96×32`、收藏随机 `97×32`、媒体加载开关 `32×32`。
    - 开关切换：点击关闭后 `data-imw-media-loading="off"`、`title="开启媒体"`、`Probe.emptyMediaPlayer === true`，宿站侧栏 `#emptyMediaPlayerBtn` 同步变为「媒体加载 : 已关闭」、左滑面板音符类同步变为 `mdi-music-off`，`wsCount: 0`、`chatDelta: 0`，宿站原生提示「媒体加载 已关闭 / 已开启」照常；再点恢复开启，三处同步还原、`wsCount: 0`。
    - 外部双向同步：直接调 `window.functionBtnDo(90)`（侧栏）与 `window.Objs.emptyMediaPlayer.switch(...)`，点歌台按钮在 **≤50ms** 内即时同步（`observe` 钩子生效），`wsCount: 0`。
    - 真实键盘事件：`page.keyboard.press("Enter")` 与 `page.keyboard.press("Space")` 均可正常翻转开关，宿站 `window.onkeydown` 未截胡。
  - **桌面 1280×720 深色（`data-imw-theme="dark"`）**：开启态 `transparent / ink2 / rule`，关闭态 `hover / ink / keyBorder`，中性墨色不占蔷薇红。
  - **桌面窄窗 860×720（`deckWidth: 776 < 816px`）**：中栏 `256px`（≥250px），右栏 `210px`（`rightOverflow: 0`），两个模式开关缩为 `32×32` 纯图标（文字 `sr-only`，保留完整 `title`），媒体加载开关 `32×32`，三钮无裁切；长按 repeat `Enter` 被阻断且不改态。
  - **手机 400×800（真实空闲媒体房 + `8ebf2bf` 实测的真实在播媒体房）**：
    - 迷你条无媒体加载按钮；空闲态「房间暂时安静」点击迷你条主体可正常展开，`Now in room` 与进度滑块均不渲染；在播态与空闲态展开层 `overflow: 0`，标题与按钮无重叠，媒体开关 `44×44` 位于 `44×44` 收起箭头左侧（间距 4px），切换 `wsCount: 0`。
    - 睡眠模式确认流：`Probe.sleepMode = true` 时按钮呈关闭态（`off`），点击后先收起展开层并弹出宿站原生 `#syncConfirmHolder` 确认框；点「取消」维持睡眠态。
  - **非媒体房守卫**：在 `8ebf2bf` 真站页通过置 `window.mediaRoom = false` 验证了灰化（`opacity: 0.4`、`cursor: not-allowed`、`aria-disabled="true"`、可聚焦、`title="当前房间不支持媒体加载"`、连点两次仅弹 1 次提示、`switchCalls: 0`、`wsCount: 0`）；真实未改变量的非媒体房大厅实测停留在 `6f83400`（`8ebf2bf` 补充脚本中换房调用未跳离当前房）。
- **明确未验证项**：
  - 真实物理手机触屏与 iOS/Android 系统读屏软件（VoiceOver / TalkBack）。
  - 真实在播房自然播完停播的完整过渡过程（本轮分别在真实在播房与真实空闲房各走了一遍，未等待一整首歌自然播完）。
  - 同房第二账号对照（故事 Notes 已由维护者确认不要求，以单账号零 WS / 零聊天替代）。

## Previous-retro follow-through

- 本次复盘对象为独立 backlog 故事（`parent: none`），不属于 `initiative-iirose-media-web` 的 epic 序列，在 `tickets.py status` 中**没有直接的前序 epic 复盘**。
- 为保持全仓连续性，核对仓库最近一次复盘 [`epic-panel-dock-retrospective.md`](../initiative-iirose-media-web/tickets/epic-panel-dock/epic-panel-dock-retrospective.md)（第二轮，2026-11-13）的 6 条行动项在当前 `HEAD` 上的落地证据：
  1. `grow.mjs` 双击检查改用 `freezeWhen` 冻帧并断言不落面板内容（负责人：开发）— **已落地**：提交 `1563cb3`，`scripts/verify/grow.mjs:262,335,354,407`。
  2. `dock.mjs`/`grow.mjs` 固定默认 `panelEntry`、补「只用双指下滑」全屏/窗口/手机轮次、`entry.mjs` 入库、`MainAppControlLayer.test.ts` 补无胶囊收起终点（负责人：开发）— **已落地**：提交 `1563cb3`、`ab1bc02`，`scripts/verify/entry.mjs` 存在。
  3. `unsavedDock` 仅页面卸载时清并补单测（负责人：开发）— **已落地**：提交 `ee77d64`。
  4. `AGENTS.md` 补「改开合时长后重跑 `grow.mjs` 并避免写死毫秒数」与 `entry.mjs` 登记（负责人：开发）— **已落地**：提交 `d5300b7`，`AGENTS.md:44,46,59`。
  5. `epic-panel-dock` 文件规格对账并关票（负责人：Sofia / 开发）— **已落地**：提交 `d5300b7`、`20c3b44`。
  6. `F-V4`、`F-A8` 记入 `deferred-work.md` 并附帧间隔实测（负责人：开发）— **已落地**：提交 `d5300b7`，`_bmad-output/initiative-iirose-media-web/deferred-work.md` 已记录。
  - 另：`epic-panel-dock` 第二轮 Open question #3（是否写入 `adr-panel-grows-by-clipping.md`）全仓 `find` 未见该文件（**无落盘证据**）。

## Action items

以下均为维护者确认后的**待执行提议项（本次复盘未修改任何代码、规范或票据状态）**：

1. **（待修复 · 代码，F1 + F11 安全调用）** `HostMediaBridge.ts:399-401` 的 `observe(player, "switch", ...)` 改调 `this.safePoke()`，`src/page/index.tsx:264` 的 `bridge.poke()` 同样防订阅者异常穿透，避免异常影响宿站入口或让已成功的切换误报失败。负责人：开发。来源：F1、F11。
2. **（待修复 · 代码，F2）** 修正 `RoomDeck.tsx:86-94` 手机展开层焦点回收条件：仅在焦点落空（`null` / `document.body` / `document.documentElement`）或落在 `sheet` 内已不可聚焦节点（`tabIndex < 0`，如失权后的进度轨）时才收回至 `closeButton`，绝不从上层 `ShufflePicker` 等浮层抢焦。负责人：开发。来源：F2。
3. **（待修复 · 代码，F3 + F4 + F5 + F6 + F7）**
   - **F3 / F4**：`HostMediaBridge.toggleMediaLoading()` 在 `!this.host.mediaRoom` 返回前补 `this.safePoke()`，并返回明确结果枚举（例如 `"toggled" | "sleep-dialog" | "unsupported"`）；`MiniDeck.tsx:189-195` 仅在返回 `"sleep-dialog"` 时才执行 `onCollapse(false, false)`。`useDeck.ts` 清空某条 `notice` 时同步从 `notices.current` 删除对应键，按 `mediaRoom` 从 `false → true` 跳变清理 `MEDIA_ROOM_UNSUPPORTED`，换房或媒体加载态变化时清理旧 `MEDIA_LOADING_FAILED`。
   - **F5**：透出 `HostMediaBridge` 的三条细分中文报错提示（探针不可用 / 退出睡眠入口不可用 / 媒体加载开关不可用），仅对未知宿站异常走通用兜底 `MEDIA_LOADING_FAILED`，并补 `console.warn` 留痕。
   - **F6**：`deckParts.tsx:162-168` 补 `!event.shiftKey`，抽取 `guardDeckButtonEnter` 复用到 `ModeToggle` 与 `MiniDeck`（`miniButton`、`closeButton`）。
   - **F7**：展开层 `closing` 滑出期间置 `inert` + `pointer-events-none`，`RoomDeck.tsx:48-61` 中 `collapse(false, false)` 取消在途 `closeTimer`。
   负责人：开发。来源：F3、F4、F5、F6、F7。
4. **（待修复 · 测试，F10）** 补齐回归防线：① `index.test.ts` 测 `setPanelOpen(true)` 立即回读快照；② `HostMediaBridge.test.ts` 测已 hooked 订阅者抛错、未 hooked 成功 `safePoke`、睡眠态 `safePoke`；③ `roomDeck.test.ts` 测 F2 四种焦点场景（切直播 / 失权 / `ShufflePicker` 不抢焦 / 层内其他按钮不抢焦）、F3 去重恢复与换房清理、F4 非媒体房+睡眠态不收起与不抢焦、F5 细分报错透出与未知错误兜底、F6 `ctrlKey`/`metaKey`/`shiftKey` 与相邻按钮 `Enter`、F7 滑出期点击隔离、`useDeck` 保留无关播放模式提示；④ 补一条「真实 `HostMediaBridge` + `RoomDeck` + `LoopController`/`ShuffleController`」端到端集成测试，守住 `AGENTS.md` 端到端文案断言约定。负责人：开发。来源：F10。
5. **（待规格对账 · 文档，A5）**
   - 由 PO 更新 `_bmad-output/backlog/story-panel-close-media.md`：将 Notes L79 的 `Open question: 两态图标方案` 改为已定稿 `note` / `noteOff`，并在 Criterion 4 备注非媒体房 `aria-label` 附带不支持原因（与 `EXPERIENCE.md:287` 一致）；待行动项 1–4 落地验证后由 PO 标 `done`。
   - 更新 `EXPERIENCE.md:183`：在展开的底部条收起条件中补上「睡眠态点击媒体加载开关时直接收起（让位宿站退出睡眠确认框）」。
   负责人：Sofia（`bmad-agent-po`）/ 开发。来源：A5。
6. **（待更新 · 流程与规范，F1 + F6 + F10）**
   - 在 `AGENTS.md` Known pitfalls 补记：**宿站 `window.onkeydown` 在非输入框聚焦时会对 `Enter`（`keyCode === 13`）调 `preventDefault()`**，面板内需键盘 `Enter` 触发的按钮须阻断无修饰非组字 `Enter` 冒泡（并拦截长按 `repeat`）。
   - 流程约定：第二轮审查/加固新增的安全网（宿站钩子观察、`safePoke`、焦点回收、去重清零等）须同步配「删改即红灯」的反向单测，防止修补引入未覆盖分支。
   负责人：开发。来源：F1、F6、F10。
7. **（待记录 · 推迟项，F8 + F11）** 将 F8（点歌台内页/面板与宿站 `#syncHolder` 确认弹窗的全局 `Esc`/返回键让位）与 F11（`MainAppControlLayer.shouldComponentUpdate` 合批首开与搜索词重复触发 `applyDisplaySideEffects`）记入 `_bmad-output/initiative-iirose-media-web/deferred-work.md`。负责人：开发。来源：F8、F11。

## Decision records

按「难以回退、脱离上下文令人意外、是真实权衡的结果、仓库里尚无 `adr-*.md` 记录」逐项检验 `story-panel-close-media-plan.md` 中的设计决定，并沿用维护者既有口径（「已在 `AGENTS.md` / 设计规范里写明原因的，不另立 ADR」）：

1. **两态媒体加载开关采用动态动作名（「关闭媒体」/「开启媒体」）且不叠 `aria-pressed`，保持中性墨色层级不占蔷薇红**（plan Design Notes、`6f83400`、`8ebf2bf`）：理由已完整记录于 `DESIGN.md:493`、`EXPERIENCE.md:287`、`deckParts.tsx:131-132`。**维护者确认：不写入独立 ADR**。
2. **点歌台按钮隔离宿站 `window.onkeydown` 对非输入焦点 `Enter` 的 `preventDefault()`**（plan Implementation Notes、`6f83400`、`8ebf2bf`）：属宿站环境坑，记入 `AGENTS.md` Known pitfalls（行动项 6）。**维护者确认：不写入独立 ADR**。
3. **本机媒体加载与单曲循环/收藏随机解耦，且开放手机空闲态展开底部条**（plan `<frozen-after-approval>`、`6f83400`）：产品边界已明确写入故事书与 `EXPERIENCE.md`。**维护者确认：不写入独立 ADR**。

结论：**本次复盘未新增 `adr-*.md` 文件**。

## Acceptance verdict

**`accepted-with-open-items`**（`criteria: declared`，维护者确认）

- **满足项**：
  - `story-panel-close-media.md` 声明的 5 条验收标准与 4 条边界在主路径上全部通过：桌面 1280×720（浅/深色）、窄窗 860×720（`<816px`）、手机 400×800（在播与真实空闲态）均实测正常；双向实时同步（≤50ms）、零 WS / 零聊天、睡眠确认流、真实键盘 `Enter`/`Space` 全部通过；`npm test` 94 文件 / 1617 用例全绿，`npm run build` 零错，`8ebf2bf` CI 部署成功。
  - `pending_tickets` 为空（本故事已达 `built`）。
- **开放项**：
  - 已核实并由维护者批准排入收口修复的边缘缺陷与测试缺口：F1–F7、F10（行动项 1–4），以及文档对账与规范补充（行动项 5–6）与推迟项 F8、F11（行动项 7）；F9 已确认接受现状。待行动项 1–4 落地验证后再由 PO 关票。

## Open questions

无（所有路由、F5 文案策略、F9 视觉处置、ADR 口径与 `accepted-with-open-items` 验收判定均已由维护者确认；可选的 Phase 3 团队讨论按维护者选择跳过）。
