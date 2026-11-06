---
ticket: 5
title: 随机范围与权重数据层
type: feature
created: '2026-10-26'
status: done
baseline_revision: 31fdf3219cbd6b98cdb6719cae2eb5156cde219d
route: dispatch
review_loop_iteration: 0
context:
- '{project-root}/_bmad-output/initiative-iirose-media-web/archive-v6/spec-playback-loop-shuffle/SPEC.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-playback-loop-shuffle/shuffle-mechanics.md'
---
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 收藏随机现在从全部收藏里等概率抽「条目」：一首单曲和一个 100 首的歌单各占一份，用户既不能限定从哪些歌里随机，也不能让歌单里的每首歌与单曲同权。

**Approach:** 新增本机持久化的「随机选择」（选择项 + 权重模式），控制器只在选择范围内两级加权抽取（先按份数抽条目，再在条目内均匀抽一首），去重改为按歌曲身份；同时退役「专辑/歌单参与随机」设置项。面板 UI 与侧栏接线不在本 story。

## Boundaries & Constraints

**Always:** 选择按 `getCurrentOwnerUid()` 与平台分键存 `localStorage`，读取时与当前收藏对齐（收藏已删除的项丢弃，损坏/版本不符按无记录）；无记录 = 全部收藏整条勾选、权重 `entry`；整单为动态范围、部分为固定曲目 id 集合；歌曲身份统一为 `netease:song:<id>` / `bilibili:video:<bvid>`（与收藏逻辑主键同格式，单曲收藏与歌单内同一首共用身份）；「按歌曲」整单份数取 `trackCount`（缺失/非法按 1）减本轮已从该单播放的曲数（下限 0）；歌单详情只在抽中后才拉（既有 `NeteaseMusicAPI` 方法，已走 `neteaseRequest`）；选择范围解析后为空 → `mode.stop("随机范围为空，重新选择")`。

**Never:** 不做面板与侧栏点击行为改动；不写入收藏库或云同步；不改循环控制器、`PlaybackMode` 可用性规则、预取/发送时序与失败上限；不新增依赖；不为计算份数预拉歌单详情。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 无记录 | 本机无选择 | 全部收藏整条参与，权重按条目 | N/A |
| 范围外不出现 | 选择 = 单曲 A + 歌单 P 的曲目 {1,2,3} | 只会播 A、1、2、3 | N/A |
| 按条目 | A + 整单 P(100 首) | 各约 1/2 | N/A |
| 按歌曲 | A + 整单 P(100 首) | P 约 100/101 | N/A |
| 歌曲去重 | 部分 {1,2,3} 一轮内 | 1、2、3 各播一次后才重开一轮 | N/A |
| 跨条目同曲 | 单曲收藏 X 与歌单内 X 都在范围 | 一轮内 X 只播一次 | N/A |
| 收藏已删除 | 选择含已删除收藏 | 静默剔除，其余照常 | 全部剔除后熄灭并提示「随机范围为空，重新选择」 |
| 整单已播尽 | 抽中整单但详情中曲目都已播 | 该单本轮视为耗尽、改抽其他，不计入失败 | 全部耗尽则重开一轮 |
| 存储损坏 | localStorage 值非法 JSON/版本不符 | 按无记录处理 | 不抛错 |
| 旧设置残留 | `imwPluginSetting` 含 `shuffleIncludeCollections` | 读取后不再影响随机；设置页不再显示该项 | N/A |

</frozen-after-approval>

## Code Map

