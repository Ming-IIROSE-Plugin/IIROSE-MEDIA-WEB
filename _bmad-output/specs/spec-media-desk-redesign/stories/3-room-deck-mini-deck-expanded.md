---
title: 'story 3 · 底部条、迷你条与展开的底部条'
type: 'feature'
created: '2026-10-29'
status: 'done'
baseline_commit: 'aba2f98ca69bbbe1ba824d417a3d5a9058766c76'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/specs/spec-media-desk-redesign/SPEC.md'
  - '{project-root}/_bmad-output/initiative-media-desk-redesign/ux-media-desk/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-media-desk-redesign/ux-media-desk/EXPERIENCE.md'
  - '{project-root}/_bmad-output/specs/spec-media-desk-redesign/brownfield.md'
warnings: ['oversized']
deferred:
  - summary: >-
      AGENTS.md、DESIGN.md 与 EXPERIENCE.md 尚未登记 `src/page/components/room-deck/`
      与 `data-imw-deck*` 选择器，DESIGN/EXPERIENCE 仍写「歌手 · 某某 点播」。
    evidence: |-
      底部条四件（RoomDeck / DeckProgress / ModeToggle / useDeck）与 `data-imw-deck*`
      钩子已落在代码里，但 AGENTS.md 的「Where things are」「结果区组件键」没有这一节；
      宿站没有歌手字段，代码只显示「某某 点播」，降级理由只写在 Design Notes，未进契约。
      修法要改 agent-context 文件（AGENTS.md），按本流程规则不入 patch。
    location: 'AGENTS.md · DESIGN.md:441-451 · EXPERIENCE.md:309'
    severity: low
  - summary: >-
      DESIGN 把 room-deck 固定为 300px / 1fr / 260px，桌面视口 769–~850px 时中栏进度轨被压到几乎为 0。
    evidence: |-
      竖栏 84px + 外边距 48px + 三栏与间距 636px 后，视口低于约 850px 时 `flex-1` 中栏只剩
      几十像素（两端等宽时间标签是 `shrink-0`），拖柄可视宽度趋近 0，只剩方向键可用。
      列宽是 DESIGN 的规定值，代码按稿实现，收口在设计与排版层，不适合在本 story 内单独改。
    location: 'src/page/components/room-deck/RoomDeck.tsx:200-243'
    severity: low
---

<intent-contract>

## Intent

**Problem:** 面板底部只有 story 1 留的两个 0 高度挂载点（`#imw-desk-room-deck` / `#imw-desk-mini-deck`），面板打开时看不到房间正在放什么、谁点的、进度，也无法在面板内切换单曲循环 / 收藏随机——这两件事目前只在面板关闭后的侧栏行与进度浮窗里存在。SPEC CAP-6 是唯一没有承载物的能力。

**Approach:** 新增面板内底部条三形态（桌面 `room-deck`、手机 `mini-deck` 与点主体展开的 `room-deck-expanded`），数据与跳转全部复用 `src/media-progress/`（`HostMediaBridge` + `ProgressSession` + `model.ts` 的权限判定）与页面级唯一的 `PlaybackMode`：新增一个页面级 `MediaSession` 注册表把 `initMediaProgress()` 里已有的桥接、模式状态机与「随机点亮前先开选择面板」接线共享给面板，面板只做视图，不新建轮询、不新建模式机、不新建自动播放控制器。

## Boundaries & Constraints

**Always:**
- 唯一数据源：`HostMediaBridge`（250ms 轮询 + 宿站钩子）与 `PlaybackMode` 都由 `initMediaProgress()` 创建，面板经 `MediaSession` 只读共享；跳转一律走 `ProgressSession`（`begin`/`preview`/`commit`/`step`），权限判定一律走 `unavailableReason(media)`。
- 「可跳转」= `unavailableReason(media) === ""`（有媒体权限或本人点播、已连接、在播、有总时长）；否则进度只显示：不画拖柄、不可聚焦、不响应点击与拖动。直播/电台流（`playing && duration === null`）一律不可跳转。
- 模式开关是同一个 `PlaybackMode` 的第三个视图：互斥、点亮态、待命规则、不可用原因、随机先开选择面板并 `shuffle.invalidate()` 全部照既有规则（与 `SidebarPlaybackRow` 同语义）。
- 视觉只拼 `tokens.ts` 令牌（新增 `deck-*` 颜色、`deck-label`/`deck-title*` 字号、底部条专用焦点环），手机断点一律 `max-[768px]`，可点目标 ≥44px。
- 面板内拖动/点击不得冒泡成宿站手势或面板翻页（复用 `stopHostGestures`）。
- 现有行为存活：侧栏行与进度浮窗不受影响；`Alt+S`、搜索、结果区、模式快照不变。

