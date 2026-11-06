---
ticket: 6
title: 收藏与电台模式、最近点播
type: feature
created: '2026-10-30'
status: done
baseline_revision: a2bf78f7d2aac59be25293ca5b4675a0f4549291
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings:
- multiple-goals
- oversized
deferred:
- summary: AGENTS.md 未登记本轮新增约定（src/history 的 imwRequestHistory、音乐首屏「最近点播」、 收藏/电台 filterLive 即时过滤、收藏 3 来源 × 4 范围、FavoritesService 还原缓存）。
  evidence: 修 AGENTS.md 的条目按 step-04 规则一律 defer；文档缺口本身不影响运行时， 但下一轮会以「文档没写」重新发现同一批约定。
  location: AGENTS.md
  severity: low
- summary: 云同步落地（onExternalChange → reloadLastQuery）会在用户离开收藏模式或改筛选前重载列表， 把刚取消收藏的行提前摘掉。
  evidence: 该重载是 spec-favorites-cloud-sync 轮次既有的接线，本 story 未改动；「行保留到离开或改筛选」 与它在运行时交叉，需在收藏-云同步交叉面上单独决策。
  location: src/page/MainAppContainer.tsx:141
  severity: low
---
<intent-contract>

## Intent

**Problem:** 收藏模式还是「单来源 + 五个类型范围」，没有来源筛选、输入必须回车才过滤；电台模式只能按地区整表重取，输入不生效；音乐模式未搜索时只有一句引导，用户刚点过的歌无法再点。SPEC 的 CAP-9 / CAP-10 都未落地。

**Approach:** 收藏升为「全部 / 网易云 / B站」三来源 + 「全部 / 单曲 / 歌单与专辑 / 视频」四范围，输入即按本地收藏过滤（只读 IndexedDB，不发网络请求），取消收藏的行留到离开模式、切范围/来源或改过滤词；电台输入即按台名过滤同一份本地列表。新增 `imwRequestHistory` 本地点播历史：写入点收在点播报文发出处（`Socket.observe`，覆盖 `@` 链接拦截），音乐首屏以曲目表列出其中的网易云单曲，标题「最近点播」。

## Boundaries & Constraints

**Always:** 历史只由 `Socket.send` 成功发出后的观察钩子写入（`&1` 报文），卡片报文不写；同一媒体移到最前、上限 50 条、跨房间共用、不进云同步、不提供删除界面；写入失败必须静默且绝不影响点播报文。收藏过滤只读本地存储（IndexedDB `FavoritesStorageService.query`），电台过滤只筛已加载的本地列表；两者都不发起网络请求。点播入口与播报档位不变（`Announce.runSingleAnnounce` / `runBatchAnnounce`）；网易云请求仍只经 `SendFetch.neteaseRequest`。令牌只取 `tokens.ts`，断点一律 `max-[768px]`，手机点击区 ≥44px。

**Never:** 不新增 localStorage 键除 `imwRequestHistory`；不改收藏存储结构、墓碑规则与云同步；不为「最近点播」加分房间维度、删除/清空入口或云同步；不改电台数据源（仍只有「日本」地区两条流）与电台时长设置；不改单曲循环 / 收藏随机 / 播报档位规则；不在结果区新增配色（不裸写颜色 / `rgba` / `themed*`）；不改 `MediaPayloadMemory` 的缓存语义与 `LoopController` 重播路径。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 点播报文写入 | `Socket.send("&1{s,d,c,n,r,b,o,l}")`（网易云单曲 `b="@0"`） | `localStorage.imwRequestHistory` 顶部新增一条：标题/歌手/封面（https）/时长/链接/平台/媒体 id | 存储不可用或写入抛错时静默，发送照常 |
| 卡片报文 | `{"m":"m__4@0>…"}` | 不写入历史 | — |
| 同一媒体再点播 | 已存在同 `key` 的记录 | 移到最前，条数不变 | — |
| 超过上限 | 第 51 条新记录 | 丢弃最旧的一条，保留 50 条 | — |
| 存档损坏 | 非法 JSON / 版本不符 / 非数组 | 视为空历史，不抛错 | 按空处理 |
| `@` 直链点播 | `b="=0"`（直链嗅探）/ 电台流 | 仍写入（来源记为「其他」）；音乐首屏不显示 | — |
| 音乐首屏有历史 | 音乐 · 单曲范围 · 关键词为空 | 曲目表列出网易云单曲，上方标题「最近点播」；行内点播走 `NetEasePlatform.MOD` | — |
| 音乐首屏无历史 | 同上，历史为空 | 显示「还没有点播记录。搜索歌名或歌手，点播到房间。」 | — |
| 首屏再点同一首 | 从「最近点播」点播已有条目 | 房间收到点播；历史仍是一条并移到最前 | — |
| 收藏即时过滤 | 收藏模式输入「周杰伦」 | 列表即时只剩标题/歌手/作者匹配项（不区分大小写），页码归 1，无网络请求 | 无匹配显示「没有匹配的收藏」+「清除搜索」 |
| 收藏取消收藏 | 收藏列表行内点实心星 | 星变空心、行保留；改过滤词 / 切范围 / 切来源 / 离开收藏模式后该行消失 | 切换失败按既有回滚 |
| 收藏来源 | 来源切换器选「B站」 | 列表只含 B 站来源，页码归 1，出处列显示「B站」圆点+简称 | — |
| 收藏范围「歌单与专辑」 | 选中该范围 | 同时列出专辑与歌单两类收藏 | — |
| 电台即时过滤 | 电台模式输入「vocaloid」 | 只留台名匹配的电台（不区分大小写），不分页 | 无匹配显示「没有匹配的电台」+「清除搜索」 |
| 电台清空过滤词 | 输入框删空 | 恢复全部电台，不发起网络请求 | — |

