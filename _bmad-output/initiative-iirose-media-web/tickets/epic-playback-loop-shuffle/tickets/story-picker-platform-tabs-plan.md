---
ticket: 8
title: 面板内切换随机平台
type: feature
created: '2026-10-27'
status: done
baseline_revision: fa9b4db837ab29469cea29cadca28c5aa081c13e
route: dispatch
review_loop_iteration: 0
context:
- '{project-root}/_bmad-output/initiative-iirose-media-web/archive-v6/spec-playback-loop-shuffle/SPEC.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-playback-loop-shuffle/shuffle-picker-panel.md'
- '{project-root}/_bmad-output/initiative-iirose-media-web/tickets/epic-playback-loop-shuffle/shuffle-mechanics.md'
---
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 收藏随机的平台现在跟随主插件页面焦点：用户想随机 B站收藏就得先把主插件切到视频页；主插件停在无线电等页面时随机按钮直接不可用。

**Approach:** 随机平台改由选择面板决定：面板顶部只列有收藏功能的平台（网易云、B站）作切换标签，首次打开停在设置「插件启动默认页面」对应平台、之后停在上次确认的平台；确认时保存改动过的各平台选择并按账号记下随机平台。随机控制器改读这份记录，主插件焦点不再参与。

## Boundaries & Constraints

**Always:** 默认标签：本机有已存随机平台用它，否则 `defaultPage` 0→网易云、1→B站、其他→网易云；随机平台与选择同一存储层、按 `getCurrentOwnerUid()` 分键，损坏按无记录；面板内切换标签即读取该平台收藏与已存选择，各标签本次的勾选、展开、权重在面板打开期间保留，搜索词切换时清空；摘要与「开始随机」只看当前标签，当前标签无收藏时显示「该平台还没有收藏」且不可确认；确认保存所有本次改动过的平台选择、把当前标签设为随机平台，再走 story 7 的 invalidate + 点亮；随机控制器的候选平台 = 已存随机平台，无记录时按 `defaultPage` 同一规则；可用性：连接就绪且任一平台有收藏即可用，全部平台无收藏报「收藏为空，先去收藏一些内容」；点亮期间主插件切换页面不熄灭、不改平台；标签视觉按 companion「平台标签」与头部描述，触控 ≥44px，`max-[768px]` 断点。

**Never:** 不混平台抽取；不改抽取、权重、去重、预取时序与系统返回机制；不删 `PanelFocus` 模块（主面板仍写入，其他读者另议）；不新增依赖。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 首次默认 | 无已存平台，`defaultPage`=1 | 面板停在 B站 标签 | `defaultPage` 非 0/1 → 网易云 |
| 记住平台 | 上次在 B站 确认 | 再开面板停在 B站 | N/A |
| 与焦点无关 | 主插件停在无线电页 | 随机按钮可用、面板照常打开 | N/A |
| 切换保留 | 网易云改了勾选 → 切 B站 → 切回 | 网易云的改动仍在，搜索词已清空 | N/A |
| 确认 | 网易云、B站都改过，停在 B站 确认 | 两个平台选择都保存，随机平台 = B站，随机点亮 | N/A |
| 取消 | 改过两个平台后取消 | 不保存任何平台，不改随机平台 | N/A |
| 空平台 | 当前标签无收藏 | 「该平台还没有收藏」，主按钮不可点；另一标签可切 | N/A |
| 全无收藏 | 两个平台都无收藏 | 侧栏按钮灰化并报「收藏为空，先去收藏一些内容」 | N/A |
| 点亮后切页 | 随机已亮，主插件换到别的平台页 | 随机不熄灭，仍在原平台抽取 | N/A |
| 存储损坏 | 随机平台记录非法 | 按无记录（`defaultPage` 规则） | 不抛错 |

</frozen-after-approval>

## Code Map

