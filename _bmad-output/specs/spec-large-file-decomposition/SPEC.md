---
id: SPEC-large-file-decomposition
companions: [] # files downstream MUST read alongside SPEC.md. Paths may point inside the spec folder (spec-authored) or outside it (adopted from an upstream skill).
sources: [] # files fully absorbed into the SPEC (audit only; downstream does NOT read these). Never the memlog.
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# 巨型文件拆分与死代码清零

## Why

**一个痛点，加一次已收敛的收尾。** 上一轮（`spec-bundle-and-startup-perf`）把产物从 475.0 kB 压到 444.61 kB / gzip 133.60 kB 后，体积已无单点可砍：模块构成是 `src/page` 324.9 kB、`Api` 95.9 kB、`platforms` 71.4 kB、`playback` 54.1 kB、`sync` 52.1 kB，最大外部依赖 `uqr` 26.6 kB 也已是精简后的选择。继续压体积只能靠砍功能。真正拖慢改动的是四个千行文件——`MainAppContainer.tsx` 1285 行、`NetEasePlatform.ts` 1232 行、`ShufflePicker.tsx` 1068 行、`BiliBiliVideoAPI/index.ts` 1050 行——以及扫描出来的零引用死代码。改动一次要点读整份文件，review 的 diff 面被无关上下文稀释，这正是前几轮反复出现「改 A 碰坏 B」的结构原因。

## Capabilities

- **CAP-1**
  - **intent:** 四个千行文件按职责拆成多个模块，每个文件不超过 400 行，对外接口与所有调用点保持不变。
  - **success:** 四个路径不再是单一大文件（同一目录出现按职责命名的子模块），每个文件行数 ≤ 400；`grep` 确认原导出符号仍从原路径可得，现有测试无需修改即可通过。
- **CAP-2**
  - **intent:** 仓库里不再保留零引用的死代码。
  - **success:** `src/tools/ImageTools.ts` 与 `src/Api/NeteaseAPI/NeteaseSearch/AlbumInterface.ts` 被删除，`tokens.deskGutterWide` 与 `searchIntent.normalizeKeyword` 被删除，`tsc` 与测试全绿。
- **CAP-3**
  - **intent:** 拆分不带来产物回退。
  - **success:** `dist/bundle.js` ≤ 450 kB 且 gzip ≤ 134 kB，`npm test` 与 `npm run build` 全绿。

## Constraints

- 产物仍是单文件 UMD（油猴 `@require` 与 iframe 注入决定），不引入 code-split 或动态 chunk。
- 拆分只搬代码：行为、UI、用户可见文案、宿站交互契约一律不变；不借机改逻辑。
- 每个 story 独立提交且测试全绿；现有测试不得放宽或删除来迁就新结构。
- 不新增运行时依赖；格式化/整文件重排单独提交（`style:` 前缀）。

## Non-goals

- 进一步减小产物体积：已无单点可砍，砍只能靠删功能。
- 按需订阅媒体轮询（`spec-bundle-and-startup-perf` 已记为未实现）。
- 重写业务逻辑、换框架、改状态管理方案。
- 清理 38 个未 import 的 `.d.ts`（全局类型，不进产物，风险大于收益）。

## Success signal

四个千行文件都不再存在、每个新模块 ≤400 行，死代码清单清零；装上新 bundle 后真机点播、循环/随机、收藏、设置四条主路径行为与改动前一致，产物 ≤450 kB / ≤134 kB gzip。

## Assumptions

- 四个文件的现有测试覆盖足以在拆分中兜住回归；不足时补测试，而不是降低验收。
- 拆分后的模块边界可以按现有职责（模式状态机、平台协议、面板 UI、API 端点族）切分，不需要改设计。

## Open Questions

- `NetEasePlatform` 与 `BiliBiliVideoAPI` 的端点族是否按「搜索 / 详情 / 播放地址 / 登录」拆分，还是按上游 API 路径拆分？——留给各自 story 的实现期决定，两种都不违反 CAP-1。