</intent-contract>

## Code Map

- `src/iirose_func/Socket/index.ts:5-18` -- `Socket.observe` 是 `send` 之后的只读旁路钩子（单槽位，发送异常不影响它，它抛错被吞）；历史写入接在这里的观察链上。
- `src/page/index.tsx:152-155` -- `observeSocket` 当前只调 `memory.record`；在此串上 `RequestHistory.recordPayload`（保持单槽位，`dispose` 只摘自己的钩子，见 `:113`）。`initMediaProgress` 由 `IMCInit.init`（`:300-310`）在页面加载时执行，早于任何点播。
- `src/page/index.test.ts:70-88` -- 断言 `Socket.observe` 是函数、`pagehide` 后为 `undefined`，并用 `new Socket().send(payload)` 驱动；新增历史断言加在这里。
- `src/iirose_func/Socket/Media/index.ts:181-233` -- `mediaEvent` 产出的 `&1{...}`：`s` 播放地址、`d` 秒、`c` 封面（去掉 `http` 前缀）、`n` 标题、`r` 歌手、`b` 平台码（`@0` 网易云、`!7` 网易云 MV、`!3` B 站、`!8` B 站直播、`=0` 无来源音乐、`!1` 无来源视频）、`o` 原链。历史解析按此字段与 `b` 码分类。
- `src/playback/MediaPayloadMemory.ts:17-38,102-133` -- 现成的「解析 `&1` / 卡片」范式与「观察者写入、存储失败静默」范式；**不复用**其 sessionStorage 键与房间语义。
- `src/media-progress/PositionStorage.ts:20-45` -- localStorage 安全读写的范式（try/catch + 形状守卫），新历史模块照此写。
- `src/platforms/NetEasePlatform.ts:322-348` -- 网易云单曲 `PlatformData` 的形状（`duration` 秒、`websiteUrl` 含 `id=`、`neteaseMusic.id`），历史还原条目按此对齐。
- `src/platforms/NetEasePlatform.ts:876-887` -- `MOD(platformData)` 只需 `neteaseMusic.id`，是首屏再点播的入口（自带 `runSingleAnnounce`）。
- `src/page/MainAppContainerServices/NetEaseService.ts:34-58` -- 音乐「单曲」范围在 `searchKeyword === ""` 时早退成 `mediaData: null`（首屏空态来源）；首屏改由新服务供数。
- `src/page/MainAppContainerServices/FavoritesService.ts:6-13,39-110` -- 收藏加载器：`lastQuery` 需记新范围语义（`collection` = 专辑+歌单）；`query` 已按关键词做本地过滤（`FavoritesStorageService.query` 内 title/author 小写子串）。
- `src/storage/FavoritesStorageService.ts:397-428` -- `query({platform,type,keyword})` 的唯一实现；新增可选 `types?: FavoriteType[]`（与 `type` 互斥使用）以支持「歌单与专辑」合并范围，`deletedAt` 墓碑本就被排除。
- `src/page/MainAppContainerServices/RadioService.ts:7-79` -- 电台分页缓存；关键词过滤加在缓存切片分支，网络分支返回前也要按关键词过一遍。
- `src/platforms/RadioPlatform.ts:20-61` -- 电台条目（`title`/`author`/`coverImg`/`radio.id`），只有 `japan` 一支，`itemPerPage` 切片。
- `src/page/MainAppContainer.tsx:57-111` -- `ModeSnapshot` 与 `snapshots`；`:518-549` `applyMode`（现有「设置每次重跑」「收藏需要重跑」的挂点）。
- `src/page/MainAppContainer.tsx:834-886` -- 音乐模式分类；单曲范围的 `searchAction` 是首屏判断点（关键词空 → 最近点播）。
- `src/page/MainAppContainer.tsx:972-1064` -- 电台与收藏分类现状（电台单来源单地区、收藏单来源五范围）；收藏改为 3 来源 × 4 范围，电台保持单来源。
- `src/page/MainAppContainer.tsx:606-644` -- `runSearch`（会清 `mediaData`、按 `reloadEmpty` 决定是否重跑）；即时过滤不能走它（会每键闪骨架），需要新的 `filterLive`。
- `src/page/MainAppContainer.tsx:461-469` -- `viewToggleMode()`：音乐单曲范围返回视图切换；首屏（关键词空）应返回 `null`，首屏固定曲目表。
- `src/page/components/desk/SearchBar.tsx:41-50,181-198` -- 搜索栏只在 Enter / 按钮提交；新增可选 `onLiveInput?: (keyword: string) => void`，在 `onInput` 里额外通知容器。
- `src/page/components/media-card-container/ResultsArea.tsx:67-86` -- `shapeOf` 形态派生（首屏需要强制 `tracklist`）。
- `src/page/components/media-card-container/ResultsArea.tsx:217-230,296-361` -- 空态文案与排序渲染；「最近点播」标题与首屏无历史文案落在这里。
- `src/page/components/media-card-container/TracklistRow.tsx:63-81,119-216` -- 曲目行 / 出处列（来源圆点+简称）已满足收藏出处列要求，无需改动。
- `src/page/components/floating-panel/tokens.ts:127-133,137-182,199-215` -- `deskSourceDots`（netease / bilibili / radio）与 `typeLabelStrong`、`deskGutter`、`typeMonoCaption`：首屏标题复用这些令牌。
- `src/page/MainAppContainer.test.ts:321-325,371-377,598-621` -- 断言「收藏单来源 `all`」、电台不分页、清除搜索重取的既有用例，随来源/范围改造更新。

