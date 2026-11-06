---
ticket: 2
title: 点播归属守卫与生命周期
type: feature
created: '2026-10-24'
status: done
baseline_revision: a1872731bd1e877d5bfe943f50529ce8fe433a04
route: dispatch
review_loop_iteration: 0
context:
- '{project-root}/_bmad-output/initiative-iirose-media-web/archive-v6/spec-playback-loop-shuffle/SPEC.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-playback-loop-shuffle/ownership-and-lifecycle.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-playback-loop-shuffle/sidebar-controls.md'
---
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 开关行现在只反映「有没有媒体、时长是否已知」，不知道当前曲目是谁点的，也不感知换房；一旦后续 story 接上自动点播，就会在别人点的歌上插手，或在换房后把旧状态带进新房间。重复注入还会各起一套控制器。

**Approach:** 把宿站已有的点播者与房间信息提升为快照字段，由状态机统一执行守卫：本人点播才允许自动动作，他人点播时进入待命（保留点亮但不动作），换房、断线、媒体消失、刷新、重复注入一律停用。自动动作本身仍由 story 3/4 注入。

## Boundaries & Constraints

**Always:** 待命态与生效态共用同一份点亮视觉，只通过 `title` 与读屏文本说明「当前曲目由他人点播」，不新增中间样式；重复注入采用「后注入者接管」——新实例启动前先释放旧实例（行、订阅、桥接、状态机），保证同页只有一份控制器；归属判定取 `#shareMediaUserName` 的 `title` 与 `window.myself` 去除首尾空白后严格相等；任一为空或不等即视为「非本人」，不缓存判定、不做 HTML 实体或全角归一化；待命不灰化按钮（`aria-disabled` 保持 `false`）；换房以宿站房间标识为准，不得用 `MediaSnapshot.instance`（它在换房与每次点播时都会自增）；所有守卫集中在 `PlaybackMode`，行只负责呈现；状态只存内存。

**Never:** 不实现自动播放、报文缓存、收藏读取、权限判定（story 3/4）；不改 `HostMediaBridge` 既有的权限与 `send` 白名单；不改「播放进度」浮窗；不发任何公屏或聊天内容；不改 `imwPluginSetting`；不新增依赖；不在本 story 实现「用户手动操作后暂停 2 秒」窗口（无自动动作可暂停）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 本人点播 | 点播者与 `myself` 相等，已点亮循环 | 正常点亮、无原因、可继续动作 | N/A |
| 他人点播 | 点播者不等于 `myself`，已点亮循环 | 进入待命：仍点亮、`aria-disabled="false"`、原因说明他人点播；不自动动作 | 不弹提示（避免每曲刷屏） |
| 点播者信息缺失 | `title` 为空或 `myself` 非字符串 | 视为非本人，进入待命 | N/A |
| 昵称含首尾空白 | 两侧仅空白不同 | 判定为本人 | N/A |
| 本人重新点播 | 待命中，点播者变回本人 | 立即退出待命，恢复可用 | N/A |
| 换房 | 房间标识变化 | 熄灭开关并提示一次原因，不把状态带进新房间 | 无房间标识时视为未变化 |
| 断线 | `connected` 为 false | 熄灭并提示一次，恢复连接不自动重新点亮 | 同 story 1 |
| 媒体消失 | `#shareMediaBox` 不存在 | 熄灭并提示一次 | 同 story 1 |
| 刷新页面 | 重新加载 | 默认熄灭（内存态） | N/A |
| 重复注入 | 同页出现第二个控制器 | 后注入者先释放旧实例再启动，DOM 与订阅始终只有一份 | 旧实例释放失败时仍不得出现双行 |

</frozen-after-approval>

## Review Triage Log