**Never:**
- 不新建第二个 `HostMediaBridge`、`PlaybackMode`、`LoopController`、`ShuffleController` 或任何轮询（含复用 `nowPlaying.ts` 的 1s 轮询做底部条）。
- 不改 `MediaProgress.tsx` 的结构与行为（配色归 story 8）；不改 `src/playback/*` 的规则；不重构 `SidebarPlaybackRow`。
- 不做手机操作条（story 4）、不做 `Esc`/宿站返回键的逐层关闭（story 4）、不做选集面板（story 5）、不改结果区（story 2）与设置/关于（story 7）。
- 不自绘 toast；提示只走 `ShowMessage.show`。不新增依赖、不新增 SCSS、不加载网络字体、不用 emoji、不借宿站 `mdi-*`。
- 不新增歌手/艺人数据源，也不为此改宿站 DOM 读取之外的解析。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| 会话尚未提供 | 面板先挂载、`initMediaProgress()` 未执行 | 底部条不渲染（无 DOM） | 会话提供后订阅回调立即渲染，无需重开面板 |
| 桌面有播放 | 视口 >768px、`playing`、有权限 | 三栏 `room-deck`：封面 + `Now in room` 标签 + 标题 + 「某某 点播」；中栏当前时间 · 轨道 · 总时长；右栏两组带文字开关 | — |
| 本人点播 | `ownMedia` 为 true | 点播者行显示「由你点播」，进度可拖动 | — |
| 他人点播、无媒体权限 | `controlMode === "unavailable"` | 时间照常走，轨道无拖柄、不可聚焦、点击无效 | 不提示、不改任何报文 |
| 直播/电台流 | `playing && duration === null` | 中栏换「直播」徽章 + 等宽已播时长，无轨道与总时长 | 不可跳转 |
| 房间无播放 | `playing === false` | 封面位 thumb 底 + note 图标、标题「房间暂时安静」、无点播者行、无轨道；开关照常显示 | — |
| 手机迷你条 | 视口 ≤768px、有播放 | 顶边 3px 进度线（仅显示）+ 封面 44 + 标题 + 「某某 点播 · 01:38」+ 两个图标开关 | 直播时不画进度线、副行不带时间 |
| 展开 | 点迷你条主体（开关以外） | 向上展开三行完整底部条，压在列表与标签栏之上，`role="dialog"`，焦点进收起钮 | 房间无播放时点主体不展开 |
| 收起 | 点收起钮 / 点展开区外 / 切模式 / 关面板 | 收起并把焦点还给迷你条主体 | — |
| 模式开关 | 点亮其一点亮另一 / 再点熄灭 | 与侧栏行、进度浮窗状态一致（同一个 `PlaybackMode`） | 不可用时点击提示原因（同因 10s 一次） |
| 收藏随机熄灭态 | 点「收藏随机」 | 先开收藏随机选择面板；确认后 `shuffle.invalidate()` 并点亮，取消不变 | 确认时已不可用 → 提示原因，保持熄灭 |
| 待命 | 已点亮、当前曲目由他人点播 | 保持点亮但不动作，`title` 与读屏状态区给出待命原因；首次点按只提示原因，再点才熄灭 | — |
| 进度拖动 | 指针按住轨道拖动 / 释放 | 拖动中时间跟随预览，释放提交；取消（`pointercancel`、窗口失焦）回到原时间 | 发送失败静默回原时间，不刷屏 |
| 键盘 | 轨道聚焦后 ←/→ 或 Shift+←/→ | 每次 −5s/+5s，Shift 为 ∓30s | 不可跳转时轨道不可聚焦 |

</intent-contract>

## Code Map

- `src/media-progress/model.ts` -- `MediaSnapshot`（L4–23）本 story 增 `owner: string`（点播者昵称，用于「某某 点播」）；`ownMediaOf`/`unavailableReason`（L162–170）/`formatTime`/`seeking` 命令族不改。
- `src/media-progress/HostMediaBridge.ts` -- `read()` L89–148 已读 `#shareMediaUserName` 的 `title` 判归属；同一个值同时写入新字段 `owner`（trim），不新增复查。`subscribe`（L150–164）是唯一 250ms 轮询；`send`（L166–203）是唯一发送口。**禁止**再 new 一个桥接。
- `src/media-progress/ProgressSession.ts` -- 跳转的唯一入口：`begin`/`preview`/`commit`/`step`/`cancel` + `ProgressState{media,preview,waiting,message}`；构造即订阅桥接，暴露 `preview` 供拖动中显示。
- `src/media-progress/MediaSession.ts`（新） -- 页面级注册表：`provideMediaSession` / `releaseMediaSession` / `mediaSession` / `subscribeMediaSession`，承载 `{bridge, playback, pickShuffle}`。只做引用共享，不持有时钟。
- `src/page/index.tsx` -- `initMediaProgress()` L54–224 是桥接、`PlaybackMode`、`SidebarPlaybackRow`、`ShuffleController`、`LoopController` 的唯一构造处；`pickShuffle` 现内联在 L116–131。抽出 `openShuffle(returnFocus, done)` 供侧栏行与 `MediaSession` 共用；`dispose()` L84–108 里释放会话。
- `src/playback/PlaybackMode.ts` -- `state{mode, loop, shuffle, standby, standbyReason, cleared}`、`toggle`、`subscribe`；开关视图只读它，不改它。`availability("loop")` 在没有媒体（`present === false`）时不可用，`present` 由 `SidebarMediaEntry.onMediaChange` 驱动，本 story 不接管。
- `src/playback/SidebarPlaybackRow.ts` L110–155 -- 开关点击语义的参照实现（可用性提示、待命首次点按只说明、随机先开面板、10s 同因去重）；面板版按 Preact 重写，不共享 DOM 逻辑。
- `src/page/components/shuffle-picker/openShufflePicker.tsx` L209 -- `openShufflePicker({defaultPage, returnFocus, onConfirm, onCancel})`；确认前须 `shuffle.invalidate()`（现由 `page/index.tsx` 的回调完成）。
- `src/page/components/floating-panel/tokens.ts` -- 令牌唯一来源；本 story 补 `deskDeckSurface`(浅色 ink 底 / 深色 sheet-dark 底)、`deskDeckText`、`deskDeckRing`、`deskDeckProgress`、`deskDeckTrack`、`deskDeckToggleBorder`、`deskDeckThumbRing`、`deskFocusRingOnDeck` 与 `typeDeckLabel`/`typeDeckTitle`/`typeDeckTitleMini`。现有 `deskRoseSolid`/`deskOnRose`/`deskInk2`/`deskThumb`/`rounded*`/`touchMin` 直接用。
- `src/page/components/floating-panel/floatingPanel.tsx` L143–149 -- `stopHostGestures`（触摸/鼠标事件 stopPropagation），底部条根节点复用，避免被宿站双指手势与 `MediaContainerGesture` 翻页识别。
- `src/page/components/media-card-container/Cover.tsx` -- 封面复用点：https 升级、`onerror` 回退 `deskThumb` + 自包含图标、内环；底部条传 50/44px 与 `roundedSm`。
- `src/page/MainAppContainer.tsx` L352–360 -- 两个挂载点占位（`#imw-desk-room-deck` `max-[768px]:hidden` / `#imw-desk-mini-deck` 反之），本 story 换成 `<RoomDeck active={this.props.active} mode={this.state.mode} />`；容器与列是 `relative`+`overflow-hidden`，展开层与拦截层都用挂载点内的 `absolute`（`top-[-100vh]` 由 `overflow-hidden` 裁到面板顶），不依赖 `transform` 包含块。
- `src/page/components/desk/DeskNavigation.tsx` L128–144 -- 手机标签栏（`max-[768px]:order-last`），迷你条在其上方；底部条视觉参照竖栏/标签栏的令牌用法。
- `src/page/MainAppControlLayer.tsx` L190–207 -- `Esc` 现直接关面板（story 4 改逐层），本 story 不碰。
- `src/playback/fixtures.ts` -- 共享快照工厂，model 加字段只需改这一处。
- 测试参照：`src/page/components/desk/deskShell.test.ts`（令牌成对 + 源码零裸值 + `h()` 渲染）、`src/media-progress/MediaProgress.test.ts` L57–118（伪造宿站 `window` + 伪 `ResizeObserver` 的样板）、`src/page/MainAppContainer.test.ts` L1–90（子组件桩的写法）。

