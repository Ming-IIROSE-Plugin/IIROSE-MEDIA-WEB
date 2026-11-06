---
id: story-music-search-back-to-recent
type: story
title: "音乐模式搜索后回到最近点播"
parent: none
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
---

# 音乐模式搜索后回到最近点播

## Description

要解决的痛点：音乐模式搜索过一次后，用户就回不到「最近点播」首屏。空词提交被 `submitSearch` 直接忽略（`src/page/mainAppContainerController.ts:96`），只能刷新页面。想重点刚点过的歌时，只能重新搜索。

## Requirements

Verify: - 在音乐模式搜索一首歌、切到「专辑」范围后点清除钮，直接看到「单曲」范围下的「最近点播」且没有新的网络请求；再用聊天框 `@` 搜同一个词，能正常出结果。

Criteria (摘自 v6 SPEC 的 Capabilities):

1. **CAP-1** 用户可以在音乐模式一键清除搜索词并回到最近点播。 — 成功标准:输入框有内容时显示清除钮，为空时不显示；点击后输入框清空、焦点留在输入框（手机不因此弹出键盘）；已搜索状态下结果区显示「最近点播」、页码归 1，停在专辑 / 歌单 / MV 时范围切回「单曲」，内页开着时一并退出；在首屏点击只清空未提交的输入，列表不重载。
2. **CAP-2** 用户手动删空搜索词后提交，也能回到最近点播。 — 成功标准:已搜索状态下删空输入后，回车或点「搜索」的结果与 CAP-1 相同；删字过程中结果区不变、不发请求；已在首屏时空提交无任何变化。
3. **CAP-3** 用户回到首屏后可以照常再次搜索。 — 成功标准:回到首屏后，用搜索栏或聊天框 `@` 搜索任意关键词（含刚清除的同一个词）都能发起搜索并显示结果。

## References

- plan — _bmad-output/backlog/feature-music-search-back-to-recent-plan.md
- spec (v6, archived) — _bmad-output/initiative-iirose-media-web/archive-v6/spec-music-search-back-to-recent/SPEC.md
- companion — _bmad-output/backlog/music-search-back-to-recent-.memlog.md

## Notes

- Decision: 2026-11-06 由 v6 迁入,状态 done,不重新打开。
- Assumption: `@` 同词复搜属于本次范围：回到首屏后状态应当干净。
- Assumption: 未提交的输入也算「有内容」，所以首屏也显示清除钮。
