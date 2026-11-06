---
ticket: 6
title: 随机选择面板
type: feature
created: '2026-10-26'
status: done
baseline_revision: e50bcfc36208be307d4d4967d09b2bef8aadf47b
route: dispatch
review_loop_iteration: 0
context:
- '{project-root}/_bmad-output/initiative-iirose-media-web/archive-v6/spec-playback-loop-shuffle/SPEC.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-playback-loop-shuffle/shuffle-picker-panel.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-playback-loop-shuffle/shuffle-mechanics.md'
---
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** story 5 已能按本机保存的选择与权重随机，但用户没有任何界面去选择范围、展开歌单勾单曲或切换权重。

**Approach:** 实现插件自有 Preact 选择面板及其打开 API：读取当前平台收藏与已存选择，按 `shuffle-picker-panel.md` 渲染（桌面卡片 / 移动抽屉、深浅主题、搜索、三态勾选、展开加载、权重分段、吸底摘要），确认时保存选择并回调，取消不保存。侧栏随机按钮接线（何时打开、确认后点亮）留给 story 7。

## Boundaries & Constraints

**Always:** 视觉与交互以 `shuffle-picker-panel.md` 为准；独立根节点 `#imw-shuffle-picker-root` 挂 `document.body`，同页单例，再次打开只聚焦已开面板，重复注入由新实例接管旧根；深浅主题取 `!window.theme`（与 `HostMediaBridge` 一致）；保存走 story 5 的 `saveShuffleSelection`，预填走 `loadShuffleSelection`（无记录 = 全部整条勾选、权重 `entry`；记录里没有的收藏为未勾选）；展开加载网易云歌单/专辑经既有 `NeteaseMusicAPI`（歌单取 `playlist.tracks` 的 id/name/ar，专辑取 `songs`），会话内按收藏 id 缓存；部分勾选满全部曲目时存为整条；封面 `http→https` + `onerror` 回退自包含 SVG；样式只用 Tailwind 类（`app.css` 仅补本根 `box-sizing`），悬停用 `hov:`，断点 `max-[768px]`，触控 ≥44px，图标自包含 SVG。

**Never:** 不改侧栏按钮行为与 `PlaybackMode`/`ShuffleController`（story 7）；不在面板内增删收藏；不展开 B 站视频；搜索不触发详情请求、不持久化；不用宿站 `buildSelect2`；不新增依赖、不新增 SCSS。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 首次打开 | 无已存选择 | 全部整条勾选，权重「按条目」，摘要计数正确 | N/A |
| 预填 | 已存 A 整条 + P 部分{1,2} + 后来新收藏 B | A 勾、P 部分态（展开后 1、2 勾）、B 未勾 | N/A |
| 三态切换 | 点部分态歌单的框 | 变全选（整条）；再点变未选 | N/A |
| 部分勾满 | 展开后逐首勾满全部曲目 | 行转全选，确认时存为整条 | N/A |
| 搜索 + 全选 | 搜索「周」后点全选 | 只勾可见行；被过滤的原勾选保留并计入摘要 | 无结果显示「没有匹配的收藏」 |
| 未选 | 全不选 | 主按钮不可点并提示「至少选择一首」 | N/A |
| 确认 | 点「开始随机」 | 保存选择与权重 → 关闭 → `onConfirm` | N/A |
| 取消 | ✕ / 取消 / Esc / 点遮罩 | 不保存，关闭，`onCancel`，焦点还给打开者 | N/A |
| 展开失败 | 详情返回 null/抛错 | 展开区「加载失败」+「重试」；整条勾选仍可确认 | 重试重新请求 |
| 空歌单 | 详情无曲目 | 「歌单里没有可播放的曲目」，该行复选框置灰 | N/A |
| 重复打开 | 面板已开时再次调用打开 | 不新建，焦点移回面板 | N/A |

</frozen-after-approval>

## Code Map

