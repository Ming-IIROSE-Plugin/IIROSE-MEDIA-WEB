---
ticket: 5
title: 选集面板替代宿站 buildSelect2
type: feature
created: '2026-10-30'
status: done
baseline_revision: ffd05bf9d316cc343f7468c79c06c52ab99519b4
review_loop_iteration: 0
followup_review_recommended: false
context:
- '{project-root}/_bmad-output/initiative-iirose-media-web/archive-v6/spec-media-desk-redesign/SPEC.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/ux-media-desk/DESIGN.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/ux-media-desk/EXPERIENCE.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-media-desk-redesign/brownfield.md'
warnings:
- oversized
deferred:
- summary: AGENTS.md 的「选集不再走 buildSelect2」那一段仍把 `buildSelect2` 说成只服务设置 / 关于的取值类单选， 漏掉网易云 `buildSelect` 一级菜单（正序 / 乱序 / 选集点播）也在用它。
  evidence: '复核实测：`NetEasePlatform.buildSelect` 走 `IIROSEUtils.buildSelect2`（`multiSelect=false`），

    收藏里点播整张歌单 / 专辑仍经这个宿站弹窗。按流程约定，改 agent-context 文件的修复一律推迟，

    由维护者在下一次 `bmad-project-context` 刷新或单独的文档提交里更正，避免与 skill 管理的块冲突。'
  location: AGENTS.md:59
  severity: low
---
<intent-contract>

## Intent

**Problem:** 选集今天全靠宿站 `buildSelect2`：B 站多 P 先开三级菜单（`buildBiliSelect`：正序/乱序/选集）→ 多选弹窗 → `setTimeout(300)` 后再开二次顺序确认（`buildOrderConfirmSelect`），两次流转都踩宿站 `fadeOut` 冲突；「点选顺序」靠 `IIROSEUtils.buildSelect2` 在 `setTimeout(0)` 里接管宿站选项 `onclick` 与确定按钮的补丁维持（`selectedQueue` + 序号徽章 + sticky 确定钮）；多源剧集只有「正序点播全部」，没有单选分集。这与 CAP-8（插件自有面板、点选顺序=播放顺序、全选按列表顺序、取消不点播）冲突，也让 stale 的宿站选择器长期留在点播链路里。

**Approach:** 新增插件自有选集面板 `episode-picker`（桌面居中卡片、手机底部抽屉，body 独立根、层级 `z-[90010]`、令牌与操作条/浮窗同源），`openEpisodePicker` 命令式打开并自管加载状态机（骨架 / 失败+重试 / 0 集）；B 站多 P、多源多集、网易云歌单·专辑「选集」统一改走它，面板按点选顺序（乱序为随机置换）返回分集数组，平台层按「单项 `Announce.runSingleAnnounce` / 多项 `runBatchAnnounce`」点播；同时删除 `IIROSEUtils` 的有序多选接管与三处跨弹窗 `setTimeout(300)`。

## Boundaries & Constraints

**Always:**
- 点选顺序 = 播放顺序；「全选」按列表顺序（徽章 1…N）且全部选中时文案变「取消全选」；取消某项后其后序号前移；默认正序；未选任何项时「点播所选」禁用（40% 不透明）。
- 业务层按面板返回的顺序重排接口结果：网易云 `finalODSONG` 按入参顺序、B 站按所选 `page` 数组顺序、多源按所选条目顺序。
- 单项走 `Announce.runSingleAnnounce`、多项走 `Announce.runBatchAnnounce`（沿用各平台现有 summary 标题/描述与逐项 `showBatchItemError` 口径；多源保留 150ms 呼吸）。
- 面板是独立根 `#imw-episode-picker-root`、`fixed inset-0 z-[90010]`，根上写 `data-imw-theme`（宿站主题的唯一深浅判定）；外观只取 `floating-panel/tokens.ts` 成对令牌 + `imw-dark:` / `hov:`，图标用 `DeskIcon`。
- 关闭语义：关闭钮、点面板外、`Esc`、宿站返回键 = 取消，不点播；`role="dialog"` + 焦点移入、`Tab` 在面板内循环、关闭后归还触发元素（`desk/focusTrap`）；`Esc` 与返回键经 `desk/overlayLayers` 只关这一层。
- 房间不支持点播（`roomSupportsRequest()` 为 false）时「点播所选」灰化但仍可点：只提示「这个房间不支持点播」，不发报文、不关闭面板。
- 手机断点一律 `max-[768px]`、可点目标与列表行高 ≥44px；面板内手势不冒泡给宿站（`stopHostGestures`）。
- 现有能力存活：专辑/歌单内页头「全部播放」+ 顺序菜单、`playCollectionAll`、收藏与收藏点播、设置/关于的宿站选择弹窗、`@` 链接拦截、`Alt+S`、层级栈与逐层关闭。

**Never:**
- 不新增任何 `buildSelect2` 调用；不保留 `IIROSEUtils` 的有序多选接管；不新增跨弹窗 `setTimeout(300)` / `setTimeout(0)` 的弹窗补丁。
- 不改设置/关于（取值类继续用宿站弹窗）、不改结果区卡片与底部条外观、不做最近点播（story 6）、不改 `Announce` 档位规则、不新建 `PlaybackMode` 或第二个自动播放控制器。
- 不删 `switchToMultiPage` / `switchToOutFromMultiPage` / 专辑·歌单内页（`CollectionRow` 仍用它）；不让宿站弹窗承担任何选集职责。
- 不自绘 toast、不新增依赖 / SCSS / 网络字体 / emoji / 宿站 `mdi-*` 类。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| 桌面点播多 P 视频 | >768px，`VOD` 判定 `pages.length > 1` | 选集面板居中打开（「选集」+ 等宽集数 + 关闭钮），列表为该视频分 P，默认正序、未选时确认禁用，全程无宿站弹窗 | 多 `P` 数据为空 → 走原单集分支 |
| 手机点操作条「选集」 | ≤768px，操作条打开 | 操作条先收起，选集面板以底部抽屉打开，焦点在关闭钮 | 分派不出条目形态 → 不开面板，也不回落内页（「选集」本就只在 `hasMultiPage` 为真时出现） |
| 点选 / 取消点选 | 依次点第 3、1 集 | 徽章分别为 1、2；取消第 3 集后第 1 集徽章前移为 1 | — |
| 全选 | 列表 N 项 | 徽章 1…N（按列表顺序），文案变「取消全选」；再点清空全部 | 加载中/0 集时不可用 |
| 全选 + 乱序 | 正序切乱序后确认 | 播放顺序是同一集合的随机置换，数量不变 | — |
| 单项确认 | 只选 1 集 | 走 `runSingleAnnounce`，卡片立即发送（不被并行批量抑制） | 单项失败 → `showBatchItemError(error, 分集名)` |
| 多项确认 | 选 ≥2 集 | 走 `runBatchAnnounce`（count = 所选数），逐项按顺序点播 | 单项失败带分集名提示并跳过，其余照播 |
| 未选确认 | 0 选中 | 「点播所选」禁用、点击无动作、面板不关 | — |
| 加载中 / 失败 / 0 集 | `load` 挂起 / reject / 空数组 | 骨架行 + 底栏禁用 / 「加载失败」+「重试」/「没有可点播的分集」（只能关闭） | 重试重新调用 `load`；失败不点播 |
| 取消路径 | 关闭钮 / 点外侧 / `Esc` / 宿站返回键 | 面板关闭并卸载，不点播；`Esc` 与返回只关这一层（面板仍在时下一层才关） | 宿站无 `Utils.backward` → 关闭钮与 `Esc` 照常可用 |
| 房间不支持点播 | `mediaShareRoom === false` | 确认灰化但仍可点，提示「这个房间不支持点播」 | 不发报文、不关闭 |
| 收藏点播歌单 / 专辑 | 收藏模式点播收藏的歌单 | 宿站一级菜单「选集点播」→ 面板取该歌单曲目；确认顺序 = 点选顺序，`finalODSONG` 按此顺序 | 详情拿不到 → 面板「加载失败」+「重试」 |
| 多源剧集点播 | `playList.length > 1` | 面板列出集名；确认后逐集发送（单项单播报） | 单项失败提示分集名并跳过 |

