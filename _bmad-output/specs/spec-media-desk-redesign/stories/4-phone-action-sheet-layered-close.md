---
title: 'story 4 · 手机操作条与逐层关闭'
type: 'feature'
created: '2026-10-30'
status: 'done'
baseline_commit: 'e9dfd246c04c8baf8b30c954b3d5751522e25458'
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
      新的层级约定未写进 AGENTS.md：面板内浮层（操作条 / 展开的底部条 / 顺序菜单 / 内页）必须在
      `desk/overlayLayers` 登记一层，`Esc` 与 `Utils.backward` 由它单点调度，禁止再用 DOM 探针
      或自管 `document` 捕获监听，浮层焦点规则走 `desk/focusTrap`。
    evidence: |-
      `src/page/components/desk/overlayLayers.ts` 与 `focusTrap.ts` 已落地并被四处复用，但 AGENTS.md
      的「Where things are」「Known pitfalls」没有这一节；后续 story（5 选集面板、6 收藏/电台、
      7/8 浮窗）最容易重新写回「各层互相猜」的判据。修法要改 agent-context 文件，按流程规则不入 patch。
    location: 'AGENTS.md · src/page/components/desk/overlayLayers.ts'
    severity: low
---

<intent-contract>

## Intent

**Problem:** 手机上点曲目行 / 视频缩略图 / 音乐网格卡的主体仍然**直接点播**（story 2 为了让点击不落空，先回落成点播），既没有「收藏」「选集」入口，也没有「先看清楚再决定」的一步。同时整个面板没有层级概念：内页 `Esc` 靠 DOM 探针 `[data-imw-order-menu]` 让位、顺序菜单自带一份 `document` 捕获监听、展开的底部条**完全没有** `Esc`（按下直接关掉整个面板），宿站返回键（`Utils.backward`）从未被接管——按一下就把人扔出房间。

**Approach:** 在面板内建一个轻量层级栈：操作条、展开的底部条、顺序菜单（三者互斥、面板内最上层）与专辑/歌单内页各登记一层，`Esc` 与宿站返回键（照 `openShufflePicker` 的接管写法）共用同一套「每次只关最上一层」的调度；新增手机操作条 `ActionSheet`（点播到房间 / 收藏·取消收藏 / 选集），挂在主面板内部、压在迷你条与标签栏之上。

## Boundaries & Constraints

**Always:**
- 关闭顺序固定：操作条 / 展开的底部条 / 顺序菜单（同一层，三者互斥）→ 专辑/歌单内页 → 主面板。`Esc` 与宿站返回键都**每按一次只关最上一层**。
- 操作条只随主面板出现：住在主面板内部（面板 `transform` 建立的包含块内用 `fixed`），**不新设 z-index 根**、不改主面板 90000；主面板关闭 / 切模式时一并收起。
- 宿站返回键接管照 `openShufflePicker`：`Utils.backward` 每页只包装一次（函数对象标记防重复注入），无待关闭层时把调用原样交还原函数；插件不读写浏览历史（不碰 `history` / `popstate`）。
- 浮层（操作条、展开的底部条）打开时焦点移入并在其中 `Tab` 循环；关闭后归还触发元素；触发元素本身不可聚焦时归还其内部第一个可聚焦后代（手机曲目行体就是这种情形）。
- 收藏走 `FavoritesStorageService.toggle`（与 `FavoriteStar` 同一存储与墓碑）；房间不支持点播（`roomSupportsRequest()` 为 false）时首项 40% 灰化但保留可点，点击提示「这个房间不支持点播」且**不发送报文、不收起**。
- 手机断点一律 `max-[768px]`、可点目标点击区 ≥44px；颜色 / 字号 / 圆角只取 `tokens.ts` 成对令牌；面板内浮层都挂 `stopHostGestures`，拖动与点击不冒泡给宿站手势。
- 现有行为存活：桌面行体点击仍不动作、行内点播胶囊与卡内「点播到房间」不变、`switchToMultiPage` 钻取与返回、顺序菜单正序/乱序整单点播、底部条三形态与进度跳转、收藏与收藏随机、`Alt+S`、双指下滑。

