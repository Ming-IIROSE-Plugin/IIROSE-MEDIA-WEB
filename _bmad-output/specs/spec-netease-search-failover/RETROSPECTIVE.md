---
date: 2026-10-20
verdict: accepted-with-open-items
criteria: profiled
headless: false
---

# 网易云请求失败检测与节点切换 · 复盘

## Epic summary

- **Epic 规格**：`_bmad-output/specs/spec-netease-search-failover/`（`SPEC.md` + companion `failure-modes.md` + 实现期观察 `runtime-observations.md`），对应 build spec `_bmad-output/implementation-artifacts/spec-netease-search-failover.md`（`status: done`，`route: dispatch`，`review_loop_iteration: 0`）。
- **Story 列表**：单 story。本 spec 无 `stories.yaml`、无 `stories/` 目录，属 build 流程的扁平 spec；因此 story 边界即整个 epic。
- **Diff 范围**：`4eb942c..6b9120e`（基线 `4eb942c` 为改动前提交，无需 `^`）。
  - 3 提交 / 0 merge / 7 文件 / +664 −45（净 +619）。
  - `ce63aab` 实现（`src/Api/index.ts` 统一入口、7 个端点接入、settings+types）；`d203ac6` 评审补丁（GET 与端点接线测试、逐节点 `lastStatus` 重置）；`6b9120e` 图标对齐 B 站（用户追加要求，非 spec 任务）。
  - `git_evidence.py --stories netease-search-failover` 归属 0 条提交——提交主题未带 story id，单 story epic 下不影响聚合统计。
- **未完成 story**：无（唯一 spec `status: done`）。**无 `sprint-status.yaml`**，`detect-epic` 的完整性门禁未运行；结论以 spec frontmatter 为准，并在此声明门禁缺失。
- **证据清单**：epic spec ✅、companion ✅、build spec（含 Review Triage Log）✅、`git_evidence.py` 预跑 ✅、diff 范围 ✅、build 期运行时观察 ✅、session 记录（本会话，未独立落盘）、`sprint-status.yaml` ❌、`stories.yaml` ❌。

### 证据缺口（明确声明，避免与"查过且干净"混淆）

| 缺口 | 影响 |
|---|---|
| 无 `sprint-status.yaml` / `stories.yaml` | 完整性门禁不可由脚本执行；上一 epic 的 action items 无法按 `action_items` 逐条读取（改查 `deferred-work.md`） |
| 未重跑 `bmad-review` 全量 | 本次 diff 在 build 阶段已由 blind-hunter / edge-case-hunter / verification-gap 三层评审（30 条发现，裁决已写入 build spec 的 `## Review Triage Log`）。为避免同质噪声，改为对**评审后增量**（`d203ac6`、`6b9120e`）与**平台层接缝**做窄范围内联评审，见 F 组 |
| HTTP 433 未在真实链路复现 | 433/超时路径全部来自 Playwright 拦截模拟；`runtime-observations.md` 已如实记录样本不足 |

---

## Findings

每条附出处。处置三选一：**fix now** / **defer** / **accept as-is**。

### A. 架构增量

- **A1（defer，建议独立立项）** 网易云专属的路由与重试策略被放进共享传输基类：`SendFetch` 现在同时承担「transport（sendGet/sendPost/XHR）」「B 站 CORS 选择」「网易云节点选择 + 5s 超时 + 失败分类 + toast」。文件从 313 行增至 **445 行**（+42%，本次净 +132），`neteaseRequest` 独占 322-441 共 119 行。出处：`git show 4eb942c:src/Api/index.ts | wc -l` vs `wc -l src/Api/index.ts`；`src/Api/index.ts:322-441`。
  - 危害点（写给未来的调用方）：下一个平台若也要重试/多节点，只有两条路——复制这段 119 行，或继续往基类里加第三块平台专属逻辑；两条都会让 `src/Api/index.ts` 成为跨平台策略的垃圾场。build 期的 Triage Log 已因「spec Code Map 指定落在此处」驳回过同一建议，本条不复述该争论，只记录结构事实。
- **A2（accept as-is）** 依赖方向没有变坏：`src/Api/index.ts` 仅新增对 `localStorage` 的读取，未引入新 import；`src/Api/NeteaseAPI/*` 只依赖基类；`NetEasePlatform` 未被触碰（diff 无该文件）。出处：commit `ce63aab` 文件清单 + `head -5 src/Api/index.ts`。

