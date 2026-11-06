---
ticket: story-auto-playback-no-card
date: 2026-11-01
verdict: accepted-with-open-items
criteria: declared
headless: false
---
# 复盘：循环重播与收藏随机永不发点播卡片（spec-auto-playback-no-card）

## Epic summary

- **形态**：spec 模式（无 `tickets.toml` / `_bmad/method/`，本仓用 `_bmad-output/specs/` 记录），目录 `_bmad-output/specs/spec-auto-playback-no-card/`。
- **契约**：`SPEC.md`（CAP-1 循环重播不发卡 / CAP-2 随机起播不发卡 / CAP-3 压制不外溢）+ `card-send-paths.md`（8 个发送点 × 压制归属、压制语义）+ `.memlog.md`（29 条）。验收标准为**声明式**（`## Success signal`：真机「发卡片」档位下循环与随机各连续 3 次零卡片，手动点播卡片照常）。
- **提交**：`1cc8dcf`（实现，10 文件 +173/−22）、`8fc353a`（重播校验窗口 10 秒 → 25 秒，2 文件 +24/−2）。
- **变更体量**：两个提交合计 12 文件、+197/−24；测试 1228 → 1233（新增 5 条：NetEase `sendSongs`/`MOD` 的 cardless、Bilibili `VOD` 的 cardless、随机目标一律 cardless、循环 25 秒窗口）。
- **未完成项**：无（无 ticket 树；CAP-1/2/3 均已实现并有单测）。
- **证据清单**：SPEC + companion + memlog；两次提交的完整 diff；真机验证（iirose 视频分享房，桌面 1440×900，Xvfb + 虚拟声卡 `--alsa-output-device=null`）；契约同步（`spec-playback-loop-shuffle` 的 CAP-3/CAP-4/约束、`loop-mechanics.md`、`shuffle-mechanics.md`、`AGENTS.md`）。**缺失**：逐条 session 日志未落盘；真机未做到 SPEC 写的「连续 3 次」。

## Findings

**处置**：fix now＝本次引入、需要修；defer＝有前置依赖或需人工口径；accept＝接受为偏差（记录以免后续重复标记）。

### 聚合视图

| #   | 视图     | 发现                                                                                                                                                                                                                                                                               | 来源                                                                                    | 处置                                  |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------- |
| A1  | 规格对账 | CAP-1/2/3 均有实现与证据；但 CAP-2 有一条路径未覆盖（见 B1），SPEC 的「永不发卡」在课程收藏上不成立                                                                                                                                                                                | `SPEC.md` CAP-2、`src/platforms/BilibiliPlatform.ts:406-437`                            | fix now（B1）                         |
| A2  | 重复实现 | `cardless` 有四种写法：`SendSongsOptions`（`NetEasePlatform.ts:38-44`）、`MOD` 的内联 options（`:1020-1023`）、`VOD` 的内联 options（`BilibiliPlatform.ts:396-400`）、`playBiliPage`/`prepareAndSendMedia` 的裸 boolean（`:333`、`:611`）。改语义要动四处，且裸 boolean 靠位置传参 | 同上                                                                                    | defer（形状统一，非阻塞）             |
| A3  | 架构增量 | 依赖方向正确：`shuffleTargets`（playback 层）单向把 `cardless` 传给平台层，无环、无新依赖。代价是平台层因此知道「调用方是自动还是手动」——把调用方语义下沉到平台，记录为已接受                                                                                                      | `src/playback/shuffleTargets.ts:54-59`、`:105-108`                                      | accept                                |
| A4  | 死代码   | `MediaPayloadHit.card` 与 `MediaPayloadMemory` 的卡片缓存/`sessionStorage` 持久化已无消费者：重播只用 payload，`hit.card`/`last().card` 无人读取，但 `record()` 仍在解析并写盘                                                                                                     | `src/playback/MediaPayloadMemory.ts:5`、`:129`、`:141-145`；`LoopController.ts:296-298` | defer（非目标里明确保留，但应记一笔） |

### 对抗镜头

