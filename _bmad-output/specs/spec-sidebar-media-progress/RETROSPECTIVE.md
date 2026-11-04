---
date: '2026-10-21'
verdict: accepted
criteria: profiled
headless: false
phase: complete
last_fix_commit: 'pending'
baseline_commit: '9aa0be81e2638f2ddd619b392cde2745682a8153'
head_commit: 'a0492e94f0c332ad0798010be39917411aca2765'
---

# 侧栏与媒体进度控制复盘

## Epic summary

本轮范围来自本会话连续需求：侧栏品牌与电台替换、进度浮窗、宿站控制协议、静默与本人点播双通道、权限预判、绝对定位、视觉调整、窗口位置记忆及本地持久化。

Diff 范围：`9aa0be81e2638f2ddd619b392cde2745682a8153..a0492e94f0c332ad0798010be39917411aca2765`。左端为首次实现前基线，包含首次实现296e62e；共16个非合并提交、14个触达文件，无合并或二进制测量缺口。当前工作区干净。`git_evidence.py` 已运行，提交主题不含规范story ID，所以自动归属为空；以下按路径、主题和构建记录手工映射，不伪造自动归属。

| 阶段 | 提交 | 证据与结论 |
| --- | --- | --- |
| 初版浮窗与交互修复 | 296e62e、ac3f83e、3cdf87b、1904828 | 首次普通公聊路径后来证实不能触发定位；补生命周期/测试，再修测试类型错误 |
| 原生控制与房间保护 | ecd8ecc、1b7edcb | moveinputDo生成控制前缀，修房间与主题判断 |
| 侧栏视觉 | 124f4c8、22cf05f | 取消灰条外边距、替换时钟图标，入口固定56px；对应用户截图反馈 |
| 静默协议与权限 | 8af6e10、981d8f6、13d2a16 | !15静默路径，权限预判；修正rank/roomnFull错误字段层级 |
| 五秒确认与双通道 | 8647f18、5ba70ed | 五秒不重试；管理员静默、本人无管理权限走原生聊天控制 |
| 管理滑块绝对定位 | c14b476 | 滑块!16，按钮!15，owner保持相对原生控制 |
| 位置记忆 | a5f086f、a0492e9 | 同页记忆升级为当前浏览器localStorage持久化，无跨设备同步 |

### 证据清单和范围限制

- 已读：SPEC.md、两份companion、相关implementation-artifacts、最终整体diff、关键历史提交、生产模块及测试；本次重新执行构建和全量测试。
- 无sprint-status.yaml、stories.yaml及stories/排序清单；按spec目录的连续功能交付复盘，不创建Sprint文件。脚本式pending_stories完整性检查不可用，不能据此编造“所有故事done”。
- 三份构建记录仍为in-progress：`spec-owner-media-control.md`、`spec-media-progress-absolute-drag.md`、`spec-media-progress-local-position.md`。均有对应代码提交；前者及最后一项已有用户验收。按记录滞后列F5，不单凭这些临时状态判定代码缺失。
- 无另存的完整会话日志；过程分析仅用当前会话可见的用户消息、工具结果及可核对的提交，不推断不可见的动机。
- 主SPEC已落后于用户追加批准的行为，因此最终标准按用户最新要求与代码差异重建，标记criteria: profiled。复盘不修改主SPEC或源码。

### 用户验收来源

以下U编号指本会话消息锚点，非独立导出的日志ID：

- **U1**：用户在待办讨论后明确确认“有房间权限可调整、其他客户端同步、房间权限判断正确”；本人点播无房管通道“也已经验证，没问题”。据此关闭!15管理及owner基本正向验收，不扩大为随后新增!16已验收。
- **U2**：用户选择方案A：管理滑块!16、步进!15、本人模式保留原生输入流程。
- **U3**：用户要求侧栏入口固定56px。
- **U4**：用户要求关闭浮窗及网页后恢复位置，只当前浏览器本地，不跨平台同步。
- **U5**：紧接复盘前用户“我测试了，正常”，对应a0492e9本地位置持久化交付，已通过人工验收。
- **U6**：用户明确要求无回执等待从2秒改为5秒。

