---
ticket: 2
title: 歌单/专辑内页分段加载
type: feature
created: '2026-10-31'
status: done
baseline_revision: a4c17d6e8e338220b26c1ca7cac13873c67fdcb6
route: dispatch
review_loop_iteration: 0
context:
- '{project-root}/_bmad-output/initiative-iirose-media-web/archive-v6/spec-collection-inner-batch/SPEC.md'
---
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 网易云歌单/专辑「查看」进内页时，`processSongPlatformData` 把全部 `trackIds` 交给 `getNeteaseSongDetail` 串行取完才返回，万首歌单约 100 次请求后才出首屏（SPEC CAP-2）。

**Approach:** 进内页只取歌单（专辑）详情得到完整 id 列表，再取第 1 段 100 首详情即显示；总页数按 id 数算；翻页只在越过已取范围时取对应段，显示已取范围末页时预取下一段；同段不重复请求；失败页可重试；离开内页中止未完成的段请求。

## Boundaries & Constraints

**Always:** 请求只经 `getNeteaseSongDetail`（→ `neteaseRequest`），段请求带 story 1 的 `signal`。每页 10 首、页码 `01 / NN`、列表/网格切换、内页头曲目数、`pageOffset` 续号、行点播 `NetEasePlatform.MOD` 均不变。歌单以 `trackIds` 为完整列表与顺序；段内结果按 id 顺序重排，接口缺失的 id 跳过。旧结果不得覆盖新状态（开 B 后 A 的段返回要丢弃）。

**Never:** 不改 B 站多 P 内页（仍本地切片）；不改选集面板、`playCollectionAll`、CollectionHeader 外观；不新增 UI 状态组件（失败沿用 ResultsArea 现有「加载失败 / 重试」）；不新增依赖。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 万首进内页 | 10000 个 trackIds | 歌单详情 1 次 + 歌曲详情 1 次（前 100 id）；首屏 10 首；分页 `01 / 1000` | — |
| 段内翻页 | 第 1 段已取，翻 2→9 页 | 不发任何请求 | — |
| 末页预取 | 显示第 10 页 | 预取第 2 段（id 100–199）恰 1 次；翻到 11 页不再请求 | 预取失败不提示额外文案，翻到该页时再取 |
| 段失败 | 第 2 段返回 null | 第 11 页显示「加载失败 / 重试」；重试只重取第 2 段，不重载歌单详情 | 失败提示由 `neteaseRequest` 发出 |
| 歌单详情失败 | 歌单详情 null | 同现状：提示 + 整页失败，重试重载内页 | — |
| 离开内页 | 段请求飞行中点 ‹ 返回 / 搜索 / 换来源 / 换范围 / 开另一内页 | 该内页段请求 abort；迟到结果不 setState | 不弹提示 |
| 切模式回来 | 内页第 12 页时切到视频再切回 | 仍在第 12 页，已取段不重取 | — |
| 专辑 | 30 首 | 专辑详情 1 次 + 歌曲详情 1 次；`01 / 03` | — |
| 缺详情 | 某段接口少返回 2 首 | 该段所在页少显示这 2 首，不报错 | — |

</frozen-after-approval>

## Code Map

- `src/platforms/NetEasePlatform.ts:682-770` -- `getSongListMultiPageData` / `getAlbumMultiPageData` / `processSongPlatformData`：现在一次取全部。改为：抽出单曲 → `PlatformData` 映射（现 `processSongPlatformData` 循环体）；两个入口改为返回分段加载器（或 null 并照旧 `ShowMessage`）。`processSongPlatformData` 无其他调用点，可删或改为基于加载器。
- 新文件 `src/platforms/CollectionSegments.ts` -- 纯逻辑加载器：构造参数 id 列表 + `fetchSegment(ids, signal) => Promise<PlatformData[] | null>`，段大小 `NetEasePlatform.DETAIL_CHUNK`(100)。提供：`totalPage(perPage)`、`loadPage(page, perPage)`（取覆盖该页的段，进行中 Promise 去重，失败从缓存移除并 reject，显示该段末页时触发下一段预取）、`abort()`。便于独立单测。
- `src/page/MainAppContainer.tsx:775-829` `switchToMultiPage` -- 歌单/专辑分支：持有加载器（放进 state 以随 `takeSnapshot`/恢复走，见 `:497-535`），`mediaData` = 加载器就绪后 `loadPage(1)` 的 `{ platformData, totalPage }`；旧 `then` 设 `allMediaData` 改为按加载器身份判旧。打开新内页前 abort 旧加载器。
- `:737-763` `changecurrentPage` -- 内页且有加载器：`mediaData` = `loadPage(safePage)` 的 Promise；否则保留本地切片（B 站）。
- `:230` `handleRetry` -- 内页有加载器时重取当前页；无加载器（详情就失败）照旧重载内页。
- `:834` `switchToOutFromMultiPage` 与 `:635/688/709` 三处内页重置 -- abort 并清掉加载器。
- `src/page/MainAppContainer.test.ts:770-1009` -- `describe("专辑 / 歌单内页")`，NetEasePlatform 与 ResultsArea 已 mock；`:925` 用例断言「翻页只切片不发请求」需按新行为改写（段内翻页不发请求）。
- `src/platforms/NetEasePlatform.test.ts` -- 补入口用例（歌单详情 + 首段各 1 次）。