**Never:**
- 不做选集面板（story 5）：操作条的「选集」沿用现有 `switchToMultiPage` 钻取；不新增任何 `buildSelect2` 调用，也不动 `IIROSEUtils` 的有序多选接管代码。
- 不改结果区卡片外观与桌面交互、不改底部条视觉与进度逻辑、不改设置/关于页、不改两个浮窗配色。
- 不自绘 toast（提示只走 `ShowMessage.show`）、不新增依赖 / SCSS / 网络字体 / emoji / 宿站 `mdi-*` 类。
- 不新建自动播放控制器、第二个 `PlaybackMode` 或任何轮询。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| 手机点行体 | ≤768px，点曲目行点播钮以外的区域 | 操作条从底部升起：条目封面 + 标题 + 副行，下列「点播到房间」「收藏」 | — |
| 手机点视频缩略图 / 音乐网格卡 | 同上 | 同一操作条 | — |
| 多 P / 多集条目 | `multiPage` 有值 | 多一行「选集」 | `multiPage` 拒绝或为空 → 不显示「选集」 |
| 已收藏条目 | `FavoritesStorageService.isFavorited` 为真 | 第二项文案为「取消收藏」 | 不可收藏条目（无收藏 id）→ 不显示收藏项 |
| 选「点播到房间」 | 房间支持点播 | 执行当前范围的点播（行内点播同一路径）、收起、焦点归还 | 房间不支持 → 提示一次、不发报文、保持打开 |
| 选「收藏 / 取消收藏」 | — | 立即切换并收起；星标与收藏列表随之更新 | 切换失败静默回滚，不刷屏 |
| 选「选集」 | 多 P / 多集 | 收起并进入内页（`switchToMultiPage`） | 同上，防止死点击 |
| 点操作条外 | 操作条打开 | 收起、焦点归还触发元素 | 点条目内不冒泡 |
| `Esc` | 操作条打开 | 只关操作条；内页与面板不动 | — |
| 宿站返回键 | 操作条打开 | 只关操作条，宿站不执行返回 | 宿站无 `Utils.backward` → 操作条照常可用 |
| `Esc` / 返回键连按 | 顺序菜单 → 内页 → 面板；展开的底部条 → 面板 | 每次只关最上一层，最后才关面板 | 无外层现场时内页层不挡 `Esc`（放行给面板） |
| 展开的底部条 + 操作条 | 先展开迷你条，再点某行 | 操作条打开时展开层先收起（互斥）；反向亦然 | — |
| 切模式 / 关面板 | 操作条打开 | 一并收起，焦点不留在屏幕外 | — |
| `Tab` | 操作条 / 展开的底部条打开 | 焦点在浮层内循环，不落到背后列表与标签栏 | — |
| 桌面 | >768px 点行体 / 卡主体 | 行为完全不变（行体不动作、卡片按既有规则） | — |

</intent-contract>

## Code Map

- `src/page/MainAppControlLayer.tsx` -- 根节点、`data-imw-theme`、`Alt+S`/`Esc`（`:190-207`，`Esc` 无条件 `setState({mainAppDisplay:false})`）、`applyDisplaySideEffects`（`:102-139`，开/关面板的唯一副作用点）。本 story：在开关时登记 / 注销「面板返回处理器」，`Esc` 加 `defaultPrevented` / `isComposing` 守卫。
- `src/page/MainAppContainer.tsx` -- 结果区宿主与内页状态机。`handleInnerPageEscape`（`:135` 注册、`:183-192` 实现，含 `[data-imw-order-menu]` DOM 探针）整体换成层级登记；`handleRowActivate`（`:194-201`，现为直接点播）改为开操作条；`render` 的列容器 `:271-272`（`relative flex h-full min-h-0 w-full flex-col overflow-hidden`）是面板内浮层的包含块，`RoomDeck` 在 `:353-354`；`switchToMultiPage` `:655-739`、`switchToOutFromMultiPage` `:744-757`、`playCollectionAll` `:219-228`、`applyMode` `:441-469`（切模式）。
- `src/types/page/props-and-state/MainAppContainer.d.ts` -- `MainAppContainerState`（`:12-34`）：新增操作条现场字段（条目 + 触发元素）。
- `src/page/components/media-container-context/MediaContainerContext.tsx` -- 五个成员，`onRowActivate` 的签名在这里定形状；唯一消费者 `ResultsArea.tsx:100-105`。
- `src/page/components/media-card-container/ResultsArea.tsx` -- `activate`（`:193-197`，`isPhoneLayout()` 门控）是操作条的唯一挂点；`play` `:185-191`、`openCollection` `:199-202` 是操作条要复用的两条动作。
- `src/page/components/media-card-container/TracklistRow.tsx` -- 行体 `onClick`（`:145-150`，`data-imw-tracklist-row`，无 `tabIndex`）、`onActivate` prop 声明 `:119-130`、点播按钮 `:92-117`（`stopPropagation` 后才 `onPlay`）。
- `src/page/components/media-card-container/MusicTile.tsx` `VideoTile.tsx` -- 卡体按钮 `handleBodyClick`（`MusicTile.tsx:74-85`、`VideoTile.tsx:75-86`）：`isTapToReveal` → `isPhoneLayout` → `onPlay`；「选集」入口 `MusicTile.tsx:137-148` / `VideoTile.tsx:152-163`。
- `src/page/components/media-card-container/mediaFormat.ts` -- `isPhoneLayout`（`:77-79`，`matchMedia` 每次调用现读）、`hasMultiPage`（`:64`，异步）、`isCollectionItem`（`:47`）。
- `src/page/components/media-card-container/roomSupport.ts` -- `roomSupportsRequest` / `notifyRoomUnsupported`（灰化与提示的唯一出口）。
- `src/page/components/media-card-container/OrderMenu.tsx` -- 自管 `Esc`（`:76-84`，`document` 捕获 + `stopPropagation`）、透明拦截层 `fixed inset-0 z-40`（`:103-108`，因面板 `transform` 而面板相对）、手机底部条形态 `:109-126`、焦点移入/归还 `:54-63`。本 story：改用层级登记，删掉自管监听。
- `src/page/components/media-card-container/CollectionHeader.tsx` -- 「全部播放」的 `open` 状态（`:49`）与渲染 `:136-147`：菜单打开时登记「顺序菜单」层，并先收起别的面板层。
- `src/page/components/room-deck/RoomDeck.tsx` -- `expanded` 私有状态（`:92-100`）、`collapse`（`:102-106`）、只由 `mode`/`active`/空闲/拦截层/收起钮收起（`:109-127`、`:336-342`、`:382`）、Tab 陷阱 `:138-160`、挂载点 `#imw-desk-mini-deck`（`:260-262`，`relative z-[1]`）。本 story：展开时登记「展开的底部条」层（`Esc` 从此可收起它），展开前收起别的面板层，Tab 陷阱换共享件。
- `src/page/components/desk/focusTrap.ts`（新） -- 从 `RoomDeck.tsx:138-160` 抽出的 `trapFocusWithin(event)` + `restoreFocus(element)`（不可聚焦时取内部第一个可聚焦后代），两处浮层共用。
- `src/page/components/desk/overlayLayers.ts`（新） -- 层级栈与两个键：`Esc` 的 `document` 捕获监听（栈非空时装、空时卸）与宿站 `Utils.backward` 包装（`openShufflePicker.tsx:57-89` 是参照实现：函数对象标记 `__imwShufflePickerBackHook`、页面级槽位、无面板时 `apply` 原函数）。**不要**复用随机面板的槽位键（它自管一层）。
- `src/page/components/action-sheet/ActionSheet.tsx`（新） -- 操作条视图。外观令牌：`deskSheet` / `deskRule` / `deskInk` / `deskInk2` / `deskInk3` / `deskRose` / `deskRoseFill` / `roundedXl` / `typeLabel` / `typeLabelStrong` / `typeMonoCaption` / `deskFocusRing` / `deskFocusRingOnRose` / `touchMin`；封面复用 `media-card-container/Cover.tsx`；手势隔离 `floatingPanel.tsx:135-149` 的 `stopHostGestures`；图标 `DeskIcon`（`play` / `star` / `starf` / `list`）。
- `src/app.css` -- `@keyframes` 区（`:259-268`）加操作条升起动画；`@media (prefers-reduced-motion: reduce)` 下取消位移动画。通配过渡 `.IIROSE_MEDIA_CONTAINER *`（`:271-273`）会作用在浮层上，瞬变属性要像 `room-deck/DeckProgress.tsx` 那样内联 `transition: "none"`。
- 既有测试：`src/page/MainAppContainer.test.ts`（`:288-297` 手机 `matchMedia` 桩、`:409-429` 顺序菜单探针用例、`:555-611` 底部条接线）、`src/page/MainAppControlLayer.test.ts`、`src/page/components/media-card-container/mediaCards.test.ts`（`:620-681` 菜单 `Esc` / 点外侧；`:33-43`、`:250-288` 源码零裸值哨兵）、`src/page/components/room-deck/roomDeck.test.ts`（`:121-132` 键盘派发、`:392-428` Tab 循环）、`src/page/components/shuffle-picker/openShufflePicker.test.ts`（`:1226-1336` `Utils.backward` 打桩与只装一次）。

