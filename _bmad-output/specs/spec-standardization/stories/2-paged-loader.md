---
status: built
route: oneshot
review: quick
lenses_ran:
  - quick
baseline_revision: a5b2bbf
ticket: null
spec: ../SPEC.md
story: 2
context:
  - src/page/MainAppContainerServices/pagedLoader.ts
---

# Story 2 — 分页加载器

## Intent

把 7 个 Service 里重复的分页 Promise 包装抽成一份实现，两份 `splitByPage` 合并。

## Implementation Notes

- 新增 `pagedLoader.ts`：`showPage`（命中缓存只装 Promise）、`showLocalList`（整表切片）、`loadPage`（翻页 + 票号 + 追加）、`sliceCachedPage`。
- 接入 6 个：AllVideo / Bilibili / NetEase / Radio / Favorites / Recent。`InnerPageService` 不接入——它没有 `ctx`/`pushAllData`/`updating`，首屏与翻页走 `CollectionSegments` + `InnerPageHost.setSegments`（现场与模式快照两条落地路径），硬套会打乱票号语义；只把 `InnerPageData` 复用为同一数据形状，理由写在文件头。
- `splitByPage` 落到 `src/platforms/shared/splitByPage.ts`，bilibili 只 re-export、netease 直接 import，两平台不互相依赖。
- 审查后修：`loadPage` 在结果缺 `allPlatformData` 时显式解除 `updating`（否则搜索失败后翻页会被守卫永久拦住，这是改动前就存在的隐患）；`splitByPage` 对非正 / 非整数每页数按「一页装下全部」处理，与旧循环一致；补 3 条加载器用例与 3 条 splitByPage 边界用例。
- 验证：`tsc` 无告警；`npm test` 73 文件 / 1278 用例全绿；`npm run build` 通过，435.75 kB / gzip 132.18 kB。

## Review Triage Log

- 缺 `allPlatformData` 时 `updating` 卡死：patch（见上）。
- `splitByPage` 负数/NaN 边界不等价：patch。
- 加载器测试的 fake `pushAllData` 缺真实实现的空数据分支、票号用例未断言 `updating`：patch，补两条用例。
- `RadioService` 的 `loadedLists` 登记时机后移：记录不修——Preact 批处理下无可观察差异。
- `BilibiliService` 的直播搜索未接入且未写原因：记录——语义为整体替换、不追加、不碰 `updating`，接入会改变行为；已在接入处保留原实现。
- `PagePayload` 与 `ModeMediaData` 形状重复第三份：记录不修，跨层复用类型收益低于耦合成本。
- 服务层缺回归网（AllVideo / Bilibili / NetEase 无测试）：记录，本轮不为既有代码补测试网格。
