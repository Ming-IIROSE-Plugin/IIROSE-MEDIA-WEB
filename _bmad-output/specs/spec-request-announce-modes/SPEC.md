---
id: SPEC-request-announce-modes
companions: []
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# 点播播报三档模式（发卡片 / 静默 / 批量总结）

## Why

部分用户反馈需要「静默点歌」——点播媒体时不想让聊天区出现点歌卡片。现状插件对每次点播都逐个发送媒体卡片，批量点播（歌单/专辑/分P）时会刷屏。为此把「点播如何播报」做成用户可选的三档模式，在保留现状体验（发卡片）的前提下，给用户静默与紧凑总结两种新选择。

## Capabilities

- **CAP-1**
  - **intent:** 用户可在设置面板中选择点播播报模式：发卡片、静默、批量总结，选择持久化保存。
  - **success:** 设置面板呈现三档选项；切换后刷新页面设置保留；未设置时默认为发卡片，行为与现状完全一致。

- **CAP-2**
  - **intent:** 静默档下，用户点播任何媒体时聊天区不出现点歌卡片，媒体仍照常播放给房间。
  - **success:** 静默档点播单曲后，房间内其他用户能听到播放，聊天区无任何点播卡片。

- **CAP-3**
  - **intent:** 总结档下，单曲点播仍发卡片；批量点播（≥2 项：歌单/专辑/分P 多选等）不逐个发卡片，改为发送一条 markdown 总结消息（标题+数量，平台有集合简介时附简介）。
  - **success:** 总结档批量点播 N（≥2）项内容后，聊天区仅出现一条总结消息，无逐曲卡片；单曲点播仍出现与现状一致的卡片。

## Constraints

- 媒体卡片与播放触发是两个独立 socket 报文（`mediaCard` / `mediaEvent`）：静默档与总结档只跳过卡片报文，`mediaEvent` 必须照发，否则播放中断。
- 卡片发送散落在各平台类（NetEase / Bilibili / Radio / JOOX 等各自调用 `media.mediaCard()` + `socket.send()`）：三档播报判定必须收敛为统一入口，防止漏改个别平台。
- 总结消息走 `Socket.sendMessage` 公聊文本通道；消息内换行必须以 `\n` 转义形式嵌入 JSON 报文，不能是裸换行。
- 总结消息格式（2026-10-20 真机反馈修订）：首行 `\\\*`（三个反斜杠+星号，宿站 markdown 触发写法），第二行 `🎵 已提交点播 **《标题》**，共 **N** 项`（「已提交」不用确定语气，实际播放数可能 < N）；平台 API 有集合简介（网易云歌单/专辑 description、B 站 desc）时第三行追加 `> 简介`（标题与简介剥 HTML、转义 markdown 元字符、按码点截断 ≤120 含省略号）；无简介不带详情行。
- 播报模式持久化沿用 PluginSettings/localStorage 既有模式；未设置或非法值一律回退「发卡片」（单点归一化，同 `searchViewMode` 的处理方式）。
- 设置仅入设置面板，不占用顶栏按钮位。

## Non-goals

- 不做顶栏快捷切换按钮。
- 总结不含曲目列表（截断列表也不做）；「详情」仅指集合简介。
- 不按平台差异化播报：三档对所有平台全局统一生效。

## Success signal

在 iirose.com 真实房间验证：默认档点播表现与现状完全一致；静默档房间可听到播放但聊天区无卡片；总结档批量点播 N≥2 项时聊天区仅出现一条 `\\\*` 开头、markdown 排版的总结（有简介的平台附 blockquote 简介）。

## Assumptions

- 总结正文措辞未定稿，假定形如「已点播《XX》共 N 首」（标题+数量）；具体文案可在实现时微调。
