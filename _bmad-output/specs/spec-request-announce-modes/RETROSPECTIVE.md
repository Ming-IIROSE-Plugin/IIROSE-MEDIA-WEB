---
date: 2026-10-20
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# 回顾：点播播报三档模式（spec-request-announce-modes）

## Epic summary

- **目标**：全局三档点播播报（发卡片 / 静默 / 批量总结），设置面板持久化，默认发卡片（上游 `_bmad-output/specs/spec-request-announce-modes/SPEC.md`）。
- **形态**：无 `sprint-status.yaml`、无 `stories.yaml` —— 单 spec 单故事交付（stories 模式退化形态）。故事记录 = `_bmad-output/implementation-artifacts/spec-request-announce-modes.md`（status: done，含 baseline_commit、Review Triage Log 16 行、Implementation Notes）。
- **Diff 区间**：`bce6d7e..fbb2c67`（基线为变更前提交，无需 `^`）。4 个非合并提交：`3867935` feat → `9de2bb0` test → `1e8f9fd` review-fix → `fbb2c67` 真机反馈修复。13 文件，+540/-270 左右；新模块 `src/iirose_func/Socket/Announce/`（81 行实现 + 26 用例测试）。
- **未完成故事**：无（单故事 done）。
- **证据清单**：上游 SPEC.md ✓；实现 spec（含审查记录）✓；diff 与逐文件量（git_evidence.py）✓；提交历史 ✓；会话记录 = 本会话（subagent 报告已并入实现 spec 的 Implementation Notes / Triage Log）；无 sprint 状态文件（记录为缺项，不影响单故事判定）；上次复盘 = spec-netease-search-failover（2026-10-20）。

## Findings

来源标注：RA = 本轮 retro 对抗镜头，RE = 边界镜头，RV = 验证缺口镜头（均为 bmad-review 对 `bce6d7e..fbb2c67` 的复审）；T# = step-04 审查 Triage Log 行号。

### 已闭环（无需行动）

- 实现满足上游 SPEC 全部 CAP 与约束：统一播报入口覆盖 8 个发送点（grep 无 `mediaCard` 直发残留）、`mediaEvent` 永不受档位影响、JSON 报文转义、非法值归一化回退 `card`（实现 spec AC + `Announce.test.ts`）。
- step-04 的 6 项 patch（并发深度计数器、设置面板 ctx.setState 同步、`i` 字符串形态、空标题兜底、3 处测试缺口）已落地于 `1e8f9fd`，均有测试锚定。
- 规格对账偏差均在案：B 站正序/乱序包裹超出任务清单但属冻结矩阵意图（Implementation Notes）；`getAnnounceMode` 任务文本笔误（Implementation Notes）。
- 真机反馈后规格同步：`fbb2c67` 同轮修订上游 SPEC.md、实现 spec 冻结块、memlog（#19-21）——未犯「文档承诺、代码未实现」的既往错误。

### 新发现（本轮复审，处置为建议，人决定）

| # | 发现 | 来源 | 处置建议 |
|---|------|------|---------|
| F1 | 简介截断按 UTF-16 code unit 切，emoji 跨 120/121 位被劈成孤立代理项，向全房间广播乱码 | RA#4 + RE#2（双镜头重叠） | fix-now：`Array.from(flat).slice(0,120).join("")+"…"` |
| F2 | 截断实产 121 字符，与冻结矩阵「≤120」字面不符 | RA#7 | fix-now：随 F1 改 119+`…`，或改 spec 措辞 |
| F3 | 简介/标题未剥 HTML 与 markdown 元字符：B 站 desc 常含 `<br>`/链接/`*`，渲染会被打乱甚至注入可点内容 | RA#5 | fix-now：剥标签 + 转义 `*_\``（title 同理） |
| F4 | 空白串标题（`" "` truthy）绕过兜底，仍产《 》 | RE#1 | fix-now：`title?.trim()` 判定 |
| F5 | 总结报文封套 `mc`/`i` 无断言：`i` 的字符串形态是已识别的宿站契约敏感点（实现注释自证），改回数字测试全绿 | RV#1 | fix-now：补 `parsed.mc`/`typeof parsed.i` 两条断言 |
| F6 | `Announce.test.ts` stub 的 `window.WebSocket` 未在 afterEach 还原，跨 describe 泄露 | RA#11 | fix-now：afterEach 删除 |
| F7 | 设置面板「点播播报」icon 不随档位切换（`announceCardIcon/SilentIcon/SummaryIcon` 三类已备好未用）；`item.title === "点播播报"` 中文字符串匹配沿袭搜索结果视图的脆弱模式 | RA#8 | icon 随档切换：fix-now；稳定 key 重构（连同搜索视图行）：defer |
| F8 | 全局抑制窗口吞掉批间手动单曲：summary 大歌单批次执行数分钟期间，用户手动点播的卡片零痕迹（播放照常）。三次独立浮现（T#2 reject-low、RA#2、RE#3） | RA#2 + RE#3 + T#2 | defer 重录：批次 token 方案需穿 8 个发送点，单独立项 |
| F9 | 9 处 `void runBatchAnnounce` 循环异常成 unhandled rejection，无提示、批次静默中止 | RA#3 + T#5 | 已在 `deferred-work.md`，与 F8 同时机处理 |
| F10 | 全批失败（`getNeteaseSongDetail` null 整批 return）总结已发但 0/N 播放；「先发不回收」批准的是单项失败，0/N 是更强情形 | RA#1 | open question：循环后补发更正 / 措辞改「已提交」/ 维持现状 |
| F11 | 「静默」文案语义：播放照常切全房间，仅不发卡片；用户自然预期可能是「完全无感知」 | RA#10 | open question：选项文案是否加说明（档位名为用户自定） |
| F12 | 长批次中途切档分裂行为：入口读一次档位 vs 循环逐卡片重读——summary→card 中途切=总结+后半逐卡（双播报） | RA#6 | defer：入口快照随 F8 批次 ctx 一并解决 |

