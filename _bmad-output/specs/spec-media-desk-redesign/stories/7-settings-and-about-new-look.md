---
title: '设置与关于换新外观'
type: 'feature'
created: '2026-10-30'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '2fb565ff87ad0da0eff0dc0164f4c56552027e9d'
context:
  - '{project-root}/_bmad-output/specs/spec-media-desk-redesign/SPEC.md'
  - '{project-root}/_bmad-output/initiative-media-desk-redesign/ux-media-desk/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-media-desk-redesign/ux-media-desk/EXPERIENCE.md'
  - '{project-root}/_bmad-output/specs/spec-media-desk-redesign/brownfield.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** 设置页与关于页还是前轮外观：`SettingCard` 用 `themedCard`/`accentText` 与宿站弹窗式的 200px 卡片，图标是宿站 `mdi-*` 字形，开关是 `mdi-toggle-switch` 图形，关于页「项目源代码地址」的值写成「GitHub 🔗」带 emoji；设置的范围标签是摊平的六个子分组。SPEC CAP-11 要求的「平台分组作范围标签 + 每个子分组一张设置组卡 + `role="switch"` 开关 + 外链图标」都未落地。

**Approach:** 把设置数据升级成「组 → 行」两级结构（`SettingGroupData[]`），按现有平台分组作范围标签、子分组作组卡，用新组件 `settings-group` / `settings-row` / `settings-switch` / `about-card` 全面替换 `SettingCard`；所有既有设置项与动作原样保留（取值类继续调宿站选择弹窗），只把 `代理蔷薇@输入` 与 `云端同步` 两行的值位换成 `role="switch"` 开关，关于页外链换成自包含外链图标。

## Boundaries & Constraints

**Always:** 现有设置项一项不少，动作与确认步骤不改（取值类仍走宿站选择/输入弹窗）；行语义由数据来源声明（值 / 开关 / 动作 / 只读），渲染层不按 key 或中文文案猜；`云端同步` 开关的 `checked` 只取自 `SyncManager.getState().enabled`（流程完成后才为开，取消/失败保持关）；`代理蔷薇@输入` 开关按现有 `imwPluginSetting` 写入并即时生效；关于页四项与动作不变，外链值用蔷薇红文字 + 外链图标、不用 emoji；令牌只取 `tokens.ts`（不裸写颜色 / `rgba` / `themed*` / `accentVar`），图标一律自包含内联 SVG（不借宿站 `mdi-*`）；断点 `max-[768px]`，手机可点目标 ≥44px；设置与关于仍不分页、无搜索栏。

**Never:** 不改宿站弹窗、宿站提示层与 `buildSelect2` 的取值流程；不改云同步业务规则（口令、合并确认、墓碑、上传时机）；不新增设置项或关于条目；不改 `src/platforms/About.ts` 的投喂/赞助/作者弹窗内容；不做独立主题开关；不为设置页引入加载态或骨架；不改收藏随机面板与播放进度浮窗（story 8）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 设置范围切换 | 桌面设置模式点「哔哩哔哩视频」 | 结果区显示「账号」与「视频设置」两张组卡，卡内行按现有项 | — |
| 手机设置末项 | ≤768px 打开设置 | 范围标签为 哔哩哔哩视频 · 网易云音乐 · 无线电广播 · 插件设置 · 关于；桌面不含「关于」 | — |
| 取值行 | 点「点播的视频画质」整行 | 调用现有动作打开宿站选择弹窗，确认后行末值即时更新，无「保存」 | 取消则值不变 |
| 开关行即时切换 | 点「代理蔷薇@输入」 | `imwPluginSetting.chatBox.isProxyAtInput` 翻转并落盘，`aria-checked` 同步，`Input_Behavior_Module` 重装 | 存储不可用时不抛错 |
| 云同步启用 | 点「云端同步」开关，口令 + 合并确认全流程完成 | 开关变开，其后出现「同步状态 / 上次同步时间 / …」行 | 取消、口令错误或预览失败：开关保持关 |
| 只读行 | 「上次同步时间」「同步状态」 | 值位显示现有文字，无 chev、不可点 | — |
| 动作行 | 点「清空云端」 | 现有确认弹窗 → 现有动作 | 现有提示 |
| 关于外链 | 点「项目源代码地址」 | 新窗口打开 GitHub；值位「GitHub」+ 外链图标 | — |
| 未登录 / 未启用 | 游客态；同步未启用 | 值位分别为「未登录账号」「未启用」，行可点并由现有逻辑提示原因 | 现有 `ShowMessage` |

</intent-contract>

## Code Map

