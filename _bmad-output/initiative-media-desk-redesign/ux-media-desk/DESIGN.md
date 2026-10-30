---
name: 点歌台 Media Desk
status: final
updated: 2026-10-30T20:11:02+00:00
description: 蔷薇花园（iirose.com）房间点歌台——嵌入宿站 iframe 的全幅叠加面板，以及与它同一套视觉的插件浮窗。暖纸色与墨色、细线分层、唯一识别色蔷薇红；平台色只做来源小圆点。
sources:
  - .memlog.md
  - imports/mock-v1/mock.html
colors:
  # 浅色（mock `.light`；ink3 按用户决策加深到 AA）
  paper: '#F5F2EC'
  rail: '#EDE8DF'
  sheet: '#FBFAF7'
  ink: '#1C1916'
  ink2: '#5F5850'
  ink3: '#6B655D'               # 设计稿 #9A9187，向 ink 混合 37%
  rule: '#E2DCD1'
  rose: '#B42F3E'
  hover: '#EFEBE3'
  thumb: '#E6E0D6'
  star-on: '#A17822'            # 设计稿 #C9962B，压暗 20%，图形 ≥3:1
  deck-thumb-ring: '#BC445159'  # 进度拖柄外环：#BC4451（rose 提亮 10%）35% 不透明
  skeleton: '#E6E0D6'           # 骨架条/块，与 thumb 同值
  cover-ring: '#0000000F'       # 封面内环 rgba(0,0,0,.06)
  focus-ring: '#1C1916'         # 焦点环外圈 = ink
  key-border: '#D3CBBE'         # 键位提示 kbd 描边：比 rule 深一档
  muted-fill: '#6B655D'         # 暗淡填充（= ink3）：已停止的批量点播进度条
  menu-shadow: '#1C19161F'      # 下拉浮层投影色：ink 12%（0 10px 30px）
  toast-shadow: '#0000002E'     # 面板提示条投影色：黑 18%（0 6px 20px），不随主题变化
  # 深色（mock `.dark`）
  paper-dark: '#141312'
  rail-dark: '#0F0E0D'
  sheet-dark: '#1C1A18'
  ink-dark: '#EDE7DD'
  ink2-dark: '#A79E92'
  ink3-dark: '#8F887E'          # 设计稿 #6E665D，向 ink-dark 混合 26%
  rule-dark: '#2B2825'
  rose-dark: '#E3606C'          # 蔷薇红文字、细线、进度填充（不变）
  rose-fill-dark: '#BA4F59'     # 承载白字的蔷薇红实底；rose-dark 压暗 18%
  hover-dark: '#201E1C'
  thumb-dark: '#262320'
  deck-thumb-ring-dark: '#E3606C59'  # rose-dark 35%
  skeleton-dark: '#262320'      # = thumb-dark
  cover-ring-dark: '#FFFFFF0A'  # 深色封面/视频缩略图内环 rgba(255,255,255,.04)
  focus-ring-dark: '#EDE7DD'    # = ink-dark
  star-on-dark: '#C9962B'
  key-border-dark: '#45403A'
  muted-fill-dark: '#8F887E'    # = ink3-dark
  menu-shadow-dark: '#00000080' # 深色加深一档才看得出层次：黑 50%
  # 不随主题变化
  on-rose: '#FFFFFF'             # 也用作进度拖柄圆点
  source-netease: '#D7371F'
  source-bilibili: '#E1608C'
  source-radio: '#4F7FD6'       # 设计稿未出现电台来源点，取值来自任务约定
  source-multi: '#2E9A86'       # 多源剧集：青绿，与网易云红、B站粉、电台蓝区分
  duration-pill: '#0C0B0AB8'    # rgba(12,11,10,.72)，视频时长胶囊底，字色 {colors.on-rose}
  video-scrim: '#0A090861'      # rgba(10,9,8,.38)，视频悬停遮罩
typography:
  # 字体栈：设计稿用 Noto Sans SC / Noto Serif SC / JetBrains Mono；插件内不加载网络字体，回退系统字体（见正文）
  display-title:
    fontFamily: '"Songti SC", "SimSun", serif'
    fontSize: 30px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.02em
  display-title-phone:
    fontFamily: '"Songti SC", "SimSun", serif'
    fontSize: 26px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.02em
  eyebrow:
    fontFamily: 'ui-monospace, "SF Mono", monospace'
    fontSize: 11px
    letterSpacing: 0.18em
    note: 'uppercase，{colors.ink3}'
  search-query:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 17px
  search-query-phone:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 16px
    note: '设计稿 15.5px；改 16px 防 iOS 聚焦放大'
  label-strong:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 14px
    fontWeight: '600'
    note: '搜索按钮、选中的范围标签'
  label:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 14px
    fontWeight: '400'
    note: '范围标签（未选中）、来源切换器（500）、操作条选项'
  row-title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 15px
    fontWeight: '500'
  row-meta:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 12.5px
    note: '歌手行'
  row-meta-source:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 13px
    note: '曲目表出处列'
  button-sm:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 13px
    note: '点播按钮、模式开关、分页文字'
  video-title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.45'
    note: '最多两行'
  video-title-phone:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.45'
  video-meta:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 12px
  video-meta-phone:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 11px
  deck-title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 15px
    fontWeight: '600'
  deck-title-mini:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 14px
    fontWeight: '600'
  deck-label:
    fontFamily: 'ui-monospace, "SF Mono", monospace'
    fontSize: 10px
    letterSpacing: 0.2em
    note: 'uppercase，65% 不透明度（浅色 sheet 上 5.32:1，达 AA）；只用于手机展开的底部条（桌面底部条已去掉标签行）'
  nav-label:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 11.5px
    letterSpacing: 0.04em
    note: '竖栏项'
  nav-label-tab:
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 11px
    letterSpacing: 0.04em
    note: '底部标签栏；选中 600'
  # 数字：系统界面字体 + tabular-nums（每位等宽、列对齐，字形正常）。等宽栈在 Windows 落到 Consolas/宋体，小字号又细又散（用户反馈）
  num:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 13px
    note: 'font-variant-numeric: tabular-nums（所有 num-* 同）；序号、桌面时长、页码、曲目数、选集序号徽章'
  num-sm:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 12px
    note: '手机时长、进度时间、批量进度「已发 / 总数」'
  num-pill:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 11.5px
    fontWeight: '500'
    note: '视频时长胶囊、「直播」徽章'
  num-caption:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 11px
    letterSpacing: 0.08em
    note: '表头、结果计数、内页曲目数'
  # 字母标签仍用等宽（眉题 eyebrow、底部条标签 deck-label 见上）
  mono-key:
    fontFamily: 'ui-monospace, "SF Mono", monospace'
    fontSize: 11px
    note: '键位提示 kbd（`/`、`Enter`），无字距，tabular-nums'
rounded:
  # 五档（用户决策：由设计稿十种圆角收敛）；full 仅用于胶囊按钮与圆点，不算圆角档位
  xs: 6px        # kbd 键位提示、视频时长胶囊、曲目表封面、台标（原 7）
  sm: 8px        # 手机/迷你条封面、分页按钮、底部条封面（原 8/9）
  md: 10px       # 来源切换器、搜索按钮、模式开关、视图分段控件、选集主按钮（原 10/11）
  lg: 12px       # 竖栏项、关闭按钮、视频缩略图、行悬停底、手机点播按钮、品牌标、设置组卡、关于卡、音乐网格封面
  xl: 16px       # 搜索栏（桌面/手机，原 15/16）、迷你条、底部条（原 18）、浮窗、选集面板、操作条外框
  full: 9999px   # 桌面点播按钮、「点播到房间」胶囊、来源圆点
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  gutter-desktop: 36px      # 页头、搜索栏、范围行、内容区左右边距
  gutter-phone: 16px        # 手机搜索栏与列表左右边距（页头与范围行 20px）
  rail-width: 84px
  touch-min: 44px           # 手机端所有可点目标的最小点击区
