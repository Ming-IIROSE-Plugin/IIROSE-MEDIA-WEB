---
ticket: 4
title: 收藏随机与专辑歌单设置项
type: feature
created: '2026-10-24'
status: done
baseline_revision: af26cec3f0524d8963d37e3cc086eb08b6f863ee
route: dispatch
review_loop_iteration: 0
context:
- '{project-root}/_bmad-output/initiative-iirose-media-web/archive-v6/spec-playback-loop-shuffle/SPEC.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-playback-loop-shuffle/shuffle-mechanics.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-playback-loop-shuffle/sidebar-controls.md'
---
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 点亮「收藏随机」目前没有行为。想连续听自己的收藏，只能一条条手动点；而收藏里既有单曲也有专辑与歌单，后者整张播会打断随机节奏。

**Approach:** 新增随机控制器：按插件面板当前 focus 的平台读该平台收藏，剩余 20 秒预取候选、剩余 5 秒发送，抽中专辑/歌单时只取其中随机一首；只在本人点播时动作，他人点播保持待命。新增设置项允许关闭专辑/歌单参与。

## Boundaries & Constraints

**Always:** 平台由面板 focus 决定（`CategoriesIndex 0 + PlatformIndex 0` → 网易云；`1 + 0` → B 站；其余 → 无收藏）；面板从未初始化时用 `defaultPage` 推断；候选排除当前曲目与本轮已播，耗尽后重置；同一轮不连续重复；解析/取流失败自动换下一首，连续 5 首失败则 `stop` 并提示一次；卡片由各平台既有播报入口发送，遵循 `announceMode`；`PlaybackMode.setAvailability("shuffle", …)` 是唯一的可用性来源；点播走 `NetEasePlatform.MOD` / `BilibiliPlatform.VOD`，专辑与歌单用 `getAlbumDetail` / `getSongListDetail` 取曲目再取一首。

**Never:** 不做跨平台混播；不改收藏库结构、云同步与收藏页面；不新增除「专辑/歌单参与随机」以外的设置；不改 `HostMediaBridge` 与循环控制器行为；不发任何额外聊天消息；不新增依赖；不在直播/时长未知/暂停/待命时触发。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| focus 网易云 | 收藏含单曲 | 随机抽一首，剩余 5 秒发送 `MOD` | 失败换下一首 |
| focus B 站 | 收藏含视频 | 随机抽一个，剩余 5 秒发送 `VOD` | 失败换下一首 |
| 专辑/歌单参与开启 | 抽中专辑记录 | 解析曲目后随机取一首单曲播放 | 解析失败换下一个候选 |
| 专辑/歌单关闭 | 同上 | 候选里不出现专辑/歌单 | N/A |
| focus 无收藏页面 | 无线电广播 / 多源剧集 / 设置页 | 按钮不可用，原因「当前页面没有收藏」 | 点击只提示 |
| 收藏为空 | 该平台无记录 | 按钮不可用，原因「收藏为空，先去收藏一些内容」 | 点击只提示 |
| 去重 | 上一首刚播过 | 本轮内不再抽到，候选耗尽后重置 | N/A |
| 连续失败 | 连续 5 首解析/取流失败 | 熄灭随机并提示一次 | 不无限重试 |
| 他人点播 | 待命 | 零动作零发送 | 不提示 |
| 暂停 / 直播 / 时长未知 | — | 不触发 | N/A |

</frozen-after-approval>

## Review Triage Log

（三路评审子代理在本次会话中反复被环境中断，改为编排侧逐项自查，结论如下。）

| 发现 | 判定 | 路由 | 证据 |
| --- | --- | --- | --- |
| B 站收藏若是多分 P，`VOD` 会弹选集框阻塞无人值守随机 | high | patch | `BilibiliPlatform.ts:476-500` 在未指定 targetP 且多分 P 时 `buildBiliSelect`；随机改为 `VOD(data, 1)` 直播第一集 |
| 点亮期间收藏被删空：候选不再刷新，随机空转 | medium | patch | 候选只在平台/设置变化时重取；现在空列表立即熄灭并给出「收藏为空」 |
| 可用性在候选未读出时短暂默认可用 | low | false | 默认可用只持续到首次查询返回（毫秒级），点击后被 `send` 的候选落空兜住，不产生错误发送 |
| `played` 集合在设置切换时未清空 | low | patch | 与平台切换一致，切设置时一并重置（已并入 `trackPlatform` 的重置分支） |
| 新设置项默认值两处需同步 | medium | patch | `PluginSettings.getPluginSetting` 与 `LocalStorageUtils` 均已加，并补老用户缺字段归一化测试 |
| 组合根 `prepareShuffleTarget` 无单测（需真实 API） | medium | defer | 依赖网易云接口与 B 站取流；留待真机联调（见 Implementation Notes 未验证项） |
| 随机成功判定用「标题变化」而非目标标题匹配 | low | false | 目标标题可能与宿站渲染不同；以「换曲 + 播放中」为准更稳，且 5 秒上限兜底 |


## Code Map

