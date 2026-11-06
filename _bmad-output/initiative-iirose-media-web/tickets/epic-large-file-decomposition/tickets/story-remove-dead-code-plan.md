---
ticket: 1
title: 删除零引用死代码
type: feature
status: done
baseline_revision: b884bef
route: oneshot
review: quick
lenses_ran:
- quick
context:
- src/tools/ImageTools.ts
- src/Api/NeteaseAPI/NeteaseSearch/AlbumInterface.ts
- src/page/components/floating-panel/tokens.ts
- src/page/components/desk/searchIntent.ts
- src/platforms/BilibiliPlatform.ts
---
# Story 1 — 删除零引用死代码

## Intent

<frozen-after-approval>

删除四处在生产与测试中均无引用的死代码：`src/tools/ImageTools.ts`、`src/Api/NeteaseAPI/NeteaseSearch/AlbumInterface.ts`、`tokens.deskGutterWide`、`searchIntent.normalizeKeyword`，并清掉 `BilibiliPlatform.ts` 里指向 `ImageTools` 的两行注释。

验收标准：

- Given 全仓搜索，When 查这四个符号，Then 生产与测试代码中均无引用。
- Given `npx tsc -p tsconfig.app.json --noEmit`、`npm test`、`npm run build`，When 执行它们，Then 全部通过且产物不增大。
- Given 死代码删除，When 检查 `.d.ts`，Then 未被删除（非目标）。

</frozen-after-approval>

## Implementation Notes

- 删除 `src/tools/ImageTools.ts`（63 行）与 `src/Api/NeteaseAPI/NeteaseSearch/AlbumInterface.ts`（195 行）；后者是模块内 `export interface`，从未被 import，`AlbumData` 的其它用法走 `src/types/netease/Album.d.ts`。
- 删除 `tokens.deskGutterWide` 与 `searchIntent.normalizeKeyword`，并清掉 `BilibiliPlatform.ts` 里指向 `ImageTools` 的两行注释。
- 顺带修正 `deskGutter` 的注释：它只服务结果区与设置页，页头与范围行是自己写死的 36 / 20px，原注释会让人以为间距全走令牌。
- 验证：`npx tsc -p tsconfig.app.json --noEmit` 无告警；`npm test` 69 文件 / 1253 用例全绿；`npm run build` 通过，产物 444.61 kB（gzip 133.60 kB）与删除前一致（死代码本来不进 bundle）。

## Review Triage Log

- story 仍是 `in-progress`、Implementation Notes 为占位、`context:` 漏了 `BilibiliPlatform.ts`：patch，已补齐。
- `deskGutter` 注释与实现不符（页头/范围行并未使用该令牌）：patch，注释收窄为「结果区与设置页」。
- 已核实无残留引用、未删任何 `.d.ts`、删除后无悬空类型、diff 无格式化噪声。
