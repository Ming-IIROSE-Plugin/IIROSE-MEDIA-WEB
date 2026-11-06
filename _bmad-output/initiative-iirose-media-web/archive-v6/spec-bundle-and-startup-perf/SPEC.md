---
id: SPEC-bundle-and-startup-perf
companions: [] # files downstream MUST read alongside SPEC.md. Paths may point inside the spec folder (spec-authored) or outside it (adopted from an upstream skill).
sources: [] # files fully absorbed into the SPEC (audit only; downstream does NOT read these). Never the memlog.
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# 产物体积与启动开销收口

## Why

**一个痛点，叠加一个既有约束。** 插件以单文件 UMD 形式经油猴 `@require` 注入 `messages.html`，每次进入蔷薇花园聊天站都要完整下载并解析这份产物。实测 475.0 kB（gzip 142.8 kB）中，约 14 kB（gzip 5.7 kB）是只为 B 站登录二维码一次 `toDataURL` 调用带进来的 `qrcode` 依赖链；另有 8.5 kB CSS 来自文档而非源码；启动路径上还存在一处生产环境向 unpkg 注入外部调试脚本，以及每次进站都重复一次可缓存的 IP 归属探测。用户每次进站都在为这些付流量、解析时间和第三方脚本风险，而收益为零。

## Capabilities

- **CAP-1**
  - **intent:** 维护者构建出的单文件 bundle 显著变小，同时 B 站扫码登录功能保持可用。
  - **success:** `dist/bundle.js` ≤ 450 kB 且 gzip ≤ 134 kB；在真实站点完成一次 B 站扫码登录，二维码可正常显示与被扫描。
- **CAP-2**
  - **intent:** 插件加载后不再引入外部脚本、不重复做可缓存的归属探测，且媒体状态轮询在没有订阅者时停止。
  - **success:** 页面 Network 面板无 unpkg / 第三方调试脚本请求；同一天内第二次进入站点不再请求 `ipinfo.io`；没有订阅者时媒体轮询定时器被清掉（单测覆盖）。
- **CAP-3**
  - **intent:** 依赖清单与静态检查如实反映代码，未使用的东西不再留在仓库里。
  - **success:** `package.json` 中不存在源码零引用的运行时依赖；`tsconfig.app.json` 的 `noUnusedLocals` 已开启且 `npm run build` 无告警（`noUnusedParameters` 在本次之前即为 true，`tsconfig.node.json` 仍为 false）；`npm test` 全绿。

## Constraints

- 产物必须是单文件 UMD：油猴 `@require` 与 iframe 注入方式决定不能 code-split、不能产生额外 chunk 或动态 import。
- 除替换 `qrcode` 的 `uqr` 外不新增运行时依赖；新依赖必须能打成 UMD 单文件且体积可控。
- `npm test` 与 `npm run build` 必须全绿；UI 行为、宿站交互契约与现有用户可见文案不得改变。
- 格式化或整文件重排必须单独提交（`style:` 前缀），不得与功能 diff 混提。

## Non-goals

- 拆分巨型文件（`MainAppContainer.tsx` 1292 行、`NetEasePlatform.ts` 1271 行、`ShufflePicker.tsx` 1068 行、`BiliBiliVideoAPI/index.ts` 1050 行）——确认为可维护性问题，另开 spec。
- 重写网络层或替换 CORS 代理方案。
- 为减体积引入运行时按需加载、分包或 Service Worker 缓存。
- 任何视觉、布局、交互设计的调整。
- 按需订阅（循环 / 随机未点亮时退订媒体轮询）：未实现。常驻 250 ms 轮询是循环与随机判定的功能需求，改成点亮才订阅需要 `PlaybackMode` 先提供状态通知，留给后续轮次。

## Success signal

在真实站点装上新 bundle：产物 ≤ 450 kB（gzip ≤ 134 kB），Network 里看不到 unpkg 请求，同一天第二次进入不再请求 `ipinfo.io`，没有订阅者时媒体轮询定时器为 0，B 站扫码登录可完整走通一次（最后一项目前需人工完成）。

## Assumptions

- `uqr` 生成的二维码可转成 `img` 可用的 data URL，在宿站弹窗内的展示效果与现有 `QRCode.toDataURL` 一致。
- `ipinfo.io` 的国家判定结果可按天缓存；缓存命中时跳过一次网络探测不会改变代理选择的正确性。
- `tailwind.config.js` 的 `important: true` 保留：宿站全局样式可能覆盖插件样式，稳定优先于 CSS 体积；实测仅作记录。
