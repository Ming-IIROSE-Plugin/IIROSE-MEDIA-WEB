---
name: iirose-plugin-verify
description: 在真实站点上运行时验证 IIROSE-MEDIA-WEB 插件：构建 bundle、登录 iirose.com、进房间、把本地 dist/bundle.js 注入 messages.html 上下文、呼出 UI、搜索与点播验证。当用户说"验证插件 / 测试插件 / 登录 iirose 调试 / 插件在网站上跑一下 / verify the plugin / test on iirose"，或改完代码需要运行时检查时使用。
---

# IIROSE-MEDIA-WEB 运行时验证

## 何时使用

- 改完插件代码，需要在真实 iirose.com 上验证行为（本插件没有独立可跑的应用；单测 `npm test` 只覆盖逻辑与 jsdom 行为，宿站交互仍需真站验证）
- 排查只在宿站环境出现的问题（CORS 代理、宿站弹窗体系、WebSocket 媒体钩子）

## 前置

- 测试账号凭据存放在本机 `.secrets/iirose-test-account.txt`（已 git-ignore）；文件不存在时向维护者索取。**凭据绝不写进任何入库文件或提交**
- 服务器需已装 Playwright + Chromium，项目已 `npm i`

## 步骤

1. **构建**：`npm run build`（= `tsc -b && vite build`）。tsc 不过先修类型错误。
2. **登录**（Playwright，全部操作在 `#mainFrame` iframe 的可访问性快照上做，用 ref 点击）：
   - 打开 `https://iirose.com/` → 若弹语言选择，点「简体中文」
   - 点「点击任意位置开始」出现主菜单后：**登录已有账号点「载入记忆」**（「新的开始」是注册流程，别点）
   - 填用户名、密码 → 点「登录」→ 等待进入空间站（大厅）
   - 刷新页面后站点会自动登录（localStorage 记忆），无需重走登录流程
3. **进房间**：热推列表点任一房间卡片 → 房间信息弹窗点「进入」→ 关闭房间公告。部分房间不支持艾特音乐，功能异常时先换房间排除差异。**点播必须进房间后才有意义**（大厅里发不出媒体卡）。
4. **注入 bundle**：插件运行在 **`messages.html` iframe 上下文**（`#mainContainer` 在那里面；顶层文档只有 `#mainFrame`）。注入方法见 `scripts/inject.md`，按工具链二选一：有 Playwright MCP 的 agent（opencode、Claude Code 均已配置）用 `browser_run_code_unsafe` + filename；没有的用独立 node Playwright 脚本（Bash 执行）。两者都是 `frame.evaluate(new Function(src))`，等价于油猴 `@match messages.html`，绕过 CSP，无需装油猴。
5. **验证加载**：
   - 控制台出现 `[Ming's IIROSE-MEDIA-WEB] - LOADED`
   - iframe 内存在 `.IIROSE_MEDIA_CONTAINER`，`window.iirosemedia.cors` 已选代理（ipinfo 判 CN/Global）
   - Alt+S 呼出 UI：在 iframe 内 dispatch `KeyboardEvent('keydown', {key:'s', altKey:true})`；容器是 fixed 定位，**offsetParent 恒为 null**，判断开关看 `getComputedStyle(container).transform` 是否为 `matrix(1,0,0,1,0,0)`（开着）
6. **坑：首启双弹窗**——每次注入都可能连弹**两个**站内弹窗：用户协议 → 隐私政策（都在 `#syncAlertHolder`，各一个「确定」），全屏遮罩挡住一切交互，**循环点到没有为止**。
7. **坑：宿站弹窗残留遮罩**——`IIROSEUtils.sync` 往 `#syncHolder` 加的 `#syncHolderOutside` 关闭后不清理，连同 `#syncHolder`（fullBoxFixed）会**拦截 Playwright 真实点击**（报 "subtree intercepts pointer events"）。点击页内元素前先执行：`document.getElementById('syncHolderOutside')?.remove(); document.getElementById('syncHolder').style.display='none'`（下次要用站内弹窗时去掉 display:none）。
8. **搜索验证**：
   - 点击 `.inputIcon` 的父级 div（onClick 在父级上；`.inputWrapper` 已不存在，见第 11 条）打开宿站 `#syncPromptHolder` 输入框
   - 站点输入框是 jQuery 体系：**合成 DOM 事件无效**，必须用 Playwright 真实键盘（`locator.type()` / `press('Enter')`；Enter=确定）
   - 成功标准：搜索栏显示关键词、分页 `1/N`、结果卡片渲染
