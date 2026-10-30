# 输入框 @ 媒体点播与选集交互系统架构设计 (design.md)

## 1. 概述与设计背景

在蔷薇花园（iirose.com）聊天室中，用户常通过输入框发送媒体链接以触发媒体点播。然而原生点播存在以下痛点：

1. **输入泄露与误发送**：在输入框内输入 `@` 媒体链接后按回车，若未被及时拦截，容易作为普通聊天消息误发或在私聊中泄露链接。
2. **多集/歌单交互缺失**：面对网易云歌单/专辑及 B 站多分 P 视频，原有逻辑要么只播放单曲，要么缺乏直观的选集管理。
3. **选集长列表体验差**：当歌单或分 P 数量庞大时（如 50~100 首曲目），原生多选弹窗将「确定」按钮置于列表最底部，用户必须滑动到底端才能完成点播；且曲目仅展示纯文字或默认图标，辨识度低。
4. **弹窗流转闪退**：选集多选点击「确定」后，无法顺利弹出「正序播放 / 乱序播放」的二次选择框。

本设计旨在打造一个**零侵入、防泄露、强交互、平滑流转**的媒体输入拦截与选集点播体系。

---

## 2. 总体架构与数据流转

```mermaid
flowchart TD
    Input[用户在输入框键入 @链接 或回车] --> CheckProxy{插件设置是否启用代理蔷薇@输入}
    CheckProxy -- 否 --> Passthrough[放行至宿站原生逻辑]
    CheckProxy -- 是 --> Intercept[Input-Behavior-Module: 拦截回车并清空输入框]

    Intercept --> Extract[UrlExtractor: 提取 URL 并解析短链重定向]
    Extract --> Route{平台路由判别}

    Route -- 网易云单曲 --> NetEaseMOD[NetEasePlatform: MOD 单曲播放]
    Route -- 网易云歌单/专辑 --> NetEaseSelect[宿站单选菜单: 正序/乱序/选集]
    Route -- B站视频 ?p=N --> BiliDirect[BilibiliPlatform: 直达播放目标分 P]
    Route -- B站视频多分P --> EpisodePicker[插件自有选集面板: 序号徽章 + 正序/乱序 + 点播所选]
    Route -- 直链嗅探 --> DirectProbe[8 秒超时嗅探: 音频/视频/非媒体]

    DirectProbe -- 超时 --> ShowTimeout[提示探测超时]
    DirectProbe -- 是媒体 --> DirectPlay[构造 MediaCard 发送媒体包]
    DirectProbe -- 非媒体 --> NativePass[回填并放行至原生聊天]

    NetEaseSelect -- 选集 --> EpisodePicker
    EpisodePicker -- 点播所选 --> SendOrderPlay[按点选顺序分发播放（乱序为同一集合的随机置换）]
```

---

## 3. 核心子系统与关键设计

### 3.1 输入行为劫持与防泄露 (`Input-Behavior-Module.ts`)

- **生命周期挂载**：在插件加载时劫持宿站 `window.Utils.service.moveinputDo`，备份原生函数至 `window.Utils.IMW.backup.moveinputDo`。
- **即时响应与保护**：
  - 监听回车键与发送行为，提取输入框内容。
  - 若以 `@` 开头且携带 HTTP/HTTPS 链接，且设置中开启了代理输入，**同步清空输入框**，阻断向当前房间或私聊频道的原生文本广播。
  - 将提取的链接交付 `InputPlatformAnalysis` 异步管线处理。

### 3.2 链接提取与直链嗅探管线 (`UrlExtractor.ts` & `InputPlatformAnalysis.ts`)

- **短链重定向穿透**：针对 `b23.tv`、`163cn.tv` 等短链接，通过轻量级 HEAD 请求解析 `location` / `x-final-url` 获取目标落地 URL。
- **单 P 直达识别**：解析 URL 查询参数中的 `?p=N`，命中后跳过选集，直接点播指定分 P。
- **直链媒体探测与超时熔断**：
  - 对非平台链接发起 8 秒超时（`AbortController`）的 HEAD 嗅探；
  - 检查 `Content-Type`（`audio/*`, `video/*`）与直链扩展名（`.mp3`, `.flv`, `.mp4` 等）；
  - 超时则弹出「直链媒体探测超时」用户提示；非媒体链接平滑回填输入框并放行至宿站原生逻辑。

### 3.3 选集面板的有序多选与序号徽章体系 (`episode-picker`)

- **载体**：插件自有浮层，不再借用宿站 `buildSelect2`。命令式入口 `openEpisodePicker`（`src/page/components/episode-picker/`）挂在 `document.body` 的独立根 `#imw-episode-picker-root` 上，层级 `z-[90010]`，根上写 `data-imw-theme` 复用纸/墨/蔷薇红令牌；桌面为居中卡片，手机为底部抽屉，`Esc` 与宿站返回键经 `desk/overlayLayers` 的 `episode` 层只关这一层。
- **设计目标**：
  - 用户多选时，直观展示点击次序（1, 2, 3, 4, 5...）；
  - 取消某项勾选时，剩余项序号自动平滑重排；
  - 正序播放严格按照用户选取的 1, 2, 3... 顺序逐一下发，乱序是同一集合的随机置换；
  - 长列表只在列表区滚动，标题行与吸底底栏固定。
