---
title: 'story 2 · 结果区：曲目表、音乐网格、视频卡、专辑/歌单内页与状态'
type: 'feature'
created: '2026-10-29'
status: 'done'
route: 'dispatch'
baseline_commit: '5d08a8c752395e54eeb5cbd992bf674dd6e3ae66'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/specs/spec-media-desk-redesign/SPEC.md'
  - '{project-root}/_bmad-output/initiative-media-desk-redesign/ux-media-desk/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-media-desk-redesign/ux-media-desk/EXPERIENCE.md'
  - '{project-root}/_bmad-output/specs/spec-media-desk-redesign/brownfield.md'
warnings: ['oversized']
deferred:
  - summary: >-
      多 P / 多集内页没有「‹ 返回」按钮（内页头只服务专辑 / 歌单），手机上只能换范围或切模式退出。
    evidence: |-
      此前 switchToOutFromMultiPage 完全没有调用者（下钻后出不来），本 story 已补 Esc 与专辑/歌单内页头返回；
      `showCollectionHeader` 仍要求 innerCollection 非空，而 switchToMultiPage 只对 isSongList/isAlbum 置该字段。
      返回按钮与层级栈归 story 4（CAP-7/14）、选集面板归 story 5（CAP-8），两者落地时一并覆盖多 P 内页。
    location: >-
      src/page/MainAppContainer.tsx (showCollectionHeader)
    severity: medium
  - summary: >-
      多 P 内页的返回入口需要在 story 4 的层级栈里统一（与上一条同源，单独记录以免复盘漏判）。
    evidence: |-
      Esc 已可用，但手机没有键盘：真机上多 P 内页的退出路径只有范围标签与切模式；
      逐层关闭（Esc / 宿站返回键 / 浮层焦点归还）是 story 4 的验收面。
    location: >-
      src/page/MainAppContainer.tsx:177 (handleInnerPageEscape)
    severity: medium
  - summary: >-
      switchToMultiPage 的内页加载没有请求令牌，快速「A 进 → 返回 → B 进」时 A 的迟到结果可能覆盖 B 的 totalPage/allMediaData。
    evidence: |-
      内页分支只在 then 里读 state.isCurrentInMultiPage 兜底，搜索路径已有 requestToken 而内页路径没有；
      这是既有实现的竞态，本 story 只在其上加了 innerCollection，修复要贯穿令牌传递与全部内页入口。
    location: >-
      src/page/MainAppContainer.tsx:643 (switchToMultiPage)
    severity: medium
  - summary: >-
      结果区的呈现与交互（几何数值、hov: 悬停、:focus-within、无悬停宽屏点按、真实 #shareMediaSongName）只在 jsdom 的类串与合成 DOM 表面被证明。
    evidence: |-
      本 story 的验证是 npm test + npm run build；真站验收（J1–J5 × 1280×720/400×800 × 浅/深，点播成功以聊天区 div.msgholderBox 判定）按 SPEC 归 story 8 的总验收。
      另：真实服务层 catch 后返回空列表，「加载失败」在真机不可达（旧 MediaCard 同样如此，需服务层改造）。
    location: >-
      src/page/components/media-card-container/
    severity: medium
  - summary: >-
      AGENTS.md 尚未记录 nowPlaying.ts / roomSupport.ts / mediaFormat.ts、innerCollection 与「Esc 在内页先返回」的临时层级规则。
    evidence: |-
      这些是下一轮（story 3/4/5）最可能踩的坑：1s 只读轮询与退订、房间支持判定的唯一出口、展示派生纯函数层、
      内页 Esc 目前由 data-imw-order-menu DOM 探针判定层级。修的是 agent-context 文件，故不在本 story 内改。
    location: >-
      AGENTS.md
    severity: low
---

<intent-contract>

## Intent

**Problem:** 外壳已是纸/墨/蔷薇红（story 1），结果区却仍是前轮的天蓝卡片：`media-card-container/` 的 `MediaCard`/`MediaListRow`/`MediaCardButton`/`MediaCardImg` 全部依赖 `themed*` 与 `--imw-accent`，卡内堆「播放/选歌」双按钮、没有曲目表、没有正在播放态、加载/空/失败三种状态混用同一个占位（失败与「没有结果」不可区分）、专辑/歌单没有内页头与「全部播放」，`switchToOutFromMultiPage` 无调用者（下钻后出不来），封面也没有 `http→https` 升级与 `onerror` 回退。

**Approach:** 按 DESIGN.md 的组件键重写结果区：曲目表（`tracklist-header` + `tracklist-row`，桌面七列 / 手机四列）、音乐网格卡（`music-tile`）、视频卡（`video-tile`，含「直播」徽章与无悬停宽屏点按选中）、专辑/歌单行（`collection-row`）、专辑/歌单内页头（`collection-header` + 插件自有 `order-menu` 的「全部播放」）、收藏星（`favorite-star`）、状态部件（`state-message` / `text-button` / `skeleton-row` / `skeleton-tile`）。钻取沿用 `switchToMultiPage`，内页「全部播放」复用 `MLOD`/`AOD` 的整单批量逻辑（不经宿站 `buildSelect2`）。

## Boundaries & Constraints

**Always:**
- 颜色/字号/圆角只引用 `floating-panel/tokens.ts` 的成对类串；缺的令牌先加到 `tokens.ts`。结果区组件不得出现 `themed*`、`accentVar`、`bg-[#…]`、`rgba(` 裸值。
- 悬停效果一律放在 `hov:` 变体后（行高亮、点播按钮实心、视频遮罩）；无悬停宽屏（>768px 且 `(hover: none)`）用「第一次点按选中显示按钮、再点按钮点播」，键盘用 `:focus-within`（`group-focus-within`）显示同一按钮；点另一张卡改选它，点空白取消。
- 手机断点一律 `max-[768px]`，可点目标点击区 ≥44px；曲目行桌面七列 `38px 56px 1.6fr 1fr 74px 44px 96px`、手机四列 `48px 1fr auto 40px`；网格行保持 `[grid-auto-rows:max-content]`（否则按钮被 `overflow:hidden` 裁掉）。
- 封面/缩略图：`http://`→`https://` 升级、`onerror` 回退 `thumb` 底 + 自包含图标、`object-cover` 裁切填满、内环 `cover-ring`。
- 状态：加载＝静态骨架（无闪光）；无结果＝`state-message`；失败＝「加载失败」+「重试」；收藏/电台过滤无结果＝「没有匹配的收藏/电台」+「清除搜索」。
- 房间不支持点播（`window.mediaShareRoom === false`）时点播按钮与「全部播放」灰化（40% 不透明）、保留可聚焦，点击提示「这个房间不支持点播」。
- 内页：进入时保存外层现场与滚动位置，「‹ 返回」/`Esc` 回到原结果并保留关键词、页码与滚动位置。
- 「全部播放」顺序菜单为插件自有浮层（桌面贴按钮右对齐的小浮层、手机底部操作条），点外侧/`Esc`＝取消不点播；选定后按所选顺序点播整张列表（批量播报）。
- 现有链路存活：`currentOnDemandPlay` 点播、`switchToMultiPage` 钻取、`switchToOutFromMultiPage` 返回、分页（内页本地切片）、`Announce.runSingleAnnounce`/`runBatchAnnounce`、收藏存储与云同步、`SendFetch.neteaseRequest`。

