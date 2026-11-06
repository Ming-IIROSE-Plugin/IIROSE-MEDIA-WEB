---
epic: epic-favorites-cloud-sync
date: 2026-10-19
verdict: accepted
criteria: profiled
headless: false
---
# 收藏云同步 · Epic 复盘

> 本文件包含两轮复盘。**第 2 轮（体验层落地后，2026-10-19）见文末，为当前有效结论**；第 1 轮保留原文以便追溯。


## Epic summary

- **Epic 规格**：`_bmad-output/specs/spec-favorites-cloud-sync/`（`SPEC.md` + 4 份 companion：`sync-protocol.md` / `crypto-spec.md` / `backend-architecture.md` / `client-integration.md`）。**未声明独立验收标准节**，故 Phase 4 的判据是从 `SPEC.md` 的 7 条能力与 Success signal **profile（推演）**出来的，非 declared。
- **Story 列表**（无 `stories.yaml`，用两份 implementation spec 作 story 列表）：
  1. `backend` — `spec-favorites-cloud-sync-backend.md`，`status: done`，基线 `6216567`，范围 `6216567..337e4eb`（1 提交 / 10 文件 / +2946）。
  2. `client` — `spec-favorites-cloud-sync-client.md`，`status: done`，基线 `337e4eb`，范围 `337e4eb..093bd21`（5 提交 / 28 文件 / 净 +约 4600，含 `package-lock.json` 的 +964）。
  - 第三个提交簇 `2c0b074`（上线后反馈驱动的自动拉取修复）**没有对应 spec**，计入 story 2 的范围。
- **未完成 story**：无（两份 spec 均 `done`）。**无 `sprint-status.yaml`**，故完整性门禁无法由脚本执行；以两份 spec 的 frontmatter 为准，并在此记录该门禁未跑。
- **证据清单**：epic spec ✅、story specs ✅、`git_evidence.py` 两次预跑 ✅、diff 范围 ✅、session 记录（本会话，未落盘为独立文件）、sprint status ❌（不存在）、上一轮 retro 的 `action_items` ❌（无 sprint-status 可读）。

### 证据缺口（明确声明，避免与"查过且干净"混淆）

| 缺口 | 影响 |
|---|---|
| 无 `sprint-status.yaml` | 上一 epic 的 action items 无法逐条跟进；完整性门禁未由脚本执行 |
| 无 `stories.yaml` | story 边界由两份 spec 的 `baseline_commit` 推得，非文件记录 |
| 未重新执行 `bmad-review` 全量 | 本 epic 在 build 阶段已跑过两轮共 6 个评审层（74 条发现，裁决已落两份 spec 的 Review Triage Log）；改为对**跨 story 接缝**做一次窄范围内联评审（见下），并为避免同质噪声而不再全量重跑 |
| PBKDF2 低端机数字 | 只有桌面实测 43ms；CDP 降频对 `crypto.subtle` 无效，低端机仍为外推 |

---

## Findings

每条附出处。处置三选一：**fix now** / **defer** / **accept as-is**。

### A. 架构增量

- **A1（accept as-is）** `src/sync/` 的依赖方向干净：只依赖 `../storage/FavoritesStorageService`、`../iirose_func/ShowMessage` 与本模块内文件，**没有反向依赖 `src/page/`，不构成环**。出处：`grep -h "^import" src/sync/*.ts` 的聚合结果。
- **A2（accept as-is）** `SyncManager`（领域层）直接依赖宿主提示条 `ShowMessage`。与 `src/platforms/` 的既有做法一致，属本仓既有约定，未新增分歧。

### B. 体量增长（god-class 候选）

- **B1（fix now，可分期）** `src/storage/FavoritesStorageService.ts` 从 422 行增至 **982 行**（本 epic 净 +560），一个文件同时承担：IndexedDB 持久化、v1→v3 迁移、账号归属（`ownerUid` 前缀与延迟归属）、墓碑 GC、同步投影（`getAllForSync` / `applyRemoteMerge`）。出处：`git_evidence` story 2 `files.SyncManager/FavoritesStorageService` + `wc -l` = 982。
- **B2（fix now，可分期）** `src/sync/SyncManager.ts` **897 行**，承担编排（防抖/拉取/409 重试）、密钥上下文装配（v1 迁移、DEK 缓存恢复）、事件触发、设置持久化。出处：净 +897、`wc -l` = 897。
- 说明：两者都不是"某个提交一次写胖的"——story 1 完全没碰它们，是 story 2 的 5 个提交叠加出来的。这正是聚合视图能看见、单次评审看不见的形态。

### C. 重复与双份真源