### 聚合视图（增量判断）

- **架构增量**：新增 `Announce` 模块被 4 平台 + InputPlatformAnalysis 依赖，自身仅依赖 `Socket` 与 `PluginSettings`，无环。`iirose_func` 层读 settings 层为全目录首例先例（grep 证实）——纯读、单向，可接受，记录。
- **重复映射**：`runBatchAnnounce` 包裹在 10 个调用点形态一致，无逻辑分叉；`parseAnnounceMode`/`normalizeAnnounceMode` 完整复刻 `searchViewMode` 既有模式，无真源分叉。
- **体积增长**：`BilibiliPlatform` 868 行（本 epic +81）、`NetEasePlatform` 1048 行（+31）——非新神类，但两个平台大类持续膨胀，拆分时机需关注。
- **模式偏差**：格式化噪声混入功能 diff（`InputPlatformAnalysis` 406 行重排，git_evidence：+210/-196）——RA#12/T#6 两次记录，见行动项 6。

## Behavior verification

真机（iirose.com，测试账号）人工验证，2026-10-20：

- **card 档**：与现状一致（用户确认「没问题」）。
- **silent 档**：无卡片、播放照常（用户确认「没问题」）。
- **summary 档**：初版发现首行转义错误（一个反斜杠不触发 markdown），`fbb2c67` 修复（三反斜杠+加粗+简介）后用户复测：「可以，挺好的」——markdown 渲染与简介表现符合预期。
- 未由自动化复跑（Playwright 流程备而未用，用户人工验证已覆盖三档）；补充说明：用户样例未覆盖 F1/F3 的乱码/HTML 场景，该风险由复审发现、非运行时观察。

## Previous-retro follow-through

上一次复盘：`_bmad-output/specs/spec-netease-search-failover/RETROSPECTIVE.md`（2026-10-20，accepted-with-open-items）。其 5 条 action items 已全部落地，证据见该文档「处理结果（2026-10-20）」节（契约对齐、`Nodes.ts` 节点表、平台层提示去重、推送规则、真机复测均 ✅）。其中 #4 推送规则（AGENTS.md 提交节覆盖 skill 内 No-push）本轮已实际生效：实现与修复提交均按「检查通过即推送」执行，无越界。

本仓库无 `sprint-status.yaml`：action items 状态以各 spec 文件夹 `RETROSPECTIVE.md` 内的「处理结果」节为账本（既有惯例），`deferred-work.md` 承载跨 spec 遗留。

## Action items

均为**建议**，由人决定是否执行。

1. **总结消息微修包（fix）** — F1+F2+F4：`buildDescriptionQuote` 改 `Array.from` 截断 119+`…`、标题 `trim()` 兜底，同步测试。Owner: Ming。
2. **简介净化（fix）** — F3：desc/标题剥 HTML 标签并转义 markdown 元字符（B 站 desc 含 `<br>` 为常态）。Owner: Ming。
3. **测试补强（fix）** — F5+F6：`mc`/`i` 封套断言；`window.WebSocket` stub 还原。Owner: Ming。
4. **设置面板 icon 随档位切换（fix）** — F7 前半：三枚档位图标已备好，接上即可。Owner: Ming。
5. **defer 重录（defer）** — F8 批间手动单曲被吞（批次 token 方案）+ F9 unhandled rejection（已在 `deferred-work.md`）+ F12 中途切档快照：三者同根源（抑制窗口无批次作用域），建议合并为一个后续 spec。Owner: Ming。
6. **格式化纪律（process）** — F13：一次独立 `prettier --write` 收口提交 + AGENTS.md 约定「格式化不得与功能改动混提」（406 行重排已两次污染审查面）。Owner: Ming。

