---
ticket: 9
title: 平台标签随数量自适应
type: feature
created: '2026-10-27'
status: done
baseline_revision: 0d30723f703838a914ae17325a6013a5b33449c7
route: dispatch
review_loop_iteration: 0
context:
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-playback-loop-shuffle/shuffle-picker-panel.md'
---
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 选择面板的平台标签固定列出网易云、B站两个，没有收藏的平台也占位；标签圆角写死为「左一个、右一个」，以后有收藏功能的平台变多时会挤、要改代码。

**Approach:** 面板打开时先算出可见平台（有收藏的平台，另加已存随机平台），只剩一个时隐藏标签行；1～3 个保持等宽分段，4 个及以上改为可横向滑动的胶囊标签；标签行抽成与平台类型无关的通用组件，圆角按首尾自动处理。

## Boundaries & Constraints

**Always:** 可见平台 = 有收藏的平台 ∪ 已存随机平台（本机有记录才算，即使其收藏已删光），按 `SHUFFLE_PLATFORMS` 顺序；全部无收藏且无记录时（仅调试入口可达）只显示 `defaultShufflePlatform(defaultPage)` 的空态；初始标签 = 已存随机平台 → 无记录时 `defaultPage` 对应平台（须在可见集内）→ 可见集第一个；可见集在打开时算一次，打开期间不随收藏变化增减；1 个：不渲染标签行；1～3 个：等宽分段（按首尾自动圆角）；≥4 个：横向滑动胶囊（按文字宽度、触控高 ≥44px、`overflow-x-auto` 不出纵向滚动、右缘渐隐提示更多、切换时选中项滚入可见区）；`role="tablist"`、`aria-orientation="horizontal"`、左右键与 Home/End 在可见平台间切换；视觉沿用现有分段与 companion 的配色、深浅主题、`max-[768px]` 断点；story 8 的标签行为（切换保留、搜索清空、确认保存改动过的平台）不变。

**Never:** 不新增平台、不改抽取与存储格式；不在打开期间增删标签；不用下拉菜单；不新增依赖。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 只有一个平台有收藏 | 网易云有收藏、B站无，无已存平台 | 不显示标签行，直接是网易云列表 | N/A |
| 两个都有收藏 | 两个平台都有收藏 | 两段等宽分段，首尾圆角 | N/A |
| 已存平台收藏删光 | 已存 B站 但 B站已无收藏，网易云有 | 显示两段，初始停在 B站（空态） | N/A |
| 默认页无收藏 | 无记录，`defaultPage`=1，B站无收藏 | 初始停在网易云 | N/A |
| 全无收藏 | 调试入口打开，两平台都无收藏 | 只显示默认平台空态，无标签行 | N/A |
| 4 个及以上 | 通用组件给 4～6 项 | 渲染为可横向滑动胶囊，触控高 ≥44px，切换后选中项可见 | N/A |
| 3 个 | 通用组件给 3 项 | 等宽分段，首尾圆角，中间无圆角 | N/A |
| 键盘 | 焦点在标签上按 ←/→/Home/End | 在可见平台间切换并移动焦点 | 只有一个可见平台时无标签可聚焦 |

</frozen-after-approval>

## Code Map

- `src/page/components/shuffle-picker/ShufflePicker.tsx:625-675` -- 现有标签行：`SHUFFLE_PLATFORMS.map` 渲染、按 `index===0` / `count-1` 写死圆角、键盘切换；抽出为通用组件，`ShufflePicker` 改按可见平台渲染。`:265-340` 初始平台与按平台懒加载（`requested`、`load(target)`），`:447` 确认时遍历 `SHUFFLE_PLATFORMS`（保持对所有平台判断改动，不受可见集影响）。
- `src/page/components/shuffle-picker/PlatformTabs.tsx`（新）-- 通用标签行：`items: { id: string; label: string }[]`、`selected`、`onSelect`、`dark`、`disabled`；按数量选择形态。
- `src/page/components/shuffle-picker/openShufflePicker.tsx:135-160,253-260` -- `loadSource`、`initialPlatform`；打开前对 `SHUFFLE_PLATFORMS` 各查一次收藏以算可见集与初始标签（结果可作为首屏数据复用，避免重复查询）。
- `src/playback/ShuffleSelection.ts:68,126` -- `shufflePlatformKey()`、`defaultShufflePlatform()`；`loadShufflePlatform` 目前在无记录时回退默认页，需要能区分「有无已存记录」。
- `src/page/index.tsx` -- 侧栏与调试入口传入初始平台的位置，按新规则调整或交给 `openShufflePicker` 计算。
- 测试：`openShufflePicker.test.ts`「平台标签」组（依赖固定两个标签的用例按新规则调整）、新增 `PlatformTabs.test.ts`（`.test.ts` 内用 `preact` 的 `h`/`render` + `act`，不写 JSX）。