- `src/playback/ShuffleSelection.ts` -- 加随机平台的 load/save（键 `imwShufflePlatform:<ownerUid>`）与 `defaultShufflePlatform(defaultPage)`；复用 `getCurrentOwnerUid`。
- `src/playback/ShuffleController.ts:202-235` -- `trackPlatform` 现用 `platformOf(readPanelFocus(), defaultPage)`，改读已存随机平台（无记录按 `defaultShufflePlatform`）；`publishAvailability` 现按当前平台候选判可用并有 `noFavorites` 原因，改为「任一平台有收藏」（`deps` 增一个查询，例如对 `netease`/`bilibili` 各查一次或查 `all`），`noFavorites` 原因退役；抽取仍只用随机平台候选。
- `src/page/components/shuffle-picker/ShufflePicker.tsx:37-50,504` -- props 现为单 `platform` + `load()`，头部显示平台胶囊；改为平台标签行、按平台加载与保留状态、确认回传所有改动过的平台选择与当前平台。`pickerModel.ts` 的状态与导出按单平台不变，按平台各持一份。
- `src/page/components/shuffle-picker/openShufflePicker.tsx` -- `openShufflePicker({ platform, ... })` 的 `platform` 改为初始标签；确认对齐/保存覆盖所有改动过的平台并保存随机平台；`onConfirm` 回调签名随之调整。
- `src/page/index.tsx:118-139,260-275` -- 侧栏 `pickShuffle` 与调试入口现用焦点平台并有 null 分支；改为已存随机平台或 `defaultShufflePlatform`，删去 null 分支与 `PanelFocus` 引用。
- `src/playback/PanelFocus.ts` -- 不改；`MainApp.tsx`/`MainAppContainer.tsx` 仍写入焦点。
- 测试：`ShuffleController.test.ts`（「焦点页面没有收藏时不可用」等焦点用例需按新规则改写）、`ShuffleSelection.test.ts`、`openShufflePicker.test.ts`、`src/page/index.test.ts`（story 7 的 bilibili 焦点用例改为已存平台/默认页）。

## Tasks & Acceptance

**Execution:**
- [x] `src/playback/ShuffleSelection.ts` -- 随机平台存取与默认规则 -- CAP-11 存储
- [x] `src/playback/ShuffleController.ts` + `src/page/index.tsx` 装配 -- 候选平台改读记录、可用性改「任一平台有收藏」、退役 `noFavorites` -- 与焦点解耦
- [x] `ShufflePicker.tsx` / `openShufflePicker.tsx` -- 平台标签、按平台状态保留、确认保存多平台与随机平台 -- CAP-11 界面
- [x] `src/page/index.tsx` -- 侧栏与调试入口的初始平台改为记录/默认页 -- 接线
- [x] 单测 -- 覆盖 I/O 矩阵全部行，改写依赖焦点的旧用例 -- 回归

**Acceptance Criteria:**
- Given 400×800 与 1280×720，when 打开面板，then 标签行完整可点（≥44px）、无横向溢出，深浅主题对比清晰。
- Given 改动完成，when 运行 `npm test`、`npm run build`、改动文件 `prettier --check`，then 全部通过。

## Implementation Notes

- 随机平台存 `localStorage` 键 `imwShufflePlatform:<ownerUid>`，值为平台名字符串；非法值按无记录。`resolveShufflePlatform(defaultPage)` = 记录 ?? `defaultShufflePlatform(defaultPage)`，控制器、侧栏与调试入口共用。
- 控制器按平台缓存收藏（`invalidate` 与收藏变更 `FavoritesStorageService.onChange/onExternalChange` 时清空并刷新可用性，二者现返回退订函数）：可用性查全部收藏平台，抽取只读随机平台；随机平台无收藏而另一平台有时，点亮后抽取熄灭并报「随机范围为空，重新选择」，全部平台都空才报「收藏为空」。`SHUFFLE_REASONS.noFavorites` 已删除。
- 确认保存先快照将写的各键旧值，任一写入失败全部回滚；非当前标签选成空（含对齐后为空）不保存、保留原选择。标签读取失败显示「读取收藏失败」+ 重试。
- 面板「改动过」= 本次打开期间用户勾选/全选/全不选/权重有操作的平台（展开加载导致的归一不算）；确认保存当前标签 + 改动过且有收藏的其他标签，回调签名改为 `{ platform, selections }`。
- 未做：400×800 / 1280×720 真机视觉验收（标签行 44px 触控区、无横向溢出、深浅主题）仅在代码层按 companion 实现，未在 iirose.com 运行时实测。

