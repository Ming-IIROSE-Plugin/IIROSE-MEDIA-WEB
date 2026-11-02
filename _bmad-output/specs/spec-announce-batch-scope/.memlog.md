---
topic: 播报批量点播的批次作用域（手动点播误吞、循环异常提示、中途切档一致性）
updated: 2026-10-20T19:39
---

- (direction) 来源：spec-request-announce-modes 复盘 F8/F9/F12，同根源三问题（Announce 抑制窗口无批次作用域），用户裁定合并开 spec
- (constraint) F8：summary 批量循环期间（可达数分钟），用户手动点播单曲的卡片被全局 batchDepth 窗口误吞——播放照常但聊天区零痕迹
- (constraint) F9：10 处 void runBatchAnnounce 调用点循环内异常成 unhandled rejection，无提示、剩余项静默不播（预先存在的模式，批量化后更明显）
- (constraint) F12：runBatchAnnounce 入口读一次档位、循环内 shouldSendCard 每卡片重读——长批次中途切档产生分裂行为（总结+逐卡双播报或反之）
- (decision) 方案方向：抑制判定改为批次作用域——批量循环内经批次上下文发送卡片（如 runBatchAnnounce 向 loop 传 ctx 或 loop 内用回调），窗口只作用于本批曲目；手动点播不携带 ctx 不受影响
- (decision) 方案方向：循环内逐项 try/catch + ShowMessage 提示失败项并继续（或整体中止提示），不再 void 裸抛；档位在批次开始时快照，循环内判定用快照
- (note) 非目标：不改变三档语义与总结消息格式（已由 spec-request-announce-modes 冻结）；不做平台层 mock 自动化（jsdom 无法承载，真机验证走 iirose-plugin-verify）
- (capability) CAP-1 手动点播不受批量窗口影响：summary 批量执行期间用户另行点播单曲，其卡片照常发送
- (capability) CAP-2 批量循环失败可见：循环内单项失败向用户提示（复用现有失败提示语义），不产生 unhandled rejection，批次其余行为不变
- (capability) CAP-3 批次档位一致性：同一次批量点播全程用进入时快照的档位判定，中途切档不影响进行中的批次
- (event) 自检通过（Pass 1 一致性）：CAP-1~3 均含 intent+success；约束均可改变设计；非目标 3 条；成功信号可真机验证
- (event) 自检通过（Pass 2 保全）：F8/F9/F12 三问题的现象、根因、方案方向全部落入 SPEC；无 companion 需求
- (decision) 开放问题裁定（2026-10-20 用户）：CAP-2 单项失败后继续播后续项——逐项 try/catch、失败曲提示+跳过、剩余照播（替代现状整批中断）；runBatchAnnounce 兜底 catch 保留为最后防线
- (note) 实现修订（2026-10-20 审查后）：CAP-1 落地为 runSingleAnnounce 单曲窗口（forceDepth 优先于批量窗口）取代早期「单曲天然不受影响」假设；快照栈长度即窗口深度（删除独立计数器）；静默档读实时值优先于快照（切 silent 立即静默、切 card 走快照）——约束与 Assumptions 已同轮修订，Open Question（失败后继续）已裁定删除
- (event) 真机验证通过（2026-10-20，Playwright 自动化）：CAP-1 批间手动点播卡片立即出现、CAP-3 中途切档快照生效（零逐曲卡）、全程无 unhandled rejection；CAP-2 失败样本真机未构造（单测+打点钉住）。实现 spec 置 done。验证教训：宿站会把 &1 事件打成 m__4@0 卡片日志、sendMessage 无日志——判断发送必须查 msgholderBox DOM；自动化须 reload 后单次注入
- (decision) deferred 项落地（2026-10-20）：①showBatchItemError 增 label 参数（去重键仍为原因、label 只进显示文案「《label》播放失败：原因」；网易云传曲名、B 站传 P{n} {part}、AllVideos 传分集名）②网易云无版权跳过改按批聚合（计数，循环结束一条「已跳过 N 首无版权曲目」）——deferred-work 对应条目已标已解决
