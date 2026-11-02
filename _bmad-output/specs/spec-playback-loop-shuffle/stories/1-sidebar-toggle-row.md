---
title: '侧栏开关行与点亮态'
type: 'feature'
created: '2026-10-24'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: '198c01ac903a6f503a45cc6401c6aba9076c51d2'
context:
  - '{project-root}/_bmad-output/specs/spec-playback-loop-shuffle/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-playback-loop-shuffle/sidebar-controls.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 宿站侧栏的 IIROSE-MEDIA-WEB 分组目前只有「播放进度」一个入口，没有任何可常驻的播放模式开关；后续的单曲循环与收藏随机需要一个能承载多个按钮、状态一眼可辨的容器。

**Approach:** 在该分组内新增一行等分按钮（`#imw-playback-controls`），有「播放进度」入口时插其后，否则贴分组末尾；首期放「单曲循环」「收藏随机」两枚点亮式开关，点击只改状态与外观，自动播放行为由后续 story 注入。行内容由注册表驱动，新增按钮只需追加注册项；开关状态由独立状态机持有（互斥单选、可用性与原因）。

## Boundaries & Constraints

**Always:** 复用 `SidebarMediaEntry` 的侧栏适配（同一 MutationObserver，不新增第二个 body 观察器）；行常驻于 IIROSE-MEDIA-WEB 分组内：有媒体行时插在其后，无媒体行时退回 `#functionHolderExtBox` 末尾（分组本身不存在则不创建）；图标自包含（内联 SVG），禁止借用宿站 `mdi-*` 类；触控目标不小于 44×44，断点沿用 `max-[768px]`；暗色由 `isDarkSidebar` 判定的 `data-imw-theme` 驱动，配色复用 `--imw-entry-*` 变量；状态只存内存，刷新即失。

**Never:** 不实现自动播放、报文缓存、收藏读取、权限判定（后续 story）；不改动「播放进度」入口与浮窗；不向公屏或聊天输入框发送内容；不改 `imwPluginSetting`；不新增依赖。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 首次挂载 | 侧栏含 `#shareMediaBox`，媒体在播且时长已知 | 一行两枚按钮，均熄灭、可点 | N/A |
| 互斥切换 | 点亮「循环」后点「随机」 | 随机点亮、循环熄灭，`aria-pressed` 同步 | N/A |
| 再次点击已点亮项 | 点亮态下点同一按钮 | 回到熄灭（模式 none） | N/A |
| 点击后的即时效果 | 点亮任一模式 | 只改状态与外观，不发送任何网络报文（自动行为在后续 story） | N/A |
| 不可用 | 无媒体 / 时长未知 / 连接断开 | 按钮灰化、`aria-disabled="true"`、点亮态清零；点击时 `ShowMessage` 报原因 | 原因文案取 sidebar-controls.md 表 |
| 侧栏重建 | `#functionHolderBox` 被宿站重绘 | 仍只有一个行容器，点亮态保持 | N/A |
| 媒体行消失 | `#shareMediaBox` 被移除 | 行保留并退回分组末尾，两按钮灰化（原因为无当前媒体） | N/A |
| 卸载 | `dispose()` | 行、监听、订阅全部清理 | N/A |
| 暗色侧栏 | `#functionHolder` 背景为暗色 | `data-imw-theme="dark"`，配色可辨 | N/A |
</frozen-after-approval>

## Code Map

