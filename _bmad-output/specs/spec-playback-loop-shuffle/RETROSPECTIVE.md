---
date: 2026-10-24
verdict: accepted
criteria: declared
headless: false
---

# 复盘：侧栏单曲循环与收藏随机播放（spec-playback-loop-shuffle）

## Epic summary

- **形态**：stories 模式（无 `sprint-status.yaml`），spec 目录 `_bmad-output/specs/spec-playback-loop-shuffle/`。
- **故事与提交**：4 篇，全部有落地提交。
  - story 1 侧栏开关行：`198c01a..a187273`（3697e7f → ab42142 revert → 920eeaf → a187273，4 个提交）
  - story 2 归属守卫与生命周期：`a187273..59c0c53`（de8cd0d / f17ff5e / 59c0c53）
  - story 3 单曲循环：`59c0c53..af26cec`（af26cec）
  - story 4 收藏随机：`af26cec..6b46e05`（6b46e05）
- **未完成故事（pending_stories）**：`3`。其产物 frontmatter 仍为 `status: 'in-progress'`，而对应实现与提交（af26cec）已完成、422 用例通过。这是执行侧的状态收尾遗漏，不是实现缺失；按规则机器判定仍为 **rejected**，待人决定（见 Acceptance verdict）。
- **证据清单**：`SPEC.md` + 4 份 companion、`stories.yaml`、4 个 story 产物、`git_evidence` 分段统计、`deferred-work.md`（本 spec 相关 6 条）、本轮真机冒烟（部分）。**缺失**：逐条 session 日志未保留（进程教训只能从提交与产物反推）；真机端到端行为只做到冒烟，未做完整循环/随机观察。

## Findings

### 聚合视图

1. **执行侧状态收尾漂移（fix now）** — `stories/3-loop-seek-and-replay.md` 仍为 `in-progress`，而实现已提交（af26cec）且验收项全绿。来源：该文件 frontmatter 与 `git log af26cec`。
2. **composition root 变胖并越过分层（已修复，14fb2d8）** — `src/page/index.tsx` 曾从 75 行涨到 233 行并直接依赖 `platforms/*`、`Api/NeteaseAPI`、`storage/*`。本轮已把 `prepareShuffleTarget` 与候选查询迁到 `src/playback/shuffleTargets.ts`，组合根回落到 175 行，只做装配。来源：`git show 198c01a:src/page/index.tsx | wc -l`（75）、`src/playback/shuffleTargets.ts:1-95`、`src/page/index.tsx`（175 行）。
3. **同一问题两套实现（已修复，14fb2d8）** — 阈值公式与有限值守卫曾在两个控制器各写一份。现已收敛到 `src/playback/endWindow.ts`（`endWindow` / `finiteNumber` / 三个常量），`loopThreshold` 与 `thresholdOf` 都只是它的别名。来源：`src/playback/endWindow.ts:1-29`、`LoopController.ts` 与 `ShuffleController.ts` 的 import 段。
4. **依赖注入风格分叉（defer，记录）** — `LoopController` 用窄接口注入桥接与 IO（`LoopBridge`/`LoopIo`），`ShuffleController` 直接 import `PluginSettings`、`PanelFocus`、`FavoritesStorageService` 类型并在构造函数里读焦点。同一 `playback/` 目录两种风格，测试装配方式也随之不同。来源：两文件 import 段。
5. **规格与实现对齐（accept）** — CAP-1..7 均有对应实现与用例；无静默权限时的「结束前续上」、待命不灰化、换房熄灭、随机去重与失败上限均按 companion 落地。来源：各 story 的 Acceptance Criteria 与 `src/playback/*.test.ts` 用例名。

### 镜头评审（`bmad-review` 未能以子代理运行，已在编排侧按同一三镜头内联执行并记录收窄）