## Tasks & Acceptance

**Execution:**
- [x] `src/page/components/shuffle-picker/PlatformTabs.tsx` -- 通用标签行，三种形态与键盘、自动圆角、选中项滚入视野 -- CAP-12
- [x] `ShufflePicker.tsx` / `openShufflePicker.tsx` / `ShuffleSelection.ts` / `src/page/index.tsx` -- 可见平台与初始标签规则，按可见集渲染标签 -- CAP-12
- [x] 单测 -- 覆盖 I/O 矩阵全部行，调整依赖固定两个标签的旧用例 -- 回归

**Acceptance Criteria:**
- Given 400×800 与 1280×720，when 面板打开（两平台都有收藏），then 分段标签无溢出、触控高 ≥44px，深浅主题清晰。
- Given 改动完成，when 运行 `npm test`、`npm run build`、改动文件 `prettier --check`，then 全部通过。

## Implementation Notes

- 规则抽为纯函数 `resolvePickerPlatforms`（`ShuffleSelection.ts`）。`openShufflePicker` 打开即渲染面板（读取中：无标签行、列表区「正在读取收藏…」，可 Esc/返回/接管取消），同时并发读各平台收藏（每个限时 `PREPARE_TIMEOUT_MS`=5s），算好可见集与初始标签后再渲染标签；计算期间已关闭或被接管则不再渲染。
- 打开时的读取结果只复用于初始标签的首次读取，以及各平台的失败/超时；其他标签首次切到时重新查询，能看到打开后新增的收藏（可见集仍不变）。
- 读取失败或超时的平台无法排除「有收藏」，按可见处理，切到它显示「读取收藏失败」与重试（沿用 story 8 的失败态）。
- `openShufflePicker` 的 `platform` 改为可选的强制初始标签（调试入口 `openShufflePicker('bilibili')` 用，该平台必定可见）；侧栏改传 `defaultPage` 由面板计算。
- `PlatformTabs<T extends string>` 泛型；胶囊形态只改标签行自身 `scrollLeft`（不用 `scrollIntoView`，避免带动面板/iframe 滚动），渐隐另由 `ResizeObserver` 重测；`disabled` 时 `aria-disabled` + 半透明 + not-allowed、无悬停样式；`selected` 不在 items 时漫游 tabindex 退回第一项。
- 只有一个可见平台时列表区去掉 `role="tabpanel"`，`aria-labelledby` 改指向面板标题；列表区加 `data-platform` 便于测试与调试。

- 审查后主会话真机复核（空收藏账号，400×800）：面板随打开同步出现，无标签行（全无收藏只显示默认平台空态），Esc 关闭，无溢出，单实例。
- 验证：`npm test` 617 通过，`npm run build` 通过，改动文件 prettier 通过。

## Spec Change Log

## Review Triage Log

| # | 来源 | 发现 | 判定 | 依据 / 去向 |
|---|------|------|------|------|
| 1 | BH/EC/VG | 渲染要等全部平台收藏读完：期间无对话框、Esc 无效、重复打开无反应；查询挂起时面板永不出现并阻断之后所有打开；渲染前关闭无测试 | high | 本 story 引入的异步窗口；patch：立即以加载态渲染、单平台查询超时、补渲染前关闭用例 |
| 2 | BH/EC | 预读结果沿用到各标签首次访问，期间新增收藏不显示 | medium | patch：预读只用于初始标签 |
| 3 | BH | 「打开期间收藏增减不改变标签」用例不可能失败 | medium | 搜索不重查；patch：改走重查路径 |
| 4 | BH | 调用次数断言写死为平台数 | low | 直接改为按平台数表达；patch |
| 5 | BH/EC | `scrollIntoView` 会滚动祖先容器且挂载时即触发 | low | 直接改为设置 scrollLeft；patch |
| 6 | BH/EC | 右缘渐隐不随尺寸变化重算 | low | 只影响 4 个以上形态；改动小，patch |
| 7 | BH | `disabled` 无 aria/视觉表达 | low | 直接修正；patch |
| 8 | BH/EC | `selected` 不在 items 时标签行键盘不可达 | low | 通用组件不变式，直接修正；patch |
| 9 | BH | 组件未按 id 类型泛型，需强转 | low | 直接修正；patch |
| 10 | BH | 面板初始标签规则与控制器回退规则不一致 | false | 随机只能经面板确认点亮，确认即存平台，控制器回退规则不会在点亮时生效 |

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 构建成功
- `npx prettier --check <改动文件>` -- expected: 通过

**Manual checks (if no CLI):**
- 真站：只有一个平台有收藏时无标签行；两个都有时分段正常；4 个以上形态只能由单测与组件级渲染验证（当前只有两个有收藏功能的平台）。