components:
  # 约定：组件里只写浅色令牌的引用，深色一律取同名 `-dark` 键（如 {colors.rule} → rule-dark）；
  # 只有映射不是「同名 -dark」时才显式写出深色值（如实底白字用 rose-fill-dark）。
  focus-ring:
    outline: '2px solid {colors.focus-ring}（深色 {colors.focus-ring-dark}）'
    offset: 2px
    on-rose-fill: '实底蔷薇红控件（send-button-hover/-phone 按下、mode-toggle-on、order-badge、「点播到房间」胶囊、settings-switch 开）：外圈同上，另加 2px {colors.paper} 内环（inset box-shadow；深色 {colors.paper-dark}）'
    on-deck: '底部条、迷你条与展开的底部条已改为 sheet 底，与其他表面同一外圈（不再有墨底反相例外）'
    radius: '跟随控件自身圆角'
    note: '仅 :focus-visible 显示；各表面对比见正文「对比度」'
  page-header:
    eyebrow: '{typography.eyebrow}，{colors.ink3}；桌面 `IIROSE · Media Desk`，手机 `Media Desk`'
    title: '{typography.display-title}（手机 {typography.display-title-phone}），{colors.ink}'
    close: '{components.close-button}，右对齐'
  rail:
    background: '{colors.rail}'
    border-right: '1px {colors.rule}'
    width: '{spacing.rail-width}'
  rail-item:
    width: 64px
    padding: '10px 0 8px'
    radius: '{rounded.lg}'
    icon: 22px
    typography: '{typography.nav-label}'
    foreground: '{colors.ink3}'
  rail-item-active:
    foreground: '{colors.ink}'
    background: '{colors.sheet}'
    ring: '0 0 0 1px {colors.rule}'
    indicator: '3px 竖条，{colors.rose}，贴竖栏左缘'
  brand-mark:
    size: 40px
    radius: '{rounded.lg}'
    background: '{colors.ink}'
    foreground: '{colors.paper}'
    note: '纯标识，无操作、无悬停态'
  close-button:
    size: 40px
    radius: '{rounded.lg}'
    border: '1px {colors.rule}'
    foreground: '{colors.ink2}'
  search-bar:
    height: 56px
    height-phone: 50px
    radius: '{rounded.xl}'
    background: '{colors.sheet}'
    border: '1px {colors.rule}'
    caret: '{colors.rose}'
    typography: '{typography.search-query}'
    typography-phone: '{typography.search-query-phone}'
  source-switcher:
    height: 42px
    height-phone: 38px
    radius: '{rounded.md}'
    background: '{colors.hover}'
    foreground: '{colors.ink}'
    dot: '7px 圆点，{colors.source-netease} / {colors.source-bilibili} / {colors.source-radio} / {colors.source-multi}（多源剧集）；收藏模式「全部」无圆点'
    chevron: '{colors.ink3}，16px；菜单展开时旋转 180°（200ms）'
    typography: '{typography.label}'
    padding: '0 12px（手机 0 10px），圆点与文字间距 8px（手机 6px）'
    note: '点击展开 {components.source-menu}；不用原生 select'
  source-menu:
    background: '{colors.sheet}'
    border: '1px {colors.rule}'
    radius: '{rounded.xl}'
    shadow: '0 10px 30px {colors.menu-shadow}（深色 {colors.menu-shadow-dark}）'
    padding: 6px
    min-width: '220px（手机 200px）'
    position: '切换器正下方 6px、左对齐'
    option: '行高 ≥ 40px（手机 ≥ {spacing.touch-min}），{rounded.md}，内边距 0 12px；7px 来源圆点 + 名称（{typography.label}，单行），间距 10px；无圆点的项（「全部」）留同宽空位对齐'
    option-rest: '{colors.ink2}'
    option-hover: '悬停底 {colors.hover}，按下底 {colors.thumb}'
    option-selected: '{colors.ink}，600，行尾 16px 打勾图标'
    enter: 'imwMenuIn 160ms（淡入并从上方 4px 落下）；减少动态效果时无动画'
    backdrop: '透明拦截层覆盖其余区域，点击 = 关闭菜单'
  search-submit:
    height: 42px
    radius: '{rounded.md}'
    background: '{colors.ink}'
    foreground: '{colors.paper}'
    typography: '{typography.label-strong}'
    padding: '0 18px'
  key-hint:
    radius: '{rounded.xs}'
    border: '1px {colors.key-border}（深色 {colors.key-border-dark}）'
    typography: '{typography.mono-key}'
    foreground: '{colors.ink3}'
    padding: '3px 7px'
    margin-right: '10px（与「搜索」按钮的间距）'
    content: '未聚焦且为空显示 `/`；聚焦且为空不显示；有内容显示 `Enter`'
    note: '仅桌面；手机不显示'
  scope-tab:
    typography: '{typography.label}'
    foreground: '{colors.ink3}'
    gap: 26px
    gap-phone: 22px
  scope-tab-active:
    foreground: '{colors.ink}'
    fontWeight: '600'
    underline: '2px {colors.ink}，压在范围行底线上；整行共用一条下划线，切换时滑到新标签（位置与宽度过渡 200ms），首次定位不滑'
    count: '{typography.num-caption}，{colors.ink3}'
  view-segmented:
    cell: '34×30px，图标 17px（手机 44×44px）'
    radius: '{rounded.md}'
    border: '1px {colors.rule}'
    foreground: '{colors.ink3}'
    active-background: '{colors.sheet}'
    active-foreground: '{colors.ink}'
    locked: '该范围只有一种视图：控件仍在原位，当前项照常显示选中，另一项 40% 不透明；两格 cursor not-allowed、无按下缩放；悬停提示「这里只有列表视图」/「这里只有网格视图」'
    note: '范围行与专辑/歌单内页头共用'
  pager-button:
    size: '30px（手机点击区 {spacing.touch-min}）'
    radius: '{rounded.sm}'
    border: '1px {colors.rule}'
    foreground: '{colors.ink2}'
    label: '{typography.num}，形如 01 / 28'
  tracklist-header:
    height: 34px
    typography: '{typography.num-caption}（uppercase）'
    foreground: '{colors.ink3}'
    columns: '同 tracklist-row；`#` · 标题 · 出处 · 时长'
    divider: '1px {colors.rule}'
    note: '手机不显示表头'
  tracklist-row:
    height: 62px
    columns: '38px 56px 1.6fr 1fr 74px 44px 96px'
    divider: '1px {colors.rule}'
    index: '{typography.num}，{colors.ink3}'
    cover: '42px，{rounded.xs}，底 {colors.thumb}，内环 inset 1px {colors.cover-ring}'
    title: '{typography.row-title}，{colors.ink}'
    artist: '{typography.row-meta}，{colors.ink2}'
    source-column: '{typography.row-meta-source}，{colors.ink3}'
    duration: '{typography.num}，{colors.ink2}'
  tracklist-row-hover:
    background: '{colors.hover}'
    radius: '{rounded.lg}'
    bleed: '左右各外扩 14px，底线隐去'
  tracklist-row-now-playing:
    index: '三根 3px 音柱（{colors.rose}）替换序号'
    title: '{colors.rose}'
    artist-suffix: '「· 房间正在播放」'
  tracklist-row-phone:
    height: 66px
    columns: '48px 1fr auto 40px'
    gap: 12px
    cover: '48px，{rounded.sm}'
  collection-row:
    columns: '同 tracklist-row（序号 · 封面 · 标题+作者 · 出处 · 曲目数 · 收藏星 · 查看）'
    count: '时长列改为曲目数（{typography.num}，{colors.ink2}，如「24 首」）；表头该列文案「曲目数」'
    title: '{typography.row-title}，{colors.ink}；标题本身是按钮（进内页），悬停下划线（offset 4px）'
    cover: '同 tracklist-row；封面可点进内页（读屏名「查看」）'
    view-pill: '点播按钮位换成「查看」描边胶囊：尺寸、圆角、描边、字色同 {components.send-button}，list 图标 14px +「查看」；悬停底 {colors.hover}、按下底 {colors.thumb}，**不转实心蔷薇红**（它不是点播）；手机为 40px 方钮只留图标'
    row-hover: '整行悬停底同 {components.tracklist-row-hover}，但桌面整行不可点——只有封面、标题、「查看」三处进入'
    phone: '手机同 tracklist-row-phone 结构，整行点按进入'
    note: '音乐 · 专辑/歌单范围与收藏里的专辑/歌单共用本行'
  collection-header:
    layout: '进入专辑/歌单后替换范围行：左「‹ 返回」文字钮（{components.text-button}，left 图标 16px，点击区高 {spacing.touch-min}）+ 名称（{typography.label-strong}，{colors.ink}，单行截断）+ 曲目数（{typography.num-caption}，{colors.ink3}，手机隐藏）；右侧依次为 {components.view-segmented}（列表/网格，可切）→ 分页（同 {components.pager-button}，多于一页才出现）→ {components.play-all-button}'
    divider: '底边 1px {colors.rule}'
    margin: '同范围行（桌面左右 {spacing.gutter-desktop}、上 18px；手机左右 20px、上 12px）'
    note: '下方为该专辑/歌单的曲目行（或网格视图下的 music-tile）'
  play-all-button:
    height: 32px
    padding: '0 14px'
    radius: '{rounded.full}'
    border: '1px {colors.rule}'
    foreground: '{colors.ink2}'
    icon: 'play 16px'
    typography: '{typography.button-sm}'
    hover: '**只在按钮自身悬停时**转实心（同 send-button-hover，深色 {colors.rose-fill-dark}）；悬停内页头其他位置不点亮'
    open: '顺序菜单打开期间按钮底 {colors.hover}'
    disabled: '同 send-button-disabled'
    note: '手机高 {spacing.touch-min}；不显示点播中/重试（整张的进度由 {components.batch-progress} 表达）'
  order-menu:
    background: '{colors.sheet}'
    border: '1px {colors.rule}'
    radius: '{rounded.xl}'
    desktop: '同 {components.source-menu} 的浮层样式：宽 200px，内边距 6px，阴影 0 10px 30px {colors.menu-shadow}（深色 {colors.menu-shadow-dark}），贴「全部播放」下方 8px、右对齐，imwMenuIn 160ms 展开'
    option: '桌面：行高 ≥ 40px，{rounded.md}，内边距 0 12px，图标 18px（{colors.ink2}）+ {typography.label}（{colors.ink}），间距 10px，悬停底 {colors.hover}、按下底 {colors.thumb}，无分隔线。手机：整宽行 ≥ {spacing.touch-min} 高，图标 22px，行间 1px {colors.rule}'
    items: '「正序播放」（sort 图标）·「乱序播放」（shuffle 图标）'
    phone: '底部操作条形态：sheet 底、顶边 1px {colors.rule}、{rounded.xl}；头部为专辑/歌单名（{typography.label-strong}）+ 曲目数（{typography.num-caption}，{colors.ink3}），底线 1px {colors.rule}；imwSheetRise 220ms 升起'
    backdrop: '透明拦截层，点击 = 取消'
    mount: '主面板内部最上层，同 action-sheet'
  send-button:
    height: 32px
    padding: '0 14px'
    radius: '{rounded.full}'
    border: '1px {colors.rule}'
    foreground: '{colors.ink2}'
    typography: '{typography.button-sm}'
  send-button-hover:
    background: '{colors.rose}（深色 {colors.rose-fill-dark}）'
    border: '同底色'
    foreground: '{colors.on-rose}'
  send-button-disabled:
    note: '房间不支持点播时：保持常态描边，40% 不透明度，无悬停实心态'
  send-button-pending:
    icon: '14px 转圈图标（spinner，持续旋转）替换 play 图标'
    label: '「点播中」（手机只有图标）'
    note: '不转实心、不响应点击，cursor wait，aria-busy；持续到第一条点播报文发出，随即回到常态。**没有「已点播」态**'
  send-button-failed:
    icon: '14px refresh 图标'
    label: '「重试」'
    foreground: '{colors.rose}（深色 {colors.rose-dark}）'
    motion: '左右轻晃一次（imwShake 360ms，±3px）'
    note: '停留 3 秒后回到常态；期间可点，点击即重试'
  send-button-phone:
    size: '40px（点击区 {spacing.touch-min}）'
    radius: '{rounded.lg}'
    border: '1px {colors.rule}'
    active-background: '{colors.rose}（深色 {colors.rose-fill-dark}）'
  favorite-star:
    size: '18px（点击区 32×32px）'
    foreground: '{colors.ink3}'
    active-foreground: '{colors.star-on}（深色 {colors.star-on-dark}）'
    pop: '仅用户亲手点亮的那一下弹跳（imwPop 260ms，放大到 1.3 再回落）；加载出来就已收藏的星不弹；减少动态效果时不弹'
  favorites-row:
    note: '收藏模式列表：歌曲与视频沿用 tracklist-row（含 hover / now-playing / phone 变体，视频封面位放 16:9 缩略图裁成方形填满）；专辑与歌单用 {components.collection-row}（曲目数 +「查看」）。可切网格视图（见 music-tile favorites-grid）'
  radio-station-row:
    note: '电台列表行：台标（封面位，{rounded.xs}）、台名（{typography.row-title}）、点播按钮（{components.send-button}）；分隔、悬停、正在播放态与 tracklist-row 一致'
  video-tile:
    aspect: '16:9'
    radius: '{rounded.lg}'
    placeholder: '{colors.thumb}'
    inner-ring: 'inset 1px {colors.cover-ring}'
    title: '{typography.video-title}（手机 {typography.video-title-phone}），两行截断'
    meta: '{typography.video-meta}（手机 {typography.video-meta-phone}），{colors.ink3}'
    grid: '桌面 4 列，间距 26px（行）× 22px（列）；手机 2 列，18px × 12px'
    note: 'MV 结果同样用本组件'
  video-tile-revealed:
    note: '无悬停的宽屏设备首次点按后，或卡内获得键盘焦点（:focus-within）时：外观同 video-tile-hover（遮罩 + 「点播到房间」胶囊），缩略图外加 {components.focus-ring} 同款 2px {colors.ink} 描边表示「已选中」（仅点按选中时；键盘焦点时由焦点环承担）'
  live-badge:
    background: '{colors.rose}（深色 {colors.rose-fill-dark}）'
    foreground: '{colors.on-rose}'
    radius: '{rounded.xs}'
    typography: '{typography.num-pill}'
    content: '「直播」'
    position: '占用时长胶囊的位置（右下角内缩 8px），直播卡不显示时长胶囊'
  music-tile:
    aspect: '1:1'
    radius: '{rounded.lg}'
    placeholder: '{colors.thumb}'
    inner-ring: 'inset 1px {colors.cover-ring}'
    title: '{typography.video-title}（手机 {typography.video-title-phone}），单行截断'
    meta: '{typography.video-meta}（手机 {typography.video-meta-phone}），{colors.ink3}；歌手 · 等宽时长'
    grid: '桌面 5 列，间距 22px × 22px；手机 3 列，16px × 12px'
    star: '{components.favorite-star}，桌面放在标题行右端；手机不显示（收藏经操作条）'
    hover: '同 video-tile-hover（遮罩 + 「点播」胶囊，胶囊外观同「点播到房间」）'
    pill-states: '同 video-tile-hover 的 pending / failed；收藏网格里的专辑/歌单卡胶囊文案为「查看」（进内页，不点播，房间不支持点播时也不灰化）'
    favorites-grid: '收藏的网格视图用本组件混排歌曲、视频、专辑/歌单（视频封面方形裁切）'
    now-playing: '封面左下角三根 3px 音柱（{colors.on-rose}，压在 {colors.duration-pill} 小底上），标题 {colors.rose}'
  duration-pill:
    background: '{colors.duration-pill}'
    foreground: '{colors.on-rose}'
    radius: '{rounded.xs}'
    typography: '{typography.num-pill}'
    position: '右下角内缩 8px'
  video-tile-hover:
    scrim: '{colors.video-scrim}'
    action: '「点播到房间」胶囊：高 38px，{rounded.full}，底 {colors.rose}（深色 {colors.rose-fill-dark}），字 {colors.on-rose} 13.5px 600'
    pending: '胶囊内 16px 转圈图标 +「点播中」，不响应点击；进行中与失败期间遮罩与胶囊保持可见（鼠标移开也看得到）'
    failed: '16px refresh 图标 +「重试」，左右轻晃一次（imwShake 360ms）'
    press: '按下缩到 96%（见 {components.motion}）'
  action-sheet:
    background: '{colors.sheet}'
    border-top: '1px {colors.rule}'
    radius: '{rounded.xl}（仅上两角）'
    header: '被操作条目的封面 + 标题 + 副行，同 tracklist-row-phone'
    option: '整行 ≥ {spacing.touch-min} 高，图标 22px + {typography.label}，{colors.ink}，行间 1px {colors.rule}'
    primary-option: '「点播到房间」：图标与文字 {colors.rose}（深色 {colors.rose-dark}）'
    backdrop: '覆盖主面板其余区域的透明拦截层（无颜色、无模糊），只用于「点外侧收起」'
    mount: '主面板内部最上层（随主面板出现），不另设 z-index 根'
  episode-picker:
    background: '{colors.sheet}'
    border: '1px {colors.rule}'
    radius: '{rounded.xl}'
    title: '{typography.label-strong}'
    row: '同 tracklist-row 结构（序号列 → 勾选/序号徽章，标题，时长），手机行高 ≥ {spacing.touch-min}'
    order-badge: '20px 圆角方块，底 {colors.rose}（深色 {colors.rose-fill-dark}），字 {colors.on-rose}，{typography.num}——显示点选顺序 1、2、3…'
    unselected: '20px 描边方块，1px {colors.rule}'
    order-control: '正序 / 乱序两段，外观同 view-segmented，与确认按钮同在吸底底栏'
    select-all: '标题行内（集数右侧）「全选」文字钮（{components.text-button}）；全部选中时文案变「取消全选」'
    layout: '桌面为浮层卡片，居中，宽 min(560px, 主区宽 − 2×{spacing.gutter-desktop})，最大高 min(640px, 80vh)；手机为底部抽屉（上两角 {rounded.xl}），最大高 85vh'
    header: '标题「选集」+ 等宽集数 + 右侧 {components.close-button}（点击 = 取消，不点播）'
    scroll: '只有列表区滚动；标题行与吸底底栏固定'
    backdrop: '透明拦截层，覆盖面板外区域，点击 = 取消；无颜色、无模糊'
    confirm: '主按钮「点播所选」：底 {colors.ink}，字 {colors.paper}，{rounded.md}（同 search-submit）；未选任何项时 40% 不透明、不可点'
  room-deck:
    height: 60px
    padding: '0 {spacing.gutter-desktop}'
    gap: 24px
    columns: '280px 1fr 260px'
    background: '{colors.sheet}'
    foreground: '{colors.ink}'
    top-rule: '顶边 1px {colors.rule}（用 0 -1px 0 阴影画，不占布局）；无圆角、无外边距，贴住面板底边'
    cover: '40px，{rounded.sm}'
    title: '{typography.deck-title}，单行截断'
    requester: '12px，60% 不透明度（「由你点播」/「某某 点播」）'
    label: '桌面不显示 `Now in room` 标签行（贴底细栏只留封面 + 标题 + 点播者）'
    progress-track: '3px 高，{colors.rule}，{rounded.full}'
    progress-fill: '{colors.rose}（深色 {colors.rose-dark}），{rounded.full}'
    progress-thumb: '12px {colors.rose}（深色 {colors.rose-dark}）圆点，外环 3px {colors.deck-thumb-ring}；平时隐藏，轨道悬停 / 键盘聚焦 / 按下时出现（手机常显）；仅可跳转时存在'
    time: '{typography.num-sm}，80% 不透明度'
    progress-hit-area: '可跳转时轨道上下各外扩至 {spacing.touch-min} 高的点击/拖动区'
    hidden: '设置、关于两页在桌面不显示（手机迷你条照常）'
    note: '与面板同色系的贴底细栏，取代旧版 78px 墨底反相悬浮卡（用户：又粗又大、压迫、挡路）'
  room-deck-live:
    note: '直播/电台流（无总时长）：中栏不画进度轨与拖柄，改为居中的 {components.live-badge}（文字「直播」）+ 等宽已播时长（{typography.num-sm}）；不可跳转'
  room-deck-idle:
    note: '房间无播放：封面位 {colors.thumb} 底 + 音符图标，标题位「房间暂时安静」，无点播者行、无进度轨；模式开关照常显示'
  mini-deck:
    height: 58px
    padding: '0 16px'
    background: '同 room-deck（{colors.sheet} 底 + 顶边 1px {colors.rule}），贴底、无圆角、无左右外边距'
    cover: '44px，{rounded.sm}'
    title: '{typography.deck-title-mini}'
    progress-line: '顶边 3px：轨道 {colors.rule}、填充 {colors.rose}（深色 {colors.rose-dark}）；仅显示，不可拖动；直播/电台流时不画'
    button: '44×44px 纯图标 {components.mode-toggle}，{rounded.lg}'
  room-deck-expanded:
    note: '手机点迷你条主体后展开的完整底部条：从迷你条位置向上展开（压在标签栏之上），全宽、上两角 {rounded.xl}，{colors.sheet} 底 + 顶边 1px {colors.rule}；三行——①封面 50px + {typography.deck-label} 标签（{colors.rose} 圆点 + `Now in room`）+ 标题 + 点播者 + 右上角收起箭头（chev 朝下，点击区 {spacing.touch-min}）②等宽当前时间 · 进度轨（同 room-deck，拖柄常显，点击/拖动区 {spacing.touch-min}）· 等宽总时长 ③两个 {components.mode-toggle-sheet} 各占一半，间距 10px。动效：展开从底部升起（260ms，缓动 cubic-bezier(.2,.8,.2,1)），收起先向下滑出（200ms）再卸载；面板整体关闭时直接卸载；减少动态效果时改为淡入淡出。顶边另加向上柔和投影（deskDeckSheetShadow）与列表分层'
  mode-toggle:
    height: '32px（手机 {spacing.touch-min}；迷你条为 44×44 纯图标）'
    padding: '0 10px'
    gap: 6px
    radius: '{rounded.md}'
    typography: '{typography.button-sm}'
    border: '1px {colors.rule}'
    foreground: '{colors.ink2}'
    hover: '悬停底 {colors.hover}，按下底 {colors.thumb}'
  mode-toggle-on:
    background: '{colors.rose}（深色 {colors.rose-fill-dark}）'
    border: '同底色'
    foreground: '{colors.on-rose}'
  mode-toggle-sheet:
    note: '手机展开底部条里的模式开关（描边方框在浅色底板上太硬，用户反馈不协调）'
    height: '{spacing.touch-min}'
    radius: 'full（胶囊）'
    border: '无'
    background: '{colors.hover}'
    foreground: '{colors.ink2}'
    layout: '图标 17px + 文字居中'
    on: '蔷薇红淡底（浅色 rose 10%、深色 rose-dark 15%）+ {colors.rose} 字，600'
    disabled: '40% 不透明度'
  bottom-tab-bar:
    height: 82px
    columns: 5
    border-top: '1px {colors.rule}'
    background: '{colors.paper}'
    item: '22px 图标 + {typography.nav-label-tab}，{colors.ink3}'
    item-active: '{colors.rose}（深色 {colors.rose-dark}），600'
  floating-window:
    background: '{colors.sheet}'
    foreground: '{colors.ink}'
    border: '1px {colors.rule}'
    radius: '{rounded.xl}'
    accent: '{colors.rose}；实底承载白字时深色用 {colors.rose-fill-dark}'
    note: '播放进度浮窗与收藏随机选择面板改用本令牌，取代 floating-panel 现行天蓝强调色与 themed* 配色'
  state-message:
    typography: '{typography.label}'
    foreground: '{colors.ink2}'
    layout: '结果区内水平居中，距结果区顶 72px（手机 48px）；可跟一个 text-button，间距 12px'
  text-button:
    typography: '{typography.label-strong}'
    foreground: '{colors.rose}（深色 {colors.rose-dark}）'
    hit-area: '高 {spacing.touch-min}，左右内边距 12px'
    note: '「重试」「清除搜索」「‹ 返回」等文字钮；无底色、无描边，hov: 下划线'
  skeleton-row:
    height: '同 tracklist-row（手机同 tracklist-row-phone）'
    cover: '同封面位尺寸，{colors.skeleton}'
    bars: '标题条 8px 高 × 40% 宽、副行条 6px × 24%，{rounded.full}，{colors.skeleton}'
    divider: '1px {colors.rule}'
  skeleton-tile:
    note: '16:9（音乐网格为 1:1）{colors.skeleton} 色块 + 下方两根 {colors.skeleton} 条，圆角同所替代的卡片'
  settings-group:
    background: '{colors.sheet}'
    border: '1px {colors.rule}'
    radius: '{rounded.lg}'
    title: '组名（现有平台分组名，如「哔哩哔哩视频」）{typography.label-strong}，{colors.ink2}，卡片上方 8px'
    note: '一组设置为一张卡，卡内若干 settings-row；卡与卡间距 24px；卡片放在 {colors.paper} 上'
  settings-row:
    height: '≥ 56px（手机 ≥ {spacing.touch-min}）'
    padding: '0 16px'
    divider: '1px {colors.rule}（最后一行无）'
    icon: '20px 内联 SVG，{colors.ink3}'
    label: '{typography.label}，{colors.ink}'
    value: '{typography.label}，{colors.ink2}，右对齐，单行截断；可选项行末加 {colors.ink3} 右向 chev'
    hover: 'hov: 下整行 {colors.hover} 底'
    destructive: '危险操作（清空云端、忘记本机密钥）标签与值仍用 {colors.ink}/{colors.ink2}，不用蔷薇红'
  settings-switch:
    track: '36×20px，{rounded.full}'
    off: '轨道 {colors.sheet} 底 + 1.5px {colors.ink3} 描边，圆钮 14px {colors.ink3}'
    on: '轨道 {colors.rose}（深色 {colors.rose-fill-dark}），圆钮 14px {colors.on-rose}'
    hit-area: '整行可点；开关本身点击区 {spacing.touch-min}'
  about-card:
    background: '{colors.sheet}'
    border: '1px {colors.rule}'
    radius: '{rounded.lg}'
    layout: '卡内为 settings-row 列表，条目沿用现有关于数据（作者、项目源代码地址、投喂我、赞助列表）；不新增条目'
    link: '外链行的值用 {colors.rose}（深色 {colors.rose-dark}）文字 + 外链图标，不用 emoji'
  notice:
    note: '错误与设置类提示走宿站提示层（ShowMessage.show → window._alert）；点播成功与即时确认走面板内 {components.desk-toast}；文案见 EXPERIENCE.md Voice'
  desk-toast:
    background: '{colors.ink}（深色 {colors.ink-dark}）'
    foreground: '{colors.paper}（深色 {colors.paper-dark}）'
    radius: '{rounded.full}'
    padding: '8px 16px'
    typography: '{typography.label}，单行截断'
    shadow: '0 6px 20px {colors.toast-shadow}'
    position: '结果区底边上方 12px、水平居中（面板内部，压在底部条 / 迷你条之上）'
    motion: '出现 imwRiseIn 200ms；约 2 秒后淡出并下移 8px（200ms）；新提示直接替换旧的'
  batch-progress:
    width: '320px（手机左右各 12px 内缩、全宽）'
    position: '页面右下角：桌面右 24px、底 80px（让出底部条）；手机底 84px（让出标签栏）；多张卡纵向堆叠、间距 8px'
    layer: '挂在页面 body 上（z 90008：高于主面板 90000、低于选集面板 90010），点播面板关闭后仍在'
    background: '{colors.sheet}'
    border: '1px {colors.rule}'
    radius: '{rounded.xl}'
    shadow: '0 10px 30px {colors.menu-shadow}（深色 {colors.menu-shadow-dark}）'
    padding: '12px 16px 14px'
    header: '16px 图标（进行中 send、完成 check；进行中 {colors.ink2}，结束 {colors.ink3}）+ 标题（{typography.label-strong}，单行截断）+ 右侧按钮'
    stop-button: '进行中：「停止」描边小按钮，高 28px，内边距 0 10px，{rounded.md}，1px {colors.rule}，{colors.ink2}，{typography.button-sm}；悬停底 {colors.hover}'
    close-button: '结束后：28px 关闭图标钮（close 14px，{colors.ink3}）'
    bar: '4px 高，轨道 {colors.rule}、{rounded.full}；填充 {colors.rose}（深色 {colors.rose-dark}），宽度过渡 300ms；已停止时填充 {colors.muted-fill}；准备中为 1/3 宽的蔷薇红条来回流动（imwIndeterminate 1.2s）'
    count: '{typography.num-sm}，{colors.ink2}，形如「23 / 130」'
    motion: '出现 imwRiseIn 200ms；收起时淡出并下移 8px（200ms）'
  motion:
    durations: 'fast 120ms（悬停、按下、颜色）· base 200ms（淡入淡出、切换、下划线滑动）· slow 280ms（升起的层）——CSS 变量 --imw-fast / --imw-base / --imw-slow'
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)（--imw-ease，起步快、收尾柔）'
    baseline: '面板内元素默认只过渡 color、background-color、border-color、outline-color、opacity、box-shadow、scale，时长 fast；宽高与位置不在默认过渡里（布局变化不会被拖着「飘」），需要时组件显式声明'
    press: '小控件按下缩到 96%（active:scale-[.96]），松开回弹'
    keyframes: 'imwRiseIn（从下方 8px 淡入，200ms）· imwMenuIn（从上方 4px 落下，160ms）· imwSheetRise / imwSheetFade（操作条、选集抽屉升起）· imwShake（失败晃动 ±3px，360ms）· imwPop（收藏星弹跳到 1.3，260ms）· imwIndeterminate（不确定进度，1.2s 循环）'
    reduced-motion: 'prefers-reduced-motion 时去掉缩放与位移类动画，只保留淡入淡出'