- `src/media-progress/SidebarMediaEntry.ts:93-148` -- 侧栏适配与入口插入点（`media.after(this.entry)`）；新增第三参数行元素 + 第四参数 `onMediaChange(present)`（每次 `adapt()` 判定 `#shareMediaBox` 是否存在后回调，首次也回调）；`placeRow()` 负责插入与唯一性
- `src/media-progress/SidebarMediaEntry.test.ts:4-114` -- 现有 fixture 与「重建后只一个入口」断言
- `src/media-progress/HostMediaBridge.ts:79-84,151-165` -- `read()` 的 `connected` 只表示 `readyState === 1`（连接中为 false）；`subscribe()` 立即同步回调 + 250ms 轮询；`instance` 在换房与 `shareMedia` 调用时都会自增，**不能**当房间键
- `src/media-progress/model.ts:4-19` -- `MediaSnapshot` 字段（`connected/duration/playing`），本 story 只用前两个
- `src/page/index.tsx:13-65` -- 组合根：构造 `HostMediaBridge`／`PlaybackMode`／`SidebarPlaybackRow`，把 `onMediaChange` 与 `bridge.subscribe` 接到 `PlaybackMode`
- `src/app.css:47-118` -- `#imw-media-progress-entry` 的变量与 56px 行样式；新行与入口**共享同一段变量声明**（选择器并列），不各自重复
- `src/iirose_func/ShowMessage.ts:1-6` -- `window._alert` 包装，用于不可用原因与自动熄灭提示
- `vitest.config.ts:5-12`、`vitest.setup.ts:1-14` -- jsdom 环境与全局垫片
- `src/media-progress/MediaProgress.test.ts:53-114` -- 既有组合根 harness（`Object.assign(window, host)` + `IMCInit.init`），组合根断言加在这里

## Tasks & Acceptance

**Execution:**
- [x] `src/playback/PlaybackMode.ts` -- 状态机：`mode`、`toggle(kind): void`、`setMediaPresent(present)`、`applySnapshot(snapshot)`、`setAvailability(kind, {enabled, reason})`、`subscribe()`、`dispose()`；可用性派生顺序「媒体不存在 → 连接未就绪/断开 → 时长未知 → 单模式原因」；`dispose` 置 `disposed` 守卫，之后 `toggle`/`applySnapshot` 不再改状态 -- 后续 story 只注入谓词与动作
- [x] `src/playback/SidebarPlaybackRow.ts` -- 行渲染：注册表驱动、内联 SVG、`aria-pressed`、`aria-disabled` + 点击提示、`data-imw-mode` 白名单守卫（非 `loop`/`shuffle` 直接 return）、上一帧 pressed 转为不可用时提示一次原因（10 秒同因去重）、`data-imw-theme` 继承 -- 纯 DOM
- [x] `src/media-progress/SidebarMediaEntry.ts` -- 第三参数行元素 + 第四参数 `onMediaChange`；行常驻（入口后 / 分组末尾），始终复用同一元素 -- 复用既有观察器
- [x] `src/app.css` -- `#imw-media-progress-entry, #imw-playback-controls` 共享变量与字体声明；新增行样式：等分、56px、`min-height:44px`、点亮态、灰化态（与入口 `:disabled` 同一份不可用视觉）、分隔线颜色变量、暗色覆盖 -- Tailwind 无法作用于宿站 DOM
- [x] `src/page/index.tsx` -- 接线：`onMediaChange → playback.setMediaPresent`、`bridge.subscribe → applySnapshot`；`dispose` 顺序保持 unsubscribe → playback → sidebar → row → bridge -- 唯一组合根
- [x] `src/playback/PlaybackMode.test.ts`、`src/playback/SidebarPlaybackRow.test.ts` -- 覆盖矩阵各行：互斥、再次点击熄灭、点击零发送（断言未构造 socket/报文）、媒体不存在灰化、自动熄灭提示一次并去重、守卫、`dispose` 后不再改状态；共享一份 `snapshot()` fixture 并用 `import type` -- 纯 jsdom
- [x] `src/media-progress/SidebarMediaEntry.test.ts` -- 行常驻/唯一/暗色继承/无媒体时 `onMediaChange(false)` 断言
- [x] `src/media-progress/MediaProgress.test.ts` -- 组合根断言：初始化后 `#imw-playback-controls` 在侧栏内；`window.socket.readyState = 3` 推进 250ms 后两按钮 `aria-disabled="true"`；`dispose` 后行移除且 `vi.getTimerCount()` 为 0 -- 防「装配掉线仍全绿」