## Tasks & Acceptance

**Execution:**
- [x] `src/platforms/CollectionSegments.ts` + `CollectionSegments.test.ts` -- 加载器与矩阵中段内翻页/预取/去重/失败重取/abort/缺详情行 -- 核心逻辑可测
- [x] `src/platforms/NetEasePlatform.ts` -- 歌单/专辑入口返回加载器，单曲映射复用 -- 不再一次取全
- [x] `src/page/MainAppContainer.tsx` -- 内页接加载器：首屏、翻页、重试、离开 abort、判旧、快照 -- 行为落地
- [x] 测试 `MainAppContainer.test.ts`、`NetEasePlatform.test.ts` -- 覆盖万首进内页、离开 abort、开 B 丢 A、切模式回来、重试只重取该段、专辑 -- 回归保护

**Acceptance Criteria:**
- Given 1 万首歌单, when 点「查看」, then `getNeteaseSongDetail` 只被调用 1 次且参数为前 100 个 id，首屏渲染前 10 首。
- Given 现有测试套件, when `npm test` 与 `npm run build`, then 全部通过。

## Implementation Notes

- 加载器按 `neteaseMusic.id` 建段内索引，页按 id 列表下标取，因此重复 id、缺失 id 都不错位。段失败（null / 抛错 / 中止）都从缓存移除。
- 歌单/专辑详情失败：入口返回 null，内页 `mediaData` reject → 结果区「加载失败 / 重试」，重试重载内页（原来是 resolve 空列表）。
- 容器用实例字段 `activeSegments` 镜像 state 里的加载器（setState 生效前也能 abort），`innerLoad` 票号判旧：进新内页、‹ 返回、搜索、换来源、换范围、卸载都递增并 abort。
- 已知取舍：歌单详情飞行中就切走模式时，详情回来会被丢弃（abort + reject），切回后该内页显示「加载失败 / 重试」，重试重载内页；详情已落地后再切模式则按矩阵保留页码与已取段。
- `getNeteasePlatformData` 的单曲分支也改用抽出的 `songPlatformData` 映射。

## Spec Change Log

## Review Triage Log

| # | 来源 | 位置 | 意见 | 判定 | 去向 | 依据 |
|---|------|------|------|------|------|------|
| 1 | blind / edge / verif | MainAppContainer.tsx switchToMultiPage 判旧 | 详情未回时切模式（或在他模式搜索使全局 innerLoad 递增），回来显示假「加载失败」；mode 判旧无测试 | medium | patch | 快照里的 mediaData 即被 reject 的 Promise；旧代码切回仍能出首屏，属回退 |
| 2 | blind / edge | MainAppContainer.tsx:171 | 卸载只中止当前模式加载器，快照中的不中止 | low | reject | 面板实例只在插件整体卸载时卸载，日常不触发；修复需加遍历 |
| 3 | edge | MainAppContainer.tsx applyMode | 切模式覆盖 activeSegments 不 abort，旧加载器留在快照预取 | low | reject | 设计如此（切回不重取）；最多 1 个预取段 |
| 4 | blind | CollectionSegments.loadPage | 整页 id 全缺详情显示空列表、行号与 id 序位错开 | low | reject | 矩阵规定缺失跳过；整页全缺极罕见，修复需新增占位形态 |
| 5 | blind / edge | NetEasePlatform.songPlatformData | 单曲缺 artists/album 抛错致整段永远失败 | low | defer | 映射原样搬自基线 processSongPlatformData，预先存在 |
| 6 | blind | CollectionSegments 预取 | 预取失败仍由 neteaseRequest 弹提示 | false | reject | 矩阵为「预取失败不提示**额外**文案」，neteaseRequest 统一提示即契约 |
| 7 | blind / verif | MainAppContainer.test.ts | selectSource / selectScope / 卸载中止段请求无测试 | medium | patch | 预验证 gap；删掉对应 dropSegments 测试仍过 |
| 8 | blind | getAlbumMultiPageData | 专辑详情已带曲目仍多取 song/detail；歌单 tracks 可预填 | low | reject | 冻结矩阵规定专辑「详情 1 次 + 歌曲详情 1 次」，修复需改 spec |
| 9 | blind | CollectionSegments.size | 公开 getter 无调用点 | low | patch | 直接删除 |
| 10 | blind / edge | MainAppContainer.tsx changecurrentPage | 详情未回时翻页落入本地切片覆盖首屏 | false | reject | 全部翻页入口（CollectionHeader/ScopeRow/手势）都以 totalPage>1 守卫，详情未回时 totalPage=0 不可达 |
| 11 | blind | AGENTS.md | 未写内页分段加载约定 | low | defer | 修复编辑 agent-context 文件 |
| 12 | blind | MainAppContainer.test.ts tick / segmentFetch | 注释写微任务实为宏任务；共享 vi.fn 的 Once 队列可串用例 | low | patch | 注释直接修正 + describe 级 mockReset |

## Verification

**Commands:**
- `npm test` -- expected: 全部通过，含分段加载用例
- `npm run build` -- expected: tsc 与 vite 构建成功
