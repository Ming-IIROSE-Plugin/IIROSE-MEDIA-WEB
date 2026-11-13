---
title: '点歌台入口：没有触屏时只给显示 / 隐藏胶囊两档'
type: 'feature'
ticket: '10'
created: '2026-11-13'
status: done
baseline_revision: 'd5300b73e80230567a5d78d98a6c4b8615893628'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['self']
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 第二轮复盘 F-A4：没有触屏的电脑用不了双指下滑，「点歌台入口」四档里有三档在电脑上效果一样（都是有胶囊），选了「只用双指下滑」又会以为面板打不开了（其实只剩 Alt+S 和聊天框 `@词`）。

**Approach:** 没有触屏时，设置行和选择框换一种说法，只给两档：「显示胶囊」「隐藏胶囊（Alt+S / @词 打开）」。存档还是原来四个值：「隐藏胶囊」存 `swipe`；「显示胶囊」若存档已是三种有胶囊的档之一就原样保留，原来是 `swipe` 就回到默认 `pillSwipe`。有触屏（含触屏笔记本）照旧四档。

## Boundaries & Constraints

**Always:** 判断「有没有触屏」只看 `navigator.maxTouchPoints > 0` 或 `(any-pointer: coarse)`；存档格式、归一化、默认值不变；胶囊挂卸、双指下滑放行、开合动画的判定不变（仍只看 `panelEntryShowsPill` / `panelEntryAllowsSwipe`）；写盘失败照旧提示并保持原值。

**Never:** 不迁移旧存档；不在电脑上悄悄改用户已选的档；不新增 SCSS，不借宿站 `mdi-*` 类。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| 无触屏，有胶囊的三档 | `pillSwipe` / `pillSwipeClose` / `pill` | 设置行显示「显示胶囊」 |
| 无触屏，`swipe` | `swipe` | 设置行显示「隐藏胶囊（Alt+S / @词 打开）」 |
| 无触屏打开选择框 | 任意 | 只有两项：显示胶囊 / 隐藏胶囊 |
| 无触屏选「显示胶囊」 | 原来 `pill` | 存档仍是 `pill`，胶囊在 |
| 无触屏选「显示胶囊」 | 原来 `swipe` | 存档变 `pillSwipe`，胶囊立即挂上 |
| 无触屏选「隐藏胶囊」 | 原来任意 | 存档 `swipe`，胶囊立即卸下；Alt+S 能开能关 |
| 有触屏 | 任意 | 与 12.9 完全相同（四档、原文案） |

</frozen-after-approval>

## Code Map

- `src/settings/pluginSettings/touchScreen.ts`（新） -- `hasTouchScreen()`。
- `src/settings/pluginSettings/PluginSettings.ts` -- `parsePanelEntry` 按有无触屏出文案；`setPanelEntry` 无触屏只给两项，「显示胶囊」的值按当前存档决定。
- `src/app.css` -- 「隐藏胶囊」图标（eye-off）。
- 测试：`PluginSettings.test.ts`、`SettingsService.test.ts`（现有四档用例显式设成有触屏）。
- 真站：`scripts/verify/entry.mjs` 加一段桌面尺寸（无触屏）检查。

## Tasks & Acceptance

**Execution:**
- [ ] `touchScreen.ts` + `PluginSettings.ts` -- 两种说法与两档选项。
- [ ] `app.css` -- 图标。
- [ ] 测试 -- 覆盖矩阵每一行。
- [ ] `entry.mjs` -- 桌面两档。

**Acceptance Criteria:**
- Given 无触屏桌面真站，when 打开「点歌台入口」，then 只有两项；选「隐藏胶囊」后胶囊卸下、Alt+S 能开能关；选「显示胶囊」后胶囊回来。
- Given 手机尺寸真站，when 跑 `entry.mjs` 原有部分，then 全过。

## Implementation Notes

- 直接在主会话实现。触屏判断放在独立的 `touchScreen.ts`，只被 `PluginSettings` 的文案和选择框用；胶囊挂卸与手势放行仍只看存档，不看设备。
- 「显示胶囊」那项的值在打开选择框时按当前存档算出（有胶囊的档原样、`swipe` 回 `pillSwipe`），回调仍是同一个 `savePanelEntry`，写盘失败的处理不变。
- 图标：「显示胶囊」用 pill（F0402），「隐藏胶囊」用 eye-off（F0209，早于 F0CB8）；真站截图两个字形都在。
- 验证：`npm test` 1602 过、`npm run build` 过；`entry.mjs` 24/24（手机四档 17 项 + 桌面无触屏 7 项）。
- 反向验证：`hasTouchScreen` 恒返回 true 时，`entry.mjs`「桌面：选择框只有两项」FAIL（看到四项），单测「没有触屏」一组同样失败。

## Plan Change Log

## Review Triage Log

- 2026-11-13 改动小（文案与选项两处），只做自查，没有另起审查：确认 `parsePanelEntry` 的默认参数在写盘回报时与选择框一致；jsdom 没有 `maxTouchPoints`，原有四档用例都显式设成有触屏。

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 成功
- `node scripts/verify/entry.mjs` -- expected: 全过