**Acceptance Criteria:**
- Given 有当前媒体且时长已知，when 打开宿站侧栏，then 一行两枚按钮可见、均熄灭、触控目标 ≥44×44
- Given 已点亮循环，when 点击随机，then 循环自动熄灭且两枚按钮的 `aria-pressed` 与视觉同时更新
- Given 连接未就绪、连接断开或时长未知，when 快照刷新，then 按钮灰化并 `aria-disabled="true"`，点击弹出对应原因，点亮态清零
- Given 当前无媒体（`#shareMediaBox` 不存在），when 侧栏适配运行，then 行仍在分组内、两按钮灰化且不可点亮
- Given 已点亮循环且媒体消失，when 状态转为不可用，then 点亮态清零并提示一次原因，同因提示 10 秒内不重复
- Given 侧栏被宿站重绘两次，when 观察 DOM，then `#imw-playback-controls` 始终恰好一个，点亮态不丢
- Given 执行 `dispose()`，when 检查 DOM 与订阅，then 行已移除、无遗留定时器，且状态机不再响应后续快照

## Verification

**Commands:**
- `npm test` -- expected: 全部通过，含 `PlaybackMode`／`SidebarPlaybackRow`／`SidebarMediaEntry`／`MediaProgress` 组合根用例
- `npm run build` -- expected: `tsc -b` 无错误，`dist/bundle.js` 产出

**Manual checks (if no CLI):**
- 浏览器注入 `dist/bundle.js` 后打开侧栏：一行两枚按钮，点击互斥点亮，暗色主题下配色可辨

## Implementation Notes

- 媒体存在性经 `SidebarMediaEntry` 第四参数 `onMediaChange` 回报，而不是从快照推断：删卡后宿站可能保留 `shareMediaDuration`，只看时长会误判可用。
- 未收到任何快照前按时长未知处理（不承诺可用），避免首帧先亮一下就灰；连接文案统一为「连接未就绪或已断开」，覆盖 readyState 0 与断线两种情形。
- 自动熄灭提示在行内由「上一帧 pressed=true → 本帧不可用」推导，不向状态机引入 `clearedBy` 字段；同因提示 10 秒窗口与点击提示共用。
- `app.css` 的 `--imw-entry-*` 变量与字体声明改为入口与开关行并列共享，新增 `--imw-entry-accent/pressed/divider`；灰化与入口 `:disabled` 合成一份规则（`opacity:.5`）。
- 组合根断言落在 `MediaProgress.test.ts` 既有 harness：行在侧栏内、`readyState=3` 推进 250ms 后两按钮 `aria-disabled="true"`、卸载后行移除且 `getTimerCount()` 为 0。
- 本轮为重派生：先前实现提交 3697e7f 已被 ab42142 revert，当前实现为 920eeaf。
- 留给 story 2：跨实例幂等（重复注入的同名 id）与换房熄灭，已记入 deferred-work.md。

## Spec Change Log

### 回环 1（bad_spec，2026-10-24）

- **触发发现**：`#shareMediaBox` 消失后按钮仍可用可点亮（矩阵行要求灰化，代码只按 `connected`/`duration` 派生可用性）；自动熄灭只清状态、不按 `sidebar-controls.md` 提示原因；组合根 `src/page/index.tsx` 的装配无任何测试（删掉 `bridge.subscribe` 仍全绿）；测试声称「覆盖矩阵全部行」但无媒体灰化、无网络零发送、分组缺失等行没有断言。
- **修正**：Code Map 补「媒体存在性」信号来源与 `onMediaChange` 回调；Tasks 补组合根测试、自动熄灭提示、点击提示去重、`data-imw-mode` 守卫、CSS 变量合并、`dispose` 守卫、`import type`、共享 snapshot fixture；Verification 补组合根断言；companion 断开文案改为「连接未就绪或已断开，暂时无法调整」。
- **避免的已知坏状态**：侧栏已无当前媒体但按钮亮着可点（违反 `sidebar-controls.md` 的「亮着但不工作」禁令）；桥接订阅或行元素漏接时无人发现。
- **KEEP（必须存活到重派生）**：注册表驱动的行渲染、`aria-disabled` + 点击提示、`placeRow` 常驻与唯一性、按状态签名去重发布、主题继承与互斥/清零点亮的既有断言。