---

## Brand & Style

点歌台是房间里的一张「点歌单」，不是又一个音乐 App。它要在几秒内把歌或视频送进房间，其余时间安静地退到一边。视觉姿态是**纸面与墨**：浅色是暖纸色底、墨色字，深色是暖炭黑；层次靠细线和底色深浅，不靠阴影和卡片。页标题用宋体，是全局唯一的「编辑感」时刻；数字（序号、时长、页码、进度）一律用表格数字（每位等宽、上下对齐），读起来像一张排好版的曲目单。

唯一的识别色是**蔷薇红**，呼应站名「蔷薇花园」，只用来表示「点播」这个动作和「房间正在放」这个状态。平台品牌色退居为来源切换器里的一颗小圆点。

插件的两个浮窗（播放进度、收藏随机选择）、选集面板、手机操作条、来源与顺序下拉菜单、面板提示条和批量点播进度卡，与主面板用同一套令牌，看起来出自同一处。动效克制：只在状态变化处出现，三档时长、同一条缓动曲线（`{components.motion}`）。

本设计不受宿站现有风格约束（用户授权），也不得有抄袭感或 AI 模板感：不用渐变光斑、毛玻璃、紫色、emoji 图标，也不用千篇一律的白卡加大阴影。

**设计稿**：构图参考为 `imports/mock-v1/`（索引见 [ux-media-desk.md](ux-media-desk.md)）。→ 参考：[mock.html](imports/mock-v1/mock.html)（设计稿源文件：浅/深色令牌、布局、组件样式、图标 symbol）· [overview.png](imports/mock-v1/overview.png)（四帧总览：桌面/手机 × 浅/深）。**设计稿与本文件或 EXPERIENCE.md 冲突时，以两份规格为准**（已知偏离：ink3、star-on、圆角档位、手机搜索字号 16px）。

