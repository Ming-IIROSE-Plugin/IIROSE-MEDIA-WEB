<!-- bmad:context -->
<!-- Verified 2026-10-12 against fe3e381. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## IIROSE-MEDIA-WEB

注入 https://iirose.com/（蔷薇花园）聊天站的媒体点播插件。Preact + TypeScript + Vite 库模式，产出单文件 UMD `dist/bundle.js`（CSS 由 JS 注入）。无 lint；自动验证 = `npm test`（vitest + jsdom，`src/**/*.test.ts`，测试文件里不写 JSX）加 `npm run build`（`tsc -b && vite build`，**不跑测试**），两者都要过。

## Policy

- 包管理只用 npm（`package-lock.json` 为准）；`yarn.lock` 已废弃，不要更新它。
- 提交直接进 main，不开分支。
- 完成并验证（测试、构建通过）的改动提交后**自动推送**到 `origin main`，不必再问维护者；推送会触发 CI 部署到线上。
- 运行时验证需要 iirose.com 测试账号：凭据存放于本机 `.secrets/`（已 git-ignore，绝不入库）；该目录不存在时向维护者索取。凭据绝不写进代码、文档或提交。

## Where things are

- 入口：`src/main.ts`，**运行在 `messages.html` iframe 上下文**（`#mainContainer` 在 iframe 内，顶层文档只有 `#mainFrame`）；油猴调试 `@match https://iirose.com/messages.html` + `@require file://` 指向本地 `dist/bundle.js`。
- 运行时验证流程已固化为 skill：`.opencode/skills/iirose-plugin-verify/`（SKILL.md 入库，其余 agent 工具链不入库；登录、进房、注入、验证的完整步骤）。Claude Code 经本机软链 `.claude/skills/iirose-plugin-verify` 共用同一份；注入方法按工具链区分，见其 `scripts/inject.md`。
- UI：`src/page/`（Preact 组件树）。
- 新增音乐平台需同步三处：`src/platforms/`（平台类）、`src/Api/`（API 客户端）、`src/settings/`（平台设置），类型放 `src/types/`。
- 宿站交互（WebSocket 媒体、消息）：`src/iirose_func/`。
- 出网请求走 `src/environment/Environment.ts` 选定的阿里云 CORS 代理（ipinfo.io 判 CN/Global）；改 API 层时注意 fetch 是否需要过代理。
- 浮窗（播放进度、收藏随机）共用 `src/page/components/floating-panel/` 的样式常量与无状态组件（外框、头部、按钮、拖动手柄、事件隔离）；改两窗外观时改这里，不要在单个浮窗里另写一套。
- 外观令牌唯一来源是 `src/page/components/floating-panel/tokens.ts`（DESIGN.md frontmatter 的落地）：颜色导出**浅深成对的完整 Tailwind 类串**（如 `deskSheet = "bg-[#FBFAF7] imw-dark:bg-[#1C1A18]"`），另有字号/圆角/间距、`deskFocusRing`（2px ink 外圈 + 2px 间隔）与内联 SVG 图标 `DeskIcon`。组件只拼令牌，**不得裸写颜色 / `rgba(` / `themed*` / `accentVar`**；需要新颜色先加令牌。`themed*` 与 `accentVar` 已全部退役（设置卡也已改用令牌），不要再引入。
- 结果区组件键（`src/page/components/media-card-container/`）：曲目表 `TracklistRow` / `TracklistHeader`（桌面七列、手机五列：封面 / 标题 / 时长 / 收藏星 / 点播；手机没有操作条）· 音乐网格 `MusicTile` · 视频卡 `VideoTile`（时长胶囊 / 直播徽章）· 专辑歌单行 `CollectionRow` · 内页头 `CollectionHeader` + 顺序菜单 `OrderMenu` · 收藏星 `FavoriteStar` · 状态 `StateMessage` / `Skeletons` · 容器 `ResultsArea`（Promise 状态机 + 形态派生），共用 `Cover`（https 升级 + onerror 回退）与纯函数 `mediaFormat.ts`。新增结果形态改这些文件，不要回到 `MediaCard`（已删除）。
- 专辑/歌单的「全部播放」走 `NetEasePlatform.playCollectionAll`（内页头 → 插件自有 `OrderMenu`），**不经宿站 `buildSelect2`**，因而不需要跨弹窗 `setTimeout(300)`。
- **点播反馈统一走 `src/playback/RequestGuard.ts` 的 `guardedRequest`**：所有手动点播入口（行、卡、收藏、电台、整张播放选定顺序后）都包它——同一条目进行中再点无效，按钮「点播中」转圈到第一条 `&1` 点播报文发出（`Socket.observe` 里的 `noteMediaSent`）即恢复，**没有冷却、没有「已点播」态**；平台函数要把发送过程的 Promise 返回出来（返回 `void` 的入口按「弹菜单 / 选集」放行，不显示点播中）。成功确认是面板内 `DeskToast`，失败仍走宿站 `ShowMessage`。新增点播入口记得接守卫，别直接调平台函数。
- **批量点播进度**：整张正序/乱序与选集多选用 `src/playback/BatchProgress.ts` 的 `startBatch` 拿句柄，`finalODSONG(ids, batch)` 逐首 `step()`、每首发送前查 `batch.cancelled`；浮窗 `BatchProgressStack` 挂 body 独立根 `#imw-batch-progress-root`（z 90008），关面板仍在。
- **没有手机操作条**（已取消）：手机曲目行直接放 40px 收藏星 + 40px 点播钮，网格卡首点显示「点播」胶囊再点点播；面板内浮层层级只有 展开的底部条 / 顺序菜单 / 来源菜单（互斥）> 内页 > 主面板，见 `overlayLayers.ts`。
- 主面板配色跟随宿站主题：`.IIROSE_MEDIA_CONTAINER` 打开时写 `data-imw-theme="light|dark"`，深色样式用 Tailwind 自定义变体 `imw-dark:`（注册在 `src/app.css`）；点歌台是「纸/墨/蔷薇红」——`paper` 主区、`rail` 竖栏、`sheet` 抬起面，蔷薇红只表示「点播」与「房间正在放」，平台品牌色只做 7px 来源圆点，从不整片铺底。
- `src/app.css` 只放 Tailwind 无法表达的东西：@keyframes、mdi 图标 `::before` content（反斜杠不能进 class 名）、JS 切换的状态类（`ShowIIROSE_MEDIA_CONTAINER`）、宿站元素选择器、动效基线（base 层默认过渡与 `--imw-fast/base/slow` 档位；按下反馈用 `floating-panel` 的 `deskPress`）；其余样式一律写进组件的 Tailwind 类，**不要新增 SCSS**。