## Tasks & Acceptance

**Execution:**
- `src/media-progress/model.ts` `src/media-progress/HostMediaBridge.ts` `src/playback/fixtures.ts` -- `MediaSnapshot` 增 `owner: string`，`read()` 用同一个 `#shareMediaUserName` 读取填值（`ownMedia` 判定不变） -- 底部条要显示「某某 点播」，不许新增 DOM 轮询。
- `src/media-progress/MediaSession.ts`（新） -- 页面级 `{bridge, playback, pickShuffle}` 注册表 + 订阅；`provide`/`release` 幂等，`release` 只清自己 -- 面板与页面单例之间的唯一接口。
- `src/page/index.tsx` -- 抽出 `openShuffle(returnFocus, done)`（内含 `shuffle.invalidate()`），侧栏行与 `MediaSession.pickShuffle` 共用；构造后 `provideMediaSession`，`dispose()` 里 `releaseMediaSession` -- 复用既有接线，不复制随机流程。
- `src/page/components/floating-panel/tokens.ts` -- 补 `deck-*` 颜色、底部条焦点环与三段字号（全部浅深成对） -- 组件零裸值。
- `src/page/components/room-deck/useDeck.ts`（新） -- 订阅 `MediaSession`（初始无会话时返回空）、一个 `ProgressSession`、`PlaybackMode.state` 订阅、开关激活（可用性提示 / 待命首次说明 / 随机先开面板 / 10s 同因去重）与 `notice` 出口 -- 底部条的全部状态逻辑集中在一处，视图保持无状态。
- `src/page/components/room-deck/DeckProgress.tsx`（新） -- 桌面与展开态共用的进度部件：可跳转时 `role="slider"` + 指针拖动（capture/preview/commit/cancel）+ ←→ ±5s、Shift ±30s；不可跳转或直播时不渲染拖柄、不可聚焦（直播另由父组件出徽章） -- 复用 `ProgressSession`，不复刻浮窗的 150 行输入态机。
- `src/page/components/room-deck/ModeToggle.tsx`（新） -- 带文字（桌面/展开）与纯图标（迷你条）两种形态，`aria-pressed`/`aria-disabled`/`title`、44px 点击区、点亮为 `deskRoseSolid` -- 一处样式，三处复用。
- `src/page/components/room-deck/RoomDeck.tsx`（新） -- 三形态渲染 + 展开状态机（点主体展开、收起钮/点外侧/切模式/关面板收起、焦点移入收起钮并归还迷你条）、直播态/空闲态、读屏状态区（待命原因与最后一条会话消息，`sr-only` `role="status"`） -- CAP-6。
- `src/page/MainAppContainer.tsx` -- 用 `<RoomDeck active mode>` 替换两个占位 div（保留两个 id 作为三形态的挂载点） -- 接线。
- `src/page/components/room-deck/roomDeck.test.ts`（新） -- 覆盖 I/O 矩阵：无会话不渲染→提供后渲染、桌面三栏与点播者两种文案、无权限只读、直播态、空闲态、迷你条与展开收起（焦点归还）、开关点亮互斥与随机先开面板、10s 去重、键盘步进、拖动提交/取消、`Role`/`aria` 与 44px、源码零裸值 -- 矩阵全覆盖。
- `src/media-progress/MediaSession.test.ts`（新） -- `provide`/`release`/重复释放/订阅通知 -- 注册表契约。
- `src/media-progress/HostMediaBridge.test.ts` -- 补 `owner` 断言（有昵称、空白、缺失三种） -- 新字段的唯一生产处。
- `src/page/MainAppContainer.test.ts` -- 确认容器在无会话时仍可渲染（底部条空渲染），必要时加桩 -- 既有断言不受影响。

