---
id: story-mobile-adaptation
type: story
title: "插件移动端体验重构（小屏适配）"
parent: none
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
---

# 插件移动端体验重构（小屏适配）

## Description

要解决的痛点：插件在安卓手机上把桌面形态硬塞进窄屏。四条横栏（见 `topbars-inventory.md`）里，第二顶栏「上一页／下一页／卡片·列表」的按钮文字溢出后折成两行；第三顶栏平台名「无线电广播」折行把整条栏撑高；第四顶栏「搜索歌单」被右边缘切掉且没有任何滚动提示。更麻烦的是根因未定——第二顶栏的文字本应在 490px 以下隐藏，实机却仍显示，说明宿站给手机浏览器的布局视口可能宽于手机物理宽度，使全套视口断点按"桌面"生效。受影响的用户就是拿手机点歌的人：他们看不到正常密度、也点不准入口，而桌面端（≥780px）观感完好，问题只在窄屏暴露。

## Requirements

Verify: 安卓实机 360/390/430px 三档宽度上，四条顶栏无一处溢出、折行或裁切，第二顶栏按钮内已无文字；完整点歌链路全程无被遮挡元素，且手感经 UX 评审判定优于现状；桌面端 1280px 与 780px 观感零变化；`npm run build` 通过。

Criteria (摘自 v6 SPEC 的 Capabilities):

1. **CAP-1** 用户在窄屏看到第二顶栏时，按钮内不再出现任何文字，整栏不横向溢出、不折行。 — 成功标准:安卓实机 360/390/430px 三档宽度下，第二顶栏无横向溢出、无多行文字，末位按钮右边缘不超出容器。
2. **CAP-2** 用户可在窄屏上通过图标辨识并使用四条顶栏的全部入口——音乐/视频/设置/关于、搜索、翻页、视图切换、平台切换、子分类切换。 — 成功标准:每个入口在窄屏下都有可点击的图标；现为纯文字的平台名与子分类项在窄屏也有可辨识的图标形态（可辨识性判据由 UX 评审定案）。
3. **CAP-3** 用户可经由跨栏重组后的顶栏完成与现在完全相同的一批操作，栏数或控件位置与桌面端不同也不影响可达性。 — 成功标准:窄屏完成一次完整点歌链路（呼出 → 选平台 → 选子分类 → 搜索 → 翻页/换视图 → 点播）的点击数不高于当前版本，且全程无元素被遮挡或裁切。
4. **CAP-4** 用户在窄屏上点击任一入口都不会误触相邻入口。 — 成功标准:每个可点击目标的命中区不小于 44×44 CSS px（或经 UX 评审确认的等效下限），相邻目标间距 ≥8px。
5. **CAP-5** 用户在安卓实机上打开插件时看到的是窄屏形态，无论宿站给 iframe 的宽度与手机物理宽度是否一致。 — 成功标准:实机（安卓 Chrome）上四条顶栏呈现窄屏形态；实测记录的 iframe 宽度与手机物理宽度不一致时，形态仍正确。
6. **CAP-6** 用户在窄屏浏览结果与设置、关于页时内容不被裁切或横向溢出。 — 成功标准:安卓实机 360px 宽下，卡片视图、列表视图、设置页、关于页均无横向溢出与元素裁切；超长标题以截断呈现而非折行撑破布局。

## References

- plan — _bmad-output/backlog/refactor-mobile-adaptation-plan.md
- spec (v6, archived) — _bmad-output/initiative-iirose-media-web/archive-v6/spec-mobile-adaptation/SPEC.md
- retrospective — _bmad-output/backlog/story-mobile-adaptation-retrospective.md
- companion — _bmad-output/backlog/mobile-adaptation-.memlog.md
- companion — _bmad-output/backlog/mobile-adaptation-DESIGN.md
- companion — _bmad-output/backlog/mobile-adaptation-EXPERIENCE.md
- companion — _bmad-output/backlog/mobile-adaptation-topbars-inventory.md

## Notes

- Decision: 2026-11-06 由 v6 迁入,状态 done,不重新打开。
- Assumption: 安卓实机宽度落在 360–430 CSS px 区间；iframe 宽度可能与之一致，也可能不一致——后者正是 CAP-5 要处理的场景。
- Assumption: 图标字形继续取自 `@mdi/font` 7.3.67 并沿用自包含注册方式。
- Assumption: 真机凭据可用（`.secrets/iirose-test-account.txt` 已存在），UX 评审可在本轮规划内完成。 <!-- Open Questions 已全部裁决，结论落在 DESIGN.md / EXPERIENCE.md，此处不再保留待决列表。 -->
