---
id: bug-fix-media-progress-control
type: bug
title: "修复媒体进度控制与侧栏入口样式"
parent: none
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
severity: P2
---

# 修复媒体进度控制与侧栏入口样式

## Description

当前进度浮窗把「快进/快退」作为普通公聊文本发送，宿站只显示提示而没有改变媒体位置；侧栏新增入口也使用了与宿站主题不匹配的空白描边按钮。修复发送链路并重做入口，使控件真正调用宿站的媒体控制解析，同时在浅色和深色侧栏中清楚、紧凑、可发现。

## Acceptance Criteria

原始验收标准、实现与审查记录保留在 [bugfix-fix-media-progress-control-plan.md](bugfix-fix-media-progress-control-plan.md)(v6 构建记录,已完成)。

## References

- plan — _bmad-output/backlog/bugfix-fix-media-progress-control-plan.md

## Notes

- Decision: 2026-11-06 由 v6 迁入,状态 done,不重新打开。