- `src/playback/ShuffleSelection.ts` -- 复用 `load/saveShuffleSelection`、`ShuffleSelection`、`ShuffleWeight`、`isSingle`；不改。
- `src/storage/FavoritesStorageService.ts:387` -- `query({ platform })` 取当前平台收藏；`FavoriteRecord.trackCount`（字符串）用于摘要「约 Y 首」。
- `src/Api/NeteaseAPI/NeteaseMusic/index.ts` -- `getSongListDetail(id)`（`playlist.tracks`: `{id,name,ar[]}`）、`getAlbumDetail(id)`（`songs`: `{id,name,ar[]}`），已走 `neteaseRequest`；收藏的网易云 id 在 `record.platformData.neteaseMusic.id`（参照 `src/playback/shuffleTargets.ts`）。
- `src/page/components/media-progress/MediaProgress.tsx:220` -- 视觉基准（底色、描边、阴影、`sky-500`）与 Esc 处理写法。
- `src/page/index.tsx:48-60` -- 独立根挂 body 与按 id 清理旧节点的写法（`releasePlaybackController`）；单例接管参照同文件 `releaseMainPanel`。
- `src/app.css:35` -- 进度浮窗根的 `box-sizing` 兜底，新根同列追加。
- `src/environment/Environment.ts:8` -- `window.iirosemedia` 插件命名空间声明（已有 `cors`）；焦点平台用 `src/playback/PanelFocus.ts` 的 `platformOf(readPanelFocus(), defaultPage)`。
- 测试先例：`src/media-progress/MediaProgress.test.ts`（`.test.ts` 内用 `preact/test-utils` 的 `act` 驱动组件；`vitest.config.ts` 只收 `*.test.ts`，测试里不写 JSX）。

## Tasks & Acceptance

**Execution:**
- [x] `src/page/components/shuffle-picker/pickerModel.ts` -- 纯函数：由收藏 + 已存选择生成初始状态、行三态、整条/逐首切换、可见行全选/全不选、搜索过滤、摘要计数、导出 `ShuffleSelection`（部分满即整条） -- 逻辑可单测、组件只做渲染
- [x] `src/page/components/shuffle-picker/ShufflePicker.tsx` -- 面板组件，按 companion 渲染与交互，含焦点管理与 a11y 属性 -- CAP-8/9 界面
- [x] `src/page/components/shuffle-picker/trackLoader.ts` -- 歌单/专辑曲目加载与会话缓存，失败返回 null -- 展开加载
- [x] `src/page/components/shuffle-picker/openShufflePicker.tsx` -- `openShufflePicker({ platform, onConfirm, onCancel, returnFocus? })`：单例根、读收藏与选择、确认保存、关闭清理；导出释放函数供重复注入接管 -- story 7 的接口
- [x] `src/app.css` -- 新根 `box-sizing` 兜底 -- 无 preflight
- [x] `src/environment/Environment.ts` 的 `window.iirosemedia` 声明 + 插件初始化处 -- 挂调试入口 `window.iirosemedia.openShufflePicker(platform?)`（缺省取当前 focus 平台） -- story 7 接线前供真机视觉验收
- [x] 单测 `pickerModel.test.ts`、`openShufflePicker.test.ts` -- 覆盖 I/O 矩阵全部行 -- 回归

**Acceptance Criteria:**
- Given 400×800 与 1280×720 视口，when 面板打开且列表很长，then 无横向溢出、底栏按钮完整可见、仅列表区滚动。
- Given 浅色与深色宿站主题，when 打开面板，then 底色/文字/勾选态对比清晰（companion 视觉表）。
- Given 改动完成，when 运行 `npm test`、`npm run build`、改动文件 `prettier --check`，then 全部通过。

## Implementation Notes

- 实现子代理在额度限流时中断，交回报告后由主会话收尾；新增 `src/page/components/shuffle-picker/` 六个文件，改 `app.css`、`Environment.ts`、`index.tsx`（初始化时释放旧面板并注册调试入口，控制器释放时一并释放面板）。
- 真机发现并修复：Tailwind 同属性类并存（`bg-transparent`+`bg-sky-500`、`text-inherit`+`text-white`）由构建顺序决定胜负，主按钮与选中分段曾显示为白字无底。
- 确认时重新读收藏，丢弃打开期间被删除的项（companion「确认时与当前收藏对齐」）。
- 真机验收（存在放映社，本地注入）：400×800 浅/深色、1280×720 深色；面板无横向溢出，底栏按钮完整（移动 183×44 ×2），仅列表区滚动，专辑展开、部分勾选三态、Esc 关闭正常。宿站顶层聊天浮层会短暂盖住 iframe（插件无法控制）。
- 未实现：companion 提到的「移动端系统返回关闭面板」（需改宿站 iframe 的 history，风险高，待用户定夺）；方向键列表导航（companion 未要求）。
- 测试数据：子代理在 Playwright 资料的 IndexedDB 写入 23 条假收藏（云同步关闭，未上传），视觉验收后删除。
- 审查修补：歌单按 trackIds 补全、加载后归一化空/失效行、搜索只过滤已展开行、遮罩需按下也在遮罩、保存失败/删除提示与忙碌态、motion-reduce 叠加断点（生成 CSS 中断点规则原先胜出）、aria-controls 稳定 id、焦点归位、调试入口校验平台，并补齐测试。
- 审查后真机复验：400×800 浅色（专辑部分勾选三态、摘要同步）、1280×720 深色（搜索、按歌曲说明切换），单实例。
- 验证：`npm test` 526 通过（审查前 509），`npm run build` 通过，改动文件 prettier 通过。