## Tasks & Acceptance

**Execution:**
- `src/page/components/desk/overlayLayers.ts`（新） -- 层级栈：`pushOverlayLayer(kind, dismiss)` 返回注销函数、`dismissTopOverlay()`、`closePanelTier(kind)`（互斥：收起其它面板层）、`setPanelBackHandler(fn | null)`；`Esc` 在栈非空时装 `document` 捕获监听并 `preventDefault + stopPropagation`，事件源在 `#imw-shuffle-picker-root` / `#imw-media-progress-root` 内时放行；宿站返回键包装带标记、每次只关一层、无层时关面板、面板关着时交还原函数 -- CAP-14 单点调度。
- `src/page/components/desk/focusTrap.ts`（新） -- `trapFocusWithin` 与 `restoreFocus`，`RoomDeck` 迁过来 -- 两处浮层共用一套焦点规则。
- `src/page/components/action-sheet/ActionSheet.tsx`（新） -- 拦截层 + 底部升起面板（条目摘要、三项选项、首项蔷薇红、灰化态）、`role="dialog"` + `aria-modal` + 焦点移入/循环/归还、`stopHostGestures`、`max-[768px]` 下 ≥44px 行高、`prefers-reduced-motion` 退化为淡入 -- CAP-7 视图。
- `src/page/MainAppContainer.tsx` -- `handleRowActivate` 改为「收起别的面板层 → 记下条目与触发元素 → 打开操作条」；`render` 挂 `<ActionSheet>`（仅在 `props.active` 且有条目时）；`active=false` / 切模式 / 进内页时收起；内页层改用 `pushOverlayLayer("inner", …)` 并删 `handleInnerPageEscape` 与 DOM 探针 -- CAP-7 / CAP-14 接线。
- `src/types/page/props-and-state/MainAppContainer.d.ts` -- 新增 `sheetItem: PlatformData | null` 与触发元素字段 -- 状态形状。
- `src/page/components/media-container-context/MediaContainerContext.tsx` -- `onRowActivate` 增「触发元素」参数 -- 焦点归还需要。
- `src/page/components/media-card-container/ResultsArea.tsx` `TracklistRow.tsx` `MusicTile.tsx` `VideoTile.tsx` -- 行体 / 卡体点击把 `event.currentTarget` 传给 `activate`，`isPhoneLayout()` 门控与桌面分支不变 -- 触发元素到达容器。
- `src/page/components/room-deck/RoomDeck.tsx` -- 展开时登记「展开的底部条」层（注销即随收起）、`openDeck` 先 `closePanelTier("deck")`、Tab 陷阱换 `trapFocusWithin` -- 互斥 + `Esc`/返回键可收起。
- `src/page/components/media-card-container/CollectionHeader.tsx` `OrderMenu.tsx` -- 菜单打开时登记「顺序菜单」层并先收起别的面板层；`OrderMenu` 删自管 `Esc` 监听（层级栈接管），桌面定位与形态不变 -- 顺序菜单进入同一调度。
- `src/page/MainAppControlLayer.tsx` -- 面板开 / 关时 `setPanelBackHandler`，卸载时清空；`Esc` 加 `defaultPrevented` / `isComposing` 守卫，仍只在层级栈为空时关面板 -- 返回键与面板生命周期。
- `src/app.css` -- 操作条升起 `@keyframes` + `prefers-reduced-motion` 取消 -- DESIGN「从视口底部升起」。
- 测试 -- 新增 `src/page/components/desk/overlayLayers.test.ts`（LIFO、只关一层、互斥、`Esc` 装/卸、外来浮层根放行、返回键包装只装一次 / 无层交还）；`src/page/components/action-sheet/actionSheet.test.ts`（矩阵逐行：三选项与显隐、灰化与提示、点外侧 / `Esc` 收起、焦点移入与归还、Tab 循环、44px、零裸值）；改写 `MainAppContainer.test.ts` 的菜单探针用例并补「手机行体开操作条 / 点播 / 收藏 / 选集 / 切模式与关面板收起 / 内页 `Esc`」；`roomDeck.test.ts` 补「展开后 `Esc` 收起」「互斥」；`mediaCards.test.ts` 的菜单 `Esc` 改走层级栈；`MainAppControlLayer.test.ts` 补返回键接管（打开时只关层、关着时 `Utils.backward` 仍被调用）-- 矩阵全覆盖。