**Never:**
- 不改底部条/迷你条（story 3）、手机操作条（story 4）、选集面板（story 5）、最近点播（story 6）、设置/关于页（story 7）、浮窗配色（story 8）。
- 不新增依赖、不新增 SCSS、不加载网络字体、不借用宿站 `mdi-*` 类、不用 emoji、不自绘 toast。
- 不改 `buildSelect2` 有序多选接管代码（story 5 整体移除）；新代码不得新增 `buildSelect2` 调用。
- 不改 `MLOD`/`AOD` 现有的弹窗入口语义（`@` 链接、收藏点播仍走原选择器）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| 桌面曲目表 | 音乐单曲、列表视图、>768px | 七列表头 + 行（序号/封面/标题+歌手/出处/时长/星标/点播胶囊） | — |
| 手机曲目表 | ≤768px | 四列（封面/标题+歌手/时长/40px 点播钮），无表头、序号、出处、星标 | 点播钮一键点播 |
| 悬停 | 鼠标移入行 / 卡 | 整行 `hover` 底、点播钮转实心蔷薇红；卡片出「点播到房间」胶囊 | 触屏不触发、不残留 |
| 无悬停宽屏 | `(hover: none)`、>768px、点卡片 | 首次点按只选中并显示按钮（描边表示已选中），再点按钮点播 | 点空白取消选中 |
| 键盘 | Tab 到卡片/行内 | `:focus-within` 显示同一按钮；顺序为卡片主体 → 按钮 | — |
| 正在播放 | 房间正在放 `X`，结果含 `X` | 序号换三根蔷薇红音柱、标题蔷薇红、歌手后接「· 房间正在播放」 | 标题缺失不误标 |
| 视频卡 | 视频/MV/直播结果 | 16:9 缩略图 + 右下等宽时长胶囊；直播换「直播」徽章、不显示时长 | 封面失败回退 thumb + 图标 |
| 专辑/歌单行 | 音乐「专辑」/「歌单」范围 | 行末为右向箭头，整行可点进入内页（`switchToMultiPage`） | 不可点播整张（整张在内页头） |
| 内页返回 | 内页 + 点「‹ 返回」或 `Esc` | 回到原结果，关键词/页码/滚动位置与进入前一致 | 无外层现场时不动作 |
| 全部播放 | 内页头点「全部播放」 | 弹顺序菜单「正序播放 / 乱序播放」；选定按该顺序批量点播整张 | 点外侧/`Esc`＝取消；房间不支持时灰化 |
| 音乐首屏 | 音乐单曲、未搜索、无结果 | 「搜索歌名或歌手，点播到房间。」（最近点播在 story 6 接管此位） | — |
| 收藏为空 | 收藏模式、无任何收藏 | 「还没有收藏。在曲目旁点星标即可收藏。」 | — |
| 加载中 | 请求未完成 | 列表＝骨架行、网格＝骨架瓦片；搜索栏与范围行可用 | — |
| 无结果 | 搜索返回空 | 「没有找到结果。换个关键词试试。」 | — |
| 加载失败 | Promise reject | 「加载失败」+「重试」，重试重发当前范围（内页重载内页） | 不刷屏提示 |
| 收藏/电台过滤无结果 | 有关键词、本地过滤后为空 | 「没有匹配的收藏」/「没有匹配的电台」+「清除搜索」 | 清除后回到全量 |

</intent-contract>

## Code Map

- `src/page/components/media-card-container/` -- 结果区全部组件，本 story 整体重写；旧 7 个文件（`MediaCard.tsx` `MediaListRow.tsx` `MediaCardButton.tsx` `MediaCardImg.tsx` `MediaCardInfo.tsx` `MediaCardMessage.tsx` `FavoriteStarButton.tsx`）删除。
- `src/page/components/floating-panel/tokens.ts` -- 令牌唯一来源；现有 `deskPaper/deskSheet/deskHover/deskThumb/deskInk*/deskRose*/deskRule/deskRing/deskSourceDots/deskFocusRing*/type*/rounded*` 可直接用，本 story 需补 `star-on`、`skeleton`、`cover-ring`、`duration-pill`、`video-scrim`、`hov:` 门控的悬停底与点播实心态，以及 `row-title`/`row-meta`/`row-meta-source`/`video-title`/`video-meta`/`mono-pill`/`mono-num-sm` 字号与 `sort`/`shuffle` 图标。
- `src/page/components/media-container-context/MediaContainerContext.tsx` -- 现有四个成员（`switchToMultiPage`、`currentOnDemandPlay`、`updateCurrentInMultiPageStatus`、`ShowOrHideIMC`），唯一消费者是旧 `MediaCardButton`；新结果区继续用它点播/钻取，并补 `switchToOutFromMultiPage` 与 `onRowActivate`（手机操作条挂点，story 4 填充）。
- `src/page/MainAppContainer.tsx` -- 结果区宿主：`render()` L249–257 挂 `<MediaCard key={mode} mediaData settingsData viewMode />`；`switchToMultiPage` L553–631（内页数据，未保存集合 `platformData`）、`switchToOutFromMultiPage` L636–647（**无调用者**）、`changecurrentPage` L515–541（内页本地切片）、`componentDidUpdate` L147–158（`oldItems` 快照）、`runCurrentScope` L383–389（重试/重取入口）、`viewToggleMode` L297–306。
- `src/page/MainAppControlLayer.tsx` L204–206 -- `Esc` 直接关面板；本 story 不改它，改由 `MainAppContainer` 在**内页**时用捕获阶段监听先拦 `Esc`（story 4 统一为逐层关闭）。
- `src/platforms/NetEasePlatform.ts` -- `MLOD` L693–796（歌单整单：`select===0` 正序 / `===1` 乱序 → `Announce.runBatchAnnounce(name, N, () => finalODSONG(ids), description)`）、`AOD` L802–898（专辑同构）、`finalODSONG` L967–1035（`private`，按入参顺序逐曲发卡片 + `&1`）、`buildSelect` L13–57（宿站弹窗，本 story 不新增调用）。
- `src/page/components/desk/ScopeRow.tsx` -- 内页时被 `collection-header` 取代；标签/视图/分页的类串与 `role` 写法是本 story 的样式参照。
- `src/page/MainAppContainer.test.ts` L56–58 -- mock 了 `./components/media-card-container/MediaCard`，容器组件改名后需同步。
- `src/page/components/media-card-container/mediaCards.test.ts` -- 313 行旧断言（`themedCard`、`--imw-accent`、白卡片、双按钮、`message={0|1|2}`），整体改写。
- `src/app.css` L331–399 -- mdi `::before` 码点表；`.containerSpin/.searchLogo/.noresultLogo/.headphonesIcon/.playIcon/.playlistPlusIcon/.starOutlineIcon/.starSolidIcon` 重写后无引用可删，`.listViewIcon/.cardViewIcon`（设置页与收藏随机面板）必须保留。
- `src/media-progress/HostMediaBridge.ts` L122 -- 宿站当前媒体标题的唯一来源 `#shareMediaSongName`；`MediaSnapshot.title` 只对浮窗暴露，结果区需自建只读订阅（不复用 `HostMediaBridge`，避免第二个控制观察者）。
- `src/iirose_func/ShowMessage.ts` -- `ShowMessage.show`（房间不支持点播的提示出口）。
- `src/iirose_func/Global.ts` L23 -- `window.mediaShareRoom?: boolean` 类型已声明。
- `src/storage/FavoritesStorageService.ts` -- `isFavorited` / `toggle` / `deriveFavoriteId`（收藏星沿用）。

