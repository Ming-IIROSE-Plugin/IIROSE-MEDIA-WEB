---
title: '单曲循环：静默快退与预发重播'
type: 'feature'
created: '2026-10-24'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '59c0c53fcc8caf0093ca7410e32dde9b78c5567e'
context:
  - '{project-root}/_bmad-output/specs/spec-playback-loop-shuffle/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-playback-loop-shuffle/loop-mechanics.md'
  - '{project-root}/_bmad-output/specs/spec-playback-loop-shuffle/ownership-and-lifecycle.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 开关点亮后目前没有任何行为。宿站曲目播完会自动续播下一首，要重复听同一首只能手动点回去；有媒体管理权限的人可以静默定位，没有权限的人只能在播完后重新点播，而重新点播需要插件自己发过的播放报文。

**Approach:** 新增循环控制器：订阅媒体快照，在剩余阈值内按权限走两条路径——能静默快退就直接回到开头（无缝、零消息），否则在结束前 2 秒预发缓存的播放报文抢在自动续播之前。两路径都有失败判定与一次性提示，失败即熄灭循环。播放报文与卡片由 `Socket.send` 出口按房间缓存，只在插件自己点播过时可用。

## Boundaries & Constraints

**Always:** 判定与动作只在「已点亮 + 本人点播 + 播放中 + 时长已知」时进行；每一轮只触发一次，进度回退到阈值以下后重新武装（同一实例可循环多次）；路径 A 只用 `!15["<","{n}s"]` 白名单；`controlMode === "owner"` 一律不走快退（会在公屏刷「快退 N 秒」），直接降级路径 B；自动动作零聊天，卡片按现有 `announceMode` 决定是否发送；每次触发都做失败校验（路径 A：2 秒内进度回退；路径 B：5 秒内同标题且进度小于时长一半），失败即熄灭并提示一次；短曲（时长 ≤ 3 倍阈值）30 秒内最多触发 2 次；手动定位（`seekVersion` 变化）后 2 秒内不触发；阈值 `min(5, max(1, duration*0.25))` 秒，路径 B 预发窗口 2 秒。

**Never:** 不实现随机播放与收藏读取（story 4）；不改 `HostMediaBridge` 的权限判定、`send` 白名单与 250ms 轮询；不伪造聊天消息、不调 `moveinputDo`、不覆盖聊天草稿；不改 `imwPluginSetting`；不新增依赖；不重解析已过期的流地址（重播只重发缓存报文）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 静默快退 | 有媒体权限、本人点播、剩余 ≤ 阈值 | 发出一次 `!15["<","{floor(current)}s"]`，进度回到 0，无卡片、无聊天 | 2 秒内未回退 → 转路径 B |
| 无权限重播 | 无媒体权限、缓存命中、剩余 ≤ 2 秒 | 按档位发卡片 + 重发缓存 `&1` 报文，宿站回读同曲且进度从头前进 | 5 秒无回读 → 熄灭 + 提示一次 |
| 无重播数据 | 无媒体权限且缓存未命中 | 循环按钮不可用，原因「无媒体管理权限，且该曲目不由插件点播，无法循环」 | 点击仅提示 |
| 他人点播 | `standby` 为真 | 零动作、零发送，保持点亮 | 不提示 |
| 暂停 | 播放状态为 false | 不触发 | N/A |
| 直播/时长未知 | `duration` 为 null 或 ≤0 | 不触发，按钮已由可用性禁用 | N/A |
| 短曲 | 时长 ≤ 3 倍阈值 | 仍循环，但 30 秒内最多 2 次，超出则熄灭并提示「曲目过短，已停止循环」 | 一次性提示 |
| 手动定位 | `seekVersion` 在 2 秒内变化 | 跳过本次触发，不清除点亮 | N/A |
| 触发后换曲 | 触发瞬间标题或实例变化 | 视为失败，不补发、不抢占 | 熄灭 + 提示一次 |
| 换房/断线/媒体消失 | 见 story 2 | 由状态机熄灭，循环控制器不再动作 | 同 story 2 |

</frozen-after-approval>