**Acceptance Criteria:**
- Given 手机宽度 ≤768px 且房间在播，when 点某曲目行点播钮以外的区域，then 操作条从底部升起、压在迷你条与标签栏之上、焦点在「点播到房间」，且行内没有多出任何按钮。
- Given 操作条打开，when 点「点播到房间」，then 走与行内点播相同的链路并收起操作条，焦点回到触发元素（或其内部第一个可聚焦元素）。
- Given 房间 `mediaShareRoom === false`，when 点操作条首项，then 不发送任何报文、提示「这个房间不支持点播」、操作条不收起。
- Given 单 P 视频与多 P 视频各开一次操作条，when 观察选项，then 前者无「选集」、后者有且点击后进入内页。
- Given 已收藏条目，when 打开操作条，then 第二项为「取消收藏」；点击后收藏状态立即变化并收起操作条，即使 `toggle` 失败也不向用户报错刷屏。
- Given 操作条打开，when 按 `Esc` 或触发宿站返回键，then 只关操作条，内页与主面板都不动，宿站返回不执行；再按一次才关下一层。
- Given 手机展开的底部条打开，when 按 `Esc` 或返回键，then 展开层收起而不是关掉面板。
- Given 展开的底部条打开，when 打开操作条，then 展开层先收起；反向操作同理。
- Given 专辑/歌单内页，when 连按 `Esc`，then 先返回外层结果、再关面板，中间顺序菜单打开时 `Esc` 只关菜单。
- Given 任一浮层（操作条 / 展开的底部条），when 按 `Tab` 与 `Shift+Tab`，then 焦点在浮层内首尾循环，`Esc` 关闭后焦点回到触发元素。
- Given 操作条 / 展开的底部条源码与渲染结果，when 检查，then 不含 `themed` / `accentVar` / `bg-[#…]` 裸值 / `rgba(`，无 emoji 与宿站 `mdi-*`，手机可点目标 ≥44px，且新浮层都在主面板内部（无新的 `z-index` 根）。
- Given 面板关闭或切模式，when 操作条当时打开，then 一并收起。
- Given 仓库，when 运行 `npm test` 与 `npm run build`，then 全绿。

## Spec Change Log

## Review Triage Log

### 2026-10-30 — Review pass