## Tasks & Acceptance

**Execution:**
- `src/page/components/floating-panel/tokens.ts` -- 补 `deskStarOn`、`deskSkeleton`、`deskCoverRing`（inset）、`deskDurationPill`、`deskVideoScrim`、`deskRowHover`（`hov:` 门控）、`deskSendHover`（实心蔷薇红 + 深色 `rose-fill-dark`）、`typeRowTitle`/`typeRowMeta`/`typeRowMetaSource`/`typeVideoTitle`/`typeVideoMeta`/`typeMonoPill`/`typeMonoNumSm`，`DeskIcon` 增 `sort`/`shuffle` -- 组件零裸值。
- `src/page/components/media-card-container/Cover.tsx`（新）-- 封面/缩略图：https 升级、`onerror` 回退 thumb 底 + 图标、`object-cover`、内环、可传尺寸与圆角 -- 取代 `MediaCardImg`。
- `src/page/components/media-card-container/mediaFormat.ts`（新）-- `formatDuration`（mm:ss）、`trackCountLabel`（「N 首」）、`sourceOf`（来源圆点 + 平台简称）、`isLiveItem`、`isCollectionItem`、`hasMultiPage`（解析 `platformData.multiPage`）-- 展示派生集中在纯函数里。
- `src/page/components/media-card-container/nowPlaying.ts`（新）-- `subscribeNowPlayingTitle`：1s 轮询 `#shareMediaSongName`，仅在有人订阅时运行，返回取消函数 -- 结果区标记「房间正在播放」。
- `src/page/components/media-card-container/roomSupport.ts`（新）-- `roomSupportsRequest()`（`window.mediaShareRoom !== false`）与 `notifyRoomUnsupported()`（`ShowMessage.show("这个房间不支持点播")`）-- 灰化与提示的唯一出口。
- `src/page/components/media-card-container/FavoriteStar.tsx`（新）-- 18px 星标（`star`/`starf` + `deskStarOn`），点击切换、乐观更新失败回滚，不可收藏条目返回 null -- 取代 `FavoriteStarButton`。
- `src/page/components/media-card-container/TracklistRow.tsx` `TracklistHeader.tsx`（新）-- 桌面七列 / 手机四列、表头仅桌面、悬停门控、正在播放音柱与后缀、出处列（来源圆点 + 简称）、等宽时长、星标与点播胶囊（`aria-disabled` + `title` 说明）、行体点击走 `onRowActivate` -- CAP-5 曲目表。
- `src/page/components/media-card-container/MusicTile.tsx` `VideoTile.tsx`（新）-- 1:1 与 16:9 卡、时长胶囊 / 直播徽章、遮罩 + 胶囊、`group-focus-within`、无悬停宽屏点按选中、多 P/多集条目的过渡「选集」入口（`switchToMultiPage`，story 5 由选集面板取代）-- CAP-5 网格。
- `src/page/components/media-card-container/CollectionRow.tsx`（新）-- 专辑/歌单行：沿用曲目行列结构，时长列换等宽曲目数，末列右向箭头，整行可点进入内页 -- CAP-5 专辑/歌单行。
- `src/page/components/media-card-container/OrderMenu.tsx` `CollectionHeader.tsx`（新）-- 内页头（「‹ 返回」+ 名称 + 曲目数 + 「全部播放」）与插件自有顺序菜单（桌面浮层 / 手机底部条、透明拦截层、`role="menu"`/`menuitem`、`Esc` 自管、焦点移入并归还）-- CAP-5 全部播放。
- `src/page/components/media-card-container/StateMessage.tsx` `Skeletons.tsx`（新）-- 状态文案 + 文字钮；骨架行 / 骨架瓦片 -- 状态模式。
- `src/page/components/media-card-container/ResultsArea.tsx`（新）-- 结果区容器：Promise 状态机（loading/error/空/未搜索）、按模式与范围选形态、音乐首屏与收藏空文案、滚动到顶与内页滚动位置保存恢复、`settingsData` 走设置卡网格、订阅正在播放标题 -- 取代 `MediaCard`。
- `src/page/components/media-card-container/` 旧 7 个文件 -- 删除 -- 死码清理（先 grep 确认无引用）。
- `src/page/components/media-container-context/MediaContainerContext.tsx` -- 补 `switchToOutFromMultiPage`、`onRowActivate` -- 内页返回与手机操作条挂点。
- `src/page/MainAppContainer.tsx` -- 新增 `innerCollection` 状态（进内页保存集合 `platformData`，返回/换范围/换来源/搜索时清空）、内页时用 `CollectionHeader` 取代 `ScopeRow`、接上 `switchToOutFromMultiPage`、`onRetry`（内页重载内页，否则 `runCurrentScope`）、`onPlayAll`（`NetEasePlatform.playCollectionAll`）、内页 `Esc` 捕获监听（顺序菜单打开时不拦截）-- CAP-5 内页与返回。
- `src/platforms/NetEasePlatform.ts` -- 抽出整单批量入口 `playCollectionAll(platformData, order)`（按 `isSongList`/`isAlbum` 复用 `getSongListDetail`/`getAlbumDetail` + `runBatchAnnounce` + `finalODSONG`），`MLOD`/`AOD` 的 `select===0/1` 改为委托它 -- 复用整单逻辑且不弹宿站窗。
- `src/app.css` -- 删结果区专用 mdi 码点（`containerSpin`/`searchLogo`/`noresultLogo`/`headphonesIcon`/`playIcon`/`playlistPlusIcon`/`starOutlineIcon`/`starSolidIcon`）与其 `font-family` 表项，保留 `listViewIcon`/`cardViewIcon`；更新 `--imw-accent` 过渡注释（只剩设置卡）-- 死码清理。
- `AGENTS.md` -- 把「结果区与设置组件仍在用 `themed*`」改为只剩设置卡，并记结果区组件键与「全部播放不走 `buildSelect2`」-- CAP-13 同步。
- `src/page/components/media-card-container/mediaCards.test.ts` -- 整体改写：令牌成对与无裸值、封面 https/回退、曲目表七列/四列与表头、正在播放态、`hov:` 门控、点播与房间不支持、视频 16:9 与直播徽章、无悬停点按选中、音乐卡 1:1、专辑/歌单行钻取、内页返回、全部播放顺序菜单（断言未调用 `buildSelect2`）、音乐首屏/收藏为空/骨架/空/失败重试 -- 覆盖 I/O 矩阵。
- `src/page/MainAppContainer.test.ts` -- 同步 mock 路径，补内页保存/返回现场、`Esc` 在内页返回、`onPlayAll` 委托 -- 容器契约。