| 待命期间 pending 不校验，恢复后误判失败（blind#1、edge#6） | medium | patch | `standby` 早退在 `verify` 之前；改为先校验、待命超时则丢弃等待 |
| 占位标题「未命名媒体」被判成换曲（blind#2） | medium | patch | 媒体切换瞬间标题为空/占位；`switchingAway` 豁免空标题与占位值 |
| `Pending.instance` 只写不读（blind#3、edge#3、edge#9） | low | patch | 契约要求「标题或实例变化」；快退期间实例变化现在按失败处理（重播本身会自增实例，故只对快退判定） |
| 缺「迟发兜底」（blind#4、edge#4） | low | patch | 节流错过 2 秒窗口后不再接管；改为剩余 ≤2 秒（含已播完）都可接管 |
| `bridge.send` 返回 false 不降级重播（blind#5） | low | patch | 契约要求路径 A 失败转路径 B；现在有缓存即降级 |
| 短曲预算跨曲/跨房累计、关闭重开不清（blind#6、edge#7、verify-other#2） | medium | patch | `recent` 无键；改为按「房间 + 标题」重置，熄灭/卸载时清空 |
| `SHORT_TRACK_LIMIT` 名不符实（blind#7） | low | patch | 改为 `SHORT_TRACK_MAX_TRIGGERS` 并注释口径（第 3 次到达末尾即停） |
| 可用性下降时静默熄灭（blind#8） | false | — | 行在「点亮→不可用」转换时会提示 `availability.reason`，用户可见原因 |
| `!15` 报文内联拼接、绕过协议层（blind#9） | low | patch | 新增 `model.rewindCommand` 并用 `isSeekCommand` 校验 |
| 阈值公式无直测、NaN 会静默（blind#10） | low | patch | 补有限值守卫与边界表测 |
| 只校验 null/≤0，未校验有限性（blind#11） | medium | patch | `Infinity`/`NaN` 会让比较静默失效；补 `Number.isFinite` 前置守卫与用例 |
| 常量命名与单位不齐（blind#12） | low | patch | 阈值常量具名（基准 5 秒 / 25% / 最短 1 秒） |
| 原因文案在测试中重复字面量（blind#13） | low | patch | 导出 `LOOP_REASONS`，测试引用常量 |
| 卡片与报文可能配错曲（blind#14、edge#1、verify-other#1） | high | patch | summary 档抑制逐曲卡片时，`hit()` 仍返回上一首卡片 → 会把别的曲目卡片发到公屏；改为卡片绑定标题 |
| `roomnFull` 瞬时缺失会清空缓存（blind#15、edge#2） | medium | patch | 与状态机「null 视为未变化」冲突；改为 null 时不写不清、命中时保守返回 null |
| 无记录时间与有效期（blind#16、edge#8） | low | patch | 补 `at` 与 6 小时上限 |
| `CARD_PREFIX` 依赖 JSON 键序（blind#17） | low | patch | 改为解析后判定 `m` 字段前缀，并补乱序键用例 |
| 标题匹配只认报文 `n`，与宿站渲染差异会永不命中（blind#18） | low | defer | 已在 Implementation Notes 记录该近似；后续如需可在发送时记录宿主标题作兜底 |
| `Socket.observe` 无身份校验地清空（blind#19） | low | patch | 改为只在自己仍是当前观察者时摘除 |
| 观察回调无 try/catch（blind#20） | low | patch | 观察者异常会沿 `send` 抛回平台层；补兜错 |
| 契约行缺用例（blind#21） | medium | patch | 补：发送被拒降级、无卡片只发报文、已播完接管、待命超时、占位标题、阈值表、非有限值、实例变化 |
| 未验证项未在实现记录单列（blind#22） | low | patch | 已补进 Implementation Notes |
| 组合根观察接线无测试（verify#1） | medium | patch | 新增 `src/page/index.test.ts`：报文发出后循环从不可用转可用，卸载后钩子摘除 |
| `Socket` 观察钩子无测试（verify#2） | medium | patch | 新增 `src/iirose_func/Socket/index.test.ts`：参数一致、无 socket 不回调、异常不影响发送 |

## Code Map

- `src/iirose_func/Socket/index.ts:1-20` -- `send` 是所有点播报文的唯一出口（`&1...` 与 `m__4` 卡片都经过这里）；在此加一个模块级静态钩子记录报文，不改变发送行为
- `src/iirose_func/Socket/Announce/index.ts:46-62` -- `sendMediaCard(socket, mediacard)` 受档位控制；`runSingleAnnounce` 只用于手动点播窗口，自动循环不用
- `src/media-progress/HostMediaBridge.ts:167-205` -- `send(command, instance, controlMode)` 的校验链（instance/controlMode/unavailableReason + 白名单）；`:276-285` 的 hook 决定 `instance` 与 `seekVersion`
- `src/media-progress/model.ts:23-27,117-124` -- `MediaSnapshot` 字段与 `isSeekCommand` 允许的相对报文格式
- `src/playback/PlaybackMode.ts:60-160` -- 可用性派生、`settle`/`extinguish`、签名发布；本 story 新增 `stop(reason)` 供失败熄灭复用
- `src/playback/SidebarPlaybackRow.ts:120-200` -- 消费 `cleared` 令牌提示一次（失败熄灭复用该通道）
- `src/page/index.tsx:37-120` -- 组合根：创建循环控制器、接 `bridge.subscribe`、`dispose` 中释放
- `src/playback/PlaybackMode.test.ts`、`src/playback/fixtures.ts` -- 状态机与共享快照 fixture

## Tasks & Acceptance

