---
title: '设置、关于与其余页面'
type: 'feature'
created: '2026-10-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '3941929a10f454ad2682cca37e25f2843e75de2d'
context:
  - '{project-root}/_bmad-output/specs/spec-main-panel-visual-unify/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-main-panel-visual-unify/visual-language.md'
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 主面板的设置页与关于页（都由 `SettingCard` 渲染）仍是旧样式：半透明白底、固定深灰字、大号字体图标，在柔灰（浅色）与深色表面上都格格不入；深色下文字几乎看不清。其余零散页面可能仍有旧样式残留。

**Approach:** `SettingCard` 改为与搜索结果卡片同一语言（浅色白卡 + 细描边 + 轻阴影，深色次级表面 + white/10 描边，文字用主题令牌，图标与当前值用 `--imw-accent-ink`，可点区域有悬停/按压反馈）；排查主面板内其余页面（收藏视图、多源剧集、子页面/选集、加载与空状态以外的提示块）并清理剩余旧样式，使浅色与深色两套都统一。

## Boundaries & Constraints

**Always:** 设置卡：保持现有结构与尺寸（标题区 + 动作区、200px 卡高、网格排布与移动端约定），只换外观；标题区为次要文字色 + 主题分隔线；图标（字体图标 `font-md`）与动作标题用 `--imw-accent-ink`（深色为天蓝）；动作区整块可点，悬停 `--imw-accent`/8、按压 /15（`hov:` 门控、按压 `duration-N!`）；开关类设置的「已开启/已关闭」等状态文字可读，开启态用强调色；颜色只取 `floating-panel` 的 `themed*` 令牌与强调变量，不硬写 `#424242`、`bg-white/50`；悬浮收藏星（卡片封面上）保持现状不变；排查 `src/page` 下主面板组件中剩余的硬编码浅色/深色/品牌色（`text-white`、`bg-white/`、`text-[#…]`、行内 `style` 颜色），在不改功能的前提下改为令牌；所有点击、设置项行为、云同步流程（宿站弹窗）不变。

**Never:** 不改设置项内容、文案、顺序或逻辑；不改宿站弹窗；不改浮窗；不改布局尺寸约定；不新增依赖、SCSS；不借用宿站 `mdi-*` 类以外新增（既有 `mdi-*` 字体图标保持原样）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 浅色设置 | 设置 → 各平台/插件设置 | 柔灰底上白卡、强调色图标与状态，文字清晰 | N/A |
| 深色设置 | 宿站深色 | 深色卡片、天蓝图标与状态、文字清晰 | N/A |
| 关于页 | 关于 | 同设置卡语言 | N/A |
| 开关项 | 切换某开关 | 状态文字更新、开启态强调色，行为不变 | N/A |
| 其余页面 | 收藏视图、多源剧集、选集子页 | 无旧样式残留，浅深两套一致 | N/A |
| 移动端 | 400×800 | 设置卡排布与尺寸不变、无溢出 | N/A |

</frozen-after-approval>

## Code Map

- `src/page/components/SettingCard.tsx:43-62` -- 旧样式（`bg-white/50 backdrop-blur`、`text-[#424242]`、`commonBoxHead` 覆盖色、`whoisTouch2` 动作区）。
- `src/page/MainAppContainerServices/SettingsService.ts`、`AboutService.ts` -- 设置/关于数据（只读，了解渲染了哪些项）。
- `src/app.css` -- 若有 `IMW-SettingCard`/`commonBoxHead` 相关规则需同步。
- `src/page/components/floating-panel/floatingPanel.tsx` -- `themed*` 令牌、`accentText`、`pressTone` 等（复用，必要时补设置卡令牌）。
- 其余：`src/page/MainAppContainer.tsx` 中收藏视图、多源剧集、子页面渲染分支；`src/page/components/media-card-container/` 已在 story 2 完成，不再改。
- 测试：新增 `SettingCard` 渲染断言（浅深令牌、强调色、无硬编码颜色）；`SettingsService.test.ts` 等既有测试须通过。

## Tasks & Acceptance

**Execution:**
- [x] `SettingCard.tsx` -- 新卡片语言（浅深两套） -- CAP-4
- [x] 其余页面残留旧样式清理 -- CAP-4
- [x] 单测 -- 覆盖 I/O 矩阵可单测部分；既有测试全部通过 -- 回归

**Acceptance Criteria:**
- Given 真站 1280×720 与 400×800、浅色与深色，when 打开设置（B 站、网易云、无线电、插件设置）与关于，then 卡片与搜索结果卡片同一语言、文字清晰、无溢出。
- Given 改动完成，when 运行 `npm test`、`npm run build`、改动文件 `prettier --check`，then 全部通过。

## Implementation Notes

- 实现：只改 SettingCard（主题卡片、强调色图标与取值、按压态、移动端标题两行截断）；其余页面排查后无需改动。审查后恢复宿站类覆盖的 `!`、空标题兜底、长标题断行。
- 验证：`npm test` 全部通过，`npm run build` 通过，prettier 通过；真站 32 张截图（子代理）。

## Spec Change Log

## Review Triage Log

| # | 来源 | 发现 | 判定 | 依据 / 去向 |
|---|------|------|------|------|
| 1 | BH/EC/VG | `commonBoxHead`（宿站类）覆盖去掉了 `!`，宿站夜间主题样式可能重新盖过标题区 | medium | ad03018 曾专为此加 `!`；真站截图只改了 JS 主题变量、未加载宿站夜间样式表；patch：恢复 `!` + 测试 |
| 2 | BH | 动作回调不带标题时 `startsWith` 报错 | low | patch：空值兜底 + 测试 |
| 3 | BH | 长英文无断点标题可能横向溢出 | low | patch：`[overflow-wrap:anywhere]` |
| 4 | EC | 深色下标题色依赖继承 | false | 标题区强制 `text-inherit!`，继承卡片主题文字色 |
| 5 | BH | 设置卡图标借用宿站 `mdi-*` 类 | low | 既有做法、非本 story 引入；defer |
| 6 | BH | 动作区是 div、无键盘可达 | low | 既有问题；defer |
| 7 | BH | 测试与组件共用令牌、证明力弱；移动端标题类未测 | low | 驳回（令牌断言是本仓惯例，视觉由真站截图覆盖） |
| 8 | BH | 触屏无悬停提示 | low | 与全站 `hov:` 约定一致，驳回 |
| 9 | BH | vitest.config 注释过时 | low | 驳回（下次动配置时一并） |
| 10 | EC | 其余页面无改动 | false | 子代理已排查，其余页面复用 story 2 组件，仅剩刻意保留的封面胶囊与收藏星 |

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 构建成功
- `npx prettier --check <改动文件>` -- expected: 通过