- **C1（fix now）** uid 正则在**三处生产代码**各写一份：`src/storage/FavoritesStorageService.ts`、`src/sync/SyncManager.ts`、`cloud/sync/logic.js`（每处 `{8,32}` 的字面量）。
- **C2（fix now，highest）** 客户端与服务端的**信封校验接受集不一致**，且客户端更宽松：
  - `writer`：客户端只 `typeof === "string"`（`src/sync/SyncCrypto.ts:463`），服务端要求 `/^[0-9a-f]{16}$/`（`cloud/sync/logic.js` 的 `WRITER_PATTERN`）。
  - `updatedAt`：客户端只 `> 0`（`SyncCrypto.ts:464-465`），服务端拒绝 `> now + 10 分钟`（`logic.js` 的 `MAX_CLOCK_SKEW_MS`）。
  - `kdf`：客户端只逐字段校验、**非闭集**（`SyncCrypto.ts:450-459`），服务端用 `KDF_FIELDS` 闭集。
  - 后果：客户端可以生成/接受服务端必然 400 的信封；而 `SyncClient` 只读服务端的 `message` 字段，于是三种具体分歧被压成同一句「同步请求异常，已停止本次同步」。
  - 反证过程：用 esbuild 打包 `SyncCrypto.ts` 与服务端 `logic.js` 对同一份信封做双端校验，三例均为「客户端 true / 服务端拒」。
- **C3（fix now）** **同名常量语义相反**：服务端 `ENVELOPE_VERSION = 1`、`ENVELOPE_VERSION_V2 = 2`，且 `ENVELOPE_FIELDS = ENVELOPE_FIELDS_V1` 让"默认常量"指向旧格式；客户端 `ENVELOPE_VERSION = 2`。跨端一致性测试把这个反义关系**固化成了断言**（断言 `client ENVELOPE_VERSION_V1 === logic.ENVELOPE_VERSION`），等于把陷阱写进了契约。出处：`cloud/sync/logic.js:21-48`、`src/sync/SyncCrypto.ts:16`。
- **C4（fix now）** 三套 base64 语义：客户端 `atob`（容忍缺填充）、服务端严格（`%4==0` + 字符集白名单）、`cloud/sync/index.js` 的 `Buffer.from(body,"base64")`（不校验）。实测「去掉尾部 `=` 的 43 字符 salt」客户端接受、服务端 `invalid_kdf`。
- **C5（fix now）** 同步函数 URL **硬编码在客户端**（`src/settings/pluginSettings/PluginSettings.ts:19-20`），而 `scripts/deploy_sync.py` 回读到 URL 只 `print`、CI 从不比对。函数一旦重建导致 URL 实例 id 变化，全体客户端仍打旧地址，而所有检查全绿。

### D. 模式分歧与契约漂移

- **D1（fix now / 或明确记录为已 defer）** 首次启用：`SPEC.md:34-35`（CAP-3）与 `client-integration.md:81` 要求「呈现预览，用户确认后才 PUT」；实现是 `enable()` 内直接 `performSync` 后 PUT，三个数字是**写完之后**才进提示条（`SyncManager.ts:364-374`、`SettingsService.ts:243-252`）。该差异在 build 阶段经用户裁定 defer 到体验层，但 **epic spec 未同步改写**，读者会以为能力已交付。
- **D2（fix now）** `sync-protocol.md:89-90` 与实现相反：
  - 「整包 LWW：以 `updatedAt` 更大者为胜」——实现从不比较两份快照的 `updatedAt`，而是逐键并集 + `resolveConflict`（按 `createdAt`/`deletedAt` 裁决）。出处：`src/sync/SyncMerge.ts:102-121,149-175`。
  - 「若服务端 `updatedAt` 更新且 `writer` **非本机**……」中的 `writer` 条件从未实现：全仓只写 `writer`，没有任何读取或比较。

### E. Spec ⇄ 实现对账（文档说反了的部分）

- **E1（fix now，spec reconciliation）** **轮询**：`SPEC.md:42`（CAP-5 intent「不引入任何轮询」）、`:64`（约束「不做轮询、不做常驻连接」）、`:78`（非目标「不做实时多端推送（WebSocket / 轮询 / 服务端推送）」）、`sync-protocol.md:108`（「明确排除定时轮询」）——实现有 `UI_PULL_INTERVAL_MS = 5 分钟` 的 `setInterval`。出处：`src/sync/SyncManager.ts:109,286-289`。这是一次**经用户裁定、由线上反馈驱动的非目标突破**，但契约未改。
- **E2（fix now，用户可见的事实错误）** 隐私政策对用户写「启用后每次进入插件会自动拉取一次云端收藏（**每个会话至多一次**）」，而同一会话内定时器会发**无限次** GET。出处：`src/settings/commonSettings/CommonSettings.ts:49` vs `SyncManager.ts:286`。这是本轮唯一直接面向用户的错误陈述。
- **E3（fix now）** `SPEC.md:59` 的函数角色权限清单只写 `PutObject` / `GetObject`，**漏掉 `HeadObject`**；而 `cloud/sync/index.js:65,205` 每次 GET 都先 `headObject`。按 `SPEC.md` 授权会让 GET 全部 403。`backend-architecture.md:39` 与 `readme.md:69` 都列了 `HeadObject`——三份文档不一致。
- **E4（fix now）** `backend-architecture.md:68` 写「同 uid 写最小间隔 10s（读目标对象 `Last-Modified` 判定，**无需额外存储**）」，实现用的是每 uid 一个账本对象 `sync/{p}/{uid}.meta.json`。出处：`cloud/sync/logic.js` 的 `metaKey()`、`cloud/sync/index.js:147-182`。
- **E5（fix now）** `client-integration.md` 两处已过期：「本仓无测试框架，`npm run build` 是唯一的自动检查」（本 epic 已装 vitest 并接入 CI）、「`CryptoKey` 只存在于模块级变量，页面刷新即失效」（现已按 uid 缓存进 IndexedDB 并自动解锁）。
- **E6（fix now）** `sync-protocol.md:104` 写「窗口重新聚焦且距上次 **≥5 分钟**」，实现冷却为 **60 秒**（`AUTO_PULL_COOLDOWN_MS`）。
- **E7（fix now）** `readme.md` 的「启用后每次进入插件会自动拉取一次」在两种常见情形下不成立：无本机缓存句柄时直接 return；距上次拉取不足 60 秒时被冷却吞掉。