- `src/storage/FavoritesStorageService.ts:387-417` -- `query({platform, type})` 已排除墓碑并按 owner 作用域过滤；`restorePlatformData` 在 `src/storage/favorites/restorePlatformData.ts:10-39`（B 站分支会出网探测分 P）
- `src/platforms/NetEasePlatform.ts:904-911` -- `MOD` 只读 `platformData.neteaseMusic.id`；`:549-570`、`:693-720` 展示专辑/歌单曲目取法（`albumDetail.songs`、`playlist.trackIds`）
- `src/platforms/BilibiliPlatform.ts:382-390` -- `VOD(platformData)` 依赖 `platformData.bilibili`（`aid/bvid/cid`）
- `src/page/MainApp.tsx:25,73-80` -- `CategoriesIndex` 来源（初始 `defaultPage`）与 `switchCategories`
- `src/page/MainAppContainer.tsx:45,57,385-454,524-531` -- `PlatformIndex` / `favoritesMode` / `switchPlatform` / `toggleFavoritesMode`；对外只经 Provider（`:248-254`），无全局 store
- `src/settings/pluginSettings/PluginSettings.ts:34-42,45-64,198-220` -- 设置接口、布尔开关写法、默认值兜底
- `src/settings/localStorageUtils/LocalStorageUtils.ts:155-167` -- 默认值第二处，必须同步
- `src/page/MainAppContainerServices/SettingsService.ts:215-227` -- `SettingData` 布尔项写法
- `src/playback/LoopController.ts:80-99` -- 控制器形态（构造 / attach / dispose / 可用性发布）可复用
- `src/page/index.tsx:95-151` -- 装配顺序与释放顺序

## Tasks & Acceptance

**Execution:**
- [x] `src/playback/PanelFocus.ts` -- 新建模块级 store：`setPanelFocus({category, platform})`、`readPanelFocus()`、`platformOf(focus, defaultPage)` 纯函数（0/0→netease，1/0→bilibili，其余 null） -- 侧栏在 Preact 之外，只能经 store 读焦点
- [x] `src/page/MainApp.tsx`、`src/page/MainAppContainer.tsx` -- 在切分类/切平台/切收藏模式时写入 store -- 唯一焦点来源
- [x] `src/playback/ShuffleController.ts` -- 新建：按 I/O 矩阵维护候选池与去重、20 秒预取、5 秒发送、失败换曲与上限、`setAvailability("shuffle", …)`、订阅收藏外部变更 -- 行为集中可测
- [x] `src/settings/pluginSettings/PluginSettings.ts`、`src/settings/localStorageUtils/LocalStorageUtils.ts`、`src/page/MainAppContainerServices/SettingsService.ts` -- 新增 `shuffleIncludeCollections`（默认 true）开关与设置项 -- 两处默认值必须一致
- [x] `src/page/index.tsx` -- 装配随机控制器并释放 -- 唯一组合根
- [x] `src/playback/ShuffleController.test.ts`、`src/playback/PanelFocus.test.ts` -- 覆盖矩阵全部行（focus 映射、去重、预取、失败换曲、上限熄灭、待命零发送） -- jsdom + fake timers
- [x] `src/page/MainAppContainer.test.tsx` 或组合根用例 -- 切换平台后 `setPanelFocus` 被调用（若已有测试文件则补用例） -- 防接线掉线

**Acceptance Criteria:**
- Given focus 网易云且有收藏，when 打开随机并到达剩余 5 秒，then 发送一首收藏曲目的点播且不重复上一首
- Given 抽中专辑或歌单，when 开启「专辑/歌单参与随机」，then 只播放其中随机一首
- Given 关闭该设置，when 抽选，then 候选里不含专辑与歌单
- Given focus 在无线电广播或多源剧集，then 随机按钮不可用并显示「当前页面没有收藏」
- Given 连续 5 首失败，then 随机熄灭并提示一次，不继续重试
- Given 他人点播，then `socket.send` 调用次数为 0

## Implementation Notes

- 平台焦点用模块级 `PanelFocus` store：`MainApp` 在挂载与切分类时写入 category，`MainAppContainer` 在挂载与切平台时写入 platform；从未初始化时按 `defaultPage` 推断。
- 候选来自 `FavoritesStorageService.query({platform})`，按「房间焦点」缓存；切平台或切换「专辑/歌单」设置即失效重取。
- 预取与发送分两段：剩余 ≤20 秒 `prepare` 出可播目标（专辑/歌单此时解析并随机取一首），剩余 ≤5 秒调用其 `play`；`prepare` 失败最多连试 5 个候选，全失败即熄灭。
- 回读校验用「标题变化 + 播放中」，5 秒未变化计一次失败；连续 5 次失败熄灭并提示「连续 5 首无法播放，已停止随机」。
- B 站多分 P 收藏以 `VOD(data, 1)` 直播第一集，避免无人值守时弹选集框。
- 未真机验证：网易云专辑/歌单解析后单曲 `MOD` 的实播效果、B 站收藏视频取流（大会员/分 P）、自动点播卡片是否符合 `announceMode`、`defaultPage` 与实际焦点不一致时的取舍。