- `src/page/components/SettingCard.tsx:1-90` -- 旧设置卡（`themedCard`/`accentText`/`mdi-*` 字形 200px 卡）；被新组件取代后整体删除，`SettingCard.test.ts` 一并删除。
- `src/page/components/media-card-container/ResultsArea.tsx:63-64` `settingsGridClass`、`:304-314` `shape==="settings"` 分支（渲染 `settingsData.map(SettingCard)`）、`:75` `shapeOf` 把设置/关于都归 `settings` -- 改为按组渲染组卡，删除网格类与 `SettingCard` 引用。
- `src/page/components/media-card-container/…` 其它形态不受影响；设置页无 `mediaData`、无骨架、无分页。
- `src/page/MainAppContainerServices/SettingsService.ts:23-31`（账号）、`:43-79`（视频五项）、`:90-114`（音乐三项）、`:122-130`（电台）、`:148-228`（插件四项，其中 `:144-146` `isProxyAtInputInText` 是 mdi 值、`:164-227` 用 `ctx.setState` 回写 mdi 图标）、`:236-243` `showSyncSettings`（唯一入口 + 订阅）、`:245-405` `buildSyncSettings`（7 行，`syncEnabled` 的 `actionTitle` 已由 `enabled` 派生）、`:407-495` `previewThenEnable` / `confirmMerge`（口令 + 合并两段流程，保留不动）、`:504-516` `release` / `setState`（`setState` 会先清订阅）。
- `src/page/MainAppContainerServices/AboutService.ts:14-52` -- 关于四项；`:28` 值「GitHub 🔗」带 emoji；`:20-24` 作者项先关面板再开用户卡。
- `src/platforms/About.ts:1-82` -- 投喂/赞助/作者宿站弹窗与 `generatePic`，本 story 不动。
- `src/settings/pluginSettings/PluginSettings.ts:45-64` -- `isProxyAtInputSetting` 现在通过 `changeActionTitleAction` 回报 mdi 字形；改为回报布尔（唯一调用点是 `SettingsService`）。`:66-118` `setDefaultPage`、`:163-207` `setAnnounceMode` 是取值类宿站弹窗（保留，含 `announce*` 图标码点）。
- `src/types/Card/SettingData.d.ts:1-9` -- 全局 `SettingData`（`key`/`title`/`actionTitle`/`icon`/`action`）；新增行类型与组类型。
- `src/types/page/props-and-state/MainAppContainer.d.ts:29` -- `settingsData: SettingData[] | null`，同步改组数组。
- `src/types/platforms.d.ts:58-62` -- `subNavBarItems` 项类型；加 `phoneOnly?: boolean`（手机专属范围标签）。
- `src/page/MainAppContainer.tsx:1077-1148` -- 设置/关于分类（六个摊平子分组）；`:315-319` scopes 派生、`:394-408` `ScopeRow`、`:73`/`:556` `settingsData` 快照、`:567-600` `applyMode`（`:571` 离开设置释放订阅、`:597` 回到设置重跑）。
- `src/page/components/desk/ScopeRow.tsx` -- 范围标签（`tablist`、手机横滚），无需改动。
- `src/page/components/floating-panel/tokens.ts:17-100`（`deskSheet`/`deskRule`/`deskInk*`/`deskRose*`/`deskHover`/`deskPressTone`）、`:135-205`（`typeLabel*`/`typeButtonSm`/`rounded*`/`deskGutter`/`touchMin`/`deskFocusRing*`）、`:229-301` `DeskIcon` -- 令牌唯一来源；设置行图标需补一组自包含 SVG（`send` 已在 DESIGN symbol 表但未实现）。
- `src/app.css:337-405` -- mdi 码点表：`syncCloudIcon`/`syncKeyIcon`/`syncClockIcon`/`syncRefreshIcon`/`syncDeleteIcon`/`listViewIcon`/`cardViewIcon` 在替换后无引用（先 grep 确认）→ 删除；`announce*`（宿站弹窗用）与 `imwMode*`（默认页面弹窗）保留。
- `src/playback/PanelFocus.ts` -- `setPanelFocus({category, platform})` 只关心模式与来源下标，设置范围下标变化不影响。
- 测试面：`src/page/components/SettingCard.test.ts`（删除）、`src/page/MainAppContainerServices/SettingsService.test.ts:1-26`（只验「无 shuffleIncludeCollections」）、`src/page/MainAppContainer.test.ts:25-33`（settings mock，含 `showSyncSettings`）、`:482-502`（设置重跑与关于无搜索栏）。
- 参照实现：`src/page/components/action-sheet/ActionSheet.tsx`（整行选项、`stopHostGestures`、焦点环用量）、`src/page/components/room-deck/DeckToggle` 一类开关的 `aria-pressed` 写法与 `deskRoseSolid`/`deskOnRose` 用法。

## Tasks & Acceptance