### B. 体量增长

- **B1（accept as-is）** `src/Api/index.ts` 是唯一显著增长的生产文件（313→445）。其余：`NeteaseMusic/index.ts` 225→217（净 −8，改造后更短）；`NetEaseSettings.ts` 219→225（+6，选项表与图标）。没有任何文件因本次 epic 跨过 god-class 门槛。出处：`git_evidence.files` 与 `wc -l`。

### C. 重复与双份真源

- **C1（fix now，小改动）** 节点枚举共有 **4 处真源**，且两两不同步的风险已被 review 实测过（写入端写成 `"hk"` 时读取端静默回退广州）：
  - 类型：`src/types/netease/NeteaseSetting.d.ts:3`
  - 选项表：`src/settings/neteaseSettings/NetEaseSettings.ts:92-95`（写入）与 `:200-206`（展示文案解析）
  - 读取：`src/Api/index.ts:322-345`
  - 图标表：`src/settings/neteaseSettings/NetEaseSettings.ts:90`（本次追加）与 `:136`/`:143` 等同类数组并存
  - 后果：新增/改名一个节点要改 4 处，漏一处不报错（类型断言 `s as "default" | "HK" | "Dev"` 不做运行时校验）。
- **C2（defer）** `getNeteaseCors`（`src/Api/index.ts:322-345`）与 `getBilibiliCors`（`:294-315`）是同一函数的两次手抄，**兜底值语义相反**：B 站 `return this.cors`，网易云 `return this.cncors`。抄写时把「跟随注入覆盖」的兜底换成了硬编码，注释「仿 getBilibiliCors」与实现不符。build 期以「仓库内不可达覆盖值 + 冻结意图指定 cncors」驳回为 false；此处记录为**结构重复**，不是行为缺陷。
- **C3（defer）** 平台层仍保留 3 处对 `neteaseSetting.api` 的死读取：`src/platforms/NetEasePlatform.ts:529`、`:692`、`:777`（赋值后从未使用），而真正的读取已迁到 `src/Api/index.ts:331`。改动前这些变量就是死代码，但本次让「同一个设置有两个读者、其中一个是假的」变成新事实。

### D. 模式分歧

- **D1（accept as-is）** `sendPost` 用位置参数扩展：`(url, params, headers?, warn = true, signal?)`（`src/Api/index.ts:87`），调用处出现 `sendPost(url, p, h, false, controller.signal)` 这种布尔字面量。与仓内既有风格一致（`sendGet` 早已是同样形状），未新增第二套约定。
- **D2（accept as-is）** `neteaseRequest` 返回 `Promise<any | null>`，7 个调用点各自再判一次 `data && data.code === 200`（`NeteaseSearch/index.ts:31`、`NeteaseMusic/index.ts:21/46/82/128/177/208`），其中 `else` 分支实际不可达。build 期以「收紧签名会改动公开面」判 low 拒绝，此处接受。
- **D3（defer，已在 deferred-work）** `sendGet`/`sendPost` 用 `{...headers}` 展开 `Headers` 实例，请求头全部丢失——统一入口透传的 `content-type` 同样到不了 fetch。既有缺陷，非本次引入。

### E. Spec ↔ 实现对账

- **E1（fix now，spec reconciliation）** `SPEC.md` 的 CAP-5 与 Constraints 写「候选限广州/香港两个现有 SCF 实例」，as-built 却把「开发者模式（Dev）」做成**用户可见选项**（`NetEaseSettings.ts:94`）并写进类型（`NeteaseSetting.d.ts:3`）。build spec 的 Task 与 Design Notes 明确要求 Dev，两份契约因此互相矛盾——按项目约定（能力增减必须同轮改契约），companion 需要同轮更新，而这一轮没有做。出处：`_bmad-output/specs/spec-netease-search-failover/SPEC.md` 的 Capabilities/Constraints 与 `src/settings/neteaseSettings/NetEaseSettings.ts:91-95`。
- **E2（fix now，spec reconciliation）** `failure-modes.md` 的「受影响端点清单（均需接入检测与重试）」只列 4 个端点，as-built 接入 7 个（新增 `getLyric` `NeteaseMusic/index.ts:176`、`getNeteaseMVDetail` `:127`、`getMVPlayURL` `:207`）。文档停留在计划态，代码已超出。出处：`failure-modes.md` 端点表 vs `grep -rn "neteaseRequest(" src/Api`。
- **E3（fix now，spec reconciliation）** `SPEC.md` 写「改动范围限网易云 API 层（`src/Api/NeteaseAPI/`）及其平台调用处」，as-built 还改了共享基类、设置层与类型层。范围句与实际交付不符，后续复盘会反复把已交付的代码判成越界。出处：同 E1 的 SPEC.md Constraints 段 + `git_evidence.files`（`src/Api/index.ts`、`src/settings/neteaseSettings/*`、`src/types/netease/*`）。
- **E4（accept as-is）** `6b9120e` 的图标对齐（`NetEaseSettings.ts:90`）来自 spec 完成后的新用户要求，不属 spec 任务；行为为零风险（仅选择框图标 class），已随构建通过。记录以免下一轮把它当成未申报的功能改动。