- **B1【high】B 站课程分支绕过 cardless，仍会发卡**：`VOD` 的 `course_id` 分支在 `targetP` 判定**之前** `return`（`BilibiliPlatform.ts:406-437`），调 `prepareAndSendMedia` 时没传第五参。收藏随机对 `type === "video"` 的记录一律走 `VOD(data, 1, { cardless: true })`，而 B 站课程收藏的 `platformData.bilibili.course_id` 存在（`mediaFormat.ts:49` 专门给它「B站-课程」标签），因此抽中课程收藏时会正常发卡——直接违反 CAP-2。来源：`BilibiliPlatform.ts:406`、`:424-433`、`shuffleTargets.ts:54-59`。
- **B2【medium】随机的回读窗口仍是 10 秒，与循环改后的 25 秒不一致**：`ShuffleController` 的 `VERIFY_MS = 10_000`（`:65`），超时后 `failures += 1`、`idleStarted = false`，仍在播就立刻补发下一首（`:458-469`）。若队列接上的延迟真的接近 20 秒（本轮循环真机观察到的量级），随机会在切换发生前判失败并再点一首，房间可能连收两首。来源：`ShuffleController.ts:65`、`:458-469`。
- **B3【low】裸 boolean 位置参数容易传错位**：`playBiliPage(…, bvid?, cardless?)`、`prepareAndSendMedia(…, qn, cardless?)` 都是第五个位置参数，调用点写 `true` 时读不出含义；`VOD` 内部两处调用风格也不一致（`options?.cardless` vs 裸 `cardless`）。来源：`BilibiliPlatform.ts:333`、`:611`、`:467-473`。→ 并入 A2。

### 边界镜头

- **C1**：循环侧的「不发卡」由**接口删除**保证（`LoopIo` 已无 `sendCard`），比参数更硬；平台侧靠参数，新调用点仍可绕过——B1 就是活例。
- **C2**：手动入口不传 `cardless`，`MOD(data)` / `VOD(data)` 行为与改前一致；既有的批量用例（`sendMediaCard` ×198/×250 等）继续守住默认路径，未被本次改动削弱。

### 已接受的偏差

- 平台层接收 `cardless` 参数（A3）：不引入全局状态、不改 `announceMode`，代价是平台知道调用方语义。
- 循环的静默 seek / 本地 seek 路径零发送，未受本次改动影响（SPEC 约束，代码未动）。

### 验证缺口（测试无法失败的地方）

- **V1**：B 站课程分支没有任何测试（改前改后都没有），B1 因此没被测试网住。现有 Bilibili 用例都在 `targetP` 与多 P 分支上。
- **V2**：真机只各跑 1 次（随机 3 条报文、循环 6 条报文），SPEC 的 success 写的是「连续 3 次」；连续性与长时间稳定性未验。

### 过程教训

- **P1**：首轮真机脚本读错全局——`window.isShareMediaPlaying` 在 `messages.html` 上根本不存在，插件实际读 `Utils.service.isShareMediaPlaying()`（`HostMediaBridge.ts:92`）。脚本用 `!!window.isShareMediaPlaying?.()` 得到恒 `false`，连续两轮误判「没在播放」，白跑两趟。
- **P2**：page 级 `websocket.framesent` 拿到的是 permessage-deflate 压缩帧，读不出报文；在 frame 内包一层 `window.socket.send` 才是可靠通道（插件与宿站都走它，`Socket/index.ts:10`）。
- **P3**：该房间媒体每 ~20 秒自行重启，自动化无法把「重新起播」归因给我们的报文；headless / 无声卡环境连「是否在播放」都判不准。结论最终靠维护者人工确认。
- **P4**：先在 SPEC 约束里写死实现机制（「作用域计数、try/finally 复位」），随后因为 `sendSongs` 的卡片在 `await` 之后才发、同步作用域罩不住，改成显式参数，SPEC 与 companion 被迫重写一轮。教训：SPEC 写行为，机制放 companion 并标注可替换。

## Behavior verification

真机（iirose「视频分享」房，桌面 1440×900，Xvfb + `--alsa-output-device=null`，测试账号，新 bundle，注入一次）：

| 场景                                           | 观测                                                                          | 结论                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------ |
| 收藏随机（8 条收藏，选「开始随机」后拖到结尾） | `window.socket.send` 钩子：`&1` 报文 ×3、`m__4` 卡片 ×0；聊天区媒体卡片数不变 | CAP-2 主路径通过         |
| 单曲循环（手动点播后点亮，拖到结尾前 6 秒）    | `&1` ×6、`m__4` ×0；聊天区卡片数不变                                          | CAP-1 发送面通过         |
| 手动点播同一首                                 | 聊天区出现「旅行的意义 陈绮贞 网易云音乐 • 320K」卡片                         | CAP-3 通过               |
| 「只发报文能否让宿站重新起播」                 | 房间媒体每 ~20 秒自行重启，无法归因；维护者人工确认「认的」                   | 由人工裁定，非自动化证据 |