**Execution:**
- `src/types/Card/SettingData.d.ts` -- `SettingData` 加 `kind?: "value" | "switch" | "action" | "readonly"`（默认 `value`）、`checked?: boolean`、`external?: boolean`，`action` 回调扩为 `(actionTitle?: string, checked?: boolean) => void`；新增 `SettingGroupData { title: string; items: SettingData[] }` -- 行语义与两级结构在类型上定死，渲染层不必猜。
- `src/types/page/props-and-state/MainAppContainer.d.ts` -- `settingsData: SettingGroupData[] | null` -- 与组结构一致。
- `src/types/platforms.d.ts` -- `subNavBarItems` 项加 `phoneOnly?: boolean` -- 手机专属「关于」标签。
- `src/page/components/floating-panel/tokens.ts` -- `DeskIconName` 补设置/关于所需字形（`send` 与账号、时钟、扳手、代码、布局、@、云、钥匙、刷新、删除、咖啡、赞助、GitHub、外链等），描边 1.6–1.9、`currentColor` -- 行图标零 mdi、零 emoji。
- `src/page/components/settings/SettingsGroup.tsx`（新） -- `settings-group` / `about-card` 卡：`deskSheet` 底 + 1px `deskRule` 边 + `roundedLg`，标题 `typeLabelStrong`/`deskInk2` 在上方 8px，卡内行为 `SettingsRow`，卡间 24px；`about-card` 同一组件的外链变体 -- CAP-11 组卡。
- `src/page/components/settings/SettingsRow.tsx`（新） -- `settings-row`：≥56px（手机 ≥44px）、左右 16px、行间 1px `deskRule`（末行无）、20px `ink3` 图标 + `typeLabel` 标签 + 右侧值（`ink2`、单行截断、值类加 `chev` / 外链行蔷薇红 + 外链图标）；值类与动作类为 `<button>`（`deskPressTone` + `deskFocusRing`），只读类为不可点的静态行；开关行整行即 `role="switch"` + `aria-checked` -- CAP-11 行。
- `src/page/components/settings/SettingsSwitch.tsx`（新） -- `settings-switch` 轨道 36×20 `rounded-full`：关态 `deskSheet` 底 + 1.5px `ink3` 描边 + 14px `ink3` 圆钮，开态 `deskRoseSolid` + `deskOnRose` 圆钮；装饰性、不自己管事件（行负责），点击区靠整行 -- CAP-11 开关。
- `src/page/components/media-card-container/ResultsArea.tsx` -- 设置/关于分支改为按 `settingsData` 组渲染 `SettingsGroup` / `AboutCard`（`deskGutter` + 纵向 24px、最大宽度收敛），删 `settingsGridClass` 与 `SettingCard` 导入 -- 组卡页面。
- `src/page/components/SettingCard.tsx` -- 删除（连同 `.test.ts`） -- 死码清理。
- `src/page/MainAppContainerServices/SettingsService.ts` -- 改造成组结构：`showBilibili`（账号 + 视频设置两张卡，合并现 `showBilibiliAccount` / `showBilibiliVideo`）、`showNetEaseMusic`、`showRadio`、`showPluginSettings`（聊天框 + 云端同步两张卡，并接管同步状态订阅与刷新：`setState` 后 `onStateChange` 重跑自身，离开设置时 `release`）；每行按上表填 `kind`/`checked`/`external` 与自包含图标名；`syncEnabled` 为 `switch` 且 `checked = SyncManager.getState().enabled`，动作不回报 `checked`；`proxyAtInput` 为 `switch`，动作回传新值；`syncStatus`/`syncLastSyncAt` 为 `readonly`；`showSyncSettings` 不再作为独立范围存在（其构建逻辑内联为 `buildSyncGroup`） -- CAP-11 全部设置项存活。
- `src/settings/pluginSettings/PluginSettings.ts` -- `isProxyAtInputSetting` 的首参改为 `onChange?: (checked: boolean) => void`，回报翻转后的布尔（不再拼 mdi 字形），其余逻辑不动 -- 开关状态单一来源。
- `src/page/MainAppContainerServices/AboutService.ts` -- 关于四项改一组 `about-card` 数据：`icon` 换自包含图标名，`aboutSource` 的 `actionTitle` 改「GitHub」并加 `external: true`；作者/投喂/赞助的 `action` 原样 -- CAP-11 关于卡。
- `src/page/MainAppContainer.tsx` -- 设置分类改为四个平台分组范围（哔哩哔哩视频 / 网易云音乐 / 无线电广播 / 插件设置），第五项「关于」标 `phoneOnly` 且渲染期按 `isPhone()` 过滤；关于分类保持独立模式 -- CAP-11 范围标签。
- `src/page/components/settings/settingsPage.test.ts`（新） -- 覆盖 I/O 矩阵：组卡令牌与标题、值行值 + chev、开关行 `role="switch"`/`aria-checked` 与「动作未回报时保持关」、只读行不可点无 chev、外链行蔷薇红 + 外链图标且源码无 emoji / `mdi-` / `rgba(` / `themed` -- 组件契约。
- `src/page/MainAppContainerServices/SettingsService.test.ts` -- 断言四个范围的分组标题与关键行 `kind`（含 `syncEnabled.checked` 随 `SyncManager.getState().enabled`）、关于四项的 `external` 与外链值无 emoji -- 数据契约。
- `src/page/MainAppContainer.test.ts` -- settings mock 换成 `showBilibili` 等新入口、删 `showSyncSettings`；断言桌面设置四个范围、手机五个（末项关于）、关于模式无搜索栏 -- 范围标签契约。
- `src/app.css` -- 删替换后无引用的 mdi 码点（`sync*`、`listViewIcon`、`cardViewIcon`），保留 `announce*` 与 `imwMode*` -- 死码清理。

**Acceptance Criteria:**
- Given 桌面宽度 >768px 且已进设置模式，when 观察范围行，then 只有哔哩哔哩视频 / 网易云音乐 / 无线电广播 / 插件设置四项，无「关于」。
- Given 手机宽度 ≤768px 且已进设置模式，when 观察范围行，then 末项为「关于」，点它显示关于卡。
- Given 任一设置范围，when 观察结果区，then 每个子分组一张组卡（纸底抬升面、细线描边、`lg` 圆角），组卡宽随内容区收敛、卡间 24px。
- Given「代理蔷薇@输入」行，when 点整行，then 开关即时翻转、`aria-checked` 更新、`imwPluginSetting` 落盘，刷新页面后仍为原值。
- Given 同步未启用，when 走完启用全流程，then 开关变开并出现后续同步行；可从「启用」中途取消并确认开关仍为关。
- Given「上次同步时间」行，when 用键盘 Tab 与鼠标尝试，then 该行不可聚焦、不可点、无 chev。
- Given「项目源代码地址」行，when 观察该行，then 值位为蔷薇红「GitHub」+ 外链图标（无 emoji），点击在新窗口打开仓库地址。
- Given 全部改动，when 运行 `npm test` 与 `npm run build`，then 两者通过；`src/page/components/settings/` 与 `ResultsArea.tsx` 源码不出现 `rgba(` / `themed` / `accentVar` / `mdi-`。