## Colors

两套主题，键名一一对应，深色在键名后加 `-dark`。组件只引用浅色键，深色按同名 `-dark` 取值；唯一的显式例外是承载白字的蔷薇红实底（`rose-fill-dark`）。底部条已改为 sheet 底的贴底细栏，不再有专用的反相色键。主题跟随宿站（见 EXPERIENCE.md），不提供独立开关。

→ 参考：[frame-1.png](imports/mock-v1/frame-1.png)（浅色色板实况）· [frame-2.png](imports/mock-v1/frame-2.png)（深色色板实况；其中的底部条是旧版悬浮卡，现行底部条以 `components.room-deck` 为准）。

- **Paper（`{colors.paper}` / `{colors.paper-dark}`）**：主内容区底色，暖纸色 / 暖炭黑。
- **Rail（`{colors.rail}`）**：桌面竖栏底，比纸色深一档，靠这一档色差和一条细线与内容区分开。
- **Sheet（`{colors.sheet}`）**：抬起的面——搜索栏、选中的竖栏项、视图分段控件的选中格、底部条与迷你条（两种主题）、浮窗、选集面板、操作条、下拉菜单、批量点播进度卡。
- **Ink / Ink2 / Ink3**：三级文字。Ink 用于标题与主文字；Ink2 用于歌手、时长、次要按钮字；Ink3 用于未选中导航、表头、出处、眉题等辅助信息。为满足 AA，Ink3 由设计稿值加深（浅 `#9A9187 → #6B655D`，深 `#6E665D → #8F887E`），paper、rail、sheet、hover 四种底色上全部 ≥ 4.5:1，**可承载任何文字**。代价是 Ink2 与 Ink3 明度更接近（浅色两者相差 1.22:1），层级更多依靠字号与位置区分。
- **Rule（`{colors.rule}`）**：所有分隔线、描边。整套界面的层级主要靠它。
- **Rose（`{colors.rose}` / `{colors.rose-dark}`）**：唯一强调色。用于：点播按钮的悬停/按下实心态、「点播到房间」胶囊、正在播放的序号音柱与标题、竖栏选中指示条、手机标签栏选中项、模式开关点亮态、进度填充、搜索栏光标、选集序号徽章、操作条首选项。**不用于**装饰、平台识别或错误提示。
- **Rose fill dark（`{colors.rose-fill-dark}`）**：深色主题下**承载白字的蔷薇红实底**（点播实心态、模式开关点亮、「点播到房间」胶囊、选集序号徽章）。`rose-dark` 本身留给蔷薇红文字、指示条与进度填充——它在深色底上作文字是达标的，但白字压在它上面只有 3.41:1。浅色主题的 `rose` 两种用途都达标，不需要分开。
- **Hover（`{colors.hover}`）**：行悬停底、来源切换器常态底。
- **Thumb（`{colors.thumb}`）**：封面与缩略图加载前、加载失败时的占位底；无播放时底部条的封面位。占位图标用 ink2（thumb 上 5.34:1）；**thumb 上不放 ink3 文字**（4.39:1）。
- **Skeleton / Cover ring / Deck thumb ring（`{colors.skeleton}`、`{colors.cover-ring}`、`{colors.deck-thumb-ring}`）**：原先裸写的半透明值收成令牌，组件一律引用。底部条的进度轨、模式开关描边直接用 `{colors.rule}`，进度填充用 `{colors.rose}`。
- **Key border（`{colors.key-border}`）**：键位提示 kbd 的描边，比 rule 深一档，深色下也看得出是一个按键。
- **Muted fill（`{colors.muted-fill}`）**：暗淡填充（= ink3），只用于已停止的批量点播进度条。
- **Menu shadow / Toast shadow（`{colors.menu-shadow}`、`{colors.toast-shadow}`）**：浮在内容之上的临时浮层（下拉菜单、批量进度卡、面板提示条）的投影色，见 Elevation & Depth。
- **Focus ring（`{colors.focus-ring}`）**：焦点环外圈，取 ink（深色 ink-dark）；用法见 `components.focus-ring`。
- **平台来源点**：网易云 `{colors.source-netease}`、哔哩哔哩 `{colors.source-bilibili}`、电台 `{colors.source-radio}`、多源剧集 `{colors.source-multi}`（青绿，与红、粉、蓝区分）。只做 7px 圆点，**从不整片铺色**；深色主题同样不融入平台品牌色（沿用前轮用户结论）。
- **Star-on**：已收藏的星标。浅色压暗为 `#A17822` 以达到图形 3:1；深色保持设计稿 `#C9962B`。
- **Duration pill / Video scrim**：视频缩略图上的半透明黑底，保证白字在任何封面上可读。