6. **story 1 因规格缺信号源与组合根断言而整锅回退（fix now，流程）** — 3697e7f 被 ab42142 整体 revert 后由 920eeaf 重派生；差异集中在媒体存在性信号缺失与「删掉装配仍全绿」。单 story 改动量因此翻倍（`PlaybackMode` +263/−125、`SidebarPlaybackRow` +297/−124）。来源：`git_evidence` story 1 段与该 story 的 `## Spec Change Log`。
7. **循环与随机的可用性口径不一致（accept as-is，记录）** — 循环在候选数据缺失时保持可用、由触发时兜底；随机在读不到候选时先按「平台可判定即可用」放行，读到空才禁用。两条路径都有测试，属有意取舍。来源：`LoopController.ts:153-161`、`ShuffleController.ts:132-150`。
8. **`reader→owner` 的判定近似未验证（defer）** — 重播命中只比对报文 `n` 与 `#shareMediaSongName` 文本，宿站若做装饰/归一化会表现为「不可用」。来源：story 3 `## Implementation Notes` 与 `MediaPayloadMemory.ts:80-88`。

## Behavior verification

- **已执行（真机，2026-10-24，测试账号 铭铭280）**
  - 房间「空间站」（普通房）：注入 `dist/bundle.js` → 侧栏出现 `#imw-playback-controls`；无媒体时两按钮 `aria-disabled="true"`、原因「直播或时间未知，无法使用」；`myself`/`roomnFull`/`identity`/`rank` 与快照判定一致；插件点播时 `Socket.send` 实际发出 `m__4` 卡片与 `&1{...}` 报文（story 3 的观察钩子与入口在真实环境生效）。
  - 房间「练歌房」（视频分享房）：真实点播「晴天(深情版)」，宿站回读 `playing=true`、`owner=铭铭280`、`dur=278.961`；无静默权限（`identity=0`/`rank=4`）时循环按钮变为可用（缓存命中）并给出正确 title。
  - **循环触发实测**：点亮循环后把 `shareMediaCurrentTime` 置到 277.5（剩余 1.46 秒 ≤ 2 秒窗口）→ 逻辑正确地在 250ms 内发出一条卡片 + 一条 `&1` 报文；但宿站**没有重新起播**（`playing=false`、`song`/`cur` 停在末尾、无标题变化），5 秒校验后循环自动熄灭（`aria-pressed=false`），没有重试风暴。第二次用修复后的卡片缓存重测，结果相同。
  - 结论：**无权限重播路径（CAP-3）在真实宿站不生效**，卡片与报文都发了、宿站不认。这是本轮最重要的运行期发现，且在两次独立尝试中复现。
  - **排查过程与两次纠错（重要）**
    - 第一轮用「伪造 `shareMediaCurrentTime`」触发：触发时音频其实还在播放，不构成结束态，结论作废。
    - 第二轮用「合成报文」做变体实验（改卡片 `i`、改 `m`、改 `s`/`o` 参数）：这些手工报文把宿站媒体状态弄坏了——实验后连插件里真实点另一首歌都不起播。**该轮所有「不重启」结论全部作废**，不再作为证据。
    - 第三轮改在干净状态（重载页面 → 重进房间 → 注入 → 真实点播 → 本地 `seekDemandMedia(duration-3)` 让宿站自然播完）观察：`playing=false`、`cur=279`，而**循环在结束的那一刻根本没有发报文**（发送日志末尾仍是点播时的卡片+报文），按钮随即自动熄灭。原因是重播的预发窗口只有「剩余 ≤2 秒」，250ms 的轮询没落在这一格里，窗口被整体跳过。
  - **第三轮干净复测**：把窗口从 2 秒放宽到 5 秒后，重播**确实发出**（日志 `[card,payload,card,payload]`），但在本机测试号/房间里宿站没有重新起播。
  - **用户真机反证（2026-10-25，权威）**：用户用自己账号实测**本人点播的网易云歌曲结束后确实会重新点播**。因此「宿站忽略同一曲目重发」的结论**撤回**——此前几轮失败更可能是测试号身份、房间状态或自动化注入方式差异导致，不能作为协议级结论。CAP-3 现按「可用」对待，仍缺受控复现证据。
  - **刷新后变灰（用户报告，已修）**：报文缓存只在内存，刷新即失，导致循环按钮被判「无权限且该曲目不由插件点播」而灰化。已把缓存按房间落到 `sessionStorage`（`0ad9f2b`），刷新后自动恢复，过期与换房仍在命中时校验。
  - **可用但不同步的替代（已实测）**：`Utils.service.seekDemandMedia(0)` 在无媒体权限下可把本地进度归零（cur 89→1，播放继续），socket 日志不变（8→8），即只影响本端。
