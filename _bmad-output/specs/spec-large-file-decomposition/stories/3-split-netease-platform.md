---
status: built
route: oneshot
review: quick
lenses_ran:
  - quick
baseline_revision: 24300c8
ticket: null
spec: ../SPEC.md
story: 3
context:
  - src/platforms/NetEasePlatform.ts
---

# Story 3 — 拆分 NetEasePlatform

## Intent

把 1232 行的平台类按端点族拆开，每个文件 ≤400 行；公开静态方法签名与调用点不变，请求仍走 `SendFetch.neteaseRequest`。

## Implementation Notes

- 主文件 364 行；新增 `src/platforms/netease/`：`shared` 66、`lyrics` 74、`collection` 118、`collectionPicker` 131、`playback` 187、`search` 229、`searchResults` 170。
- `finalODSONG` / `playSongIds` / `playCollectionAll` 按测试要求留在类上，内部调用保持 `NetEasePlatform.xxx` 形式，`vi.spyOn` 仍命中。
- `selectEpisodes` / `MVOD` 搬出后通过依赖注入回类成员，spy 行为不变。
- 审查后补两处收口：`searchMusicsBasics` 增加 `fetchDetails` 参数（默认模块实现），平台层传 `NetEasePlatform.getNeteasePlatformData`，保证 public 方法仍可被拦截；删除与实现脱钩的 `DETAIL_CHUNK` / `DETAIL_CONCURRENCY` 公开字段（实现读模块常量，类上的副本改了不生效）。
- 验证：`tsc` 无告警；`npm test` 69 文件 / 1253 用例全绿（未改测试）；`npm run build` 通过，443.82 kB / gzip 133.92 kB。

## Review Triage Log

- quick lens 报 5 处「注入面收窄」：`playlistSkeleton`、`getNeteasePlatformData`、`DETAIL_CHUNK`、`itemPerPage` 读取时机、`baseHex` 读取时机、`sendSongs` 不再是类成员。
- 处置：`getNeteasePlatformData` 与 `DETAIL_CHUNK` 已按建议收口（见上）；`itemPerPage` / `baseHex` / `sendSongs` 记为不修——仓库内无写入与外部直调，属预防性提醒。
- 已核对：请求全部仍走 `neteaseRequest`，`sendSongs` 与分段逻辑逐行一致，四处搜索边界等价，无循环依赖。