设计稿中定义但未使用的 `rosetint` 已删除。

**底部条不再反相**：旧版浅色主题下底部条是墨底纸字的悬浮卡，用户反馈「又粗又大、压迫、挡路」，已改为与面板同色系的贴底细栏（sheet 底 + 顶边 rule 细线，两种主题一致）。进度填充因此直接用 `rose`，不再需要提亮色。

### 对比度（WCAG 2.x，按调整后令牌实测）

文字需 4.5:1（AA 常规字），图形与界面部件需 3:1。

| 组合 | 浅色 | 深色 | 要求 | 结论 |
| --- | --- | --- | --- | --- |
| ink / paper · rail · sheet · hover | 15.66 · 14.34 · 16.77 · 14.72 | 15.09 · 15.68 · 14.11 · 13.51 | 4.5 | 通过 |
| ink2 / paper · rail · sheet · hover | 6.27 · 5.74 · 6.71 · 5.89 | 7.02 · 7.30 · 6.57 · 6.29 | 4.5 | 通过 |
| **ink3 / paper · rail · sheet · hover** | **5.16 · 4.72 · 5.52 · 4.85** | **5.29 · 5.50 · 4.95 · 4.74** | 4.5 | 通过（原 2.54–2.97 / 2.94–3.42） |
| rose 文字 / paper · rail · sheet · hover | 5.50 · 5.04 · 5.89 · 5.17 | 5.44 · 5.65 · 5.09 · 4.87 | 4.5 | 通过（深色为 `rose-dark`） |
| **白 / 蔷薇红实底** | 6.15（`rose`） | **4.83（`rose-fill-dark`）** | 4.5 | 通过（深色原 3.41） |
| `rose-fill-dark` 实底 / sheet-dark · paper-dark（部件边界） | — | 3.59 · 3.84 | 3 | 通过 |
| 底部条点播者行（ink 60% / sheet） | 4.53 | 5.82 | 4.5 | 通过 |
| 底部条时间（ink 80% / sheet） | 8.98 | 9.39 | 4.5 | 通过 |
| 展开的底部条 `Now in room` 标签（ink 65% / sheet） | 5.32 | > 5.12 | 4.5 | 达标（2026-10-30 由 55% 提到 65%；55% 时浅色仅 3.88） |
| 模式开关常态字（ink2 / sheet） | 6.71 | 6.57 | 4.5 | 通过 |
| 进度填充 / 底部条底（rose / sheet） | 5.89 | 5.09（`rose-dark` / sheet-dark） | 3 | 通过 |
| 面板提示条（paper / ink 底） | 15.66 | 15.09 | 4.5 | 通过 |
| 已停止进度填充 / 轨道（muted-fill / rule） | 4.22 | 4.18 | 3 | 通过 |
| **收藏星 / paper · rail · sheet · hover** | **3.60 · 3.29 · 3.85 · 3.38** | 6.96 · 7.24 · 6.51 · 6.24 | 3 | 通过（浅色原 2.38） |
| 白 / 时长胶囊（最坏情况：白色封面） | 8.16 | 8.16 | 4.5 | 通过 |
| **焦点环外圈 / paper · rail · sheet · hover** | 15.66 · 14.34 · 16.77 · 14.72（`focus-ring`） | 15.09 · 15.68 · 14.11 · 13.51（`focus-ring-dark`） | 3 | 通过 |
| 焦点内环 / 蔷薇红实底 | 5.50（paper / `rose`） | 3.84（paper-dark / `rose-fill-dark`） | 3 | 通过 |
| 开关关态描边与圆钮 / sheet | 5.52（ink3） | 4.95（ink3-dark） | 3 | 通过 |
| 开关开态轨道 / sheet | 5.89（`rose`） | 3.59（`rose-fill-dark`） | 3 | 通过 |
| 占位图标 / thumb | 5.34（ink2） | 5.92（ink2-dark） | 3 | 通过 |
| ink3 文字 / thumb | 4.39 | 4.46 | 4.5 | **不达标 → 规则：thumb 上不放 ink3 文字** |
| bilibili 来源点 / hover | 2.82 | — | 3 | 不独立承载信息：来源点旁总有平台文字（见 Components 收藏列表），豁免 |
| 进度填充 / 进度轨（rose / rule） | 4.50 | 4.30 | 3 | 通过 |
| 键位提示描边 / sheet（key-border） | 1.54 | 1.69 | — | 装饰：kbd 内文字（ink3）承载信息；豁免 |
| rule / paper（分隔线） | 1.22 | 1.27 | — | 装饰线，不承担信息；豁免 |