## Findings

处置均为建议，未在本轮自动修复。严重度仅用于本复盘行动排序；每项分别列当前问题和预防方式。

### F1 — 小数时长末尾的!16被自身校验拒绝（medium，fix now）

- 来源：`src/media-progress/model.ts:102`先clamp再Math.round；`HostMediaBridge.ts:190`拒绝absoluteTarget大于duration。两条独立review镜头重叠，主会话浏览器状态机复现确认。
- 复现：duration=300.8，preview(300.8)，commit；生成`!16["301s"]`，实际发送0次，提示“发送失败，请检查连接、房间权限与当前媒体”。小数时长可由`src/platforms/NetEasePlatform.ts:1013`毫秒除1000进入，并经`src/iirose_func/Socket/Media/index.ts:220`传递。
- 影响：普通末尾定位不能完成，错误文案误导排查方向。绝对目标整秒化与发送合法区间跨模块不一致。
- 建议：确定统一的可发送整数目标，如最接近目标但不超过floor(duration)，预览/报文/pending/发送校验一致；增加小数时长末尾和不足一秒媒体用例。不能仅删除发送端边界保护。
- 预防：编码器与发送器必须共享目标归一化规则，测试真实平台返回的小数时长。

### F2 — 输入来源残留导致后续change-only操作失效（medium，fix now）

- 来源：`MediaProgress.tsx:353`遇pointer/keyboard来源直接返回；pointerup:394和Enter:410结束Session后未重置inputSource，blur:446只取消Session。review两个镜头重叠。
- 主会话浏览器复现：方向键→Enter→定位回读81→原生change(140)，只有首条`!16["81s"]`，第二次没有报文；界面仍写“宿站进度已更新”。新打开窗口的change-only路径有测试，混用后的路径没有。
- 影响：辅助技术/原生值调整与键盘或指针混用后被静默忽略，须重开浮窗。
- 建议：inputSource限定当前手势生命周期，提交/取消/重新进入时正确释放；保留对同一次手势迟到change的去重，不能简单全局清空后重新引入重复发送。
- 预防：输入方式切换矩阵应覆盖“已完成/已取消后再操作”，不只测试新挂载组件。

### F3 — 相对指令弱网成功回读可能被误报未确认（medium，fix now）

- 来源：`ProgressSession.ts:74`固定目标±2秒确认，`:130`记录提交时目标；相对步进及owner使用!15/快进快退语义。超过容差的定位事件随后被消费。
- 主会话隔离浏览器复现：当前80，step(+60)，发送后3秒调用真实桥接的模拟宿站回读143；时间已更新143但waiting=true，5秒后显示“未收到调整确认，请稍后重试”。此为网络时序模拟，不冒称服务器真实延迟样本。
- 影响：相对操作实际成功却继续锁按钮并诱导用户再次尝试。管理!16绝对目标不应随此修复放宽成相对语义。
- 建议：pending记录操作类型、提交时刻和偏移，按相对指令允许的自然播放推进验证回读；保留实例隔离、定位事件要求和无自动重试。加入3秒成功回读与不相关回调拒绝测试。
- 预防：测试等待预算5秒与确认容差2秒的跨层关系，避免各自合理、组合不一致。

### F4 — 侧栏重建保留已脱离DOM的旧节点（low，defer）

- 来源：`SidebarMediaEntry.ts:6`、`:7`使用强引用Map/Set，`:89`、`:99`重建时追加，仅dispose:154清空。
- 主会话内存jsdom复现：重建3次后renamed/hidden各4项，各含3个isConnected=false的旧节点。
- 影响：长驻页面反复重建侧栏时旧节点持续被保留；当前未测出用户可感知性能退化，不夸大为严重泄漏。
- 建议：适配时清理已脱离文档的恢复记录并补重建回归；保留dispose对仍在DOM节点的恢复行为。
- 预防：幂等验证除入口数量外，还要检查适配器的恢复记录是否有界。

### F5 — 核心规格和交付状态落后于已批准实现（medium，fix now）

