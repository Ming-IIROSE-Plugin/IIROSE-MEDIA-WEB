---
id: SPEC-bilibili-split-and-idle-guard
companions: [] # files downstream MUST read alongside SPEC.md. Paths may point inside the spec folder (spec-authored) or outside it (adopted from an upstream skill).
sources: [] # files fully absorbed into the SPEC (audit only; downstream does NOT read these). Never the memlog.
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# B 站平台拆分、空闲轮询与体积守门

## Why

**两件遗留，加一道防线。** 上一轮把四个千行文件拆完，产物降到 437.25 kB / gzip 131.99 kB；剩下最大的单文件是 `BilibiliPlatform.ts`（782 行），它与已拆的 `NetEasePlatform` 完全对称，是改动时最容易连带的第二个地方。第二个遗留来自 `spec-bundle-and-startup-perf` 的非目标：媒体桥的 250ms 轮询在循环/随机未点亮时仍在跑，因为控制器无条件常驻订阅。第三件是防线：CAP 的体积上限一直靠人工记录，距 450 kB 只剩 12.75 kB，下一个功能就能静默破线。

## Capabilities

- **CAP-1**
  - **intent:** `BilibiliPlatform.ts` 按用途拆成多个模块，每个文件不超过 400 行，公开静态方法签名与所有调用点保持不变。
  - **success:** 该文件不再是单一大文件，拆分后每个文件 ≤400 行；`BilibiliPlatform.*` 的全部公开方法仍可从原路径调用，`src/page/**` 与测试零改动即通过。
- **CAP-2**
  - **intent:** 没有人观察（面板关闭、浮窗关闭、循环与随机都未点亮）时把媒体轮询降到 1 秒；面板打开、浮窗打开或模式点亮时恢复 250ms。
  - **success:** 单测证明两种节奏：空闲时 250ms 内无回调、1s 内有回调；标记活跃后 250ms 内有回调；真机上循环/随机从点亮到生效的行为与改动前一致（含结束前预发重播）。
- **CAP-3**
  - **intent:** 产物体积被自动校验，破线时构建即失败并给出实测值。
  - **success:** 构建后运行体积检查，`bundle.js > 450 kB` 或 gzip `> 134 kB` 时退出码非 0 且输出两项实测值；CI 在 build 之后执行该检查。

## Constraints

- 产物仍是单文件 UMD，不引入 code-split 或额外 chunk。
- 行为、UI、用户可见文案、宿站交互契约不变；请求继续复用 `SendFetch` 与现有 WBI 路径。
- 现有测试不得放宽或删除；拆分失败只改实现。
- 体积检查脚本只用 Node 内置模块，不新增依赖；阈值与 SPEC 的 CAP 一致，不单独维护第二套数字。

## Non-goals

- 其他 ≤800 行文件的拆分（`FavoritesStorageService`、`SettingsService`、`BiliBiliSettings`、`LoginAPI` 等）：留给后续轮次。
- 手写加密模块（`NeteaseAPI/Crypto`、`SyncCrypto`）的拆分：切行数会让算法更难对照原实现。
- 进一步减小产物体积：已到「只能砍功能」的程度。
- 改动 250ms 轮询间隔本身：活跃期间保持 250ms，避免进度条变卡。
- 完全停表：宿站不提供媒体事件（别人点歌、切歌、播放结束都只能靠轮询发现），停表会让侧栏按钮的可用性与待命状态长期陈旧，换来的是错误的点亮提示。

## Success signal

`BilibiliPlatform.ts` 不再是单一大文件且各模块 ≤400 行；循环与随机未点亮时面板静置不产生媒体轮询，点亮后循环与随机行为与改动前一致；故意把产物阈值调低时构建失败并打印实测体积。

## Assumptions

- `PlaybackMode` 已有的 `subscribe`/`toggle` 足以驱动「点亮才订阅、熄灭即退订」，不需要新增状态通道。
- 点亮瞬间缺少历史快照只影响「点亮后极短时间内即结束」的边界，可用现有 5 秒预发窗口兜住；这条要在 story 里用测试或真机确认。

## Open Questions

- 若点亮前必须有快照历史才能保证重播，是否接受「点亮后首个刷新周期（≤250ms）内不判定」？——留给 CAP-2 的 story 用实测决定。