## Running and verifying

- `npm run dev` 是 `vite build --watch`，不是开发服务器——本插件没有可独立运行的应用。
- 运行时验证流程：构建 → 浏览器打开 iirose.com 加载 bundle → 每次改完刷新页面检查；桌面 alt+S、移动端双指下滑呼出 UI。
- 调试在热推列表随机选房间；部分房间不支持艾特音乐，这是房间差异不是插件 bug。

## Conventions that differ from defaults

- `react`/`react-dom` 由 tsconfig paths 映射到 `preact/compat`——直接 import 'react' 即可，不要安装真正的 react 包。
- 样式统一 Tailwind v4 任意值类（如 `max-[768px]:hidden`、`[grid-auto-rows:max-content]`）；移动端响应式断点统一使用 `max-[768px]`；点歌卡片网格行必须保持 `max-content` 自适应，否则按钮会被 `overflow:hidden` 裁掉（曾出过此 bug）。
- 图标一律自包含方案：点歌台外壳与结果区用 `tokens.ts` 的 `DeskIcon`（`currentColor`，DESIGN.md 的 symbol 路径），浮窗（播放进度、收藏随机）用 `floating-panel` 的内联 SVG 组件；仍有 mdi 字形的位置（宿站选择框里的设置图标）加 id/类 + `src/app.css` 写 `::before { content:"\F0xxx"; font-family:"md" }`；**不要借用宿站 `mdi-*` 类**（宿站样式表里未必有该类规则，且没有 `font-family:"md"` 兜底会渲染成无字形——关于图标曾因此消失），也不用 emoji。
- 点歌台外壳布局与触控目标约定（取代旧「Row 1–4 顶栏」）：
  - 桌面 >768px：左侧 84px 竖栏（品牌标 + 音乐/视频/电台/收藏 + 弹性空白 + 设置/关于，选中项抬到 sheet 底 + 1px 细线环 + 左缘 3px 蔷薇红竖条）+ 主列（页头 → 搜索栏 → 范围行 → 结果区 → 底部条）。页头、搜索栏、范围行用 36px 左右边距。
  - 手机 ≤768px（`max-[768px]`）：单列——页头 → 搜索栏 → 范围行 → 列表 → 迷你条 → 五项底部标签栏（音乐/视频/电台/收藏/设置，关于并入设置）；搜索栏与列表左右 16px，页头与范围行 20px。
  - 搜索栏是面板内联输入（来源切换器 → 竖分隔线 → 放大镜 + 输入区 → 键位提示 → 墨底「搜索」），提交仍走 `SearchBar.onSubmit → changeSearchKeyword → searchAction`；来源切换器点开是插件自有下拉菜单 `SourceMenu`（不是原生 `select`），键位提示：未聚焦且空 `/`、聚焦且空不显示、有内容 `Enter`，手机只留来源简称 + 输入区（16px 防 iOS 放大）；桌面打开面板自动聚焦、手机不聚焦。
  - 范围行：左为范围标签（`role="tablist"`、方向键移动、选中项 2px 墨色下划线压在行底线上），右为视图切换（`ViewToggle`，**常驻**，只有一种视图的范围灰色锁定并提示，不要再让它消失）与等宽分页 `01 / 28`；手机标签区可横滚、右侧固定。
  - 手机端所有可点目标 ≥44px（视觉可更小，用 `max-[768px]:h-11 max-[768px]:w-11` 外扩），断点一律 `max-[768px]`（宿站 iframe 有 1.13–1.19 倍缩放）。
  - 六种模式各自保留关键词、范围与页码：切模式先快照现场再恢复，**不要用「切模式即重置搜索词」**的老写法。