**Acceptance Criteria:**
- Given 音乐单曲结果、桌面宽度 >768px、列表视图，when 观察结果区，then 显示七列表头与曲目行，行内点播为描边胶囊、悬停转实心。
- Given 手机宽度 ≤768px，when 观察曲目行，then 为四列（封面/标题+歌手/时长/点播钮），无表头、序号、出处与星标。
- Given 房间正在放某曲且该曲在结果中，when 观察该行，then 序号换音柱、标题蔷薇红、歌手后接「· 房间正在播放」。
- Given 结果区任一组件，when 检查渲染出的 class，then 不含 `themed`/`accentVar`/`bg-[#`/`rgba(`，且所有悬停类都以 `hov:` 开头。
- Given 音乐「专辑」范围，when 点某专辑行，then 打开内页（内页头 + 曲目行），点「‹ 返回」或按 `Esc` 回到原结果且关键词、页码、滚动位置不变。
- Given 内页头，when 点「全部播放」再选「乱序播放」，then 按乱序批量点播整张列表，且全程未调用宿站 `buildSelect2`。
- Given 房间 `mediaShareRoom === false`，when 点任一点播入口或「全部播放」，then 入口灰化且提示「这个房间不支持点播」，不发送任何报文。
- Given 请求失败，when 结果区渲染，then 显示「加载失败」+「重试」，点重试重发当前范围（内页则重载内页）。
- Given 仓库，when 运行 `npm test` 与 `npm run build`，then 全绿。

## Spec Change Log

## Review Triage Log

### 2026-10-29 — Review pass（续：上轮 patch 只部分落地，本轮补做）