## Tasks & Acceptance

**Execution:**
- `src/history/RequestHistory.ts`（新）-- 解析 `&1` 报文为 `{key, source, kind, mediaId, title, artist, cover, link, duration, at}`；`recordPayload(text)` 去重前置 + 上限 50 + 安全写入；`load()`；`recentMusic()` 只返回网易云单曲；`toPlatformData(entry)` 还原 `PlatformData`（`neteaseMusic.id`、秒级 `duration`、`coverImg` 升 https）-- 历史是首屏的数据源，必须与报文格式一一对应。
- `src/page/index.tsx` -- 观察链改为 `memory?.record(data); RequestHistory.recordPayload(data);` -- 写入点收在点播报文发出处，覆盖面板、操作条、收藏、电台、选集与 `@` 拦截。
- `src/page/MainAppContainerServices/FavoritesService.ts` -- 范围类型扩为 `"all" | "song" | "collection" | "video"`（`collection` → `types: ["album","playlist"]`），`lastQuery` 同步 -- 支持合并范围且云同步落地后刷新仍正确。
- `src/storage/FavoritesStorageService.ts` -- `query` 增加可选 `types?: FavoriteRecord["type"][]`，与 `type` 并用时取交集 -- 一个查询覆盖「歌单与专辑」。
- `src/page/MainAppContainerServices/RadioService.ts` -- 缓存切片与网络返回都按当前关键词过滤台名（不区分大小写），`totalPage` 保持 1 -- 电台即时过滤、不发请求。
- `src/page/MainAppContainerServices/RecentService.ts`（新）-- 读 `RequestHistory.recentMusic()`，按 `PlatformData` 分页写入 `mediaData` / `allMediaData` / `totalPage`，`currentOnDemandPlay = NetEasePlatform.MOD` -- 音乐首屏供数，且再点播复用既有单曲点播链路。
- `src/page/MainAppContainer.tsx` -- 收藏分类改 3 来源 × 4 范围（来源由 `PlatformIndex` 派生 `all/netease/bilibili`）；音乐单曲范围关键词为空时走 `RecentService.load`；新增 `controller.filterLive(text)`（只改关键词与页码，不清 `mediaData`，再跑当前范围）；`applyMode` 在进入收藏模式与进入关键词为空的音乐模式时重跑当前范围；`viewToggleMode()` 在音乐首屏返回 `null`；`SearchBar` 传 `onLiveInput`（仅收藏 / 电台）-- 把即时过滤与首屏接进既有模式快照。
- `src/page/components/desk/SearchBar.tsx` -- 新增可选 `onLiveInput`，在输入事件里通知（不改 Enter / 按钮提交路径）-- 即输即滤的唯一入口。
- `src/page/components/media-card-container/ResultsArea.tsx` -- 音乐首屏（音乐 · 单曲范围 · 关键词空 · 非内页）强制曲目表形态；非空结果上方加标题「最近点播」；首屏空态改为「还没有点播记录。搜索歌名或歌手，点播到房间。」-- 让首屏可读且与 CAP-10 文案一致。
- `src/history/RequestHistory.test.ts`（新）-- 覆盖 I/O 矩阵的解析 / 去重 / 上限 / 损坏 / 写入失败 / 直链与电台分类 / 还原 `PlatformData`。
- `src/page/index.test.ts` -- 发送 `&1` 后 `imwRequestHistory` 出现条目；卡片报文不写；卸载后不再写。
- `src/page/MainAppContainer.test.ts` -- 收藏三来源与四范围接线、`filterLive` 的即时过滤（关键词 + 页码 1、不发网络）、电台过滤、进入收藏模式重跑、音乐首屏走 `RecentService`。
- `src/page/components/media-card-container/mediaCards.test.ts` -- 首屏标题与行、首屏空态新文案、首屏忽略网格视图、收藏来源列；更新既有「音乐首屏」用例。
- `src/page/components/desk/searchBar.test.ts` -- 输入时触发 `onLiveInput`，不传时行为不变。