## Spec Change Log

## Review Triage Log

### 2026-10-30 — Review pass
- verdicts: 39 findings — high 0, medium 13, low 23, false 3, maybe-false 0
- findings:
  - `[low]` `[patch]` 手机在设置内点「关于」时仍走 `MODE.settings` 分支，关于数据被渲染成带组名的组卡，与桌面 `AboutCard` 两条路径 — 改为一处渲染：关于组 `title` 为空即出 `AboutCard`（`SettingsCards` 分派），手机与桌面同一张无组名卡，容器用例断言 `data-imw-about-card`。
  - `[medium]` `[patch]` 手机从「插件设置」切到「关于」范围时 `SyncManager.onStateChange` 订阅仍活着，之后任何同步状态变化都会把关于卡换成插件组卡 — 「关于」范围动作先 `SettingsService.release()`；用例断言 `release` 先于 `showAbout`。
  - `[low]` `[reject]` `syncStatus` 改只读后 `SyncManager.getStatus().message` 不再可达（`getStatus` 成为死代码） — 只读化正是 I/O 矩阵「只读行不可点」的要求；失败原因仍可经「立即同步」的 `ShowMessage(res.message)` 读到，改回可点会违背矩阵。
  - `[low]` `[patch]` 只读行（同步状态）文字变化无 `aria-live`，读屏用户听不到「同步中… → 正常」 — 只读行补 `aria-live="polite"`，并加「值随数据更新」用例。
  - `[low]` `[reject]` 同步状态行与「立即同步」共用 `refresh` 图标 — 纯外观重合，改需新增字形；两行语义由能否点击与值位文字区分，日常不构成误认。
  - `[false]` `[reject]` 行 key 用 `${index}:${key}` 会在云同步组增删 `syncStatus` 时让行内 state 错位 — key 含 `item.key`，被替换的行不可能与旧行同 key，Preact 只会卸载重挂并按 props 重新初始化，实测错位不会发生。
  - `[medium]` `[patch]` `SettingData.icon` 是 `string`，渲染处 `as DeskIconName` 强转，拼错的图标名静默渲染空 SVG，而测试用的是手抄名单恒真 — 导出 `DESK_ICON_NAMES` / `isDeskIconName`，渲染回退 `info`，并在 `SettingsService.test.ts` 断言五个服务实际产出的每个 `icon` 都属于该集合。
  - `[false]` `[reject]` 开关本身没有 44px 点击区，与 DESIGN `settings-switch.hit-area` 冲突 — 整行即 `role="switch"` 按钮（≥56px / 手机 ≥44px），开关是行内装饰，唯一的指针目标是整行，`hit-area` 的要求在行上已满足。
  - `[low]` `[patch]` 组卡 `overflow-hidden` 会裁掉行 `outline-offset-2` 的焦点环左右两侧 — 卡片去掉裁切，改由首/末行承担 12px 圆角，焦点环与悬停底都不越界。
  - `[medium]` `[patch]` 私有 `isPhone()` 与 `mediaFormat.isPhoneLayout()` 重复；且停在手机专属「关于」（下标 4）时视口越过 768px，桌面只剩 4 个标签而 `activeIndex` 仍是 4，`ScopeRow` 无 `tabIndex=0`，tablist 键盘不可达 — 复用 `isPhoneLayout()`，传给 `ScopeRow` 的下标夹到 `scopes.length-1`，并加越界用例。
  - `[low]` `[defer]` `showPluginSettings` 异步化后 `PluginSettings.getPluginSetting()` 的裸 `JSON.parse` 失败会变成静默 rejection（设置区空白） — 该 `JSON.parse` 无守卫是本轮之前就有的（旧同步实现会同步抛错，用户可见结果相同），不属本 story 引入。
  - `[low]` `[reject]` 插件设置范围异步读取期间会闪一帧上一范围的卡、首次进入空白一 tick — `hasLocalKey()` 是单键 IDB 读，窗口为毫秒级；加加载态正是 intent 明令禁止的「设置页不引入加载态或骨架」。
  - `[low]` `[reject]` `AboutCard` 用 `flatMap` 合并所有组，将来拆两张卡会静默丢组名 — 关于数据当前恒为一组，`AboutService` 也只产出一组；为不可达状态加结构校验属于推测性改动。
  - `[low]` `[patch]` 三处测试断言弱：只读行「点击无动作」无 spy、`render(null, host)` 未包 `act`、手机「关于」只断言 `showAbout` 被调用 — 补齐 spy 断言、`act` 包裹与关于卡的 DOM 断言（见上面两条 patch 的用例）。
  - `[false]` `[reject]` `?raw` 源码 grep 式断言太脆（注释里出现 `mdi-` 就红） — 这是本仓既有且统一的哨兵写法（`mediaCards` / `roomDeck` / `actionSheet` / `episodePicker` 测试同构），删掉它会让「组件源码零裸值 / 零 emoji」失去守卫。
  - `[medium]` `[patch]` 订阅 / 重订阅顺序与迟到 `refresh` 无用例，迟到的异步结果会覆盖当前范围并在 `release` 之后复活订阅 — `SettingsService` 加静态 `revision`（`setState`/`release` 自增），`showPluginSettings` 落地前比对，变了就丢弃且不重订阅；用例覆盖「切走后迟到结果不落地」。
  - `[low]` `[defer]` AGENTS.md 仍写「`themed*` 只剩设置卡」、`src/page/components/settings/` 与新令牌未登记 — 修 agent-context 文件的条目按规则一律 defer。
  - `[low]` `[reject]` 手机设置「关于」与独立关于模式的 `searchAction` 抄了两份 — 两行字面量重复、各自独立可达，抽方法只会多一层间接；改一处漏一处的前提是有人只改一侧，现无其他消费点。
  - `[low]` `[reject]` `SettingData` 缺不变量（`kind:"value"` 无 `action` 会渲染成可点死行） — 全部生产点都带 `action`；改判别联合会牵动全局 `.d.ts` 与四个服务，收益不抵改动面。
  - `[low]` `[patch]` 手机卡间距 `gap-5`（20px）偏离 DESIGN 的 24px 且无说明 — 去掉手机覆盖，间距一律 24px。
  - `[medium]` `[patch]` 关于范围未解除同步订阅（边盒层同一主张） — 与第 2 条同一次修复。
  - `[medium]` `[patch]` `hasLocalKey()` 未决期间切走范围/离开设置模式，迟到结果覆盖当前卡并在 `release` 后重订阅（边盒层） — 与 `revision` 守卫同一次修复。
  - `[medium]` `[patch]` 越界 `activeIndex` 让 tablist 无 `tabIndex=0`（边盒层） — 下标夹取同一次修复。
  - `[low]` `[defer]` `buildPluginGroups` 抛出（`imwPluginSetting` 损坏）时设置区静默不更新（边盒层） — 同第 11 条：`JSON.parse` 无守卫属既有问题。
  - `[medium]` `[patch]` `item.icon as DeskIconName` 强转 + 无真实数据的图标校验（边盒层） — 与 `DESK_ICON_NAMES` 守卫同一次修复。
  - `[low]` `[reject]` 删除 `syncStatus` 的 action 后同步失败原因不可达（边盒层 deletion 类） — 同第 3 条：矩阵要求只读不可点，「立即同步」仍会弹出 `message`。
  - `[low]` `[patch]` 宣称的「手机点关于显示关于卡」与实现不符（边盒层 claim 类） — 与第 1 条同一次修复。
  - `[medium]` `[patch]` 「代理蔷薇@输入」翻转后 `Input_Behavior_Module.applyBehavior` 的重装无任何断言，删掉也全绿 — 在 `PluginSettings.test.ts` 加两例：翻转时回报布尔且 `applyBehavior` 恰好一次；只传 `onChange` 时不调用。
  - `[medium]` `[patch]` 「图标都在 symbol 表里」守卫读不到真实数据、对任意字符串恒真 — 改为导出图标名集合并遍历服务真实产出（同第 7 条）。
  - `[low]` `[patch]` 「忘记本机密钥」两态与 `hasLocalKey().catch(() => false)` 回退无断言 — 补「无缓存 ⇒ 无本机密钥」与「`hasLocalKey` reject ⇒ 数据仍建得出且退回无本机密钥」两例。
  - `[low]` `[reject]` `syncStatus.message` 失去唯一消费者（验证层 Other） — 同第 3 条裁定。
  - `[medium]` `[patch]` `phoneOnly` 过滤引入两套下标（验证层 Other） — 与下标夹取同一次修复。
  - `[low]` `[reject]` 插件设置范围异步期间闪一帧旧卡（验证层 Other） — 同第 12 条裁定。
  - `[low]` `[reject]` `isProxyAtInputSetting` 的 `try/catch` 把落盘失败吞成静默且无测试（验证层 Other） — 相对旧实现的「写入失败直接抛出打断交互」是改进；为存储配额失败补用例属推测性。
  - `[low]` `[patch]` 意图的三个表面未被连接：服务产出、组件渲染、范围点击各自断言，join 无覆盖 — 容器用例改为让 ResultsArea 桩渲染真实 `SettingsCards`，并断言点「关于」后的 DOM（见第 1、14 条）。
  - `[low]` `[patch]` 「关于」被实现成两条渲染路径，手机那条无渲染断言（意图层） — 与第 1 条同一次修复。
  - `[medium]` `[patch]` 范围过滤是渲染期快照、测试用整环境 `matchMedia` 桩（意图层） — 与第 10 条同一次修复（复用 `isPhoneLayout()` + 下标夹取 + 越界用例）。
  - `[low]` `[patch]` 行为差异：`applyBehavior` 条件化、`syncStatus` 失点击、`searchViewMode` 图标固定、`syncEnabled` 值位与类型注释矛盾（意图层） — 注释已改为与行为一致；`applyBehavior` 补用例（见第 28 条）；`syncStatus` 失点击见第 3 条；`searchViewMode` 图标为装饰字形、值位「列表/卡片」才是语义，不另改。
  - `[medium]` `[patch]` 异步缝隙：迟到覆盖、关于不清订阅、插件设置一 tick 空渲染（意图层） — 与 `revision` 守卫、`release` 接线同一次修复；「一 tick 空渲染」见第 12 条。

