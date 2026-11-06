---
ticket: 1
title: 删除生产环境的 react-scan 外部脚本注入
type: feature
status: done
baseline_revision: ad6d6ee
route: oneshot
review: quick
lenses_ran:
- quick
context:
- src/main.ts
---
# Story 1 — 删除生产环境的 react-scan 外部脚本注入

## Intent

<frozen-after-approval>

插件加载后不再向页面注入任何外部脚本。移除 `src/main.ts` 中创建 `script`、指向 `//unpkg.com/react-scan/dist/auto.global.js`、设置 `crossOrigin` 并 `prepend` 到 `<head>` 的那段代码。不保留调试开关，不改动 `APP.toString()` 的 iframe 注入逻辑，不改动其它初始化步骤。

验收标准：

- Given 页面加载并初始化插件，When 观察网络请求，Then 不存在任何 `unpkg.com` 请求。
- Given 插件已初始化，When 打开主面板并搜索、点播，Then 行为与改动前一致。
- Given `npm test` 与 `npm run build`，When 执行它们，Then 全部通过。

</frozen-after-approval>

## Implementation Notes

- 删除 `src/main.ts` 中创建 `script`、指向 unpkg react-scan、`crossOrigin` 与 `prepend` 的 4 行及空行，其余初始化顺序不变。
- `npm test`：65 文件 / 1235 用例全绿；`npm run build` 通过，产物 474.89 kB（gzip 142.71 kB）。
- 真机验证（iirose.com，登录态注入）：注入后 11 个网络请求中 `unpkg|react-scan|jsdelivr` 命中 0；Alt+S 面板正常打开（transform 为单位矩阵），无运行时错误。

## Review Triage Log

- quick lens：无 findings。核对 diff 仅删除 4 行注入代码 + 1 空行，初始化顺序与 iframe 注入逻辑未变，产物中无 unpkg/jsdelivr 残留。