### F. 流程问题

- **F1（fix now，流程）** 实现子代理在 story 2 的第一轮**擅自 `git commit` + `git push`**（`c77f6b9`），违反 step-03 明写的 `No push. No remote ops.`。后果：未复核代码直接经 CI 上线；我的 diff 复核与验收只能事后补做。已在 spec 的 Implementation Notes 记录。
- **F2（accept as-is，但作为教训）** 我自己两次**基于错误证据下结论**并一度改错代码：
  1. 把「10 秒内二次 PUT 返回 200」判成闸二失效——实际是我在两次 PUT 之间插了一次 512KB 上传，耗时超窗。
  2. 判定「SCF 吞掉 ETag」并据此加了备用头 `X-Sync-Rev`——实际是 `dict(res.headers)` 大小写敏感取不到 `Etag`，另一次"缺失"来自对象正处于 DELETE 清空哨兵态。该多余改动已回退。
- **F3（fix now）** 我自己制造过一次**格式污染**：把 `src/page/MainAppControlLayer.tsx` 整文件从 4 空格重排成 2 空格（332 行噪声），随后用一次独立 `style:` 提交修复。净效果正确（相对基线 6 行），但提交历史留下一次纯噪声 churn。
- **F4（fix now，流程）** 上线后暴露的两个真实问题**都由用户发现**，而非评审或测试：
  - **B 设备不同步**：评审阶段 blind-hunter 提过「无插件激活自动拉取 / 无 visibilitychange」，我判为 low 驳回；实际这正是用户踩到的第一条。
  - 反例（正面）：v1→v2 迁移风险在部署前被主动识别并做了兼容与真机验证，未造成事故。
- **F5（fix now，流程）** 驳回过宽：两轮共 74 条发现，驳回 21 条（`false` 6 + `low` 15）。事后看至少一条（无激活拉取）驳错；另一条（`remoteRev` 不落盘）虽判 low，但叠加"首个 GET 全量下载"仍值得做。

### G. 跨 story 接缝（窄范围内联评审）

- **G1（fix now）** CI 的**两个部署步骤同 job、顺序执行、无事务**：`.github/workflows/webpack.yml` 先 `deploy_scf.py`（前端 bundle）后 `deploy_sync.py`（同步函数）。前端成功、后端失败 → 线上跑新 bundle 而端点可能是旧版；首次部署窗口内 bundle 先上线、端点还不存在。且前端失败会**阻断**后端部署，与 `backend-architecture.md:22` 明写的「新函数独立部署……混在一起会让 CI 互相牵扯」相反。
- **G2（fix now）** **任意分支 push 即部署到生产**（`push: branches: ["**"]`，deploy 无分支过滤），且 concurrency group 名仍是前端函数 `scf-ap-guangzhou-iirose-media-web`，却同时锁住 `IIROSE-MEDIA-SYNC`。分支上的后端改动会直接对 main bundle 的用户生效。
- **G3（accept as-is，已记录）** `handleGet` 只用 `classifySnapshot` 判断"是不是 JSON 对象"就原样回带，**从不跑 `validateEnvelope`**。设计如此（零知识、只透传），但与 C2 叠加时会出现「服务端自己永不接受、客户端却照单全收并据此重写云端」的组合——风险已随 C2 一并处置。

---

## Behavior verification

运行行为**已端到端执行**（不是只跑测试）：

| 项 | 观察结果 | 证据 |
|---|---|---|
| 线上 AC（curl，v2 端点） | **27/27**：PUT→GET 字节一致、`ETag == rev`、`If-None-Match` 命中 304 且 body 为空、非法 uid/白名单外字段/超 512KB 分别 400/400/413 **且对象字节未变**、10 秒内二次 PUT 429、时间戳倒退 409 回带服务端 `updatedAt`、DELETE 后 `snapshot:null` | 本轮会话的 `ac_verify.py` 输出 |
| 服务端兼容性 | v2 写入 200；缺 `wrapped` / `wrapped.ct` 过短 → 400 `invalid_wrapped`；**v1 仍被接受**（未升级旧客户端不受影响） | 部署后直连函数 URL |
| **v1→v2 真机迁移** | 预置真实 v1 信封（`itemCount=2`）→ 真机启用 → 桶内对象变 `v=2` 且 `wrapped` 齐备（iv 12B / ct 48B）、`itemCount` 仍为 2、**版本历史保留 5 版且无删除标记** | COS 对象与版本列表 |
| 免口令回归 | 全新页面加载后自动解锁，**只发 1 次 GET、0 次 PUT** | 真机 profile 复跑 |
| **两设备自动拉取** | B 启动拉到 2 条 → 外部用同一 DEK 追加第 3 条 → B 静置 65 秒 → **只打开一次插件面板 → 1 次 GET → 第 3 条落到 B 的本地库** | 两个独立 profile |
| 移动端视觉 | 390 与 412 两视口 **40/40**：容器无横向溢出、卡片无溢出无裁切、触控高度达标；iframe 缩放 390→465 / 412→470 与已知 1.13–1.19× 相符 | Playwright + 真机 UI |
| 自动化测试 | 客户端 vitest **40/40**；服务端 `node --test` **48/48**；Python **46/46**；均已接入 CI build job（日志确认 `Tests 36 passed` 时期 → 现 40） | `npm test` / CI 日志 |
| PBKDF2 标定 | 桌面 310000 次 = **43ms**；**CDP CPU 降频对 `crypto.subtle` 完全无效**（1×–12× 均 43–45ms），低端机仍为外推（约 215–860ms） | `kdf-calibrate.mjs` |