</intent-contract>

## Code Map

- `src/page/components/action-sheet/ActionSheet.tsx` -- 手机操作条（story 4）：`onSelectEpisodes` 声明 `:46`、渲染 `:214-222`、打开即 `pushOverlayLayer("sheet", …)` 并归还焦点 `:126-133`。层与焦点写法是本 story 面板的直接参照。
- `src/page/components/desk/overlayLayers.ts` -- 层级栈：`OverlayLayerKind` `:8`（现为 `sheet|deck|order|inner`）、`PANEL_TIER` `:16`、`pushOverlayLayer` `:65-78`、`dispatchBack` `:132-142`。本 story 增 `episode` 一种，**不**进 `PANEL_TIER`（它压在面板内浮层之上，不是互斥三件里的第四件）。
- `src/page/components/desk/focusTrap.ts` -- `trapFocusWithin` / `restoreFocus`（触发元素不可聚焦时取内部第一个可聚焦后代），面板复用。
- `src/page/components/shuffle-picker/openShufflePicker.tsx` -- 命令式浮层的参照实现：body 根 `:223-225`、单例键 `:54`、`canRestoreFocus` `:105-112`、退场 `:314-325`、`Utils.backward` 包装 `:72-89`（**不要**照抄它的单槽位 `BACK_SLOT_KEY`：选集面板用 `overlayLayers` 的层栈，两套槽位会在同一次返回里抢）。
- `src/page/components/shuffle-picker/ShufflePicker.tsx` -- 视觉与可访问性参照：根 `:721-724`（`fixed inset-0 z-[90010]`）、卡片 `:637`（`panelFrame` + `panelTheme(dark)`）、`role="dialog"` + `tabIndex={-1}`、全选/全不选文字钮 `:796-812`、`role="radiogroup"` 分段 `:813-839`。**注意它用 `panelTheme(dark)` 这套旧浮窗令牌**——本 story 的面板改用纸/墨/蔷薇红令牌 + 根节点 `data-imw-theme`（`imw-dark:` 变体定义在 `src/app.css:10`）。
- `src/page/components/floating-panel/tokens.ts` -- 令牌唯一来源：`deskSheet` / `deskInk` / `deskInk2` / `deskInk3` / `deskRose` / `deskRoseSolid` / `deskOnRose` / `deskRule` / `deskRuleFill` / `deskSkeleton` / `deskInkSurface` / `deskPaperText` / `deskFocusRing*` / `deskTextButton` / `rounded*` / `type*` / `touchMin` / `DeskIcon`（`chev`/`close`/`sort`/`shuffle`/`film`/`note` 现成，序号徽章不需要新图标）。
- `src/page/components/media-card-container/mediaFormat.ts` -- `formatDuration` `:5-12`（分集时长）、`hasMultiPage` `:64-74`（操作条「选集」的显隐判据）、`isPhoneLayout` `:77-79`。
- `src/page/components/media-card-container/VideoTile.tsx` `MusicTile.tsx` -- 过渡「选集」文字钮（`VideoTile.tsx:153-164`、`MusicTile.tsx:137-148`）与 `onSelectEpisodes` prop（`VideoTile.tsx:44`、`MusicTile.tsx:42-43`）：story 2 明文约定「story 5 换成选集面板后删除」。
- `src/page/components/media-card-container/ResultsArea.tsx` -- `openCollection` `:202-205` 目前同时服务业 `CollectionRow` 与两张卡的 `onSelectEpisodes`（`:274`、`:286`）；删掉后者两处，前者保留。
- `src/page/MainAppContainer.tsx` -- `selectEpisodesFromSheet` `:238-242`（现走 `openInnerPage` → 内页）、`playFromSheet` `:233-236`、`openInnerPage` `:719-725`（**唯一调用者就是 `selectEpisodesFromSheet`**，改完后随本 story 删除）、操作条挂载 `:399-409`（`returnFocus={sheetTrigger}` 可传给面板）、`switchToMultiPage` `:730-814`（保留，服务 `CollectionRow`）、`playCollectionAll` `:259-269`（保留）。
- `src/platforms/BilibiliPlatform.ts` -- `VOD` `:382`；多 P 分支 `:474-629`（`buildBiliSelect` → `select 2` 再 `setTimeout(300)` 开多选 `:536-625`，其中还有第二层 `setTimeout(300)` 开顺序确认 `:583-616`）；`buildBiliSelect` `:654-689`、`buildOrderConfirmSelect` `:694-723`（两者删除）；`playBiliPage` `:~300-376`（单 P 播放，`prepareAndSendMedia` 发卡片 + `&1`）；`pages` 每项 `{page, part, duration, cid}`。
- `src/platforms/NetEasePlatform.ts` -- `buildSelect` `:13-57`（一级菜单「正序点播 / 乱序点播 / 选集点播」，**保留**）、`buildOrderConfirmSelect` `:62-91`（删除）、`playCollectionAll` `:704-750`（保留）、`MLOD` `:756-848` / `AOD` `:854-938`（`select===2` 分支即 `:777-839`、`:873-929`：现取详情 → `buildSelect2(…, true, …)` → 单项/多项；改成委托新的 `selectEpisodes`，并把进入分支前的 `getSongListDetail`/`getAlbumDetail` 一并交给面板的 `load`）、`finalODSONG` `:1007+`（`private`，已按入参 `songsID` 顺序重排，天然满足「点选顺序 = 播放顺序」）。
- `src/platforms/AllVideosPlatform.ts` -- `VOD` `:56-146`（`playList` 长度 1 直点播、>1 走 `buildVideoSelect`）、`buildVideoSelect` `:179-204`（只有「正序点播」，删除）、`sendVideoMedia` `:151-174`、呼吸 150ms `:103`、逐项 catch `:104-107`。
- `src/iirose_func/IIROSEUtils.ts` -- `buildSelect2` `:47-189`：`if (r)` 整段 `setTimeout(0)` 接管（sticky 确定钮 `:79-91`、`selectedQueue` `:97`、`updateVisuals` `:99-134`、选项 `onclick` 接管 `:137-155`、确定钮 `:158-180`）即本 story 要删的存量；删后只剩 `:58-59` 的透传。`generatePicHtml` `:196-215` 在删掉三处选集分支后无调用者（且产出宿站 `mdi-*` 类），一并删除。
- `src/types/platforms.d.ts` -- `PlatformData`（`multiPage` / `playList` / `bilibili` / `neteaseMusic`）、`PlayItem`（`episode` / `url`，见 `src/types/AllMedia/allMedia.d.ts:26-29`）。
- `src/settings/*`、`src/platforms/About.ts`、`src/page/MainAppContainerServices/SettingsService.ts:484` -- `buildSelect2` 的其余调用点，全部单选（`multiSelect=false`），删除接管代码后行为不变，**不要**改它们。
- `src/app.css` -- `@keyframes imwSheetRise` / `imwSheetFade` `:271-286`（手机抽屉与淡入直接复用）；通配过渡只作用于 `.IIROSE_MEDIA_CONTAINER *`，面板根在面板外，动效需自带。
- 测试面：`src/page/components/media-card-container/mediaCards.test.ts:1154-1224`（两张卡的「选集」入口，随按钮删除改写）、`src/page/MainAppContainer.test.ts:811-833`（操作条「选集」进内页，改写为「调平台 `selectEpisodes`、不开内页」）、`src/iirose_func/Socket/Announce/Announce.test.ts`（播报档位规则，**不要**改）、`src/platforms/NetEasePlatform.test.ts`（整单保序与「不碰 `buildSelect2`」既有断言必须继续绿）。

