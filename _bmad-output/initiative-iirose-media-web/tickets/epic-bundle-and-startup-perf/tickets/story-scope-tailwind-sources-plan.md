---
ticket: 3
title: 收敛 Tailwind 扫描面到 src
type: feature
status: done
baseline_revision: 50ee41d
route: oneshot
review: quick
lenses_ran:
- quick
context:
- src/app.css
---
# Story 3 — 收敛 Tailwind 扫描面到 src

## Intent

<frozen-after-approval>

让 Tailwind 只扫描 `src` 下的源码，不再把 `_bmad-output/specs` 等 Markdown 里举例的类名生成为 CSS。`important: true` 保持不变。

验收标准：

- Given 构建，When 检查产物 CSS，Then 文档里独有的类（如 `bg-[#242a34]`）不再出现。`animate-[imwSheetRise…]` 在 `RoomDeck` 与 `EpisodePicker` 中真实使用，必须保留。
- Given `src` 中实际使用的类，When 构建，Then 全部仍被生成（抽检 arbitrary value 与响应式变体）。
- Given `npm test` 与 `npm run build`，When 执行它们，Then 全部通过。

</frozen-after-approval>

## Implementation Notes

- `src/app.css`：`@import "tailwindcss/utilities.css" source(none);` 关闭自动检测，再用 `@source "../src";` 只加回源码目录。
- 对照构建（临时 config，仅生成 CSS）：69.43 kB → 58.03 kB，gzip 11.75 kB → 10.08 kB，规则 760 → 669。
- 丢失规则逐条核对：92 条被排除的规则里，用「类名整词匹配源码」逐一检查，没有一条是 src 真实使用的；唯一命中的 `text-inherit` 仍以 `.text-inherit` 形式存在（消失的只是 `unknown!` 变体）。
- 抽检保留：`[grid-auto-rows:max-content]`、`max-[768px]:hidden`、`imw-dark:`、`hov:`、`motion-reduce:` 均在产物中。
- `npm test` 66 文件 / 1238 用例全绿；`npm run build` 通过，bundle 460.89 kB → 449.32 kB（gzip 137.08 → 135.38 kB）。

## Review Triage Log

- 验收用例把 `animate-[imwSheetRise…]` 当作“文档独有”：patch，该动画在 `RoomDeck`/`EpisodePicker` 真实使用，改为只举 `bg-[#242a34]`。
- `tailwind.config.js` 混入 2 空格格式重排：patch，已还原为与原文件逐字节一致。
- 实现说明与 status 未更新、story 文件未跟踪：patch，补齐并纳入提交。