**Acceptance Criteria:**
- Given 面板打开且房间在播、桌面宽度 >768px，when 观察底部条，then 三栏内容（封面/标签/标题/点播者、时间·轨道·时长、两个带文字开关）齐全，且「某某 点播」与 `#shareMediaUserName` 一致，本人为「由你点播」。
- Given 无媒体权限且当前曲目由他人点播，when 在轨道上按下或按方向键，then 不发送任何报文、时间不变，轨道不带 `role="slider"` 且不可聚焦。
- Given 当前媒体无总时长（直播/电台），when 观察底部条与迷你条，then 桌面/展开态显示「直播」徽章 + 已播时长且无轨道与总时长，迷你条不画顶边进度线且副行不带时间。
- Given 房间无播放，when 观察底部条，then 显示「房间暂时安静」、无点播者行与轨道，两个开关仍在；点迷你条主体不展开。
- Given 手机宽度 ≤768px 且有播放，when 点迷你条主体，then 展开 `role="dialog"` 的三行底部条且焦点在收起钮；点收起钮或展开区外 then 收起且焦点回到迷你条主体。
- Given 在底部条点亮「单曲循环」，when 打开面板关闭后的进度浮窗或看侧栏开关行，then 同一模式已点亮（单一 `PlaybackMode`），再点熄灭。
- Given 「收藏随机」熄灭，when 点它并取消选择面板，then 保持熄灭、不发报文；确认后 then 点亮。
- Given 房间 `mediaShareRoom === false` 或媒体不可用，when 点任一开关，then 宿站提示一次原因，10 秒内重复点击不再提示。
- Given 轨道可跳转且聚焦，when 按 → / Shift+←，then 分别快进 5 秒 / 快退 30 秒（走现有跳转命令），拖动松手提交、`pointercancel` 取消。
- Given 底部条相关源码与渲染结果，when 检查，then 不含 `themed`/`accentVar`/`bg-[#…]` 裸值/`rgba(`，无 emoji 与宿站 `mdi-*`，手机可点目标 ≥44px。
- Given 仓库，when 运行 `npm test` 与 `npm run build`，then 全绿。

## Spec Change Log

## Review Triage Log

### 2026-10-30 — Review pass

- verdicts: 32 findings — high 0, medium 4, low 25, false 3, maybe-false 0
- findings:
  - `[low]` `[patch]` `status` 取 `notice || progress.message || standbyReason`，`notice` 置位后永不条件 → 读屏状态区永久停在第一条提示，待命原因与后续会话消息播不出来 — 实测 `message()` 只 `setNotice`，无清除路径；改为三源并列拼接 + 同文本去重（补用例：旧提示不掩盖后续消息）。
  - `[low]` `[reject]` 未消费 `state.waiting`，等待宿站确认的 5 秒内拖动与方向键静默无效且无禁用态 — 现象真实，但 DESIGN `room-deck` 没有状态行，加可见禁用态要新增视觉与状态面；浮窗的 `disabled` 来自它自己的布局，不构成底部条必须跟随的依据。
  - `[low]` `[reject]` `progress.message` 只进 `sr-only`、失败无可见反馈 — EXPERIENCE 明确提示只走宿站提示层、设计未给底部条状态行；把会话消息落成可见文字属新增界面，不是直接修正。
  - `[low]` `[patch]` `media.controlNotice` 被丢弃：本人点播模式下调整会在房间发公聊消息，浮窗有这句提示 — 可跳转时把它作为滑块 `title`（一行），补有/无两种断言。
  - `[medium]` `[patch]` 展开层 `role="dialog"` 无焦点循环、无 `aria-modal`，Tab 会走到拦截层背后的结果区 — 与 EXPERIENCE「浮层打开时焦点移入并循环」冲突；补 `aria-modal="true"` 与 Tab 首尾循环（补用例）。
  - `[low]` `[reject]` 转屏跨过 768px 后 `expanded` 残留、焦点落到 body — 焦点丢失是既有 `max-[768px]` 纯 CSS 布局的固有代价，补 `matchMedia` 订阅与清理超出直接修正；story 2 同类项（`isPhoneLayout` 无订阅）已按同一理由 reject。
  - `[low]` `[patch]` 空闲态迷你条主体仍带 `aria-haspopup="dialog"`/`aria-expanded`，而 `openDeck` 拒绝展开 — 读屏被告知一个永远打不开的对话框；空闲态去掉 popup 语义与 `aria-expanded`。
  - `[low]` `[patch]` 桌面组与展开层 `aria-label` 恒为「房间正在播放」，空闲态内容却是「房间暂时安静」 — 名称随状态（有播放/无播放），补断言。
  - `[low]` `[patch]` `DeckLabel` 把 `opacity-[0.55]` 放在外层，7px 蔷薇红圆点一起变淡 — DESIGN `deck-label` 的 55% 只约束标签文字、圆点是 `{colors.rose}`；不透明度移到文字上。
  - `[low]` `[reject]` 直播徽章内联重写（`h-5 px-2`），与 `VideoTile` 的 `px-1.5 py-0.5` 不一致，且未落成令牌 — 两处都只拼 tokens（`deskRoseSolid`/`deskOnRose`/`roundedXs`/`typeMonoPill`），令牌纪律成立；统一要跨 story 2 的卡片组件抽共享件，属重构。
  - `[low]` `[patch]` `progressSession` 经 `useRef` 传给视图，ref 变化不触发渲染，首帧滑块拿到 `null` 会话、拖动静默失效 — 改放进 state（与 #12 同轮修）。
  - `[low]` `[patch]` 渲染期 `session.bridge.read()` 是第二个未订阅的快照来源，`emptyProgress` 只有这一个调用点 — 去掉渲染期 `read()` 与 `emptyProgress`，模型只在 `progress` 就绪后返回。
  - `[low]` `[patch]` 两处 `role="status"` 在面板关闭（`translateX` 移出视口）时仍在无障碍树里，房间换曲会向正在聊天的读屏用户播报 — 只在 `active` 为真时渲染状态区。
  - `[low]` `[patch]` 测试缺项与脆选择器（`querySelectorAll("div")[3]` 定位轨道） — 轨道加 `data-imw-deck-track`，宽度与 `owner` 空串、失焦取消等缺项在 #23–#25 一并补。
  - `[low]` `[reject]` 文档口径：Code Map 写「展开层用面板内 `fixed`」，实现是 `absolute` + `top-[-100vh]` — 判定成立但修法是改本 spec，按规则不接受为 patch；正文 Design Notes 与 Code Map 的表述已按实现更正（不涉及代码）。
  - `[low]` `[patch]` `mode` prop 无注释，易与播放模式混淆 — 补一行「面板当前模式，仅用于切模式时收起展开层」。
  - `[low]` `[reject]` （与 #6 同一情形，边缘层重复上报）转屏后展开层残留 — 同上：属于纯 CSS 断点布局的固有代价，补订阅超出直接修正。
  - `[low]` `[patch]` `media.current === null` 且有总时长时渲染 0:00 与空轨，而迷你条同一状态不显示时间 — 口径分裂；无 `current` 且无预览时时间显示 `--:--`、填充 0（补用例）。
  - `[low]` `[patch]` `aria-valuenow` 未夹到 `aria-valuemax`，宿站时钟漂移时会读出越界位置 — 用夹取后的 `position`（补用例）。
  - `[low]` `[patch]` （与 #7 同一情形）空闲态仍有 `aria-haspopup` — 同轮修：空闲态去掉 popup 语义。
  - `[false]` `[reject]` `MediaSession.notify` 里某个监听抛错会中断其余监听并让 `provideMediaSession` 抛出，跳过 `loop.attach()` 与 pagehide 注册 — 全仓唯一订阅者是 `useDeck` 的 `setSession`（Preact setState 不抛），`PlaybackMode.publish`/`HostMediaBridge.emit` 同样不做隔离；无法构造可达路径。
  - `[medium]` `[patch]` 生产接线（`index.tsx` 的 `provideMediaSession`/`releaseMediaSession`）没有任何测试：换成空实现后 810 条用例仍全绿，底部条整体消失而 `npm test` 依旧通过 — 补一条 `IMCInit.init` 后会话非空、`bridge.read().title` 取自 `#shareMediaSongName`、面板内出现 `[data-imw-deck="room"]`，pagehide 后会话为 null。
  - `[medium]` `[patch]` 进度填充宽度从未断言（`percentOf` 恒 0 也全绿），迷你条顶边线与桌面轨道只断言存在 — 用已知比例断言两处宽度。
  - `[low]` `[patch]` `owner: ""`（宿站没有点播者 title）分支无用例（默认夹具恒有昵称） — 补一条不渲染 `[data-imw-deck-requester]`。
  - `[low]` `[patch]` 拖动被窗口失焦打断的取消路径无测试 — 补一条：pointerdown 后 `window` 派发 blur，时间回原值且未发报文。
  - `[low]` `[patch]` 共享夹具默认 `owner: "小飞鱼"` 与 `ownMedia: true` 自相矛盾（真实桥接里两者同源），正是 `owner` 空串分支长期未被发现的直接原因 — 默认 `owner` 改为 `""`。
  - `[low]` `[reject]` （与 #15 同一情形）文档 `fixed`/`absolute` 口径不一致 — 同上：修法是改本 spec，不按 patch 处理；正文已按实现更正。
  - `[low]` `[reject]` 模式策略层被复制且不完整：`cleared`（换房熄灭原因）与「上帧点亮→本帧不可用」的补提示只在 `SidebarPlaybackRow` 消费 — 侧栏行始终挂载并已消费 `cleared`，底部条再发会重复弹同一条宿站提示（Design Notes 已记此决定）；状态机本身仍是唯一 `PlaybackMode`。
  - `[medium]` `[patch]` 「底部条开关与侧栏行/浮窗是同一个 `PlaybackMode`」这条核心约束没有任何测试（现有用例只在 `room` 与 `mini` 两个形态之间自洽，天然成立） — 补一条：同一 `PlaybackMode` 上建 `SidebarPlaybackRow` 并 provide 会话，点底部条开关后侧栏行 `aria-pressed` 为 true（反向亦然）。
  - `[low]` `[reject]` 测试替身 `FakeBridge.send` 重造了 `HostMediaBridge.send` 的四道闸，理论上「把手写命令塞给替身」也能过 — 底部条只调 `ProgressSession` 的 `begin/preview/commit/step`，报文形状由 `OwnerMediaControl`/`HostMediaBridge` 的既有测试守门，替身替代的是宿站 DOM 读取；再补一份真桥接只为消除理论替代路径。
  - `[false]` `[reject]` 底部条新建第二个 `ProgressSession`（与浮窗并存）违反「复用一个跳转会话」 — 意图禁止的是「第二个自动播放控制器」；`ProgressSession` 是单个 UI 的手势与发送边界，浮窗本来也是各自一份，`HostMediaBridge.send` 与 `PlaybackMode` 仍唯一（Design Notes 已记）。
  - `[false]` `[reject]` `duration === 0` 时既非直播也非可跳转，会渲染 0:00 空轨，与迷你条口径分裂 — 生产桥接的 `read()` 已把非正时长归一成 `null`（`duration: raw > 0 ? raw : null`），该组合只有手造夹具可达。

