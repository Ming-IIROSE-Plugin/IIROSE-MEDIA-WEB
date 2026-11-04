---
spec: spec-bilibili-split-and-idle-guard
date: 2026-11-04
verdict: accepted-with-open-items
criteria: declared
---

# 复盘报告：B 站平台拆分与空闲轮询

## Epic Summary

- **范围**：3 个 story（B 站平台拆分 `built` / 轮询降频 `built` / 体积守门 `dropped`）
- **基线**：`eb59dba` → **交付**：`497b3a9`
- **变更**：15 文件，+1108 / −729 行
- **成果**：`BilibiliPlatform.ts` 782 → 112 行（+5 个模块，最大 267）；轮询空闲 1 s / 活跃 250 ms；守门按维护者要求撤回
- **证据**：SPEC、3 个 story 记录、`.memlog.md`（19 条）、`eb59dba~1..497b3a9` 的 diff（2134 行）
- **说明**：本仓未安装 `_bmad/method`，按 spec 树复盘

---

## Findings

### A. 代码问题

- **[F1 高] `cardless` 在两条单集分支上断链，收藏随机会发点播卡片。** `src/platforms/bilibili/episodes.ts:126`（子级单集卡片）与 `:151-157`（单集视频直接播放）调 `deps.playBiliPage(...)` 时**不传第 5 参 `options`**，只有 targetP 分支传了（`:106`）。收藏随机抽到这两类条目时仍会发卡，违反 `spec-auto-playback-no-card` 的既有约定。原实现同样漏传（拆分逐行照搬），属被冻结的既有缺陷——但原文件里就有一句注释「课程分支排在 targetP 之前，必须自己把 cardless 传下去」，说明作者当时意识到、只是没修全。
- **[F2 中] `vodDeps()` 的注释与实现相反。** `BilibiliPlatform.ts:103-111` 的注释写「点播入口的发送点一律现取类成员」，实际 `vodDeps()` 在 VOD 入口只求值一次，之后全是入口快照。对照 `selectEpisodes` 确实做到了确认时现取（`episodes.ts:202`），两处口径不一致。
- **[F3 中] 第二处入口快照没有记录。** `BilibiliPlatform.ts:46-47` 在 `playBiliPage` 入口就取了 `prepareAndSendMedia`，而原实现是等流解析（`getBilibiliVideoStream` + `getDashUrlAndQn`）都 await 完才取。story 1 只记了「VOD 中途替换」这一个窗口。
- **[F4 中] `activeTags` 是字符串 Set，同一 tag 有两个读者时互相撤标记。** `HostMediaBridge.ts:190-195` + `ProgressSession.ts:45`（默认 `readsProgress = true`）。生产上目前只有浮窗一个 `"progress"` 读者所以没炸；story 2 只解决了「底条」那一个，机制本身仍是同 tag 互踩。
- **[F5 中] `poke()` 的防重入挡不住真正的嵌套。** `poking` 只能挡 poke→poke；「定时器 emit → 控制器发报文 → `Socket.observe` → `poke()` → 再进 emit」这条路径 `poking` 为 false。当前安全性全靠控制器先设 pending 再发送（`LoopController.ts:291-302`、`ShuffleController.ts:417`），没有测试构造这条路径。

### B. 验证缺口

- **[F6 中] CAP-2 的「点亮 → 播完 → 预发」没有任何可复现证据。** SPEC 的 Assumptions 与 Open Question 明确要求 story 用测试或真机确认「点亮前没有快照历史是否影响预发」，`stories.yaml` 也要求「先在测试里覆盖该时序」；story 2 的 Implementation Notes 与 triage 都没提，epic diff 里也没有这类测试。首版方案里曾建过 `LoopControllerOnDemand.test.ts`，方案回滚时一起删了，没有补回来。
- **[F7 中] 面板活跃标记的接线没有测试兜底。** `setPanelOpen` 是 `MediaSessionHandle` 的可选成员，`MainAppContainer.test.ts` 的会话夹具根本不给它；`polling.test.ts` 全部直接 `bridge.setActive("panel", true)`。没有任何用例从「真的开面板」走到「间隔变 250」。
- **[F8 低] 改了一处漏了一处。** `HostMediaBridge.test.ts:720` 的 `advanceTimersByTime(250)` 在空闲 1000 ms 下不再触发任何 tick（该用例只有 `bridge.subscribe`、无 `ProgressSession`）；story 2 只把 `:744` 那处改成 1000。这句推进现在是空转，用例靠别的原因通过。