## Review Triage Log

| 发现 | 判定 | 路由 | 证据 |
| --- | --- | --- | --- |
| 已点亮但转为不可用时未提示原因（blind#1） | medium | bad_spec | `PlaybackMode.settle()` 只改 `current`；`sidebar-controls.md` 要求「先熄灭并提示一次」，矩阵与测试同时漏掉 |
| `settle()` 不暴露「谁清灭了点亮」（blind#2） | low | bad_spec | 行内可由「上一帧 pressed=true 且当前 disabled」自行推导，无需改状态机；并入改版任务 |
| 跨实例幂等缺失、重复 id（blind#3） | medium | defer | `placeRow` 只比较兄弟节点；单实例属 story 2（`ownership-and-lifecycle.md`），story 1 不认领 |
| 不可用点击提示无 10 秒去重（blind#4） | low | patch | 连续点灰化按钮会连弹 `ShowMessage`；companion 反馈节要求同因去重 |
| `data-imw-mode` 断言未做运行时守卫（blind#5、edge#3） | low | patch | DOM 残留或注册表改名时 `state[kind]` 为 undefined 会抛 TypeError；改两行守卫即可 |
| 待命原因移动端不可达（blind#6） | false | — | 生产代码无 `setAvailability({enabled:true})` 调用方，该分支当前不可达；待命语义属 story 2 |
| 待命态与生效态视觉相同（blind#7） | false | — | 同上，点亮 + enabled=true 的组合在本 story 不可达 |
| CSS 变量与字体栈重复声明（blind#8） | low | patch | `#imw-playback-controls` 重抄 `--imw-entry-*` 与字体栈，改一处必漏一处 |
| 分隔线颜色硬编码（blind#9） | low | patch | `border-left` 用固定 rgba，深色侧栏可见度无变量控制 |
| 灰化样式与既有入口不一致、对比度偏低（blind#10） | low | patch | `opacity:.45` 叠 13px 文字约 2:1；不可用控件按 WCAG 属豁免，但应统一为一份样式 |
| `toggle()` 布尔返回无语义（blind#11、verify-other#2） | low | patch | 关闭与「不可用拒绝」都返回 false，生产调用方忽略返回值；改 `void` 或补注释 |
| `dispose()` 后仍可切换状态（blind#12） | low | patch | `dispose` 只清订阅，`toggle` 仍改状态；补 `disposed` 守卫 |
| 矩阵/AC 覆盖声明与实际不符（blind#13、edge#2） | medium | bad_spec | 无媒体灰化、分组缺失、点击零网络、dispose 无遗留定时器均无断言；Task 已写明「覆盖全部行」 |
| 两处重复 `snapshot()` 工厂（blind#14） | low | patch | 15 字段手工构造两份，加字段要改两处；抽共享 fixture |
| 类型导入未用 `import type`（blind#15） | low | patch | 与 `src/storage/**`、`SettingsService` 的既有风格不一致 |
| 连接中（readyState 0）报「已断开」（blind#16） | low | patch | `HostMediaBridge.connected` 只看 readyState===1，首帧同步回调会显示不成立的文案；文案改为「连接未就绪或已断开」 |
| 媒体行消失后按钮仍可用可点亮（edge#1、verify#2） | medium | bad_spec | 可用性只由 `connected`/`duration` 派生，没有媒体存在性信号；删卡后宿站仍可能保留 `shareMediaDuration` |
| 组合根装配无测试（verify#1） | medium | bad_spec | 删掉 `bridge.subscribe` 或第三参数后 318 用例仍全绿，说明装配未被覆盖 |
| 换房不熄灭（verify-other#1） | medium | defer | `applySnapshot` 不观察房间标识；`HostMediaBridge.instance` 在 `shareMedia` 调用时也会自增，不能直接当房间键；属 story 2 |
| 5 条原因只实现 2 条，companion 未标注延期（blind#1/§1） | medium | defer | 权限/收藏/他人点播原因由 story 2/3 产生；按项目约定同轮在 `sidebar-controls.md` 标注「未实现」并补 deferred-work |
| 注册表只承载布局，新增模式仍需改状态机（blind#3、edge#3） | low | patch | `CONTROLS` 只有 mode/id/label/icon，`isPlaybackModeKind` 硬编码两种；改注释并把白名单从注册表派生 |
| 组合根测试测不到 `onMediaChange` 接线（blind#4、verify#1） | medium | patch | 删掉第四实参后 172 用例仍全绿；补「删卡 → 灰化 + 退回分组末尾」断言 |
| 「分组缺失」矩阵行无断言（blind#5） | low | patch | 无测试构造缺 `#functionHolderExtBox` 的文档；随 `!box` 修正一并断言 |
| `!box` 早退跳过 `onMediaChange`，分组消失后 present 仍为 true（blind#6、edge#1） | medium | patch | `adapt()` 在 `if (!box) return` 前没有回报；点亮态跨分组消失存活 |
| `onMediaChange` 语义含糊（每次 adapt 都触发、构造期同步触发）（blind#7） | low | patch | 测试里 changes 为 `[true,true,true]`；改名或补注释 |
| `ShowMessage` 在 `_alert` 缺失时静默、无 `aria-live`（blind#8） | low | patch | 宿主未初始化时自动熄灭无提示；行加 `role="status"` 承载原因文本 |
| 禁用按钮的可聚焦/Tab/Enter 未断言（blind#9） | low | patch | 现有用例一律 `.click()`；补 `Enter` 与 `tabIndex` 断言 |
| `title` 重复标签、待命态无视觉（blind#10） | false | — | 待命（enabled=true + reason）在本 story 生产代码不可达；story 2 才设计中间态 |
| 循环图标用 repeat 而非 repeat-once（blind#11） | low | patch | 语义不符；换单箭头循环路径即可 |
| `present` 默认 true 与 `duration` 默认 null 不一致（blind#12） | low | patch | 依赖每次 adapt 回调兜底；改默认 false 并注释 |
| `notices` 映射不清理（blind#13） | false | — | 键为固定几条原因文案，会话内增长可忽略；清理属过度设计 |
| 行元素双所有者、订阅延后释放（blind#14） | low | patch | `SidebarMediaEntry.dispose` 与 `Row.dispose` 都删节点；改为适配器只 detach，行自己 remove |
| `SidebarPlaybackRow.dispose` 无 disposed 守卫（blind#15） | low | patch | 卸载后仍可写 aria 到游离节点 |
| 窄侧栏下按钮文字被截断为「单曲…/收藏…」（blind#16） | medium | patch | 13px + 20px 图标 + 内边距在 ~70px 按钮内只容两字；窄宽度改图标优先（文字 `display:none` 于 ≤120px 容器查询或 `max-width` 媒体查询） |
| 行高 56px 重复三处（blind#17） | low | patch | 入口/行/按钮各自写字面量；抽 `--imw-row-height` |
| `fixtures.ts` 放在生产源码树（blind#18） | false | — | 仅测试引用，构建时被摇树；仓库既有测试也在 `src/` 下 |
| 跨模块自动熄灭链路无端到端断言（blind#19） | medium | patch | 各段单测互不相连；在组合根用例里断言点亮→删卡→熄灭并提示一次 |
| 桥接 250ms 轮询常驻（edge#2） | low | false | 常驻订阅是本 story 的可用性数据源，面板未开也需维护行状态；降频属后续性能优化 |

## Design Notes

行元素由 `SidebarMediaEntry` 挂载而不是另起 `MutationObserver`：现有适配已处理侧栏重绘、主题与卸载，再开一个 body 观察器会重复触发并引入插入顺序竞态。状态机与渲染分离，后续 story 只注入可用性谓词与动作，不再改 UI。