### 2026-10-30 — Review pass (follow-up)
- verdicts: 37 findings — high 0, medium 6, low 29, false 2, maybe-false 0
- findings:
  - `[medium]` `[patch]` `phoneOnly` 只在渲染层生效：`runCurrentScope` 仍按未过滤的 `subNavBarItems[SubNavBarIndex]` 解析动作 — 手机停「关于」(下标 4) 后视口越 768px，桌面标签夹回「插件设置」但动作仍是关于；已抽 `visibleScopes()` / `effectiveScopeIndex()` 供渲染、结果区下标与 `runCurrentScope` 共用，实测改前用例红、改后绿。
  - `[low]` `[patch]` 上一轮的代入用例只断言 `aria-selected`，把「标签插件设置、内容关于」固化成了期望 — 同一用例补「切走再回设置后执行的是 `showPluginSettings`、`showAbout` 不再被调」。
  - `[low]` `[patch]` `AboutCard` 注释称「页头已经说明这一屏是「关于」」，手机在设置内进入时页头是「设置」 — 注释改为桌面/手机两条说明路径；渲染不变（卡片内容自证）。
  - `[low]` `[patch]` 同一范围内两次构建交错时先发后到会覆盖后发的（`revision` 只区分换范围/离开） — 加 `buildSeq`（每次构建自增），落地比对 revision 与序号；用例「后发先完成、先发后完成」断言只有最新一次落地。
  - `[medium]` `[patch]` `revision` / `stale` 守卫全无验证（删掉整句测试仍全绿，而上轮 triage 声称已覆盖） — 补「在途时换范围：迟到结果不落地也不重订阅」与「两次构建交错」两例，均先验证删守卫必红。
  - `[low]` `[reject]` `DESK_ICON_NAMES` 是图标名的第三份手抄表 — 与联合类型同源、`ICON_INNER` 由 `Record<DeskIconName,string>` 强制完整；漏登记只在服务真的用该图标时才有害，而「行图标」用例遍历五个服务真实产出并断言 ∈ 该表，漂移当场被抓住。
  - `[low]` `[patch]` 空串组名是「关于卡 / 设置组卡」的唯一判别，设置组标题漏填会静默变关于卡 — 补「四个范围的组名都非空」用例守住判别位；不新增 `variant` 字段（会扩公共类型面）。
  - `[low]` `[reject]` 值位 `max-w-[52%] truncate` 无 `title` — DESIGN `settings-row.value` 明写「单行截断」，值位都是短值（画质、时长、时间戳），加原生 `title` 是设计外新增。
  - `[low]` `[reject]` (carried) 落盘失败仍回报成功 — 与上轮同位置同主张（`isProxyAtInputSetting` 的 `try/catch`）：intent「存储不可用时不抛错」要求吞异常、内存态照常生效，回报翻转值正是该承诺的实现。
  - `[low]` `[reject]` 首/末行圆角写死 `rounded-t-[12px]` 而非令牌 — 与 `roundedLg`（`rounded-[12px]`）同值，视觉无差；改需新增「内圆角」令牌扩设计面，属推测性。
  - `[low]` `[reject]` `settingsData` 有三个写入口（`setState` / `showPluginSettings` / `AboutService`） — 三条路径都在写 `ctx.setState` 前先 release 或自增版本（`applyMode`、手机「关于」范围动作），收敛为单一写入口是重构而非缺陷修复。
  - `[low]` `[patch]` 设置页的容器布局（卡间 24px、`max-w-[760px]`、纵向列）无断言 — `mediaCards` 设置形态用例补 wrapper 类断言。
  - `[low]` `[reject]` DESIGN.md 的 `<symbol>` 清单未登记本轮 15 个新字形 — 该句描述设计稿 symbol 来源，不是 `tokens.ts` 的登记表（AGENTS.md 已声明 `tokens.ts` 为唯一来源、`DESK_ICON_NAMES` 为运行期集合）；补文档不改变任何行为。
  - `[low]` `[reject]` 测试辅助 `groupsOf` 在 `setState` 未调用时抛「Cannot read properties of undefined」 — 只在使用例本体失败时出现，堆栈直指调用行；加前置断言属预防性。
  - `[low]` `[reject]` 手机用例的 `matchMedia` 桩对所有 query 恒真 — 两个用例只经 `isPhoneLayout()` 取媒体特性，恒真桩不改变被断言的分支（`isTapToReveal` 在恒真桩下同样为 false，与手机布局一致）。
  - `[low]` `[reject]` `SettingData` 无 `hint` 行说明位，长解释被压进 `title` — DESIGN 与 `SettingData` 都无行说明位，新增是设计外扩面，且 intent 明令「不新增设置项」。
  - `[false]` `[reject]` 「音乐的音质 - 已废弃」仍可正常编辑，新外观让它更正式 — intent 的 Always 明写「现有设置项一项不少，动作与确认步骤不改」，降为只读或去掉动作恰好违背该约束。
  - `[low]` `[patch]` 两次构建共用同一个 `revision`，先发后到会覆盖（边盒层同一主张） — 与 `buildSeq` 同一次修复。
  - `[false]` `[reject]` `refresh()` 可能在 `release()` 之后重建订阅 — `release()` 先自增 `revision` 再退订，已发起的 `refresh` 捕获到旧版本号，落地前 `stale()` 为真被丢弃；退订后 `onStateChange` 不再回调 `refresh`。
  - `[medium]` `[patch]` `SubNavBarIndex=4` 在桌面解析动作（边盒层） — 与 `effectiveScopeIndex` 同一次修复。
  - `[low]` `[reject]` 视口越过 768px 无 `matchMedia` 监听，手机专属标签可能停留到下一次重渲染 — 只在「视口变化且无任何 state 变化」的窗口内存在，任何交互即纠正；加监听属新机制。
  - `[low]` `[reject]` (carried) 「搜索结果视图 / 点播播报」图标不再随当前值变化 — 上轮已裁定：图标是装饰字形，值位文字（列表/卡片、发卡片/静默/批量总结）才是语义。
  - `[low]` `[patch]` `SettingCard` 删除后 `floatingPanel.tsx` 的 `themedCard` / `accentText` / `pressTone` / `mutedText` / `themedDividerBottom` 成了无消费者的死令牌 — 五个导出连同注释一并删除（全仓 grep 确认无引用）。
  - `[medium]` `[patch]` 异步构建的作废守卫（`revision` / `stale`）无任何验证 — 见上文两例；验证层另指出删守卫全绿、真机竞态可复现（IndexedDB 读窗口）。
  - `[medium]` `[patch]` 四个范围到 Service 的接线只有首个范围被断言（点标签不验证调了谁） — 桌面四项用例补三次点击 + 断言 `showNetEaseMusic` / `showRadio` / `showPluginSettings`（含 `changeSearchKeyword`、`ShowOrHideIMC` 两个实参）。
  - `[medium]` `[patch]` 取值行的「动作回报新值」链路无断言（`defaultPage` / `announceMode` / `searchViewMode`） — 补三例：宿站选择弹窗换成直接点中某项，断言 `report` 收到新标题；`searchViewMode` 另断言 `ctx.setState({ searchViewMode })`（实测删掉该行必红）。
  - `[low]` `[patch]` `phoneOnly` 过滤只作用于显示下标、动作仍走未过滤下标（验证层 Other） — 与 `effectiveScopeIndex` 同一次修复。
  - `[low]` `[reject]` 意图的「动作不变」与矩阵「只读行不可点」冲突（`syncStatus` 失去 `ShowMessage` 入口） — 上轮第 3 行已裁定，矩阵要求只读不可点，失败原因仍可经「立即同步」读到。
  - `[low]` `[reject]` 矩阵多数行没有真实副作用证据（宿站弹窗、启用全流程、`window.open`） — 这些副作用都落在宿站弹窗与 `SyncManager` 流程内，jsdom 里只能替身；能用真实产出的接线缺口已在本轮补齐（第 24–26 行）。
  - `[low]` `[reject]` 容器用例整体 mock `SettingsService`，范围→卡片的组合只在数据层断言 — 容器用例的职责就是现场与接线；卡片组合由 `SettingsService.test.ts`（真实产出）与 `mediaCards.test.ts`（真实渲染）分段覆盖。
  - `[low]` `[patch]` (carried) 本 story 引入的机制未被 intent 描述（`revision`、手机「关于」先 `release`） — 上轮第 2/21/126 行已 patched 并保留：这是 `showPluginSettings` 异步化与 `AboutService` 直写 `ctx.setState` 的必要配套。
  - `[low]` `[patch]` (carried) `isProxyAtInputSetting` 的首参由 mdi 字形改布尔、`applyBehavior` 条件化 — 上轮第 28 行已补用例并保留；intent 只要求开关翻转、落盘、`aria-checked` 同步与行为重装。
  - `[low]` `[reject]` 单卡范围的组名与范围标签近似（「音乐设置」vs「网易云音乐」） — 这是 intent「子分组作组卡」的字面落地，DESIGN 也要求组名即现有分组名；差异由标签与组名各自承担层级。
  - `[low]` `[patch]` (carried) 空串组名当判别位是「按数据内容猜」的反面 — 与第 7 行同一次修复：补组名非空用例，不新增判别字段。
  - `[low]` `[reject]` 设置页容器被换成 `deskGutter` + `max-w-[760px]` 卡列，超出 Code Map 列出的改动 — 组卡页必然替换旧网格；本轮已在 `mediaCards` 补布局断言，行为面无未覆盖项。
  - `[low]` `[reject]` 「手机点击区 ≥44px」以类名断言而非几何测量 — jsdom 无布局引擎，类串是该仓既有且统一的验证方式（`roomDeck` / `actionSheet` 同构）。

