# Brownfield 对照：点歌台改版

现状快照（2026-10-29，`8f1b865`）。左列为 DESIGN.md 组件键 / EXPERIENCE.md 部件，右列为当前承载文件。「改」= 本轮重写或换外观；「留」= 行为必须存活，外观可变。

## 组件 → 文件

| 规格部件 | 现有文件 | 处理 |
| --- | --- | --- |
| 令牌、焦点环、`Svg`、拖动/手势隔离（`floating-window` 共用） | `src/page/components/floating-panel/floatingPanel.tsx`、`accent.ts`（前轮品牌强调色，`--imw-accent*`） | 改：新增纸/墨/蔷薇红令牌；`themed*`、`accentVar`、`accent.ts` 品牌强调逻辑退役（`MainAppContainer.tsx` 与 `accent.test.ts` 同步） |
| 主题变体、`hov:`、`ShowIIROSE_MEDIA_CONTAINER`、mdi `::before` 图标 | `src/app.css` | 改：清理前轮 `--imw-entry-*` 等天蓝变量；保留 `imw-dark` / `hov` 变体与状态类 |
| 主面板外壳、主题写入、`Alt+S` / `Esc` | `src/page/MainApp.tsx`、`src/page/MainAppControlLayer.tsx`（`hotkeyControlApp`，现 `Esc` 直接关面板）、`src/iirose_func/HostTheme.ts` | 改：`Esc` 改为逐层关闭（CAP-14） |
| 竖栏 / 底部标签栏 / 页头（取代 Row1） | `src/page/components/navigationBar/main/MainNavigationBar.tsx` | 改（重写） |
| 搜索栏 + 来源切换器、范围标签、视图切换、分页（取代 Row2–Row4） | `src/page/components/mediaContainerBar/MediaSearchBar.tsx`、`MediaContainerSubNavBar.tsx`、`PlatformSelector.tsx`（`topRows.test.ts`） | 改（重写）；平台选择并入来源切换器 |
| 结果区状态、模式/范围/页码状态、钻取 | `src/page/MainAppContainer.tsx`（`switchToMultiPage`、`isCurrentInMultiPage`、`favoritesMode`）、`MainAppContainerServices/*Service.ts` | 改：`favoritesMode` 切换改为一级「收藏」模式，电台由平台升为模式；按模式保存状态 |
| 曲目行、视频卡、音乐网格卡、收藏星、封面回退 | `src/page/components/media-card-container/`（`MediaCard`、`MediaListRow`、`MediaCardButton`、`MediaCardImg`、`FavoriteStarButton`、`MediaCardInfo`、`MediaCardMessage`） | 改（重写为 `tracklist-row` / `video-tile` / `music-tile` 等） |
| 设置组卡 / 设置行 / 开关 | `src/page/components/SettingCard.tsx`、`MainAppContainerServices/SettingsService.ts`、`src/settings/*` | 改外观；设置数据与动作不动 |
| 关于卡 | `src/platforms/About.ts`、`MainAppContainerServices/AboutService.ts` | 改外观；「GitHub 🔗」emoji 换外链图标 |
| 底部条 / 迷你条 / 展开的底部条 | 新增；数据与跳转复用 `src/media-progress/`（`HostMediaBridge`、`ProgressSession`、`model.ts`）与 `src/playback/PlaybackMode.ts` | 新 |
| 播放进度浮窗 | `src/page/components/media-progress/MediaProgress.tsx`（`#imw-media-progress-root`，z 90001） | 改配色，行为不变 |
| 收藏随机选择面板 | `src/page/components/shuffle-picker/`（`ShufflePicker.tsx` z 90010、`openShufflePicker.tsx` 接管 `Utils.backward`、`PlatformTabs`、`pickerPosition`） | 改配色，行为不变；其 `Utils.backward` 接管方式是选集面板与逐层关闭的参照实现 |
| 选集面板 | 现为宿站弹窗：`BilibiliPlatform.buildBiliSelect` / `buildOrderConfirmSelect`、`NetEasePlatform` `MLOD`/`AOD` 的选集分支与 `buildOrderConfirmSelect`、`AllVideosPlatform` 选集；有序多选接管在 `src/iirose_func/IIROSEUtils.ts`（`selectedQueue`、序号徽章、确定按钮 `onclick`） | 新（插件自有）；上述选集调用点改接新面板，跨弹窗 `setTimeout(300)` 随之移除 |
| 最近点播 | 无；只有 `src/playback/MediaPayloadMemory.ts`（sessionStorage `imwMediaPayload` 单条报文缓存） | 新：localStorage 历史（建议键 `imwRequestHistory`）；写入点宜收在点播报文发出处（`src/iirose_func/Socket/Media/index.ts` 一带）以覆盖所有入口，含 `src/input-behavior-module/` |
| 手势呼出 | `MainAppContainerServices/MediaContainerGesture.ts` | 留 |

