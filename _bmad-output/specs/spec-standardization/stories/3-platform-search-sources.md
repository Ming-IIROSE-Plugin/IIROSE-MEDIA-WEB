---
status: built
route: oneshot
review: quick
lenses_ran:
  - quick
baseline_revision: 54361c1
ticket: null
spec: ../SPEC.md
story: 3
context:
  - src/platforms/platformSearchSources.ts
  - src/page/mainAppCategories.ts
---

# Story 3 — 平台检索描述表

## Intent

把各平台的范围与取数闭包从视图层搬到一份集中描述，新增平台只加数据。

## Implementation Notes

- 新增 `src/platforms/platformSearchSources.ts`（299 行）：`PlatformSearchSource`（title/shortTitle/sourceKey/pageSizeOf/ranges）+ `PlatformSearchRange`（公共字段 + 四族取数签名之一：`ctx` / `page` / `refresh` / `desk`）+ `PLATFORM_SEARCH_SOURCES` 六行数据。
- `mainAppCategories.ts` 316 → 84 行，只剩映射：按族的入参在**点击时**取值，不再 import 任何 Service / API。
- 侦察结论：四家平台没有共同方法，强造统一 `search()` 只会产出无人消费的适配对象，因此 CAP-3 从「接口类型化」改成「描述表」（见 memlog 第 16/17 条）。
- 审查后修：`sourceKey` 复用全局 `Platform["sourceKey"]` 而不是第三份手写联合；收藏页大小改由 `host.favoritesPageSize()` 提供，不再依赖「模式下标 = 行下标」；`searchAction` 在范围同时声明多族时直接抛错（开发期暴露，避免静默只跑第一族）；头注释纠正「新增平台只改这里」的说法（仍需按 AGENTS 补三处）。
- 新增 `platformSearchSources.test.ts`（7 条）：六行顺序、音乐/视频范围、收藏 3×4 与页大小标记、设置「关于」phoneOnly 置末、`search` 标记、每范围只声明一族、来源圆点数量。
- 验证：`tsc` 无告警；`npm test` 74 文件 / 1285 用例全绿；`npm run build` 通过，435.99 kB / gzip 132.45 kB。

## Review Triage Log

- 联合类型允许声明多族、运行时静默取第一族：patch，改为显式检测并抛错。
- 收藏页大小依赖行下标：patch，改由 `favoritesPageSize()` 提供。
- 头注释与 AGENTS 的「新增平台需同步三处」冲突：patch。
- `sourceKey` 联合第三份拷贝：patch，复用全局类型。
- 新表无直接测试：patch，补 7 条结构断言。
- 「关于」的 `release()` 与 `getActionContext()` 求值顺序对调：记录不修（无副作用，`release` 仍在 `showAbout` 之前）。
- `src/platforms/` 反向依赖 `page/MainAppContainerServices/*`：记录——目录级双向已存在（服务层本就依赖平台层），当前无模块级环；若要彻底解决需要把描述表下移到独立层，超出本轮范围。
