---
spec: spec-large-file-decomposition
date: 2026-11-04
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# 复盘报告：巨型文件拆分与死代码清零

## Epic Summary

- **范围**：6 个 story（死代码 / MainAppContainer / NetEasePlatform / ShufflePicker / BiliBiliVideoAPI / openShufflePicker）
- **基线**：`b884bef` → **交付**：`9019b96`（范围外伴随提交：`de38e82` 换 `@types/jquery`、`713a520` 改构建 target）
- **变更**：47 文件，+4691 / −4090 行
- **目标达成**：四个千行文件 → 386 / 364 / 338 / 17 行；`openShufflePicker` 411 → 356；死代码 4 项清零
- **测试**：75 文件 / 1289 用例（交付时全绿）
- **证据**：SPEC、6 个 story 记录、`.memlog.md`、`b884bef~1..9019b96` 的 diff（9139 行）
- **说明**：本仓未安装 `_bmad/method`，按 spec 树复盘

---

## Findings

### A. 验收口径问题（影响「这个 epic 算不算达成」）

- **[F1 中] CAP-3 在 epic 自己的提交内不成立。** 基线 444.61 kB / gzip 133.60 → story 4 是 **444.78 / 134.25**、story 5 是 **444.46 / 134.27**：raw 超过基线、gzip 超过 134 上限。真正拉回 437.25 / 131.99 的是 epic 之外的 `713a520`（`target: 'es2020'`），但 SPEC 的成功信号仍被记为「本 epic 达成」。
- **[F2 中] story 4/5 把偏差归因为「拆分固有成本」，结论错误且从未回写。** 两份 story 都写「差额来自跨模块 props 与解构键名，继续压只能牺牲可读性」；而 memlog 自己记了真因是构建 target 的降级辅助代码。偏差已由 `713a520` 零可读性代价解决，记录仍停在「已知偏差，未做」。
- **[F3 中] CAP-3 的「gzip 134 kB」没有写口径。** vite 报表 134.25 与 `gzip -9` 实测 133,431 B 差 819 B，两个口径谁算数从未定义，导致验收不可复现。

### B. 记录与事实不符

- **[F4 低] 行数手估而非实测。** `shufflePickerHost.ts` 记 84 行（实际 74）、`BiliBiliVideoAPI/index.ts` 记 13（实际 17）、`ShufflePicker.tsx` 记 340（实际 338）。CAP-1 的验收标准就是行数，记录却没用同一套测量。
- **[F5 低] story 6 把「400 行」写成全局阈值。** 它自称「同样超过 400 行阈值」，但同一次交付里仍有 5 个文件 >400 行（`BiliBiliVideoAPI` 拆分前 1050，拆分后 `Crypto` 609、`FavoritesStorageService` 563 等）。按 story 6 的口径，CAP-1 不通过；按 SPEC 原文（四个目标文件），story 6 本不该存在。
- **[F6 低] private→public 的数量被低估约 3 倍。** story 2 记「七个字段去掉 private」，实际是 **25 个成员**（`private ` 出现次数 40 → 7）。其中 `controller` 由私有可写变成公开可写，而 view / modes / categories 每次调用都重新读 `host.controller`，外部赋值会一次性改道整块面板行为。
- **[F7 低] 「effect 顺序与原文件一致」不成立（行为仍等价）。** 现在 constrains/blur/exiting 三个 effect 先于挂载 effect 注册，`alive` 也从挂载 effect 拆成独立 effect。净效果等价，但 triage 把一个真实差异说没了。
- **[F8 低] memlog 收尾写「五个 story 全部交付」，实际 6 个。**

### C. 代码层面的遗留（小）

- **[F9 中] `playlistSkeleton` 的注入面漏处理。** story 3 的 triage 列了 6 个名字、只处置 5 个（`playlistSkeleton` 既没修也没记为不修）。类上的 `playlistSkeleton` 只是别名，`vi.spyOn` 对选集面板无效；同一面板里 `fetchSongDetailsPooled` 走 deps 注入、`playlistSkeleton` 不走，边界不一致。
- **[F10 中] host 工厂在 `this.state` 赋值之前执行，接口却把 `state` 声明为必需。** 字段初始化早于构造函数余下语句，`createController(this)` 时 `host.state` 是 `undefined`。当前安全（两个工厂只返回闭包），但类型断言了一个此刻不存在的值。
- **[F11 中] 三处「空合集不可点选」判定各自维护。** `ShufflePicker.tsx` 的 `empty()` 驱动全选，`PickerList.tsx` 两处内联副本驱动灰化。story 4 只加了「两处需同步改」的注释。
- **[F12 低] `readonly` 与实际可写性不符。** `itemsPerPage` 在接口上是 `readonly`、类字段已公开可写；`snapshots` 声明 `readonly` 但靠 `.set()` 就地修改。
- **[F13 低] `BiliBiliVideoApi` 的 30 个方法从自有静态属性变成原型链继承属性。** 当前无代码依赖（无 `spyOn`、无 `getOwnPropertyNames`），但「打桩单个方法」这类将来很容易写出的用法会踩空。

