---
id: DESIGN-mobile-adaptation
status: final
version: 1.0.0
updated: 2026-10-12
tokens:
  colors:
    primary:
      netease: "rgb(221, 28, 4)"
      joox: "rgb(24, 209, 106)"
      radio: "rgb(100, 149, 237)"
      bilibili: "rgb(209, 79, 118)"
      allvideo: "rgb(1, 77, 103)"
      settings: "rgb(150, 171, 188)"
    neutral:
      background_overlay: "rgba(224, 224, 224, 0.85)"
      surface_card: "rgba(255, 255, 255, 0.92)"
      button_translucent: "rgba(255, 255, 255, 0.22)"
      button_dark_translucent: "rgba(0, 0, 0, 0.45)"
      text_main: "#1f2937"
      text_muted: "#6b7280"
      text_white: "#ffffff"
  typography:
    font_family_base: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font_family_icon: "'md'"
    sizes:
      xs: "11px"
      sm: "13px"
      base: "15px"
      lg: "18px"
      icon_nav: "24px"
      icon_compact: "20px"
  rounded:
    pill: "9999px"
    card: "12px"
    button: "8px"
    avatar: "50%"
  spacing:
    touch_min: "40px"
    gap_tight: "6px"
    gap_normal: "10px"
    gap_loose: "16px"
    padding_bar_mobile: "8px 12px"
---

# 插件移动端 UI 视觉设计规范 (DESIGN.md)

## Brand & Style

本插件作为注入 https://iirose.com/ 宿站的高集成媒体点播工具，移动端 UI 视觉延续桌面版的扁平磨砂与动态主题色基调，但在手机小屏环境下全面拥抱**“图标化优先、高信息密度、极低视觉噪点”**的移动交互美学。

- **视觉语调**：清爽、克制、自适应平台主色。
- **排版原则**：窄屏视口内坚决摒弃非必要的长文本标签，依靠高识别度 MDI 图标（Material Design Icons）与微动效传递功能语义。
- **空间感知**：通过自适应容器弹性约束，保障 360px ~ 430px 各档安卓/iOS 设备上的零溢出与舒适呼吸感。

---

## Colors

根据当前激活媒体平台动态切换顶栏背景基色，保障视觉与上下文一致：

- **网易云音乐**：`rgb(221, 28, 4)`（网易红）
- **JOOX 音乐**：`rgb(24, 209, 106)`（JOOX 翡翠绿）
- **无线电广播**：`rgb(100, 149, 237)`（矢车菊蓝）
- **哔哩哔哩**：`rgb(209, 79, 118)`（小电视粉）
- **多源剧集**：`rgb(1, 77, 103)`（深海青）
- **通用半透白色胶囊**：`rgba(255, 255, 255, 0.22)`
- **通用暗色半透胶囊**：`rgba(0, 0, 0, 0.45)`

---

## Typography & Icons

- **正文与标题**：系统级等宽/抗锯齿无衬线字体，字号梯度控制在 11px（辅助元信息）至 15px（列表歌曲主标题）。
- **图标系统**：自包含 `@mdi/font` 7.3.67（`font-family: "md"`），严禁借用宿站动态类。
  - 主导航图标：`24px`，确保 40px+ 触控命中区。
  - 功能操作图标（翻页、搜索、切换）：`20px ~ 22px`。
  - 列表行动作按钮图标：`18px ~ 20px`。

---

## Layout & Spacing

### 顶栏高度与分层重组
桌面端的四条顶栏（主导航、搜索栏、平台选择器、子分类栏）在移动端合并精简为**两条紧凑栏 + 一条自适应子分类滑动条**：

1. **主控栏（Row 1 - 40px）**：
   - 左侧：返回宿站按钮（BackIcon，40×40px 点击热区）。
   - 右侧：主导航项（音乐 / 视频 / 设置 / 关于），40×40px 纯图标按钮排布，紧密相连无间距（gap: 0），与桌面端一体化视觉保持一致。
2. **操作与分页栏（Row 2 - 40px）**：
   - 左侧：视图切换胶囊（卡片/列表，36×36px 方圆药丸，带 `mr-auto`）。
   - 右侧：搜索胶囊（紧凑展开型，未搜索时呈放大镜胶囊，搜索后呈单行截断文本）与分页控件药丸（当前页/总页数 `1/20`，前后翻页钮），与桌面端一致统一靠右紧凑排列。
3. **平台选择器（Row 3 - 36px）**：
   - 采用长方形形态（36px 高度），按钮紧密相连无间隙（gap: 0），保留品牌 Logo 与平台名称文本（12px），与主导航栏、子分类栏保持一致的紧凑分段视觉，拒绝圆形截断与分散胶囊。
   - 保持水平单行滚动（`overflow-x: auto; no-scrollbar`）。
4. **子分类导航条（Row 4 - 32px）**：
   - 保持水平单行滚动（`overflow-x: auto; whitespace: nowrap`）。
   - 右侧边缘覆盖 16px 渐变遮罩（`mask-image: linear-gradient(...)`），为用户提供清晰的“可继续滑动”视觉暗示。

---

## Components

### 1. 移动端搜索栏按钮 (MediaSearchBar Buttons)
- **纯图标化**：所有移动端视口（容器宽度 ≤ 768px）**无条件隐藏「上一页」、「下一页」、「卡片/列表」文字**，仅渲染图标。
- **按钮尺寸**：统一为 `36×36px` 圆角药丸或胶囊，内部 padding 居中对齐，消除任何文字折行可能。
- **排布**：搜索框统一靠右，与分页控件紧邻排列（左侧视图切换钮通过 `mr-auto` 吃满空白）。

### 2. 平台选择器选项卡 (PlatformSelector Tabs)
- 移动端采用紧凑相连的长方形形态（gap: 0），显示 Logo（24×24px）与平台名称文字（`text-xs`），禁止使用圆形 `rounded-full` 与独立胶囊间距。
- 激活态通过白色高亮底色对比凸显。

### 3. 列表结果行 (MediaListRow) 移动端挤压重构 (A5 解决)
- **封面**：统一缩为 `56×56px` 圆角矩形（为歌名争取宽度）。
- **右侧动作按钮组**：
  - 由原先 128px 宽的文字按钮收缩为 **80px（两颗 36×36px 图标按钮：播放 + 添加）**。
  - 中间标题与歌手信息区域宽度释放近 50px，配合 `text-ellipsis` 在 360px 极端宽度下依然优雅呈现。

---

## Do's and Don'ts

### Do
- ✅ 移动端顶栏按钮内一律**不放汉字文本**，保持纯图标或数字指示。
- ✅ 触控区域必须保证最小 40×40px（视觉尺寸可为 32px，外扩 padding）。
- ✅ 横向滚动区域右端必须加渐变视觉暗示。
- ✅ 所有关键交互动画施加 `duration-100!`，对抗全局 `transition: all .5s`。

### Don't
- ❌ 严禁使用硬编码的 `max-[490px]` 单一视口断点来决定移动端布局。
- ❌ 严禁在窄屏下让多项文字折成两行撑破顶栏高度。
- ❌ 严禁让列表行右侧按钮区挤压歌曲标题到无法辨识的程度。
