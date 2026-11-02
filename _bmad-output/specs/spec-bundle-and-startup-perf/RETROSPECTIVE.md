---
spec: spec-bundle-and-startup-perf
date: 2026-11-02
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# 复盘报告：产物体积与启动开销收口

## Epic Summary

- **Epic**：`spec-bundle-and-startup-perf`（5 个 story，全部 `built`）
- **基线**：`ad6d6ee`（spec 定稿）→ **交付**：`42de7f4`
- **变更统计**：35 个文件（不含 lock），+677 / −201 行
- **产物**：`dist/bundle.js` 475.04 → 444.62 kB；gzip −9 实测 132,725 B（基线 142.78 kB）
- **测试**：65 文件 / 1235 用例 → 69 文件 / 1252 用例
- **证据清单**：`SPEC.md`、`stories/1..5-*.md`（含各自 Review Triage Log）、`.memlog.md`（49 条）、6 个提交的 diff、两次真机脚本输出（`unpkg` 归零、`ipinfo` 首轮 1 次 / 次轮 0 次、面板与二维码渲染）
- **未纳入**：本仓未安装 `_bmad/method/`，`tickets.py` 不存在，故按 spec 树而非 ticket 树复盘；无 session log 存档

---

## Findings

### 1. 跨 story 边界（epic 级审查，均经命令复核）

- **[F1 高] `tsconfig.app.json:7-11` 的 `lib` 是被替换而非追加。** story 2 把 `ES2020` 换成 `ES2022.Array`，后者只声明 `Array.prototype.at`，ES5–ES2020 的全局类型（`Object`/`String`/`Number`/`Function`/`IArguments`）随之消失。复核：只带 `lib: ["ES2022.Array","DOM"]` 的临时工程报 TS2318 ×6、TS2552 ×2；本仓能过，仅因同一提交引入的 `@types/node` 内部有 `/// <reference lib="es2020" />`。副作用是浏览器代码也能通过 `Buffer`/`process` 的类型检查，与 CAP-3「静态检查如实反映代码」相抵。
- **[F2 高] `src/environment/Environment.ts:116,125` 的测速过滤让国内代理永不入选。** 新增的 `if (!res || !res.ok) continue` 把两个代理都判为失败——实测两个代理根路径均返回 `400`（缺 `?url=` 参数）。于是 `requestTimes` 恒空，兜底固定写香港节点。改动前含 400 也计时，国内网络通常选深圳，属本次引入的回归，且正好发生在 story 5 声明要覆盖的「探测失败」路径上。
- **[F3 中] `SPEC.md:44` 的 Success signal 未随 CAP 修订。** 仍写「≤ 390 kB / gzip ≤ 120 kB / 面板关闭静置 10 秒无高频轮询」，而 CAP-1 已放宽到 450/134、CAP-2 已删掉轮询指标、Non-goals 已写明按需订阅未实现。当前产物 444,620 B / gzip 132,725 B，按旧判据属未达成。
- **[F4 中] `SPEC.md:13` 的 Why 仍写「约 95 kB 是 qrcode 依赖链」。** 该数字已被本 epic 自身的 memlog 证伪（实测 −14.16 kB），契约里留着会让下一轮误判收益量级。
- **[F5 中] `.memlog.md:53` 记录了不存在的 API。** 写着「新增 `ready(timeout=5s)`」，而 story 5 的 triage 明确记录该 API 已删除、`src` 内无引用。memlog 是 append-only，需要追加更正而非改历史。

### 2. 验证缺口

- **[F6 低] `HostMediaBridge.test.ts:418-427` 未真正断言「零订阅者」状态。** `vi.useFakeTimers()` 在 `fixture()`（已创建 ProgressSession 的真实定时器）之后才安装，零订阅那一刻不可观测；且 `getTimerCount()` 统计整个 jsdom 环境，任何新定时器都会污染断言。
- **[F7 低] `SetBiliBili.ts:175` 的 `Promise<string>` 错误语义变化。** `Promise.resolve(renderQRCodeDataUrl(text))` 先求值再包 Promise，函数内的两条抛错变成同步抛出而非 rejection。现有唯一调用点在 async 中 `await`，暂无可见影响，与 story 2「契约未变」的说法不完全一致。
- **[F8 低] CAP-3 表述覆盖面夸大。** `noUnusedLocals` 只在 `tsconfig.app.json` 打开（`tsconfig.node.json` 仍为 false）；`noUnusedParameters` 在 epic 之前就已是 true。
- **[F11 中] CAP-1 没有自动化守门。** 无体积断言脚本，CI 只跑 build + test；距 450 kB 仅剩 5.4 kB、距 134 kB 约 1.3 kB，下一个功能即可静默破线。三次构建的 gzip 值（133.42 / 133.60 / 133.66）也说明单次人工记录不足以作基准。
- **[F12 低] 二维码「可被解码回原始 URL」「真机完成一次扫码」无可复现证据。** 单测只校验前缀、尺寸与矩阵差异；jsQR 解码与 `showImg` 渲染均为一次性手工记录，扫码登录未执行（需人手用手机）。

### 3. 仓库卫生与流程