### 2026-10-30 — 复审（follow-up pass）

- verdicts: 35 findings — high 0, medium 3, low 28, false 4, maybe-false 0
- findings:
  - `[medium]` `[patch]` 全局 `.IIROSE_MEDIA_CONTAINER * { transition: all .5s }` 作用在进度填充与拖柄的内联 `width`/`left` 上，250ms 一次的快照加上 500ms 过渡让拖动预览落后半秒、正常播放也长期偏移 — 确认：`src/app.css:272` 的通配过渡无差别命中新加的填充/拖柄；给桌面填充、拖柄与迷你条顶边线加内联 `transition: "none"`（内联优先于通配规则）。
  - `[false]` `[reject]` `seekable` 由 true 变 false 时不取消进行中的手势，预览会停在旧值 — 反证：让 `seekable` 变 false 的那次快照本身就带非空 `unavailableReason`，`ProgressSession.receive` 在 `changedMedia || changedMode || reason` 分支调用 `clearOperation()`，`preview`/`gesture` 一并清空（`ProgressSession.ts:67-75`、`214-221`）；残留的 `pointer.current` 下次 pointerdown 即被覆盖，blur 处理器是幂等的。
  - `[low]` `[reject]` `commit()` 立刻撤销乐观预览，读屏/键盘没有即时反馈 — 现象真实但属既有口径：进度浮窗同样取 `preview ?? media.current`（`MediaProgress.tsx`），要改的是 `ProgressSession` 的等待期语义（浮窗共用），不是底部条的直接修正。
  - `[low]` `[patch]` `notice` 置位后没有任何过期或清除路径，读屏状态区长期挂着已失效的原因 — carried：与上一轮第 1 条同一位置同一 claim，上轮已改成三源并列 + 同文本去重，`message()` 仍只 `setNotice`、与行所述一致；按规则不再重复修。
  - `[low]` `[reject]` 底部条 `toggle` 与 `SidebarPlaybackRow.activate` 策略漂移（不消费 `cleared`、无「上帧点亮→本帧不可用」补提示） — carried：与上一轮第 29 条同一 claim；`cleared` 由始终挂载的侧栏行消费一次，底部条再发会重复弹宿站提示（Design Notes 已记）。
  - `[low]` `[reject]` 切模式收起时 `collapse(true)` 把焦点从标签栏挪到迷你条主体 — 与 intent 矩阵「收起 | … 切模式 … 焦点还给迷你条主体」明文字面冲突，代码按契约实现；改行为即偏离 intent，改文档也不属 patch。
  - `[low]` `[patch]` 播放中打开展开层后房间停播，展开层不收起、拦截层继续盖着列表（入口禁止无播放展开，出口却不收） — 确认：`expanded` 只由收起钮/外侧/切模式/关面板复位；补一条 `idle` 时 `collapse(false)` 的 effect 与用例。
  - `[low]` `[reject]` `percentOf` 与 `DeckProgress` 各写一份比例夹取，口径不同 — 反证：`current === null`、`duration <= 0`、`current > duration` 三种输入两处输出一致（`percentOf` 夹 0–100，`DeckProgress` 先 `clamp(position, 0, duration)`），无可见差异；抽共享件要新增 model 导出，属重构。
  - `[false]` `[reject]` 次级文字 `text-[12px] opacity-60` 与 `rounded-t-[16px]` 是裸值、违反 CAP-1 — 反证：令牌纪律约束的是颜色（`bg-[#…]`/`rgba(`/`themed*`/`accentVar`），`12px` 与 `16px` 都在 DESIGN 允许的字号/圆角档位内，且没有形状可复用的守卫（`roundedXl` 是四角 16px，不能拿来做仅上两角）。
  - `[false]` `[reject]` 拖柄 `left: 100%` 时半圆越过轨道、被右侧总时长压住 — 反证：轨道与时间标签之间是 `gap-3`（12px），拖柄半径 6px，端点处不外溢到文字上；以位置为中心、端点出半圆是该画法本身。
  - `[low]` `[reject]` 新增 `repeat` 图标与侧栏行的 MDI repeat-one 图形不一致 — 路径自带中央竖线，20px 下与 repeat-one 同义；DESIGN 的 `symbol` 表只列名字没给路径，改成一模一样的 Material 路径是新的设计决定而非修正。
  - `[false]` `[reject]` `data-imw-mode` 与侧栏行 dataset 重名，`document.querySelector` 会命错 — 反证：全仓唯一消费方是 `SidebarPlaybackRow` 的 `target.closest("button[data-imw-mode]")`（在自己元素内解析，`SidebarPlaybackRow.ts:90`），测试也都在元素内查询；没有全局选择器，冲突路径不可达。
  - `[low]` `[reject]` 迷你条图标钮视觉 44×44，DESIGN 写 40×40 + `touch-min` 点击区 — 偏差真实但只是 4px；改成 44 点击区包 40 视觉盒要加一层结构，不是直接修正，且 44 在 62px 高的条内不挤。
  - `[low]` `[patch]` 没有任何用例证明底部条会释放桥接订阅，cleanup 写坏时 827 条用例仍会全绿 — 确认：`afterEach` 只 `render(null, host)`，`FakeBridge` 没有监听者计数；补 `listenerCount` getter 与一条「卸载后监听数回到挂载前 -1」的用例。
  - `[low]` `[defer]` 文档未同步：AGENTS.md 缺 `room-deck/` 与 `data-imw-deck*`，DESIGN/EXPERIENCE 仍写「歌手 · 某某 点播」 — 修法要改 agent-context 文件，按规则入 deferred。
  - `[low]` `[patch]` 展开层的点播者行缺少 `data-imw-deck-requester` 钩子（桌面有），两种形态无法用同一套钩子断言；`role="dialog"` 也没有 id / `aria-controls` — 钩子不一致确认；补齐钩子并加断言（`aria-controls` 非必需，不加）。
  - `[low]` `[patch]` （边缘层同一情形）播放中打开展开层后停播不收 — 同第 7 条，同一轮修。
  - `[low]` `[reject]` 转屏跨过 768px 后 `expanded` 残留、焦点落到 body — carried：与上一轮第 6/17 条同一情形；纯 CSS 断点的固有代价，补 `matchMedia` 订阅超出直接修正。
  - `[low]` `[patch]` 手机收起态没有任何 `role="status"`：桌面那块被 `display:none` 移出无障碍树，展开层又只在打开时存在，提示与待命原因在手机上无人播报 — 确认；在迷你条内补一块 `active && !expanded` 时的 `sr-only` 状态区，展开后由展开层自己播报（不并存）。
  - `[low]` `[patch]` （边缘层同一情形）`notice` 不清 — 同第 4 条，carried。
  - `[low]` `[reject]` 「待命已当面说明」的标志是每视图一份（底部条说明过，侧栏行再点还会再说明一次） — 现象真实但属复制策略层的已知取舍（Design Notes）；收敛它要把标志提升进 `PlaybackMode`，而 intent 的 Never 明写「不改 `src/playback/*` 的规则」，修法被意图排除。
  - `[low]` `[reject]` （claim）关面板时 `collapse(false)` 不归还焦点，与「收起…焦点还给迷你条主体」不一致 — 关面板时面板正在移出视口，把焦点还给视口外的迷你条更糟（代码有注释）；唯一正确修法是澄清 spec 文本，而「修法是改本 spec」的发现按规则不接受为 patch。
  - `[low]` `[reject]` （claim）展开层刻意不盖住标签栏，与「压在列表与标签栏之上」不一致 — 「压在…之上」可读作层级在上（`z-[1]`）而非遮挡；改成遮挡会吃掉一次点击、破坏 EXPERIENCE「切模式即收起」，且 diff 与 Design Notes 已明确记录该决定；修法仍是澄清 spec 文本。
  - `[low]` `[reject]` （claim）底部条不消费 `cleared` 与「点亮→不可用」补提示 — 同第 5 条，carried。
  - `[medium]` `[patch]` 页面接线只测了「会话非空 + 桥接可读 + 底部条出现」，`session.playback` 与 `session.pickShuffle` 两个字段没有任何断言：写成 `new PlaybackMode()` 或空函数仍然全绿 — 确认；补两条走真实 `IMCInit.init` 的用例：`setAvailability` 后点侧栏行能反映到 `session.playback`、点底部条「收藏随机」必须张开真实选择面板并在取消后回焦。
  - `[medium]` `[patch]` `MainAppContainer` 的 `active` / `mode` 转发没有任何会跑的用例（`MainAppContainer.test.ts` 从不提供会话，`useDeck` 直接返回 null）— 确认；补一条先 `provideMediaSession` 再看关面板与切模式都收起展开层的用例（已实测：把 `active` 写成 `true` 时该用例失败）。
  - `[low]` `[patch]` `stopHostGestures` 零覆盖（intent 的 Always 里唯一没有测试承载的一条）— 确认：测试文件里没有 `touch*`；补一条在 `room`/`mini` 上派发触摸与鼠标事件、断言 document 处理器不被调用的用例。
  - `[low]` `[reject]` 断点（>768 / ≤768）只由类名字符串间接证明，jsdom 里两种形态同时存在并被同时断言 — 结构性限制：jsdom 没有布局引擎，改成 `matchMedia` 才能断言等于换布局实现，代价大于收益；真机清单已覆盖（Verification 的手动检查）。
  - `[low]` `[reject]` 展开层的叠加与裁剪（`top-[-100vh]` + 列 `overflow-hidden`）在任何测试里不可判，而 intent 把它写成几何期望 — 同一根因（jsdom 无布局），测试只能证明「点这个节点会收起」；几何靠真站手动检查。
  - `[low]` `[defer]` 桌面三栏 300/1fr/260 在 769–~850px 视口把中栏进度轨压到近乎为 0 — 确认（视口 800 时固定部分 636 + 竖栏 84 + 外边距 48 已吃掉全部宽度）；列宽是 DESIGN 的规定值，代码按稿实现，改宽度/加断点是设计层收口，入 deferred。
  - `[false]` `[reject]` 迷你条副行写 `1:38` 而 intent 矩阵示例是 `01:38` — 反证：DESIGN 的 `time` 只指定 `mono-num-sm`，没有补零规定，`formatTime` 是浮窗与桌面栏的同一格式器；矩阵里的是排版示例。
  - `[low]` `[reject]` （与第 22 条同一 claim）关面板不归还焦点 — 同一情形，合并判定。
  - `[low]` `[reject]` AC 里「打开面板关闭后的进度浮窗或看侧栏开关行」的前半句没有承载物：`MediaProgress.tsx` 根本没有模式 UI — 确认（`grep loop|shuffle|PlaybackMode` 无命中），这是 intent 对现状的事实描述有误，不是代码缺陷；修法是改 spec/intent 文本。
  - `[low]` `[reject]` 展开层声明 `aria-modal="true"`（上一轮补的）但背后标签栏保持可交互，等于「声明模态却不惰性化背景」 — 两者都是刻意的（Tab 已在层内循环，标签栏留作一次性切模式入口）；要么撤掉 `aria-modal`（回退上一轮已合入的修复）要么惰性化背景（吃掉那次点击），都不是直接修正。
  - `[low]` `[reject]` `lostpointercapture` 与「发送失败静默回原时间」在底部条面无用例 — 确认，但两段语义都在 `ProgressSession`/`HostMediaBridge` 自己的用例里（`HostMediaBridge.test.ts:681` 覆盖发送失败），底部条不另写口径。

