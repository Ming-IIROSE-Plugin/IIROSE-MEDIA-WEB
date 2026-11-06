---
ticket: 3
title: 产物体积守门
type: refactor
status: dropped
baseline_revision: 98f8b33
route: oneshot
review: quick
lenses_ran:
- quick
context:
- scripts/check-bundle-size.mjs
- package.json
- .github/workflows/webpack.yml
---
# Story 3 — 产物体积守门

## Intent

构建后自动校验产物体积，超过 450 kB / 134 kB gzip 时失败并打印实测值。

## Implementation Notes

- 新增 `scripts/check-bundle-size.mjs`：`evaluate({size, gzip}, limits)` 纯判定 + CLI 入口；gzip 用 `zlib.gzipSync(bytes, { level: 9 })` 计算，只用 Node 内置模块。
- 口径统一为十进制 kB：先前脚本按 1024 算，与 vite 报表的 450 kB 对不上（438.69 kB 被算成 428.41 kB），已改为 `/1000` 并在常量处注明。
- 接线：`npm run build` 末尾串上检查；新增 `check:size` 与 `test:scripts` 两个脚本；CI 在 `npm test` 之后加「Test bundle size guard」步骤。
- 测试：`scripts/check-bundle-size.test.mjs`（node:test，6 条）覆盖等于上限、单项超 1 字节、两项都超、CLI 超限退出码 1 且 stderr 打印实测与阈值、CLI 达标正常退出。
- 验证：`npm run build` 输出 `bundle 438.69kB / gzip 132.26kB（上限 450 / 134）`；`node --test scripts/check-bundle-size.test.mjs` 6 条全过；`npm test` 70 文件 / 1258 用例全绿。

## Retracted

2026-11-03 维护者要求「不要限制大小」：构建期校验、`check:size` / `test:scripts` 脚本与 CI 步骤已全部移除，`scripts/check-bundle-size.mjs` 与其测试删除。本 story 记为 dropped，体积只作人工参考，不再设阈值。
