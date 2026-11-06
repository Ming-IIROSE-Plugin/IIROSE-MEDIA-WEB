---
id: story-search-view-toggle
type: story
title: "搜索结果视图切换（卡片 / 列表）"
parent: none
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
---

# 搜索结果视图切换（卡片 / 列表）

## Description

要解决的痛点：搜索结果目前只有卡片视图——以方形封面为主的网格，浏览直观但信息密度低。当用户想在一页结果里快速按标题/作者定位某条内容时，卡片网格需要反复扫视大图，效率低。高密度列表视图让"找特定条目"的场景更快，两种视图覆盖两类浏览意图。

## Requirements

Verify: 搜索后在任一入口切换，结果即时换视图且两处入口状态同步；切到列表后刷新页面，列表视图保持；768px 以下窄屏切换按钮可用、列表行完整不裁切；`npm run build` 通过。

Criteria (摘自 v6 SPEC 的 Capabilities):

1. **CAP-1** 用户可在搜索结果页将结果在卡片视图（默认）与列表视图之间切换，切换即时作用于当前已加载的结果集。 — 成功标准:搜索出结果后点击任一切换入口，结果区立即在卡片网格与列表之间切换，无需重新搜索或整页刷新。
2. **CAP-2** 用户可通过两个入口切换视图——搜索栏上的快捷切换按钮、设置页的开关——且两处显示的状态始终一致。 — 成功标准:在搜索栏切换后打开设置页，开关状态与当前视图一致；反之在设置页切换后返回搜索页，结果视图随之改变。
3. **CAP-3** 插件记住用户上次的视图选择，重新打开或刷新后无需重新设置。 — 成功标准:切到列表视图后刷新页面/重新呼出插件，搜索结果仍以列表视图呈现。

## References

- plan — _bmad-output/backlog/feature-search-view-toggle-plan.md
- spec (v6, archived) — _bmad-output/initiative-iirose-media-web/archive-v6/spec-search-view-toggle/SPEC.md
- retrospective — _bmad-output/backlog/story-search-view-toggle-retrospective.md
- companion — _bmad-output/backlog/search-view-toggle-.memlog.md

## Notes

- Decision: 2026-11-06 由 v6 迁入,状态 done,不重新打开。
- Assumption: 列表行保留每条结果的全部动作：播放、选集/选歌（multiPage 时）、封面跳转链接。
- Assumption: loading / error / 空结果的占位样式不随视图切换变化。 <!-- Open Questions 已于 2026-10-10 拍板：列表行 72px 缩略图 / 行高约 96px、移动端切换按钮固定搜索栏最左缘（空间不足只留 44px 图标），均已实现，列表不再保留。 -->