## Tasks & Acceptance

**Execution:**
- `src/page/components/episode-picker/EpisodePicker.tsx`（新） -- 受控视图（根节点带 `data-imw-episode-picker`，选择器约定同 `data-imw-action-sheet`）：标题行（「选集」+ 等宽数量 + 「全选」/「取消全选」文字钮 + 关闭钮；单位由打开方给，视频/剧集为「集」、网易云曲目为「首」）、列表行（未选 20px 描边方块 / 选中 20px 蔷薇红实底序号徽章 + 标题 + 副行 + 等宽时长）、吸底底栏（正序/乱序 `radiogroup` + 墨底「点播所选」）、加载骨架 / 0 集 / 失败+「重试」、`role="dialog"` + 行 `role="checkbox"`（读屏「第 N 个」）、`stopHostGestures`、桌面居中卡片 / 手机底部抽屉、44px 行高 -- CAP-8 视图。
- `src/page/components/episode-picker/openEpisodePicker.tsx`（新） -- 单例根 `#imw-episode-picker-root`（`z-[90010]`、根上 `data-imw-theme`；同页已在打开态时再次调用只把焦点送回面板，不叠第二份）、`load()` 状态机（骨架 → 就绪 / `failed` 可重试 / 0 集）、点选顺序与全选/正序/乱序的纯逻辑（Fisher–Yates，不用 `sort(() => Math.random() - .5)`）、确认回调（按播放顺序的条目数组）/取消、`pushOverlayLayer("episode", cancel)` 与卸载退场、焦点移入与归还（`returnFocus` 缺省取打开时的 `document.activeElement`）-- CAP-8 / CAP-14 接线。
- `src/page/components/desk/overlayLayers.ts` -- `OverlayLayerKind` 增 `"episode"`；`PANEL_TIER` 不变 -- `Esc` / 返回键只关它。
- `src/platforms/BilibiliPlatform.ts` -- 多 P 分支改 `selectEpisodes(platformData, { pages, desc: res?.data?.desc })`，条目 = `P{page} {part}` + 时长；确认后 1 项 `runSingleAnnounce`、≥2 项 `runBatchAnnounce`（逐项 `try/catch` + `showBatchItemError(error, \`P{page} {part}\`)`）；删 `buildBiliSelect`、`buildOrderConfirmSelect`、两处 `setTimeout(300)` 与 `IIROSEUtils` 依赖 -- CAP-8 主链路。
- `src/platforms/AllVideosPlatform.ts` -- 多集改 `selectEpisodes(platformData)`（条目 = `playList` 的 `episode`，标题即集名），删 `buildVideoSelect` 与 `IIROSEUtils` 依赖；保留 150ms 呼吸与逐项失败提示 -- 多源剧集接入。
- `src/platforms/NetEasePlatform.ts` -- 新增 `selectEpisodes(platformData)`：`load` 内取歌单/专辑曲目（`getSongListDetail` / `getAlbumDetail`，条目 = 曲名 + 歌手，封面/简介同现状），确认后 1 项 `runSingleAnnounce`、≥2 项 `runBatchAnnounce(名称, N, () => finalODSONG(ids), 简介)`；`MLOD`/`AOD` 的 `select===2` 改委托它并删该分支整段 `buildSelect2` 与 `setTimeout(300)`；删 `buildOrderConfirmSelect`；保留 `buildSelect` 一级菜单与 `playCollectionAll` -- 网易云选集与 `buildSelect2` 有序多选解耦。
- `src/iirose_func/IIROSEUtils.ts` -- 删 `buildSelect2` 的 `if (r)` 整段接管与 `generatePicHtml`，`buildSelect2` 退化为透传 -- 移除有序多选存量。
- `src/page/components/media-card-container/VideoTile.tsx` `MusicTile.tsx` `ResultsArea.tsx` -- 删过渡「选集」文字钮、`onSelectEpisodes` prop 与两处传参（多 P 内页入口随之退场，`switchToMultiPage` 仍服务 `CollectionRow`）-- story 2 约定的收尾。
- `src/page/MainAppContainer.tsx` -- `selectEpisodesFromSheet` 改为「收起操作条 → 按条目形态分派平台 `selectEpisodes`（`bilibili` / `playList` / 网易云歌单·专辑），焦点归还 `sheetTrigger`」；删除无调用者的 `openInnerPage` -- CAP-7 / CAP-8 接线。
- `src/page/components/action-sheet/ActionSheet.tsx` -- 「选集」的注释与 prop 说明改为「插件自有选集面板（不再 `switchToMultiPage`）」-- 文档随实现。
- `src/app.css` -- 手机抽屉复用 `imwSheetRise` / 桌面卡片淡入复用 `imwSheetFade`，`prefers-reduced-motion` 去位移 -- 与操作条同一套动效。
- 测试 -- 新增 `episode-picker/episodePicker.test.ts`（矩阵逐行：标题/集数、徽章顺序与前移、全选与取消全选、正序/乱序置换、未选禁用、三项状态、取消四路径、房间不支持、焦点移入/Tab 循环/归还、44px、零裸值 + 无 emoji + 无 `mdi-`）、`episode-picker/openEpisodePicker.test.ts`（单例根、`z-[90010]`、`data-imw-theme`、确认后卸载、取消不回调、返回键只关一层）、`platforms/BilibiliPlatform.test.ts` 与 `platforms/AllVideosPlatform.test.ts`（多 P/多集开面板、单选单播报、多选批量播报、按面板顺序播放、全程不碰 `buildSelect2`）、`iirose_func/IIROSEUtils.test.ts`（`buildSelect2` 透传、`multiSelect=true` 时不再接管）；改写 `mediaCards.test.ts` 的「选集」用例与 `MainAppContainer.test.ts` 的操作条选集用例；`NetEasePlatform.test.ts` 补 `MLOD`/`AOD` 选集委托与保序 -- 矩阵全覆盖。

