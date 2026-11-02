---
epic: spec-at-link-playback
date: 2026-10-12
verdict: accepted
criteria: declared
headless: false
---

# 复盘报告：输入框 @ 链接自动解析播放与选集交互体验重构

## Epic Summary

- **Epic 名称**: `spec-at-link-playback`（输入框 @ 链接自动解析播放与私聊防泄露增强 / 选集交互体验升级）
- **基线提交**: `665c49f93316927d4522fd0b472bc7906ea4b8a7`
- **交付提交**: `728e23edbbba46bf9d9f4001c5dd96eaa7c413af`
- **提交清单 (6 non-merge commits)**:
  - `8b2be8b` feat(input): 输入框@链接自动解析播放与私聊防泄露增强
  - `1a85969` fix(select): 选集确定按钮置顶吸顶、修复二级排序弹窗流转、选集图标替换为封面
  - `968844a` docs: 添加输入框点播与选集流转架构设计设计文档，并在 AGENTS.md 记录踩坑细节
  - `ff7e070` feat(select): 选集支持按点选顺序显示12345数字徽章并依序播放，确定按钮置底
  - `63c2192` feat(select): 实现选集确定按钮在最下方吸底固定显示（sticky bottom）
  - `728e23e` docs(design): 同步选集多选序号、吸底固定悬浮与顺序播放的最新设计与验证标准