### D. 验证缺口

- **[F14 高] story 6 是唯一没有 Triage Log 的 story，且声明了 `review: quick`。** 它抽的正是 story 4 明确排除的宿站接线（单例、返回键包装、焦点判定），没有任何审查结论可核对；`context:` 也漏了新增的 `shufflePickerHost.ts`。
- **[F15 中] SPEC 的成功信号（四条主路径真机一致）没有对应证据。** epic 收尾的真机结论只有「面板打开、ipinfo 缓存命中、无外部脚本」，覆盖不到点播、循环/随机、收藏、设置——恰好是 story 2/3/4 改动的核心。后续轮次（代理加固时）补测了网易云与 B 站的搜索/点播，但那不属于本 epic 的验收。
- **[F16 低] CAP-2 的「零引用清零」只扫了值导出。** 拆分新引入 9 个「导出但无人 import」的纯类型，类型面从未纳入同一把尺子。零运行时代价，但「清零」是清单式验收而非可复现的不变量。

---

## Behavior Verification

- 真机（epic 收尾时）：面板打开、`ipinfo` 缓存、无外部脚本。
- 后续轮次补测（不属于本 epic 验收）：网易云搜索/点播、B 站搜索/点播、代理 gzip 与 412 重试。
- 六个 story 中 5 个有审查记录，story 6 没有。

---

## Action Items

> 2026-11-04 复盘后经维护者批准全修（A1–A14）。

| # | 项 | 证据 | 状态 |
|---|---|---|---|
| A1 | 回写 story 4/5 的 gzip 结论（真因是构建 target，已由 `713a520` 解决） | F1/F2 | 已修 |
| A2 | CAP-3 补口径（`gzip -9` 实测），并记录 epic 期间的实际轨迹 | F3 | 已修 |
| A3 | story 6 补 Triage Log 与 `context:`（加 `shufflePickerHost.ts`） | F14 | 已修 |
| A4 | 三个文件的行数改成实测值（74 / 17 / 338 / 261） | F4 | 已修 |
| A5 | 写清「400 行」只约束四个目标文件，story 6 是自愿扩展 | F5 | 已修 |
| A6 | story 2 的 private→public 数量更正为 25，并注明 `controller` 可写的影响 | F6 | 已修 |
| A7 | `playlistSkeleton` 改为 deps 注入 | F9 | 已修 |
| A8 | `controller` / `categories` 移到构造函数末尾，`host.state` 不再是未定义 | F10 | 已修 |
| A9 | 空合集判定提取为 `isEmptyCollection`，三处共用 | F11 | 已修 |
| A10 | `itemsPerPage` / `snapshots` 的 `readonly` 与实际对齐 | F12 | 已修 |
| A11 | `BiliBiliVideoApi` 加注释：静态成员在原型链上 | F13 | 已修 |
| A12 | memlog 的「五个 story」改为 6 个；CAP-2 口径注明只覆盖值导出 | F8/F16 | 已修 |
| A13 | effect 顺序的记录更正（净效果等价，但顺序确实变了） | F7 | 已修 |
| A14 | SPEC 约束新增：收尾必须跑四条主路径真机 | F15 | 已修 |

---

## Acceptance Verdict

**accepted**

- CAP-1（四个文件 ≤400 行）：达成，逐文件实测 386 / 364 / 338 / 17 行。
- CAP-2（死代码清零）：达成（值导出 4 项），但「清零」只覆盖值导出，9 个零引用类型未纳入（F16）。
- CAP-3（产物不回退）：**epic 内未达成**，由范围外的 `713a520` 拉回；记录已按复盘改正（A1–A3）。
- 记录质量：6 份 story 里有 5 份存在可核对的事实偏差（行数、数量、effect 顺序、story 数），已在 A4–A6、A12–A13 改正。
- 覆盖缺口：story 6 无审查（F14，已补 triage），真机没覆盖四条主路径（F15，已写入后续约束）。

## Assumptions

- 本仓未安装 `_bmad/method`，按 spec 树复盘。
- 未运行 Phase 3 团队讨论（opt-in，未请求）。
- 判定「行为等价」时以 diff 逐行核对与现有 1289 条用例为准，不含真机。