## Design Notes

**为什么需要 `MediaSession` 注册表**：`PlaybackMode`、`HostMediaBridge` 与「随机先开面板」的接线都活在 `initMediaProgress()`（页面级单例，`src/page/index.tsx`），而底部条活在 Preact 树里（`MainApp → MainAppContainer`）。`IMCInit.init` 先渲染面板、再 `initMediaProgress()`，所以底部条挂载时会话可能还不存在：注册表带订阅，提供后立刻重渲染，不需要重开面板。第二个桥接被明确禁止——`HostMediaBridge` 会给宿站 `shareMedia`/`seekDemandMedia` 装钩子并起 250ms 轮询，两份会互相打断（story 2 已因同一理由拒绝复用 `HostMediaBridge` 做结果区高亮）。

**为什么底部条自己建 `ProgressSession` 而不复用浮窗那个**：`ProgressSession` 是「一个 UI 的手势与发送边界」（`begin/commit` 自带预览与 5s 确认窗口），浮窗与底部条不会同时被拖动；各自持一份就是既有用法。真正的唯一性在 `HostMediaBridge.send`（命令白名单、实例与模式校验）与 `PlaybackMode`（点亮态）。

**与侧栏开关行的关系**：两者是同一状态机的两个视图，不共享 DOM 逻辑。侧栏行是命令式 DOM（宿站侧栏），底部条是 Preact；把「激活」抽成共享模块会牵动 `SidebarPlaybackRow.test.ts`（464 行）的既有断言，收益不抵风险。重复的只有「读 `PlaybackMode.state` → 提示 / 待命说明 / 随机先开面板」这一层不含新规则的胶水。

