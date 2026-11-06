---
epic: epic-standardization
spec: spec-standardization
date: 2026-11-03
verdict: accepted-with-open-items
criteria: declared
headless: false
---
# 复盘报告：存储、分页、平台接口与错误提示的标准化

## Epic Summary

- **范围**：4 个 story（存储收敛 / 分页加载器 / 平台检索描述表 / 错误提示收敛），全部 `built`
- **基线**：`c118fc8` → **交付**：`516db67`
- **变更**：53 个文件，+1715 / −936 行（含测试 260 行）；产物 438.69 → 435.85 kB
- **测试**：70 文件 / 1258 → 75 文件 / 1289 用例
- **指标**：`localStorage` 直连 70 → **0**；`splitByPage` 实现 2 → **1**；同款 `catch` 18 → **0**；`mainAppCategories` 316 → **100 行**
- **证据**：SPEC、4 个 story 记录、`.memlog.md`（17 条）、4 个提交的 diff（3541 行）
- **说明**：本仓未安装 `_bmad/method`，`tickets.py` 不可用，按 spec 树复盘

---

## Findings

### A. 本次引入的回归（must-fix）

- **[F2 高] 设置写盘失败后标题说谎。** `PluginSettings.saveFavoritesPageSize` / `setDefaultPage` 只改 `getPluginSetting()` 返回的副本，写盘失败仍 `return` 新值，设置行显示「50 条」而 `pageSizeFor` 从磁盘读到的仍是 10。旧实现 `setItem` 抛错会在改标题之前中断。story 1 已经对 `BiliBiliSettings` 做过同样修正，却没有套用到这几处。
- **[F3 高] 同步启用链路依赖抛错中断，现在会静默成功。** `SyncEnableFlow.commitEnable` 的 `catch` 只接抛错；`updateSyncSettings` 改为静默写盘后，配额满时用户被告知「已启用」，但 `enabled` / `salt` / `deviceId` 只留在内存，刷新即丢，而云端已上传密文——本机没有 salt。关闭同步同理，刷新后会复活。
- **[F5 中] `pagedLoader.loadPage` 没有 rejection 分支。** fetch 拒绝时 `updating` 永久为 true，之后所有翻页被守卫拦住，并产生未处理 rejection。四个真实 fetch 目前都自己吞错，属潜伏缺陷；但入口类型并不保证「失败也解锁」。

### B. 契约与记录不一致

- **[F1 中] CAP-4 只交付了一半，SPEC 未同步。** SPEC 的 success 写「失败分类（网络 / 风控 / 解析 / 未知）由一处决定」，而 `reportFailure` 只做「转文案 + 弹一次」，分类仍散在 `Api/index.ts` 的 `neteaseRequest` 与三段 GET/POST/HEAD 重复提示里。按 AGENTS「defer 一项能力必须同轮改契约」，story 4 收窄范围时应同步改写 success 句。
- **[F14 低] story 4 记「替换 20 处」**，实际基线 18 处 + 1 处手写内联，共 19。
- **[F9 低] story 3 的「收藏页大小不再依赖行下标」是空转。** `favoritesPageSize()` 的实现就是 `pageSizeFor(MODE.favorites)`，而收藏行下标恒等于 3，两个分支结果永远相同；也没有用例用非默认 `favoritesPageSize` 断言 `loadFavorites` 收到该值。

### C. 未覆盖的重复（CAP-2 只完成 2/4）

- **[F10 中] `RadioPlatform` 与 `AllVideosPlatform` 仍各自保留切分循环**，`RadioPlatform.ts:59` 直接写死 `/ 10`；视图侧 `itemsPerPage`、`Platform.itemPerPage`、平台内常量三份 10 目前相等。CAP-2 的「新增来源只提供取一页的函数」对这两处不成立。

### D. 结构性隐患（既有，但本轮把语义收敛到一处后更该处理）