### F. 评审后增量的窄范围评审（替代全量 `bmad-review`）

- **F1（accept as-is）** `d203ac6` 的 `lastStatus = undefined`（`src/Api/index.ts:374`）修的是「上一节点状态码污染最终提示」，并配了对应用例；该分支只在「前一节点 5xx + 后一节点假 200 非 JSON」这种混合失败下可见，属正确的小修。
- **F2（accept as-is）** 新增 2 个测试文件共 432 + 59 行，覆盖：GET 分支 5s 中止与换节点、端点方法只拼一层代理前缀、写入端 `"HK"` 与读取端 `cncors/malaysiacors` 同源。`npx vitest run` 119 例全绿；`npm run build` 通过。接线测试是本次最有价值的证据——它拦住的是「调用处保留 `${this.cors}` 叠双层前缀」这类无类型保护的复发。
- **F3（defer，流程）** 实现子代理在 build 的 step-03 内**提交并推送**（`ce63aab` 已到远端），而该步骤规则是「No push. No remote ops.」；仓库全局策略却是「构建通过后自动提交并普通 push」。两套规则互相冲突，本次以仓库策略为准执行，但过程不受工作流约束。出处：step-03 规则 vs `/root/.config/opencode/AGENTS.md` 提交节；远端 `ce63aab..6b9120e` 推送记录。

---

## Behavior verification

- **已实测（build 期，2026-10-19 21:50，`runtime-observations.md`）**：iirose.com 真机注入 `dist/bundle.js`，逐行覆盖矩阵——正常、`-462` 换节点、433、假 200（非 JSON / `code !== 200`）、节点挂起 5.0s `ERR_ABORTED` 后转节点、双节点全失败三类 toast、HK 出口为 `ap-hongkong`、Dev 仅 `localhost:9000`、歌单/专辑/歌曲详情/搜歌点播。
- **未复测**：`d203ac6`（提示文案取值）与 `6b9120e`（选择框图标）之后没有重跑真机；前者由新增单测覆盖，后者是纯 UI 图标。**声明为未复测**，不按"查过且干净"计。
- **最大残余风险**：epic 的动机场景（HTTP 433）从未在真实链路出现，全部证据来自拦截模拟；观察记录本身已注明样本不足，无法证实或推翻「歌单/专辑更易失败」。

---

## Previous-retro follow-through

- 无 `sprint-status.yaml`，上一 epic 的 `action_items` 不可读——这是文件缺失，不是「无未完成项」。
- 替代检查：`deferred-work.md` 中上一轮（`spec-favorites-cloud-sync*`）的条目全部带结论标记；其关键项已落地并有提交证据——god-class 拆分 `a012624`（`src/sync/SyncManager.ts` 现 109 行、`src/storage/FavoritesStorageService.ts` 557 行），首次同步预览 `f484e28`。据此上一轮无遗留未处理项。出处：`git log --oneline -1 a012624`、`wc -l`。

---

## Action items

均为**建议**，由人决定是否执行。