**换房提示只在侧栏行发**：`PlaybackMode.state.cleared` 由侧栏行消费一次（它始终挂载）。底部条再消费会重复弹两次宿站提示，所以底部条只处理「点击时的不可用原因」与「待命原因的读屏文本」。

**直播判定**：宿站对直播/电台不给总时长，`duration === null && playing` 就是直播态；这与 `unavailableReason` 的「直播或时间未知，无法调整进度」同源，因此「不可跳转」不需要第二套判定。

**点播者文案**：宿站只暴露标题（`#shareMediaSongName`）与点播者昵称（`#shareMediaUserName[title]`），没有歌手字段；底部条写「某某 点播」而不是 DESIGN 示例里的「歌手 · 某某 点播」，不为此另造数据源。

**展开层定位**：迷你条挂载点保留 `relative` 与 62px 占位；展开层在挂载点内用 `absolute inset-x-3 bottom-0` 从同一位置向上长，压在列表之上。点外侧的拦截层同样是挂载点内的 `absolute inset-x-0 bottom-0 top-[-100vh]`，由列的 `overflow-hidden` 裁到面板顶部——**刻意不盖住手机标签栏**，这样点标签栏是「一次点击切模式」，切模式本身立即收起（EXPERIENCE「切换模式…也收起」），而不是先吃掉一次点击。层级只在面板内部排序（挂载点 `z-[1]`），不另设 z-index 根。

