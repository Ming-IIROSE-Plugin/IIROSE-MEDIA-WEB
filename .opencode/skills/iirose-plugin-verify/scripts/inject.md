# 注入 bundle 到 messages.html iframe

## 为什么不能直接内联 evaluate

- bundle 约 340KB（2026-10），塞不进 `browser_evaluate` 的 function 参数
- Code Mode 沙箱无 `require`/文件系统访问，读不了 dist/bundle.js
- 站点是 https，注入 `http://localhost` 的 `<script src>` 会被混合内容策略拦
- `frame.evaluate(code)` 直接执行代码不经过 script 标签，天然绕过 CSP

## 方法：生成嵌入文件 + browser_run_code_unsafe(filename)

1. 用 node 把 bundle 内容 JSON 内嵌进一个 Playwright 函数文件：

```bash
node -e "
const fs = require('fs');
const code = fs.readFileSync('dist/bundle.js', 'utf8');
const out = 'async (page) => {\n  const code = ' + JSON.stringify(code) + ';\n  const frame = page.frames().find(f => f.url().includes(\"messages.html\"));\n  if (!frame) return \"NO messages.html frame; frames: \" + page.frames().map(f => f.url()).join(\" | \");\n  const result = await frame.evaluate((src) => {\n    try { new Function(src)(); return \"executed; mainContainer=\" + !!document.getElementById(\"mainContainer\"); }\n    catch (e) { return \"ERROR: \" + e.message; }\n  }, code);\n  return result;\n}';
fs.writeFileSync('.inject-bundle.js', out);
"
```

2. 在 Code Mode 里执行：

```
await tools.playwright.browser_run_code_unsafe({ filename: ".inject-bundle.js" })
```

注意：`filename` 相对工作区根（项目根）解析；allowed roots 只有项目根和各自的 `--output-dir`（opencode：`/tmp/opencode/playwright`；Claude Code：`/tmp/claude-playwright`），其他路径会被拒。两边 MCP 的浏览器 profile 也各自独立（`/root/.cache/opencode-playwright` / `/root/.cache/claude-playwright`），登录态不共享。

3. 验证后删除 `.inject-bundle.js`。

## 方法二：独立 node Playwright 脚本（没有 Playwright MCP 时）

Claude Code 的浏览器工具（如 paseo `browser_evaluate`）只能内联传函数，340KB 的 bundle 塞不进去，也不能按 frame 执行。改用 Bash 跑本机全局 Playwright：

- 模块：全局装在 `/usr/local/lib/node_modules/playwright`（1.64.x），运行时加 `NODE_PATH=/usr/local/lib/node_modules`
- 浏览器：全局 Playwright 期望 `chromium_headless_shell-1248`，本机缓存只有 opencode MCP 用的 `chromium-1247`——**显式指定** `executablePath: '/root/.cache/ms-playwright/chromium-1247/chrome-linux64/chrome'`（已实测能打开 iirose.com）；或 `playwright install chromium` 补齐版本
- 登录态：用 `chromium.launchPersistentContext('/root/.cache/iirose-verify-profile', …)` 持久化 profile（放仓库外），站点 localStorage 记忆生效，之后无需重走登录
- 脚本放仓库外（如 `/tmp/iirose-verify/*.mjs`），运行时 `readFileSync('dist/bundle.js')`，无需生成嵌入文件；凭据从 `.secrets/iirose-test-account.txt` 读取，**不写进脚本**
- 一个脚本跑完整流程（登录/进房 → reload → 断言无 `.IIROSE_MEDIA_CONTAINER` → 注入一次 → 操作 → 截图/读 DOM 输出结论），每次 Bash 调用是独立进程，状态不会跨调用保留

注入核心与方法一相同：

```js
const frame = page.frames().find(f => f.url().includes('messages.html'));
await frame.evaluate(src => { new Function(src)(); }, readFileSync('dist/bundle.js', 'utf8'));
```

## 等价关系

此方法 = 油猴 `@match https://iirose.com/messages.html` + `@require file://dist/bundle.js`，但无需浏览器装油猴，适合自动化。
