---
status: built
route: oneshot
review: quick
lenses_ran:
  - quick
baseline_revision: fe05ac9
ticket: null
spec: ../SPEC.md
story: 5
context:
  - src/Api/BilibiliAPI/BiliBiliVideoAPI/index.ts
---

# Story 5 — 拆分 BiliBiliVideoAPI

## Intent

把 1050 行的 B 站视频接口按用途拆开，每个文件 ≤400 行，对外仍只有 `BiliBiliVideoApi` 一个出口，调用点零改动。

## Implementation Notes

- `index.ts` 13 行（唯一出口）；新增 `video` 246、`interaction` 265、`tag` 84、`recommend` 133、`watch` 226、`shared` 15。
- 汇总方式用静态继承链（`VideoData → Interaction → Tag → Recommend → Watch → BiliBiliVideoApi`）：先试过成员别名 `static getX = Sub.getX`，长方法名在产物里重复一份，443 → 446 kB，改继承链后回到 444.46 kB。
- 30 个静态方法签名与请求构造逐字保留（含原实现里的冗余 `params.set("cid", cid)` 与非 Promise 的 `await`）；响应尾部统一为 `parseJsonOrNull`，`ok` 判定、`null` 返回与 `json()` 抛错语义不变。
- 审查后补注释：说明继承链只为汇总静态成员，并标注「链上不要声明 `cors` / `cncors` / `malaysiacors` / `devcors` 同名静态字段」（`getBilibiliCors()` 靠 `this` 沿链读到 `SendFetch` 的值）。
- 验证：`tsc` 无告警；`npm test` 69 文件 / 1253 用例全绿（未改测试、未改 `BilibiliPlatform.ts`）；`npm run build` 通过，444.46 kB / gzip 134.27 kB。

## Review Triage Log

- 无行为差异：脚本比对 30 个方法的签名与请求构造，0 处差异；`this.` 静态调用全部解析到 `SendFetch`，链上无同名覆盖；导出面不变（原模块只导出 `BiliBiliVideoApi`）；无新增循环依赖。
- 两点观察：`getBilibiliCors` 依赖沿链查找 `cors` 类字段（已加防护注释）；原注释「不额外增加体积」不成立（新增 5 个类声明），已改写。
- CAP-3 口径说明沿用 story 4：vite 报表 gzip 134.27 kB，略高于 134 上限，差额属拆分固有成本。