| 发现 | 判定 | 路由 | 证据 |
| --- | --- | --- | --- |
| `roomIdentifier` 返回未去空白原值，空白变化会误判换房（blind#1、edge#6） | low | patch | 只 trim 判空、不回写；`" room-a "` 与 `"room-a"` 被判不同 → 误熄灭并提示 |
| 两个新纯函数无直接单测（blind#2） | low | patch | 只在桥接/fixture 间接覆盖；NaN/Infinity/布尔/对象/空白边界未钉住 |
| 待命与换房原因未进 companion 表，且 companion 仍写「待命随 story 2 接入」、换房归入「转为不可用」（blind#3） | medium | patch | `sidebar-controls.md` 与实现矛盾；按项目约定同轮改契约 |
| 10 秒文本去重吞掉第二次换房提示（blind#4、edge#1） | low | patch | 令牌变化但文案相同 → `notice()` 去重丢弃，状态已熄灭却无解释 |
| `cleared` 无确认/重置语义，后来者会重放旧提示（blind#5） | low | patch | 字段长期保留「最近一次」；补消费契约注释并纳入签名 |
| `dispose` 非异常安全，旧控制器定时器可能存活（blind#6、edge#2） | medium | patch | `disposed = true` 在 `close()` 之前，抛错后 `bridge.dispose` 与 pagehide 解绑不可达 |
| 半构建实例（构造函数抛错）无句柄（edge#3） | low | patch | 页面键在桥接与侧栏都建好后才写；中途抛错留下 250ms 定时器 |
| 待命原因触屏/键盘不可达（blind#7） | medium | defer | companion 只写「点击时以 title 说明」，移动端无 hover；需要交互设计，随 story 3 的自动动作一并定 |
| 重复注入用例只断言 DOM，未断言旧实例轮询停止（blind#8、verify#1） | medium | patch | 删掉 `previous?.()` 后 345 用例仍全绿，`getTimerCount()` 由 2 变 3 |
| `IMCInit.init` 每次追加主面板容器，出现重复 `#IIROSE_MEDIA_CONTAINER`（blind#9） | medium | defer | 既有行为，本 story 只接管媒体进度控制器；修它要改主面板容器生命周期 |
| 桥接与状态机对 `roomKey=null` 处理不一致（blind#10） | low | patch | 桥接把 null 当变化（`instance++`），状态机当未变化；补注释与用例钉住分歧 |
| 待命原因变化不触发发布（blind#11） | low | patch | `signatureOf` 未纳入 `standbyReason`，未来多原因时会留旧文本 |
| 状态区「已被后续提示覆盖」分支无用例（verify#2） | low | patch | 改无条件清空后全绿，条件分支从未执行 |
| 真机未验证 `roomnFull` 稳定性与 `title` 等于 `myself`（blind#12） | medium | defer | 守卫的地基假设；本机可跑 `iirose-plugin-verify`，留到 story 3/4 真机联调一并确认 |
| stories.yaml 记账与代码不同步（blind#13） | false | — | `stories.yaml` 仅由 Story Breakdown 写；story 2 的 `done_checkpoint` 本就是 false，无缺陷 |

## Code Map

- `src/media-progress/model.ts:4-19` -- `MediaSnapshot` 结构；本 story 增加 `ownMedia: boolean` 与 `roomKey: string | null` 两个字段
- `src/media-progress/HostMediaBridge.ts:98-104` -- 已算出 `ownMedia`（`title` 与 `myself` 比较）但未进入快照；`:79-84` 的 `roomKey` 是私有字段，`instance` 在换房与 `shareMedia` 调用时都会自增（`:278`），不能代替房间标识
- `src/playback/PlaybackMode.ts:46-112` -- 状态机：可用性派生、`settle()` 清灭、签名去重发布；守卫与待命逻辑加在这里
- `src/playback/SidebarPlaybackRow.ts:110-172` -- 行渲染与提示去重（`notices` / `role="status"`），待命态的呈现改在这里
- `src/page/index.tsx:13-85` -- 组合根：`initMediaProgress` 是模块级函数、靠 `disposeProgress` 防重入；本 story 的单实例守卫加在这层
- `src/media-progress/SidebarMediaEntry.ts:110-170` -- `onMediaChange` 回报媒体存在性（story 1），本 story 复用
- `_bmad-output/specs/spec-playback-loop-shuffle/ownership-and-lifecycle.md:5-30` -- 归属判定与停止条件的契约原文
- `src/media-progress/HostMediaBridge.test.ts:1-50`、`src/media-progress/MediaProgress.test.ts:77-128` -- 假宿主与组合根 harness 写法

## Tasks & Acceptance

**Execution:**
- [x] `src/media-progress/model.ts`、`src/media-progress/HostMediaBridge.ts` -- 快照增加 `ownMedia`（严格相等、去首尾空白、未知为 false）与 `roomKey`（`roomnFull` 字符串化，缺失为 `null`），不改 `instance` 语义 -- 守卫需要稳定数据源
- [x] `src/playback/PlaybackMode.ts` -- `applySnapshot` 消费 `ownMedia`/`roomKey`：房间标识变化 → 熄灭；点亮但非本人 → 待命（保留模式、状态里暴露 `standby` 与原因）；转回本人 → 退出待命 -- 守卫集中在一处
- [x] `src/playback/SidebarPlaybackRow.ts` -- 呈现待命态与原因（按 Open Question 的答案），复用现有提示去重与 `role="status"` -- 不改状态机
- [x] `src/page/index.tsx` -- 按单实例策略加守卫，并在 `dispose` 中释放标记 -- 防重复注入双控制器
- [x] `src/playback/PlaybackMode.test.ts`、`src/playback/SidebarPlaybackRow.test.ts` -- 覆盖 I/O 矩阵全部行（本人/他人/缺失/空白/恢复/换房）与单实例行为 -- jsdom
- [x] `src/media-progress/HostMediaBridge.test.ts`、`src/playback/fixtures.ts` -- 断言新快照字段（含 `roomnFull` 缺失与 `title` 变化），fixture 补字段 -- 防快照回归