9. **点播验证**：
   - 平台标签用精确文本匹配点击（如 `JOOX`，用 `childElementCount<=3` 过滤掉外层容器）
   - 播放按钮点 `.MediaCardButtonContainer`（真实点击）
   - **判定是否发出**：以聊天区消息流 DOM 为准（`div.msgholderBox`，取 children 最多的容器看末尾子块）。控制台的 `m__4@0>...`（@0=网易云）/ `m__4@2>...`（@2=JOOX）与 `&1{"s":...,"d":...}` 是宿站自身日志，**只能辅助看报文内容**（`d` 是时长秒数，`s:""` 或 `d:0` 即异常），不能单凭它判定「已发送」；`Socket.sendMessage` 的公聊文本完全没有控制台日志（见 AGENTS.md「宿站控制台日志陷阱」）
   - 插件的用户提示走 `window._alert`（站内提示条）；hook 它（包一层记录调用）可捕获错误提示
9b. **multiPage 条目在列表视图**（专辑 / 歌单 / B 站分 P）：搜索结果切到**列表视图**再验证 —— 未解析期播放按钮应为置灰不可点（`multiPage` 尚未 resolve），解析完成后按钮恢复，点播/选集表现与卡片视图一致。只测卡片视图会漏掉列表行对异步 `multiPage` 的处理。
10. **坑：GD Studio API 限流**——`music-api.gdstudio.xyz` 按 **IP** 限流（types=url 端点全源共享），连续几次请求即触发，恢复窗口长（>10 分钟）。**限流时返回 HTTP 200 + `{"url":"","br":-1}`**——判失败必须看 `data.url` 是否为空，不能只看 HTTP 状态。要验证限流处理逻辑，先 curl 连发烧掉配额再测。
11. **坑：搜索输入框旧选择器**——旧流程文档的 `.inputWrapper` 已不存在；当前触发搜索要点 `.inputIcon` 的父级 div（`MediaSearchBar.tsx` 的 searchInput onClick）。
12. **视觉动效检查单(每轮 UI 改动后必跑)**——`npm test`、`npm run build` 与功能清单都看不见纯视觉/交互动效缺陷(2026-10 搜索视图特性复盘教训,三类返工全由此盲区产生):
    - **溢出/裁切**:疑似改动元素与容器,双端读 `el.scrollWidth - el.clientWidth` / `getBoundingClientRect()` 对边,必须为 0 或负;本插件无 preflight,`w-*` + `px-*`/`border` 组合必须 `box-border`(容器级兜底已加 app.css,新容器外元素仍需自查)
    - **动画时长**:app.css 的动效基线在 base 层(只过渡颜色/透明度/阴影/缩放,默认 120ms,`--imw-fast/base/slow` 三档),组件上的 `transition-*`/`duration-*` 直接生效,不需要 `!`;宽高与位置不在默认过渡里,要动画须显式写 `transition-[…]`。Tailwind v4 的 `scale-*`/`translate-*` 是独立属性,过渡要写 `scale`/`translate` 而不是 `transform`;按下反馈用 `deskPress` 令牌。真机确认动画肉眼可感知(<200ms)
    - **触屏 hover**:hover 态样式一律 `hov:` 门控(`@custom-variant hov` 已注册);400×800 视口真机点一下,确认无粘滞高亮
    - **文本裁切**:构造超长标题/作者/subtitle 条目,确认 `text-ellipsis` 出「…」而非硬裁;flex 子项需 `min-w-0`(overflow≠visible 时规范上自动为 0,仍显式写上)
    - **空态渲染**:条件数据(如元信息、multiPage)为空时,确认不渲染占位空行/空块
13. **清理**：删除注入用临时文件和调试快照；`npm i` 若产生 lockfile 副作用用 `git checkout --` 撤销。

## 人工调试（备选，改完即刷新）

油猴脚本 `@match https://iirose.com/messages.html` + `@require file://<本地 dist/bundle.js 路径>`，改码 → build → 刷新页面。

## 参考

- `scripts/inject.md`：注入脚本的生成与执行方法（含为何不能用内联 evaluate）