**Acceptance Criteria:**
- Given 面板打开且宿站主题浅色，when 在曲目行点播一首网易云歌曲，then 房间里出现点播卡片（聊天区 `div.msgholderBox` 新增消息），且 `localStorage.imwRequestHistory` 顶部是该曲目（标题、歌手、封面、时长齐全）。
- Given 已有一条历史，when 再次点播同一媒体，then 历史条数不变且该条在最前。
- Given 已有 50 条历史，when 点播一首未记录的歌，then 仍为 50 条，最旧一条消失。
- Given 从聊天输入框粘贴网易云 / B 站链接触发 `@` 拦截点播，then 历史同样新增该条（不需要面板打开）。
- Given 音乐模式首次进入且关键词为空，when 历史里有一条网易云单曲，then 结果区显示标题「最近点播」+ 该曲目行，桌面不出现视图切换；点击该行点播后房间收到点播且历史仍是同一条。
- Given 历史为空，when 进入音乐模式首屏，then 显示「还没有点播记录。搜索歌名或歌手，点播到房间。」
- Given 收藏模式有网易云与 B 站收藏，when 在来源切换器选「B站」，then 列表只剩 B 站条目、页码回到 1、出处列显示 B站圆点与简称。
- Given 收藏模式，when 选择范围「歌单与专辑」，then 列表同时包含专辑与歌单两类收藏。
- Given 收藏模式列表已渲染，when 在行内取消收藏，then 该行星标变空心但仍在列表；when 修改过滤词或切换范围 / 来源或离开收藏模式再回来，then 该行消失。
- Given 收藏模式，when 逐字输入过滤词（不按 Enter），then 列表随输入收窄且页码为 1，期间不产生任何网络请求。
- Given 电台模式，when 输入「vocaloid」（不按 Enter），then 只剩台名匹配的电台、不显示分页；清空输入后恢复全部且不联网。
- Given 上述全部改动，when 运行 `npm test` 与 `npm run build`，then 两者通过，且既有 `shuffle-picker` / `media-progress` / `playback` / `settings` / `Socket` 行为测试无需放宽断言。

## Spec Change Log

## Review Triage Log