- **动态次序管理（`selected: string[]`）**：
  - 选中项按点选先后入列，行内徽章号码即 `selected.indexOf(id) + 1`；
  - 点击未选中项：追加到末尾，分配最新序号；
  - 再次点击已选项：从数组中移除，其余项序号自动前移，始终保持连贯的 1, 2, 3...；
  - 「全选」按列表顺序塞入全部 id（徽章 1…N），全部选中时文案变「取消全选」，再点清空。
- **视觉呈现**（DESIGN.md `episode-picker`）：
  - 选中项左列为 20px 蔷薇红实底序号徽章（`on-rose` 白字、等宽数字）；
  - 未选中项为 20px `rule` 描边方块；
  - 行 `role="checkbox"`，选中后读屏读出「第 N 个」；行高与可点目标 ≥44px。
- **吸底底栏与有序回调**：
  - 底栏固定「正序 / 乱序」`radiogroup`（默认正序，方向键切换）与墨底「点播所选」；
  - 未选任何项时主按钮禁用（40% 不透明）；房间不支持点播时灰化但仍可点，只提示「这个房间不支持点播」；
  - 确认回调交付**按播放顺序排好**的条目数组（正序 = 点选顺序，乱序 = Fisher–Yates 置换），不做二次重排。
- **业务层播放顺序保证**：
  - **网易云**：`NetEasePlatform.selectEpisodes` 把面板给的行（id 带位置，兼容歌单里重复的同一首歌）映射回曲目 id，再交 `finalODSONG`；后者按入参 `songsID` 用 `Map` 二次排序，因此点选顺序在批量详情乱序返回时也成立；
  - **B站**：`BilibiliPlatform.selectEpisodes` 按面板给的 `page` 顺序回填分 P 数组；
  - **多源剧集**：`AllVideosPlatform.selectEpisodes` 按面板给的条目位置回填播放列表。
- **单项 / 多项**：1 项走 `Announce.runSingleAnnounce`（卡片不被并行批量抑制吞掉），≥2 项走 `Announce.runBatchAnnounce`（count = 所选数，逐项 `showBatchItemError` 后跳过）。
- **状态**：打开即显示骨架行、底栏禁用；取不到时「加载失败」+「重试」；0 条时按单位给出空文案（分集 / 曲目），只能关闭。

### 3.4 宿站弹窗流转防闪退（历史问题，选集已不适用）

- **宿站的流转隐患**：宿站点选择器项时先同步执行业务回调，紧随其后 `fadeOut(250)` 并 `empty()` 容器；若在回调内同步唤起下一个 `buildSelect2`，新弹窗会被随后的淡出清空销毁。
- **现在的做法**：选集完全走插件自有面板（§3.3），不再有「多选弹窗 → 二次排序确认框」的跨弹窗流转，因此不需要任何 `setTimeout(..., 300)` 补丁；`IIROSEUtils.buildSelect2` 已退化为纯透传，只剩取值类单选在用：设置 / 关于的选项弹窗，以及网易云歌单·专辑的一级菜单（正序 / 乱序 / 选集点播——收藏里的整单点播只靠它）。
- **回归防线**：`src/` 内不再有 `buildSelect2(…, true, …)` 多选调用与跨弹窗 `setTimeout(300)`；选集面板的 `Esc` / 返回键由层级栈调度，也不依赖宿站淡出时序。

### 3.5 选集面板的封面与降级（宿站图标槽已退场）

- 选集面板的行不再渲染宿站 100×100 图标槽或内联 `<img>` HTML（旧 `IIROSEUtils.generatePicHtml` 已删除）：行内是集名 / 曲名 + 副行 + 等宽时长，颜色与字号一律取 `floating-panel/tokens.ts` 的成对令牌。
- 结果区自己的封面仍按既有约定处理：`http://` → `https://` 升级（避免 HTTPS 站点加载 HTTP 资源的 Mixed Content 拦截），并挂 `onerror` 平滑回退到自包含矢量图标（`Cover` 组件，`thumb` 底 + `DeskIcon`）。
- 封面裁切填满容器、跟随容器圆角，不留黑边。

---

## 4. 平台适配详情