### 处理结果（2026-10-20，用户批准后执行）

1. ✅ **微修包** — `sanitizeText` 统一净化入口；简介按码点截断 119+`…`（总长 ≤120，emoji 不劈代理对）；纯空白标题（`" "` truthy）也走「批量点播」兜底。新增码点截断、emoji 代理对两用例。
2. ✅ **简介净化** — 剥 HTML 标签、转义 `*_\``、压平单行，标题与简介同走 `sanitizeText`（标题含 `*` 不再破坏 `**《》**` 包裹）。新增净化两用例。
3. ✅ **测试补强** — 「总结报文」用例补 `parsed.mc === "008000"` 与 `typeof parsed.i === "string"` 断言；afterEach 还原 `window.WebSocket` stub。
4. ✅ **面板 icon** — 「点播播报」icon 随档位切换（`announceCardIcon/SilentIcon/SummaryIcon`），初始与重渲染同步路径都已接上；`.announceModeIcon`（bullhorn）成为死代码已删。
5. ✅ **defer 重录**（2026-10-20 已由 spec-announce-batch-scope 完成落地）— F8/F9/F12 合并为批次作用域 spec：单曲窗口（`runSingleAnnounce`）、批次档位快照、逐项 catch + 同因去重提示（commits `02571ff`/`d0f9ef1`，150 用例全过；真机验证 CAP-1/CAP-3 通过、无 unhandled rejection，详见该 spec 的 Verification 节）。
6. ✅ **格式化纪律**（2026-10-20 追加执行）— AGENTS.md 新增「提交纪律」节：格式化不得与功能改动混提、`style:` 前缀独立提交、prettier 默认配置无 `.prettierrc`（commit `bf8c22e`）；全仓 81 文件 prettier 归一以独立 `style:` 提交落地（`486cb92`），构建与 142 用例全过、包体积不变，语义零变更。

验证：`npm run build` 通过；14 文件 142 用例全过。冻结契约（实现 spec 冻结块/矩阵行、上游 SPEC.md 约束）同轮修订为净化+码点截断口径；memlog #22-23 记录。剩余待办：行动项 5（批次作用域后续 spec）与开放问题 F10/F11。

### 裁定与追加执行（2026-10-20，用户四项选择）

- **F10 ✅ 措辞改「已提交点播」** — `Announce` 正文行不再用确定语气（无版权跳过时实际播放数 < N）；测试同步。
- **F11 ✅ 维持「静默」** — 档位名不加说明文字，用户裁定。
- **F7 后半 ✅ SettingData 稳定 key 重构** — `SettingData` 增加强制 `key` 字段（含注释禁用 title 匹配），SettingsService 22 行 + AboutService 4 行全部赋 key；「搜索结果视图」「点播播报」的面板同步改按 `item.key ===` 匹配，消除中文文案匹配。
- **行动项 5 → 开新 spec** — F8/F9/F12 合并为「播报批次作用域」spec（见 `_bmad-output/specs/spec-announce-batch-scope/`）。

## Acceptance verdict

**accepted-with-open-items**（criteria: declared）。

- 判据 = 上游 SPEC.md 的 Capabilities/Success signal + 实现 spec 冻结矩阵：三档行为全部达成且真机验证通过（card/silent/summary 三档均有用户确认）；默认档与现状一致；设置持久化与归一化有测试钉住。
- 开放项 = 行动项 1–4 的微小缺陷组（均为几行级修复，不影响主流程）+ open questions（F10/F11）+ defers（F8/F9/F12）。
- 无未完成故事，机器判定不受强制 reject 约束。

## Open questions

1. **F10 ✅ 已解决（2026-10-31，`9ac89be`）**：维持「先发总结」，由 `runBatchAnnounce` 在批次数短于总数且原因确为 `stopped`/`failed` 时补发一条校正（「已取消，未提交曲目」/「已停止，实际提交 X / N 项」/「因错误中断，…」）；跑完但有跳过不补发，避免误报。原文：全批 0/N 播放时总结已发——维持「先发不回收」，还是循环后补发更正 / 措辞改「已提交点播」？
2. **F11**：「静默」档是否加说明文字（如「静默（仅不发卡片，播放照常）」），避免用户误以为完全无感知？
3. F7 后半：`SettingData` 稳定 key 重构（连带「搜索结果视图」行）是否值得做？