### 2026-10-30 — Review pass
- verdicts: 38 findings — high 0, medium 9, low 21, false 8, maybe-false 0
- findings:
  - `[low]` `[reject]` 观察钩子里每次 `&1` 都「读 50 条 + 写 50 条」localStorage，批量点播会同步重写整份历史 — 单次写只有数 KB（微秒级），批量链路本身逐曲等网络；加内存缓冲/节流的复杂度与收益不成比，且无实测卡顿。
  - `[low]` `[patch]` `at` 只写不读，文件头注释「只读 localStorage」与实际写 localStorage 矛盾 — 保留 `at`（记录写入时间、成本为零），把注释改成准确表述。
  - `[false]` `[reject]` `restoreUrl` 无 scheme 白名单，`javascript:` 链接会进 `websiteUrl` 再被 `window.open` — `UrlExtractor.extract` 只匹配 `https?://` 或知名域名（`src/tools/UrlExtractor.ts:53-79`），直链嗅探与平台点播的 `link` 都出自它或平台常量，`javascript:` 无路径进入报文。
  - `[false]` `[reject]` `RecentService.load` 缺 `isCurrentInMultiPage` 守卫与 `requestToken` 递增，旧检索会覆盖首屏 — `applyMode` 每次切模式都 `requestToken + 1`，在飞的旧检索 `pushAllData` 被令牌挡住；音乐内页只能由非空关键词的专辑/歌单搜索打开，而首屏重跑要求关键词为空，两者不可同时成立。
  - `[low]` `[reject]` 搜索过一次后没有回首屏入口 — 首屏语义就是「未搜索」；把空提交改成重取会改写 CAP-3 的既有提交语义，属新增能力。
  - `[low]` `[reject]` 首屏不随新写入的历史刷新 — 首屏条目主要由本机点播产生，从首屏点播的条目已在列表里；其余入口的写入走切模式/重跑，加变更订阅属新机制。
  - `[low]` `[patch]` `ResultsArea.emptyState` 里音乐首屏分支被 `firstScreen` 早退完全覆盖，永远不可达 — 删除该死分支。
  - `[medium]` `[patch]` 收藏/电台逐字过滤在中文输入法组字期间也触发，每敲一个拼音字母就把列表收窄到空 — 组字期间不通知 `onLiveInput`，`compositionend` 后再通知最终值。
  - `[medium]` `[patch]` `filterLive` 把 `trim()` 后的关键词写回受控输入，SearchBar 的 `componentDidUpdate` 回灌会吞掉空格并把光标移到末尾 — `filterLive` 保留原始输入，trim 交给服务层。
  - `[false]` `[reject]` `filterLive` 在收藏内页里静默失效 — 收藏与电台都没有内页：`openCollection` 只在 `collections` 形态触发，收藏恒为曲目行，`loadFavorites` 的 `isCurrentInMultiPage` 早退无可达路径。
  - `[low]` `[reject]` 逐字过滤无去抖，每次按键全表扫 IndexedDB — 数百条量级的本地读 + 内存过滤是毫秒级；去抖会引入定时器状态。
  - `[low]` `[reject]` 还原缓存超过 500 条整体清空后，逐字过滤会为 B 站条目重新出网 — 触发需 500 条以上不同记录且探测失败已被 catch；改 LRU 分桶属新机制。
  - `[medium]` `[patch]` 电台模式按 Enter 提交或「清除搜索」时 `runSearch` 清空 `allMediaData`，`RadioService` 落回网络分支重新出网 — 电台模式的 `runSearch` 保留 `allMediaData`，本地过滤不再出网。
  - `[low]` `[reject]` 三来源 × 四范围存在必然为空的组合，空态却统一说「还没有收藏」 — EXPERIENCE「各模式的来源、范围与内容」与 CAP-9 直接规定这套两维网格；按来源裁剪范围会违背捕获的意图。
  - `[low]` `[reject]` `RequestHistory` 与 `MediaPayloadMemory` 各写一套 `&1` 判定 — 两者目标不同（按房间/标题配对卡片 vs 字段级还原），合并会牵动 playback 模块。
  - `[medium]` `[patch]` 历史测试有恒真断言（「写入失败不留下半条记录」在空存储上永真），且缺 `!8`/`!1`、`https://` 原样链接、缺 `duration` 分支 — 改成「先写一条再让第二条失败」，补齐分支与键名字面量断言。
  - `[low]` `[defer]` AGENTS.md 未登记本轮新增约定（`src/history`、最近点播、即时过滤、收藏 3×4、还原缓存） — 修 agent-context 文件的条目按规则 defer。
  - `[medium]` `[patch]` 电台在首批请求在途时改关键词，`.then` 用的是发起时捕获的旧关键词，落地未过滤列表（`updating` 又挡住第二次调用） — 过滤改为按落地时的当前关键词求值。
  - `[false]` `[reject]` `RecentService` 未递增 `requestToken`，旧检索会覆盖首屏（同类第二条） — 同 `applyMode` 令牌递增的驳回证据。
  - `[false]` `[reject]` `filterLive` 在收藏内页静默失效（同类第二条） — 收藏无内页路径。
  - `[low]` `[patch]` `emptyState` 音乐首屏分支不可达（同类第二条） — 与首条同一次删除。
  - `[medium]` `[patch]` 电台「清除搜索」清空缓存后重新出网（同类第二条） — 与 `runSearch` 保留缓存同一次修复。
  - `[low]` `[reject]` 收藏过滤在还原缓存未命中时仍会为 B 站条目出网，「只读本地存储」不绝对 — 条目还原（B 站分 P 探测）是 `restorePlatformData` 的既有加载路径，新缓存已把逐字过滤的重复探测降到每条一次；要求零网络需改动共享还原语义并影响手机操作条「选集」判定（`hasMultiPage`）。
  - `[false]` `[reject]` `query({types: []})` 返回 0 条 — 唯一调用点固定传 `["album","playlist"]`，没有路径能传入空数组。
  - `[low]` `[reject]` 历史只有非网易云条目时首屏仍说「还没有点播记录」 — 该文案由 CAP-10 规定，且首屏本就只列网易云单曲；改文案违背捕获的意图。
  - `[medium]` `[patch]` 收藏/电台的 SearchBar→`filterLive` 接线没有任何测试，删掉接线仍全绿 — 加容器级「真实打字」用例（派发 `input` 事件），并断言音乐模式打字不触发检索。
  - `[medium]` `[patch]` 电台在途改词落地未过滤列表（验证层同类） — 与网络分支过滤求值同一次修复。
  - `[medium]` `[patch]` SearchBar 受控回写吞空格（验证层同类） — 与 `filterLive` 不 trim 同一次修复。
  - `[low]` `[patch]` 音乐首屏分支死代码（验证层同类） — 同一次删除。
  - `[false]` `[reject]` `@` 直链嗅探条目只进历史、不进「最近点播」 — 意图只要求历史写入覆盖 `@` 拦截（已由观察钩子覆盖）；CAP-10 限定首屏只列音乐来源，`@` 的网易云/B 站链接走平台链路、平台码 `@0`/`!3`，其网易云单曲照常进首屏。
  - `[low]` `[patch]` 存储键字面量无断言钉住，改名仍全绿 — 在历史测试里断言 `imwRequestHistory`。
  - `[low]` `[reject]` 「不进云同步」没有验证 — 同步层零引用即结构性保证，加用例需把历史耦合进 sync 测试。
  - `[low]` `[reject]` 取消收藏行消失缺端到端证据 — 三段互补用例覆盖：存储墓碑不进 `query`、容器离开/切范围/改词重跑、组件层行保留。
  - `[low]` `[reject]` 首屏再点播闭环缺端到端 — `RecentService` 断言点播入口是 `NetEasePlatform.MOD`，`MOD → finalODSONG → 报文` 已有平台用例；端到端会重复出网链路。
  - `[false]` `[reject]` 合并范围删除了专辑/歌单单列能力 — EXPERIENCE 规定「歌单与专辑」为单一范围，`album`/`playlist` 只是实现细节。
  - `[low]` `[defer]` 云同步落地（`onExternalChange`）会在离开/改筛选前重载列表并摘掉已取消收藏的行 — 既有接线（spec-favorites-cloud-sync），本 story 未改动。
  - `[low]` `[reject]` 翻页也会重载并摘掉已取消收藏的行 — 翻页本身就是一次重新加载视图；跨页保留需按会话记取消项，复杂度远超「防误触跳动」的意图。
  - `[low]` `[patch]` 首屏判定在容器与 ResultsArea 各写一份，旧的组件内分支已不可达 — 删除分支；两层的职责（供数 / 形态）保留。

