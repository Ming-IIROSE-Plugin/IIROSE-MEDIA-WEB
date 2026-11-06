---
ticket: story-search-view-toggle
date: 2026-10-10
verdict: accepted-with-open-items
criteria: declared
headless: false
---
# 搜索结果视图切换(卡片/列表)— 特性复盘

## Epic summary

- **对象**:SPEC-search-view-toggle(单特性构建,非多 story epic;无 sprint-status.yaml,stories 模式)
- **diff 范围**:`810e9e3..HEAD`(5 提交,0 合并;baseline 取自实现 spec frontmatter 的记录值,非推断)
  - `59f9f90` style / `8933aa3` feat 主体 / `bf2bd01` fix 溢出+按钮 v2 / `8950f4e` feat UI 打磨 / `553dbeb` fix 标签语义
- **story 完成度**:单一实现 spec `spec-search-view-toggle.md` status: done;无 pending_stories
- **证据清单**:
  - ✓ 契约:`_bmad-output/specs/spec-search-view-toggle/SPEC.md`(含声明式 Success signal)
  - ✓ 实现工件:`_bmad-output/implementation-artifacts/spec-search-view-toggle.md`(done;含 13 条评审 triage log、Implementation Notes)
  - ✓ 延后台账:`deferred-work.md`(4 项)
  - ✓ git 证据:git_evidence.py 已跑(11 文件变更量见下)
  - ✓ 会话日志:本会话(build→review→3 轮 UI 迭代→语义修复,含真机验证记录);**易失证据,已在此存档引用**
  - ✗ 缺失:stories.yaml / story 文件(非 story 形态,以实现 spec 代位);上一轮 retro(首次);无独立 session 存档文件

### 变更量(节选自 git_evidence)

| 文件                | +/−                     | 提交数 |
| ------------------- | ----------------------- | ------ |
| MediaSearchBar.tsx  | +19/−3                  | 3      |
| MediaCardButton.tsx | +48/−16                 | 3      |
| MediaListRow.tsx    | +49/−4(新文件)          | 3      |
| PluginSettings.ts   | +117/−90(含 style 噪音) | 2      |
| 其余 7 文件         | 净 +82                  | 各 1   |

## Findings

评审范围声明:8933aa3 本体已有 step-04 三 lens 13 条 triage 记录(见实现 spec),不重复;bmad-review 此轮仅覆盖评审后 3 个 UI 迭代提交(`8933aa3..HEAD`)。此收窄是刻意为之。

### bmad-review lenses(8933aa3..HEAD)

**Adversarial(11 条)** — 编号 A1-A11,全文见会话记录,摘要:

- A1 元信息省略号失效:`MediaListRow.tsx:34-38` 右对齐包裹层内 flex 子项 `min-width:auto` 不可收缩,长 subtitle 硬裁无「…」(回归)
- A2 切换钮语义内耗:图标+文字=当前态,`title`=动作态;≤490px 图标-only 读作状态指示器(`MediaSearchBar.tsx:59-67`)
- A3 移动端「方钮」不方:`max-[490px]:w-[64px]` 但容器 `h-[72px]` 固定 → 64×72 矩形,注释说谎(`MediaCardButton.tsx:96,102`)
- A4 无 preflight → box-sizing 逐点补丁:`border-l` 使 72px 段实际 73px;bf2bd01 修的 bug 类别会复发(`app.css:2-3` 根因)
- A5 移动端挤压:按钮区 ≤490px 时占 128px,375px 面板标题仅剩 ~100px
- A6 状态化切换钮无 role/键盘路径(`MediaSearchBar.tsx:57-68`)
- A7 72px 魔数散落 3 文件,无单一来源(`MediaCardImg.tsx:122`/`MediaCardButton.tsx:93,102`/`MediaListRow.tsx:11`)
- A8 `mr-auto` 中和父级 `justify-end` 成死规则;491-780px 区间隐式继承左推(`MediaSearchBar.tsx:56,58`)
- A9 `ml-[10px]` 与下方 12px 栅格(p-3)差 2px,光学台阶(`MediaSearchBar.tsx:58`)
- A10 空元信息仍渲染 16px 空行,右锚点设计对无类型条目失效(`MediaListRow.tsx:34-38`)
- A11 `hover:bg` 无 `(hover:hover)` 门控,触屏粘滞高亮(`MediaCardButton.tsx:99`)