### C. 记录与口径

- **[F9 低] `stories.yaml` 仍写「落实 CAP-3」，而 SPEC 只有 CAP-1/CAP-2。** story 3 撤回时改了 SPEC、没改 yaml，下一轮按 yaml 找 CAP-3 会落空。
- **[F10 低] `?raw` 源码守卫按 6 个写死路径枚举。** story 1 把守卫从 1 个文件扩到 6 个，但 epic 之后的 `54361c1` 又把 `splitByPage` 搬到 `platforms/shared/`，`bilibili/shared.ts` 只剩一行转发——按清单枚举的守卫只对当时的文件名成立。
- **[F11 低] `useDeck.ts:87` 的注释只有一半成立。** 写「底条随面板常驻」，但内页勾选时 `SelectionBar` 会原位取代 `RoomDeck`，底条连同它的 `ProgressSession` 一起离树。后果无陈旧（面板标记仍在、重挂载时立即回读），但注释会误导。
- **[F12 低] 搜索词变化与面板开合共用同一个副作用。** `MainAppControlLayer.tsx:188-191` 的搜索词分支也会调 `applyDisplaySideEffects`。`setPanelOpen` 幂等所以轮询无恙，但这是这个标记最容易被改坏的位置。

---

## Behavior Verification

- 拆分：`?raw` 守卫、`vi.spyOn` 兼容、30 个方法签名逐字比对，均在 story 1 记录。
- 轮询：真机 hook `setInterval` 实测「空闲 `[1000]`、打开面板后 `[1000, 250]`」——但这段证据只写在 story 正文，仓库里没有脚本或日志。
- 未验证：CAP-2 要求的「点亮后预发」时序（F6）；面板真实开合驱动节奏变化（F7）。

---

## Action Items

> 2026-11-04 复盘后经维护者批准全修（A1–A12）。

| # | 项 | 证据 | 状态 |
|---|---|---|---|
| A1 | 两条单集分支补传 `options`（cardless），加「收藏随机不发卡」两条用例 | F1 | 已修 |
| A2 | `vodDeps()` 注释改成实际语义（入口取一次，不是现取） | F2 | 已修 |
| A3 | `playBiliPage` 里的 `prepareAndSendMedia` 改为发送时现取 | F3 | 已修 |
| A4 | 每个 `ProgressSession` 用自己的 tag（`progress:N`），不再互相撤标记 | F4 | 已修 |
| A5 | `poke()` 重入路径补测试（订阅回调里再 poke 只触发一次） | F5 | 已修 |
| A6 | 补桥接级「点亮 → 一拍 → 预发」测试（真实 bridge + 真实控制器，3 条） | F6 | 已修 |
| A7 | 面板接线：单测保留「会话晚到重放」，端到端交给真机脚本 | F7 | 部分修 |
| A8 | `HostMediaBridge.test.ts:720` 的空推进改成 1000ms | F8 | 已修 |
| A9 | `stories.yaml` 的 CAP-3 引用改为「已撤回，不对应任何 CAP」 | F9 | 已修 |
| A10 | `?raw` 守卫改为 `import.meta.glob` 按目录枚举 | F10 | 已修 |
| A11 | `useDeck` 注释补「内页勾选时会被 SelectionBar 取代」 | F11 | 已修 |
| A12 | 真机 `setInterval` 验证固化为 `scripts/verify/media-polling.mjs` | 验证缺口 | 已修（实测 `ok: true`） |

---

## Acceptance Verdict

**accepted**

- CAP-1（拆分 ≤400 行）：达成——HEAD 实测 112 / 237 / 127 / 267 / 164 / 23，人工核对全部达标；但没有自动检查（守门已撤回，F8）。
- CAP-2（空闲 1 s / 活跃 250 ms）：机制达成并经真机验证；「点亮后预发」已由桥接级测试补上（A6），面板接线有真机脚本兜底（A12）。
- CAP-3：已按维护者要求撤回（story 3 `dropped`），SPEC 已删，仅 yaml 残留引用（F9）。
- 发现一处真实功能缺陷（F1，收藏随机发卡），系既有缺陷而非本次引入，已修并补两条用例。

## Assumptions

- 本仓未安装 `_bmad/method`，按 spec 树复盘。
- 未运行 Phase 3 团队讨论（opt-in，未请求）。
- 「行为等价」以 diff 逐行核对与现有 1292 条用例为准，不含真机。
