---
id: SPEC-announce-batch-scope
companions: []
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# 播报批量点播的批次作用域（announce-batch-scope）

## Why

「点播播报三档模式」（spec-request-announce-modes）复盘发现三个同根源问题：批量抑制窗口是模块级全局深度计数（`src/iirose_func/Socket/Announce/index.ts` 的 `batchDepth`），没有批次作用域——①summary 大批次执行期间（逐曲网络请求，可达数分钟），用户手动点播的单曲卡片被误吞（播放照常、聊天区零痕迹）；②10 处 `void runBatchAnnounce` 调用点循环内异常成 unhandled rejection，无提示、剩余项静默不播；③档位在入口读一次而循环内逐卡片重读，长批次中途切档产生「总结+逐卡」分裂行为。用户裁定三者合并为一个后续 spec 修复。

## Capabilities

- **CAP-1**
  - **intent:** 用户在批量点播执行期间另行点播单曲时，该单曲的媒体卡片照常发送，不受批量抑制窗口影响。
  - **success:** summary 档批量循环挂起期间手动点播单曲，聊天区出现该单曲卡片（batchDepth>0 时旧实现会吞掉）。
- **CAP-2**
  - **intent:** 批量点播循环内单项失败时向用户提示，不产生 unhandled rejection，批次其余行为（后续项是否继续）与现状一致。
  - **success:** 循环内抛错的批量点播：用户收到失败提示（`ShowMessage`），控制台无 unhandled rejection。
- **CAP-3**
  - **intent:** 一次批量点播全程按进入批次时的档位快照判定播报行为，中途切档不影响进行中的批次。
  - **success:** summary 批量执行中把档位切到 card，本批次剩余曲目仍不逐个发卡片（不出现「总结+逐卡」双播报）。

## Constraints

- 抑制判定必须收敛为批次作用域：批量循环内经批次上下文/回调发送卡片，全局深度不再吞非本批发送点；改动须覆盖全部 10 处 `runBatchAnnounce` 调用与 8 个 `sendMediaCard` 发送点。
- `mediaEvent` 仍逐项照发、永不因档位/窗口跳过（沿袭 spec-request-announce-modes 冻结约束）。
- 静默档读实时值且优先于一切窗口与快照：批量执行中切到 silent，剩余曲目立即静默（刻意不对称，与切到 card 走快照不同）。
- 三档语义与总结消息格式不变（已由 spec-request-announce-modes 冻结）；本 spec 只改作用域、错误提示与快照一致性。
- 失败提示遵守「同因去重」既有语义（参考网易云端点 10 秒窗口去重），一次批量多曲失败不得刷屏。

## Non-goals

- 不做平台层 mock 自动化测试（jsdom 无法承载平台 API 与宿站 jQuery UI；真机验证走 `iirose-plugin-verify`）。
- 不重构 `runBatchAnnounce` 的调用形态（如统一队列/调度器）；只加批次上下文与错误处理。
- 不改变设置面板 UI 与三档文案。

## Success signal

真机（iirose.com）验证：summary 档点一个大歌单，循环播放期间再手动点一首单曲——单曲卡片立即出现在聊天区，歌单其余曲目仍无卡片；批量中故意触发一次失败项（如无版权曲目）有单条提示、无控制台报错；批次播放中途切换档位，进行中批次行为不变。

## Assumptions

- 单曲点播入口以 `Announce.runSingleAnnounce` 包裹声明「我是手动点播」（forceDepth 优先于批量窗口；静默档仍优先）——B 站发送点深两层无法穿参，这是 CAP-1 的最小实现；受深层嵌套限制，部分入口只能包整个点播动作（含网络请求），跨 await 窗口期的交错竞态为已接受代价。
- 批量循环逐项 try/catch 的提示文案沿用现有平台错误信息（`error.message`），不新增文案表。
- 单项失败后批次继续（用户裁定 2026-10-20）：失败曲提示+跳过、剩余照播；`runBatchAnnounce` 兜底 catch 作最后防线，任何路径不上抛。