**Edge-Case(2 条,声明核实 ✓)**

- E1 触屏 hover 粘滞(与 A11 同源,信号重叠)
- E2 **通配过渡吞掉按压反馈**:`app.css:54` 的 `.IIROSE_MEDIA_CONTAINER * { transition: all .5s }` 未分层,压过 `duration-100` → hover/active 动画全走 0.5s,`active:scale-95` 近乎不可见(`MediaCardButton.tsx:96-99`)
- 反向核实:3 提交全部声明属实(图标语义、整高按钮、右锚、对比度、box-border 有效性)✓

**Verification-Gap(2 条)**

- V1 **冻结 spec 与已交付语义相悖未记协商**:`553dbeb` 把「图标=目标视图」改为「图标+文字=当前视图」,但冻结块 4 处(matrix `:43`、task `:74`、Design Notes `:123`、triage B9 `:113`)仍断言旧语义,Spec Change Log 空——未来按 spec 复验必误判
- V2 **设置行图标与文字矛盾**:`SettingsService.ts:158` 图标硬编码 `listViewIcon`,card 态显示「列表图标+卡片文字」——正是 553dbeb 要消除的矛盾类别,姊妹入口未同步采纳

### 聚合视图(内联推导,范围:全 5 提交)

- **架构增量**:新依赖边 `MainAppContainer→PluginSettings`(page→settings,与既有 SettingsService→PluginSettings 同向,无环);`MediaListRow→MediaCardImg/Button` 兄弟复用 ✓。无分层违规、无新包依赖
- **重复地图**:72px 字面量 ×3(=A7);`"card"|"list"` 联合 ×4(tsc 兜底,已判 false 不计);其余逻辑复用良好(getMediaInfoArea 抽取是消重而非造重)
- **体积增长**:变更量最高 `PluginSettings.ts`(净+27,含 style 噪音)、`MediaListRow.tsx`(+45 新文件)。全文件 <300 行;`MainAppContainer.tsx` ~750 行是**预存在**的大文件(内联 700 行平台配置),本特性仅 +20,非本 epic 造成
- **模式分歧**:①box-sizing 无 preflight 靠手动 `box-border`——本特性踩中一次(bf2bd01),A4 指出这是系统性坑;②宿主 CSS 交互(通配过渡 E2)未纳入既有「宿站元素选择器」章节的防御清单
- **spec 对账**:V1(图标语义)+ SPEC.md Open Questions 过期(B4,已延后)+ B10 台账与 reality 不符(已执行未销账)+ 冻结「最左缘」由 8950f4e 兑现(文字与实现终于一致)

## 2026-11-04 复核（defer 5-10）

| 项 | 现状 |
|---|---|
| 5 元信息省略号（verify-then-decide） | 未复测；该处的 `text-ellipsis` + `min-w-0` 约定已在 `AGENTS.md` 的视觉检查单里固定，属真机复测项而非代码待办 |
| 6 移动端 375px 挤压 | 需设计裁决（缩按钮 / 缩略图 / 图标化），不是代码待办 |
| 7 切换钮 a11y（role/键盘） | 站点级决策（与全站 div-onClick 风格一致），不是代码待办 |
| 8 72px 魔数常量化 | **已随 `spec-media-desk-redesign` 消失**：当前 `72px` 只剩 `EpisodePicker` 与 `StateMessage` 两处新代码，原提案指的 3 个文件已重写 |
| 9 台账清理 | 2026-10-31 已完成 |
| 10 既有 deferred-work 4 项 | `_bmad-output/initiative-media-desk-redesign/deferred-work.md` 已不在仓库；相关条目随 redesign 收尾处理 |

结论：defer 5-10 中没有仍可执行的代码项——5/6/7 需要维护者或设计裁决，8/9/10 已随代码演进关闭。

## Behavior verification

- `8933aa3`:6 条 AC 真机逐条验证(即时切换/持久化/双入口/multiPage/窄屏/老数据回填)——记录于实现 spec triage 与会话日志
- `8950f4e`:几何审计真机复测(overflowX=0、行高 92、按钮 72×72、对比度 0.6)✓
- `553dbeb`:双入口四步矩阵真机复测(A→D 标签与 localStorage 三方一致)✓
- **覆盖缺口(诚实声明)**:上述验证均未覆盖本轮新发现——动画时长(E2)、触屏 hover 粘滞(A11)、长 subtitle 裁切(A1)、空元信息行(A10)、375px 挤压(A5)。这些是纯视觉/交互动效缺陷,build 与当时的手动清单都看不见

