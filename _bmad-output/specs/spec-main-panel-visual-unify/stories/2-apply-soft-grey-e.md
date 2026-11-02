---
title: '落实柔灰视觉（E）与卡片、列表、加载空状态'
type: 'feature'
created: '2026-10-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'd773576e7c72a7b97dabddbfa0e95321d4a012c6'
context:
  - '{project-root}/_bmad-output/specs/spec-main-panel-visual-unify/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-main-panel-visual-unify/visual-language.md'
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 用户从原型中选定了 E（柔灰），但它目前只是工作区里未提交的原型：靠 `window.iirosemedia.setAccentVariant` 与 a–g 多套变体类叠加实现，代码重复、依赖 Tailwind 变体顺序；深色主题下内容区卡片仍是旧样式。

**Approach:** 以工作区现有原型为起点，把 E 落实为唯一的正式样式：浅色主题用品牌强调、柔灰底、顶部品牌光晕、白卡片、封面裁切与时长胶囊；深色主题中性天蓝并同样完成卡片/列表/状态的深色样式；删除原型切换机制与其余变体。

## Boundaries & Constraints

**Always:** 浅色主题（`data-imw-theme="light"`）：主面板底色 `#eef1f6`；顶部四行背后品牌色约 16% 向下渐隐的光晕（只在顶部区域）；强调色 = 当前平台品牌色，经根节点 CSS 变量下发（`--imw-accent`），选中导航、选中分段、悬停/按压淡色、搜索框聚焦描边、收藏开启态、播放按钮、空状态图形与文字、加载转圈都用它；品牌色作填充且白字对比不足 4.5:1 时（例如 rgb(100,149,237)、rgb(150,171,188)）自动与黑色混合压深后再用，文字用途同样保证可读；卡片为 `#fff` + black/8 描边 + `rounded-xl` + 轻阴影，标题 14px semibold `#253047`、作者 12px 次要色；视频封面（B 站及其他视频来源）16:9、音乐封面方形，均 `object-cover` 裁切填满无黑边，加载失败沿用现有回退；时长为封面右下角深色半透明胶囊，空值不渲染；播放为品牌色实心按钮（白字），选集/选歌为品牌色描边次要按钮；列表行与卡片同语言；深色主题（`dark`）：底色 `#242a34`，强调色天蓝，不出现品牌色光晕或品牌色填充，卡片为深色次级表面（如 `white/[0.04]`）+ `white/10` 描边，文字用深色令牌，播放按钮天蓝；两套主题下文字与控件对比清晰；卡片网格行保持 `max-content`，按钮不被裁切；所有点击行为、aria、标题提示、收藏星标、选集流程不变；颜色一律经 `floating-panel` 令牌或 `--imw-accent`，不硬写品牌色；删除 `setAccentVariant`（含 `Environment.ts` 类型与 `index.tsx` 注册）、`data-imw-accent-variant`、`app.css` 中 `imw-acc`/`imw-va..vg` 等原型变体钩子与对应类名，最终代码中不残留 a–d、f、g 的样式；无变体参数的默认渲染即 E（浅色）/中性（深色）。

**Never:** 不改设置页、关于页内部（story 3）；不改布局约定尺寸；不改浮窗（播放进度、收藏随机，仍为天蓝）；不新增依赖、SCSS；不借用宿站 `mdi-*` 类。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 浅色网易云 | 搜索音乐结果 | 柔灰底、红色强调与顶部红色淡光晕、白卡片、方形封面裁切 | N/A |
| 浅色 B 站 | 首页推荐 | 粉色强调与光晕、16:9 封面无黑边、时长胶囊 | 封面加载失败走现有回退 |
| 浅色浅品牌色 | 无线电（rgb(100,149,237)） | 填充色被压深，白字对比 ≥4.5:1 | N/A |
| 深色任意平台 | 宿站深色 | 中性底、天蓝强调、无品牌光晕、深色卡片 | N/A |
| 列表视图 | 切到列表 | 行与卡片同语言，按钮完整 | N/A |
| 空状态/加载 | 未搜索 / 加载中 | 浅色品牌色、深色天蓝 | N/A |
| 原型清理 | 调用 `setAccentVariant` | 不存在；代码中无 `data-imw-accent-variant` | N/A |

</frozen-after-approval>

## Code Map

- 起点：当前工作区未提交的原型（16 个文件）。`git diff d773576` 可见全部原型改动；E 的实现散布在带 `imw-ve`/`imw-vef`/`imw-vefg` 等变体前缀的类里，A–D、F、G 的类需删除。
- `src/app.css` -- 原型变体钩子（`imw-acc`、`imw-va..vg` 及组合）需删除；保留 `imw-dark`、`hov`。
- `src/page/MainAppControlLayer.tsx` / `src/page/MainAppContainer.tsx` -- `--imw-accent` 与 `--imw-brand` 的计算与写入（保留并改为无变体条件：浅色 = 压深后的品牌色，深色 = 天蓝）。
- `src/page/index.tsx`、`src/environment/Environment.ts` -- `setAccentVariant` 注册与类型（删除）。
- `src/page/MainApp.tsx` -- 底色与顶部光晕。
- `src/page/components/floating-panel/floatingPanel.tsx` -- `themed*` 令牌；主面板强调相关令牌改为基于 `--imw-accent`，浮窗常量与外观不变。
- `src/page/components/navigationBar/main/MainNavigationBar.tsx`、`mediaContainerBar/{MediaSearchBar,PlatformSelector,MediaContainerSubNavBar}.tsx` -- 顶部四行的强调色。
- `src/page/components/media-card-container/{MediaCard,MediaCardImg,MediaCardInfo,MediaCardButton,MediaCardMessage,MediaListRow,FavoriteStarButton}.tsx` -- 卡片、封面、时长、按钮、列表行、空状态与加载。
- 测试：`topRows.test.ts`、`MainAppControlLayer.test.ts` 等既有用例按新类名调整；新增卡片/列表/强调色与压深函数的单测。