承载信息的文字组合已全部达标（最后一处 `Now in room` 标签已由 55% 提到 65%，浅色 5.32）。低于 3:1 的其余组合都是装饰性的：`rule` 分隔线、键位提示描边，以及始终配文字的来源圆点。

## Typography

三种角色：

- **页标题（宋体）**：`{typography.display-title}`，桌面 30px、手机 26px，700。每屏只出现一次，内容为当前模式名（音乐页为「点歌台」）。
- **界面（黑体）**：其余所有文字。
- **数字（系统界面字体 + 表格数字）**：`{typography.num}` / `num-sm` / `num-pill` / `num-caption`，`tabular-nums`——每位等宽、列对齐，字形是正常的无衬线体。序号、时长、页码、进度时间、批量进度计数、结果计数、表头、视频时长胶囊、选集序号徽章。早先用等宽字体栈，Windows 上落到 Consolas / 宋体一类，小字号又细又散、冒号两侧发空（用户反馈难看），故改。
- **字母标签（等宽）**：眉题 `{typography.eyebrow}`、底部条标签 `{typography.deck-label}`、键位提示 `{typography.mono-key}` 仍用等宽。

**字体回退**：设计稿用思源黑体（Noto Sans SC）、思源宋体（Noto Serif SC）与 JetBrains Mono；插件内**不加载网络字体**，回退系统字体——黑体 `"PingFang SC", "Microsoft YaHei", sans-serif`，宋体 `"Songti SC", serif`，数字 `-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial` 再接黑体，等宽（仅字母标签）`ui-monospace, "SF Mono", monospace`。〔已确认 来自 memlog：不加载网络字体。〕Windows 上的宋体回退项 `SimSun` 是按「宋体」字面补的系统字体名。

字号阶梯（设计稿原值，手机搜索词除外）：30 / 26（标题）· 17 / 16（搜索词；手机由设计稿 15.5 改为 16，防 iOS 聚焦放大）· 15（行标题、底部条标题）· 14（标签、按钮、视频标题、操作条选项）· 13（出处、点播按钮、模式开关、序号、时长）· 12.5 / 12（歌手、视频作者、进度时间）· 11.5 / 11 / 10（导航、表头、眉题、底部条标签）。

规则：

- 眉题、表头、底部条标签用等宽大写加宽字距（0.14–0.2em），只装英文或数字（`IIROSE · Media Desk`、`Now in room`、`#`）。
- 中文不加字距、不斜体（设计稿把 `<i>` 的斜体显式去掉）。
- 长标题单行截断出「…」；视频标题最多两行。

## Layout & Spacing