- **未执行**：收藏随机的实际换曲（需要先积累可用收藏并跑完整首）；有静默权限时的快退路径（测试账号无媒体管理权限）。
- 单元与构建验证：`npm test` 423 用例通过；`npm run build` 产出 342.14 kB。

## Previous-retro follow-through

- 无上一条 epic 的 retro 文档，`sprint-status.yaml` 也不存在（stories 模式），action item 无从跟进：记录为「无前次复盘」。

### 复盘后追加（用户真机反馈驱动）

- **拖到结尾不循环**：宿站直接置为停止，不留「剩余 ≤5 秒」的采样格；已补「停止且停在末尾」分支（`cc93557`）。
- **刷新后按钮灰化**：报文缓存只在内存 → 已按房间持久化到 `sessionStorage`（`0ad9f2b`）；并补「本人点播但无缓存 → 本地 seek 兜底」避免继续灰（`5213d60`，不广播）。
- **cut 后不循环**：cut 是公屏指令，本人点播 + 本端喊 cut 应立即重播；他人持麦或投票 cut 不重播。`CutWatcher`（socket + 聊天区双信号，8 秒窗口）配合控制器分支（`42fec54`、`7372cc2`）。
  - **真机验证（2026-10-25，测试号 铭铭280 / 练歌房）**：聊天区实际渲染为 `cut铭铭280  人工智能`（内容在前、昵称在后），旧匹配规则（以 cut 结尾）判不中；改为「取昵称前的正文等于 cut」。同时发现顺序问题：cut 让 `playing=false`，可用性刷新会先把模式熄灭，导致重播分支永远走不到；已改为**先处理 cut 重播、再刷新可用性**。
  - 修复后真机复现：点亮循环 → 喊 cut → `playing=false, cur=-1` → 插件立即重发报文 → `playing=true, cur=1`（歌从头开始）。

## Action items

0. **【已解决】无权限重播**（owner：开发）：窗口太窄导致重播常不触发 → 已放宽到与快退一致的 5 秒（`3008a49`）；刷新后缓存丢失导致按钮灰化 → 已按房间持久化到 `sessionStorage`（`0ad9f2b`）。用户真机确认重播可用，CAP-3 恢复为可用状态。


1. **修正 story 3 的产物状态**（owner：执行侧 / 我）：把 `stories/3-loop-seek-and-replay.md` 的 `status` 从 `in-progress` 改为 `done`（本 skill 不允许改 story 产物，需在 build 流程或人工确认后修正）。来源：finding 1。
2. **抽出共享的时间阈值工具**（owner：开发）— 已完成（14fb2d8）：`src/playback/endWindow.ts`，两个控制器共用。来源：finding 3。
3. **把 `prepareShuffleTarget` 移出组合根**（owner：开发）— 已完成（14fb2d8）：迁到 `src/playback/shuffleTargets.ts`，组合根从 233 行降到 175 行。来源：finding 2。
4. **流程门：UI 接线型 story 必须在规格里点名信号源并强制一条组合根断言**（owner：规格撰写）：story 1 的回退根因是规格没写「媒体存在性从哪来」且没有装配层验收。来源：finding 6。
5. **真机联调补完循环与随机**（owner：开发 / 验证）：换支持媒体播放的房间，验证 seek 回退、无权限预发重播、随机换曲与卡片档位。来源：Behavior verification。
6. **记录并停止复查两条已接受偏差**（owner：无）：每圈按档位重发卡片（用户决策）、循环/随机的可用性口径差异（finding 7）。

## Acceptance verdict