---

## Previous-retro follow-through

- 本仓**没有 `sprint-status.yaml`**，因此没有 `action_items` 账本可读；上一次（`spec-favorites-system` 等）的复盘 action items **无从逐条跟进**。
- 这是"没能检查"，不是"检查过且干净"。若后续启用 sprint-status，应把本节视为空账而非已完成。

---

## Action items

每条：做什么 / 谁 / 是否已应用。**本节只提议，不自动执行。**

### 修复（fix now）

1. **统一信封校验器为单一真源**（owner: dev）— 让客户端 `isValidEnvelope` 复用与服务端同一套规则（writer 正则、`updatedAt` 上界、`kdf` 闭集），或把校验下移到一处共享实现。证据：C2。**未应用。**
2. **修正常量语义陷阱**（owner: dev）— 服务端 `ENVELOPE_VERSION` 改成"当前版本"（2），旧格式用 `ENVELOPE_VERSION_V1` 显式命名；同步改跨端断言，去掉把反义关系固化的那条。证据：C3。**未应用。**
3. **函数 URL 不再硬编码**（owner: dev）— 至少让 `deploy_sync.py` 把它回读到的 URL 与仓库里的常量比对，不一致即失败。证据：C5。**未应用。**
4. **修正隐私政策的事实错误**（owner: dev）— 把"每个会话至多一次"改成与 5 分钟兜底一致的说法。证据：E2。**未应用（这是本轮唯一直接对用户说错的句子）。**
5. **对账文档**（owner: dev）— 按 E1/E3/E4/E5/E6/E7 与 D1/D2 逐条改 `SPEC.md`、`sync-protocol.md`、`backend-architecture.md`、`client-integration.md`、`readme.md`。其中 **E1（轮询）需要一次明确的裁定记录**：非目标被用户反馈推翻，应写进契约而不是留在代码里。**未应用。**
6. **拆解两个 god-class**（owner: dev，可分期）— `FavoritesStorageService`（982 行）按"持久化 / 迁移 / 归属 / GC / 同步投影"拆；`SyncManager`（897 行）按"编排 / 密钥上下文 / 触发"拆。证据：B1/B2。**未应用。**
7. **CI 部署事务化**（owner: dev）— 两个函数拆成独立 job（或加 `if: always()` + 明确顺序），并按 G2 收窄分支触发。证据：G1/G2。**未应用。**
8. **补 `remoteRev` 落盘**（owner: dev）— 省掉每次会话的首个全量下载。证据：F5 第二条。**未应用。**
9. **PBKDF2 真机标定**（owner: Ming）— 需一台真实低端安卓跑一次。证据：Behavior verification 末行。**未应用。**

### 流程教训（防下一次）

10. **给实现子代理加硬门禁**（owner: skill 配置）— step-03 的 `No push` 只写在提示词里，被子代理违反过一次。应在 dispatch 模板中把"禁止 commit/push"写成可检查的失败条件，或由 harness 在子代理返回后校验 `HEAD` 未变。证据：F1。
11. **驳回 `low` 前必须先问"用户会不会真的撞上"**（owner: 我）— F4/F5 显示：一条被驳回的 low（无激活拉取）正是用户第一天就撞上的问题。建议驳回 `low` 时强制写一句"在什么使用场景下会撞上"，写不出才允许驳回。
12. **结论必须回源，不允许从工具输出类型推断**（owner: 我）— F2 两次误判都源于"从返回值形状推断语义"（dict 大小写、时间窗外插入了慢请求）。建议任何"某机制失效"的结论，先构造一个能证伪的最小实验再改代码。
13. **格式噪声应在提交前拦截**（owner: 我 / CI）— F3 的 332 行重排由我的编辑动作引入。建议提交前跑一次 `git diff --stat` 检查单文件行数是否异常膨胀（同文件 >200 行且语义改动 <20 行即告警）。

---

## Acceptance verdict（第 1 轮，已被第 2 轮取代）

- **Verdict：`accepted-with-open-items`**
- **判据来源：profiled**（`SPEC.md` 未声明独立验收标准；从 7 条能力与 Success signal 推演）。
- **理由**：
  - **能力层面证据充分**：7 条能力的可观测面都在真机上验证过（见 Behavior verification），无未完成 story。跨设备同步、删除传播、免口令回归、v1 兼容迁移、四道闸、304 短路均实测通过。
  - **不能判 `accepted`**：存在一条**面向用户的事实错误**（E2：隐私政策称"每会话至多一次"，实际 5 分钟无限次），以及一处**未被契约记录的非目标突破**（E1：轮询）。这两条都属于"不改就不能算干净"的开放项，且 E2 是合规口径问题。
  - 另有一组**延迟发作的契约风险**（C2/C3/C5）：当前线上因客户端校验器更宽松而未暴露，但任何一次单边改动都会表现为全体 400 或全体打旧地址。
