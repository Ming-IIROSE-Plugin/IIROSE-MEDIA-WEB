---
id: SPEC-mobile-adaptation
companions:
  - topbars-inventory.md
  - DESIGN.md
  - EXPERIENCE.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# 插件移动端体验重构（小屏适配）

## Why

**要解决的痛点**：插件在安卓手机上把桌面形态硬塞进窄屏。四条横栏（见 `topbars-inventory.md`）里，第二顶栏「上一页／下一页／卡片·列表」的按钮文字溢出后折成两行；第三顶栏平台名「无线电广播」折行把整条栏撑高；第四顶栏「搜索歌单」被右边缘切掉且没有任何滚动提示。更麻烦的是根因未定——第二顶栏的文字本应在 490px 以下隐藏，实机却仍显示，说明宿站给手机浏览器的布局视口可能宽于手机物理宽度，使全套视口断点按"桌面"生效。受影响的用户就是拿手机点歌的人：他们看不到正常密度、也点不准入口，而桌面端（≥780px）观感完好，问题只在窄屏暴露。

## Capabilities

- **CAP-1**
  - **intent:** 用户在窄屏看到第二顶栏时，按钮内不再出现任何文字，整栏不横向溢出、不折行。
  - **success:** 安卓实机 360/390/430px 三档宽度下，第二顶栏无横向溢出、无多行文字，末位按钮右边缘不超出容器。

- **CAP-2**
  - **intent:** 用户可在窄屏上通过图标辨识并使用四条顶栏的全部入口——音乐/视频/设置/关于、搜索、翻页、视图切换、平台切换、子分类切换。
  - **success:** 每个入口在窄屏下都有可点击的图标；现为纯文字的平台名与子分类项在窄屏也有可辨识的图标形态（可辨识性判据由 UX 评审定案）。

- **CAP-3**
  - **intent:** 用户可经由跨栏重组后的顶栏完成与现在完全相同的一批操作，栏数或控件位置与桌面端不同也不影响可达性。
  - **success:** 窄屏完成一次完整点歌链路（呼出 → 选平台 → 选子分类 → 搜索 → 翻页/换视图 → 点播）的点击数不高于当前版本，且全程无元素被遮挡或裁切。

- **CAP-4**
  - **intent:** 用户在窄屏上点击任一入口都不会误触相邻入口。
  - **success:** 每个可点击目标的命中区不小于 44×44 CSS px（或经 UX 评审确认的等效下限），相邻目标间距 ≥8px。

- **CAP-5**
  - **intent:** 用户在安卓实机上打开插件时看到的是窄屏形态，无论宿站给 iframe 的宽度与手机物理宽度是否一致。
  - **success:** 实机（安卓 Chrome）上四条顶栏呈现窄屏形态；实测记录的 iframe 宽度与手机物理宽度不一致时，形态仍正确。

- **CAP-6**
  - **intent:** 用户在窄屏浏览结果与设置、关于页时内容不被裁切或横向溢出。
  - **success:** 安卓实机 360px 宽下，卡片视图、列表视图、设置页、关于页均无横向溢出与元素裁切；超长标题以截断呈现而非折行撑破布局。

## Constraints

- 手机端四条顶栏尽量图标化；纯文字项（第三栏平台名、第四栏子分类）也须给出窄屏图标形态。可识别性方案未定案前，不得以"把文字删掉"作为完成标准。
- 允许跨栏重组：四条横栏不必原样保留，平台选择与子分类可合并、翻页与视图切换可移位；桌面端结构不受此授权影响。
- 窄屏形态的判定不得只依赖 `max-[490px]` 视口断点——已报告实机宽度与手机物理宽度不一致，判定须基于插件实际可用宽度。
- 图标一律自包含：元素 id 或类名 + `src/app.css` 的 `::before` content 与 `font-family:"md"`，禁止借用宿站 `mdi-*` 类。
- 卡片网格与列表行的高度必须保持 `max-content` 等效的自适应约束，任何新布局不得让动作按钮被 `overflow:hidden` 裁切。
- 样式一律 Tailwind v4 任意值类；不新增 SCSS、不新增依赖、不引入测试设施。
- 桌面端（≥780px）四条顶栏的结构与交互不得重构，桌面端只承受共享组件不可避免的改动。
- 真机验证按 `.opencode/skills/iirose-plugin-verify/` 流程执行，须覆盖 360/390/430 三档宽度及至少一档横屏。
- 只改插件自身：不动宿站元素与样式，不动 systemd、隧道等环境配置。

## Non-goals

- 不重构桌面端（≥780px）的四条顶栏结构与交互。
- 不为移动端新增独立功能（新搜索维度、新播放能力、新平台）。
- 不引入第三方 UI 组件库与构建期新插件。
- 不修改宿站（iirose）页面来换取适配效果。
- 不重做设置页的数据结构与设置项语义，只处理其在窄屏的呈现。

## Success signal

安卓实机 360/390/430px 三档宽度上，四条顶栏无一处溢出、折行或裁切，第二顶栏按钮内已无文字；完整点歌链路全程无被遮挡元素，且手感经 UX 评审判定优于现状；桌面端 1280px 与 780px 观感零变化；`npm run build` 通过。

## Assumptions

- 安卓实机宽度落在 360–430 CSS px 区间；iframe 宽度可能与之一致，也可能不一致——后者正是 CAP-5 要处理的场景。
- 图标字形继续取自 `@mdi/font` 7.3.67 并沿用自包含注册方式。
- 真机凭据可用（`.secrets/iirose-test-account.txt` 已存在），UX 评审可在本轮规划内完成。

<!-- Open Questions 已全部裁决，结论落在 DESIGN.md / EXPERIENCE.md，此处不再保留待决列表。 -->