### 2026-10-30 — Review pass (follow-up)
- verdicts: 35 findings — high 0, medium 3, low 20, false 12, maybe-false 0
- findings:
  - `[low]` `[reject]` 批量点播（整单「全部播放」/ 多选）逐曲 `socket.send`，每首各写一条历史，专辑末曲排到首屏最前，50 条上限会挤掉用户真正手点的单曲 — 每首都是独立媒体，矩阵规定「点播报文写入」与「同一媒体移到最前」，末曲在最前正是「最新在前」；抑制批量写入要新增报文抑制位（新机制），且无实测的用户困扰。
  - `[low]` `[reject]` carried 非网易云条目同样吃 50 条上限，可能「有历史却显示还没有点播记录」 — carried 既有行（文案由 CAP-10 规定、首屏只列网易云单曲）；「上限被非音乐条目占用」需按来源分桶计数，属新机制，不改变裁定。
  - `[false]` `[reject]` `load()` 不复核上限、不按 `at` 排序，外部写入 60 条会全量渲染 — 唯一写入方 `recordPayload` 写入即 `slice(0, 50)`，数组本就最新在前；手改存档不是程序可到达的状态。
  - `[low]` `[reject]` 历史是设备级、收藏是账号级，换账号会看到上一位的点播历史 — 意图明写「不进云同步」「跨房间共用」，即设备本地；按 uid 分区要新增归属字段与过滤分支，且需同一浏览器内换账号才可能遇到。
  - `[false]` `[reject]` 电台算出 `maxPage` 却上报 `totalPage: 1`，超过一页的电台永不可达 — 意图固定电台数据源为「日本」两条流，`allPlatformData` 恒为一页；`totalPage: 1` 正是「不分页」约定。
  - `[low]` `[reject]` carried `filterLive` 无去抖、无在途短路，输入「周杰伦」并发三次全库读 — carried 既有行：数百条量级本地读为毫秒级，去抖要引入定时器状态。
  - `[low]` `[patch]` 用例只断言「会重跑」不断言「何时不重跑」，删掉 `applyMode` 的关键词守卫仍全绿 — 已加「关键词非空的音乐模式切回来不重跑」用例；把守卫简化为 `next === MODE.music` 后该用例失败。
  - `[false]` `[reject]` 首屏判定两处不等价、`applyMode` 守卫缺 `SubNavBarIndex`，进音乐模式会把已恢复结果重置成 `mediaData: null` — 该分支只在关键词为空时触发，此时 `NetEaseService.handleSearch` 有缓存则重切同一份 `allMediaData`、无缓存则早退置空（本来就是空），不重取也不丢结果。
  - `[low]` `[reject]` 还原缓存只整体清空、旧键不淘汰、共享可变 `PlatformData` — 键含 `updatedAt`，删除的记录不会再被查到，残留只是会话内数十条 Map 条目；改 LRU 属新机制。
  - `[false]` `[reject]` carried `query({ types: [] })` 语义未定义会变成零结果 — carried 既有行：唯一调用点固定传 `["album","playlist"]`，无路径传入空数组。
  - `[false]` `[reject]` `toPlatformData` 伪造 `neteaseMusic.fee: 0` 无说明，后续按 `fee` 判权益会踩 — `MOD` 只读 `neteaseMusic.id`，还原条目上没有任何路径读 `fee`。
  - `[false]` `[reject]` 组字监听只在挂载绑定一次，输入节点重建后组字期间逐字母过滤 — `SearchBar` 的输入框是单一稳定节点，挂载期间没有路径重建它；即便监听泄漏也随节点销毁失效。
  - `[low]` `[patch]` 多个用例名不副实：「按标题歌手去重」只写一条、`getItem` 抛错路径、电台 `isCurrentInMultiPage` 分支、收藏令牌竞态缺用例 — 已把去重用例改成两次写入（换流地址）并断言语义；其余分支无失败模式可演示，列入残余风险。
  - `[low]` `[reject]` `mediaId` 解析不出时键退化为 `source:title|artist`，两条无 id 的媒体互相覆盖 — 需同平台、同标题、同歌手且链接里都无 id 才相撞（`!3` 分集/番剧标题各不相同），且键格式是 Design Notes 钉住的约定。
  - `[false]` `[reject]` `isEntry` 只校验 `mediaId` 是字符串，`Number()` 还原出 NaN id — 网易云 `mediaId` 只来自 `/id=(\d+)/`，恒为数字；非数字值只能靠手改存档产生。
  - `[false]` `[reject]` 电台把空列表当作「未加载」，每键重发请求且落地后重复追加 — 数据源固定两条流，`allPlatformData` 不会为空；空列表只出现在尚未加载的冷启动，那里正是要出网的分支。
  - `[low]` `[reject]` 还原缓存把探测失败的 B 站条目固化整场会话，选集入口一次性消失 — 需一次分 P 探测瞬时失败才遇到，后果仅是手机操作条「选集」缺席（视频仍可播）；让失败可自愈要给 `restorePlatformData` 增加失败信号，且该缓存是本 story 为「逐字过滤只读本地」选定的机制。
  - `[false]` `[reject]` 音乐重跑条件未限定单曲范围 — 同第 8 条：关键词为空时要么重切同一份缓存、要么早退置空，都不重取。
  - `[low]` `[reject]` carried 「收藏逐字过滤不发网络请求」不绝对，还原缓存未命中时仍为 B 站条目探测分 P — carried 既有行。
  - `[medium]` `[patch]` 生产端 `Media.mediaEvent` 与消费端 `RequestHistory.parsePayload` 无用例绑定，改平台码会让 CAP-10 首屏静默失效而全套用例仍绿 — 已加用例用真实 `new Media().mediaEvent(...)` 产出网易云 / B 站 / 无来源三种报文再断言分类、https 升级与 `recentMusic` 过滤；把 `mediaEvent` 的 `netease: "@0"` 改成 `"@9"` 后该用例失败。
  - `[medium]` `[patch]` 收藏三来源的平台过滤只验到「把 platform 传给 mock」，`FavoritesStorageService.query` 的平台分支无覆盖（调用它的用例没传 platform，三条记录全是网易云） — 已加一条 B 站记录并断言 `platform: "bilibili"` / `"netease"` 的排除结果；把该过滤改成空实现后用例失败。
  - `[medium]` `[patch]` `filterLive`「不清已渲染结果 / 不清本地列表」无断言，改回清空也全绿 — 收藏与电台两条用例已种入 `mediaData` / `allMediaData` 并断言同一性；给 `filterLive` 加 `mediaData: null` 后两条用例失败。
  - `[low]` `[reject]` 「输入→列表即时变化」落在渲染层，用例只断言服务调用次数；无匹配文案与「清除搜索」只由组件夹具覆盖 — 两半各自已被覆盖（容器真实打字用例 + 组件空态用例），DOM 级端到端要为一屏结果重搭容器用例的渲染栈。
  - `[low]` `[reject]` 「不发网络请求」用特定搜索函数的调用次数作代理断言 — 那正是可观察的出口；断言整个 `SendFetch` 层要把出网层耦合进容器用例。
  - `[low]` `[reject]` carried 取消收藏行保留用例把 `onChange` / `onExternalChange` 桩掉，第二半（改词 / 切范围 / 离开后消失）无用例 — carried 既有行。
  - `[low]` `[reject]` carried 首屏再点同一首的闭环未端到端 — carried 既有行。
  - `[low]` `[reject]` 写入点挂在 `initMediaProgress` 的观察链上，初始化前与 `pagehide` 后的发送不写 — 初始化在页面加载时早于点播，`pagehide` 后页面已在卸载；Code Map 本就规定写入点在观察链上。
  - `[low]` `[reject]` 电台「冷启动带关键词 → 清空」未测 — 冷启动返回的 `allPlatformData` 是未过滤全集，清空后走逻辑 A 重切同一份列表，行为正确；补测只是重复已覆盖分支。
  - `[false]` `[reject]` 容器与结果区各自定义首屏，进入非单曲的音乐范围会重取 — 同第 8 条，关键词为空时早退，不产生请求。
  - `[low]` `[reject]` 宿主清空关键词 / 空提交这两条路径不回到首屏 — 与既有行「空提交改成重取会改写 CAP-3」同一理由：那条路径的语义是「未搜索」，重取属新增能力。
  - `[low]` `[reject]` 来源 / 范围只按下标断言，不验标签、不验三来源同四范围、不验手机 44px — 断言 class 字符串把视觉常量钉进用例更脆；新界面复用 desk 既有组件与 `max-[768px]` 约定。
  - `[false]` `[reject]` 首屏标题用裸间距类 `mb-1 mt-4`，违背「令牌只取 tokens.ts」 — 标题在 `deskGutter` 容器内、字号与颜色取 `typeLabelStrong` / `deskInk`；间距工具类是 desk 组件的既有写法，令牌约定针对颜色。
  - `[low]` `[patch]` 收藏关键词「不区分大小写」只有中文关键词用例 — 已并入平台过滤那条用例：加拉丁标题记录并断言 `keyword: "vocaloid"`。
  - `[low]` `[reject]` `neteaseMV` 粒度超出意图词汇、`跨房间共用` / `不进云同步` 无断言、`LoopController` 重播会重排历史 — 重播本身就是一次点播报文，入档与「报文即记录」一致；云同步零引用是结构性保证（既有行已裁定）。
  - `[false]` `[reject]` 首屏成为默认渲染后三条既有用例被迫加 `keyword: "晴天"` 才不受影响 — 那正是本 story 要的默认态（单曲范围 + 空关键词 = 首屏），用例改动是随语义更新，不是掩盖回归。