## Previous-retro follow-through

首次复盘,无前序。注:`deferred-work.md` 中 B10(style 提交隔离)实际已在提交时执行(59f9f90 独立 style 提交),台账状态与现实不符,记为台账清理项。

## Action items

_(2026-10-11 执行记录:1-4 及 A1 护栏已落地——代码在 `b5785a2`,检查单在 `48facc9`(注:该文件原属 gitignore 的 agent 工具链,经维护者明示 `git add -f` 入库,为仓库首例);11 已由维护者拍板改写冻结块 4 处并补 Spec Change Log。defer 5-10 保持 open。以下为原始提案,留档)_

**fix-now 候选(按根因分组):**

1. **宿主 CSS 交互硬化包**(A4+A11/E1+E2)——`app.css` 加 scoped `box-sizing:border-box`(容器作用域)、`@custom-variant hov (@media(hover:hover))` 门控 hover、`duration-100!` 对抗无层通配过渡;owner: dev loop
2. **指示语义一致收尾**(A2+V2)——切换钮 `title` 改「当前:卡片,点击切换」式;设置行图标 `ps.searchViewMode === "list" ? listViewIcon : cardViewIcon`;owner: dev loop
3. **小修包**(A3+A8+A9+A10)——移动端方钮补 `max-[490px]:h-[64px]` 或放弃宽度收窄;清死 `justify-end`;`ml-[10px]`→`ml-3` 对齐 12px 栅格;空 meta 条件渲染;owner: dev loop
4. **视觉动效检查单进 verify skill**(流程教训)——本轮三类返工(溢出/按压无反馈/语义混淆)全是 build 与既有清单看不见的纯视觉缺陷;把 hover/触屏/动画时长/文本裁切/空态五项追加进 `.opencode/skills/iirose-plugin-verify/`;owner: 维护者

**verify-then-decide:**

5. **A1 元信息省略号**——CSS 规范上 flex item 带 `overflow:hidden` 时 min-size=0,省略号应生效;真机造长 subtitle 复测后再定修否

**defer(带上下文,不重查):**

6. A5 移动端 375px 挤压(按钮区 128px)——需设计裁决(缩按钮 56/缩略图 60/图标化),Sally 域
7. A6 切换钮 a11y(role/键盘)——与全站 div-onClick 风格一致性问题,站点级决策
8. A7 72px 魔数常量化(3 文件)——维护性,顺手做不单开
9. ✅ 台账清理（2026-10-31 完成）：`deferred-work.md` 已全线补标记，46 条中 0 条 open；SPEC.md Open Questions 的过期项已随 review 归档
10. 既有 deferred-work 4 项(V1 可执行验证/V2 skill 补步/B4/B10)保持 open

**spec 协商(冻结块,人属):**

11. V1——冻结块 4 处(matrix `:43`/task `:74`/Design Notes `:123`/triage B9 `:113`)仍断言「图标=目标视图」,与 553dbeb 交付相反;需你确认后改写并补 Spec Change Log

## Acceptance verdict

**accepted-with-open-items**(criteria: declared,人可推翻)

- CAP-1 即时切换 ✓(8933aa3 真机验证)
- CAP-2 双入口一致 ✓(8933aa3 验证 + 553dbeb 修复后四步矩阵复验——**注意:首次交付带语义缺陷,由维护者使用中发现**)
- CAP-3 持久化 ✓(刷新保持,真机验证)
- 无 pending stories(单一实现 spec status: done;completeness check 经 sprint-status 不可用路径,以 spec 状态代位,已声明)
- 开放项:deferred-work 4 项 + 本轮新增 defer 6 项 + fix-now 候选 4 组待执行

## Open questions（均已拍板，2026-10-19 回写）

- **切换钮语义**：定为「当前态」——card 态显示网格图标 +「卡片」，list 态显示列表图标 +「列表」，实现与 `SPEC` 已一致。
- **A5 移动端挤压**：不缩图不缩钮；切换入口保持 44×44px 图标按钮，空间不足时隐藏文字标签（`max-[768px]:hidden`），桌面/移动同位置。