**为什么不做 `active` 门控**：桥接的 250ms 轮询由页面级 `unsubscribePlayback` 常驻订阅，底部条再省一份订阅省不下时钟，却会带来「打开面板首帧空」的闪烁；面板关闭时它反正被移出视口。

## Verification

**Commands:**
- `npm test` -- expected: 全部通过（含新增 `roomDeck.test.ts`、`MediaSession.test.ts`）
- `npm run build` -- expected: `tsc -b && vite build` 无错误
- `npx prettier --check src/page/components/room-deck src/media-progress src/page/index.tsx src/page/MainAppContainer.tsx` -- expected: 无差异

**Manual checks (if no CLI):**
- 真站（视频分享房）1280×720 与 400×800 × 宿站浅/深色：底部条取色与 DESIGN `room-deck` 一致（浅色墨底纸字、深色 sheet 底 + 细线环）；有权限时拖动进度轨宿站时间跟随；他人点播时只读；直播/电台显示徽章；手机点迷你条展开、点外侧收起；开关与侧栏行/浮窗同步。


## Auto Run Result

**本轮（2026-10-30 复审 follow-up pass）**：对已 `done` 的 story 3 做第二轮独立复审（盲审 / 边缘 / 验证缺口 / 意图对齐四层，35 条发现），落地 8 处小修与补测，代码主体不变。

**改动文件**

- `src/page/components/room-deck/DeckProgress.tsx` -- 进度填充与拖柄加内联 `transition: "none"`，绕开 `.IIROSE_MEDIA_CONTAINER *` 的 0.5s 通配过渡（拖动预览不再滞后半秒）。
- `src/page/components/room-deck/RoomDeck.tsx` -- 迷你条顶边线同样绕开通配过渡；房间停播时自动收起展开层；迷你条补 `active && !expanded` 的 `sr-only` 状态区（手机收起态才有播报）；展开层点播者行补 `data-imw-deck-requester` 钩子。
- `src/page/components/room-deck/roomDeck.test.ts` -- `FakeBridge` 增 `listenerCount`；补 6 条用例：卸载后释放桥接订阅、触摸/鼠标不冒泡到 document、停播收起展开层、展开层点播者钩子、迷你条状态区、面板关闭不播报。
- `src/page/index.test.ts` -- 补 2 条走真实 `IMCInit.init` 的接线用例：`session.playback` 与侧栏行同一实例、底部条「收藏随机」张开真实选择面板并在取消后回焦。
- `src/page/MainAppContainer.test.ts` -- 补 1 条提供会话的用例：`active` / `mode` 透传到 `RoomDeck`，关面板与切模式都收起展开层（已实测把 `active` 写死成 `true` 时该用例失败）。

**发现分类**（35 条：high 0、medium 3、low 28、false 4、maybe-false 0）

- 本轮 patch 8 条：medium 3（通配过渡吞掉拖动反馈；生产接线的 `playback`/`pickShuffle` 无断言；`active`/`mode` 透传无用例）、low 5（停播不收展开层；订阅释放无断言；展开层缺钩子；手机收起态无状态区；`stopHostGestures` 零覆盖）。
- 延后 2 条（已写入 frontmatter `deferred`）：文档未同步 `room-deck/` 与点播者文案；桌面 300/1fr/260 在 769–850px 视口压扁中栏。
- 驳回 5 条 `false`：手势不取消、比例两份实现、令牌「裸值」、拖柄端点、`data-imw-mode` 重名（各附反证）。
- 驳回 20 条 `low`（含 4 条 carried）：多为既有口径（浮窗同语义）、jsdom 无布局引擎的结构性限制、或修法要改本 spec / 改 `src/playback/*` 而被 intent 排除。

**后续复审建议**：`false` —— 本轮无 `high` 级修复（follow-up pass 只在修掉 `high` 时才建议再看一轮）；8 条 patch 均为局部、有断言覆盖，无遗留未验证风险。

**验证**

- `npm test` -- 46 个文件、827 条全绿（含新增 9 条用例）。
- `npm run build` -- `tsc -b && vite build` 无错误（`dist/bundle.js` 418.24 kB / gzip 125.70 kB）。
- `npx prettier --check` 覆盖 `room-deck`、`media-progress`、`index.tsx`、`index.test.ts`、`MainAppContainer.tsx`、`MainAppContainer.test.ts` -- 无差异。
- 破坏性对照：把 `<RoomDeck active={this.props.active}` 改成 `active={true}` 后新用例失败，改回后通过（证明接线确实被守住）。

**残余风险**

- 真站表现（拖动跟手、展开层几何、深浅色取色）仍只有手动检查清单，本轮未跑真机。
- 转屏跨 768px 的 `expanded` 残留仍是纯 CSS 断点的固有代价（沿用上轮驳回结论）。