**Acceptance Criteria:**
- Given 桌面 >768px 且视频为多 P，when 点「点播到房间」，then 选集面板居中打开（「选集」+ 等宽集数 + 关闭钮）、默认正序、未选时「点播所选」禁用，且全程没有宿站选择弹窗。
- Given 面板已打开，when 依次点第 3、1 集，then 徽章为 1、2；取消第 3 集后第 1 集徽章为 1。
- Given 面板已打开，when 点「全选」，then 按列表顺序出现徽章 1…N 且文案变「取消全选」；再点清空。
- Given 全选后切「乱序」并确认，when 观察实际点播顺序，then 是所选集合的随机置换（数量一致、不重复）。
- Given 只选 1 集，when 确认，then 走 `Announce.runSingleAnnounce`；Given 选 ≥2 集，when 确认，then 走 `Announce.runBatchAnnounce` 且 count = 所选数。
- Given 房间 `mediaShareRoom === false`，when 点「点播所选」，then 不发任何报文、提示「这个房间不支持点播」、面板不关闭。
- Given 面板打开，when 按 `Esc` 或触发宿站返回键，then 只关面板、不点播；关闭钮与点面板外同样只取消。
- Given 手机 ≤768px，when 从操作条点「选集」，then 操作条先收起、面板以底部抽屉打开、行高与可点目标 ≥44px。
- Given 任意选集调用点（B 站多 P、多源多集、网易云歌单/专辑选集、收藏点播歌单），when 检查 `src/`，then 没有任何 `buildSelect2(…, true, …)` 多选调用、没有 `setTimeout(300)` 跨弹窗补丁、`IIROSEUtils.buildSelect2` 内不再有 `selectedQueue` / 徽章 / 确定钮接管。
- Given 面板源码与渲染结果，when 检查，then 不含 `themed` / `accentVar` / `bg-[#…]` 裸值 / `rgba(`，无 emoji 与宿站 `mdi-*`，根节点为 `z-[90010]` 且不新设其它 z-index 根，手机可点目标 ≥44px。
- Given 仓库，when 运行 `npm test` 与 `npm run build`，then 全绿。

## Spec Change Log

## Review Triage Log