## Action items

| #   | 项                                                                   | 来源  | 建议                                                              |
| --- | -------------------------------------------------------------------- | ----- | ----------------------------------------------------------------- |
| 1   | 课程分支补 `cardless` + 补一条测试                                   | B1    | fix now（一行 + 一个用例）                                        |
| 2   | 随机回读窗口是否跟循环一起放宽到 25 秒                               | B2    | defer（需先拿到队列延迟的真实分布，避免盲目放宽导致失败判定变钝） |
| 3   | 清掉 `MediaPayloadMemory` 的卡片缓存，或写明保留理由                 | A4    | defer（非目标里已明确保留）                                       |
| 4   | 统一 `cardless` 的参数形状（options 对象一处到底）                   | A2/B3 | defer（可选，纯整洁性）                                           |
| 5   | 把 P1/P2 写进 `iirose-plugin-verify` 的坑位（取数口径、socket 钩子） | P1/P2 | fix now（文档）                                                   |
| 6   | 真机补做「连续 3 次」                                                | V2    | defer（需可用房间与人工确认）                                     |

## Acceptance verdict

**accepted-with-open-items**。理由：CAP-1 与 CAP-3 有实现、单测与真机证据；CAP-2 的主路径（网易云单曲、B 站普通视频、歌单/专辑曲目）成立，但**课程收藏仍会发卡（B1）**，与 SPEC「永不发卡」的措辞冲突，故不能判 accepted；也没有达到 rejected 的程度（缺陷局限在一条罕见路径，主路径可用）。

## Follow-up（2026-11-02 执行）

| #   | 项                    | 结果                                                                                                                                                        |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 课程分支补 `cardless` | 已修（`acaa6f0`）。`prepareAndSendMedia` 第 5 参传入 `options`；新增用例「课程分支不发卡」，把该行去掉会红                                                  |
| 2   | 随机回读窗口          | 已改 20 秒（`a6073d4`），未照抄循环的 25 秒——随机提前 5 秒发出，队列里已等 5 秒。新增「15 秒仍等待」用例，窗口改回 10 秒会红                                |
| 3   | 卡片缓存死代码        | 已删（`e15f622`）：`MediaPayloadHit` 只剩 `payload`，旧存档的 `card` 字段忽略并有用例                                                                       |
| 4   | `cardless` 参数形状   | 已统一（`e15f622`）：`Platform.ts` 的 `AutoPlayOptions`，`MOD`/`VOD`/`playBiliPage`/`prepareAndSendMedia` 全用 options 对象                                 |
| 5   | 脚本坑位写进 skill    | 已写（`acaa6f0` + 后续）：`iirose-plugin-verify` 增「运行时取数的两个硬坑」与「切宿站深色主题」两节                                                         |
| 6   | 真机「连续 3 次」     | **部分**：收藏随机 3/3 通过（每轮只发 `&1`、0 卡片）；单曲循环未达成——所在房间 `seekDemandMedia` 不生效、点播按钮时灵时不灵，仅保留 1 次真机证据 + 单测保证 |

三个 open question 的结论：①课程收藏已按 `cardless` 修好，无需再从随机候选里排除；②随机窗口取 20 秒；③卡片缓存已删。

顺带补记：真机验证过程又抓到两个坑（`Utils.service.isShareMediaPlaying()` 取数口径、frame 内包 `window.socket.send` 抓报文），已进 skill；宿站深色开关的位置也一并记进 skill。

## Open questions

1. B 站课程收藏要不要支持随机？如果不值得，直接在随机候选里排除课程类型，比补 `cardless` 更省心。
2. 随机窗口（B2）是否需要跟着循环放宽？需要先知道「报文进队列 → 宿站切曲」延迟的分布，而不是照抄 25 秒。
3. `MediaPayloadMemory` 的卡片缓存留还是删？留着能让未来某天恢复「带卡重播」时不必重做，但现在是纯写不读的死路径。
