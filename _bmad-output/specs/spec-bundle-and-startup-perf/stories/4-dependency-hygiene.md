---
status: built
route: oneshot
review: quick
lenses_ran:
  - quick
baseline_revision: 277cea7
ticket: null
spec: ../SPEC.md
story: 4
context:
  - src/Api/BilibiliAPI/Crypto/WBI.ts
  - src/Api/BilibiliAPI/Crypto/md5.ts
  - package.json
  - vite.config.ts
  - tsconfig.app.json
---

# Story 4 — 依赖与静态检查卫生

## Intent

<frozen-after-approval>

去掉 `md5` 依赖链，改成本仓实现；移除源码零引用的运行时依赖；修正 `vite.config.ts` 的入口文件名；开启 `noUnusedLocals` 并清零现有告警。行为不变。

验收标准：

- Given B 站 WBI 签名，When 用新实现计算 `w_rid`，Then 与 `node:crypto` 的 md5 结果逐字符一致。
- Given `package.json`，When 对照源码扫描，Then 不存在只声明不使用的运行时依赖。
- Given `tsc` 与构建，When 设置 `noUnusedLocals`，Then 无告警且产物正常。
- Given `npm test` 与 `npm run build`，When 执行它们，Then 全部通过。

</frozen-after-approval>

## Implementation Notes

- 新增 `src/Api/BilibiliAPI/Crypto/md5.ts`：RFC 1321 实现，UTF-8 输入、小写 hex 输出；`K` 表运行时由 `sin` 生成（省 64 个常量）。`WBI` 改用 `md5Hex`。
- 测试：`md5.test.ts` 用 `node:crypto` 的已知向量覆盖空串、ASCII、中文、跨分块与 1000 字符；`WBI.test.ts` 固定 `Date.now`，断言 `w_rid` 与独立计算结果逐字符一致。
- 依赖：移除 `md5`/`@types/md5`/`canvas`/`html-entities`/`@types/crypto-js`/`rollup-plugin-visualizer`；`@types/jquery` 固定回 3.5（宿站是 jQuery 3.x，4.x 的类型面会放过运行时不存在的方法），它只提供 `Global.ts` 里 `JQuery` 类型，运行时 `jquery` 包已移除。
- `vite.config.ts`：入口改 `src/main.ts`；顺带删掉只存在于注释里的 `visualizer` 导入与其注释块（需要体积分析时临时安装）。
- `tsconfig.app.json` 开启 `noUnusedLocals`，清理 20 处告警：Crypto 的未使用常量与只写不读变量、`MainAppContainer` 的 4 个死导入与 `SubNavBarIndex`、`NetEasePlatform` 的死变量与未使用的 `convertQualityToReadable`、`FavoritesStorageService` 的 5 个死导入与 2 个死常量、以及 6 处测试里的未使用解构。
- 验证：`npx tsc -p tsconfig.app.json --noEmit` 无告警；`npm test` 68 文件 / 1245 用例全绿；`npm run build` 通过，产物 444.10 kB（gzip 133.42 kB），达成 CAP-1 目标。

## Review Triage Log

- Implementation Notes 为占位、无测试构建记录：patch，已补齐。
- `vite.config.ts` 里 `visualizer` 是死导入、`tsconfig.node.json` 未开 `noUnusedLocals`：patch，删死导入与注释块，并移除 `rollup-plugin-visualizer`；`tsconfig.node.json` 未开启检查（那里只剩一个入口文件，无未使用项可查）。
- `@types/jquery` 被 npm 升到 4.x 与宿站 jQuery 3.x 不符：patch，固定回 `^3.5.32`。
- `WBI.test.ts` 实例化两次、被测实例状态未参与：patch，改为同一实例上取方法。
- `AGENTS.md` 的「入口写 src/main.js」已知坑已过时：defer，属规则文件，按流程不在本次改动内（见汇报）。