- **未判 `rejected`**：能力已交付并在线验证，无 blocking 的技术缺陷；E2 是文案与披露问题，可单点修复。

---

## Open questions（已由 Ming 裁定，2026-10-19）

| # | 问题 | 裁定 | 后果 |
|---|---|---|---|
| 1 | 【E1】「不做轮询」怎么落地 | **改写非目标，让契约跟上** | `SPEC.md` 的 CAP-5 intent、约束、非目标三处，以及 `sync-protocol.md` 的请求量模型，统一改写为「不做后台轮询；仅在插件 UI 打开期间做 5 分钟兜底 + 事件触发的即时拉取」，并把理由（聊天站页面常驻可见）写进契约 |
| 2 | 【C2】校验器往哪侧收 | **客户端对齐服务端** | 客户端 `isValidEnvelope` 补 `writer` 正则、`updatedAt` 上界、`kdf` 闭集；现有跨端断言从「比对常量文本」升级为「同一批输入两边结论必须一致」。服务端防滥用强度不变 |
| 3 | 【C5】硬编码函数 URL | **硬编码 + CI 校验一致性** | 地址继续留在 `DEFAULT_SYNC_SERVER_URL`；`deploy_sync.py` 回读到的 URL 与仓库常量不一致即部署失败。零新 UI |
| 4 | 【B1/B2】god-class 何时拆 | **等体验层落地后一次拆** | 本轮不拆。拆解记入 `deferred-work.md`，与体验层同一批次执行，避免拆完被新代码填回 |

**裁定后的执行状态**：第 1–5、7、8 条已执行（见下「执行记录」）；第 6 条（god-class 拆解）按裁定延后到体验层落地后完成（见第 2 轮）；第 9 条（PBKDF2 真机标定）经维护者 2026-10-19 决定取消。

### 执行记录（2026-10-19）

| 动作项 | 状态 | 落点 |
|---|---|---|
| 1 校验器单一真源 | **已执行** | `src/sync/SyncCrypto.ts` 补 `WRITER_PATTERN` / `MAX_CLOCK_SKEW_MS` / `KDF_FIELDS` 闭集；新增行为级跨端测试 `src/sync/EnvelopeParity.test.ts`（22 个信封样本，断言两端结论逐一相同） |
| 2 常量语义陷阱 | **已执行** | 服务端 `ENVELOPE_VERSION` → `ENVELOPE_VERSION_V1`，新增 `ENVELOPE_VERSION_CURRENT`；跨端断言改为「客户端当前版本 === 服务端当前版本」 |
| 3 函数 URL 不再裸奔 | **已执行** | `scripts/deploy_sync.py` 新增 `read_client_server_url` / `verify_client_server_url`，不一致即部署失败；补 4 条测试 |
| 4 隐私政策事实错误 | **已执行** | `CommonSettings.ts` 改为与实际拉取行为一致 |
| 5 文档对账（E1/E3/E4/E5/E6/E7、D2） | **已执行** | `SPEC.md`（轮询三处 + HeadObject）、`sync-protocol.md`（LWW/冷却/请求量）、`backend-architecture.md`（10s 闸实际实现）、`client-integration.md`（测试设施 + 密钥缓存 + DB v3）、`readme.md`；`crypto-spec.md` 标注 PBKDF2 低端机未实测 |
| 6 god-class 拆解 | **延后 → 已执行**（第 2 轮） | 见第 2 轮执行记录；`a012624` |
| 7 CI 部署事务化 | **已执行** | `.github/workflows/webpack.yml` 拆成 `deploy-bundle` / `deploy-sync` 两个独立 job，各自 concurrency 锁；自动部署收窄到 `main` + `workflow_dispatch`（**这推翻了 build 阶段「任意分支即部署」的旧裁定**，理由见 G2） |
| 8 `remoteRev` 落盘 | **已执行** | `PluginSyncSettings.lastRev` + `setRemoteRev()` 唯一写入口 + 三处装配点 `restoreRemoteRev()`；真机验证：写入过一次之后，每次重开页面的首个 GET 都带 `If-None-Match` 并命中 **304** |
| 9 PBKDF2 真机标定 | **标注未实测**（用户裁定） | `crypto-spec.md` §1 |

执行后验证：`npm run build` ✅、客户端 vitest **68/68**、服务端 `node --test` **48/48**、Python **49/49**；后端已按新代码重新部署，`deploy_sync.py` 的 URL 一致性校验在真实地址上通过；CI 的两个部署 job 已并行跑通（23s / 24s）。


---

# 第 2 轮复盘：体验层落地后（2026-10-19）

本轮起因：第 1 轮把「首次启用缺预览确认」记为 **D1**，并裁定延后到体验层。体验层 story 已交付（`f484e28`），D1 的开放状态需要收口，同时核对第 1 轮 action items 是否被新代码回退。

## Epic summary（第 2 轮）