## Known pitfalls

- `vite.config.ts` 的库入口写的是 `src/main.js`，实际文件是 `src/main.ts`（构建能正常解析）；重命名入口时两处要一起改。
- 网易云新增/修改端点必须走 `SendFetch.neteaseRequest`（节点切换、5s 超时、失败提示的唯一入口）；照 B 站写法自己拼 `${this.cors}` 会叠成双层代理前缀，并把失败退化成静默空列表。风控码（`-462/-460/460`）、HTTP 433 与超时各自归类，重试过程静默、全节点失败才提示一次；批量端点（逐曲歌词）失败按同因 10 秒窗口去重，否则一次点播会刷出上百条提示。
- 首次注入会弹插件自己的用户协议（宿站 `#syncAlertHolder`），挡住一切交互——先点它的「确定」。
- 宿站输入框（`#syncPromptHolder` 等）是 jQuery 体系：合成 DOM 事件无效，自动化必须用真实键盘事件（Playwright `type()`/`press()`）。
- 宿站弹窗关闭后残留全屏遮罩（`#syncHolderOutside` 不自清理、`#syncHolder` 常显），会拦截真实鼠标点击——自动化点击页内元素前先移除/隐藏它们。
- 宿站 `messages.html` iframe 存在 1.13~1.19 倍视口缩放：物理宽度 390px 对应 iframe 465px，412px+ 对应 470px~512px；移动端响应式断点必须使用 `max-[768px]`，禁止单一依赖 `max-[490px]`（否则大屏手机会回退桌面布局并导致文字折行）。
- 宿站 `buildSelect2` 多弹窗流转与 fadeOut 冲突：选项/多选确定点击后，宿站**先同步执行业务回调，紧随其后立即触发 `fadeOut(speed250, () => selectHolderBox.empty())`**！若在回调内同步唤起下一个 `buildSelect2`（如选集后打开正序/乱序确认框），刚生成的新弹窗会被宿站后续的 `fadeOut` 瞬间清空销毁。**跨弹窗流转必须包裹在 `setTimeout(() => { ... }, 300)` 中**，待前置 250ms 淡出动画完全结束且 DOM 清空后再行淡入。
- 宿站 `buildSelect2` 多选无序收集与顺序选择扩展：宿站原生多选点击确定时，遍历已缓存的 jQuery 集合 `m`（索引 `0` 到 `u-1`），**会彻底丢失用户的点击先后次序**。实现「按点选顺序（12345）播放」必须在微任务中接管选项与确定按钮的 `onclick`，用响应式队列动态追踪点击时间线并渲染序号徽章；同时确定按钮按使用习惯保留在列表最下方原生末端；在业务层（如网易云批量详情接口及 B 站分 P 数组）必须依此有序数组二次重排，防止接口返回的乱序覆盖用户的选取顺序。
- **选集不再走 `buildSelect2`**（story 5 已落地）：选集是插件自有面板 `episode-picker`（`src/page/components/episode-picker/`：有序多选、序号徽章、正序/乱序、`点播所选`），入口 `openEpisodePicker`（body 独立根 `#imw-episode-picker-root`、`z-[90010]`、层栈 `episode` 层）。调用点：`BilibiliPlatform.selectEpisodes`、`AllVideosPlatform.selectEpisodes`、`NetEasePlatform.selectEpisodes`（`MLOD`/`AOD` 的 `select===2` 委托它）。`buildBiliSelect`、`buildOrderConfirmSelect`（B 站与网易云各一份）与 `IIROSEUtils.buildSelect2` 里的有序多选接管（`selectedQueue` / 序号徽章 / 吸底确定钮）**已删除**——`buildSelect2` 现在是纯透传，只服务设置 / 关于的取值类单选，不要再往里加多选补丁，也不要新增跨弹窗 `setTimeout(300)`。
- 输入框 `@` 链接拦截防泄露：拦截必须在 `moveinputDo` 最前端**同步清空输入框并中断原生发送**，再进入异步 URL 重定向与直链嗅探；不可在异步期间保留输入内容，否则用户连按回车或异常放行会导致链接以私聊或公聊文字误发。
- 混合内容安全与封面 HTTPS 升级：宿站运行在 HTTPS 上下文，第三方 API（如网易云）返回的封面常为 `http://` 形式，会触发浏览器 Mixed Content 拦截导致图片破损；渲染封面必须先做 `src.replace(/^http:\/\//, 'https://')` 安全升级，并挂载 `onerror` 平滑回退到自包含矢量图标。
- 插件**不带 Tailwind preflight**：`border-solid` 加单边 `border-b` 会让其余三边落到浏览器默认 3px（曾画出灰框）。边框基线由 `app.css` base 层补（`border: 0 solid currentcolor`），新增独立根节点（浮窗、面板）要把它的 id 一并加进那条选择器与 `box-sizing` 规则。
- **动效基线**：`app.css` 的 base 层只给默认过渡（颜色/透明度/阴影/缩放，120ms，`--imw-fast/base/slow`），**不要再写通配 `transition: all`**；Tailwind v4 的 `scale-*`/`translate-*` 是独立属性，过渡要写 `scale`/`translate` 而不是 `transform`；按下反馈用 `deskPress`，减少动态效果时要关缩放与位移。
- 网易云歌单详情的 `tracks` 在部分网络 / 未登录时只给前 10 首，**完整列表以 `trackIds` 为准**（选集面板用 `NetEasePlatform.playlistSkeleton` 先按 id 立刻列出，再经面板的 `enrich` 钩子由 `fetchSongDetailsPooled` 每批 100 首、4 路并发在后台补歌名，关面板即中止）；新写歌单相关逻辑别只读 `tracks`，也别在打开面板前同步等全部详情（万首歌单会卡很久）；列表超过 200 行时面板分批渲染（`RENDER_BATCH`）。
- 宿站控制台日志陷阱：宿站会把 `&1` 媒体播放事件以 `m__4@0>...` 卡片形态打到控制台（来自宿站自身脚本，非插件日志）——**不能**凭该日志判断「点歌卡片已发送」；`Socket.sendMessage`（公聊文本/总结消息）则完全没有控制台日志。判定消息是否真的发出/渲染，必须查聊天区消息流 DOM（`div.msgholderBox`，取 children 最多的容器看末尾子块）——spec-announce-batch-scope 真机验证曾两次把「正常抑制」误判成「summary 失效」皆因读日志不读 DOM。
- Playwright 自动化注入纪律：验证前必须 reload 后**只注入一次** bundle——重复注入产生双实例（`.IIROSE_MEDIA_CONTAINER` ×2），两份模块级窗口状态（Announce 的 forceDepth/快照栈等）互相独立，行为不可复现地错乱；注入前先断言 `document.querySelectorAll('.IIROSE_MEDIA_CONTAINER').length === 0`，需要换 bundle 版本时先 reload 再注入。

