---
ticket: 2
title: 拆分 MainAppContainer
type: refactor
status: done
baseline_revision: de38e82
route: oneshot
review: quick
lenses_ran:
- quick
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
- 为让 host 接口成立，共有 **25 个成员**去掉 `private`（`private ` 出现次数 40 → 7）；外部调用点未变。其中 `controller` 由私有可写变成公开可写，而 view / modes / categories 每次调用都重新读 `host.controller`——外部赋值会一次性改道整块面板的行为（旧结构里不可能）。
- 验证：`tsc` 无告警；`npm test` 69 文件 / 1253 用例全绿（未改任何测试）；`npm run build` 通过，444.22 kB / gzip 133.77 kB。

## Review Triage Log

- quick lens：0 处行为差异。逐项核对 setState 调用数（旧 37 处 = 容器 7 + controller 29 + modes 1）、`await setState` 时序、view 的 key/ref/条件分支、字段封装未被绕过。
- **已修（复盘）**：两个工厂（`createController` / `createCategories`）从字段初始化移到构造函数末尾，`host.state` 不再在未定义时被访问。
- 低危提醒（不修）：两个 getter 属性在接口上声明为普通属性。