## Design Notes

**为什么把 `settingsData` 升成组数组而不是给行加 `group` 字段**：CAP-11 明确「平台分组作范围标签、每个子分组一张组卡」，一个范围动作要一次返回多张卡；扁平数组只能靠相邻同名字段在渲染期切分，行顺序一改分组就散。组数组让「范围 → 若干卡 → 若干行」在数据层就成立，`SettingsService` 的每个范围函数各自返回自己的组。

**为什么行语义写在数据里**：旧实现靠 `actionTitle.startsWith("mdi")` 判开关、靠 key 猜只读，正是复盘 F7 的「按文案/key 猜」陷阱。`kind` 由造数据的一方声明，渲染层只做四种分支。

**云同步开关为什么不做乐观翻转**：启用要过「口令 → 云端预览 → 合并确认」两段宿站弹窗，中途取消或预览失败都不该点亮。开关的 `checked` 只来自 `SyncManager.getState().enabled`，流程结束后 `refresh()` 重建数据才变开；行内局部状态只在动作**回报**了新值时更新（`代理@输入` 会回报，云同步不会）。

**图标**：DESIGN 的 symbol 表只覆盖外壳与控件；`settings-row` 规定 20px 内联 SVG 但未指定字形，因此在 `tokens.ts` 的 `DeskIcon` 补一组同风格（描边 1.6–1.9、`currentColor`）的设置行图标。`announce*` / `imwMode*` 的 mdi 码点仍服务宿站选择弹窗，不能一起删。