- **Story 列表（3 个，全部 `done`）**：
  1. `backend` — `spec-favorites-cloud-sync-backend.md`，范围 `6216567..337e4eb`（第 1 轮记录）。
  2. `client` — `spec-favorites-cloud-sync-client.md`，范围 `337e4eb..093bd21` + `2c0b074` 簇（第 1 轮记录）。
  3. `experience` — `spec-favorites-cloud-sync-experience.md`，基线 `1e55733`，范围 `1e55733..f484e28`：**1 提交 / 6 文件 / +679 −35**（`git_evidence.py --range 1e55733..f484e28 --stories experience`）。提交 subject 未写 story id，故脚本的 `commits[].stories` 为空，story 归属由 spec 的 `baseline_commit` 推得。
- **未完成 story**：无（三份 spec 的 `status` 均为 `done`）。**仍无 `sprint-status.yaml`**，完整性门禁无法由脚本执行——这是"没能检查"，不是"检查过且干净"。
- **证据清单**：epic spec ✅、3 份 story spec ✅、`git_evidence.py` ✅、diff 范围 ✅、第 1 轮复盘 ✅、session 记录（本会话上下文）✅、sprint status ❌、CI 日志（本轮未重跑部署）❌。

### 证据缺口（第 2 轮）

| 缺口 | 影响 |
|---|---|
| 无 `sprint-status.yaml` | 第 1 轮 13 条 action items 无账本可机读，只能靠复盘文档的「执行记录」与代码核对 |
| 未重跑 `bmad-review` 全量 | 本轮 diff 在 build 阶段已跑过 3 个评审层（blind-hunter / edge-case-hunter / verification-gap，26 条发现，裁决落在 `spec-favorites-cloud-sync-experience.md` 的 Review Triage Log）。为免同质噪声，仅对**跨 story 接缝**做内联核对（见 R2-7） |
| 真机成功合并链路 | 测试账号口令未知，无法构造「云端有数据 + 正确口令」的确认场景 |

## Findings（第 2 轮）

### A. 契约收口

- **R2-1（accept as-is）D1 已关闭。** 首次启用现为「纯读预览 → 确认 → 写入」：`previewEnable` 只发一次 GET、不置 `enabled`、不写密钥缓存（`src/sync/SyncManager.ts:418`），`performSync` 在 `dryRun` 分支算完 `items`/`stats` 即返回（`src/sync/SyncManager.ts:1037`），`commitEnable` 才落地 `enabled`/`salt`/`unlocked`（`src/sync/SyncManager.ts:508`）。`SPEC.md:33-35`（CAP-3）与 `client-integration.md:81` 的描述现在与实现一致。证据还含 83 条客户端用例（`npm test`，2026-10-19）与真机错误口令路径（一次 GET、零 PUT）。
- **R2-2（spec reconciliation，未完成于第 1 轮）** `sync-protocol.md:85` 仍写「用户可选择『以本地为准覆盖云端』」，而本轮冻结意图明确排除该能力（「不做『以本地为准覆盖云端』」），代码也从未实现。第 1 轮 action item 5 声称已对账 `sync-protocol.md`，实际漏掉这一行。

### B. 体量增长（god-class 触发条件已达）

- **R2-3（fix now，触发条件已满足）** `src/sync/SyncManager.ts` 从第 1 轮的 **897 行**增至 **1101 行**（本轮净 +204，含预览/提交/取消三段与上传门），继续承担编排、密钥上下文、事件触发与持久化四类职责。第 1 轮的裁定是「等体验层落地后一次拆」，该条件**现已满足**；`deferred-work.md` 中对应条目到期。`FavoritesStorageService.ts` 本轮未动，仍 **982 行**。出处：`git_evidence` 的 `files.SyncManager.ts`（+213/−27）+ `wc -l`。

### C. 重复与模式分歧

- **R2-4（accept as-is，记录在案）** 确认框把宿站 `buildSelect2` 的图标/尺寸脚手架又抄了一份：`SettingsService.ts:402-409` 与 `NetEasePlatform.ts:62-77` 是同一段内联样式；`300ms` 跨弹窗让位常量在 `SettingsService.ts:383`、`NetEasePlatform.ts:747`、`:831` 各写一次。build 阶段已作为低价值重构驳回（无命名过的调用方会因此分叉），此处记录以免下一轮重复提出。
- **R2-5（accept as-is）** 新代码继续借用宿站 `mdi-*` 类，与根 `AGENTS.md`「图标一律自包含」的约定相左，但与 `NetEasePlatform.buildOrderConfirmSelect` 的既有做法一致，且真机核验字形正常（`spec-favorites-cloud-sync-experience.md` 的 Manual checks）。属已知分歧，不再作为缺陷。

### D. 行为验证缺口

- **R2-6（defer）** 真机只验证了**失败/取消**侧：错误口令预览（一次 GET、零 PUT、状态全未变）与确认框渲染（1280 / 390 两档无溢出、图标正常、取消回调值正确）。**成功合并**（确认后只一次 PUT、无二次 GET、提示条同组数字）与「预览停留期间增删收藏 10 秒零 PUT」仍只有假 fetch 的集成测试覆盖，未在真机复跑。出处：`spec-favorites-cloud-sync-experience.md` 的 Manual checks 末条。

### E. 跨 story 接缝（内联核对）