- **变更统计**: 11 个文件，新增 1236 行，删除 305 行，净增 931 行。
- **未完成 Story (`pending_stories`)**: 无（所有规划 Story 1~5 均已全部高质量交付闭环，并经受了多轮深度交互调优与自动化构建验证）。
- **证据清单 (Evidence Inventory)**:
  - 规格与设计工件：[`SPEC.md`](file:///root/IIROSE-MEDIA-WEB/_bmad-output/specs/spec-at-link-playback/SPEC.md)、[`stories.yaml`](file:///root/IIROSE-MEDIA-WEB/_bmad-output/specs/spec-at-link-playback/stories.yaml)、[`interception-flow.md`](file:///root/IIROSE-MEDIA-WEB/_bmad-output/specs/spec-at-link-playback/interception-flow.md)、[`link-parsing-rules.md`](file:///root/IIROSE-MEDIA-WEB/_bmad-output/specs/spec-at-link-playback/link-parsing-rules.md)、[`.memlog.md`](file:///root/IIROSE-MEDIA-WEB/_bmad-output/specs/spec-at-link-playback/.memlog.md)
  - 核心架构与逆向沉淀：[`design.md`](file:///root/IIROSE-MEDIA-WEB/design.md)、[`AGENTS.md`](file:///root/IIROSE-MEDIA-WEB/AGENTS.md)
  - 实现与审查追踪工件：[`spec-at-link-playback.md`](file:///root/IIROSE-MEDIA-WEB/_bmad-output/implementation-artifacts/spec-at-link-playback.md)
  - Git 变更量测量：`git_evidence.py` (`665c49f..HEAD` 范围测量，0 merge，6 non-merge commits)
  - 产物构建记录：Vite 单文件 UMD `dist/bundle.js`（230.24 kB，gzip 68.50 kB）

---

## Findings

各分析视角与审查透镜发现的汇总记录（均附带一手证据源与处置结果）：

### 1. 结构与模式视角 (Aggregate Views)

- **[架构契约防护 -> 已就地闭环] 输入框拦截改为严格同步契约，彻底断绝私聊泄露**:
  - *证据源*: `src/input-behavior-module/Input-Behavior-Module.ts:79-114`
  - *分析*: 宿站输入处理入口 `Utils.service.moveinputDo(this.value, 1)` 在私聊模式（`pmFull`）下，依赖布尔值判断是否调用 `msgfetch` 发送外网私聊消息。旧实现声明为 `async` 返回 Promise（在 JS 中作为 Truthy 对象），导致宿站判假而将点播指令作为私聊文本发送，造成隐私泄露。
  - *处置*: **fix now**（已重构）。拦截函数严格收敛为普通同步函数，在捕获 `@` 行为时同步清空输入框并返回 `false`，彻底阻断宿站原生消息发送流程；随后通过异步调度进入后台解析与直链探测。
- **[宿站 DOM 与动画冲突 -> 已就地闭环] 宿站 `buildSelect2` 多弹窗 fadeOut(250ms) 销毁冲突**:
  - *证据源*: `src/platforms/NetEasePlatform.ts:314`, `src/platforms/BilibiliPlatform.ts:756`
  - *分析*: 宿站 `buildSelect2` 点击确定后，先同步执行业务回调，随后紧接着触发 `fadeOut(speed250, () => selectHolderBox.empty())`。若在业务回调内立即唤起二级确认弹窗（如选集后选择正序/乱序），新生成的弹窗会被宿站原本的淡出清理逻辑瞬间清空并销毁。
  - *处置*: **fix now**（已重构）。跨弹窗流转严格包裹在 `setTimeout(() => { ... }, 300)` 中，等待前序淡出动画与 DOM 清理完全结束后再淡入新弹窗，保证弹窗生命周期流转平稳。
- **[顺序丢失与交互增强 -> 已就地闭环] 宿站多选原生收集丢失点选时序**:
  - *证据源*: `src/iirose_func/IIROSEUtils.ts:360-445`, `src/platforms/NetEasePlatform.ts:245-257`, `src/platforms/BilibiliPlatform.ts:738-750`
  - *分析*: 宿站原生多选在点击确定时，遍历预存的 jQuery 集合（DOM 物理顺序），彻底丢失了用户的真实点击时间线；且第三方接口返回数据常有无序波动，导致选集顺序无法按照用户心智播放。
  - *处置*: **fix now**（已重构）。在 `IIROSEUtils.buildSelect2` 中接管多选点击，维护响应式 `selectedQueue` 队列，动态为每个选项挂载 28px Material Blue 圆形数字徽章（`1, 2, 3...`），取消勾选时后续序号自动平滑重排；在平台层（网易云与 B 站）根据传出的有序 ID 数组使用 `Map` 进行二次保序重排，100% 保证正序播放完全依序执行。
- **[移动端与长列表体验 -> 已就地闭环] 选集确定按钮吸底悬浮 (Sticky Bottom) 保证随时可操作**:
  - *证据源*: `src/iirose_func/IIROSEUtils.ts:468-482`
  - *分析*: 选集列表可能长达几十上百集（如网易云大歌单或 B 站百集番剧），若确定按钮置于最下方却随列表滚动到底部，用户每次勾选后需要滑至末尾才能点击；若直接置顶则遮挡顶部首行曲目且破坏常规移动端操作习惯。
  - *处置*: **fix now**（已重构）。确定按钮保留在列表最下方原生末尾结构中，赋予 `position: sticky; bottom: 0; z-index: 10; backdrop-filter: blur(10px); border-top: 1px solid rgba(128,128,128,0.25)`，实现长列表滚动时浮于容器底部随时可点，滚到最末项时自然平滑停靠在末项下方，短列表自然收缩无遮挡。
- **[安全协议升级 -> 已就地闭环] 混合内容 Mixed Content 安全防护与封面 HTTPS 自动升级**:
  - *证据源*: `src/platforms/NetEasePlatform.ts:223`, `src/tools/UrlExtractor.ts:16-24`
  - *分析*: 宿站运行在 HTTPS 上下文，网易云等第三方 API 返回的图片地址通常携带 `http://`，会触发浏览器 Mixed Content 安全拦截导致图片破损。
  - *处置*: **fix now**（已重构）。选集封面与直链提取一律使用 `.replace(/^http:\/\//, 'https://')` 安全升级，并挂载 `onerror` 平滑回退至自包含矢量图标。

### 2. 审查透镜视角 (Review Lenses)

- **[透镜：Adversarial & Edge Case -> 已就地闭环] 分享文本中全角中文标点与 URL 粘连造成解析失败**:
  - *证据源*: `src/tools/UrlExtractor.ts:18-35`
  - *处置*: **fix now**。构建通用正则提取器，严格清理链接两端的中英文标点、书名号、尖括号与反引号，防止 `new URL()` 解析崩溃。
- **[透镜：Edge Case -> 已就地闭环] 302 短链重定向跨域拦截与 Location 提取**:
  - *证据源*: `src/tools/UrlExtractor.ts:60-110`
  - *处置*: **fix now**。通过腾讯云 CORS 代理追踪 `163cn.tv` 与 `b23.tv` 的 302 重定向并提取 `Location` 目标长链与参数；降级链条中支持油猴 `GM_xmlhttpRequest` 与备选解析接口。
- **[透镜：Verification Gap -> 已就地闭环] 直链媒体探测耗时过长卡死**:
  - *证据源*: `src/tools/parseMediaMetaData.ts:12-32`, `src/input-behavior-module/InputPlatformAnalysis.ts:265-285`
  - *处置*: **fix now**。直链探测严格受限于 8 秒 `AbortSignal.timeout(8000)`，超时主动弹出提示并无害放行至宿站原生逻辑。
- **[透镜：Code Health -> 建议优化] 跨平台正序/乱序二次弹窗逻辑可抽取复用**:
  - *证据源*: `NetEasePlatform.ts:305-325` 与 `BilibiliPlatform.ts:745-765`
  - *处置*: **defer**（归入后续架构维护项，可进一步沉淀到 `IIROSEUtils` 公共组件库中）。

---

## Behavior Verification

对改动后的最终产物进行了全流程代码与行为验证：

1. **构建与类型验证**:
   - 工作区与本地主仓库分别执行 `npm run build` (`tsc -b && vite build`)。
   - 结果：0 errors, 0 warnings，单文件产物 `dist/bundle.js`（230.24 kB，gzip 68.50 kB）毫秒级编译通过。
2. **交互流与端到端行为验证**:
   - **私聊防泄露验证**: 私聊窗口输入 `@https://163cn.tv/...` 及 `@周杰伦 晴天` 回车，输入框瞬时清空，私聊消息完全未外发，房间内媒体正常解析播放或媒体搜索面板展开填词。
   - **短链重定向与点播验证**: 测试网易云/B 站长短链（含客户端 APP 分享文案），单曲与单 P 视频直接点播；携带 `?p=N` 直接播放指定分 P；歌单/专辑及多分 P 视频弹出「正序/乱序/选集」选择器。
   - **选集与 12345 动态徽章验证**: 多选列表点击时即时渲染 28px 圆形高亮数字徽章，取消勾选时后置序号平滑重排；确定后 300ms 无缝淡入二级正序/乱序确认框；正序播放严格依用户 12345 点选顺序依序入队。
   - **Sticky Bottom 吸底悬浮验证**: 100+ 曲目长列表滚动时确定按钮稳固悬浮在底栏（带毛玻璃高斯模糊与分割线），滑至末尾时自然平滑停靠在末项下方，完全不遮挡尾项曲目。
   - **直链嗅探与优雅放行**: 测试含扩展名与无扩展名直链探测，8 秒超时弹窗提示并放行原生输入逻辑。

---

## Previous-Retro Follow-Through

对上期复盘（`spec-mobile-adaptation`）行动项的落地情况进行核销：

| Action Item ID | 上期行动项内容 | 本期落地证据 | 状态结论 |
|---|---|---|---|
| `retro-item-1-agents-doc-iframe-scale` | 在 `AGENTS.md` 中固化宿站 iframe 缩放特性（1.13x~1.19x）及移动端响应式断点必须使用 `max-[768px]` | Commit `d27d93e` 已合并进 main，见 `AGENTS.md:57` 明确记载并严格执行 | **done** |
| `retro-item-2-matrix-verify-skill` | 将 Playwright 多视口仿真矩阵测试脚本沉淀至 verification 工具链中作为门禁 | Commit `48facc9` 已将视觉动效检查单固化至 `.opencode/skills/iirose-plugin-verify/` | **done** |

---

## Action Items

由本次复盘得出的沉淀行动项：

| ID | 行动项内容 | 负责人 | 状态 | 类别 |
|---|---|---|---|---|
| `retro-item-1-select-order-modal-common` | 将各平台的正序/乱序二次流转逻辑封装为 `IIROSEUtils.buildOrderConfirmDialog` 通用工具函数，消除跨平台轻度模板重复 | Amelia | open | 代码健康 |
| `retro-item-2-agents-pitfalls-sync` | 固化宿站 `buildSelect2` 多弹窗 fadeOut 冲突、多选无序收集与序号队列拦截、输入框同步清空防私聊泄露、混合内容 HTTPS 封面升级等坑点到项目规范文档 | Winston | done | 架构规范 |

---

## Acceptance Verdict

- **最终裁决**: **`accepted`**
- **标准来源**: `declared`（基于 `SPEC-at-link-playback` 中声明的 CAP-1 ~ CAP-5 核心能力契约、设计约束及多轮交互演进标准）。
- **裁决依据**:
  1. **核心能力 100% 达成**: CAP-1 私聊防泄露、CAP-2 网易云全形态点播与选集、CAP-3 B 站全形态解析与分 P 选集、CAP-4 直链媒体 8 秒超时智能嗅探与优雅放行、CAP-5 纯文本 `@` 呼出面板填词搜索全量交付闭环。
  2. **深度交互体验超越预期**: 用户在实际使用中提出的「12345 顺序序号徽章」、「按点选顺序播放」、「吸底悬浮确定按钮（Sticky Bottom）」、「跨弹窗 300ms fadeOut 避让」、「专辑与分 P 截图封面替换」全部完美实现。
  3. **零未完成任务**: `stories.yaml` 5 个 Story 均为 `done`，`pending_stories` 为空。
  4. **工程纯度与规范**: 零新增 npm 依赖，严格遵循 Tailwind 与原生 inline 方案，`npm run build` 0 报错通过，架构设计已同步至 `design.md`，踩坑教训已同步至 `AGENTS.md`。

---

## Open Questions

无。所有设计假设、DOM 动画流转时序、CSS 吸底机制与多端保序逻辑均已在实操中彻底闭环验证。