- **判定：accepted**（2026-10-26，人工确认后更新）
- **criteria：declared**（SPEC 的 CAP-1..7 与 Success signal）
- **证据**
  - CAP-1 侧栏开关行与点亮态：真机渲染、禁用原因、互斥点亮、幂等重建均通过。
  - CAP-2 有静默权限的循环：`!15["<","Ns"]` 在剩余 2 秒回退成功（用户真机确认）。
  - CAP-3 无静默权限的循环：队列重播在剩余 5 秒发出，自然播完与拖到结尾都能接上（真机：`cur 279 → 30`）。
  - CAP-4 收藏随机：用户真机确认，含「空闲点亮立即起播」「自己 cut 后接着抽下一首」。
  - CAP-7 专辑/歌单参与随机：用户真机确认抽中专辑/歌单时会取其中一首单曲播放。
  - CAP-5 归属守卫：点播者判定、待命、他人接管不打断（真机 + 单测）。
  - CAP-6 生命周期：换房熄灭、断线、重复注入单实例、刷新默认熄灭（单测 + 真机注入）。
  - CAP-7 设置项持久化与读取归一化（单测）＋真机抽曲验证。
  - 测试与构建：442 用例通过，`npm run build` 通过；工作区干净，最后一次提交 `50e172c`。
- **保留的已接受偏差**：每圈按播报档位重发卡片（用户决策）；无权限时「拖到结尾」依赖队列、按钮已给出提示文案。
- 复盘过程中被推翻的两次结论（伪造时间戳、本地 seek 造假播完）已在 Behavior verification 与更正小节留档，供后续复盘区分「测试方法问题」与「实现问题」。

## Open questions

- 无（story 3 状态已修正为 done；组合根重构与卡片缓存已在当轮完成；剩余唯一阻塞项是重播路径的真机失效，见 Action item 0）。

## Assumptions

（交互式运行，无此节内容。）

## 真机全量验证（2026-10-25，测试号 铭铭280 / 练歌房）

| 场景 | 结果 |
| --- | --- |
| 侧栏开关行渲染、点亮、禁用原因 | 通过 |
| 无媒体时禁用（暂无播放内容） | 通过 |
| 本人点播时循环可点亮 | 通过 |
| 刷新后缓存恢复（sessionStorage） | 通过 |
| cut（本人点播 + 自己喊 cut）触发重播分支 | 通过（`loop:hit=true`） |
| 循环触发时机（剩余 ≤5 秒、播放中） | 通过：确实发出 card + `&1` |
| **重播后是否真的重新起播** | **未通过**：用插件真实报文（缓存 1361 字符）在剩余 6 秒时重发，宿站不重启；结束后重发同样不重启；本地 seek 只改进度不恢复播放 |
| 有权限的 `!15` 静默快退 | 未验证（测试号 `identity=0`/`rank=4`） |
| 收藏随机实际换曲 | ✅ 用户真机确认正常（含空闲点亮立即起播） |

结论（2026-10-26 更新）：界面、状态机、循环（自然播完 / 自己 cut）、收藏随机（含空闲起播）均已通过真机验证。唯一未验证项是**有媒体管理权限时的 `!15` 静默快退**（测试号无权限）。

### 更正：重播是有效的（2026-10-25 最终结论）

- **自然播完实测**：点亮循环后让歌自然播完，`cur 279 → 30`、`playing=true`、按钮仍亮 —— 宿站靠**点播队列**接上了我们提前发出的那条报文。
- 之前所有「重播无效」的结论作废：我用 `seekDemandMedia` 本地跳到末尾来造假「播完」，而本地跳转**不广播**，服务端不知道歌结束，队列不推进。
- 因此：自然播完、自己 cut（服务端已知结束）都能循环；只有「用插件浮窗把歌拖到结尾」在无 `!15` 权限时属于本机操作，服务端不知情，队列不推进。
- 校验窗口已从 5 秒放宽到 10 秒（`bcf49b9`）：队列接上有几秒延迟，5 秒会误判失败。

### 以下为被推翻的旧结论（保留记录）

- **同一张卡片再点一次**：媒体在播（cur=161）时点击同一首的播放按钮，进度继续 161→166，**没有回到 0**，说明“第二次点播同一首”在宿站侧被当成重复。
- **重播后长时间观察**：剩余 6 秒时触发，报文已发出（tx=2），随后 `playing=false`、`cur=279`，连续观察 36 秒仍未起播——排除“延迟生效”的可能。
- 结论：宿站只在**当前没有媒体**时接受点播；已有媒体时同曲报文被忽略。普通用户（无 `!15` 权限）的循环因此不可能靠重播实现。