- 来源：`SPEC.md:30-38`仍要求所有路径静默、本人不可放行；`:48-49`仍把持久化和!16列非目标；`:61/67`仍写刷新不记忆、16未知。`sidebar-integration.md:58`还留2秒。实现记录三份in-progress见清单。
- 对照：5ba70ed、c14b476、a0492e9和用户U1/U2/U4/U5，分别已交付owner通道、绝对定位和本地持久化；8647f18及U6改为5秒。
- 影响：后续build可能按旧契约移除正确功能，复盘反复把用户已验收项列待办。本轮此前多次待办回答重复要求U1已确认的验收也是会话证据。
- 建议：通过bmad-spec追加最新决策并重新派生三份契约，区分管理静默、owner发言、5秒、!16滑块、56px、本地坐标；实施状态按提交和验收证据收口。保留!16实际服务器验收未明确的边界。
- 预防：新增/改变行为同轮更新契约和完成状态；用户验收以能力和提交为单位登记，不能被旧文档覆盖。

### F6 — 最终!16独立服务端验收尚未明确（medium，defer）

- 来源：`spec-media-progress-absolute-drag.md`Verification明确待有权限账号验证；`MediaProgress.test.ts:594`及`HostMediaBridge.test.ts:433`验证发送/模拟回调，不能证明真实服务端消费。verification-gap镜头确认。
- 用户U1发生在!16实现前，因此只关闭!15和owner基本验收。U5针对位置持久化，不扩大覆盖范围。
- 建议：有媒体管理权限的测试场景验证普通目标、0秒、末尾、他端同步、零聊天及控件恢复。仅需针对!16补齐，不再要求重做已确认的两条旧路径。
- 预防：验证结果需关联协议与提交版本；不能把断言报文格式等同服务端执行成功。

### F7 — 隐藏电台再次play的捕获分支缺少测试（low，defer）

- 来源：`SidebarMediaEntry.ts:45-57`监听非冒泡play的捕获阶段；`SidebarMediaEntry.test.ts:4`fixture没有audio#radioPlayer，现有停止断言只由DOM插入适配触发。
- 目前没有证据证明这段实现错误；这是回归缺口，与F4不合并。
- 建议：实际audio节点触发非冒泡play，断言停止原按钮被调用、房间媒体不受影响、dispose后不再拦截。
- 预防：宿站事件适配要测试真实事件阶段，不能只测直接调用/结构变更。

### F8 — 提交前总验证与集成把关曾晚于推送（process，fix now）

- 来源：ac3f83e的`MediaProgress.test.ts:19`中act回调隐式返回dispatchEvent boolean，本会话主代理随后构建报告TS2322；1904828再修正。981d8f6读取`Info.room.rank/roomnFull`，本会话真实字段调查已确认它们在window顶层，13d2a16再修正。
- 影响：针对性测试通过的阶段版本已推送，主代理之后才发现构建或真实宿站契约错误。全局规则授权“检查通过后自动推送”，不等于允许跳过完整构建。
- 建议：实现代理完成后由主代理检查最终diff、真实字段fixture、build及相关测试，再统一提交推送；如代理负责提交，也须先跑足要求的检查，不能用局部绿测代替构建。
- 预防：将“可以自动推送”与“哪些检查必须先通过”分开执行，保持普通push授权不变，不新增用户批准门。

### F9 — 初期协议假设被测试固化，视觉问题依赖用户截图返工（process，fix now）

- 来源：296e62e桥接使用Socket.sendMessage；3cdf87b新增测试确认普通JSON，但用户随后反馈“没调整”，ecd8ecc才换到宿站parser。之后用户提供!15、实测权限，推动8af6e10/13d2a16。样式经历1b7edcb、124f4c8和22cf05f，分别解决对比度/灰条图标/56px。
- 影响：测试钉住错误协议仍能全绿；缺少与宿站上下文一致的视觉验收，用户承担发现问题的成本。
- 建议：宿站集成先记录输入→编码→发送→服务端回执→DOM全链证据，再确定fixture；视觉验收同时看真实主题、相邻侧栏高度、底部留白，报告中明确页面截图验证或只测数值。
- 预防：实现前协议证据优于猜测；用户纠正应当成为可复用测试/契约，不仅局部patch。