## Design Notes

- **为什么写历史用 `Socket.observe` 而不是各平台**：所有点播（含 `@` 直链自发送路径）最终都过 `Socket.send`；平台层测试整模块 mock 掉 `Announce`，写在那里会被绕过。观察钩子是单槽位，因此串接而不新增第二个 `observe`：`const observeSocket = (data) => { memory?.record(data); RequestHistory.recordPayload(data); }`。
- **报文即记录**：`&1` 已含标题、歌手、封面、时长、原链与平台码；网易云 `o` 里的 `id=` 可还原 `neteaseMusic.id`，因此首屏再点播走 `MOD`（重新解析音源与歌词、沿用播报档位），而不是重发旧报文（B 站流地址会失效、也绕开档位）。
- **平台码分类**：`@0` 网易云单曲、`!7` 网易云 MV、`!3`/`!8` B 站、`=0`/`!1` 无来源（电台流、`@` 直链嗅探）。「音乐来源」= `@0`；合并范围「歌单与专辑」用 `types` 而不是前端二次过滤，保证墓碑与云同步落地后的刷新一致。
- **记录键与收录规则**：`key = source + ":" + mediaId`；无 `mediaId`（电台流、`@` 直链）时退化为 `source + ":" + title + "|" + artist`。`n` 为空或 JSON 解析失败的报文一律不写。封面与链接来自报文里被截掉 `http` 的 `c` / `o`（补回 `https://`）。网易云条目若从 `o` 里解析不出 `id=`，仍存档但不进「最近点播」（无法再点播）。