- verdicts: 24 findings — high 0, medium 1, low 16, false 7, maybe-false 0
- findings:
  - `[low]` `[patch]` 两个 `Utils.backward` 包装器只看各自标记，随机面板之后再重开面板会再包一层，链路整个会话越叠越长 — 确认：`ensureBackHook` 只在自身标记命中时提前返回。改为模块级「每页只装一次」标志（委托给安装时的前一个函数），并补用例断言重开面板后 `Utils.backward` 引用不变且返回键仍只关一层。
  - `[false]` `[reject]` 操作条实例在 `sheetItem` 变更时被复用（无 `key`），`returnFocus` 与初值停在第一条 — 运行期不可达：打开操作条后拦截层 `fixed inset-0 z-40` 盖住整个面板，第二次点行体无法发生；关掉再开是卸载重挂，`useEffect` 重新跑。
  - `[low]` `[reject]` 操作条不跟随 768px 断点收回（竖屏打开后转横屏会留一个浮层）— 现象成立，但可点外侧/`Esc` 收起；story 3 同类项（展开层跨断点残留）已按「纯 CSS 断点的固有代价、补 `matchMedia` 订阅超出直接修正」驳回，此处同一根因同一结论。
  - `[low]` `[reject]` `openInnerPage` 对 `setState` 返回值 `await`，且与 `ResultsArea.openCollection` 各有一份两行胶水 — 确认但无行为差异（`await undefined` 只是微任务）；合并入口要改 context 面与结果区调用点，超出直接修正。
  - `[false]` `[reject]` `isCurrentInMultiPage` 先置真、`switchToMultiPage` 的 else 分支只认 `platform === "video"`，可能停在内页 — 生产上 `multiPage.platform` 只有 `neteasemusic`（`isSongList`/`isAlbum` 分支先命中）、`bilibili`（`platformData.bilibili` 分支先命中）、`video`（else 分支处理）三值，不存在落空组合。
  - `[low]` `[reject]` 选「选集」后焦点还给即将被销毁的行内按钮，最终落到 `body` — 手机唯一入口、行体本身不可聚焦（开操作条前焦点也不在那里），要修得在内页挂载后再移交焦点，属新增行为而非直接修正。
  - `[false]` `[reject]` 互斥收起时被收起浮层的卸载清理会把焦点从新浮层抢回去 — 前置组合不可达：操作条打开时拦截层挡住行/卡，展开的底部条打开时它自己的拦截层挡住列表，二者都不能再触发顺序菜单或操作条。
  - `[low]` `[reject]` `rounded-t-[16px]` 与 `min-h-[44px]` 是裸值、绕过令牌哨兵 — 值与 DESIGN 圆角/点击区档位一致；`roundedXl` 是四角、无上角令牌，story 2（OrderMenu 的 `min-h-[44px]`）与 story 3（`rounded-t-[16px]`）已在评审中按同一理由接受。
  - `[low]` `[reject]` `prefers-reduced-motion` 与 `env(safe-area-inset-bottom)` 没有断言 — 两个类串都在且由 Tailwind 直接消费；本 story 的 AC 未覆盖该变体，为它另加断言不改变任何行为。
  - `[low]` `[patch]` `MainAppControlLayer.shouldComponentUpdate` 里「打开与初始化合批」的返回键分支不可达 — 确认：`ShowHideMainApp` 先 `await setState({init:true})`，初始化那一帧必然先落地；删掉该分支，安装只走显示状态变化路径（新增用例改为打开→关闭→再打开，走真实路径）。
  - `[low]` `[patch]` `FavoriteStar` 新增的 `onChange` 订阅零覆盖 — 补用例：捕获 `onChange` 回调、翻转 `isFavorited` 桩、触发回调，断言仍挂载的星标 `aria-pressed` / `aria-label` / `star-on` 同步翻转。
  - `[low]` `[defer]` 新的层级约定（面板内浮层登记一层、`Esc` 与 `Utils.backward` 单点调度、禁用 DOM 探针与自管捕获监听、焦点走 `desk/focusTrap`）未写进 `AGENTS.md` — 修的是 agent-context 文件，按规则入 deferred。
  - `[low]` `[reject]` `aria-modal="true"` 没有配 `inert` / `aria-hidden` 背景 — 与 story 3 展开层同一情形，评审已按「声明模态但不惰性化背景是刻意取舍」驳回。
  - `[low]` `[reject]` 面板关闭/切模式收起操作条时，`restoreFocus` 会把焦点还给移出视口的触发元素 — 与 story 3「关面板不归还焦点」同源的取舍：触发元素仍在文档里、指针与读屏下一次操作即离开；跳过归还要给 `restoreFocus` 注入面板可见性判断，超出直接修正。
  - `[low]` `[patch]` `handleEscape` 不看 `event.repeat`，按住 `Esc` 会一路关到面板 — 确认；重复事件只吞不动作，补用例（一次按键 + 两次 `repeat` 只关一层）。
  - `[false]` `[reject]` `ensureBackHook` 返回值被忽略，宿站 `Utils` 晚于面板打开时整场都拦不住 — 每次开/关面板都会经 `applyDisplaySideEffects` 重新调 `setPanelBackHandler`，也就重新尝试安装；`Utils` 一旦出现，下一次打开即生效。
  - `[false]` `[reject]` 无 `key` 导致操作条初值过期（与第 2 条同一情形）— 同上：运行期无法在打开状态下换条目。
  - `[medium]` `[patch]` `onRowActivate: this.handleRowActivate` 这条 provider 交接没有任何测试：改成 `() => {}` 时 868 条用例仍全绿，手机点行体开操作条整条链路无人守门 — 确认（容器测试的 `ResultsArea` 桩不读 context，结果区测试用的是自造 ctx）。把桩改成读 `MediaContainerContext` 并就绪一个按钮调用 `onRowActivate(item, el)`，补一条「点它 → 出现 `[data-imw-action-sheet]`」的用例；破坏性对照已做（把值换成空函数时该用例失败）。
  - `[low]` `[patch]` 操作条 `init()` 之后重读收藏状态的分支零覆盖 — 补用例：挂载时 `init` 挂起、`isFavorited` 仍为 false，随后翻成 true 并 resolve，断言第二项变「取消收藏」。
  - `[low]` `[reject]` 随机面板的槽位键在两侧各写一份字面量，改名会静默失去委托 — 键在两侧都有注释互指，且已有「槽位占用时交给随机面板」的用例；抽共享常量要让 `overlayLayers` 依赖随机面板模块，属重构。
  - `[low]` `[reject]` 返回键两种包装先后顺序没有测试，只在注释里推理 — 补这种用例要引入真实 `openShufflePicker`（404 行 + 独立根）；两种顺序的行为都由「槽位占用即委托」一条覆盖，收益不抵成本。
  - `[false]` `[reject]` 层级顺序由登记时间决定，内页可能压住展开的底部条 — 前置组合不可达：展开层打开时它自己的拦截层盖住列表，无法再进内页；先内页后展开时展开层登记在上，`Esc` 正好先收展开层（与规格一致）。
  - `[false]` `[reject]` 「星标与收藏列表随之更新」中列表那一半没有接线 — 收藏模式取消收藏后该行保留到离开模式/改筛选（CAP-9 明文要求），即时重载列表反而违背规格；星标即时更新已由上一行用例守住。