## Tasks & Acceptance

**Execution:**
- [x] 强调色计算 -- 浅色品牌色（含压深函数，单测覆盖对比度）、深色天蓝，经 `--imw-accent` 下发 -- CAP-2
- [x] 顶部四行与底色/光晕 -- 去掉变体前缀，E 成为默认浅色，深色中性 -- CAP-1/2
- [x] 卡片、列表行、封面、时长、按钮、空状态与加载 -- 浅深两套 -- CAP-3
- [x] 清除原型切换机制与其余变体 -- 代码中无残留 -- 收尾
- [x] 单测 -- 覆盖 I/O 矩阵；既有测试全部通过 -- 回归

**Acceptance Criteria:**
- Given 真站 1280×720 与 400×800、浅色与深色、网易云搜索结果与 B 站首页推荐、卡片与列表视图，when 打开主面板，then 与原型 E 截图一致（浅色）、深色中性天蓝，无横向溢出、按钮完整。
- Given 改动完成，when 运行 `npm test`、`npm run build`、改动文件 `prettier --check`，then 全部通过；`grep -r setAccentVariant src` 无结果。

## Implementation Notes

- 实现：以原型为起点落实 E，删除 setAccentVariant 与全部原型变体；强调色拆为 `--imw-accent`（填充：仅压深到白字 ≥4.5:1，网易云保持原色）与 `--imw-accent-ink`（浅底/色调上的文字与图标：对 #eef1f6 叠 26% 强调色 ≥4.5:1），深色均为 sky-500；品牌色单一来源 `DEFAULT_BRAND`，按输入缓存；移除无消费者的 context.color。
- 审查修补：见 Review Triage Log；一度把对比度规则同时作用于填充导致全平台变深（网易云成深酒红），已拆分两变量恢复 E 观感。
- 真机（主会话）：浅色 B 站首页推荐与网易云，`--imw-accent` = rgb(221,28,4)、`--imw-accent-ink` = rgb(164,21,3)，观感与原型 E 一致；单实例。
- 验证：`npm test` 703 通过，`npm run build` 通过，prettier 通过；`grep setAccentVariant src` 无结果。

## Spec Change Log

## Review Triage Log

| # | 来源 | 发现 | 判定 | 依据 / 去向 |
|---|------|------|------|------|
| 1 | BH | 强调色文字画在光晕与 /10 色调上，实际对比约 3.4:1 | medium | 只对 #eef1f6 校验；patch：按最深实际背景校验 |
| 2 | BH/EC | `parseColor` 格式窄、静默回退蓝色 | low | patch：支持 #rgb 与空格 rgb，回退告警 |
| 3 | BH/EC | 品牌色查找三处重复、context.color 已无消费者 | low | patch：单一来源，移除死字段 |
| 4 | BH | 每次更新都重算 readableAccent | low | patch：按输入缓存 |
| 5 | BH/VG | 品牌色写入根节点 `--imw-brand` 无测试 | medium | patch：挂载与切换平台/分类用例 |
| 6 | BH | 空 `playList` 也被当成视频封面 | low | patch：非空判定 + 直播用例 |
| 7 | BH | 加载态按钮手写强调色类 | low | patch：用共享令牌 |
| 8 | VG/BH | 列表行内联收藏星的主题类无测试 | medium | patch：补用例 |
| 9 | BH | 深色白字在 sky-500 实底上约 2.8:1 | low | 与浮窗主按钮一致；记入 visual-language 已知限制，defer |
| 10 | BH | visual-language 悬停/次级表面仍写 sky | low | 主会话已更新文档 |
| 11 | BH | 封面、按钮、搜索框仍是 div 无键盘可达 | low | 既有问题非本 story 引入，驳回 |
| 12 | EC | rgba 半透明品牌色未合成 | low | 现有品牌色均不透明，驳回 |
| 13 | EC | 切换分类瞬间可能用旧平台下标取色（一帧） | low | 驳回 |
| 14 | EC | 结果网格中的设置卡在深色下仍为旧样式 | — | story 3 范围 |
| 15 | VG | 旧浏览器无 color-mix 时色调退化为实色 | low | Tailwind v4 标准输出，驳回 |

## Verification

**Commands:**
- `npm test` -- expected: 全部通过
- `npm run build` -- expected: 构建成功
- `npx prettier --check <改动文件>` -- expected: 通过
- `grep -rn "setAccentVariant\|imw-accent-variant\|imw-va\b" src` -- expected: 无结果
