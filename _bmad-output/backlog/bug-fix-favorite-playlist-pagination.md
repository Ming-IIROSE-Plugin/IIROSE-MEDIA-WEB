---
id: bug-fix-favorite-playlist-pagination
type: bug
title: "修复收藏页面歌单选集分页跳转异常"
parent: none
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
severity: P2
---

# 修复收藏页面歌单选集分页跳转异常

## Description

Problem: 收藏页面中的歌单（或专辑、多分P视频）点击「选集/选歌」进入多集列表后，在翻到第二页时，触发了外层收藏导航动作导致重新拉取 IndexedDB 收藏列表，而非对当前歌单选集内全量数据（`allMediaData`）进行翻页。

## Acceptance Criteria

原始验收标准、实现与审查记录保留在 [bugfix-fix-favorite-playlist-pagination-plan.md](bugfix-fix-favorite-playlist-pagination-plan.md)(v6 构建记录,已完成)。

## References

- plan — _bmad-output/backlog/bugfix-fix-favorite-playlist-pagination-plan.md

## Notes

- Decision: 2026-11-06 由 v6 迁入,状态 done,不重新打开。
