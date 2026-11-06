---
topic: 点播播报三档模式（发卡片/静默/批量markdown总结）
updated: 2026-10-20T17:45
---

- (direction) 部分用户需要静默点歌：点播时不向聊天区发送点歌卡片
- (decision) 做三档播报模式：①发卡片（现状）②静默（不发卡片）③批量点播时以 markdown 发送一条总结；默认档为发卡片
- (decision) 档位③触发条件：任何批量点播数量≥2（歌单/专辑/分P多选等）即总结；单曲仍发卡片
- (decision) markdown 总结内容：标题+数量，紧凑一行，不含曲目列表
- (decision) 三档设置仅放设置面板持久化，不做顶栏快捷切换
- (decision) 总结消息格式固定：反斜杠星号（\*）单独一行，正文从第二行开始
- (decision) 静默档仅不发媒体卡片，媒体照常播放给房间
- (constraint) 媒体卡片与播放触发是两个独立 socket 报文（mediaCard / mediaEvent）：静默档与总结档只跳过卡片报文，mediaEvent 必须照发，否则播放中断
- (constraint) 总结消息走 Socket.sendMessage 公聊文本通道；消息内换行必须以 \n 转义形式嵌入 JSON 报文，不能是裸换行
- (constraint) 播报模式持久化沿用 PluginSettings/localStorage 既有模式；未设置或非法值一律回退发卡片（单点归一化，同 searchViewMode）
- (constraint) 卡片发送散落在各平台类（NetEase/Bilibili/Radio/JOOX 等各自 media.mediaCard()+socket.send）：三档判定需收敛为统一入口，防止漏改平台
- (capability) CAP-1 用户可在设置面板三档选择点播播报模式（发卡片/静默/批量总结），持久化保存，默认发卡片
- (capability) CAP-2 静默档：点播任何内容不向聊天区发卡片，媒体照常播放
- (capability) CAP-3 总结档：单曲仍发卡片；批量≥2 不逐个发卡片，改发一条 markdown 总结（标题+数量）
- (note) 非目标：不做顶栏快捷切换；总结不含曲目列表（含截断列表）；不按平台差异化播报（全局统一三档）
- (assumption) 总结正文措辞未定稿，假定形如「已点播《XX》共 N 首」（标题+数量）；措辞可在实现时微调
- (event) 自检通过（Pass 1 一致性）：CAP-1~3 均含 intent+success；约束均可改变设计；非目标 3 条显式；成功信号可真机验证；无 open question，无需 companion
- (event) 自检通过（Pass 2 保全）：源输入全部承重项（静默需求、三档、≥2 总结、标题+数量、设置面板入口、\* 格式、默认发卡片、静默仅不发卡片）均已落入 SPEC；无 wrapper-only 遗留
- (direction) 真机反馈修订（2026-10-20）：总结首行应为三个反斜杠+星号（\\\*），一个反斜杠不触发宿站 markdown
- (direction) 总结正文用 markdown 美化：🎵 + 标题/数量加粗
- (decision) 总结消息在平台有集合简介时附简介（网易云歌单/专辑 description、B 站 desc），压平单行 blockquote、超 120 字符截断；没详细介绍就不带
- (decision) 复盘行动项（2026-10-20）：标题与简介必须净化——剥 HTML 标签（B站 desc 常含 <br>）、转义 markdown 元字符、trim；简介按码点截断 119+省略号（≤120，防 emoji 劈代理对）；纯空白标题也走兜底「批量点播」
- (event) 复盘复审（bmad-review 三镜头）新发现 12 项：F1-F7 微修已执行（截断/净化/trim/封套 mc·i 断言/WebSocket stub 还原/面板 icon 随档切换）；F8/F9/F12 defer（抑制窗口无批次作用域，合并后续 spec）；F10/F11 开放问题待人定夺。verdict: accepted-with-open-items，见 RETROSPECTIVE.md
- (decision) 复盘开放问题裁定（2026-10-20）：F10 措辞改为「已提交点播」（不用确定语气，无版权跳过时实际播放数可能 < N）；F11 维持档位名「静默」不加说明；F7 后半已做重构——SettingData 增加强制 key 字段，面板同步改按 key 匹配，全部 26 行设置项已赋 key