1. **契约对齐（spec reconciliation）** — 同一轮更新 `SPEC.md`（CAP-5/Constraints：广州/香港 + Dev 的口径、改动范围句）与 `failure-modes.md`（端点清单补 3 个），并在文首注明「Dev 为开发者选项、生产可见但无兜底」。关联 E1/E2/E3。Owner: Ming。
2. **抽取网易云节点表（remediation）** — 单一 `NETEASE_NODES`（id / 文案 / 图标）+ `NeteaseNode` 类型，供 `Api/index.ts:322`、`NetEaseSettings.ts:90-95`、`:200-206`、`NeteaseSetting.d.ts:3` 共用，消除 C1 的 4 处真源。Owner: Ming。
3. **平台层失败提示去重（remediation，用户可见）** — `NetEasePlatform` 三处 catch 在拿到已提示过的 `null` 时短路，避免单次失败弹 2~3 条（`NetEasePlatform.ts:535-539`、`:561-565` 等）。build 期因冻结意图排除平台层而 defer，复盘建议提优先级。Owner: Ming。
4. **统一「是否允许推送」的规则（process）** — build 工作流 step-03 的 "No push" 与仓库自动推送策略冲突，需在 workflow 定制或 AGENTS 中二选一，否则每次实现会话都会越界一步。关联 F3。Owner: Ming。
5. **行为提交后补跑一次真机观察（process）** — 凡改动失败路径/提示文案的提交，合入前重跑一次 `runtime-observations.md` 的场景表；本次 `d203ac6` 只靠单测，已在 Behavior verification 记为缺口。Owner: Ming。

### 处理结果（2026-10-20）

1. ✅ **契约对齐** — `SPEC.md` 的 CAP-5 与 Constraints 已写明「广州/香港 + 仅本地调试的开发者模式（不回落 SCF）」；改动范围句补上 `src/Api/index.ts` 统一入口、设置与类型层、平台层提示去重；`failure-modes.md` 端点表补齐 lyric / MV 详情 / MV 地址三行，并注明节点表的唯一真源。
2. ✅ **节点表去重** — 新增 `src/Api/NeteaseAPI/Nodes.ts`（`NETEASE_NODES` + `getNeteaseNode()`）；`SendFetch.getNeteaseCors()`、设置的选项表、图标表与标题解析四处统一从它派生，未知值回落广州。
3. ✅ **平台层提示去重** — `NetEasePlatform` 八处「API 返回 null 就 throw」改为静默空返回/直接 return：歌单与专辑详情、分片歌曲详情、MLOD/AOD、MV 地址、finalODSONG。真机复测双节点风控 + 选歌，`window._alert` 计数为 1（`runtime-observations.md` 2026-10-20 节）。
4. ✅ **推送规则** — 全局 `AGENTS.md` 的提交节新增：BMAD build / implement / review-fix 步骤同样「检查通过即提交并普通推送」，skill 内的 "No push" / "NEVER auto-push" 一律以该节为准。
5. ✅ **真机复测** — 2026-10-20 在 iirose.com 重跑：正常搜索、双节点风控（搜索与歌单详情各 1 次提示）、真实链路广州失败自动换香港、HK 优先节点出口，均记录进 `runtime-observations.md`。

---

## Acceptance verdict

**accepted-with-open-items**（判据 **profiled**，非 declared）。

- 判据来源：`SPEC.md` 的 CAP-1~CAP-5 与 Success signal（未声明独立验收标准节）。
- CAP-1（业务码检测）✅ `src/Api/index.ts:416` + 测试；CAP-2（无粘住换节点）✅ 测试与真机均确认第二次搜索仍先打广州；CAP-3（5s 超时/433/网络）✅ 单测 + 真机挂起 5.0s 中止；CAP-4（失败明确提示）✅ 三类文案各有用例，真机各弹一次；CAP-5（优先节点可选）✅ 设置写入→读取同源测试 + 真机 HK 出口验证。
- 未完成 story：无（单 story `status: done`）；因无 `sprint-status.yaml`，完整性门禁未由脚本执行，故不据此升级为 rejected。
- 未决项均已归档：build 期 6 条 defer 落在 `deferred-work.md`（平台层叠提示、逐曲提示 maybe-false、headers 丢失、console 噪声、http 详情 URL、AGENTS 约定），本轮再提 5 条 action items，其中契约对齐与节点表去重未完成前，本 epic 以「有未决项」结案而非 accepted。

## Open questions

- Dev 选项是否应继续在生产出现？现状选中后所有网易云请求只打 `localhost:9000` 且无兜底，失败提示是「网络请求失败」——若答案为「仅开发构建可见」，E1 的对账口径也随之改变。
- 真实 433 的触发条件仍未观测到；是否需要给 SCF 加一次可复现的长响应压测，还是接受「模拟覆盖 + 概率性真实失败」的现状？