- verdicts: 59 findings — high 0, medium 19, low 37, false 3, maybe-false 0
- findings:
  - `[low]` `[reject]` `[carried]` `formatDuration` 只算 `mm:ss`，≥1h 输出 `180:00` — 前轮已判：旧实现同样输出 `90:00`，属既有表现；小时位不改变点播行为。
  - `[low]` `[reject]` `[carried]` 手机端没有收藏入口而空态文案指向星标 — 前轮已判：手机收藏入口按 EXPERIENCE 归 story 4 的操作条，文案是过渡期既知偏差。
  - `[medium]` `[patch]` `[carried]` `isCollectionItem` 只有单测、容器内联同一份判断 — 本轮补做：`switchToMultiPage` 改用 `isCollectionItem(platformData)`，判据回到唯一来源。
  - `[low]` `[reject]` 收藏里的专辑/歌单被渲染成曲目行（时长空、无「N 首」、无进入箭头） — 收藏记录的专辑仍经点播弹窗的 AOD/MLOD 提供整单与选集，能力未丢；补一套收藏形态要新增形态派生与内页入口，不是直接修正。
  - `[medium]` `[patch]` `[carried]` 视频卡丢失「正在播放」标记 — 上轮只补了收藏星；本轮给 `VideoTile` 加 `nowPlaying` prop 与音柱徽章，`ResultsArea` 传值，并补用例。
  - `[low]` `[reject]` `isPhoneLayout` / `isTapToReveal` / `roomSupportsRequest` 只在渲染时读一次，无 matchMedia 订阅 — 旋转后 JS 判定滞后到下一次渲染；订阅要新增 media query 监听与清理，超出直接修正。
  - `[low]` `[patch]` `isTapToReveal` 把 `window.matchMedia` 摘出来裸调用 — 改为 `window.matchMedia?.(...)`，与同文件其他判定同形（Chromium 实测不抛，但去掉跨浏览器风险）。
  - `[low]` `[reject]` `[carried]` 正在播放轮询在面板关闭后不停 — 1s 一次只读一个 DOM 文本，开销可忽略；随面板可见性启停需要额外接线。
  - `[medium]` `[patch]` `StateMessage` 的文字钮没有 44px 触控区与焦点环 — 补 `min-h-[44px]` + `deskFocusRing`（DESIGN `text-button.hit-area`），失败态用例断言该 class。
  - `[false]` `[reject]` `deskTextButton` 的蔷薇红与「蔷薇红只表示点播 / 房间正在放」冲突 — DESIGN.md `text-button.foreground` 明确写 `{colors.rose}`，令牌纪律的权威是 DESIGN.md；`AGENTS.md` 的一句概括不构成禁令。
  - `[low]` `[reject]` `[carried]` 内页分页首末页无禁用态 — 与前轮一致：与 story 1 `ScopeRow` 的越界不动作同风格。
  - `[low]` `[patch]` 内页头手机端标题被右群组压成省略号 — 曲目数在 `max-[768px]` 隐藏（手机曲目行本身带时长），标题拿回预算。
  - `[low]` `[reject]` `[carried]` 顺序菜单只算一次定位 — 前轮已判：拦截层挡住滚动，`anchor` 只在按钮点击后取 ref 必不为空。
  - `[low]` `[reject]` `[carried]` 顺序菜单缺方向键导航与焦点陷阱 — 前轮已判：`Esc` / 点外侧 / 焦点移入与归还已实现，菜单键盘模型留待 story 4 的统一浮层规范。
  - `[low]` `[reject]` `[carried]` 内页 `Esc` 用 `data-imw-order-menu` DOM 探针判定层级 — 临时耦合已写进 Design Notes，story 4 的整体层级栈会替换。
  - `[low]` `[patch]` `[carried]` 内页空态借用外层文案；非单曲的音乐范围未搜索也提示「搜索歌名或歌手」 — 本轮补做：`isInnerPage` 分支给「这张列表没有曲目。」，首屏引导只对单曲范围出现。
  - `[medium]` `[defer]` `switchToMultiPage` 内页加载没有请求令牌（A→返回→B 可能被 A 的迟到结果覆盖） — 既有实现的竞态，本次只在其上加了 `innerCollection`；修复要贯穿令牌传递，记入 deferred。
  - `[false]` `[reject]` `openCollection` 先标内页再 `void` 钻取、无失败回滚 — 唯一入口（网格卡的「选集」与专辑行）都以 `hasMultiPage` 的 `platform` 判定过，`switchToMultiPage` 的早退分支从这些入口不可达；`Esc` 也有返回路径。
  - `[low]` `[reject]` `[carried]` 设置/关于在 `settingsData` 落地前渲染空白 — 设置数据是同步 `setState` 写入，空白只存在一帧。
  - `[low]` `[patch]` `[carried]` 封面覆盖按钮无焦点环、`<img>` 无 `loading="lazy"` / `decoding="async"` — 本轮补做两者，并给 `alt` 与来源页按钮带上曲目标题（读屏可分辨）。
  - `[low]` `[reject]` 两份「单主题令牌」豁免清单要手工同步 — 内部测试卫生，抽共享常量属重构，不影响产出。
  - `[low]` `[reject]` `[carried]` `deskDurationPill` / `deskVideoScrim` 写重复同值的 `imw-dark:` 并被豁免 — 值本身正确，改名要同时动三处测试清单。
  - `[low]` `[patch]` `playCollectionAll` 沿用 `sort(() => Math.random() - 0.5)`（分布不均）、`let ... = null` 死初值 — 洗牌改 Fisher–Yates，初值改 `const`；同一行里「`void runBatchAnnounce` 无兜底」部分为 false：该函数自带兜底 `catch`、契约写明不上抛。
  - `[low]` `[reject]` `PlayOrder` 定义在展示组件里而被容器导入、平台又重写同一字面量联合 — 抽共享类型要动三处，不是直接修正。
  - `[low]` `[reject]` 「选集」入口只落在网格卡 — Design Notes 已写明列表视图经 `VOD` 既有选择器选集，story 5 的选集面板统一。
  - `[low]` `[reject]` 测试用白名单枚举 `media-card-container/` 的源文件 — 目录派生守卫属测试重构。
  - `[low]` `[patch]` `MainAppContainer.test` 的 `expect(before).toBeDefined()` 是空断言 — 改为进入内页前取外层数据承诺，返回后断言 `state.mediaData` 是同一份。
  - `[medium]` `[patch]` 测试缺时序与生命周期覆盖（轮询启停、星标、选集、封面打开、序号偏移、内页文案） — 本轮补齐（见下方各 `[patch]` 行的用例），仍缺的小时位与分页钮态随对应 reject 行不补。
  - `[low]` `[defer]` `AGENTS.md` 未记 `nowPlaying.ts` / `roomSupport.ts` / `mediaFormat.ts` / `innerCollection` 与内页 `Esc` 规则 — 修的是 agent-context 文件，记入 deferred。
  - `[low]` `[patch]` `MediaContainerContext` 的 `switchToOutFromMultiPage` 没有消费者 — 从上下文与 Provider 移除（内页返回走 `CollectionHeader` 的 `onBack` prop）。
  - `[low]` `[patch]` `Skeletons` 默认 8 与页大小 10 不一致 — 骨架行与音乐网格按 10、视频网格按 8（两行满格），数据落地不跳行。
  - `[low]` `[patch]` `[carried]` `ResultsArea` 内页空列表文案 — 与上方「内页空态」同一处修复。
  - `[low]` `[patch]` 曲目序号每页从 01 重排，与内页头「24 首」矛盾 — 新增 `pageOffset` prop，容器传 `(currentPage - 1) * itemsPerPage`，用例断言第二页首行为 11。
  - `[low]` `[patch]` 星标连点竞态（两次 toggle 交错落地） — `pending` ref 守卫 + 用例（第二次点击被丢弃）。
  - `[low]` `[patch]` 顺序菜单定位在后置 effect 里算，先闪左上角 — 改 `useLayoutEffect`，绘制前定位。
  - `[low]` `[reject]` `[carried]` 顺序菜单越出视口底部、不夹取 — 与前轮定位判断同一条：拦截层阻止滚动，缩放属罕见操作。
  - `[low]` `[patch]` 无外层现场时内页 `Esc` 被吞（面板也关不掉） — `oldItems` 为空时直接放行，不再 `stopPropagation`。
  - `[low]` `[patch]` 异步封面未落地前先闪占位图标 — `Cover` 新增 `settled`：Promise 未落地只画 thumb 底块，落地后才是图标或图片。
  - `[low]` `[reject]` 列表视图失去「选集」入口（`MediaListRow` 被删） — 同「选集只落在网格卡」一条：列表视图经 `VOD` 既有选择器选集。
  - `[low]` `[patch]` `[carried]` `@keyframes spin` / `fadeIn` 随旧组件成为孤儿 — 本轮删除两段定义（`animate-spin` 走 Tailwind 自带 keyframes）。
  - `[medium]` `[defer]` 多 P / 多集内页没有「‹ 返回」，手机上只能换范围或切模式 — 此前完全无返回路径（`switchToOutFromMultiPage` 无调用者），本次已补 `Esc`；返回按钮与层级栈归 story 4、选集面板归 story 5，记入 deferred。
  - `[medium]` `[patch]` `[carried]` `playCollectionAll` 的顺序语义没有任何测试 — 本轮补 `src/platforms/NetEasePlatform.test.ts`：歌单 / 专辑各自端点、`asc` 保序、`shuffle` 为同集合置换、标题 / 数量 / 简介交给 `runBatchAnnounce`、详情为空静默、非集合条目提示、`buildSelect2` 未被调用。
  - `[medium]` `[patch]` `[carried]` 收藏星的已收藏态与 `init()` 后重读无覆盖 — 本轮补用例：`aria-pressed`、`deskStarOn` / `deskInk3`、实心与空心路径、toggle 失败回滚、连点只认第一次、`init()` 落地后自我纠正、不可收藏返回 null。
  - `[medium]` `[patch]` `[carried]` 多 P / 多集的「选集」入口无覆盖 — 本轮补 `VideoTile` 的「选集」出现与点击、无 `multiPage` 不出现、`multiPage` 拒绝按「没有多集」处理。
  - `[medium]` `[patch]` `[carried]` 正在播放的 1s 轮询无覆盖 — 本轮补 fake timer 用例：挂载后改标题 + 推进 1s 高亮迁移，卸载后 `vi.getTimerCount()` 归零。
  - `[low]` `[patch]` `[carried]` 点击封面打开来源页没有断言 — 本轮补 `window.open` 断言（含 `aria-label` 带标题）与「无来源网址不渲染按钮」。
  - `[medium]` `[patch]` `[carried]` `onRetry` / `onClearSearch` 的接线没有测试（两半各自有，接缝没有） — 容器测试改为记录 `ResultsArea` 桩收到的实参并直接调用 `onRetry` / `onClearSearch`，另加 `pageOffset` 跟随翻页的断言。
  - `[low]` `[patch]` 曲目行的点播按钮读屏名恒为「点播」，一屏几十行无法分辨 — `TracklistRow` 传入 `点播 <标题>`；封面覆盖按钮同理。
  - `[medium]` `[patch]` `[carried]` `isCollectionItem` 生产无调用点、容器内联重复 — 同首条 patch：容器改用该函数。
  - `[medium]` `[patch]` `[carried]` 手机点行体 / 卡主体落到空实现 — `handleRowActivate` 回落为直接点播（房间不支持时提示），story 4 再换成操作条。
  - `[medium]` `[defer]` 呈现与几何的期望在真实计算样式，证据只在 class 串表面 — 本轮验证仍是 vitest + jsdom；真站验收（1280×720 / 400×800 × 浅深、J1–J5）归 story 8，记入 deferred。
  - `[medium]` `[defer]` 悬停 / 焦点 / 无悬停点按的期望在指针与焦点真实状态，证据在变体前缀字符串 — 同上，`hov:` 与 `(hover: none)` 的真机表现归 story 8 总验收。
  - `[medium]` `[patch]` 端到端「批量播报」的期望在宿站报文，证据只在被 mock 的调用形状 — 本轮 `NetEasePlatform.test.ts` 执行到 `finalODSONG` 收到的 id 序列（不再是纯 mock 断言）。
  - `[medium]` `[defer]` 内页返回的通用性：`‹ 返回` 只出现在专辑 / 歌单 — 同「多 P 内页无返回」一条，记入 deferred。
  - `[medium]` `[patch]` 手机点按留了「有标签、无动作」的落点 — 同 `handleRowActivate` 回落一条。
  - `[false]` `[reject]` 视频卡星标、封面来源热点、「选集」过渡入口属矩阵外新增面 — 这三处都在 intent 的「现有链路存活」（收藏存储、来源链接、`switchToMultiPage` 钻取）之内，DESIGN 组件键也不排斥；保留是遵守 `Always`，不是偏离。
  - `[medium]` `[defer]` 异步 / 生命周期（滚动恢复时序、失败态真实可达性、正在播放取自真实宿站）只在 jsdom 表面被证明 — 滚动恢复已按数据承诺同一性修复；「加载失败」在真实服务层不可达属既有行为，真站验收归 story 8。
  - `[low]` `[reject]` 令牌纪律守卫的逸出（正则不覆盖 `shadow-`/`ring-`、白名单把伪成对豁免） — 内部守卫的完备性；`text-button` 的 44px 缺口已单独 patch。
  - `[low]` `[reject]` DESIGN 的 `order-menu` 挂载点与实现（document 级 `fixed inset-0` 拦截层）不一致 — 菜单本身仍渲染在面板 DOM 内，透明拦截层覆盖视口正是「点外侧取消」的实现方式，用户所见语义与 DESIGN 一致；改挂载策略属重构。