## 必须存活的行为

- `Alt+S`（含 `ß`）呼出、手机双指下滑呼出；关闭面板不影响播放与模式。
- 各平台搜索与分页：网易云单曲/专辑/歌单/MV（经 `SendFetch.neteaseRequest`）、B 站推荐/视频/直播、多源剧集、电台。
- 点播链路与播报档位：`Announce.runSingleAnnounce`（单项）/ `runBatchAnnounce`（批量）、`Announce.showBatchItemError` 同因 10 秒去重；公聊点播卡片 + `&1` 报文。
- 面板内钻取：B 站多 P、网易云歌单、专辑、多源剧集的曲目列表与返回（`switchToMultiPage`）。
- 收藏：星标切换、`FavoritesStorageService`、云同步（`src/sync/`）与墓碑；收藏点播（`FavoritesService` 对专辑/歌单走 `AOD`/`MLOD`）。
- 选集有序多选：确认结果按点选顺序、乱序时随机；单项走单曲播报、多项走批量播报；网易云批量详情与 B 站分 P 按所选顺序二次重排。
- 歌单/专辑与 B 站多 P 的整单「正序/乱序」点播（现 `buildSelect2` 一级菜单）：歌单/专辑改由内页头「全部播放」+ 顺序菜单承接（复用 `MLOD`/`AOD` 的整单批量逻辑）；B 站多 P / 多集改由选集面板「全选」+ 正序/乱序承接。
- 单曲循环 / 收藏随机：`LoopController`、`ShuffleController`、`CutWatcher`、`PlaybackMode`、`ShuffleSelection`；面板底部条与进度浮窗为同一状态。
- 进度跳转权限（有媒体权限或本人点播）与 `src/media-progress/` 现有跳转逻辑（`OwnerMediaControl.test.ts` 覆盖）。
- 侧栏注入：`SidebarMediaEntry`（进度入口）、`SidebarPlaybackRow`（循环/随机按钮行），幂等与卸载清理。
- 全部设置项与动作：画质、默认 API、歌词、插件启动默认页面、搜索结果视图、点播播报、播放时长、代理蔷薇 `@` 输入、云同步（启用/立即同步/清空云端/忘记本机密钥/状态/上次同步时间）及 B 站账号等（以 `src/settings/*` 为准）；取值类沿用宿站选择弹窗与输入框。
- 关于四项：作者（关闭面板后打开用户卡）、源代码地址（新窗口）、投喂我、赞助列表（宿站弹窗）。
- 输入框 `@` 链接拦截：`moveinputDo` 前端同步清空并中断原生发送（`src/input-behavior-module/`）。
- 首次注入用户协议弹窗（`#syncAlertHolder`）与宿站遮罩处理；单实例（`.IIROSE_MEDIA_CONTAINER` 唯一）。
- 封面 `http→https` 升级与 `onerror` 回退。

## 现有测试的影响面

`topRows.test.ts`、`mediaCards.test.ts`、`SettingCard.test.ts`、`MainAppContainer.test.ts`、`MainAppControlLayer.test.ts`、`accent.test.ts` 断言旧结构/类名，随对应 story 改写或删除；`shuffle-picker/*.test.ts`、`media-progress/*`、`playback/*`、`settings/*`、`Socket/*` 的行为测试必须继续通过（配色断言除外）。
