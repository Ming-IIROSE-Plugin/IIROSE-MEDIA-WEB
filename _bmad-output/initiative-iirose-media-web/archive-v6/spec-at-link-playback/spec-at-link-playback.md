---
title: '输入框 @ 链接自动解析播放与私聊防泄露增强'
type: 'feature'
created: '2026-10-12'
status: 'done'
baseline_commit: '665c49f93316927d4522fd0b472bc7906ea4b8a7'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '_bmad-output/specs/spec-at-link-playback/SPEC.md'
  - '_bmad-output/specs/spec-at-link-playback/link-parsing-rules.md'
  - '_bmad-output/specs/spec-at-link-playback/interception-flow.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 用户在聊天输入框以 `@链接` 或 `@歌名` 点播或检索媒体时，当前实现存在私聊界面误外发消息泄露用户输入、缺乏网易云与 B 站移动端短链及分享文案提取能力、不支持歌单/专辑及多分 P 选集多选点播、缺乏直链媒体 8 秒超时智能嗅探与无感知放行机制。

**Approach:** 将代理拦截方法改为严格同步函数契约阻断私聊外发，后台解耦异步任务；基于通用 URL 提取器与 CORS 代理追踪短链重定向；网易云与 B 站支持单项直达与多分曲/分 P 多选及正序/乱序流转点播；直链媒体提供 8 秒 HEAD 探测与优雅原生放行；纯文本呼出面板搜索。

</frozen-after-approval>

## Implementation Notes

- 重构 `src/input-behavior-module/Input-Behavior-Module.ts`：将 `changedOriginalMoveInputDo` 改为同步函数契约，拦截时同步清空输入框并返回 `false`，彻底阻断宿站 `msgfetch` 在私聊模式下外发；严格响应 `chatBox.isProxyAtInput` 开关。
- 实现 `src/tools/UrlExtractor.ts`：支持从分享文本提取 URL、补齐协议头、GM_xmlhttpRequest / b23.wtf / 腾讯云 CORS 代理追踪 302 短链重定向；支持扩展名及 8s HEAD 探测；排除并清理中文全角标点。
- 增强 `src/platforms/NetEasePlatform.ts`：支持单曲直接播放；歌单与专辑支持正序/乱序/选集多选流转播放。
- 增强 `src/platforms/BilibiliPlatform.ts`：支持携带 `?p=N` 直达指定 P；支持多分 P 视频正序/乱序/选集多选流转播放；单集直接播放；支持 `av...` 号转换 `aid`。
- 完善 `src/tools/parseMediaMetaData.ts`：增加 `getVideoDuration`，`getM3U8Duration` 加入 8 秒超时控制。
- 重构 `src/input-behavior-module/InputPlatformAnalysis.ts`：调度网易云、B站、直链媒体（8s 超时弹窗提示）、优雅放行与纯文本 `@` 搜索全链路；修复 `parseNetEaseUrl` 参数解析与嵌套 hash 路由。
- 消除 `src/Api/index.ts` 循环依赖问题。
- 执行 `npm run build`，成功通过并产出 `dist/bundle.js`。

## Review Triage Log

- finding 1: false -- 宿站代码 if (pmFull && !moveinputDo(this.value, 1)) return moveinput.val(""), !1; 明确依赖返回 false 阻断 msgfetch 执行，审查员误解了守卫反转逻辑。
- finding 2: false -- 聊天框提交时清空输入框为宿站原生标准行为。
- finding 3: false -- 宿站原生 @ 快捷指令已在同步阶段白名单完整放行。
- finding 4: high -- parseNetEaseUrl 正则贪婪匹配导致包含额外参数时 id 提取错误，已使用 URLSearchParams 准确提取。
- finding 5: medium -- NetEase 支持嵌套 hash 路径（toplist / playlist / album / song / mv），已补齐。
- finding 6: medium -- Bilibili av 号未转为 aid 导致 API 报错，已补充提取 aid 处理。
- finding 7: high -- targetP 未找到时未 return 导致继续播放，已增加 return 阻断。
- finding 8: medium -- 直链常规视频文件缺少时长获取，已在 parseMediaMetaData 新增 getVideoDuration 并接入。
- finding 9: medium -- URL 提取未排除全角中文标点导致 new URL 报错，已扩充中文字符集与末尾清理。
- finding 10: low -- UrlExtractor 动态优先读取 window.iirosemedia.cors，已优化。
- finding 11: low -- NetEase 歌单选集列表保持现有 tracks 映射逻辑。
- finding 12: low -- 番剧与直播专属直链扩展归入后续路线。
- finding 13: medium -- 直链默认封面使用 http 导致混合内容警告，已改为 https。
- finding 14: medium -- parseMediaMetaData.getM3U8Duration 缺少超时控制，已增加 AbortSignal.timeout(8000)。