### 2026-10-29 — Review pass（首轮；patch 未全部落地，下一条续轮补做）

- verdicts: 61 findings — high 1, medium 18, low 35, false 6, maybe-false 1
- findings:

  - `[false]` `[reject]` NetEasePlatform 的 `NeteaseSettings` 成为死导入 — 该导入仍被 L531/L623/L1003 使用，未失效。
  - `[medium]` `[defer]` 失败态在真机不可达（服务层 catch 后返回空列表，promise 不 reject） — 旧 `MediaCard` 的错误分支同样不可达，属既有行为；矩阵以「Promise reject」为前提，组件侧已实现并测试。真机「加载失败」需服务层改造，留给后续 story。
  - `[low]` `[patch]` 内页空态借用了外层文案 — 0 曲目专辑会显示「搜索歌名或歌手…」；加 `isInnerPage` 分支文案。
  - `[false]` `[reject]` 收藏模式不分专辑/歌单形态导致整张当单曲点播 — `FavoritesService` 的 `onDemandPlay` 按条目形态分派 `AOD`/`MLOD`，点播结果正确；收藏记录本就不带 `multiPage`，钻取不是既有能力。
  - `[maybe-false]` `[reject]` 播完后标题仍匹配导致「正在播放」常亮 — 需真机确认`#shareMediaSongName`在 cut 后是否清空；即便成立也只是低影响的残留高亮，且加判定要多读一次宿站状态。
  - `[low]` `[reject]` 正在播放轮询在面板关闭后不停 — 1s 一次只读一个 DOM 文本，开销可忽略；改成随面板可见性启停需要额外接线，超出「直接修正」。
  - `[medium]` `[patch]` 内页返回的滚动恢复与渲染抢跑（jsdom 不截断，故测试恒真） — 恢复要等外层数据 ready 后再写 `scrollTop`。
  - `[medium]` `[patch]` 网格卡「点播」胶囊手机触控区 38px < 44px — 补 `max-[768px]:h-11` 与外扩点击区。
  - `[medium]` `[patch]` 手机点行/卡主体落到空实现 `handleRowActivate` — story 4 之前先回落为直接点播，避免死点击。
  - `[low]` `[patch]` 作者为空时正在播放后缀以「 · 」开头 — 与 `MusicTile` 对齐为条件分隔符。
  - `[medium]` `[patch]` 视频卡丢失收藏星与正在播放标记（桌面无法收藏视频） — 桌面右下角补 `FavoriteStar`（手机仍走操作条）。
  - `[low]` `[reject]` 手机网格无收藏入口而空态文案指向星标 — 手机收藏入口按 EXPERIENCE 归 story 4 的操作条，文案是过渡期的既知偏差。
  - `[low]` `[reject]` 顺序菜单只算一次定位、`anchor` 为空时贴左上角 — `anchor` 只在按钮点击后取 ref，必不为空；拦截层挡住滚动，重算时机不构成可复现缺陷。
  - `[low]` `[reject]` 顺序菜单缺方向键导航与焦点陷阱 — `Esc`/点外侧/焦点移入与归还均已实现，两项菜单的方向键细化留待 story 4 的统一浮层规范。
  - `[medium]` `[patch]` `FavoriteStar` 丢掉 `init()` 后重读与外部变更同步 — 慢速 IndexedDB 下已收藏曲目会显示空心星且点一下即取消收藏；恢复初始化重读。
  - `[low]` `[patch]` 点击封面/胶囊打开来源页的能力被静默移除 — 行内封面补一个「打开来源页」覆盖按钮，保留既有入口。
  - `[low]` `[patch]` `@keyframes spin` / `fadeIn` 随旧组件成为孤儿 — 与 `::before` 码点一起删除。
  - `[low]` `[reject]` `deskDurationPill` / `deskVideoScrim` 写了重复的 `imw-dark:` 值又被豁免出成对检查 — 纯内部一致性，值本身正确，改动要同时动三处测试清单。
  - `[low]` `[reject]` `CollectionHeader` 的裸数值与 `deskTextButton` 的 `p-0` 覆盖 — 与 story 1 的 `ScopeRow` 同风格（间距/分页尺寸同样裸写），不单独为内页头造令牌。
  - `[low]` `[reject]` 内页分页首末页无禁用态 — 与 story 1 `ScopeRow` 的越界不动作一致，用户点空得到的是「不发生」而非错误。
  - `[medium]` `[patch]` 测试缺时序与生命周期覆盖（封面 Promise、`hasMultiPage` reject、菜单手机分支、轮询启停、星标回滚） — 补这些用例。
  - `[low]` `[reject]` `mediaFormat.ts` 自述「纯函数」与实现不符、时长不处理 ≥1h — 旧实现同样输出 `90:00`，属既有表现；注释措辞不改变行为。
  - `[low]` `[patch]` `playCollectionAll` 的 `catch` 在非 Error 抛出时提示 `undefined` — 归一到字符串。
  - `[low]` `[reject]` 内页 `Esc` 用 `data-imw-order-menu` DOM 探针判定菜单是否打开 — 临时耦合已写进 Design Notes，story 4 的层级栈整体替换。
  - `[low]` `[reject]` 退出内页仍是串行 `setState` — 既有写法，本次只加一个字段；没有可演示的失败路径。
  - `[low]` `[reject]` 「房间是否支持点播」有两份判定且 render 期取一次 — 面板每次打开都会重渲染并重读；换房间不重渲染的场景无法演示。
  - `[low]` `[patch]` `Cover` 缺 `loading="lazy"` / `decoding="async"` — 网格一次拉十几张原图，补上即可。
  - `[high]` `[patch]` `SourceCell` 返回 null 时整行少一个网格单元，时长/星标/点播整体左移（多源剧集内页与无来源条目必现） — 恒渲染一个占位单元。
  - `[low]` `[reject]` 设置/关于在 `settingsData` 落地前渲染空白 — 设置数据是同步 `setState` 写入，空白只存在一帧。
  - `[low]` `[reject]` 顺序菜单滚动/缩放后不重算位置 — 拦截层阻止滚动，缩放属罕见操作，见上条定位判断。
  - `[low]` `[reject]` 顺序菜单 `matchMedia` 在挂载时取一次，转屏不更新 — 转屏后菜单通常已被关闭，重开即重算。
  - `[low]` `[reject]` 顺序菜单缺方向键导航与焦点陷阱 — 同前一条菜单语义判断。
  - `[low]` `[patch]` 卡片主体按钮的 `aria-label` 在手机上仍读「点播 X」 — 按布局改为「查看 X」。
  - `[low]` `[patch]` `innerPageSource` 未进 `ModeSnapshot`，切模式回来后内页「重试」会跑外层范围 — 存进快照。
  - `[low]` `[patch]` 行内封面点击打开来源页的能力随 `MediaCardImg` 消失 — 同「打开原始网页」一条，一并补回。
  - `[low]` `[patch]` `FavoriteStar` 缺 `init()` 后重读 — 同前，合并修复并补测试。
  - `[false]` `[reject]` 多 P 条目在 `multiPage` 解析前即可点播（旧实现有拦截） — `VOD` 自身走 `buildBiliSelect` 处理多 P，提前点播不会产生错误行为。
  - `[false]` `[reject]` AC「渲染 class 不含 `bg-[#…]`」未被强制 — AC 的约束对象是组件源码（源码测试已断言），令牌本身就是「浅深成对的 hex 类串」，渲染结果必然含 hex。
  - `[low]` `[reject]` `TracklistHeader` 未单独成文件，与 Code Map 不符 — 修复方式是改 spec，按规则拒绝。
  - `[low]` `[patch]` `playCollectionAll` 调用处没有房间支持二次校验（灰化基于 render 期快照） — 点击时再判一次，与行内点播一致。
  - `[medium]` `[patch]` `playCollectionAll` 的实现体在 761 个用例里从未被执行 — 新增 `src/platforms/NetEasePlatform.test.ts`：歌单/专辑各自端点、`asc` 保持顺序、`shuffle` 集合与数量不变、`runBatchAnnounce` 收到标题/数量/简介、非集合条目提示；并 spy `IIROSEUtils.buildSelect2` 断言未被调用。
  - `[medium]` `[patch]` `isCollectionItem` 只有单测，`switchToMultiPage` 自带同义判断 — 容器改用该函数，并补 `isSongList` 进入内页的用例。
  - `[medium]` `[patch]` 多 P/多集的「选集」入口没有任何覆盖（旧断言随文件删除） — 补 `VideoTile`/`MusicTile` 的「选集」出现与点击、`hasMultiPage` 的 reject/空值。
  - `[medium]` `[patch]` 星标的已收藏态与失败回滚无覆盖 — 补 `FavoriteStar` 用例（`aria-pressed`、`deskStarOn`、toggle 成功/失败回滚、`init()` 后自我纠正）。
  - `[medium]` `[patch]` 容器→结果区的新 props（`isInnerPage`/`keyword`/`scopeIndex`）无覆盖（结果区被整体桩掉） — 让桩记录实参并断言。
  - `[low]` `[reject]` 标题相等即高亮会把同名不同曲一起点亮 — 代码注释已声明并接受（宿站不暴露 URL）。
  - `[low]` `[reject]` `roomSupportsRequest` 非响应式 — 同「房间支持两份判定」一条。
  - `[low]` `[reject]` `hov:` 变体本身未在本 diff 内被断言 — 变体注册在 `src/app.css:7`（story 1 的范围），此处只断言使用侧前缀。
  - `[medium]` `[patch]` 无悬停宽屏的 `matchMedia` 桩把两个查询都答 true，`MusicTile` 的点按选中与「点空白取消选中」无覆盖 — 补精确桩与 `revealedKey` 取消用例。
  - `[medium]` `[patch]` 测试里 `isPhoneLayout()` 永不为真，手机分支与菜单手机形态从未渲染 — 用 `(max-width: 768px)` 桩补一条手机渲染用例。
  - `[medium]` `[patch]` 意图点名的「CAP-14 Tab 顺序」零断言 — 补行内（星标 → 点播）与卡片（主体 → 胶囊）的 DOM/焦点顺序断言。
  - `[medium]` `[patch]` 44px 触控区与 `[grid-auto-rows:max-content]` 只存在于类串、无断言 — 补类串断言（含四列/七列与 `max-content`）。
  - `[low]` `[reject]` 设计数值比对是「代码与自身副本相比」、`cover-ring`/`selected-ring` 逃脱成对检查 — 内部守卫的完备性，不影响产出。
  - `[medium]` `[patch]` `playCollectionAll` 实现体未被任何测试执行 — 同 `NetEasePlatform.test.ts` 一条。
  - `[medium]` `[patch]` 对 `NetEasePlatform.buildSelect` 的 spy 是空断言（组件不 import 平台） — 改在平台层 spy `IIROSEUtils.buildSelect2`。
  - `[low]` `[reject]` 逐层 `Esc` 只覆盖内页层、宿站返回键未实现 — 返回键与层级栈是 story 4 的范围（SPEC CAP-7/14 分工），本 story 的临时层已测。
  - `[low]` `[reject]` 滚动恢复的证明只在 jsdom（无布局截断） — 恢复时序问题已单独判为 medium 并修；其余属真机验收（见下行）。
  - `[false]` `[reject]` 点播时不再关闭面板 — 新规格的高潮是「底部条切到所点媒体、面板仍开着」，这一变化是设计意图而非回归。
  - `[false]` `[reject]` 音乐首屏文案与 EXPERIENCE 的「最近点播」版本不一致 — 本 story 的矩阵明确写「最近点播在 story 6 接管此位」。
  - `[low]` `[reject]` `TracklistHeader` 文件位置与内页头分页属规格漂移 — 修复方式是改 spec，按规则拒绝。
  - `[medium]` `[defer]` 缺真站（1280×720 / 400×800 × 浅深）运行证据 — 本 story 只做单元与构建验证；真站验收归 story 8 的总验收（J1–J5 × 两种尺寸 × 两种主题，以 `div.msgholderBox` 判定）。