## Design Notes

**为什么需要层级栈，而不是继续用 DOM 探针**：现在有三处 `Esc` 判据互不相识——`MainAppContainer` 捕获阶段探 `[data-imw-order-menu]`、`OrderMenu` 自己再装一个捕获监听、`MainAppControlLayer` 在 `window` 冒泡无条件关面板；展开的底部条则完全不参与。加第三、第四个浮层时这种「各层互相猜」必然出错，所以改成一张显式表：谁打开谁登记一层，`Esc` 与返回键都只问「最上层是谁」。

**`Esc` 监听为什么是 `document` 捕获**：面板内浮层都渲染在面板里，而随机面板与播放进度浮窗是 `document.body` 下的独立根（z 90010 / 90001），它们在**自己元素上**处理 `Esc`。捕获阶段在最前，所以栈监听必须先放行这两处的来源事件（按根节点 id 判定），否则随机面板里的 `Esc` 会先被面板内的内页层吃掉。

**为什么返回键要先看一眼随机面板**：随机面板是单槽位包装（`openShufflePicker.tsx:73-89`）。正常情况下它比面板打开得晚，天然在外层；但「面板关着从侧栏打开随机面板 → 再 `Alt+S` 打开面板」时它反而在里层，此时把调用交还原函数（即随机面板的包装）才能让返回先关它。

**为什么操作条用 `fixed` 而不是列内的 `absolute`**：DESIGN 要求它压住迷你条与标签栏，而列容器只到标签栏之上。面板根 `.IIROSE_MEDIA_CONTAINER` 有 `transform`，`fixed` 后代的包含块就是面板本身，因此 `fixed inset-x-0 bottom-0` 正好落在面板底边、覆盖标签栏，同时仍在面板的层叠上下文里（OrderMenu 的拦截层是同一做法）。这不算新 `z-index` 根：用 `z-40` 与顺序菜单同级，不另建 fixed 根节点。

**互斥怎么落地**：三者都是「面板内最上层」，共用 `closePanelTier`。不把 `expanded` / `open` 提升为受控 prop——那会牵动 story 3 的 827 条既有断言，而登记/注销各两行就够。

**焦点归还到「触发元素」的实际含义**：手机曲目行体是 `<div>` 且没有 `tabIndex`（story 2 的 Tab 顺序要求），`focus()` 对它无效。因此 `restoreFocus` 先试自身，不可聚焦就取内部第一个可聚焦后代（那一行就是「点播」胶囊），这样键盘用户与读屏用户都不会掉回 `body`。

## Verification

**Commands:**
- `npm test` -- expected: 全部通过（含新增 `overlayLayers.test.ts`、`actionSheet.test.ts` 与改写的容器/菜单/底部条用例）
- `npm run build` -- expected: `tsc -b && vite build` 无错误
- `npx prettier --check src/page src/page/components/action-sheet src/page/components/desk src/app.css` -- expected: 无差异

**Manual checks (if no CLI):**
- 真站（视频分享房）400×800 × 宿站浅/深色：点曲目行 / 视频缩略图 / 音乐网格卡出操作条，取色与 DESIGN `action-sheet` 一致（sheet 底 + 上两角 16px + 顶部细线）；点外侧、`Esc`、宿站返回键各关一层；展开迷你条后点行，展开层先收起；关面板与切模式一并收起。

## Implementation Log

**改动文件**