- `src/playback/ShuffleController.ts` -- `pick`（:226 等概率抽条目）、`played: Set<recordId>`、`loadCandidates`（:200，读 `shuffleIncludeCollections`）、`trackPlatform` 的 includeCollections 缓存失效（:163）；改为两级加权与歌曲身份去重，删掉设置依赖。预取/发送/校验/待命/空闲起播逻辑不动。
- `src/playback/shuffleTargets.ts` -- `queryShuffleCandidates` 去掉 includeCollections 过滤；`prepareShuffleTarget` 增加「限定曲目 id / 排除歌曲身份 / 当前标题」入参，返回目标附带歌曲身份 `key`，无可选曲目时返回耗尽标记。
- `src/playback/ShuffleSelection.ts`（新）-- 类型、存取（键 `imwShuffleSelection:<ownerUid>:<platform>`，`version: 1`）、与收藏对齐的解析、纯函数加权抽取（注入随机数以便单测）。
- `src/storage/favorites/recordUtils.ts` -- 复用 `getCurrentOwnerUid`；收藏逻辑主键格式见 `deriveFavoriteId`（:72）。
- `src/page/index.tsx:111` -- `ShuffleController` 装配：deps 签名变化处同步（增加 `loadSelection`）。
- `src/settings/pluginSettings/PluginSettings.ts`（:42/:48/:220/:231）、`src/settings/localStorageUtils/LocalStorageUtils.ts:162`、`src/page/MainAppContainerServices/SettingsService.ts:216` -- 删除字段、toggle、默认值与设置卡片。
- 测试：`src/playback/ShuffleController.test.ts`（:99/:219/:253 依赖旧设置）、`src/settings/pluginSettings/PluginSettings.test.ts:155`。

## Tasks & Acceptance

**Execution:**
- [x] `src/playback/ShuffleSelection.ts` -- 新建：`ShuffleWeight = "entry" | "song"`、选择项 `{ id, tracks?: string[] }`、`load/save(platform)`、`resolve(selection, records)`、`pickEntry(entries, weight, playedFrom, rng)` -- 纯逻辑集中、便于 story 6/7 复用
- [x] `src/playback/shuffleTargets.ts` -- 去掉 includeCollections；`prepare` 支持限定曲目、排除已播身份、跳过当前标题，返回 `key` 或耗尽 -- 歌曲粒度去重
- [x] `src/playback/ShuffleController.ts` -- 用选择 + 加权抽取替换 `pick`；`played` 改存歌曲身份并按条目计数；新增公开 `invalidate()` 供 story 7 确认后刷新；空范围熄灭提示 -- CAP-4/9/10
- [x] `src/page/index.tsx` -- 装配新 deps -- 接线
- [x] 设置三处 + 设置卡片 -- 删除 `shuffleIncludeCollections`，读取时丢弃旧字段 -- CAP-7 退役
- [x] 单测 -- `ShuffleSelection.test.ts` 覆盖 I/O 矩阵全部行（固定 rng 验证权重比例）；更新控制器与设置测试 -- 回归

**Acceptance Criteria:**
- Given 选择已保存，when 刷新页面后随机抽取，then 仍只在该选择范围内抽且权重模式保持。
- Given 账号 A 保存了选择，when 切换为账号 B，then B 读不到 A 的选择（按无记录处理）。
- Given 改动完成，when 运行 `npm test` 与 `npm run build`，then 全部通过且无类型错误。

## Implementation Notes

- 新增 `src/playback/ShuffleSelection.ts`（存取/对齐/加权抽取，纯函数注入 rng）与测试；`shuffleTargets.ts` 的 `prepare` 返回 `key` 或 `"exhausted"`；控制器 `played` 改为 `ShuffleRound`（歌曲身份 + 条目计数 + 本轮耗尽）。
- 防空转：同一次预取里第二次重开一轮即视为范围内无可播曲目，熄灭并提示「随机范围为空，重新选择」（全部条目都返回耗尽时否则会无限循环）。
- 解析失败的条目记入本轮耗尽（旧实现同样把失败条目记入本轮已播）。
- 意外：`invalidate()` 后可用性刷新先发起候选查询，预取并发调用旧实现直接返回 null 白等一帧；改为同平台复用在途查询，并用 generation 作废 invalidate 之前的在途结果。
- 设置页无既有测试，新增 `SettingsService.test.ts` 覆盖「设置页不再显示该项」。
- 已知边界：选择只剩「当前正在播的那一首（专辑内按标题）」时，会走到第二次重开并提示范围为空，而非静默不播；单曲情形仍静默。
- 审查修补：在途预取用 generation 作废、失败不触发判空、重开一轮保留上次歌曲身份；三项各有撤修复即失败的测试。
- 验证：`npm test` 478 通过（审查前 473），`npm run build` 通过，改动文件 prettier 通过。

