---
topic: IIROSE-MEDIA-WEB 搜索结果视图切换：卡片(默认)/列表双视图，双入口切换，偏好持久化
updated: 2026-10-10T06:38
---

- (direction) slug=search-view-toggle；快速蒸馏(express)模式；交互确认：切换按钮双入口(搜索栏快捷切换+设置页开关)；视图偏好持久化
- (capability) CAP-1 用户可在搜索结果页于卡片视图(默认)与列表视图间切换，切换即时生效于当前结果集
- (capability) CAP-2 双入口切换：搜索栏快捷切换按钮与设置页开关均可切换视图，两处状态实时同步
- (capability) CAP-3 视图偏好持久化到 imwPluginSetting(localStorage)，重开插件/刷新后保持上次视图
- (constraint) 默认视图为卡片，现有卡片网格布局与行为不变（对老用户零感知变化）
- (constraint) 列表行不得被 overflow:hidden 裁切（沿用 grid-auto-rows:max-content 教训，AGENTS.md 记载的已知坑）
- (constraint) 图标自包含：新图标须在 src/app.css 注册 ::before content + font-family:md，禁用宿站 mdi-* 类
- (constraint) 移动端(max-[490px])与桌面端切换入口均可见可用
- (constraint) 不新增依赖；样式用 Tailwind 任意值类不新增 SCSS；状态沿用 class 组件 + context/prop 传递模式
- (decision) 非目标：不做第三种及以上视图模式（紧凑网格/封面墙等）
- (decision) 非目标：视图偏好为全局单一值，不做按平台或按搜索会话的独立记忆
- (decision) 非目标：不改动卡片视图现有布局与交互
- (assumption) 列表行保留每条结果的全部动作：播放、选集/选歌(multiPage 时)、封面跳转
- (assumption) loading/error/空结果占位样式不随视图切换变化
- (question) 列表行具体字段与缩略图尺寸？（建议：缩略图+标题+作者+类型/时长+播放/选集动作）
- (question) 移动端搜索栏空间紧张时，切换按钮与关键词/分页按钮的优先级与排布？
- (note) 落点参考(来自代码调研)：PluginSettingsInterface+LocalStorageUtils.setPluginSetting 默认值+PluginSettings.getPluginSetting 三处同步加 searchViewMode 字段；MediaCard.tsx 结果分支按 viewMode 分支渲染；MediaSearchBar.tsx 桌面端左侧弹性空白放快捷切换药丸按钮；SettingCard.tsx 复用 isProxyAtInputSetting 开关模式
- (event) 自检 Pass1(一致性)通过：3 个能力均含 intent+success；intent 描述 WHAT；约束均可 bend design；非目标 3 项明确；success signal 可测试；CAP-ID 唯一；行文精简
- (event) 自检 Pass2(保全性)通过：来源主张(默认卡片/双视图切换/双入口/持久化)全部落入 SPEC；代码库衍生约束(裁切坑/图标规范/Tailwind/移动端)保全；会话仪式性内容(slug 选择/问候)按规则丢弃