基础刻度 4px：4 / 8 / 12 / 16 / 20 / 24，另有命名间距。

**桌面（> 768px）**：两列网格——左侧 `{spacing.rail-width}` 竖栏 + 右侧主区。主区四行：页头（眉题 + 标题 + 关闭）→ 搜索栏 → 范围行（范围标签 · 视图切换 · 分页）→ 内容（唯一可滚动区）→ 底部条。主区左右边距 `{spacing.gutter-desktop}`；底部条贴住面板底边、全宽，内容左右同样 `{spacing.gutter-desktop}`（设置、关于两页桌面不显示底部条）。

**曲目表**（音乐、收藏、电台共用结构）：七列 `38px 56px 1.6fr 1fr 74px 44px 96px`——序号、封面、标题+歌手、出处、时长、收藏星、点播按钮；行高 62px，表头 34px。电台行只用到其中的台标、台名与点播列。

**视频网格**：桌面 4 列、手机 2 列，16:9 缩略图，无卡片框。MV 与直播结果同样用视频网格。

**视图切换**：音乐单曲（含首屏「最近点播」）、视频、收藏与专辑/歌单内页都可在列表与网格间切换；收藏网格与内页网格用方形卡。只有一种视图的范围（专辑/歌单范围、电台为列表，MV 为网格）切换控件仍在原位、灰色锁定。

**音乐网格**（音乐模式切到网格视图时）：`{components.music-tile}`，1:1 方形封面，桌面 5 列、手机 3 列。

→ 参考：[frame-1.png](imports/mock-v1/frame-1.png)（桌面曲目表：七列、表头、悬停行、正在播放行）· [frame-2.png](imports/mock-v1/frame-2.png)（桌面视频 4 列网格）。

**手机（≤ 768px，`max-[768px]`）**：单列纵向——页头 → 搜索栏 → 范围行（第一行为可横向滚动的标签区，第二行左为视图切换、右为分页）→ 列表（唯一滚动区）→ 迷你条 → 底部标签栏。搜索栏与列表左右 `{spacing.gutter-phone}`，页头与范围行 20px。曲目行四列 `48px 1fr auto 40px`：封面、标题+歌手、时长、点播按钮；手机端不显示序号、出处、收藏星（收藏经操作条）；点播按钮保留为一键点播，点行的其他区域弹出操作条。

**操作条（手机）**：从视口底部升起，宽度占满，压在迷你条与标签栏之上；挂在主面板内部、作为面板内最上层。

**展开的底部条（手机）**：点迷你条主体后，迷你条原位向上展开为 `{components.room-deck-expanded}`，压在标签栏之上、列表之上。

**批量点播进度卡**：挂在页面上而不是面板里——桌面右下角（底部条上方），手机在标签栏上方；关掉点播面板仍在。

→ 参考：[frame-3.png](imports/mock-v1/frame-3.png)（手机浅色：曲目行四列、迷你条、底部标签栏）· [frame-4.png](imports/mock-v1/frame-4.png)（手机深色：视频 2 列网格、深色迷你条）。

断点统一 `max-[768px]`；宿站 iframe 有 1.13–1.19 倍缩放，见 EXPERIENCE.md「宿站嵌入约束」。

## Elevation & Depth

几乎不用阴影。层级来源依次是：底色档位（rail < paper < sheet）与 1px `{colors.rule}` 细线。

设计稿中仅有的阴影都是「细线的替身」：

- 选中竖栏项：`0 0 0 1px {colors.rule}` 外环。
- 底部条与迷你条：`0 -1px 0 {colors.rule}` 顶边细线（两种主题）。
- 搜索栏：`0 1px 0 rgba(0,0,0,.02)`，几乎不可见（不承载信息，保留裸值）。
- 封面与缩略图：`inset 0 0 0 1px {colors.cover-ring}`（深色取 `cover-ring-dark`），防止浅色封面与纸色融在一起。
- 进度拖柄：3px `{colors.deck-thumb-ring}` 外环。

浮层（浮窗、选集面板、操作条）也按此处理：sheet 底 + 1px rule 描边。

**唯一的投影例外**——浮在内容之上、会自行消失的临时浮层，需要一点投影才能和下面的内容分开：

- 下拉菜单（`source-menu`、桌面 `order-menu`）与批量点播进度卡（`batch-progress`）：`0 10px 30px {colors.menu-shadow}`（深色 `menu-shadow-dark`，加深一档才看得出层次）。
- 面板提示条（`desk-toast`）：`0 6px 20px {colors.toast-shadow}`。

其余一律不用投影式卡片阴影，也不用模糊背景。

## Shapes

五档圆角，按「元素越大越圆」递增：

| 档位 | 值 | 用于 |
| --- | --- | --- |
用途清单以 frontmatter `rounded` 注释为准（唯一来源），此处只说规律：小件（键位、胶囊、小封面）取 `xs`/`sm`，控件取 `md`，行与卡取 `lg`，大面与浮层取 `xl`。

胶囊形（`{rounded.full}`）不算档位，只给两种「点播」按钮（桌面曲目行点播按钮、视频/音乐网格「点播到房间」）、开关轨道、骨架条和圆点。

封面与缩略图裁切填满容器、跟随容器圆角，**不留黑边**（沿用前轮用户结论）。

## Components

数值一律以 frontmatter `components.*` 为准；本节只写构图与状态关系，括号内为组件键。行为（何时出现、点击后果、互斥）见 EXPERIENCE.md Component Patterns。

所有图标为自包含内联 SVG（设计稿 `<symbol>`：note、film、radio、star、starf、gear、info、search、chev、left、right、play、send、list、grid、repeat、shuffle、close、mark，另补 check、spinner、refresh、sort 等），描边 1.6–1.9，`currentColor` 着色。

**动效（`motion`）**：三档时长 fast 120ms / base 200ms / slow 280ms，统一缓动 `cubic-bezier(0.2, 0.8, 0.2, 1)`；默认只过渡颜色、透明度、阴影与缩放，宽高位置不过渡。小控件按下缩到 96%；范围标签共用一条下划线滑动；结果区换页 / 换范围 / 换视图 / 新结果到达时从下方 8px 淡入；收藏星只在用户点亮时弹跳；下拉菜单落下、操作条升起。减少动态效果时去掉缩放与位移。

- **竖栏（`rail` / `rail-item` / `rail-item-active`）**：顶部品牌标（`brand-mark`，纯标识），下列音乐、视频、电台、收藏；弹性空白；底部设置、关于。选中项抬到 sheet 底加细线环，左缘一根蔷薇红竖条；选中项文字仍是 ink。
- **页头（`page-header`）**：等宽眉题 + 宋体页标题（当前模式名）+ 右侧描边关闭按钮（`close-button`）。
- **搜索栏 + 来源切换器（`search-bar` / `source-switcher` / `search-submit` / `key-hint`）**：一个整体。左端来源切换器 → 竖分隔线 → 放大镜 + 输入区（光标蔷薇红）→ 键位提示 → 墨底「搜索」按钮。键位提示与「搜索」按钮之间留 10px，未聚焦显示 `/`、聚焦且为空不显示、有内容显示 `Enter`。手机端只保留来源切换器（简称）+ 输入区。
- **来源菜单（`source-menu`）**：点来源切换器展开的插件自有下拉浮层（不用原生 select——其展开样式由系统决定，深色下是白底蓝条）。sheet 底、细线、`xl` 圆角、柔和投影；每项来源圆点 + 名称，当前项加粗并打勾，悬停淡底；展开时从上方 4px 落下，箭头翻转。
- **范围标签（`scope-tab` / `scope-tab-active`）**：文字标签行，无底色；选中项墨色下划线压在行底线上（整行一条，切换时滑过去），可附结果数。电台模式此行为地区标签。进入专辑/歌单后此行替换为 `collection-header`。
- **视图分段控件（`view-segmented`）** 与 **分页（`pager-button`）**：在范围行右侧（手机为范围行第二行）。视图切换常驻：只有一种视图时灰色锁定、不消失。内页头同样有视图切换。
- **曲目表（`tracklist-header` + `tracklist-row`）**：状态——
  - 常态：细线分隔，点播按钮（`send-button`）为描边胶囊（play 图标 +「点播」）。
  - 点播中（`send-button-pending`）：转圈 +「点播中」，不可再点，直到第一条点播报文发出即恢复——没有「已点播」态。
  - 失败（`send-button-failed`）：refresh 图标 +「重试」蔷薇红字，左右轻晃一下，3 秒后恢复。
  - 悬停（`tracklist-row-hover`）：整行 hover 底、外扩、底线隐去；点播按钮转 `send-button-hover` 实心蔷薇红。
  - 房间正在播放（`tracklist-row-now-playing`）：序号换音柱，标题蔷薇红，歌手后缀文字。
  - 不可点播（`send-button-disabled`）：点播按钮 40% 不透明、无实心态。
  - 手机（`tracklist-row-phone` + `send-button-phone`）：40px 圆角方钮只有箭头图标。
  - → 参考：[frame-1.png](imports/mock-v1/frame-1.png)（桌面）· [frame-3.png](imports/mock-v1/frame-3.png)（手机）。
