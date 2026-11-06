---
ticket: 2
title: 用 uqr 替换 qrcode 依赖链
type: feature
status: done
baseline_revision: 3e98e3d
route: oneshot
review: quick
lenses_ran:
- quick
context:
- src/Account/BiliBili/SetBiliBili.ts
- src/Account/BiliBili/qrCode.ts
- package.json
- tsconfig.app.json
---
# Story 2 — 用 uqr 替换 qrcode 依赖链

## Intent

<frozen-after-approval>

把只服务 B 站扫码登录的 `qrcode` 换成 `uqr`，移除 `qrcode` 及其真实依赖链（`pngjs` / `yargs` / `cliui` / `encode-utf8` 等）。`generateQRCodeBase64` 对调用方保持 `Promise<string>` 契约不变，返回可直接塞进 `window.showImg` 的图片 data URL。纠错级别、静区与像素尺寸与旧实现一致（M、4 个模块、4px/模块）。

验收标准：

- Given 构建产物，When 加载插件，Then 不再打包 `qrcode` 及其依赖。
- Given 一个 B 站二维码 URL，When 生成 data URL，Then 可被解码回原始 URL 且尺寸非零。
- Given `npm test` 与 `npm run build`，When 执行它们，Then 全部通过。

</frozen-after-approval>

## Implementation Notes

- 新增 `src/Account/BiliBili/qrCode.ts`：`renderQRCodeDataUrl` 用 `encode` 取含静区的模块数、`renderSVG` 出图，再补上 `width`/`height`（旧 `QRCode.toDataURL` 默认 scale=4、margin=4，尺寸同量级）。
- `SetBiliBili.generateQRCodeBase64` 改为委托纯函数，`Promise<string>` 契约与调用点均未变。
- 新增 `qrCode.test.ts`：断言 data URL 前缀、固有宽高等于 `size*4`、静区差值为 8 模块、不同文本矩阵不同。
- 依赖：`qrcode` 与 `@types/qrcode` 移除，`uqr@0.1.3` 加入。卸载过程连带移除了未声明的 `@types/node`，导致 `tsc -b` 报 `node:module`/`Buffer` 未定义；已显式声明 `@types/node` 并把 tsconfig `lib` 由 ES2020 升到 ES2022（代码已使用 `Array.prototype.at`，`target` 仍为 ES2020）。
- 验证：`npm test` 66 文件 / 1238 用例全绿；`npm run build` 通过，产物 460.89 kB（gzip 137.08 kB，较改动前 -14.0 kB / -5.6 kB）。
- 二维码离线解码（jsQR + Chromium canvas）：212×212，解出内容与原始 URL 逐字符一致。
- 真站渲染（iirose.com 登录态注入后调用宿站 `window.showImg`）：`albumShow` 为 `IMG`，`naturalWidth/Height` = 212，`albumShowHolder` 显示，截图确认静区与定位角完整。
- `tsconfig` 只放开 `ES2022.Array`（`Array.prototype.at` 仅测试用），`target` 仍为 ES2020；`@types/node` 取 22 与 CI 的 `node-version: 22.x` 对齐。

## Review Triage Log

- 静区从 4 缩到 2（旧 qrcode 默认 margin=4）：patch，改 `border: 4`。
- 固有尺寸 410px 与旧 ~196px 不一致：patch，`pixelSize: 4` 复刻旧 scale，实测 212px（uqr 选的版本略高，同量级）。
- 未解析到 `<svg ` 时静默返回无尺寸图：patch，改为抛错，让登录失败得明显。
- 测试用 rect 的 width 误判根 svg 尺寸：patch，断言 `<svg width=`。
- 静区用例未调用被测函数：patch，改为由被测函数输出推导 `(bare+8)*4`。
- 验收 2 无自动化解码、真站展示未验证：patch，补真站 `showImg` 渲染实测；自动化解码仍不引入 jsQR 运行时依赖，留作手工验证记录。
- `tsconfig` 整体抬到 ES2022 扩大生产类型面：patch，收窄为 `ES2022.Array`。
- `@types/node@26` 与 CI Node 22 脱节：patch，降到 22。
- 测试常量 `URL` 遮蔽 DOM 全局：patch，改名 `QR_TEXT`。
- story 意图把 md5 的依赖链（crypt/charenc/is-buffer）错记为 qrcode 的：patch，意图与 memlog 已更正。
- 待审 diff 缺 `package-lock.json`：patch，提交包含，`npm ci` 可复现。