**「关于」只在手机进设置**：`phoneOnly` 标记 + 渲染期 `isPhone()` 过滤，避免维护两套 `categories` 或把关于页复制一份；桌面仍走独立「关于」模式。

## Verification

**Commands:**
- `npx prettier --check src/page/components/settings src/page/MainAppContainerServices/SettingsService.ts src/page/MainAppContainerServices/AboutService.ts` -- expected: 无差异输出
- `npm test` -- expected: 全绿（含新增 settingsPage 用例与改写后的容器/SettingsService 用例）
- `npm run build` -- expected: `tsc -b && vite build` 成功，产出 `dist/bundle.js`

**Manual checks (if no CLI):**
- 真站（iirose.com 视频分享房）1280×720 与 400×800 × 宿站浅/深色：设置四个范围与组卡取色、开关两态、只读行、关于卡外链图标；手机设置末项「关于」；云同步启用流程中途取消后开关仍为关。

## Auto Run Result

### 2026-10-30 — 跟进评审（follow-up pass）

**Status:** done

**Summary:** 在已完成的 story 7 实现上做一次独立评审并修复发现的问题。全部改动都是既有实现的收口，没有改设计：① 范围下标解析统一走 `visibleScopes()` / `effectiveScopeIndex()`，`runCurrentScope` 不再按未过滤的 `subNavBarItems` 取条目（手机停在「关于」后视口变宽，桌面不会再执行关于动作、把关于卡挂在「插件设置」标签下）；② `showPluginSettings` 的作废守卫加 `buildSeq`，同一范围内两次构建交错时以最新一次为准；③ 删除 `SettingCard` 退场后成为死码的五个 `themed*` 浮窗令牌；④ 补齐五处验证缺口（作废守卫、两次构建交错、四个范围接线、取值行回报、设置页容器布局）与空组名判别位守卫；⑤ 修正 `AboutCard` 上一句在手机上不成立的注释。

