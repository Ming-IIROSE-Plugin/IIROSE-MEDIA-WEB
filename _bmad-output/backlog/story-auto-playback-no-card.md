---
id: story-auto-playback-no-card
type: story
title: "自动播放不发点播卡片（单曲循环 / 收藏随机）"
parent: none
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
---

# 自动播放不发点播卡片（单曲循环 / 收藏随机）

## Description

痛点是风险，不是功能缺口：宿站把聊天区的点播卡片（`m__4` 媒体卡片）计为平台活跃度。单曲循环与收藏随机是无人值守的重复动作——一首歌每播完就发一张卡、随机续播每首一张卡——短时间内连发多张，很容易被平台或房间管理者看作「用插件刷活跃度」。用户要求：这两条自动路径无论全局播报档位设成什么都不发卡片；播放本身照常（只发 `&1` 播放报文），房间照常听到。

## Requirements

Verify: 在 iirose 真实房间把档位设为「发卡片」，同时跑单曲循环与收藏随机各连续 3 次：聊天区零 `m__4` 卡片，播放连续无中断；随即手动点播一首，卡片照常出现。

Criteria (摘自 v6 SPEC 的 Capabilities):

1. **CAP-1** 单曲循环在任意播报档位下重播当前曲目时，聊天区不出现点播卡片，房间仍重新起播同一首。 — 成功标准:档位为「发卡片」时开启单曲循环，连续跨 3 次循环（缓存报文重播、本人 cut 后重播、拖到结尾后重播三种触发各至少一次），聊天区无 `m__4` 卡片、房间播放不中断且每次都从开头重新播放。
2. **CAP-2** 收藏随机在任意播报档位下自动起播下一首时，聊天区不出现点播卡片，房间仍切到该曲目。 — 成功标准:档位为「发卡片」时开启收藏随机，连续跨 3 首（覆盖收藏里的单曲、视频与歌单/专辑内抽中曲目），聊天区无点播卡片、房间逐首正常切换，回读标题与预取目标一致。
3. **CAP-3** 压制只作用于这两条自动路径，其余点播入口行为不变。 — 成功标准:同一会话内循环/随机运行期间手动点播单曲、整张、选集、电台、`@` 直链，仍按当前全局档位发出卡片；关闭两个开关后手动点播与改动前完全一致。

## References

- spec (v6, archived) — _bmad-output/initiative-iirose-media-web/archive-v6/spec-auto-playback-no-card/SPEC.md
- retrospective — _bmad-output/backlog/story-auto-playback-no-card-retrospective.md
- companion — _bmad-output/backlog/auto-playback-no-card-.memlog.md
- companion — _bmad-output/backlog/auto-playback-no-card-card-send-paths.md

## Notes

- Decision: 2026-11-06 由 v6 迁入,状态 done,不重新打开。
- Assumption: 静默档已实测证明只发 mediaEvent 即可起播（`spec-request-announce-modes` CAP-2），因此卡片不是起播前提；循环重播用的缓存报文走的也是同一条 mediaEvent 通道。**已由维护者 2026-11 真机确认**：循环重播只发 `&1` 时宿站照常重新起播，原「若只发报文不起播怎么办」的取舍问题作废。