## Spec Change Log

## Review Triage Log

| # | 来源 | 发现 | 判定 | 依据 / 去向 |
|---|------|------|------|------|
| 1 | VG | 单曲/视频分支返回的 `key` 无测试 | medium | 控制器测试用 mock，真实分支未覆盖；patch：补「key 即收藏主键」测试 |
| 2 | BH/EC | 预取在途时 `invalidate()`/换平台，旧目标写入 `prepared` 并被播放，键写进新一轮，`preparing` 被复用 | medium | 实测可复现（新测试撤掉修复即失败）；patch：`doPrepare` 每次 await 后校验 generation，invalidate 清 `preparing`，换平台递增 generation |
| 3 | BH/EC | 单个歌单解析失败 2 次即报「随机范围为空」，绕过 5 次上限 | medium | 失败记入耗尽后二次重开即熄灭；patch：只有重开后全是耗尽才判空，失败照常计入上限（测试撤修复即失败） |
| 4 | BH/EC | 重开一轮后可能立刻重复刚播的歌单曲目 | medium | 新一轮清空已播、歌单无标题排除；patch：重开时把上次预取的歌曲身份放回排除集合（测试撤修复即失败） |
| 5 | BH/EC | `roundReset` 旁路字段易错、提前返回时残留 | low | 随 #3 重构为 `pick` 返回 `{ entry, reset }` 一并消除 |
| 6 | BH | 每次 pick 重读 localStorage，单次预取可能混用两份选择 | low | 随 #3 改为每次预取解析一次 |
| 7 | BH | `pickTrack` 写死 netease 平台 | false | 合集分支前已 `record.platform !== "netease"` 返回 null，不可达 |
| 8 | BH/VG | `invalidate`/`saveShuffleSelection` 无生产调用 | false | 本 story 意图已声明面板与侧栏接线在 story 6/7，stories.yaml 已列 |
| 9 | BH | 曾关闭「包含专辑/歌单」的用户无提示地恢复包含 | false | 冻结意图明确退役且「读取后不再影响随机」 |
| 10 | BH | 退役字段只在内存删除，存储中残留 | low | 残留字段无任何读者；不常见且需新增写回逻辑，驳回 |
| 11 | EC | 存储里同 id 重复项会叠加权重 | low | 仅本插件写入（story 6），需新增去重分支，驳回 |
| 12 | EC | 选择解析为空但可用性仍显示可点 | low | 点亮须经面板确认（story 7），首次预取即熄灭并提示，驳回 |
| 13 | EC | 只剩当前曲目（专辑内按标题）时误报范围为空 | low | 随 #4 修复后部分勾选情形已改为静默等待（新测试覆盖）；专辑按标题的残余情形罕见，驳回 |
| 14 | BH | 「范围内全部无可播」测试未断言熄灭 | low | 已有 cleared 原因断言，补充 `mode === "none"` |
| 15 | EC | 声明「不改失败上限」与实现不符 | medium | 同 #3 根因，已修 |

## Design Notes

两级抽取示例（按歌曲，A 单曲 + 整单 P trackCount=100，本轮已从 P 播 10 首）：份数 A=1、P=90 → 按 1:90 抽条目 → 抽中 P 后拉详情，在未播的 90 首中均匀抽一首。按条目时 A、P 份数恒为 1（未耗尽时）。

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: tsc 与 vite 构建成功
- `npx prettier --check <改动文件>` -- expected: 通过