**Files changed:**
- `src/page/MainAppContainer.tsx` — 新增 `visibleScopes()` / `effectiveScopeIndex()`；渲染、结果区下标与 `runCurrentScope` 共用同一份范围解析。
- `src/page/MainAppContainer.test.ts` — 越界下标用例补「重进设置执行 `showPluginSettings` 而非 `showAbout`」；桌面四项用例补三次标签点击的接线断言（含 `changeSearchKeyword` / `ShowOrHideIMC` 实参）。
- `src/page/MainAppContainerServices/SettingsService.ts` — `buildSeq` 序号与 `stale()` 合并判断（同一范围内先发后到的构建同样作废）。
- `src/page/MainAppContainerServices/SettingsService.test.ts` — 新增「异步构建作废守卫」两例、「取值行的动作回报」三例、「四个范围组名非空」一例。
- `src/page/components/floating-panel/floatingPanel.tsx` — 删除 `themedCard` / `accentText` / `pressTone` / `mutedText` / `themedDividerBottom`（已无消费者）。
- `src/page/components/settings/SettingsGroup.tsx` — `AboutCard` 注释改为桌面 / 手机两条说明路径。
- `src/page/components/media-card-container/mediaCards.test.ts` — 设置形态补页面级布局断言（`flex-col`、`gap-6`、`max-w-[760px]`）。

**Review findings:** 37 条 — 0 high / 6 medium / 29 low / 2 false / 0 maybe-false。
- 本轮 patch 9 个条目（medium 4：范围下标解析、作废守卫验证、范围接线验证、取值行回报验证；low 5：`buildSeq`、空组名守卫、设置页布局断言、`AboutCard` 注释、死令牌删除），无新增 defer。
- carried 4 条（`syncStatus` 只读化、`isProxyAtInputSetting` 契约、`revision`/`release` 机制、图标不再随值变化），沿用上轮裁定，代码保持不动。
- 其余 24 条 reject / false，逐条理由见 `## Review Triage Log` 的 (follow-up) 段：`DESK_ICON_NAMES` 漂移有测试兜底、值截断与 44px 由 DESIGN 与 jsdom 限制决定、DESIGN symbol 清单不是运行期登记表、矩阵中依赖宿站弹窗的副作用在 jsdom 里只能替身、`toast`/`hint`/内圆角令牌等属设计外扩面。

**Verification performed:**
- `npx prettier --check`（7 个改动文件）— 无差异。
- `npm test` — 57 个文件 1031 个用例全绿（本轮新增 6 例，改动前 1025）。
- `npm run build` — `tsc -b && vite build` 成功，`dist/bundle.js` 430.77 kB。
- 有效性反证：临时把 `runCurrentScope` 换回未过滤下标 / 去掉 `buildSeq` / 删掉 `ctx.setState({ searchViewMode })`，对应用例各自变红，恢复后全绿；说明新用例不是恒真断言。

**Follow-up review recommendation:** `false`。本轮 patch 的最高 verdict 是 medium（4 个 medium 条目），按 follow-up pass 的规则不构成再评一轮的理由；上轮 medium 遗留问题已被本轮实证覆盖。
- 真机仍未回归的一条风险（不影响本判定）：`phoneOnly` 的范围过滤与 `isPhoneLayout()` 都是渲染期快照，视口在 768px 上下穿越时依赖下一次重渲染纠正；桌面/手机切换的观感需在真站确认。