## Spec Change Log

## Review Triage Log

| # | 来源 | 发现 | 判定 | 依据 / 去向 |
|---|------|------|------|------|
| 1 | BH/EC | 歌单只用 `playlist.tracks`，少于 `trackIds` 时部分勾满被存为整单、余下曲目不可选 | medium | 抽取侧以 `trackIds` 为准（shuffleTargets），`NetEasePlatform` 已防 tracks 不全；patch：按 trackIds 补全曲名 |
| 2 | BH/EC/VG | 空歌单初始勾选后置灰无法取消，仍计数、可确认、被导出；部分勾选曲目全失效时显示部分态 | medium | 既有「空歌单」测试只断言置灰、实际固化了该行为；patch：加载后按曲目归一化为未选 |
| 3 | BH | 搜索过滤收起状态歌单（仅在缓存中）的曲目，全选给未见曲目部分勾选 | medium | 违反 companion「已展开且已加载」；patch |
| 4 | BH | 从对话框内拖选文字到遮罩松手会关闭面板 | medium | click 落在共同祖先遮罩上；patch：pointerdown 也须在遮罩 |
| 5 | BH/EC/VG | 保存失败无反馈且无测试；确认对齐期间按钮假可用；打开期间所选全被删除仍保存空选择 | medium | patch：错误行、忙碌态、空对齐不保存 + 测试 |
| 6 | EC | 搜索防抖 150ms 内点全选用旧关键词 | low | 直接修正（取当前输入）；patch |
| 7 | BH | `motion-reduce` 可能被 `max-[768px]:translate-y-full` 覆盖 | maybe-false | 需查生成 CSS 顺序；随 patch 核实 |
| 8 | BH | `aria-controls` 指向未渲染元素且 id 随过滤变化 | low | 直接修正；patch |
| 9 | EC | 重试/清除搜索后焦点落到 body | low | 直接修正；patch |
| 10 | BH | 调试入口不校验平台参数 | low | 直接修正；patch |
| 11 | VG | 专辑展开、收藏读取失败/为空、Tab 焦点环、权重方向键、确认中被接管、重复注入关闭面板均无测试 | medium | 撤掉对应代码不会有测试失败；patch：补测试 |
| 12 | BH | 移动端系统返回不关闭面板（companion 要求） | — | 需改宿站 iframe history，有风险；交由用户在验收点决定实现或改 companion 为非目标 |
| 13 | BH | companion 主题判定写「侧栏 data-imw-theme」与代码 `!window.theme` 不符 | low | 代码与进度浮窗实际判定一致，companion 括注有误；由 bmad-spec 修正 companion |
| 14 | BH | 打开期间宿站切主题面板不跟随 | low | 罕见且需订阅主题变化，驳回 |
| 15 | EC | `alignWithFavorites` 永不返回时面板卡死 | low | IndexedDB 挂起未见先例，需加超时分支，驳回 |
| 16 | EC | returnFocus 不可聚焦时焦点留在将移除的对话框 | low | 罕见且随后落到 body 无功能损失，驳回 |
| 17 | VG | `AGENTS.md`「无测试、build 即全部验证」已过时 | low | 改 agent 上下文文件，defer |
| 18 | 子代理报告 | `MediaProgress.tsx` 的 `hov:bg-black/10` 缺 `hover:`，支持悬停的设备上常亮 | low | 既有问题非本 story，defer |

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: tsc 与 vite 构建成功
- `npx prettier --check <改动文件>` -- expected: 通过

**Manual checks (if no CLI):**
- 真机：在 `messages.html` 控制台调 `window.iirosemedia.openShufflePicker()`：桌面与移动视口、深浅主题各开一次，按 companion「验收清单（视觉）」逐项检查。