### 2026-10-30 — Review pass
- verdicts: 42 findings — high 0, medium 14, low 21, false 7, maybe-false 0
- findings:
  - `[medium]` `[patch]` `src/page/index.tsx` 重复注入不清旧选集面板根 — 复核确认 `init`/`dispose` 只调 `releaseShufflePicker()`，旧 `#imw-episode-picker-root`（`fixed inset-0 z-[90010]`）会留在 body 挡住整页；两处各补 `releaseEpisodePicker()`，并在 `index.test.ts` 加回归用例。
  - `[medium]` `[patch]` 操作条卸载清理把焦点抢回行体、模态面板拿不到焦点 — 复核确认 `ActionSheet` 清理（deps `[]`）在 `openEpisodePicker` 聚焦关闭钮之后执行；清理改为「上层已有 `[data-imw-episode-picker]` 就不归还」，`actionSheet.test.ts` 与 `MainAppContainer.test.ts` 各加一条断言。
  - `[low]` `[patch]` `returnFocus` 捕获 / 归还都没有可用性判定 — 复核确认打开时 `document.activeElement` 可能是 body、关闭时触发元素可能已被宿站清空；新增 `isReturnTarget()`（排除 body / documentElement）与 `isConnected` 判定，两条测试覆盖。
  - `[low]` `[patch]` 退场只有 `pointer-events-none`、`EXIT_MS=200` 是空等 — 复核确认卡片没有退场动画；改为 `opacity-0 transition-opacity duration-[160ms]`，与常量对齐，测试断言该状态。
  - `[false]` `[reject]` `confirm()` 未在点击时重判房间能力 — 面板是全屏模态，换房间必须先关面板，冷却期内的越界路径不可达；判断依据为渲染期快照，与操作条同一口径。
  - `[false]` `[reject]` 面板打开时再次 `openEpisodePicker` 静默丢弃新调用方 — 模态层挡住背后所有入口，无 UI 路径能在打开态触发第二次调用；双实例防护另由单例键保证。
  - `[medium]` `[patch]` 网易云行 id 不唯一（同一首歌重复出现） — 复核确认 `id: String(track.id)`，歌单重复曲目会一次点选勾中两行、徽章重复、全选计数错位；改为 `位置:曲目id` 并用 `songIdOf()` 回填，补重复曲目用例（id `0:5`/`1:5`、点选顺序两条都播）。
  - `[false]` `[reject]` 专辑分支缺少空曲目兜底 — 专辑端点不返回 `trackIds`，`songs` 为空时没有第二条可用来源；「专辑非空」在现有数据里不成立。
  - `[low]` `[patch]` 网易云死代码 — 复核确认专辑分支的 `songsID` 赋值与 `CollectionTrack.al` 均无人读取；随 id 修复一并删除。
  - `[medium]` `[patch]` 多源单集直点播丢了 try/catch — 复核确认调用方（`ResultsArea.play`、`AllVideoService`）都不接 rejection，探流失败会静默无提示；恢复 `catch` + `ShowMessage.show(message)`，并加「探流失败只提示一次、不 reject」用例。
  - `[medium]` `[patch]` 多源单集副行从「作者 / 简介」变成集名 — 复核确认 `item.episode` 恒非空使 `author || subtitle` 永不生效；`playEpisode` 改为 `options: { singleAnnounce, named }`，只有面板确认路径用集名，两处用例分别断言。
  - `[low]` `[defer]` AGENTS.md 把 `buildSelect2` 说成只服务设置 / 关于 — 复核属实（网易云一级菜单仍经它），但修复要改 agent-context 文件，按约定推迟，已记入 `deferred`。
  - `[medium]` `[patch]` 仓库根 `design.md` 仍把已删机制当现状 — 复核确认 §2 流程图、§3.3/3.4/3.5 与 §4 表格都描述 `selectedQueue` 接管、跨弹窗 300ms、`generatePicHtml`；已按现在的选集面板与「存量已删除」重写。
  - `[low]` `[reject]` story 的 Design Notes 被课程分支推翻、`deferred` 为空 — 修复方式是编辑本 build 的 spec 文本，按复核规则拒绝；课程分支的实质判断见下一条。
  - `[medium]` `[patch]` 两处 `buildSelect2` 断言恒真（spy 建在调用之后） — 复核确认 `BilibiliPlatform.test.ts` 与 `AllVideosPlatform.test.ts` 的 `not.toHaveBeenCalled()` 永远不会失败；spy 全部前移，照 `NetEasePlatform.test.ts` 的写法。
  - `[medium]` `[patch]` 操作条「选集」的四条分派臂只测了两条 — 复核确认删掉 `playList` 分支测试仍全绿；`MainAppContainer.test.ts` 补多源剧集用例（mock `AllVideosPlatform`），断言操作条收起且 `selectEpisodes` 被调用。
  - `[low]` `[patch]` 多源批量用例用固定 `setTimeout(400)` — 复核确认 `onConfirm` 返回 `void`、测试只能睡等；改成 `vi.waitFor` 等实际条件。
  - `[low]` `[patch]` `mediaCards.test.ts` 两处不一致 — 复核确认首个用例仍把 `multiPage` 当 `mount()` 第二参数、第二个用例标题与 `MusicTile`/「点播」文案对不上；参数删除、标题改名。
  - `[low]` `[reject]` 面板缺「已选 N 项」与 `aria-live` 状态播报 — DESIGN.md `episode-picker` 明确只有「标题 + 集数 + 全选 + 关闭」，补计数属新增可见表面而非更正；不判为本 story 的缺陷。
  - `[low]` `[patch]` 外框 `onClick` 把「行内按下、面板外松开」误判成点外侧 — 复核确认 `click` 派发到最近公共祖先（外框层）会取消并丢弃已选；改为按 `pointerdown` 的 target 判定，并加拖出用例。
  - `[low]` `[reject]` `IIROSEUtils.test.ts` 的源码正则过刚 — 该断言是有意立的回归护栏（接管代码不得回来），无用户可见影响，改成行为断言并不比现状更能守住目标。
  - `[low]` `[patch]` 纯逻辑测试缺重复 id 与 retry 清空 — 随 id 带位置的修复补了重复曲目用例，`retry` 后断言全部行未选、全选可用。
  - `[medium]` `[patch]` 操作条清理抢焦点（edge-case 同因） — 与上面 `ActionSheet` 条目同一根因，同一修复覆盖，`actionSheet.test.ts` 用例即为其证据。
  - `[low]` `[patch]` 打开时 `activeElement` 为 body 被当归还点 — 与 `isReturnTarget()` 同一修复，测试断言关闭时不往 body 塞焦点。
  - `[medium]` `[patch]` 网易云重复曲目 id（edge-case 同因） — 同 id 修复，`NetEasePlatform.test.ts` 的重复曲目用例覆盖。
  - `[medium]` `[patch]` 多源单集缺少 try/catch（edge-case 同因） — 同 `VOD` 单集修复。
  - `[low]` `[patch]` `SettingsService.ts:451` 注释指向已删的 `buildOrderConfirmSelect` — 复核确认；注释改述为「宿站单选选择弹窗（取值类，不是选集）」。
  - `[false]` `[reject]` `resolveEpisodeOrder` 在 `random()` 返回 1 或负数时与 `undefined` 交换 — 生产路径的随机源是 `Math.random()`，其值域为 `[0,1)`，该状态无法到达；注入的 random 只存在于测试。
  - `[medium]` `[patch]` 多源（`playList`）分派臂没有行为测试（verification-gap，已预验证） — 补多源剧集用例，删掉该分支即红。
  - `[medium]` `[patch]` 「不碰 buildSelect2」只有文本证据（verification-gap，已预验证） — 两处 spy 前移，AllVideos 用例先跑一次 `VOD` 再断言。
  - `[medium]` `[patch]` 从操作条开面板后「焦点先还给行体」无断言（verification-gap，已预验证） — 沿用「点播到房间」的 trigger 写法，删掉 `restoreFocus(trigger)` 即红。
  - `[low]` `[patch]` 网易云曲目歌手副行无渲染断言（verification-gap，已预验证） — `episodePicker.test.ts` 加带 `meta` 的条目，断言行内含歌手与时长。
  - `[low]` `[patch]` 0 集文案写死「分集」但面板已按 `unit` 参数化 — 改为按单位给文案（集 / 曲目，其余按 `unit` 兜底），两种单位都断言。
  - `[low]` `[patch]` `switchToMultiPage` 的 `multipage.platform === "video"` 分支已无入口 — 复核确认调用方只剩收藏 / 专辑行与课程分支；该段不可达代码删除。
  - `[low]` `[reject]` 面板 → 适配器的顺序只在两半分别验证，没有联调用例 — 两半各有行为断言（面板给出的数组顺序、适配器按数组顺序播放），联调需要同时接真平台与真面板，属新增测试基建而非更正。
  - `[false]` `[reject]` 批量播报 count 口径不一致（网易云用未过滤 id 数） — id 全部来自刚读到的详情，`finalODSONG` 不会丢掉任何一条，count 与实际条数恒等。
  - `[low]` `[reject]` `z-[90010]` 挂在根内一层而非根节点、无有效层叠断言 — 根节点无定位、子层 `fixed z-[90010]` 的层叠效果等价；jsdom 无布局，补断言只能断言类串，无收益。
  - `[false]` `[reject]` `buildSelect2` 仍把 `multiSelect` 原样透传，未来传 `true` 会静默回到宿站无序多选 — 仓库内没有 `multiSelect=true` 的调用点，接管代码已删，透传 `true` 得到的是宿站自身多选，不构成本次变更的回归。
  - `[low]` `[reject]` 「全选 → 播放序」只有数组面证据 — 与「面板 → 适配器」联调缺口同因同判。
  - `[low]` `[reject]` 课程仍走内页钻取、与「选集统一进面板」的读法冲突 — 课程没有分 P 详情 / 播放流接口，进面板只会得到「加载失败」，保留内页钻取才是保住既有能力的读法；本条的补救方式是改 spec 文本，按规则拒绝。
  - `[false]` `[reject]` 「单项」还有不经面板的入口（单集 VOD / 单曲） — 这些入口本来就按 spec 的「单项走 `runSingleAnnounce`」直接点播，不存在逻辑缺口。
  - `[low]` `[reject]` `stopHostGestures` / reduced-motion / `restoreFocus` 无断言 — 手势隔离与去动效属真站观感，jsdom 无法有效证明；焦点归还已由本轮 `MainAppContainer` / `actionSheet` / `episodePicker` 三条用例覆盖。