## Design Notes

**形态选择（`ResultsArea` 内部派生，不新增 prop 爆炸）**：`mode + scopeIndex + 内页标记 + platformData 形态` 决定行/卡类型——音乐单曲＝列表曲目行 / 网格音乐卡；音乐专辑·歌单＝`collection-row`（仅列表）；音乐 MV＝视频卡；视频（哔哩哔哩）＝视频卡（直播范围加徽章）；多源剧集＝视频卡（海报裁切填满，多集条目带过渡「选集」入口）；电台＝曲目行结构（台标/台名/点播，无序号与星标）；收藏＝曲目行结构（出处列＝来源圆点 + 平台简称，仅列表）；设置/关于沿用 `settingsData` 网格（story 7 再改）。

**「全部播放」复用点**：`MLOD`/`AOD` 的 `select===0/1` 分支只做「取详情 → 洗牌（乱序）→ `runBatchAnnounce` → `finalODSONG`」。抽出 `playCollectionAll` 后，宿站弹窗入口（`@` 链接、收藏点播）行为不变，插件自有顺序菜单直接调它，因而不需要 `buildSelect2`、也不需要跨弹窗 `setTimeout(300)`。`finalODSONG` 保持 `private`，不对外暴露。

**「正在播放」数据来源**：宿站只在 DOM 暴露当前媒体标题（`#shareMediaSongName`），没有 URL。结果区用 1s 轮询只读标题比对 `PlatformData.title`（与 `ShuffleController` 同策略，标题重复会一起高亮，可接受）。不复用 `HostMediaBridge`：它会给宿站 `shareMedia`/`seekDemandMedia` 挂钩子，结果区不该成为第二个控制观察者。story 3 落地底部条时若已有共享快照，可换掉这个轮询。

**过渡入口**：B 站多 P 与多源剧集今天靠「选集」按钮进 `switchToMultiPage` 内页；新设计里视频卡只有一个「点播到房间」，选集归 story 5 的插件面板。本 story 在遮罩内并列一个次级「选集」文字钮保住入口，story 5 换成选集面板后删除——在 story 5 的 spec 里同步删掉。

**`Esc` 的临时处理**：`MainAppControlLayer` 目前 `Esc` 直接关面板（story 4 才改逐层关闭）。本 story 在 `MainAppContainer` 用捕获阶段 `keydown` 监听：顺序菜单开着时放行（菜单自己关），否则内页时返回外层并 `stopPropagation`。story 4 统一为层级栈后删掉这段。