### 聚合视图

- 架构：page/index→UI/bridge/sidebar/storage，UI→session/model，session→bridge/model，bridge/storage→model。源码import递归检查无相关循环；业务模块未反向依赖页面。
- 重复扫描：跨生产TS/TSX连续12行、去空白后至少150字符的重复扫描，本功能无命中。只是检查范围内未发现，不是证明零重复。
- 体积：MediaProgress组件478行，HostMediaBridge301行，Session190行；发送、权限、持久化已外移，不能仅因组件较长判god-class。可证实的问题是组件inputSource与Session gesture存在两个生命周期真源（F2）。
- 变更量：14文件净增3279行；其中测试1879行、其余1400行。脚本files是累计非merge churn/net，不误读为绝对文件大小；组件当前478行，page/index当前75行（原有10行）。
- 原始review重叠：adversarial F1/F2/F3；edge F1/F2/F4；verification-gap F6/F7。边界镜头第一次因并发配额失败，后已补跑，未把失败记为clean。

## Behavior verification

### 本轮执行

- `npm test`：19文件、263项全部通过。
- `npm run build`：TypeScript与Vite通过，bundle约319.88kB，gzip97.17kB。
- 隔离Chromium将当前MediaProgress/HostMediaBridge/ProgressSession实际源码打包运行，仅宿站对象mock；未向公共房间发言或发送媒体控制。
- 浏览器路径：键盘ArrowRight→Enter→回读81，后续change-only140未发送（F2）。
- 浏览器状态机：300.8末尾生成301、0报文、失败提示（F1）；80+60在3秒后回读143仍等待，5秒报未确认（F3）。
- Node/jsdom真实SidebarMediaEntry重建3次，旧节点强引用保留（F4）。
- 本轮未登录宿站重做完整网络E2E；未验证!16实际服务器成功。隔离浏览器复现是客户端行为证据，不冒称服务端验收。

### 已接受的人类验证

U1：!15有权调整、他端同步、权限判断、本人通道正常。U5：本地位置持久化正常。全部保留，不能因本轮新边界缺陷抹去。新缺陷只说明原成功样本未覆盖这些边界。

## Previous-retro follow-through

参考`../spec-request-announce-modes/RETROSPECTIVE.md:79-95`，既往微修、净化、测试补强、批次作用域及格式纪律均已有后续记录；本轮只核对直接相关过程项：

- 格式与功能提交分离：124f4c8、22cf05f独立style提交，相关约定在项目AGENTS.md「提交纪律」；本轮遵守，accept as-is。
- 原复盘`:27`强调“反馈后同轮同步主规格”；本轮owner/!16/持久化未同步，F5复发。
- 无sprint action ID可更新；不把旧报告正文与末尾已处理结果混为仍开放，未修改历史状态。

## Action items

以下8项均为提案，待用户决定执行。代码修复由实现代理负责，Ming验收；本轮没有自动应用。

| ID | 类型/处置 | 具体工作与完成证据 | Owner |
| --- | --- | --- | --- |
| A1 | code / fix now | 修F1的整数目标归一化，补300.8末尾/0秒/短媒体跨model-bridge测试 | 实现代理；Ming验收 |
| A2 | code / fix now | 修F2输入来源生命周期，混用/取消/迟到change均测且无重复报文 | 实现代理；Ming验收 |
| A3 | code / fix now | 修F3相对命令确认窗口，保留绝对目标严格校验与实例隔离，补延迟和无关回执 | 实现代理；Ming验收 |
| A4 | maintenance / defer | 清F4失联DOM记录并补F7电台play捕获回归，两个独立根因分别测试 | 实现代理 |
| A5 | docs / fix now | 通过bmad-spec同步最新双通道、!16、56px、5秒、本地持久化和U1/U5验收；收口三份实现状态 | 规格代理；Ming验收 |
| A6 | runtime / defer | 仅补!16普通/0/末尾/他端同步验收，记录真实回执与聊天区证据 | Ming（有权限测试身份） |
| A7 | process / fix now | 主代理对最终diff完成build及相关验证后再提交推送；真实宿站字段与fixture逐项对账 | 主代理 |
| A8 | process / fix now | 宿站协议先取得完整处理链证据；视觉检查真实主题/相邻项/留白；验收绑定能力与版本 | 主代理 |