### 2026-10-30 — Review pass (follow-up)
- verdicts: 28 findings — high 0, medium 1, low 22, false 4, maybe-false 1
- findings:
  - `[low]` `[reject]` `EpisodePicker` 自写 `textAction` 与 `deskTextButton` 同义 — 复核确认二者确有重叠，但令牌的 `p-0` 不含 DESIGN 的 `text-button` 触控内边距（左右 12px），改令牌会波及全仓文字钮外观；把面板改成拼令牌属重排而非直接更正，且现状无用户可见缺陷，按「修复大于直接更正」拒绝。
  - `[low]` `[reject]` 面板内空 / 错态自绘 `StateRow` 而不用 `StateMessage` — 复核确认 DESIGN 把 `state-message` 限定在「结果区内水平居中、距顶 72px」，面板列表区没有这条约束，紧凑左对齐行是该表面的选择；改写属新增版式决策而非更正，拒绝。
  - `[false]` `[reject]` `openEpisodePicker` 丢掉 `load` 的失败文案，只显示「加载失败」 — 复核确认矩阵「加载中 / 失败 / 0 集」一行明写期望输出就是「加载失败」+「重试」；通用文案是规格指定行为，不是丢失。
  - `[low]` `[reject]` 加载态对读屏静默（骨架 `aria-hidden`、无 `aria-busy`） — 复核属实，但契约只要求 `role="dialog"` + 焦点移入 + `Tab` 循环；补 `aria-busy` / 隐藏文案是新增播报表面，与首轮「`aria-live` 计数属新增表面」同一口径，拒绝。
  - `[low]` `[patch]` 退场时整层 `pointer-events-none` 让点击穿透到下层 — 复核确认 160ms 淡出窗口里外框不再拦截，落点会打到下面的卡片（可能再点播一次）；已把 `pointer-events-none` 只留在卡片上，外框照常拦截，并加注释说明原因。
  - `[low]` `[reject]` 动效时长散在三处、减少动态只兜一半 — 复核确认 `app.css` 的 `prefers-reduced-motion` 已把手机抽屉的 `imwSheetRise` 换成纯淡入，退场只有 160ms 透明度过渡（不涉位移）；统一机制要重写 `max-[768px]` + `motion-reduce` 的组合类，属重排，拒绝。
  - `[low]` `[patch]` `overlayLayers.ts` 文件头关闭顺序仍把选集面板写成「独立根、自己管」 — 复核确认该注释与 `episode` 层实现相反；已改写为「随机面板单槽位 > 选集面板 `episode` 层 > 面板内浮层 > 内页 > 主面板」。
  - `[low]` `[patch]` 仓库根 `design.md` §3.4 声称 `buildSelect2` 只服务设置 / 关于 — 复核确认与 §4 平台表自相矛盾（网易云一级菜单仍经它）；已补上「网易云歌单·专辑一级菜单（收藏整单点播只靠它）」。
  - `[false]` `[reject]` `ActionSheet` 用 `[data-imw-episode-picker]` DOM 探针判「上层已有面板」 — 层栈头注释说的「取代 DOM 探针」针对的是 `Esc` 调度，而这里问的正是「面板根还在不在 DOM 里」（`overlayLayers` 没有按 kind 查询，且层在不在与节点在不在本就不同）；探针是正确答案，不构成回归。
  - `[low]` `[reject]` story 文档对 `switchToMultiPage` 的说法相反 — 属实（Design Notes 写「多 P 分支保留」、Triage 记「已删除」、代码已删），但修复方式是编辑本 build 的 spec 文本，按规则拒绝。
  - `[false]` `[reject]` `FOREIGN_ROOTS` 注释没说明选集面板为何不进 — 该常量只列「自管 `Esc`、需要放行」的独立根，选集面板按设计走层栈、不属其一；缺少一句「它不在此列」不产生任何错误陈述。
  - `[low]` `[patch]` 测试残留噪声（`BilibiliPlatform.test.ts` 悬空文档注释、`episodePicker.test.ts` 的 `void onCancel;`） — 复核确认；已删悬空注释、去掉占位语句，`playedPages` 的注释回到它该在的位置。
  - `[low]` `[patch]` `mediaCards.test.ts` 用例标题承诺「点播由平台开面板」但只断言回调派发 — 复核确认；标题改为「回调照常派发（面板由平台在点播链路里开）」。
  - `[low]` `[patch]` 面板缺三条状态用例（退场中重开、加载中确认、`releaseEpisodePicker` 注销层） — 复核确认前两条属防御性早退（加载中确定钮是 `disabled`，jsdom 不会派发 click），第三条是真不变量：已补「`releaseEpisodePicker` 同时注销 `episode` 层」与「退场中再次打开不继承上一份面板的归还点」两条用例。
  - `[low]` `[reject]` `unit` 只是无约束 `string` — 复核确认当前三个调用点都传「集」/「首」，收紧成联合类型属接口偏好；没有已出现的不当文案，按无用户可见证据拒绝。
  - `[low]` `[reject]` `design.md` 混入 8 处纯空行插入 — 属实且违反「格式化不得与功能改动混提」，但改动已落地为提交，事后分离只能重写历史；拒绝并在后续用 `style:` 单独提交维持纪律。
  - `[false]` `[reject]` 操作条「选集」分派不出形态时什么都不开、无反馈 — 复核确认 `hasMultiPage` 为真的条目只可能是 bilibili / 非空 `playList` / 网易云歌单·专辑（全仓 `multiPage:` 赋值仅这几处），三条分支逐一命中，该空分支不可达。
  - `[low]` `[patch]` 退场中重开把上一份面板的触发元素记成归还点 — 复核确认 `unmount` 会先 `restoreFocus` 上一份的触发元素，之后才读 `document.activeElement`；已改为清单例之前读焦点，并把「落在 `[data-imw-episode-picker]` 里的元素」排除出归还点，附回归用例（去掉修复即红）。
  - `[maybe-false]` `[reject]` 多源单集探流以非 Error reject 时提示 `undefined` — 现有实现照旧写法 `(error as Error).message`；`getM3U8Duration` 内部吞掉异常，唯一可能的 rejection 来源是封面 Promise，无法证明会以非 Error 值 reject。若成立也只是文案难看（low），按规则以同样理由拒绝。
  - `[low]` `[reject]` 网易云一级菜单回调里同步开面板，面板落在宿站淡出弹窗之下 — 复核确认宿站 `fadeOut(250)` 只作用于它自己的容器，面板在 `document.body` 的独立根、不会被 `empty()` 销毁；影响仅限首个 250ms 的视觉遮挡，而修复方式正是契约禁止的跨弹窗 `setTimeout`，拒绝。
  - `[medium]` `[patch]` 桌面 B 站课程卡失去了进入课程分集列表的唯一入口 — 复核确认：旧卡片遮罩的「选集」钮是桌面唯一入口（`openCollection → switchToMultiPage` 的课程分支），本 story 删掉后桌面只剩「点播到房间」（只播 `items[0]`），操作条只在手机挂载，测试两边都不覆盖。已给 `VideoTile` 恢复课程专用「选集」文字钮（桌面显示，手机走操作条），由 `ResultsArea` 只对 `bilibili.course_id` 传入，并补「课程卡有入口 / 普通多 P 卡没有」两条用例。
  - `[low]` `[patch]` 多源批量路径的卡片副行（集名）与 150ms 呼吸无人断言 — 复核确认「选 ≥2 集」只断言 url 顺序与调用次数，把 `named: true` 去掉仍然全绿；已在同一用例补 `sendVideoMedia` 第一参的 `author` 序列断言（实测去掉 `named` 即红）。150ms 呼吸仍无行为断言，需要假计时器，留作已知缺口。
  - `[low]` `[patch]` `mediaFormat.ts` 的 `hasMultiPage` 注释仍指向卡片遮罩里的过渡「选集」入口 — 复核确认入口已退场；注释改为「手机操作条据此显示选集，桌面仅课程卡保留入口」。
  - `[low]` `[defer]` `carried` AGENTS.md:59 仍把 `buildSelect2` 说成只服务设置 / 关于 — 与首轮同位置同主张（本轮补充：这句是本 diff 新写的，且同一文件里旧的「跨弹窗必须 `setTimeout(300)`」段落与之冲突）；改 agent-context 文件按规则推迟，已有 `deferred` 条目保留不动，不再重复登记。
  - `[low]` `[reject]` 课程分支「回落内页」与矩阵「不回落内页」冲突 — 矩阵那格的括号说明（「选集本就只在 `hasMultiPage` 为真时出现」）把课程漏掉了，实施按「现有能力存活」保留内页钻取；本条的补救方式是改 spec 文本，按规则拒绝。
  - `[low]` `[reject]` 删卡片「选集」钮违背 Never「不改结果区卡片与底部条外观」 — 复核确认被删的钮对面板能服务的条目（B 站多 P / 多源 / 网易云）都由面板取代，唯一服务不了的课程已由本轮 patch 恢复入口，故这条不再有独立的坏结果。
  - `[low]` `[reject]` `carried` `z-[90010]` 挂在根内一层而非根节点 — 与首轮同位置同主张，代码仍如该行所述（根节点 `class` 为空、层级在视图根），维持首轮判定。