**Acceptance Criteria:**
- Given 点播者是本人，when 点亮循环，then 无待命原因且可用性不受归属影响
- Given 点播者是他人或未知，when 快照刷新，then 开关仍点亮、按钮不灰化，原因说明他人点播，且不触发任何自动动作
- Given 处于待命，when 本人重新点播，then 待命在同一帧内解除
- Given 已点亮任一模式，when 房间标识变化，then 模式熄灭并提示一次原因
- Given 同页重复注入，when 检查 DOM 与订阅，then 只有一份控制器生效，另一份不产生行或订阅
- Given 刷新页面，when 重新初始化，then 开关默认熄灭

## Verification

**Commands:**
- `npm test` -- expected: 全部通过（21 文件 / 345 用例），含归属、待命、换房与重复注入用例
- `npm run build` -- expected: `tsc -b` 无错误，`dist/bundle.js` 产出

**Mutation checks（确认用例不是同义反复）:**
- 去掉 `releasePlaybackController` 调用 → `MediaProgress.test.ts`「重复注入」转红（跨 bundle 实例出现 2 份 `#imw-playback-controls`）
- `ownMediaOf` 去掉 `trim()` → `HostMediaBridge.test.ts` 归属用例转红
- 行内去掉待命 title 分支 → `SidebarPlaybackRow.test.ts`「他人点播」转红

**Manual checks (if no CLI):** 未执行真机验证（本轮改动全部落在既有 jsdom 覆盖范围内；待命与换房需真人双账号才能触发）。

## Implementation Notes

- 归属判定抽成 `model.ts` 的 `ownMediaOf(owner, myself)`：两侧去首尾空白后严格相等，非字符串/空白/不等一律 false；不做实体或全角归一化。`HostMediaBridge` 的 `controlMode` 仍沿用这份判定，但权限与控制白名单未改。
- 房间标识抽成 `model.ts` 的 `roomIdentifier(value)`：字符串取原值（空白视为缺失），有限数字 `String()` 化，其余 null。`HostMediaBridge.readRoom` 复用它做换房自增判定，`MediaSnapshot.roomKey` 直接暴露该值；`instance` 语义未改（仍只在房间标识变化与 `shareMedia` 调用时自增），仅把「数字形式 roomnFull」从「永远视为无标识」修正为可识别。
- 待命不是新的可用性状态：`PlaybackModeState` 暴露 `standby` + `standbyReason`，可用性仍只由「媒体存在 → 连接 → 时长 → 模式自身」派生，因此按钮在待命时不灰化（`aria-disabled="false"`）、点亮态保留。`standby` 只在已点亮时成立（熄灭时没有等待对象）。
- 换房提示用一次性令牌 `cleared: { id, reason }` 而不是新增可见状态：状态机在房间标识变化且当前已点亮时置 `mode="none"` 并递增 `id`，行按 `id` 变化提示一次。**令牌提示不走 10 秒同因文本去重**（否则连续两次换房文案相同会被吞掉），同一 `id` 仍只消费一次；同一帧若同时「转为不可用」，行跳过不可用原因，保证一次事件只提示一次。文案：「已切换房间，播放模式已关闭」。
- 桥接与状态机对 `roomKey === null` 刻意不一致：桥接的 null 参与 `instance` 失效（只影响「同一播放实例」判定），状态机把 null 当「未变化」，避免换房瞬间读不到 `roomnFull` 时误判成换房而熄灭；`roomIdentifier` 去首尾空白后返回，空白仍视为缺失。两处均有注释，测试钉住「null 不写入基准」。
- 单实例：模块级 `disposeProgress` 挡同 bundle 重入，页面级 `window.__imwMediaProgressController` 挡跨 bundle / 热更新重入。页面键在创建桥接/侧栏之前登记，`dispose` 逐步骤 try/catch（定时器解绑、`pagehide`、页面键放 finally），构造中途抛错或某一步释放抛错都不会留下轮询与残留节点；`dispose` 幂等，且只在自己仍是当前标记时摘除页面键。`MediaProgress.test.ts` 用 `vi.getTimerCount()` 钉住接管后定时器数量不增加。
- 遗留风险：若同页残留的是**不含该页面键的旧版 bundle**，它的 `SidebarMediaEntry`/`SidebarPlaybackRow` 会在下一次侧栏变动时把被清掉的节点重新插回（旧版不感知新约定）。本轮只保证本版及之后版本的重复注入单实例。另：`IMCInit.init` 每次都会向 `mainContainer` 追加一个插件主面板容器，属既有行为，不在本 story 范围。

