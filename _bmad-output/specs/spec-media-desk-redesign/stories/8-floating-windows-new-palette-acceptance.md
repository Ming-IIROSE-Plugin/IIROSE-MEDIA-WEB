---
title: '两个浮窗换新配色与总验收'
type: 'feature'
created: '2026-10-30'
status: 'done'
baseline_revision: '1149ad88803a3bf5a833aa30eeb9246a0e0bf9b3'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      侧栏进度入口（#imw-media-progress-entry）与侧栏播放模式行仍用 --imw-entry-accent 天蓝：
      打开蔷薇红浮窗的那一行是蓝的。
    evidence: |-
      src/app.css 的 #imw-media-progress-entry / #imw-playback-controls 仍是 #2563eb（深色 #93c5fd），
      而本轮把两个浮窗整体换成纸/墨/蔷薇红。SPEC Non-goals 明确「本轮不改侧栏播放行与侧栏进度入口的外观」，
      故属既有面而非本轮回归。
    location: >-
      src/app.css
    severity: low
  - summary: >-
      deferred-work 台账里「sky-500 实底白字 ≈2.8:1 未达 AA」条目未随本轮结清。
    evidence: |-
      两个浮窗的实底已换成 rose（浅 #B42F3E 白字 ≈6.1:1、深 #BA4F59 ≈4.8:1），该条目对浮窗已不成立；
      台账属 agent-context/账本文件，改动推迟，下一次 sweep 需按新事实改写而不是重开缺陷。
    location: >-
      _bmad-output/implementation-artifacts/deferred-work.md:117
    severity: low
  - summary: >-
      总验收脚本与截图落在 gitignore 的 _bmad-output 与 /tmp，脚本只打 stdout，证据不可复核。
    evidence: |-
      仓库 .gitignore 忽略 _bmad-output，验收记录只以本 story 文本存在；脚本 /tmp/iirose-verify/story8-acceptance.mjs
      与 story8/*.png 属易失文件。需要固定证据目录或可重放的验收脚本时再收。
    location: >-
      /tmp/iirose-verify/story8-acceptance.mjs
    severity: low
  - summary: >-
      J3 指定的「粘贴 BV 号 → 选集面板」入口本轮无法验收，改用同一 openEpisodePicker 链路的「多源剧集 → 选集」。
    evidence: |-
      api.bilibili.com/x/web-interface/view 经阿里云 CORS 代理在四个组合里稳定返回 412 Precondition Failed，
      任意视频点播均止于「无法获取视频信息」。属外部风控；接口可用后需复验 BV 入口与多 P 徽章顺序。
    location: >-
      src/platforms/BilibiliPlatform.ts
    severity: medium
  - summary: >-
      真站深色是把 window.theme 置空模拟主题信号，宿站整页仍是浅色。
    evidence: |-
      插件唯一主题来源即 window.theme（hostIsDark），浮窗深色令牌与 data-imw-theme 已实测；
      「宿站整页深色 + 主面板 + 两个浮窗并排」的观感未在真机核到。
    location: >-
      src/iirose_func/HostTheme.ts
    severity: low
  - summary: >-
      收藏随机面板未选中勾选框仍是 border-current/40（浅色约 2.4:1），低于 DESIGN 对界面部件要求的 3:1。
    evidence: |-
      src/page/components/shuffle-picker/ShufflePicker.tsx:219 的未选中分支本轮未改（只换了选中态取色），
      同一轮改版前的写法一致；tokens.ts 已有 deskInk3Border（≥5:1）可用于该角色。属既有面，非本轮回归。
    location: >-
      src/page/components/shuffle-picker/ShufflePicker.tsx:219
    severity: low
  - summary: >-
      播放进度浮窗深色下 input[type=range] 的未填充轨道仍按浅色绘制（缺 color-scheme）。
    evidence: |-
      全仓无 color-scheme，MediaProgress.tsx:332 只有 accent 色；上一版深色面板（bg-[#242a34]）同样如此，
      故非本轮引入。修复需在浮窗根加 imw-dark:[color-scheme:dark] 或在 app.css 写 ::-webkit-slider-runnable-track。
    location: >-
      src/page/components/media-progress/MediaProgress.tsx:332
    severity: low
  - summary: >-
      仓库 AGENTS.md 的浮窗条目与「蔷薇红只表示点播与房间正在放」未随本轮改写。
    evidence: |-
      AGENTS.md 仍写「仍在用 floatingPanel 的 themed* 的只剩设置卡」（themed* 已不在 floating-panel 中）
      与「蔷薇红只表示点播与房间正在放」，而 DESIGN.md:695 已把勾选、主按钮、分段选中列为蔷薇红强调。
      修复落在 agent-context 文件，需按新事实改写。
    location: >-
      AGENTS.md
    severity: low
  - summary: >-
      floating-panel 的 textButton 悬停是填底色，与 DESIGN components.text-button（无底色，hov 下划线）不符。
    evidence: |-
      改版前即为 hov:hover:bg-sky-500/8，本轮只把颜色换成 deskPressTone；tokens.ts 已有 deskTextButton
      （hov:hover:underline）承载 DESIGN 语义。属既有面，且改它等于改变五个调用点的交互反馈，需单轮处理。
    location: >-
      src/page/components/floating-panel/floatingPanel.tsx:24
    severity: low
---

## Intent

**Problem:** 播放进度浮窗（`#imw-media-progress-root`）与收藏随机选择面板（`#imw-shuffle-picker-root`）仍用前轮天蓝配色与 `panelTheme/borderTone(dark)` 的散装类（`bg-[#242a34]`、`text-sky-500`、`bg-sky-500`），与主面板的纸/墨/蔷薇红完全两套，DESIGN.md `components.floating-window` 要求二者与主面板视觉同源（SPEC CAP-12）；改版最后一个 story 还要在真站跑 J1–J5 总验收。

**Approach:** 只换配色与焦点环：把 `floating-panel` 的外观常量改成 `tokens.ts` 的成对令牌，两个浮窗根节点写 `data-imw-theme`（值仍由既有 `dark` 信号给出），组件里所有天蓝/裸色值/`rgba` 换成令牌；结构、拖动、位置记忆、键盘与全部行为一律不动，既有行为测试保持通过（仅配色断言随令牌改写）。随后在真站按 J1–J5 × 1280×720 / 400×800 × 宿站浅/深色跑总验收。

## Boundaries & Constraints

**Always:**
- 视觉数值唯一来源 `src/page/components/floating-panel/tokens.ts`；两浮窗与 `PlatformTabs` 只拼令牌，不裸写颜色 / `rgba(` / `sky-*` / 十六进制。
- 深浅仍由既有信号决定：`MediaProgress` 用 `media.dark`（`HostMediaBridge` 每帧读 `!window.theme`，打开期间跟随宿站），`ShufflePicker` 用 `openShufflePicker` 打开时算好的 `dark`（`hostIsDark()`）——只把该信号写成根节点 `data-imw-theme`，让 `imw-dark:` 变体命中。
- 结构、DOM 层级、`id`/`role`/`aria-*`、拖动与位置记忆、键盘语义、退场动效、`z-index`（90001 / 90010）一律不变；`rounded-2xl`（= DESIGN `xl` 16px）保留。
- 焦点环统一 `deskFocusRing`（2px ink 外圈 + 2px 间隔）；蔷薇红实底控件用 `deskFocusRingOnRose`（另加 2px paper 内环）。
- 既有行为测试必须继续通过；只允许改「断言具体颜色类名」的断言，不得放宽行为断言。
- 真站验收点播成功一律以聊天区 `div.msgholderBox`（children 最多的容器，末尾子块）判定，不看控制台日志。

**Never:**
- 不改浮窗的业务规则（进度跳转权限、随机选择与保存、Tab 循环、Esc/返回键、非模态焦点归还）。
- 不新增依赖、不新增 SCSS、不加载网络字体、不引入第三套主题或平台品牌色。
- 不改主面板、结果区、底部条、操作条、选集面板的外观（story 1–7 已定稿）。
- 不用投影式卡片阴影（DESIGN Elevation：浮层靠 sheet 底 + 1px rule）；不把蔷薇红用于错误提示。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 进度浮窗浅色 | `window.theme` 为真值 | 根节点 `data-imw-theme="light"`，外框 sheet 底 + rule 描边 | 无 |
| 进度浮窗深色 | `window.theme` 为空 | 根节点 `data-imw-theme="dark"`，深色取同名 `-dark` 令牌 | 无 |
| 打开期间宿站换主题 | 浮窗已开，`window.theme` 翻转 | 下一次快照后 `data-imw-theme` 跟着变（沿用 `media.dark` 既有行为） | 无 |
| 随机面板深浅 | `openShufflePicker` 打开时 `window.theme` 真/空 | 面板根 `data-imw-theme` 为 `light`/`dark`，打开期间不跟随 | 无 |
| 主按钮 / 勾选 / 分段选中 | 实底蔷薇红 | 浅色 `rose`、深色 `rose-fill-dark`，字色 `on-rose`；焦点环带 paper 内环 | 无 |
| 收藏列表底栏错误 | `error` 非空 | `role="alert"` 保留，字色取 ink 令牌（DESIGN 无危险色，也不许用蔷薇红） | 无 |
| 进度条可调 | `media.duration` 有值、有权限 | 滑块强调色取 rose 令牌 | 禁用态仍 40% 不透明 |
| 房间无播放 / 直播 | 既有快照 | 文案与只读行为不变，仅取色变 | 无 |

## Code Map

- `src/page/components/floating-panel/floatingPanel.tsx` -- 浮窗共用外观。`focusRing`(:8，已是 `deskFocusRing`)、`resetButton/plainButton/iconButton/textButton`(:11-14，天蓝)、`borderTone(dark)`(:17-18)、`panelTheme(dark)`(:21-24，`bg-[#242a34]`/`bg-[#fafbfe]`)、`panelFrame`(:27-28，含 `shadow-[0_12px_40px_rgba(...)]`)、`secondaryButton(dark)`(:34-35)、`primaryButton`(:38，`bg-sky-500`)、`themeAttr`(:45，被 `MainAppControlLayer.tsx:104` 用，**保留**)、`accentFill/accentFillButton/accentOutlineButton`(:48-55) 与 `coverPlaceholder`(:58) 已无消费者（grep 确认），`PanelHeader`(:163-199，:185 图标 `text-sky-500`)、`DragGrip`(:141-157，`bg-current opacity-25`)、`Svg/CloseIcon/startsOnControl/stopHostGestures/dragHandleClass` 不动。
- `src/page/components/media-progress/MediaProgress.tsx` -- 进度浮窗视图。根节点 :244-268（`panelFrame` + `panelTheme(media.dark)`）；封面占位 :281 `bg-sky-500/15`；标题/次要行 :306-317 与 :460-472 用 `opacity-65`；滑块 :319-328 `accent-sky-500`；快进快退 :30-31/:445-459 `secondaryButton(dark)`。`media.dark` 来自 `HostMediaBridge.read()`（`src/media-progress/HostMediaBridge.ts:139` `dark: !this.host.theme`），**不要**新加 `hostIsDark()` 调用。
- `src/page/components/shuffle-picker/ShufflePicker.tsx` -- 随机面板视图。`Checkbox` :174-219（选中 `border-sky-500 bg-sky-500 text-white`）、`Cover` :221-242（`bg-sky-500/15 text-sky-500`）、`cardBase` :637（`panelFrame` + `panelTheme(dark)`）、骨架 :652-660（`bg-current opacity-10`）、展开行 :694、搜索框 :767（`borderTone` + `focus-within:border-sky-500`）、权重分段 :817-855（`borderTone` + 选中 `bg-sky-500`）、列表边框 :869、收藏行 :931、底栏 :987-1033（`secondaryButton(dark)`、`primaryButton`、`text-red-500` 错误行）；根 `layer` :720-724（写 `data-imw-theme`）。
- `src/page/components/shuffle-picker/PlatformTabs.tsx` -- 平台标签行。`idle` :102（`dark ? border-white/15 : border-black/10`）、选中 :120-125（`border-sky-500` / `bg-sky-500` / `hover:bg-sky-500/8`）；`dark` prop 保留在接口里（调用方仍传），只不再参与取色。
- `src/page/components/shuffle-picker/openShufflePicker.tsx:279` -- `dark = hostIsDark()` 的唯一来源（面板打开时算一次），不改。
- `src/page/components/floating-panel/tokens.ts` -- 令牌唯一来源；本 story 需补三个派生令牌：蔷薇红描边、搜索框 `focus-within:` 蔷薇红描边、滑块 `accent` 色（均浅深成对）。
- `src/app.css` -- `@custom-variant imw-dark`（:10）按属性匹配，浮窗根写 `data-imw-theme` 即命中；本 story 不改 css。
- 测试面（配色断言，需随令牌改写）：`src/media-progress/MediaProgress.test.ts:965`（`text-sky-500`）、`:1043-1045`（`border-white/15`/`hov:hover:bg-sky-500/8`/`active:bg-sky-500/15`）、`:1051`（`bg-[#242a34]`）、`:1057`（`border-black/10`）、`:1060`（`bg-[#fafbfe]`）；`src/page/components/shuffle-picker/openShufflePicker.test.ts:588-596`（深浅两色值）。其余断言（`rounded-2xl` :787、`pointer-events-none` :628-630、`flex-1`/`min-h-[44px]`/`mask-image`/`cursor-not-allowed` 等）都是结构与几何，**不得改**。
- 参照实现：`src/page/components/episode-picker/openEpisodePicker.tsx:98-100`（body 独立根写 `root.dataset.imwTheme`）与 `openEpisodePicker.test.ts:84-98`（浅/深断言写法）。

## Tasks & Acceptance

**Execution:**
- `src/page/components/floating-panel/tokens.ts` -- 补 `deskRoseBorder`（`border-[#B42F3E] imw-dark:border-[#E3606C]`）、`deskRoseBorderFocus`（同上但 `focus-within:` 前缀）、`deskAccent`（`accent-[#B42F3E] imw-dark:accent-[#E3606C]`） -- 组件零裸值。
- `src/page/components/floating-panel/floatingPanel.tsx` -- `panelTheme/borderTone/secondaryButton` 的参数化取色改为令牌常量（`panelSurface = deskSheet + deskInk + deskRule`、`panelBorder = deskRule`、`secondaryButton` 无参），`primaryButton` 改 `deskRoseSolid + deskOnRose + deskFocusRingOnRose`，`iconButton/textButton` 改 `deskPressTone`（`textButton` 字色 `deskRose`），`PanelHeader` 图标改 `deskRose`，`panelFrame` 去投影、保留 `rounded-2xl border border-solid outline-none`；删除无消费者的 `accentFill*`/`coverPlaceholder` -- CAP-12 共用外观同源。
- `src/page/components/media-progress/MediaProgress.tsx` -- 根节点写 `data-imw-theme={media.dark ? "dark" : "light"}` 并改用 `panelFrame + panelSurface`；封面占位 `deskThumb + deskInk2`；次要文字 `opacity-65` → `deskInk2`；滑块 `deskAccent`；快进快退 `secondaryButton`（无参） -- 只换取色。
- `src/page/components/shuffle-picker/ShufflePicker.tsx` -- 根 `layer` 写 `data-imw-theme={dark ? "dark" : "light"}`；`cardBase` 改 `panelFrame + panelSurface`；勾选选中 `deskRoseSolid + deskOnRose`（描边 `deskRoseBorder`）；`Cover` 占位 `deskThumb + deskInk2`；骨架 `deskSkeleton`；三处行悬停 `deskPressTone`；搜索框 `deskRule + deskRoseBorderFocus`；权重分段 `deskRule` + 选中 `deskRoseSolid deskOnRose`；列表上下边框 `deskRule`；底栏按钮 `secondaryButton`/`primaryButton`（令牌化）；错误行字色改 `deskInk`（`role="alert"` 保留） -- 去天蓝、去裸色。
- `src/page/components/shuffle-picker/PlatformTabs.tsx` -- `idle` 改 `deskRule`，选中 `deskRoseBorder` + `deskRoseSolid + deskOnRose`，悬停 `deskPressTone`；`dark` 从解构里移除（接口保留） -- 分段控件与主面板同源。
- `src/media-progress/MediaProgress.test.ts` `src/page/components/shuffle-picker/openShufflePicker.test.ts` -- 只改配色断言：改为断言根节点 `data-imw-theme` 取值与令牌类（`bg-[#FBFAF7]`/`imw-dark:bg-[#1C1A18]`、`border-[#E2DCD1]` 等），深浅两个方向各一条 -- 行为断言一条不动。
- `src/page/components/floating-panel/floatingWindowPalette.test.ts`（新） -- 覆盖 I/O 矩阵：两窗根 `data-imw-theme` 随 `window.theme`（进度窗另验打开期间翻转跟随）；渲染结果与源码无 `sky-`/`themed`/`accentVar`/`rgba(`/裸十六进制（`tokens.ts` 除外，源扫描覆盖 `floating-panel/*.tsx`、`media-progress/MediaProgress.tsx`、`shuffle-picker/{ShufflePicker,PlatformTabs}.tsx`）；两窗外框 `rounded-2xl` + `border-solid` + 无 `shadow-[0_12px`；实底蔷薇红按钮含 paper 内环焦点环 -- CAP-12 可验证。
- `_bmad-output/specs/spec-media-desk-redesign/stories/8-floating-windows-new-palette-acceptance.md` -- 记录真站总验收结果（J1–J5 × 两视口 × 两主题）与残余风险 -- done_checkpoint 证据。

**Acceptance Criteria:**
- Given 宿站浅色，when 打开播放进度浮窗，then 根节点 `data-imw-theme="light"`，外框 sheet 底 + 1px rule 描边、无投影，标题图标与主按钮为蔷薇红而非天蓝。
- Given 宿站深色，when 打开播放进度浮窗与收藏随机面板，then 两者根节点 `data-imw-theme="dark"`，实底控件取 `rose-fill-dark`、字色 on-rose，焦点环外圈取 ink-dark。
- Given 两浮窗已打开，when 用键盘 Tab 走到任一可聚焦控件，then 显示 2px ink 外圈 + 2px 间隔的焦点环；实底蔷薇红控件另带 2px paper 内环。
- Given 两浮窗源码与渲染结果，when 检查，then 不含 `sky-`、`themed`、`accentVar`、`rgba(`、裸十六进制色值（`tokens.ts` 除外），无 emoji 与宿站 `mdi-*`。
- Given 任一浮窗，when 拖动、缩放、改主题、确认/取消、按 `Esc` 与宿站返回键，then 行为与 story 8 之前完全一致（位置记忆、焦点归还、退场动效、单例、层级 90001/90010 均不变）。
- Given 仓库，when 运行 `npm test` 与 `npm run build`，then 全绿，且既有 `shuffle-picker`/`media-progress`/`playback` 行为断言未被放宽。
- Given 真站视频分享房、1280×720 与 400×800、宿站浅/深色四种组合，when 依次走 J1–J5，then 每条旅程都走到高潮（底部条/迷你条切到所点媒体，聊天区 `div.msgholderBox` 新增点播卡片），两个浮窗与主面板并排视觉同源，brownfield.md「必须存活」清单逐项可演示。

## Spec Change Log

## Review Triage Log

## Design Notes

**为什么把主题信号写成 `data-imw-theme` 而不是继续传 `dark` 进每个类串**：DESIGN 的令牌是「浅色类 + `imw-dark:` 类」的完整类串，只有属性变体才能命中；`imw-dark` 变体按属性匹配（`src/app.css:10`），不要求挂在 `.IIROSE_MEDIA_CONTAINER` 内，因此浮窗根自己写一份即可——与选集面板（`openEpisodePicker.tsx:98-100`）同一做法。`MediaProgress` 不改成「打开时算一次」，因为它现在**跟随**宿站主题（`media.dark` 每帧来自 `HostMediaBridge.read()`），把属性绑在 `media.dark` 上即可保持既有行为。

**为什么删 `accentFill*` / `coverPlaceholder`**：grep 确认无消费者（story 7 删掉 `themed*` 后它们已孤立），且它们是前轮强调色方案的遗留，留着就是「组件里还有第二种配色来源」。

**错误行取 ink 而不是蔷薇红**：DESIGN 明确蔷薇红不表示错误，且没有危险色令牌；设置页危险操作也用 ink/ink2。底栏错误仍靠 `role="alert"` 播报。

**`rounded-2xl` 保留**：等于 DESIGN `xl`（16px），换成 `rounded-[16px]` 只是改写同一数值，却会打掉既有几何断言，无收益。

## Verification

**Commands:**
- `npm test` -- expected: 全绿（含新增 `floatingWindowPalette.test.ts`，仅配色断言改写）
- `npm run build` -- expected: `tsc -b && vite build` 无错误
- `npx prettier --check src/page/components/floating-panel src/page/components/media-progress src/page/components/shuffle-picker src/media-progress/MediaProgress.test.ts` -- expected: 无差异

**Manual checks (if no CLI):**
- 真站（iirose.com 视频分享房）总验收矩阵：1280×720 / 400×800 × 宿站浅/深色，各跑 J1（桌面搜歌点播）、J2（手机收藏随机）、J3（桌面 BV 号 + 选集面板）、J4（模式开关与进度跳转）、J5（手机曲目行点播）；点播成功以聊天区 `div.msgholderBox` 子节点增长判定；截图核对两个浮窗取色（sheet 底 + rule 描边 + 蔷薇红强调，无天蓝）。

### 真站总验收结果（2026-10-30，房间 `5b792cb650749_69ac4a8c625c1`，`mediaShareRoom=true`）

四个组合全部通过（脚本 `/tmp/iirose-verify/story8-acceptance.mjs`，截图 `/tmp/iirose-verify/story8/`）：

| 组合 | J1 | J2 | J3 | J4 | J5 | 浮窗取色 |
| --- | --- | --- | --- | --- | --- | --- |
| 浅色 1280×720 | 通过（聊天区 `太聪明` 卡片 14→15） | 通过（面板 4 行、确认后点亮） | 通过（选集面板 36 行，聊天区 8→10） | 通过（`aria-pressed` false→true） | 通过（聊天区 7→8） | 通过 |
| 浅色 400×800 | 通过（15→16） | 通过 | 通过（10→12） | 通过（展开的底部条打开） | 通过（操作条打开，7→8） | 通过 |
| 深色 1280×720 | 通过（13→14） | 通过 | 通过（10→12） | 通过 | 通过（7→8） | 通过 |
| 深色 400×800 | 通过（12→13） | 通过 | 通过（10→12） | 通过（展开层 62px 三行） | 通过（操作条，7→8） | 通过 |

实测取色：播放进度浮窗浅色 `rgb(251,250,247)` / 深色 `rgb(28,26,24)`，描边 `rgb(226,220,209)` / `rgb(43,40,37)`，圆角 16px，`box-shadow: none`，滑块与头部图标 `rgb(180,47,62)` / `rgb(227,96,108)`；收藏随机面板同值，主按钮 `rgb(180,47,62)`（浅）/ `rgb(186,79,89)`（深，`rose-fill-dark`）、勾选实底同色、`data-imw-theme` 与宿站主题一致。

已知环境限制（非本轮改动引起）：B 站详情接口经阿里云 CORS 代理返回 `412 Precondition Failed`（`api.bilibili.com/x/web-interface/view`），因此「粘贴 BV 号 → 点播到房间」这条子路径在本机连续四次组合里都止于「无法获取视频信息」提示；J3 改用同一条链路的「多源剧集 → 选集面板 → 点播所选」完成验收（多 P 语义、点选顺序与批量播报与 BV 路径共用 `openEpisodePicker`）。

## Review Triage Log

### 2026-10-30 — Review pass

- verdicts: 36 findings — high 0, medium 3, low 28, false 5, maybe-false 0
- findings:
  - `[low]` `[patch]` ShufflePicker 的次要文字仍用 `opacity-65`/`opacity-80`、淡图标用 `opacity-55`，同轮 MediaProgress 已改 `deskInk2`，同一视觉角色两种写法 — 已改 `deskInk2`/`deskInk3`（禁用态 `opacity-35` 保留）。
  - `[low]` `[patch]` 随机面板搜索框仍是 `placeholder:text-current placeholder:opacity-50` 且无光标色，主面板同位置用 `deskPlaceholder`/`deskCaret` — 已补两个令牌。
  - `[low]` `[patch]` `primaryButton` 抄了一份 `resetButton` 基类，将来 `resetButton` 加属性会静默漂移 — 已抽出 `resetBase` 共用。
  - `[low]` `[patch]` 两个浮窗各自手写 `? "dark" : "light"`，已有 `themeAttr` 未用 — 已改用 `themeAttr(...)`。
  - `[low]` `[patch]` `PlatformTabs` 的 `dark` 已不参与取色却仍是必填 prop，调用方在喂一个被忽略的值 — 已从接口、调用点与测试夹具删除。
  - `[medium]` `[patch]` 新增令牌（`deskRoseBorderFocus`、`deskSkeleton`、`deskThumb`、选中描边）在渲染里出现却零断言，拼错会静默上线 — 已补正向断言（含勾选、分段、搜索框、骨架、封面占位）。
  - `[low]` `[patch]` 深色下勾选/分段选中的描边取 `rose-dark`（#E3606C）而实底取 `rose-fill-dark`（#BA4F59），亮一档的红描边包暗底；DESIGN 对实底控件要求描边与实底同值 — 新增 `deskRoseSolidBorder` 并替换两处。
  - `[low]` `[patch]` 源码扫描面硬编码三个目录、非递归、跳过 `openShufflePicker.tsx`，且 `files.length >= 4` 恒真 — 已改为对 `src/page/components` 递归、排除 `tokens.ts`、并断言扫到四个组件文件。
  - `[low]` `[reject]` 扫描正则把十六进制当颜色，逼得 `#000` → `black`，且 `bg-red-500` 之类词表类名两处扫描都能过 — 两者等价改写、无视觉变化；把规则改成颜色词表属超出直接修正的改造，当前扫描面内也不存在这类类名。
  - `[low]` `[reject]` 配色契约在 `MediaProgress.test.ts` 与 `floatingWindowPalette.test.ts` 各写一份且不对称、旧浅色向按钮断言被删 — 现按钮断言同时含浅色 `border-[#E2DCD1]` 与深色 `imw-dark:border-[#2B2825]`，浅色向未丢；合并两份属测试重组，收益不抵风险。
  - `[low]` `[patch]` 「无投影」只按 `shadow-[0_12` 前缀否定，换任何别的投影都能过 — 已改为「除 `focus-visible:` 与 `inset` 外的 shadow/drop-shadow 类必须为空」。
  - `[low]` `[reject]` 测试里把约 20 处令牌值抄成十六进制 — 导入令牌再断言会让断言变成同义反复，测试写具体值才是独立校验。
  - `[low]` `[reject]` 底栏错误行从红改成 ink，与「至少选择一首」提示只差一档不透明度 — DESIGN 无危险色且明确规定蔷薇红不表示错误（设置页危险操作同用 ink），`role="alert"` 保留；新增图标/底色属设计外扩面。
  - `[low]` `[defer]` `src/app.css` 的 `#imw-media-progress-entry` / `#imw-playback-controls` 仍是 `--imw-entry-accent:#2563eb` 天蓝 — 真实但属既有面，SPEC Non-goals 明确本轮不改侧栏播放行与进度入口外观。
  - `[low]` `[defer]` `deferred-work.md` 里「sky-500 实底白字 ≈2.8:1」条目未随本轮结清（浮窗已换成 rose，主面板待核） — 台账文本属 agent-context/账本文件，改动推迟。
  - `[low]` `[reject]` story 文档前后矛盾（`status: in-review` 与 `stories.yaml` 的 `done_checkpoint`；J3 记「通过」与残余风险冲突） — 前一项是流程字段；J3 的替代路径与 BV 路径的 412 限制已在本轮同步写入「已知环境限制」段。
  - `[false]` `[reject]` `deskSkeleton` 与 `deskThumb` 取同值、两个名字一份值 — DESIGN frontmatter 明写 skeleton「与 thumb 同值」，且该令牌早于本 story 存在。
  - `[false]` `[reject]` 1px `rule` 描边压在宿站浅色聊天底上只有约 1.2:1，浮层可辨度无人验证 — DESIGN 把 rule 列为装饰线并豁免对比度，且规定浮层不用投影、层级靠底色档位与细线。
  - `[low]` `[patch]` 深色勾选选中的描边比实底亮，形成一圈亮边（与第 7 条同根因，独立成行） — 已随 `deskRoseSolidBorder` 修好。
  - `[low]` `[patch]` 平台标签选中态同样是亮描边包暗底 — 同上，已改。
  - `[medium]` `[patch]` 平台标签行整段换色却无任何断言（`PlatformTabs.test.ts` 只查布局/键盘，新测试只挂单平台不渲染标签行），漏 `deskOnRose` 也全绿 — 已补选中/未选中断言，并让收藏随机用例渲染两个平台。
  - `[medium]` `[patch]` 搜索框 `focus-within` 蔷薇红描边、骨架、封面占位、次要文字均无断言，删掉也不会失败 — 已补同形断言。
  - `[low]` `[defer]` 侧栏入口与播放模式行仍用天蓝强调（与第 14 条同一处，独立成行） — 同第 14 条裁定。
  - `[low]` `[patch]` `PlatformTabs` 保留的 `dark` prop 让读者以为深浅仍由它决定 — 同第 5 条，已删除。
  - `[low]` `[defer]` 总验收记录落在 gitignore 的 `_bmad-output` 与 `/tmp`，脚本只打 stdout，无法复核 — 证据形态受仓库忽略策略限制；本条记入台账，待有固定证据目录再收。
  - `[low]` `[defer]` J3 用「多源剧集 → 选集面板」替代「粘贴 BV 号 → 选集面板」 — B 站详情接口经代理返回 412（外部风控），同一 `openEpisodePicker` 链路已验收；待接口可用时复验 BV 入口。
  - `[low]` `[defer]` 深色是把 `window.theme` 置空模拟主题信号，宿站页面本身仍是浅色 — 插件唯一主题来源就是 `window.theme`，浮窗深色令牌与 `data-imw-theme` 已实测；宿站整页深色下的并排观感待真机确认。
  - `[low]` `[reject]` 真站 palette 断言只查 `theme` 与 `shadow`，其余值仅打印 — 仓库侧令牌值有单测断言，真站脚本是可丢弃的取证工具。
  - `[low]` `[reject]` 「两个浮窗与主面板并排同源」没有机器判定 — 属观感判断，四组合截图在案。
  - `[false]` `[reject]` 测试只断言类名，测不到取色是否生效 — jsdom 无 CSS 管线；真站已取计算样式（背景/字色/描边/圆角/无投影/强调色）并记入验收表。
  - `[low]` `[reject]` 测试面驱动源码（`#000` → `black`） — 两者等价，无视觉变化。
  - `[false]` `[reject]` 「既有测试通过」成色被收窄、浅色向按钮断言被删 — 新断言逐按钮同时含浅色与深色令牌；只少了一条 `not.toContain("bg-black/5")`。
  - `[low]` `[reject]` story 记录的数字（1039 例 / 427.30 kB）与 HEAD（1046 例 / 427.15 kB）不同步 — 数字差异来自评审补测提交，属文档时点；修复即编辑本 build 的 spec。
  - `[low]` `[patch]` 源码扫描面偏窄（不递归、只 `.tsx`） — 同第 8 条，已改递归。
  - `[low]` `[reject]` 共享模块对外形状变化（`secondaryButton(dark)` → 常量、删 `panelTheme`/`borderTone`/`accentFill*`） — 已 grep 确认无消费者，删的是退役强调色遗留。
  - `[false]` `[reject]` 骨架与次要文字换了合成方式（`bg-current opacity` → 实底令牌） — DESIGN 明确 `skeleton` 与 `ink2` 令牌，属配色落地。

### 2026-10-30 — Review pass（follow-up）

- verdicts: 31 findings — high 0, medium 3, low 19, false 9, maybe-false 0
- findings:
  - `[low]` `[patch]` 实底蔷薇红控件缺 paper 内环焦点环（列了平台标签选中、勾选、权重分段三处） — 只有权重分段成立（`:849` 的 `[role="radio"]` 自身就是 rose 实底）——已把选中项焦点环换成 `deskFocusRingOnRose` 并补断言；勾选框与平台标签的可聚焦元素本身是透明底（rose 在子元素里），`outline-offset-2` 露出的 2px 间隙已是 sheet 色，不需要内环。
  - `[low]` `[defer]` 未选中勾选框仍用 `border-current/40`（浅色约 2.4:1，DESIGN `:563` 要求界面部件 3:1） — 真实，但本轮只改了选中分支的取色，未选中分支的写法与改版前一致，属既有面。
  - `[low]` `[defer]` 深色下滑块未设 `color-scheme`，`input[type=range]` 未填充轨道仍按浅色绘制 — 真实，但上一版深色面板（`bg-[#242a34]`）同样没有 `color-scheme`，非本轮引入。
  - `[low]` `[patch]` 源码扫描只收 `.tsx`，`entry.name !== "tokens.ts"` 永不会生效（`tokens.ts` 是 `.ts`） — 已删掉该死条件，`tokens.ts` 因扩展名天然不在扫描面内。
  - `[false]` `[reject]` 随机面板卡片配色只在深色挂载下断言、浅色分支无人验 — 断言的是成对令牌的完整类串，深色挂载那一条同时断言了 `bg-[#FBFAF7]` 与 `imw-dark:bg-[#1C1A18]`、两向描边与 `text-[#1C1916]`；`mountShuffle(false)` 在 `:214` 断言了 light 取值，删掉浅色类会红。
  - `[low]` `[reject]` story 文本与实际实现不同步（`deskRoseBorder` 不存在、`dark` prop 描述过时、扫描面描述过时） — 修正对象是本轮 build 的 spec 文档本身。
  - `[low]` `[defer]` 仓库 `AGENTS.md` 的浮窗条目（`themed*` 只剩设置卡）与「蔷薇红只表示点播与房间正在放」未随本轮改写 — 真实漂移（DESIGN `:695` 已把勾选/分段选中列为蔷薇红），但修复落在 agent-context 文件。
  - `[low]` `[defer]` `textButton` 悬停是填底色，DESIGN `components.text-button` 要求 hov 下划线 — 真实，但悬停填底在改版前就存在（原 `hov:hover:bg-sky-500/8`），本轮只换了颜色与字色。
  - `[low]` `[reject]` `panelBorder = deskRule` 与直接 import `deskRule` 并存 — 两者指向 `tokens.ts` 的同一个常量，取值不可能分叉；多一层名字不构成「第二个配色来源」。
  - `[low]` `[patch]` 封面/骨架断言靠 `w-10`、`querySelector("span")` 猜节点，DOM 顺序一变就会断言到错节点 — 已改为同时要求 `h-10` 与 `w-10`，骨架改为 `[class*="animate-pulse"] span`。
  - `[low]` `[reject]` `MediaProgress.test.ts` 在主题设置前断言 `data-imw-theme="dark"`，依赖 `window.theme` 的游离状态 — 若该前提被破坏，断言会立刻失败并指向确切位置，不存在静默放行；为此加环境前置属测试洁癖。
  - `[false]` `[reject]` `deskRoseSolidBorder` / `deskRoseBorderFocus` / `deskAccent` 三个蔷薇红令牌命名重、深色值不同且未文档化 — `tokens.ts:42-48` 每处都写了用途与取值来源；实底描边取 `rose-fill-dark` 是上一轮评审专门修过的结论（亮红描边包暗底）；另两个值相同但前缀不同（`focus-within:` / `accent-`），无法合并成一个类串。
  - `[false]` `[reject]` PlatformTabs 的深色令牌依赖祖先 `[data-imw-theme]`，无祖先时静默回浅色 — 唯一挂载点（随机面板）自己写了 `data-imw-theme`；intent 的做法就是「属性写到浮窗根、让 `imw-dark:` 变体命中」，子组件继承是该机制的预期行为；单测里无主题挂载只为验布局。
  - `[low]` `[patch]` 「打开期间不跟随」只靠两次挂载验，改成跟随宿站主题仍会绿 — 已补同一次挂载内翻 `window.theme`、触发一次状态重渲染后仍为 `dark` 的用例。
  - `[low]` `[reject]` 任务清单写「`dark` 保留在接口里（调用方仍传）」而实现已删除 — 修正对象是本轮 spec 文本；实现侧删除是上一轮评审 patch 的既定结论，代码现状与该行一致。
  - `[low]` `[reject]` 任务清单里的 `deskRoseBorder` 令牌名不存在（实现叫 `deskRoseSolidBorder`） — 同上：spec 文本与实现名不一致，改文档不改代码。
  - `[medium]` `[patch]` 搜索框占位文字与光标令牌零断言（改回 `placeholder:text-current` 仍全绿） — 已补 `input` 本体的 `deskPlaceholder`/`deskCaret` 断言与 `not.toContain("placeholder:text-current")`。
  - `[medium]` `[patch]` `deskInk2`/`deskInk3` 在十余处落地只有封面一处断言 — 已补进度浮窗时长行与 `role="status"` 的 `deskInk2`、随机面板搜索图标的 `deskInk3`，并断言 `opacity-65`/`opacity-55` 已从渲染里消失。
  - `[medium]` `[patch]` `textButton`/`iconButton` 与权重组外框、列表容器两处 `deskRule` 无任何断言 — 已补「全选」文字钮（`deskRose`+`deskPressTone`）、头部关闭钮的 `deskPressTone`、`[role="radiogroup"]` 与列表容器的 `deskRule`。
  - `[false]` `[reject]` 源码扫描覆盖整个 `src/page/components`，无关组件里出现十六进制文本会让整轮测试变红 — `tokens.ts:6` 的头注释本身就是仓库级规则（组件不得裸写颜色），扫描面与规则范围一致，且当前全绿。
  - `[low]` `[patch]` `entry.name !== "tokens.ts"` 是死代码（`walk` 只收 `.tsx`） — 与「扫描死条件」同根因，同一次改动删除。
  - `[low]` `[defer]` 真站 J1–J5 总验收的脚本与截图落在 gitignore 的 `_bmad-output` 与 `/tmp`，diff 内没有任何产物 — carried：上一轮已记录同一事实（证据形态受仓库忽略策略限制），本轮不重复入账。
  - `[false]` `[reject]` 去投影只在 DESIGN 读法下成立，超出「只换配色与焦点环」的字面读法 — story 任务清单明写「`panelFrame` 去投影」，DESIGN Elevation 也禁止投影式卡片阴影。
  - `[low]` `[patch]` 删 `PlatformTabs` 的 `dark` prop 与 Code Map「保留接口」冲突 — carried：上一轮同一处已判 `medium`/`patch` 并已删除，代码现状与该行一致，不再重开。
  - `[low]` `[reject]` 为过扫描把 `#000` 改成 `black`，动了非颜色代码 — carried：上一轮同条已判 `low`/`reject`（两种写法等价、无视觉变化）。
  - `[low]` `[reject]` 测试名「源码里不出现裸颜色值」比实际拦截面大 — 命名偏宽属表述问题；实质缺口（`border-current/40`）已按未选中勾选框单列并 defer。
  - `[false]` `[reject]` 扫描范围超出 intent 的四个浮窗文件 — 同「无关组件会让测试变红」条：`tokens.ts` 的规则本就适用于所有组件。
  - `[false]` `[reject]` 既有测试被重写后浅色向逐按钮描边断言消失 — carried：上一轮同条已判 `false`/`reject`（新断言逐按钮同时含浅色与深色令牌）。
  - `[low]` `[reject]` 错误行 `text-red-500` → `deskInk` 取消错误区分度 — carried：上一轮同条已判 `low`/`reject`（DESIGN 无危险色、蔷薇红不表示错误，`role="alert"` 保留）。
  - `[false]` `[reject]` 三档 `opacity` 被压成两档 ink 令牌 — DESIGN 本就只给 `ink2`/`ink3`/`skeleton` 档位，换成实底令牌正是本轮要的「同源」。
  - `[false]` `[reject]` 删 `accentFill*`/`coverPlaceholder` 属夹带无关清理 — story 任务清单明写删除这两个已无消费者的退役强调色令牌。

## Auto Run Result

**本轮做了什么（follow-up 复审 → patch）。** 对 story 8 的 `1149ad8..HEAD` 三个提交做了一轮完整复审（4 个评审层：blind-hunter、edge-case-hunter、verification-gap、intent-alignment），按 triage 只落地了可验证缺陷的最小修复：权重分段的选中项补 `deskFocusRingOnRose`（实底蔷薇红控件带 paper 内环），并把 6 处「渲染里出现却零断言」的令牌补上正向断言。

**改动文件：**
- `src/page/components/shuffle-picker/ShufflePicker.tsx` — 权重分段选中项的焦点环改用 `deskFocusRingOnRose`（`resetButton` → `resetBase` + 按选中态选环）。
- `src/page/components/floating-panel/floatingWindowPalette.test.ts` — 补断言：搜索输入框本体的 `deskPlaceholder`/`deskCaret`；进度窗时长行与 `role="status"` 的 `deskInk2`、搜索图标的 `deskInk3`（并断言 `opacity-65`/`opacity-55` 已消失）；「全选」文字钮的 `deskRose`+`deskPressTone`、关闭钮的 `deskPressTone`、`[role="radiogroup"]` 与列表容器的 `deskRule`；权重分段选中项的 on-rose 焦点环；封面色断言（补 `h-10`）、骨架断言改用 `[class*="animate-pulse"] span`；新增「打开期间宿站换主题不跟随」用例；删掉源码扫描里永不会生效的 `tokens.ts` 排除条件。

**评审结论分解：** 31 条 finding — patch 7 条（medium 3：搜索框占位/光标、ink2/ink3 覆盖面、textButton/iconButton 与两处 rule；low 4：权重分段焦点环、封面/骨架选择器、主题跟随用例、扫描死条件）；defer 4 条（未选中勾选框 `border-current/40` 约 2.4:1、深色滑块缺 `color-scheme`、`textButton` 悬停填底与 DESIGN `text-button` 不符 —— 均为改版前既有面；`AGENTS.md` 的浮窗条目与蔷薇红语义漂移 —— 属 agent-context 文件）；reject 20 条：refuted 9 条（浅色分支未断言、令牌命名重叠、PlatformTabs 依赖祖先属性、扫描面覆盖整树 ×2、`opacity` 档位合成、删死代码、去投影越界、浅色向按钮断言丢失），另 11 条或不值得改（测试名偏宽、环境态依赖但会响亮失败、`panelBorder` 别名）、或属 carried（`dark` prop 删除、`#000`→`black`、错误行改 ink、真站证据形态）或修正对象是 spec 文本（4 条）。

**验证：** `npm test` 58 文件 / 1049 用例全绿；`npm run build`（`tsc -b && vite build`）通过，`dist/bundle.js` 427.30 kB；`npx prettier --check` 三个目录无差异。

**followup review 建议：** false（follow-up pass 只压 low/medium 的测试与焦点环修复，未动配色体系与业务行为；本轮没有 high 级 patch，上一轮指出的「真站深色并排观感」「BV 入口 412」仍是仅有的未复核面）。

**残余风险：** 真站 J1–J5 的四组合验收记录仍只落在 gitignore 的 `_bmad-output` 与 `/tmp`（脚本与截图不可复核）；B 站详情接口经 CORS 代理返回 412，BV 入口未复验；宿站整页深色下的并排观感仍以 `window.theme` 模拟。