## Design Notes

**为什么是 body 独立根而不是面板内浮层**：选集的调用点是平台静态代码（`BilibiliPlatform.VOD`、`NetEasePlatform.MLOD/AOD`、`AllVideosPlatform.VOD`），它们不在 Preact 树里，还需要被 `@` 链接拦截与收藏点播复用（此时面板可能压根没开）。因此照随机面板的做法做命令式入口 + `document.body` 根：`z-[90010]` 与随机面板同层，高于主面板 90000，低于宿站弹窗 9999999。面板内的操作条/顺序菜单仍留在面板内（story 4 不变）。

**深浅主题怎么来**：面板根在 `.IIROSE_MEDIA_CONTAINER` 之外，拿不到它写的 `data-imw-theme`，所以根节点自己写一份（`hostIsDark()`，与浮窗同一判定），`imw-dark:` 变体（`src/app.css:10`）才会命中成对令牌。不新增令牌、不改 `app.css` 变体。

**为什么 Esc/返回键走 `overlayLayers` 而不是照抄随机面板的槽位**：随机面板用的是 `__imwShufflePickerBack` 单槽位包装，`dispatchBack` 已经优先让位给它。选集面板再开一个槽位，面板关闭时两个包装的顺序就没有定义；交给层栈则「一次返回只关一层」自动成立（面板内还有内页时，先关选集再关内页再关面板）。

**网易云为什么保留一级菜单**：SPEC Assumptions 只要求「`MLOD`/`AOD` 的选集分支同样改走选集面板」。而一级菜单的「正序点播 / 乱序点播」是收藏里点播整张歌单的唯一入口（`playCollectionAll` 的内页头入口只服务 `CollectionRow`），删掉会让收藏整单点播失去入口。因此：一级菜单保留，`select===2` 换成面板。**B 站与多源不同**——它们的一级菜单只提供「整单 / 选集」两种能力，面板的「全选 + 正序/乱序」完全覆盖，故连菜单一起删（CAP-5 J3 也明写多 P 点播直接开面板）。