- `src/page/components/desk/overlayLayers.ts`（新） -- 层级栈 `pushOverlayLayer` / `dismissTopOverlay` / `closePanelTier` / `hasOverlayLayers` / `setPanelBackHandler`：栈非空才装 `document` 捕获 `Esc`（`preventDefault + stopPropagation`，放行 `#imw-shuffle-picker-root` / `#imw-media-progress-root` 来源的事件，忽略 `isComposing`）；宿站 `Utils.backward` 每页只包装一次（函数对象标记 `__imwOverlayBackHook`），分发器经页面级槽位 `__imwOverlayBackDispatch` 登记（重复注入时新实例仍能接管），一次返回只关一层：随机面板槽位在 → 交给它自己的包装，否则关栈顶，无层关面板，面板关着交还原函数。
- `src/page/components/desk/focusTrap.ts`（新） -- `focusableWithin` / `trapFocusWithin` / `restoreFocus`（触发元素不可聚焦时取内部第一个可聚焦后代）；`RoomDeck` 的私有 Tab 陷阱迁过来。
- `src/page/components/action-sheet/ActionSheet.tsx`（新） -- 拦截层 `fixed inset-0 z-40` + 底部升起面板（`sheet` 底、`rounded-t-[16px]`、顶部 1px rule、`animate-[imwSheetRise…]`，`motion-reduce` 退化为淡入）；条目摘要（48px 封面 + 标题 + 歌手·时长）；三项按条件渲染（点播到房间 → 收藏/取消收藏 → 选集），首项 `deskRose` 且房间不支持时 40% 灰化仍可点（`notifyRoomUnsupported`，不发报文不收起）；`role="dialog"` + `aria-modal`，打开登记层级、焦点移入首项、`Tab` 循环、卸载 `restoreFocus`；`stopHostGestures`。
- `src/page/MainAppContainer.tsx` -- `handleRowActivate(platformData, trigger)` 改为 `closePanelTier("sheet")` + 记条目与触发元素开操作条；新增 `closeSheet` / `playFromSheet` / `selectEpisodesFromSheet`；`render` 在 `props.active && sheetItem` 时挂 `<ActionSheet>`；`active=false`、切模式、进入内页时清空；删掉 `handleInnerPageEscape` 与 `[data-imw-order-menu]` 探针，内页改经 `syncInnerLayer()` 登记 `inner` 层（无外层现场不登记）；controller 增 `openInnerPage`，`updateCurrentInMultiPageStatus(true)` 同时收起操作条。
- `src/types/page/props-and-state/MainAppContainer.d.ts` -- `sheetItem` / `sheetTrigger`。
- `src/page/components/media-container-context/MediaContainerContext.tsx`、`ResultsArea.tsx`、`TracklistRow.tsx`、`MusicTile.tsx`、`VideoTile.tsx` -- `onRowActivate` 增触发元素参数，行体 / 卡体点击传 `event.currentTarget`；`isPhoneLayout()` 门控与桌面分支不变。
- `src/page/components/room-deck/RoomDeck.tsx` -- 展开时登记 `deck` 层（注销随收起）、`openDeck` 先 `closePanelTier("deck")`、Tab 陷阱换 `trapFocusWithin`。
- `src/page/components/media-card-container/OrderMenu.tsx` -- 删自管 `Esc` 监听；挂载时先 `closePanelTier("order")` 再登记 `order` 层（登记先于移动焦点，避免互斥收起抢走焦点）。`CollectionHeader` 无需改动（菜单只在打开时渲染）。
- `src/page/MainAppControlLayer.tsx` -- 面板开 / 关与卸载时 `setPanelBackHandler`；与初始化合批的首次打开也接管返回键；`Esc` 加 `defaultPrevented` / `isComposing` 守卫，仅在层级栈为空时关面板。
- `src/page/components/media-card-container/FavoriteStar.tsx` -- 追加 `onChange` 订阅：操作条里收藏后行内星标即时更新。
- `src/app.css` -- `@keyframes imwSheetRise` / `imwSheetFade`。
- 测试 -- 新增 `desk/overlayLayers.test.ts`（13 条：LIFO、只关一层、注销幂等、互斥、`Esc` 装/卸与外来根放行、组合输入、返回键四态与只装一次）、`action-sheet/actionSheet.test.ts`（15 条：选项显隐、灰化与提示、点播/收藏/选集、点外侧、`Esc`、焦点移入与归还、Tab 循环、44px、零裸值）；`MainAppContainer.test.ts` 重写内页 `Esc` 用例并补 6 条操作条用例（开条、点播+焦点归还、不支持房间、已收藏取消、选集进内页、`Esc`/切模式/关面板收起）；`roomDeck.test.ts` 补「展开后 `Esc` 收起」「与操作条互斥」；`mediaCards.test.ts` 菜单 `Esc` 用例补「关掉后栈为空」；`MainAppControlLayer.test.ts` 补 `Esc` 逐层与返回键接管。

**验证**

- `npm test` -- 48 个文件、865 条全绿。
- `npm run build` -- `tsc -b && vite build` 无错误（`dist/bundle.js` 423.95 kB / gzip 127.79 kB）。
- `npx prettier --check src/page src/page/components/action-sheet src/page/components/desk src/app.css` -- 无差异。
- 构建产物核对：`@keyframes imwSheetRise/imwSheetFade`、`animate-[imwSheetRise…]`、`rounded-t-[16px]`、`pb-[env(safe-area-inset-bottom)]` 均已生成。

**残余风险**

- 真站几何（`fixed` 落在面板底边、压住迷你条与标签栏）与取色仍只有手动检查清单，本轮未跑真机；依据与顺序菜单同一包含块（面板 `transform`）与同一 `z-40`。
- 关面板时操作条卸载会把焦点还给触发元素，而触发元素此时随面板被移出视口——与「焦点在搜索栏时直接关面板」的既有行为一致，未额外处理。
- `Esc` 捕获监听在栈非空期间会先于宿站弹窗处理：宿站弹窗（z 9999999）开着且面板内仍有层时，`Esc` 关的是面板内的层。沿用顺序菜单自管监听时的既有口径。