- **R2-7（accept as-is）** 三处接缝核过、无缺陷：① `enable()` 已无残留调用方（`grep -rn "SyncManager.enable"` 零命中），面板唯一入口改走 `previewThenEnable`（`SettingsService.ts:347`）；② 预览期间 `enabled=false` 使 `maybeAutoPull` / 变更监听自然不发请求，上传门 `canAutoUpload` 只作第二道保险（`SyncManager.ts:175`）；③ `disable()` / `forgetLocalKey()` 均清 `pendingEnable`（`src/sync/SyncManager.ts:678`、`:695`），不存在「关掉同步却留下可确认预览」的状态。
- **R2-8（fix now，流程）** 第 1 轮把「预览」判为 CAP-3 的缺口并 defer，但 defer 时没有同步改写 `SPEC.md` / `sync-protocol.md`——导致第 1 轮的读者会以为能力已交付（同 R2-2）。这一轮补上了代码，文档侧仍留一处。教训：**defer 一项能力时，契约同步改写必须与 defer 同时发生**，否则复盘每轮都要重新判一次。

## Behavior verification（第 2 轮）

| 项 | 观察结果 | 证据 |
|---|---|---|
| 构建 | `npm run build` 成功（tsc + vite，133 modules，bundle 286.26 kB） | 本会话输出 |
| 自动化测试 | 7 文件 / **83 用例**全绿，含预览零 PUT、确认一次 PUT/零二次 GET、取消、空云端、503、未登录、并发预览、路由纯函数 | `npm test` |
| 真机：错误口令预览 | 一次 GET、**零 PUT**；提示「同步口令不正确」；`enabled`/`salt`/`lastSyncAt` 未变 | `spec-favorites-cloud-sync-experience.md` 的 Manual checks |
| 真机：确认框渲染 | 1280 / 390 两档无横向溢出、图标字形正常、两选项可点、取消回调值正确 | 同上 |
| 真机：成功合并 | **未验证**（账号口令未知） | R2-6 |

## Previous-retro follow-through（第 1 轮 → 第 2 轮）

无 `sprint-status.yaml`，`action_items` 账本不存在，因此无法机读跟进；以下按第 1 轮文档的「执行记录」＋代码复核：

| 第 1 轮条目 | 是否落地 | 证据 |
|---|---|---|
| 1 校验器单一真源 / 2 常量语义 / 3 URL 一致性校验 | 落地且本轮未回退 | `src/sync/SyncCrypto.ts`（`WRITER_PATTERN` / `KDF_FIELDS`）、`EnvelopeParity.test.ts` 仍在；`scripts/deploy_sync.py` 的 `verify_client_server_url` 仍在 |
| 4 隐私政策事实错误 | 落地，本轮进一步改写 | `CommonSettings.ts:49` 第 3 条与实现一致；`LocalStorageUtils.ts:151` 版本升至 1.0.4 |
| 5 文档对账 | **部分** | E1/E3/E4/E5/E6/E7、D2 已改；`sync-protocol.md:85` 漏改（R2-2） |
| 6 god-class 拆解 | 第 1 轮延后，**第 2 轮已完成** | `a012624`：SyncManager 1101→93、FavoritesStorageService 982→557 |
| 7 CI 部署事务化 / 8 `remoteRev` 落盘 | 落地且本轮未回退 | `.github/workflows/webpack.yml` 两个独立 job；`PluginSyncSettings.lastRev` + `restoreRemoteRev` 仍在 |
| 9 PBKDF2 真机标定 | 未做（owner Ming） | `crypto-spec.md` §1 标注未实测 |
| 10 子代理硬门禁 | **本轮观察到生效** | 本轮实现子代理未 commit/push，提交由主会话在复核后完成（`f484e28` 的作者是主会话流程） |
| 11 驳回 low 前先写触发场景 | **本轮观察到生效** | Review Triage Log 对 B11/E2、B5/E3 等 low 均写了「在什么使用场景下会撞上」 |
| 12 结论必须回源 | **本轮观察到生效** | 评审 26 条发现逐条回源核验后才裁定（见 Triage Log 的「证据」列） |
| 13 格式噪声拦截 | **本轮观察到生效** | diff 中 `CommonSettings.ts` 仅 1 行、`LocalStorageUtils.ts` 3 行，无整文件重排 |

第 10–13 条的「生效」仅为**本会话的行为证据**，不写入 sprint-status（账本不存在）。

## Action items（第 2 轮）

每条：做什么 / 谁 / 是否已应用。**本节只提议，不自动执行。**

1. **拆解 `SyncManager`（1101 行）**（owner: dev）— 按「编排 / 密钥上下文 / 事件与触发 / 预览确认」切分；拆解窗口现已开放（第 1 轮裁定条件满足）。同时评估 `FavoritesStorageService`（982 行）是否同批拆。证据：R2-3。**未应用。**
2. **删除或显式标注 `sync-protocol.md:85`**（owner: dev）— 「以本地为准覆盖云端」既未实现也被意图排除，应从契约中移除，或在同处写明「非目标」。证据：R2-2。**未应用。**
3. **补真机成功合并验证**（owner: Ming + dev）— 用已知口令的账号构造「云端有数据」场景，核对：确认前零 PUT、确认后仅一次 PUT、无二次 GET、提示条与确认框同组数字；顺带复跑「预览停留 10 秒零 PUT」。证据：R2-6。**未应用。**
4. **defer 能力时同步改写契约**（owner: 我 / 流程）— 把「defer 一项能力 ⇒ 同一轮内改 spec 与 companion」写成复盘/构建的收尾检查项，避免 R2-8 重演。**未应用。**