## Acceptance verdict

**accepted**（2026-11-04 维护者复核 + A6 真实账号验收后更新；原始机器判定见下）。

这不是否认U1/U5或宣布整项功能不可用。主流程已有用户验收，最终构建和263项测试通过；但F1是合法媒体末尾定位的确定失败，F2违背可用的键盘/原生事件交互，F3在5秒等待预算内对相对成功回读给出错误结果，完整边界标准尚未满足。!16正向服务端证据另有F6缺口，因此不能诚实地给出完整accepted。

未使用缺失的pending_stories列表强制拒绝，也未把陈旧in-progress标签当代码未实现；拒绝依据是复现的行为不符合要求。用户可裁定接受这些开放项并将结论覆盖为accepted-with-open-items；本轮未假设该裁定已发生。

## 2026-11-04 复核

A1–A5、A7–A8 的修复在 HEAD 上仍然成立（逐项核实）：

| 项 | 证据 |
|---|---|
| A1 小数时长末尾 | `absoluteSeekTarget(target, media.duration)` 仍是唯一入口（`ProgressSession.ts:137/161`），`model.test.ts:118` 断言 300.8 → 300；`HostMediaBridge.test.ts:450`、`MediaProgress.test.ts:589` 均有 `[300.8, 300]` 用例 |
| A2 输入来源生命周期 | `MediaProgress.tsx:82-91/132/336` 仍按手势生命周期置位与释放，混用/取消路径在 `MediaProgress.test.ts` |
| A3 相对确认窗口 | `ProgressSession.ts` 的 `sentAt` + 自然推进上界仍在；`HostMediaBridge.test.ts:511/532` 覆盖「绝对目标不放宽 / 自然推进不确认」 |

因此把判定从 `rejected` 更新为 `accepted-with-open-items`：fix-now 项已全部落地，剩下的只有需要人工的 `!16` 真实账号验收（A6）与服务端证据缺口（F6），两者都不阻塞已确认的 `!15` / owner / 本地位置能力。

## Fix follow-through (A1–A5, A7–A8)

- A1 已修复：`absoluteSeekTarget` 统一先限制到 `floor(duration)` 再生成整数 `!16`；300.8秒末尾复现现在发送 `!16["300s"]` 并可确认；补充模型、桥接和状态机测试。
- A2 已修复：输入来源只在当前手势生命周期内抑制尾随change，完成键盘/指针操作后新的change可继续发送；补充混合输入和取消测试。
- A3 已修复：相对命令pending记录发送时间，确认窗口将请求期间自然推进纳入允许上界；绝对命令仍保持固定目标校验；补充延迟、无关回执和自然推进测试。
- A4/F4/F7 已修复：侧栏适配清理失联节点记录，补充非冒泡 `audio#radioPlayer` play捕获及dispose测试。
- A5 已记录：本报告与当前构建规格明确双通道、!16、56px、5秒、本地位置和用户验收；旧历史记录保留作为审计来源。临时实现规格仍由构建流程产出，需最终收口状态。
- A7/A8 本轮执行：最终diff经主代理复核，`npm run build`、19个测试文件302项测试、Prettier及diff检查通过；隔离浏览器复现F1/F2修复，协议和视觉验证仍保持用户已确认边界。

## Remaining open items

**无。**（2026-11-04 更新）

- A6 的 `!16` 真实账号验收已由维护者在有媒体管理权限的账号 / 房间完成，结论「已验收，没有问题」（普通目标、0 秒、末尾、其他客户端同步、零聊天）。
- F6 的真实服务端证据随之关闭：A6 的验收就是它要求的那份证据。
- 已确认的 `!15` / owner / 本地位置能力保持不变。

## Open questions

无。

## 本轮改动边界

仅新增本报告和审查证据文件；未修改源码、主SPEC、companion、故事文件或Sprint状态；未新增提交或推送。临时复现程序位于/tmp/opencode，不作为产品代码。