- **[F9 低] `stats.html`（207 KB）仍是受版本控制的生成物**，而其插件 `rollup-plugin-visualizer` 已在 story 4 移除，与 CAP-3「未使用的东西不再留在仓库里」冲突。
- **[F10 低] `AGENTS.md:62` 的修正在 `bmad:context` 托管块内**，头注释仍标「Verified 2026-10-12 against fe3e381」，下次 `bmad-project-context` refresh 会把更正回退。
- **[F13 中] 体积估算量纲错误（流程）。** 立项时用 visualizer 的 `renderedLength`（未压缩源码长度）当 minified/gzip 收益，得出 −95 kB / −29 kB；实际为 −14.16 kB / −5.73 kB。CAP-1 目标因此在 story 2 中途被迫重校。
- **[F14 中] CAP-2 的「≤1Hz」基于未核实的订阅者模型（流程）。** 到 story 5 才发现 250 ms 轮询是循环/随机判定的功能需求，常驻订阅无法降频；该条只能改写成「无订阅者时停表」并在 Non-goals 记未实现。
- **[F15 中] 依赖操作引发的构建回归未即时发现（流程）。** `npm uninstall @types/qrcode` 触发 prune 掉未声明的 `@types/node`，`tsc -b` 才暴露出 `.at()` 缺 lib；同类问题还有 `npm i` 把 `@types/jquery` 自动升到 4.x（已由 review 拦下）。
- **[F16 低] 格式化噪声三次混入功能提交。** `tsconfig.app.json`（story 2）、`vite.config.ts`（story 4）、`tailwind.config.js`（story 3，已在 review 阶段还原）均出现过整文件重排，与 `AGENTS.md`「格式化不得与功能混提」相悖。
- **[F17 低] 验收标准里的例子未先核实。** story 3 把 `animate-[imwSheetRise…]` 当作「只存在于文档」的类，实际 `RoomDeck`/`EpisodePicker` 在用，由 review 拦下并改写。
- **[F18 低] review 修复后未统一重跑审查。** 仅 story 2 做了第二轮 review；story 3/4/5 的修复内容未再经独立审查，本轮 epic 级审查才补上（即 F1/F2）。

---

## Behavior Verification

- **首次进站**（真机注入）：`ipinfo.io` 请求 1 次、调试脚本请求 0 次、写缓存 `{"location":"Global"}`、`iirosemedia.cors` 为香港代理、Alt+S 面板正常打开。
- **刷新后**：`ipinfo.io` 请求 0 次，缓存命中，面板正常。
- **二维码**：jsQR 离线解码 212×212，内容与原始 URL 逐字符一致；真站 `window.showImg` 渲染 `IMG naturalWidth=212`，静区与定位角完整。
- **未验证**：B 站真机扫码登录（需人手）；测速回退路径（F2 已说明其实际不可用）。

---

## Action Items

| #   | 项                                                               | 证据    | 建议    |
| --- | ---------------------------------------------------------------- | ------- | ------- |
| A1  | `lib` 改为 `["ES2020","ES2022.Array","DOM","DOM.Iterable"]`      | F1      | fix now |
| A2  | 测速只排除 `null`，非 2xx 视为连通；同步改测试 mock              | F2      | fix now |
| A3  | SPEC 的 Success signal 与 Why 同步到实测结论                     | F3/F4   | fix now |
| A4  | memlog 追加更正（`ready()` 已删除）                              | F5      | fix now |
| A5  | 轮询用例把 fake timers 提前到 fixture 之前                       | F6      | fix now |
| A6  | `qrCode` 返回 `Promise.resolve().then(...)`，保持 rejection 语义 | F7      | fix now |
| A7  | CAP-3 措辞收窄为「app 工程开启 `noUnusedLocals`」                | F8      | fix now |
| A8  | 删除 `stats.html`，必要时补 `.gitignore`                         | F9      | fix now |
| A9  | 体积守门（build 后断言阈值，或 CI 步骤）                         | F11     | 提案    |
| A10 | 二维码解码测试（引入开发期解码器）                               | F12     | 提案    |
| A11 | `AGENTS.md` 托管块的校验戳与内容同步                             | F10     | 提案    |
| A12 | 下一轮 spec 立项先跑一次构建取基线，再写体积目标                 | F13/F14 | 流程    |

---

## Acceptance Verdict

**accepted-with-open-items**

- CAP-1（≤450 kB / ≤134 kB）：达成（444.62 kB / 132,725 B gzip），但 Success signal 文案未同步（F3），且无自动守门（F11）。
- CAP-2（无外部脚本、不重复探测、无订阅者停表）：达成并经真机验证；「≤1Hz」原判据已在 Non-goals 记为未实现（F14），属显式降级而非静默放弃。
- CAP-3（依赖卫生、静态检查）：达成；措辞需收窄（F8），`stats.html` 遗留（F9）。
- 两项高优先级回归（F1/F2）由本次 epic 引入，修复前不应视为完全干净。

## Assumptions

- 本仓未安装 `_bmad/method`，`tickets.py` 不可用，复盘按 spec 树（SPEC + stories）而非 ticket 树进行。
- 交互模式下未征询 going-in concerns（用户直接要求复盘）。
- 未运行 Phase 3 团队讨论（opt-in，未请求）。
- 无 session log，流程类结论（F13–F18）依据对话与 memlog 中的记录，而非独立日志归档。
