---
id: story-netease-search-failover
type: story
title: "网易云搜索失败检测与代理切换重试"
parent: none
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
---

# 网易云搜索失败检测与代理切换重试

## Description

用户在搜索网易云歌单/专辑时经常遇到两类线上失败：① 代理出口 IP 触发网易云反爬风控（HTTP 200 + `code: -462`，要求完成加密页验证）；② 腾讯 SCF 网关 3 秒函数超时（HTTP 433，`Invoking task timed out after 3 seconds`）。当前代码只判 `response.ok`、从不读业务 `code`，两层失败都被吞成静默空列表，用户以为搜不到；且无超时无重试。失败是概率性的（同一节点下次请求大概率成功），所以策略是「失败即换节点重试、新请求仍回主节点」，而非封禁或粘住。影响所有使用网易云搜索/详情链路的用户。

## Requirements

Verify: 在 iirose.com 实测：搜索歌单/专辑触发 `code: -462` 或 HTTP 433 时，一次换节点重试内拿到正常结果，且下一个新请求仍从优先节点发起；重试也失败时，用户看到明确的风控/超时原因提示——任何情况下都不再出现「静默空列表」。运行时验证环节须实测「歌单/专辑 vs 搜歌」的失败触发频率差异，验证或推翻当前推断，结果回写本 spec。

## References

- plan — _bmad-output/backlog/feature-netease-search-failover-plan.md
- spec (v6, archived) — _bmad-output/initiative-iirose-media-web/archive-v6/spec-netease-search-failover/SPEC.md
- retrospective — _bmad-output/backlog/story-netease-search-failover-retrospective.md
- companion — _bmad-output/backlog/netease-search-failover-.memlog.md
- companion — _bmad-output/backlog/netease-search-failover-failure-modes.md
- companion — _bmad-output/backlog/netease-search-failover-runtime-observations.md

## Notes

- Decision: 2026-11-06 由 v6 迁入,状态 done,不重新打开。
- Assumption: 「多发于搜歌单/专辑」仍为推断（type 1000/10 大响应体 + 连带 `n=100000` 详情请求），已列为运行时验证的必测项（见 Success signal）。