```ts
// 首屏形态与标题（ResultsArea）
const firstScreen = mode === MODE.music && scopeIndex === 0 && !trimmedKeyword && !isInnerPage;
const shape = shapeOf({ mode, scopeIndex, viewMode: firstScreen ? "list" : viewMode, isInnerPage });
// 渲染顺序：<h2>最近点播</h2>（typeLabelStrong + deskInk，deskGutter 内边距）→ TracklistHeader → TracklistRow
```

## Verification

**Commands:**
- `npx prettier --check src/history/RequestHistory.ts src/page/MainAppContainerServices/RecentService.ts` -- expected: 无差异输出
- `npm test` -- expected: 全绿（含新增 history / 首屏 / 收藏来源 / 即时过滤用例）
- `npm run build` -- expected: `tsc -b && vite build` 成功，产出 `dist/bundle.js`

**Manual checks (if no CLI):**
- 真站（iirose.com 视频分享房）1280×720 与 400×800 各看一次：音乐首屏「最近点播」列表与空态文案；收藏来源切换后的出处列；收藏取消收藏后行是否留到切范围；电台即输即滤；`@` 链接点播后刷新页面历史仍在。

## Auto Run Result

**状态：** `done`（第二轮 follow-up review pass，未触发 loopback）

**本轮改动（只补验证，不改生产逻辑）：** 复核上一轮 `done` 的实现后，按 triage 结论把 6 条 `patch` 条目落成测试补丁——历史报文的「生产端↔消费端」绑定、收藏来源筛选真的筛库、`filterLive` 不清已渲染结果、`applyMode` 的负例、标题歌手降级键的去重语义、收藏关键词大小写。生产代码零改动。

**改动文件：**
- `src/history/RequestHistory.test.ts` — 新增「真实 `Media.mediaEvent` 产出报文 → 解析」用例（网易云 / B 站 / 无来源三种平台码、https 升级、`recentMusic` 过滤）；把「按标题歌手去重」用例改成两次写入（换流地址）后断言仍为一条且链接取最新。
- `src/storage/FavoritesStorageService.test.ts` — 收藏查询用例加一条 B 站记录，断言 `query({ platform: "bilibili" })` / `{ platform: "netease" }` 确实排除另一来源，并补拉丁标题的大小写无关断言。
- `src/page/MainAppContainer.test.ts` — 收藏与电台的 `filterLive` 用例种入 `mediaData` / `allMediaData` 并断言同一性；新增「关键词非空的音乐模式切回来不重跑」负例。

**评审结论（本轮）：** 35 条发现 —— high 0、medium 3、low 20、false 12、maybe-false 0。
- `patch` 6 条（medium 3、low 3）：均已落成用例，并用反向改动逐一验证其有效（改 `mediaEvent` 平台码、把平台过滤改成空实现、给 `filterLive` 加 `mediaData: null`、去掉 `applyMode` 关键词守卫，四处都会让新用例变红）。
- `reject` 29 条：false 12 条（平台码早退、`fee` 无人读取、输入节点稳定、空列表不可达等，均给出证伪依据）；low 17 条（批量写历史、账号级隔离、LRU 淘汰、去抖、把 class 字符串钉进用例等，判定为日常不可遇到或修复复杂度不成比例）。
- 其中 6 条与既有日志同位置同主张，按既有裁定结转（前缀 `carried`），未再次 patch/defer。
- `defer` 0 条：本轮不动既有 `deferred` 账本条目。

**后续复审建议：** `false`（follow-up pass，本轮未 patch 任何 high；已 patch 3 条 medium、3 条 low，属收敛）。

**验证：**
- `npx prettier --check` 三个改动文件 —— 无差异。
- `npm test` —— 57 文件 / 995 用例全绿（较上一轮 993 增 2）。
- `npm run build` —— `tsc -b && vite build` 成功，`dist/bundle.js` 429.71 kB。

**残余风险：**
- `RequestHistory.load()` 仍不复核上限、不按 `at` 重排——只在存档被外部改动时可观察，程序自身写入路径始终满足不变量。
- 收藏还原缓存对「B 站分 P 探测失败」是会话级固化：瞬时失败会让手机操作条的「选集」本场缺席，需刷新。
- 历史为设备级、无账号隔离（与「不进云同步」一致），同一浏览器换账号会看到上一位的点播记录。
- 「输入即过滤」的可观察面止于服务调用与组件夹具两层，未做「打字 → 渲染行」的 DOM 级端到端。