- **[F8 中] 模式下标有第二份真相。** `platformSearchSources` 的行序即模式下标，而 `settings/deskModeCatalog.ts` 声明自己才是唯一真相；测试断言的是字面量顺序，往 catalog 插入模式时测试仍绿，面板会把整行范围挂到错误模式上。
- **[F11 中] 描述表配置错误的两种失败模式都不友好。** 多族声明在 `createCategories`（容器字段初始化）里同步抛错，一条笔误会带走整个面板；漏声明所有族则走到 `range.desk`，点击时才抛 `load is not a function`。
- **[F12 中] 票号失效不对称。** `runSearch` 清 `updating` 却不递增 `requestToken`（`applyMode` 会）；关键词被清空时，在途的旧翻页结果仍会通过 `pushAllData` 追加回已清空的列表。既有缺口，本轮把票号语义收敛进加载器后仍未覆盖。
- **[F13 低] 损坏/不可用的存档让协议弹窗行为变化。** `readJson` 把「损坏」与「无记录」折成同一结果，损坏存档会当场弹协议（旧实现推迟一次启动）；隐私模式下读永远 null、写永远失败，**每次刷新都会弹一次** TOS + 隐私协议。story 1 记为「记录不修」，理由需改写成「新行为取代旧行为」而非「结果一致」。

### E. 已核对为非问题

- 存储收敛的 key 与落盘格式零漂移（39 处 `setItem` / 35 处 `getItem` / 2 处 `removeItem` 全部有对应）。
- `platforms → page/MainAppContainerServices` 的反向依赖**没有**产生模块级环（161 个模块的 import 图检测；检出的 11 个环全部是改动前既有）。
- 分页加载器的接入时序（票号 / `updating` / `pushAllData`）与四个 Service 的旧实现逐项一致；电台的本地过滤与 `totalPage: 1`、收藏的发起时页码捕获都保住。
- 描述表的范围文案、顺序、`class`、`phoneOnly`、`sourceKey` 与旧文件逐项一致。

---

## Behavior Verification

- 本轮没有真机验证（均为纯内部重构，无 UI/交互变化）；依赖现有 1289 条用例与逐 story 的 diff 审查。
- `reportFailure` 的「文案不变」只有 helper 级测试，**没有端到端断言**——18 个替换点无一条验证某平台失败后弹出的文案与旧实现相同。AGENTS 的「用户可见文案必须端到端断言」正是为此写的。

---

## Action Items

> 2026-11-03 复盘后经维护者批准全修（A1–A10），代码见 `9c92f93`。

| # | 项 | 证据 | 状态 |
|---|---|---|---|
| A1 | 设置写盘失败不返回新值（`saveFavoritesPageSize` / `setDefaultPage`） | F2 | 已修 |
| A2 | 同步启用/关闭串接写盘结果，失败如实返回 | F3 | 已修 |
| A3 | `loadPage` 补 rejection 分支解除 `updating` | F5 | 已修 |
| A4 | SPEC 的 CAP-4 收窄为「单一上报入口」，分类写入 Non-goals | F1 | 已修 |
| A5 | `RadioPlatform` / `AllVideosPlatform` 接入 `splitByPage` 与页大小 | F10 | 已修 |
| A6 | 描述表行序由 `deskModeCatalog` 派生（`Record<DeskModeId, …>`） | F8 | 已修 |
| A7 | 描述表加 `validateSearchSources()` 自检，漏族给明确错误 | F11 | 已修 |
| A8 | `runSearch` 递增票号，堵住在途结果回灌 | F12 | 已修 |
| A9 | 给失败文案补端到端断言 | 验证缺口 | 已修（Error 与非 Error 各一条） |
| A10 | 修正 story 4 的「20 处」与 story 1 关于弹窗的结论 | F14/F13 | 已修 |

---

## Acceptance Verdict

**accepted**

- CAP-1（存储收敛）：达成——生产代码 `localStorage` 直连归零，key 与格式零漂移；两处「写失败仍报成功」（F2/F3）已修。
- CAP-2（分页单一实现）：达成——7 个 Service 有 6 个接入（`InnerPageService` 语义不同，已记入非目标），`splitByPage` 全仓一处，`RadioPlatform` / `AllVideosPlatform` 已接入。
- CAP-3（描述表）：达成（方案已按 memlog 调整并写进 SPEC）；行序第二真相（F8）与配置错误模式（F11）已修。
- CAP-4（提示收敛）：达成——单一入口落地，CAP 已按实际交付收窄，失败分类写入 Non-goals（F1）。
- 两处高优先级回归（F2/F3）由本次引入，已在复盘后修复（`9c92f93`）；A1–A10 全部落地，测试 76 文件 / 1292 用例全绿，产物 436.45 kB / gzip 132.66 kB。

## Assumptions

- 本仓未安装 `_bmad/method`，按 spec 树复盘。
- 未运行 Phase 3 团队讨论（opt-in，未请求）。
- 上一轮 `spec-bilibili-split-and-idle-guard` 与 `spec-large-file-decomposition` 亦未复盘，本轮只覆盖 `spec-standardization`。