**Execution:**
- [ ] `src/playback/MediaPayloadMemory.ts` -- 新建：按房间记录最近一次 `&1` 报文与 `m__4` 卡片、曲目标题、记录时间；提供 `record(text)`（按前缀分流）、`hit(roomKey, title)`、`clear()` -- 重播数据的唯一来源
- [ ] `src/iirose_func/Socket/index.ts` -- `send` 以静态回调把报文交给记录器（`&1` → 报文，`m__4` → 卡片），`sendMessage` 与发送行为不变 -- iirose_func 不依赖 playback 类型
- [ ] `src/playback/PlaybackMode.ts` -- 新增 `stop(reason)`：已点亮时置 `none` 并写 `cleared` 令牌（复用换房通道） -- 失败熄灭只有一条通路
- [ ] `src/playback/LoopController.ts` -- 新建：按 I/O 矩阵判定触发、选路径、发报文、失败降级与校验、短曲限流、手动定位抑制；每次快照为 `loop` 注入可用性与原因 -- 行为集中、可单测
- [ ] `src/page/index.tsx` -- 创建控制器并接入桥接订阅与 `mode`，`dispose` 中释放控制器与记录器 -- 唯一组合根
- [ ] `src/playback/LoopController.test.ts` -- 覆盖矩阵全部行：快退成功/失败降级/重播成功/无回读熄灭/缓存未命中/暂停/短曲限流/手动定位/换曲竞态/他人点播零发送 -- fake timers + 假宿主
- [ ] `src/playback/MediaPayloadMemory.test.ts`、`src/playback/PlaybackMode.test.ts` -- 记录器分流与房间/标题匹配；`stop(reason)` 写令牌且幂等 -- 纯函数与状态机

**Acceptance Criteria:**
- Given 有媒体权限且本人点播，when 剩余到达阈值，then 只发一条 `!15["<","…s"]` 且不发卡片，进度回退到 0
- Given 无媒体权限且缓存命中，when 剩余 2 秒，then 先按档位发卡片再发缓存报文，宿站回读同曲且进度从头开始
- Given 无媒体权限且缓存未命中，when 观察循环按钮，then 不可用并给出「无法循环」原因，点击只提示不发报文
- Given 一次触发失败（快退未回退、重播无回读、曲目已被换走），then 循环熄灭、提示一次，且不再补发
- Given 短曲连续到达末尾，when 30 秒内第 3 次到达阈值，then 熄灭并提示「曲目过短，已停止循环」
- Given 他人点播，when 快照刷新，then `socket.send` 调用次数为 0

## Verification

**Commands:**
- `npm test` -- expected: 全部通过，含 `LoopController`／`MediaPayloadMemory`／`PlaybackMode.stop` 用例
- `npm run build` -- expected: `tsc -b` 无错误，`dist/bundle.js` 产出

**Manual checks (if no CLI):**
- 真机：本人点播一首后点亮循环，观察曲目在剩余 5 秒回到开头（有权限）或结束前续上（无权限），公屏无新增消息（`announceMode` 为 silent 时无卡片）

## Implementation Notes

- 报文缓存 `MediaPayloadMemory` 只由 `Socket.send` 的静态观察钩子写入（`&1` → 报文、`m__4` 卡片 → 卡片），`sendMessage` 与发送行为未改；命中要求「房间一致 + 标题一致」，房间在记录后变化即视为过期。
- 循环控制器注入 `LoopBridge`（`subscribe` + 静默 `send`）与 `LoopIo`（发卡片 / 发报文）两个窄接口，测试用假桥接驱动，不依赖真实 250ms 轮询。
- 首帧订阅不建立「手动定位」抑制窗口（否则首次快照会被误判成手动定位，2 秒内不触发）；只有跟踪后再出现 `seekVersion` 变化才抑制。
- 每轮成功（快退生效或重播回读）后重新武装，配合「`current > 阈值`」守卫，同一实例可循环多次；失败与短曲限流通过 `PlaybackMode.stop(reason)` 走已有 `cleared` 令牌，一次事件只提示一次。
- 快退失败降级重播；无缓存则熄灭并提示「循环失败：无法回到开头」；重播 5 秒无回读提示「循环失败：无法重新点播当前曲目」；触发后曲目被换走同样按失败处理，不补发。
- 可用性：只有「`controlMode === "silent"` 且无 `controlReason`」或缓存命中时循环可用，否则给出「无媒体管理权限，且该曲目不由插件点播，无法循环」。
- 报文缓存：卡片绑定到同一曲目标题（summary 档抑制逐曲卡片时，不会把上一首卡片配给下一首）；`roomnFull` 瞬时缺失时既不写也不清；有效期 6 小时；卡片按 JSON 解析 `m` 字段，不依赖键序。
- 已知近似：重播命中只比对报文里的 `n` 与宿站 `#shareMediaSongName` 文本，若宿站渲染加了装饰或归一化差异，会表现为「重播不可用」而不是错误重播。
- 本轮未真机验证（留待 story 4 联调）：owner 模式下重发 `&1` 是否真能重新起播；只发报文（无卡片）后点播者归属是否仍为本人（否则 `ownMedia` 翻 false 会转入待命）；大秒数 `!15` 在 >60 秒曲目上的实际回退量；重播卡片是否会在公屏留下重复点播条目。

## Review Triage Log