**多 P 内页的去向**：删掉两张卡的过渡「选集」钮后，`switchToMultiPage` 对 B 站/多源不再有入口（专辑/歌单仍用它）。story 2 与 story 4 deferred 里的「多 P 内页没有『‹返回』」因此不再成立——入口消失，而不是补了返回钮；`switchToMultiPage` 的多 P 分支**保留**（`openInnerPage` 已无调用者，删除）。

**点选顺序到播放顺序的落点**：面板只返回「条目数组」（顺序已在面板内定好），平台层照数组顺序循环；网易云 `finalODSONG` 本来就按入参 `songsID` 重排（`songMap` + `orderedSongs`），所以保序在这一层自然成立，不需要 `sort` 回填。

## Verification

**Commands:**
- `npm test` -- expected: 全部通过（含新增 `episodePicker.test.ts`、`openEpisodePicker.test.ts`、两个平台测试与 `IIROSEUtils.test.ts`，改写的 `mediaCards.test.ts` / `MainAppContainer.test.ts`）
- `npm run build` -- expected: `tsc -b && vite build` 无错误
- `npx prettier --check src/page src/page/components/episode-picker src/platforms src/iirose_func src/app.css` -- expected: 无差异

**Manual checks (if no CLI):**
- 真站（iirose 视频分享房）1280×720 × 400×800 × 宿站浅/深色：多 P 视频点播出面板（取色与 DESIGN `episode-picker` 一致：sheet 底 + rule 描边 + 蔷薇红序号徽章），全选 + 乱序后房间按该顺序播放（以聊天区 `div.msgholderBox` DOM 判定），关闭钮 / 点外侧 / `Esc` / 宿站返回键各只关一层。


## Auto Run Result

**Status:** done（第二轮：`done` spec 的复核跟进）

### Summary

跟进复核（4 个独立复核层）未发现 `high`，一条 `medium` 与九条 `low` 已就地修补；其余按下述理由拒绝或沿用首轮 defer。实质变化只有两处行为改动：选集面板**退场期间外框继续拦截指针**（不再让 160ms 窗口里的点击穿透到结果区），以及**清单例之前读焦点**并把面板内部元素排除出归还点（退场中重开不再继承上一份面板的来源）；另为桌面 B 站课程卡恢复「选集」入口，补回本 story 唯一一处能力损失。

### Files changed

- `src/page/components/media-card-container/VideoTile.tsx` — 恢复课程卡专用的「选集」文字钮（`onSelectEpisodes`，手机隐藏，手机走操作条）。
- `src/page/components/media-card-container/ResultsArea.tsx` — 只对 `bilibili.course_id` 传 `onSelectEpisodes`（内页钻取），其余条目仍由面板接管。
- `src/page/components/media-card-container/mediaFormat.ts` — `hasMultiPage` 注释改为现状（手机操作条 + 课程卡例外）。
- `src/page/components/media-card-container/mediaCards.test.ts` — 新增课程卡入口两条用例；改掉承诺过头的用例标题。
- `src/page/components/episode-picker/EpisodePicker.tsx` — 退场时只让卡片停收指针，外框照常拦截。
- `src/page/components/episode-picker/openEpisodePicker.tsx` — 清单例前读焦点；`isReturnTarget` 排除面板内部元素。
- `src/page/components/episode-picker/openEpisodePicker.test.ts` — 新增「`releaseEpisodePicker` 注销 `episode` 层」「退场中重开不继承归还点」两条用例。
- `src/page/components/episode-picker/episodePicker.test.ts` — 去掉 `void onCancel;` 占位。
- `src/page/components/desk/overlayLayers.ts` — 文件头关闭顺序改写（选集面板改为登记 `episode` 层）。
- `src/platforms/BilibiliPlatform.test.ts` — 删悬空文档注释，`playedPages` 注释归位。
- `src/platforms/AllVideosPlatform.test.ts` — 批量路径补卡片副行（集名）序列断言。
- `design.md` — §3.4 补上「网易云一级菜单仍经 `buildSelect2`」，消除与 §4 的自相矛盾。

### Review findings breakdown

- 补丁：**10** 条（medium 1、low 9）。
- 沿用首轮 `deferred`（carried）：1 条（AGENTS.md:59 的 `buildSelect2` 表述，改 agent-context 文件一律推迟；已有台账条目未改动）。
- 拒绝：17 条 —— `false` 4（失败文案按规格即「加载失败」／操作条空分派分支不可达／`ActionSheet` DOM 探针／`FOREIGN_ROOTS` 注释）、`maybe-false` 1（非 Error rejection 的 `undefined` 文案，若成立仅 low）、`low` 12（文字钮与状态行复用属重排、`aria-busy`/`aria-live` 属新增播报表面、动效机制分散、story 文档与 spec 文本缺陷、`unit` 类型收紧、`design.md` 空行混提、网易云面板叠在宿站淡出之下、矩阵「不回落内页」与课程分支的冲突、卡片删钮违背 Never、`z-[90010]` 挂在视图根——末两条沿用首轮判定 `carried`）。

### Verification

- `npm test` — 53 文件 / **952 用例全部通过**（新增 3 条用例）。
- `npm run build` — `tsc -b && vite build` 无错误（`dist/bundle.js` 425.05 kB）。
- `npx prettier --check src/page src/page/components/episode-picker src/platforms src/iirose_func src/app.css` — 无差异。
- 变异互证：把 `AllVideosPlatform` 批量循环的 `named: true` 去掉 → 新增的副行断言变红；把 `openEpisodePicker` 的焦点读取挪回清单例之后并去掉面板内排除 → 新增的重开用例变红。两处均已复原。

### Residual risks

- 桌面课程卡的「选集」入口只在 jsdom 里验证了「按钮存在 + 调 `switchToMultiPage`」，真站观感（遮罩里两颗按钮的排布、悬停命中区）未做真机检查。
- 多源批量点播的 150ms 呼吸仍无行为断言（需要假计时器与 `void` 调用链配合），改动发送节奏仍不会被测试发现。
- `.IIROSE_MEDIA_CONTAINER` 之外的 `#imw-episode-picker-root` 在宿站深浅色下的成对令牌取色、以及宿站返回键在真机的逐层关闭，仍待真站确认（与首轮同一缺口）。

### Follow-up review recommendation

`false` —— 本轮补丁为 medium 1 条 + low 9 条，跟进轮次只在补丁了 `high` 时才建议再跑；本轮没有 `high`，判定已收敛。