- **专辑 / 歌单行（`collection-row`）** 与 **专辑/歌单内页头（`collection-header`）**：同曲目行结构，时长列换曲目数，末列为「≡ 查看」描边胶囊（悬停只淡底、不转蔷薇红——它不是点播）；标题悬停下划线、封面可点。内页头：‹ 返回 + 名称 + 曲目数，右侧视图切换 → 分页 → 描边胶囊「全部播放」（`play-all-button`，只在自身悬停时转实心）；点后弹出 `order-menu`（正序播放 / 乱序播放），桌面为与来源菜单同款的落下浮层，手机为底部升起的操作条。
- **音乐网格卡（`music-tile`）**：方形封面，无卡片框；悬停同视频卡遮罩，胶囊同样有点播中 / 重试态。收藏网格与内页网格也用它；收藏里的专辑/歌单卡胶囊为「查看」。设计稿未出此视图，按视频卡推导。
- **收藏列表（`favorites-row`）**：歌曲与视频与曲目行同构，专辑与歌单用 `collection-row`；可切网格。出处列为「来源圆点 + 平台-类型」（如「网易云-歌单」），圆点不单独承载信息。
- **电台行（`radio-station-row`）**：台标 + 台名 + 点播按钮，其余同曲目行。
- **收藏星（`favorite-star`）**：空心星 ink3；已收藏为实心 star-on。只在用户亲手点亮时弹跳一下。
- **视频卡（`video-tile` / `duration-pill` / `video-tile-hover` / `video-tile-revealed`）**：无卡片框。16:9 缩略图右下角等宽时长胶囊；下方两行标题、一行 UP 主。悬停或被选中/聚焦时覆遮罩与居中「▶ 点播到房间」胶囊。MV 同此组件；直播卡把时长胶囊换成 `live-badge`。→ 参考：[frame-2.png](imports/mock-v1/frame-2.png)（桌面深色网格，含悬停态）· [frame-4.png](imports/mock-v1/frame-4.png)（手机 2 列）。
- **操作条（`action-sheet`，手机）**：sheet 底、上两角圆角、顶部细线；顶部一行条目摘要，下列选项「点播到房间」（蔷薇红）、「收藏」/「取消收藏」、「选集」。外侧为透明拦截层。设计稿未出，按令牌推导。
- **选集面板（`episode-picker`）**：插件自有浮层，sheet 底、细线描边。标题行（「选集」+ 集数 + 关闭）固定，列表行沿用曲目行结构；左列未选为描边方块、选中为蔷薇红实底序号徽章；标题行有「全选」文字钮；吸底底栏放「正序 / 乱序」与「点播所选」。手机为底部抽屉。设计稿未出，按令牌推导。
- **底部条（`room-deck`，桌面）**：与面板同色的 60px 贴底细栏（sheet 底 + 顶边细线，无圆角无外边距）。三栏——左：40px 封面 + 标题 + 点播者；中：时间 · 3px 进度轨（拖柄悬停 / 聚焦时才出现）· 总时长；右：两个浅色描边模式开关。不显示 `Now in room` 标签。直播/电台流见 `room-deck-live`，空闲见 `room-deck-idle`。设置、关于两页桌面不显示。设计稿 frame-1/2 里的墨底悬浮卡为旧版，以本节与 frontmatter 为准。
- **迷你条（`mini-deck`，手机）** 与 **展开的底部条（`room-deck-expanded`）**：迷你条贴底、sheet 底，顶边 3px 进度线兼作分隔（仅显示）、封面 + 标题 + 「某某 点播 · 01:38」、右侧两个纯图标模式钮；点主体展开为三行完整底部条（浅色底板，含拖柄常显的进度轨与带文字开关）。设计稿 frame-3/4 的迷你条为旧版悬浮卡；展开态设计稿未出。
- **模式开关（`mode-toggle` / `mode-toggle-on`）**：常态 rule 描边、ink2 字，悬停淡底；点亮为实心蔷薇红白字。
- **底部标签栏（`bottom-tab-bar`，手机）**：五等分，图标 + 文字，ink3；选中项蔷薇红 600。→ 参考：[frame-3.png](imports/mock-v1/frame-3.png)。
- **状态部件（`state-message` / `text-button` / `skeleton-row` / `skeleton-tile`）**：居中 ink2 一行文案，可跟蔷薇红文字钮；骨架为 skeleton 色条/块，静态、无闪光动画。
- **提示（`notice`）与面板提示条（`desk-toast`）**：错误与设置类提示走宿站提示层；点播成功的即时确认走面板内提示条——墨底纸字的圆角胶囊，浮在结果区底边，约 2 秒淡出。
- **批量点播进度卡（`batch-progress`）**：整张正序/乱序或选集多选时出现在页面右下角的 sheet 卡：标题「正在点播《…》」、4px 进度条、`已发 / 总数`、「停止」描边小按钮；结束后标题变为「已点播完」/「已停止」、按钮变 ×，随后淡出。准备中为来回流动的不确定进度条，已停止时进度条变暗。
- **设置页（`settings-group` / `settings-row` / `settings-switch`）**：纸色底上一组一张 sheet 卡，细线分隔各行；每行图标 + 标签 + 右侧当前值（可选项带 chev）或开关。开关开态蔷薇红实底。设计稿未出，按令牌推导。
- **关于页（`about-card`）**：一张 sheet 卡，行样式同设置行；外链值为蔷薇红文字 + 外链图标（替代现有「GitHub 🔗」的 emoji）。
- **焦点环（`focus-ring`）**：2px ink 外圈、2px 间隔；实底蔷薇红控件内加 paper 内环。底部条已是 sheet 底，与其他表面同一外圈。
- **浮窗（`floating-window`：播放进度、收藏随机选择面板）**：外框、头部、按钮、焦点环改用本令牌——sheet 底、ink 字、rule 描边、`xl` 圆角、蔷薇红强调（勾选、主按钮、分段选中、开关点亮）。结构与行为按各自既有规格不变。

## Do's and Don'ts

| Do | Don't |
| --- | --- |
| 蔷薇红只表示「点播」与「房间正在放」 | 用蔷薇红做装饰、错误、平台识别 |
| 深色主题白字压蔷薇红时用 `rose-fill-dark` | 白字直接压在 `rose-dark` 上（3.41:1） |
| 底部条与面板同色：sheet 底 + 顶边细线、贴底 | 底部条做成墨底悬浮卡（旧版，用户反馈压迫、挡路） |
| 平台色只做 7px 来源圆点 | 平台品牌色整片铺底（深色主题同样禁止） |
| 用细线和底色档位分层；投影只给会自行消失的临时浮层 | 白卡 + 大阴影、毛玻璃、渐变光斑、紫色 |
| 动效只用三档时长与同一缓动；默认只过渡颜色/透明度/阴影/缩放 | `transition: all`、长时长让悬停拖泥带水、布局变化被拖着飘 |
| 下拉用插件自有浮层 | 原生 `<select>`（展开样式由系统决定） |
| 数字用系统界面字体 + `tabular-nums` | 数字用等宽字体栈（Windows 上难看）或不开表格数字导致列不齐 |
| 宋体只用于页标题 | 正文、按钮用宋体 |
| 圆角只取 6 / 8 / 10 / 12 / 16 与 full | 新增其他圆角值 |
| 图标用自包含内联 SVG | emoji 图标；借用宿站 `mdi-*` 类 |
| 封面裁切填满、`http://` 升级 `https://`、失败回退 thumb 底 + 图标 | 黑边、破图 |
| 手机端点击区 ≥ 44px（视觉可小于点击区） | 只按设计稿视觉尺寸做 30–40px 点击区 |
| 浮窗、选集面板、操作条与主面板同一套令牌 | 浮窗保留天蓝强调色或另写一套配色 |
| 焦点环用 `components.focus-ring`（ink 外圈，实底加 paper 内环） | 蔷薇红焦点环压在蔷薇红实底上（1.0:1，看不见） |
| 半透明值引用 `cover-ring`、`menu-shadow` 等令牌 | 组件里裸写 `rgba(...)` |
| 样式写 Tailwind 类（任意值），深色用 `imw-dark:` | 新增 SCSS；硬写宿站主题色 |