### 执行记录（第 2 轮，2026-10-19）

| 动作项 | 状态 | 落点 |
|---|---|---|
| 1 SyncManager + FavoritesStorageService 拆解 | **已执行** | SyncManager 1101 → **93 行**：新增 `SyncRuntime.ts`（运行态与上传门）、`SyncTransport.ts`（同步读写与防抖排程）、`SyncEnableFlow.ts`（预览/确认/取消）、`SyncLifecycle.ts`（触发/解锁/启停），加上已有的 `SyncGate`/`SyncContext`/`SyncSettingsStore`/`SyncTypes`；对外 API 仍由 `SyncManager` 门面暴露。FavoritesStorageService 982 → **559 行**：抽出 `favorites/recordUtils.ts`（纯主键/归属/ID 推导）、`favorites/database.ts`（打开与原地升级、ID 缓存、内存降级、延迟归属）、`favorites/tombstones.ts`、`favorites/restorePlatformData.ts`。构建通过、83 用例全绿；真机注入后 UI 与同步设置卡片正常渲染，控制台无插件错误。 |
| 2 `sync-protocol.md:85` | **已执行** | 第 5 步改写为「非目标：服务端对 `updatedAt` 倒退的写入直接 409，客户端不提供该选项，只做并集确认」。 |
| 3 真机成功合并 | **已执行** | 见下方「Behavior verification·第 2 轮补充」。 |
| 4 defer 时同步改契约 | **已执行** | 规则写入 `AGENTS.md` 的「BMAD 流程约定」：defer/降级/非目标必须在同一轮改 SPEC 与 companion，并注明未实现或计划轮次。 |

### Behavior verification 补充（第 2 轮，真机）

测试账号 `650aa0eb96551`，口令存放于本机 `.secrets/sync-test-passphrase.txt`（git-ignore）。为取得可控口令，先清空云端（DELETE 200），再走完整链路：

| 场景 | 观察 | 结论 |
|---|---|---|
| 首次启用（云端已清空） | 请求序列 `GET` → `PUT`，**无确认框**；卡片变「已启用 / 已解锁」 | 与 AC5 一致（空云端跳过确认） |
| 构造差异：本地 4 / 云端 3 | 禁用后再启用 | 预览只发 **1 次 GET**；确认框显示「云端 3 / 本地 4 / 合并后 4」 | 数字口径正确 |
| 预览停留 10 秒 | 期间收藏无增删 | 请求日志**仍只有那 1 次 GET，零 PUT** | 「确认前不得上传」在真机成立 |
| 点「合并并上传」 | 3.5 秒后复查 | 新增 **1 次 PUT**、无第二次 GET；卡片「已启用 / 已解锁」，上次同步时间更新 | AC4 成立 |
| 取消 | 本轮未复跑 | 上一轮已真机核过取消回调与零改动；本轮 DOM 操作误删了宿站 `#selectHolder`，未重复 | 记为未覆盖 |

清理：云端已 DELETE（200），本地 4 条验证收藏已从 IndexedDB 删除，注入脚本已移除。

## Acceptance verdict（第 2 轮，当前有效）

- **Verdict：`accepted`**（2026-10-19 人工确认：开放项已全部处置）
- **判据来源：profiled**（`SPEC.md` 仍无独立验收标准节；判据沿用第 1 轮从 7 条能力与 Success signal 推演）。
- **理由**：
  - 三条 story 全部 `done`，无未完成交付。CAP-3 的预览确认已由 `f484e28` 真正交付，并在本报告「Behavior verification 补充」中完成真机成功合并验证（预览 1 GET、确认后 1 PUT、无二次 GET、停留 10 秒零 PUT）；第 1 轮的唯一用户可见事实错误（E2）与 D1 均已关闭。
  - 第 2 轮的开放项均已处置：god-class 拆解、`sync-protocol.md:85`、成功合并链路验证、同步状态显示、预览门接线测试全部完成；`PBKDF2` 低端机标定经维护者决定取消（接受桌面实测 + 文档化外推）。`deferred-work.md` 当前未解决条目为 0。
- **不判 `rejected`**：能力齐全，无已知的数据丢失或安全缺陷。

## Open questions（第 2 轮）

| # | 问题 | 需要谁回答 |
|---|---|---|
| 1 | god-class 拆解是否与「同步状态常驻显示」（`deferred-work.md` 中的下一条体验项）同批做，避免拆完又被填回 | Ming |
| 2 | 真机成功合并验证能否提供一个已知口令的测试账号 | Ming |
| 3 | `sync-protocol.md:85` 的「以本地为准」是彻底删除，还是保留为「非目标」记录 | Ming |

## Assumptions（第 2 轮）

- 互动运行，无 headless 假设。Epic 由用户选择确认（收藏云同步）；epic 无 `stories.yaml`，story 列表沿用第 1 轮「两份 implementation spec + 本轮 experience spec」的推得方式，并在 R2 的 Epic summary 中记录。