- 主会话真机复核（空收藏账号）：400×800 浅色 / 1280×720 深色，标签行无溢出、选中态清晰、空态与不可确认正确；发现标签按钮实测 34px 高，未达验收 ≥44px 触控，列入审查修补。
- 审查后真机复核：标签实测 187×44（≥44px），aria-orientation=horizontal，无溢出，单实例。
- 验证：`npm test` 582 通过（审查前 575），`npm run build` 通过，改动文件 prettier 通过。

## Spec Change Log

## Review Triage Log

| # | 来源 | 发现 | 判定 | 依据 / 去向 |
|---|------|------|------|------|
| 1 | BH | 收藏可用性缓存只在确认时清，首次收藏后按钮仍「收藏为空」，删空后仍可用 | medium | 旧实现靠焦点切换清缓存，解耦后无人清；patch：订阅收藏变更刷新 |
| 2 | BH/EC | 随机平台为空而另一平台有收藏时报「收藏为空」 | low | 文案与事实不符，直接修正为「随机范围为空，重新选择」；patch |
| 3 | BH/EC | 改动过但勾选为空的非当前标签（或对齐后为空）被存成空选择 | medium | 之后选该平台即熄灭；patch：非当前平台空选择不保存 |
| 4 | BH/EC/VG | 多平台保存非原子，中途失败半写入 | medium | 违反「取消/失败不保存」；patch：快照回滚 |
| 5 | 主会话真机 | 标签按钮实测 34px 高，验收要求 ≥44px | medium | patch |
| 6 | EC | 确认对齐中切换标签，错误显示在另一标签下 | low | 直接加守卫；patch |
| 7 | BH | 切换标签不清底栏错误 | low | patch |
| 8 | EC/BH | 标签缺 Home/End、无 aria-orientation，且处理上下键 | low | 直接修正；patch |
| 9 | BH | 单标签读收藏失败显示「没有收藏」且不重试 | medium | 可能掩盖真实收藏；patch：失败提示 + 重试 |
| 10 | VG | 展开后切标签确认不应保存原标签、迟到的曲目应落回原标签，均无测试 | medium | patch：补测试 |
| 11 | BH | 确认会静默覆盖其他改动过的标签 | false | 规格既定行为（确认保存所有改动过的平台） |
| 12 | EC | 可用性在途查询结果不立即发布 | low | 下一次 250ms 快照即刷新，驳回 |
| 13 | BH | 焦点陷阱把未选中标签（tabIndex=-1）算入首尾 | false | 首尾分别为关闭钮与开始随机，不受影响 |
| 14 | BH | `platformOf`/`readPanelFocus` 已无生产调用；story 4/6/7 与 deferred-work 仍描述焦点平台 | low | 规格要求不删 PanelFocus 模块；旧 story 为历史记录，由本 story 与 SPEC 取代，memlog 已记 |
| 15 | BH | 随机平台存裸字符串、与选择的版本化格式不一致，save 不捕获异常 | low | 读取已兜底、保存由确认的 try 捕获，驳回 |
| 16 | BH | 测试 import 顺序无关改动 | low | 直接撤回；patch |

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 构建成功
- `npx prettier --check <改动文件>` -- expected: 通过

**Manual checks (if no CLI):**
- 手机真机：首次默认平台、切换标签保留、确认后随机按所选平台点播（公开房间点播须用户同意，或由用户自行实测）。