<!-- /bmad:context -->

## 自动播放与真机联调（2026-10-25 实测补充）

- **聊天指令的渲染顺序**：宿站把 `cut` 渲染成 `cut铭铭280  人工智能`——**内容在前、昵称在中、标签在后**。判定「本人发了 cut」要取**昵称之前的正文**去比较，按「文本以 cut 结尾」匹配永远不命中。
- **cut 结束后的状态**：`isShareMediaPlaying()` 变 false、`shareMediaCurrentTime` 变 `-1`、点播者字段仍可能是本人。自动重播必须**在可用性刷新之前**处理，否则「暂无播放内容」会先把已点亮的模式熄灭，重播分支永远走不到。
- **播放需要真实用户手势**：合成 `click()` 不满足自动播放策略，宿站不会起播。自动化必须用 Playwright 的真实点击（坐标点击也可），或在同一 document 内先做一次真实点击再发报文。
- **`browser_reload` 可能没真正重载**：本会话出现过重复注入返回 `already`、却以为已刷新，导致一直测试旧 bundle。改 bundle 后用 `page.reload({ waitUntil: "load" })`，并断言 `.IIROSE_MEDIA_CONTAINER` 不存在再注入。
- **聊天输入框在自动化里是隐藏的**：`#mainHolder` 与 `#msgholderDisplay` 为 `display:none`，`#moveinput` 尺寸为 0。要先置 `display:block` 并给输入框尺寸，`focus()` 成功后才能用真实键盘输入。
- **本地 HTTP 注入会被 CSP 拦**：`fetch("http://127.0.0.1:.../bundle.js")` 在 messages.html 里报 `Failed to fetch`。可行方式仍是把 bundle 源码内嵌进 Playwright 代码文件，在 `messages.html` frame 里 `new Function(src)()` 执行。
- **房间的媒体能力不同**：`window.mediaShareRoom` 为 false 的房间（如「空间站」）发点播报文不起播；「练歌房」这类视频分享房可播，且对普通账号（`identity=0`/`rank=4`）开放。
- **重播用缓存报文本身是有效的**：同曲重发 `m__4` 卡片 + `&1` 报文能让宿站重新起播（用户实测 + 本地复现）。报文缓存按房间落在 `sessionStorage` 的 `imwMediaPayload`，刷新后恢复；命中校验房间与 6 小时有效期。

## 提交纪律

- **格式化不得与功能改动混提**：全仓 prettier 归一已于 2026-10-20 完成（`style: normalize formatting across src with prettier`），此后不再出现「功能 diff 混入整文件重排」污染审查面（spec-request-announce-modes 复盘 F13：406 行格式化噪声曾两度稀释审查）。需要重排/格式化时单独提交，前缀 `style:`。
- prettier 用默认配置（无 `.prettierrc`）；提交前可疑文件先 `prettier --check`，别顺手 `--write` 未触达的文件。

## BMAD 流程约定

- **defer 一项能力必须同轮改契约**：把某条能力推迟、降级或标为非目标时，必须在同一轮内同步改写 `_bmad-output/specs/**` 下的 SPEC 与 companion（例如 `sync-protocol.md`），写清「未实现 / 非目标 / 计划轮次」。只在代码或 deferred-work 里记一句，会让下一轮复盘把「文档已承诺、代码未实现」重新判成缺陷（见 `spec-favorites-cloud-sync` 第 2 轮复盘 R2-2/R2-8）。
