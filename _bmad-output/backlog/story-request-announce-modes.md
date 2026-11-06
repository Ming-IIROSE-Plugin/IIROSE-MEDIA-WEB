---
id: story-request-announce-modes
type: story
title: "点播播报三档模式（发卡片 / 静默 / 批量总结）"
parent: none
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
---

# 点播播报三档模式（发卡片 / 静默 / 批量总结）

## Description

部分用户反馈需要「静默点歌」——点播媒体时不想让聊天区出现点歌卡片。现状插件对每次点播都逐个发送媒体卡片，批量点播（歌单/专辑/分P）时会刷屏。为此把「点播如何播报」做成用户可选的三档模式，在保留现状体验（发卡片）的前提下，给用户静默与紧凑总结两种新选择。

## Requirements

Verify: 在 iirose.com 真实房间验证：默认档点播表现与现状完全一致；静默档房间可听到播放但聊天区无卡片；总结档批量点播 N≥2 项时聊天区仅出现一条 `\\\*` 开头、markdown 排版的总结（有简介的平台附 blockquote 简介）。

Criteria (摘自 v6 SPEC 的 Capabilities):

1. **CAP-1** 用户可在设置面板中选择点播播报模式：发卡片、静默、批量总结，选择持久化保存。 — 成功标准:设置面板呈现三档选项；切换后刷新页面设置保留；未设置时默认为发卡片，行为与现状完全一致。
2. **CAP-2** 静默档下，用户点播任何媒体时聊天区不出现点歌卡片，媒体仍照常播放给房间。 — 成功标准:静默档点播单曲后，房间内其他用户能听到播放，聊天区无任何点播卡片。
3. **CAP-3** 总结档下，单曲点播仍发卡片；批量点播（≥2 项：歌单/专辑/分P 多选等）不逐个发卡片，改为发送一条 markdown 总结消息（标题+数量，平台有集合简介时附简介）。 — 成功标准:总结档批量点播 N（≥2）项内容后，聊天区仅出现一条总结消息，无逐曲卡片；单曲点播仍出现与现状一致的卡片。

## References

- plan — _bmad-output/backlog/feature-request-announce-modes-plan.md
- spec (v6, archived) — _bmad-output/initiative-iirose-media-web/archive-v6/spec-request-announce-modes/SPEC.md
- retrospective — _bmad-output/backlog/story-request-announce-modes-retrospective.md
- companion — _bmad-output/backlog/request-announce-modes-.memlog.md

## Notes

- Decision: 2026-11-06 由 v6 迁入,状态 done,不重新打开。
- Assumption: 总结正文措辞未定稿，假定形如「已点播《XX》共 N 首」（标题+数量）；具体文案可在实现时微调。
