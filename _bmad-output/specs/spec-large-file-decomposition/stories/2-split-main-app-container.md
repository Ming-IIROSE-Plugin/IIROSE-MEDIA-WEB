---
status: built
route: oneshot
review: quick
lenses_ran:
  - quick
baseline_revision: de38e82
ticket: null
spec: ../SPEC.md
story: 2
context:
  - src/page/MainAppContainer.tsx
---

# Story 2 — 拆分 MainAppContainer

## Intent

把 1285 行的容器类按职责拆开，每个文件 ≤400 行，对外导出与行为不变。

## Implementation Notes

- 拆为 6 个文件：主类 386 行、`mainAppContainerModel.ts` 71、`mainAppCategories.ts` 316、`mainAppContainerController.ts` 374、`mainAppContainerModes.ts` 103、`mainAppContainerView.tsx` 242。
- 比计划多拆出 `mainAppContainerModes.ts`：`applyMode` / `defaultModeState` / `handleExternalKeyword` 搬走后主文件才降到 400 以内。
- `createController` 与 `applyMode` 统一通过 `mergeState(patch, cb)` 落地，仍是原来的 `setState` 通路；分类表的 `changeSearchKeyword` / `showOrHideIMC` 用 getter 透传 props 原函数，保持测试断言的函数同一性。
- 为让 host 接口成立，`itemsPerPage` / `pageSizeFor` / `pendingSearch` / `innerPageSource` / `activeSegments` / `snapshots` / `multiPageTicket` / `searchBarRef` / `getActionContext` / `dropSegments` / `innerPageHost` / `currentPlatform` / `runCurrentScope` / `modeForKeyword` / `getActiveCategories` / `visibleScopes` / `effectiveScopeIndex` / `playCollectionAll` / 选择入口 / `controller` 去掉 `private`；外部调用点未变。
- 验证：`tsc` 无告警；`npm test` 69 文件 / 1253 用例全绿（未改任何测试）；`npm run build` 通过，444.22 kB / gzip 133.77 kB。

## Review Triage Log

- quick lens：0 处行为差异。逐项核对 setState 调用数（旧 37 处 = 容器 7 + controller 29 + modes 1）、`await setState` 时序、view 的 key/ref/条件分支、字段封装未被绕过。
- 低危提醒（不修）：工厂函数在字段初始化时执行，`host.state` 此刻为 undefined，接口未表达这一点；七个字段去掉 private 扩大可变面；两个 getter 属性在接口上声明为普通属性。
