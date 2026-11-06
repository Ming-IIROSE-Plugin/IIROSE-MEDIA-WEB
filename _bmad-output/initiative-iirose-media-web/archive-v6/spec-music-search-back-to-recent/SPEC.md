---
id: SPEC-music-search-back-to-recent
companions: []
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# 音乐模式搜索后回到最近点播

## Why

要解决的痛点：音乐模式搜索过一次后，用户就回不到「最近点播」首屏。空词提交被 `submitSearch` 直接忽略（`src/page/mainAppContainerController.ts:96`），只能刷新页面。想重点刚点过的歌时，只能重新搜索。

## Capabilities

- **CAP-1**
  - **intent:** 用户可以在音乐模式一键清除搜索词并回到最近点播。
  - **success:** 输入框有内容时显示清除钮，为空时不显示；点击后输入框清空、焦点留在输入框（手机不因此弹出键盘）；已搜索状态下结果区显示「最近点播」、页码归 1，停在专辑 / 歌单 / MV 时范围切回「单曲」，内页开着时一并退出；在首屏点击只清空未提交的输入，列表不重载。

- **CAP-2**
  - **intent:** 用户手动删空搜索词后提交，也能回到最近点播。
  - **success:** 已搜索状态下删空输入后，回车或点「搜索」的结果与 CAP-1 相同；删字过程中结果区不变、不发请求；已在首屏时空提交无任何变化。

- **CAP-3**
  - **intent:** 用户回到首屏后可以照常再次搜索。
  - **success:** 回到首屏后，用搜索栏或聊天框 `@` 搜索任意关键词（含刚清除的同一个词）都能发起搜索并显示结果。

## Constraints

- 清除前发出的搜索请求，结果迟到时不得覆盖最近点播。
- 回到首屏只读本地历史，不发网络请求。
- 控制层 `changeSearchKeyword` 会忽略空词（`src/page/MainAppControlLayer.tsx:221`），清除后全局词仍是旧值，`@` 同一个词不会触发搜索，必须一并处理。
- 外观只用 `tokens.ts` 令牌与 `DeskIcon` 的 `close` 图标；手机可点区域不小于 44px，断点用 `max-[768px]`。
- 手机没有「搜索」按钮，清除钮在手机上必须可见。

## Non-goals

- 不改视频、电台、收藏模式的搜索栏与空提交行为。
- 不增加「最近点播」范围标签。
- 不保留或恢复上一次搜索的结果与关键词。
- 不做删空即自动返回。
- 不改最近点播的数据规则，不加删除或管理入口。

## Success signal

- 在音乐模式搜索一首歌、切到「专辑」范围后点清除钮，直接看到「单曲」范围下的「最近点播」且没有新的网络请求；再用聊天框 `@` 搜同一个词，能正常出结果。

## Assumptions

- `@` 同词复搜属于本次范围：回到首屏后状态应当干净。
- 未提交的输入也算「有内容」，所以首屏也显示清除钮。