| 平台             | 触发场景                             | 入口                                                              | 确认后流转                                              |
| :--------------- | :----------------------------------- | :---------------------------------------------------------------- | :------------------------------------------------------ |
| **网易云歌单**   | 输入歌单 URL、收藏点播或卡片点击播放 | 宿站单选菜单「选集点播」→ `NetEasePlatform.selectEpisodes` 开面板 | 1 首走单曲播报；多首按点选顺序交 `finalODSONG` 批量播报 |
| **网易云专辑**   | 输入专辑 URL、收藏点播或卡片点击播放 | 同上                                                              | 同上                                                    |
| **B站多 P 视频** | 输入多分 P BV 链接或卡片点击播放     | `BilibiliPlatform.selectEpisodes` 直接开面板（无一级菜单）        | 1 集单曲播报；多集按面板顺序逐 P 播放                   |
| **多源剧集**     | 多集资源卡片点击播放                 | `AllVideosPlatform.selectEpisodes` 直接开面板                     | 1 集单曲播报；多集按面板顺序逐集播放（150ms 呼吸）      |
| **B站单 P 链接** | 输入带 `?p=N` 链接                   | 不开面板                                                          | 跳过选集，直接播放对应分 P                              |
| **直链媒体**     | 输入直链音频/视频 URL                | 不开面板                                                          | 嗅探成功直接下发媒体卡片                                |

---

## 5. 验证标准

1. 输入框键入网易云歌单链接并按回车：输入框立即清空，不触发任何公屏或私聊文字发送。
2. 点「选集点播」或点播多 P / 多集条目：插件自有选集面板打开（桌面居中卡片、手机底部抽屉），列表区先显示骨架行，底栏禁用；取不到时「加载失败」+「重试」。
3. 面板内每点选一项，左列显示 1, 2, 3... 蔷薇红序号徽章；取消勾选时后续序号前移；「全选」按列表顺序给出 1…N 并把文案变为「取消全选」；未选任何项时「点播所选」禁用。
4. 勾选多首并点「点播所选」：1 首走单曲播报（卡片立即发送），多首走批量播报（count = 所选数）；「正序」按点选顺序播放，「乱序」是同一集合的随机置换。关闭钮 / 点面板外侧 / `Esc` / 宿站返回键都是取消，不点播。

---

## 6. 跨平台媒体收藏系统架构设计 (`FavoritesStorageService` & `oldItems` 现场快照)

### 6.1 总体架构与数据持久化

- **存储介质**：基于浏览器原生 IndexedDB（数据库名 `IIROSE_MEDIA_DB`，版本 1，对象仓库 `favorites`），容量上限达数百兆，摆脱 localStorage 5MB 限制与序列化开销。
- **复合主键设计**：采用 `platform:type:rawId`（例如 `netease:song:12345`、`bilibili:video:BV1xx`），彻底杜绝跨平台 ID 冲突。
- **数据结构与索引**：
  - 保存标准化 `PlatformData`，剥离不可序列化的函数与 Promise，封面在写入前统一完成 HTTPS 升级；
  - 支持多维索引：`platform`、`type`、`platform_type`、`createdAt`，查询结果按入库时间严格倒序排列。
- **零延迟同步判定**：
  - 服务初始化时将全量收藏 ID 载入内存 `Set<string>`，渲染卡片与列表行时 `isFavorited()` 为纳秒级同步判断；
  - 若处于无痕模式或 IndexedDB 被禁用，自动平滑回退至内存 `Map`，界面不崩溃。

### 6.2 顶栏布局与模式流转机制

- **Row 2 工具栏排布约定**：
  - 严格保持标准顺序：`[卡片/列表] [⭐收藏模式] [🔍 搜索] [xx/xx] [上一页] [下一页]`；
  - `⭐收藏模式` 为点亮/点暗双态切换按钮：
    - 点亮状态（已藏）：明黄实心星（`#fbc02d`）+ 深色背景，标签为「已藏」，搜索框转为本地即时过滤；
    - 点暗状态（全网）：白色空心星 + 浅透背景，标签为「全网」，恢复远程搜索。
- **无侵扰静默操作**：
  - 收藏与取消收藏取消所有弹窗弱提示（Toast），提供最平滑沉浸的指尖交互；
  - 卡片视图右上角配备 36×36px 磨砂圆钮；列表视图右侧采用温和低饱和度的圆角卡片块（`rounded-xl`）。

### 6.3 复用 `oldItems` 规范的全网现场无损保护

- **现场保存 (`discoveryOldItems`)**：
  - 从全网切入收藏时，复用既有的 `OldItems` 接口标准，完整封存当前 `mediaData`、`allMediaData`、`currentPage`、`totalPage`、`PlatformIndex`、`SubNavBarIndex`、`searchKeyword` 以及点播回调；
  - 若在选集模式（多集/分 P）中点亮收藏，优先取外层父级列表的 `oldItems` 作为全网现场。
- **子组件副作用阻断与还原**：
  - **`PlatformSelector` 阻断**：在模式切换时拦截 `prevProps.platform !== this.props.platform`，严禁触发 `switchPlatform(0)`，防止已还原的 `currentPage` 和 `allMediaData` 被篡改覆盖为 `1`；
  - **`MediaContainerSubNavBar` 置顶拦截**：将模式切换检测置于生命周期最前端并立即 `return`，阻断 `searchKeyword` 比对误触发的重搜索；
  - **无损秒级恢复**：切回全网时对齐 `switchToOutFromMultiPage` 机制，页码（例如 `2/29`）与卡片数据原地完整再现，支持任意多次反复切换而绝不触发多余网络请求。