## Auto Run Result

**实现摘要.** 面板内多了一层「谁打开谁登记」的层级栈：操作条 / 展开的底部条 / 顺序菜单（三者互斥、面板内最上层）与专辑·歌单内页各登记一层，`Esc`（`document` 捕获，栈空即卸）与宿站 `Utils.backward`（照 `openShufflePicker` 的包装写法，每页只装一次、无层时交还原函数）都只关最上一层，最后才关面板。新增手机操作条 `ActionSheet`（点播到房间 / 收藏·取消收藏 / 选集，房间不支持时首项灰化且只提示），从面板底边升起、压在迷你条与标签栏之上，不改主面板 90000、不另设 z-index 根。旧的 DOM 探针 `[data-imw-order-menu]` 与顺序菜单自管的 `Esc` 监听已删除。

**改动文件**

- `src/page/components/desk/overlayLayers.ts`（新）-- 层级栈、`Esc` 监听、互斥收起、宿站返回键包装与面板返回槽位。
- `src/page/components/desk/focusTrap.ts`（新）-- `trapFocusWithin` / `restoreFocus`（不可聚焦时取内部第一个可聚焦后代）。
- `src/page/components/action-sheet/ActionSheet.tsx`（新）-- 操作条视图、焦点移入/循环/归还、升起动效与减少动态降级。
- `src/page/MainAppContainer.tsx` -- 行体激活改开操作条、挂载操作条、内页层登记替换 DOM 探针、关面板/切模式/进内页收起。
- `src/page/MainAppControlLayer.tsx` -- 面板开关时登记/注销返回处理器，`Esc` 加 `defaultPrevented` / `isComposing` / 栈非空守卫。
- `src/page/components/room-deck/RoomDeck.tsx` -- 展开层登记一层（`Esc` / 返回键可收起）、展开前收起别的面板层、Tab 陷阱换共享件。
- `src/page/components/media-card-container/OrderMenu.tsx` `CollectionHeader.tsx` -- 顺序菜单登记一层并收起别的面板层，删掉自管 `Esc` 监听。
- `src/page/components/media-card-container/*` `MediaContainerContext.tsx` -- 行 / 卡主体点击把触发元素送到容器（桌面分支不变）。
- `src/page/components/media-card-container/FavoriteStar.tsx` -- 追加 `onChange` 订阅，操作条里收藏后行内星标即时同步。
- `src/types/page/props-and-state/MainAppContainer.d.ts` -- `sheetItem` / `sheetTrigger`。
- `src/app.css` -- 升起 / 淡入关键帧。
- 测试：`desk/overlayLayers.test.ts`、`action-sheet/actionSheet.test.ts`（新），`MainAppContainer.test.ts`、`MainAppControlLayer.test.ts`、`roomDeck.test.ts`、`mediaCards.test.ts` 补 / 改写。

**Review findings.** 24 条：high 0 / medium 1 / low 16 / false 7 / maybe-false 0。patch 6 条（medium 1、low 5）：provider 交接（`onRowActivate`）无测试、返回键包装每页只装一次、按住 `Esc` 只关一层、删除不可达的初始化分支、`FavoriteStar` 的 `onChange` 订阅补测、操作条 `init()` 后重读收藏补测。defer 1 条（AGENTS.md 未记层级约定）。reject 17 条：7 条 `false`（无 `key` 复用的两条不可达、`switchToMultiPage` 平台分支已全覆盖、互斥焦点抢占与层级顺序的组合不可达、`Utils` 晚到会在下次打开重试、收藏列表即时重载与 CAP-9 相反），10 条 `low`（断点残留与模态隔离沿用 story 3 的既有结论；`openInnerPage` 的 `await` 与两行胶水、选集后焦点、离屏归还焦点、裸值档位、reduced-motion 断言、槽位键字面量、包装顺序补测均属重构或收益不抵成本）。

**Follow-up review recommended: false** —— 本轮无 `high`，`medium` 只补了 1 条，按规则首轮仅在出现 `high` 或有 2 条以上 `medium` 被 patch 时才建议再复审。

**验证**

- `npm test` -- 48 个文件、873 条全绿（含新增 3 条：行/卡主体点击链路、星标 `onChange`、操作条 `init()` 后重读）。
- `npm run build` -- `tsc -b && vite build` 无错误（`dist/bundle.js` 423.95 kB / gzip 127.78 kB）。
- `npx prettier --check src/page src/page/components/action-sheet src/page/components/desk src/app.css` -- 无差异。
- 破坏性对照（实现方报告并复核）：把 `onRowActivate: this.handleRowActivate` 换成空函数、删掉 `onChange` 订阅、删掉 `init().then(reread)`、去掉包装去重，各自对应用例均失败。

**残余风险**

- 真站未跑：400×800 下操作条落在面板底边、压住迷你条与标签栏的几何与取色只有与顺序菜单同一机制（面板 `transform` 包含块 + `z-40`）的推论。
- 关面板收起操作条时焦点归还给随面板移出视口的触发元素（与既有「焦点在搜索栏时关面板」同口径，未特判）。
- 宿站弹窗（z 9999999）开着且面板内仍有层时，`Esc` 先关面板内的层——沿用顺序菜单自管监听时的既有口径。