**手机上的过渡胶囊**：DESIGN 里手机点缩略图/卡片应弹出操作条（story 4）。在那个挂点还只是空实现之前，卡片遮罩与「点播」胶囊在 `max-[768px]` 下常显（不上遮罩色），否则手机上视频与音乐网格完全无从点播——这是「现有功能必须存活」的下限；story 4 落地操作条后把 `max-[768px]:opacity-100` / `max-[768px]:pointer-events-auto` 一并收回。

**视频模式与列表视图**：story 1 保留了视频的列表/网格切换，所以视频模式在列表视图下渲染曲目行（`shapeOf` 跟着 `viewMode` 走），只有网格视图才是 16:9 视频卡；MV 范围固定网格、不显示视图切换。多 P 条目的「选集」内页入口只在网格卡遮罩里，列表视图仍可经点播弹窗（`VOD` 的既有选择器）选集——story 5 换成选集面板后统一。

## Verification

**Commands:**
- `npm test` -- expected: 全部通过（含改写后的 `mediaCards.test.ts` 与容器测试）
- `npm run build` -- expected: `tsc -b && vite build` 无错误
- `npx prettier --check src/page/components/media-card-container src/page/MainAppContainer.tsx src/platforms/NetEasePlatform.ts` -- expected: 无差异

**Manual checks (if no CLI):**
- 真站（视频分享房）1280×720 与 400×800 × 宿站浅/深色：搜索「陈绮贞」看曲目表与悬停、切网格看音乐卡、视频模式看 16:9 与直播徽章、进歌单内页看「全部播放」正序/乱序、返回后关键词/页码/滚动不变；点播成功以聊天区 `div.msgholderBox` 子节点增长判定。

## Auto Run Result

**Summary.** 结果区按 DESIGN 组件键重写完成（曲目表 / 音乐网格 / 视频卡 / 专辑·歌单行与内页 / 状态部件 / 收藏星 / 顺序菜单），
钻取沿用 `switchToMultiPage`、内页「全部播放」走插件自有的 `NetEasePlatform.playCollectionAll`（不经宿站 `buildSelect2`）。
本轮为第二遍评审：首轮 61 条发现已裁定，其中标注 `patch` 的若干项未真正落地（内页空态文案、`isCollectionItem` 归一、
`Cover` 的 lazy、`@keyframes` 孤儿、`playCollectionAll` 的顺序测试、星标与选集用例等），本轮连同新发现一并补做。

**Files changed（本轮）**
- `src/page/components/media-card-container/ResultsArea.tsx` — 内页空态文案、首屏引导限定单曲范围、`pageOffset` 序号续接、视频卡的 `nowPlaying`、骨架瓦片条数、`pageOffset` 透传。
- `src/page/components/media-card-container/TracklistRow.tsx` — 封面带 `alt`，点播按钮读屏名带曲目标题。
- `src/page/components/media-card-container/CollectionRow.tsx` — 封面 `alt`。
- `src/page/components/media-card-container/VideoTile.tsx` — 新增 `nowPlaying` 音柱徽章（网格内也标「房间正在播放」）。
- `src/page/components/media-card-container/Cover.tsx` — 异步封面未落地只画 thumb 底块、`loading="lazy"` / `decoding="async"`、覆盖按钮焦点环与带标题的读屏名。
- `src/page/components/media-card-container/FavoriteStar.tsx` — 连点守卫（`pending` ref）、重读改走 `reread()`。
- `src/page/components/media-card-container/OrderMenu.tsx` — 定位改 `useLayoutEffect`（不再先闪左上角）。
- `src/page/components/media-card-container/StateMessage.tsx` — 文字钮补 `min-h-[44px]` 与焦点环。
- `src/page/components/media-card-container/CollectionHeader.tsx` — 曲目数在手机隐藏（标题取回宽度）。
- `src/page/components/media-card-container/Skeletons.tsx` — 骨架行默认 10 条。
- `src/page/components/media-card-container/mediaFormat.ts` — `isTapToReveal` 改 `window.matchMedia?.()`。
- `src/page/components/media-container-context/MediaContainerContext.tsx` — 移除无消费者的 `switchToOutFromMultiPage`。
- `src/page/MainAppContainer.tsx` — `handleRowActivate` 回落为直接点播、`Esc` 在无外层现场时放行、`isCollectionItem` 归一、`pageOffset` 透传、`playCollectionAll` 点击时二次校验房间支持、Provider 去掉多余成员。
- `src/platforms/NetEasePlatform.ts` — 洗牌改 Fisher–Yates、`catch` 文案归一、`let` 死初值改 `const`。
- `src/app.css` — 删除孤儿 `@keyframes spin` / `fadeIn`。
- `src/page/components/media-card-container/mediaCards.test.ts` — 补收藏星（已收藏 / 未收藏 / 回滚 / 连点 / `init()` 重读 / 不可收藏）、多 P「选集」与拒绝、1s 轮询启停、封面打开来源页、序号续接、内页空态与专辑空态、44px 触控区。
- `src/platforms/NetEasePlatform.test.ts`（新）— `playCollectionAll` 的顺序语义、端点、静默失败、非集合提示、`buildSelect2` 未被调用。
- `src/page/MainAppContainer.test.ts` — 内页返回改断言同一份数据承诺；`onRetry` / `onClearSearch` / `pageOffset` 走结果区桩收到的实参。

**Review findings.** 59 条：high 0 / medium 19 / low 37 / false 3 / maybe-false 0。
- patch（本轮修）：30 条（medium 13、low 17），含 `isCollectionItem` 归一、视频卡正在播放、文字钮 44px、内页空态文案、序号续接、
  `playCollectionAll` 顺序与端点测试、星标 / 选集 / 轮询 / 容器接线用例、手机行体死点击、封面三态与 lazy、洗牌与 `@keyframes` 清理等。
- defer：7 条（多 P 内页返回 ×2、内页请求令牌竞态、真站呈现验收 ×3、AGENTS.md 同步；均记入 frontmatter `deferred`）。
- false：3 条（`text-button` 玫红与 DESIGN 一致；`openCollection` 的早退分支从现有入口不可达；视频星标 / 封面热点 / 选集入口属 `Always` 要求的既有链路存活）。
- reject：22 条，理由写在各自行内（既有表现、内部测试卫生、留待 story 4/5 的层级与选集规范、改动成本超出直接修正）。

**Follow-up review recommended: true.** 未验证的风险：本轮把「点击 / 轮询 / 抽屉 / 序号」这类时序与几何行为第一次做成真实断言，
但全部证据仍在 jsdom；`pageOffset`、`useLayoutEffect` 定位、封面 `settled` 三态与手机端文字钮 44px 的真机表现（宿站 iframe 1.13–1.19 缩放）
只有 story 8 的总验收能确认。

**Verification.** `npx tsc -b` 通过；`npx vitest run` 全绿（44 文件 / 781 用例，含新增 `src/platforms/NetEasePlatform.test.ts` 的 6 条）；
`npm run build`（`tsc -b && vite build`）成功；`npx prettier --check src/page src/platforms src/app.css` 无差异。

**Residual risks.** 真站验收未做（归 story 8）；「加载失败」在真实服务层不可达（需服务层改造）；
多 P 内页仍无「‹ 返回」按钮；正在播放以标题相等判定，同名不同曲会一起高亮（已知并接受）。
