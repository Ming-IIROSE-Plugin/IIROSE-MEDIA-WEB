---
ticket: 1
title: 收藏云同步后端服务（IIROSE-MEDIA-SYNC）
type: feature
created: '2026-10-18'
status: done
baseline_revision: 6216567a41e55b3e04c0166bae8ba322f1e5519e
route: dispatch
review_loop_iteration: 0
context: []
---
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 插件（`src/`）本身没有服务端，而收藏云同步的所有后端契约已经冻结在 `_bmad-output/specs/spec-favorites-cloud-sync/` 里——可端点还不存在。目前只有为它准备好的空壳：COS 桶 `iirose-media-sync-1309510434`（版本控制与生命周期已开）、执行角色 `IIROSE-MEDIA-SYNC-Role` 与只授 `sync/*` 前缀的策略。缺的是函数本体与部署链路。

**Approach:** 新建零运行时依赖的 Node 云函数 `IIROSE-MEDIA-SYNC`，逐条实现 `sync-protocol.md` 的 `GET`/`PUT`/`DELETE`/`OPTIONS` 与 304 短路，并把 uid 白名单、信封字段白名单、512KB 上限、写频率四道闸做在函数内部（函数 URL 只能是「开放」鉴权，没有平台侧兜底）。新增 `scripts/deploy_sync.py` 幂等创建/更新该函数，接进现有 CI。

## Boundaries & Constraints

**Always:**
- 协议以 `sync-protocol.md` 为准：路径 `/v1/favorites`、信封字段白名单、`uid` 匹配 `^[0-9a-f]{8,32}$`、200/304/400/409/413/429/503 语义。
- **服务端零知识**：不解密 `ct`，不记录请求体或 `ct`；日志只允许状态码、uid 前 2 位、字节数、耗时。
- 对象键只能由服务端派生 `sync/{uid[0:2]}/{uid}.json`，**不接受客户端传入的键**。
- 只用角色下发的临时凭据访问 COS（运行时环境变量）；仓库与函数配置里不得出现任何长期 AK/SK。
- 函数 URL 使用**开放**鉴权（浏览器可用的唯一选项），全部抗滥用逻辑在函数内。
- 零运行时依赖：只用 Node 内置模块（`crypto` / `https`）。
- `Access-Control-Allow-Origin` 为 `*`（无 Cookie、无凭据）；**304 响应同样要带 CORS 头**，否则浏览器读不到状态。
- 部署触发与现有 `IIROSE-MEDIA-WEB` **完全一致**：任意分支 push 即自动部署，不做分支差异化条件。

**Never:**
- 不做逐条端点、不做轮询或推送、不做口令托管或找回。
- 不修改 `scripts/deploy_scf.py` 及其测试，不碰 `IIROSE-MEDIA-WEB` 函数。
- 不引入 `cos-nodejs-sdk-v5` 或任何 npm 运行时依赖。
- 不把 `_bmad-output/`、`.secrets/` 之外的新目录写进被忽略范围，也不在仓库任何位置写云凭据。
- **本轮不配置费用与调用量告警**（仅作为运维待办留在 `backend-architecture.md` 的清单里）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| GET 云端无记录 | 合法 uid | 200 `{"snapshot":null}` | 不返回 404 |
| GET 有记录 | 合法 uid，对象存在，无 `If-None-Match` | 200 信封 JSON + `ETag` | — |
| GET 命中短路 | `If-None-Match` 等于当前 `VersionId` | **304，空 body** | 带 CORS 头 |
| GET 未命中短路 | `If-None-Match` 为旧值 | 200 信封 | — |
| PUT 正常 | 合法信封，≤512KB，距上次写 ≥10s | 200 `{ok,updatedAt,rev}` | — |
| PUT uid 非法 | 不匹配 `^[0-9a-f]{8,32}$` | 400 | 不触达 COS |
| PUT 信封非法 | 含白名单外字段，或 `v` 未知 | 400 | 不写入 |
| PUT 体积超限 | body > 524288 字节 | 413 | 不写入 |
| PUT 过频 | 距上次写 <10s | 429 | 不写入 |
| PUT 时间戳倒退 | 携带的 `updatedAt` 早于现存对象 | 409 + 服务端 `updatedAt` | 不覆盖 |
| PUT 当日超配额 | 当日写次数 >200 | 429 | 不写入 |
| DELETE | 合法 uid | 200 `{ok:true}`，写入空快照 | 保留版本历史 |
| OPTIONS | 任意路径 | 204 + CORS 头 | 允许 `GET,PUT,DELETE,OPTIONS`、`Content-Type`、`If-None-Match` |
| 未知路径 / 方法 | 如 `GET /foo`、`PATCH /v1/favorites` | 404 / 405 | — |

</frozen-after-approval>

## Code Map

- `_bmad-output/specs/spec-favorites-cloud-sync/sync-protocol.md` -- 冻结协议，函数逐条对齐；`crypto-spec.md` 只约束客户端，服务端不得触碰
- `_bmad-output/specs/spec-favorites-cloud-sync/backend-architecture.md` -- 桶/键布局/最小权限角色/三道闸阈值/成本模型
- `scripts/deploy_scf.py` -- **只读范式参考，不得修改**。要点：`GetFunctionAddress` → 下载 zip → 替换 → `UpdateFunctionCode`（`CodeSource="ZipFile"`、`Publish="FALSE"`、>20MiB 拒绝）→ `GetFunction` 轮询 Active → 回读校验；`_field`/`_response` 兼容 dict 与对象；异常必须脱敏，不得回显签名 URL 或 AK
- `scripts/test_deploy_scf.py` -- **测试范式**：stdlib `unittest` + `patch.dict(sys.modules, ...)` 注入假 `tencentcloud.*` + Fake 客户端 + `Mock` opener，断言零真实网络调用；CI 用 `python3 -B -m unittest discover -s scripts -p 'test_*.py'` 收集，故新测试须叫 `test_*.py` 且能独立 discovery
- `.github/workflows/webpack.yml` -- build job（Node 22 + `npm ci` + `npm run build` + unittest）与 deploy job（Python 3.12 + `pip install -r scripts/requirements-scf.txt` + 注入 `secrets.TENCENT_SECRET_ID`/`TENCENT_SECRET_KEY`、`vars.SCF_NAMESPACE`）；deploy 有 `concurrency.group: scf-ap-guangzhou-iirose-media-web`、`cancel-in-progress: false`
- `scripts/requirements-scf.txt` -- `tencentcloud-sdk-python-scf==3.1.100` / `-common==3.1.100`，只覆盖 SCF 管理 API
- `readme.md` -- L32-50「自动部署腾讯云函数」段落，新增函数需同级补一段
- 已存在的云资源（不在仓库内，本轮直接复用）：桶 `iirose-media-sync-1309510434` / 角色 `IIROSE-MEDIA-SYNC-Role` / 策略 `IIROSE-MEDIA-SYNC-COS`
- `src/` 全部前端代码 -- **本轮不碰**

## Tasks & Acceptance

**Execution:**
- [x] `cloud/sync/logic.js` -- 纯函数导出：uid 校验、信封字段与版本白名单、键派生、写频率与日配额判定、`If-None-Match` 判定、CORS 头构造 -- 与 I/O 无关的逻辑集中在此，便于零依赖单测
- [x] `cloud/sync/cos.js` -- 手写 **COS XML API 的 `q-sign-algorithm=sha1`** 签名（不是云 API 3.0 的 TC3，COS 不接受 TC3）的 `PutObject`/`GetObject`/`HeadObject` 最小封装；凭据取自运行时环境变量；**响应头 `x-cos-version-id` 即协议里的 `rev`** -- 不引 SDK
- [x] `cloud/sync/index.js` -- `main_handler(event, context)`：路由、四道闸、304 短路、错误码、CORS；写频率与日配额记在同前缀的 `sync/{uid[0:2]}/{uid}.meta.json`（形如 `{lastWriteAt,day,writes}`，跨日重置，不含任何用户内容）；409 判定所需的服务端 `updatedAt` 从现存信封顶层字段读（该字段本就是明文元数据，不涉及解密） -- 唯一入口
- [x] `cloud/sync/logic.test.js` -- `node:test` 覆盖 I/O 矩阵每一条 -- 这是四道闸唯一的自动防线
- [x] `scripts/deploy_sync.py` -- 幂等 upsert：函数不存在则创建（Role=`IIROSE-MEDIA-SYNC-Role`、内存/超时、环境变量 `COS_BUCKET`/`COS_REGION`），存在则更新代码；随后确保函数 URL（开放）与并发上限；输出脱敏 -- 与 `deploy_scf.py` 同风格
- [x] `scripts/test_deploy_sync.py` -- 镜像 `test_deploy_scf.py` 的 mock 策略，断言零真实调用与请求字段正确 -- 保住 CI 的离线性
- [x] `.github/workflows/webpack.yml` -- 加 `node --test "cloud/sync/*.test.js"`（glob 写法，目录写法会假绿）到 build job，并加 sync 部署步骤（触发条件与现有 deploy 一致：`push` 任意分支 + `workflow_dispatch`）-- 让新函数进入自动验证与部署
- [x] `readme.md` -- 补同步函数部署段落（函数名、权限、环境变量、函数URL 形态）-- 与现有段落同级

**Acceptance Criteria:**
- Given 已部署的函数 URL，when `curl -X PUT` 提交一份合法信封，then 返回 200 且响应含 `rev`；随后 `GET` 同 uid 返回同一信封且 `ETag` 等于该 `rev`。
- Given 已写入的对象，when `GET` 带 `If-None-Match: <rev>`，then 返回 304 且响应体为空。
- Given 非法 uid / 含白名单外字段的信封 / 超过 512KB 的 body / 10 秒内第二次 PUT，then 分别返回 400、400、413、429，且桶内对象字节未变。
- Given 函数被调用过，when 查看函数日志，then 不含请求体、不含 `ct`、不含任何凭据。
- Given 一个从未创建过函数的命名空间，when 运行 `python scripts/deploy_sync.py`，then 函数被创建、函数 URL 可用、并发上限生效，且脚本重复运行结果一致。

## Implementation Notes

- 实现由无上下文子代理完成，本会话按 diff 复核（非按报告），并修正了三处：
  1. **spec 缺陷**：任务里写的「TC3-HMAC-SHA256」是错的——TC3 是腾讯云 API 3.0 的鉴权，COS XML API 不接受，照做会 403。已改为 COS 的 `q-sign-algorithm=sha1` 方案（零依赖手写不变）。该签名**未经真实 COS 验证**，是当前最大残余风险。
  2. **运行时**：子代理选了 `Nodejs18.15`，Node 18 早已 EOL。改为 `Nodejs24.11`（与同账号既有函数一致、受支持），并同步更新断言与 readme。
  3. **readme 陈旧**：段落里写「Nodejs18.15、128MB、20s」，与代码的 30s 不符，一并修正。
- `node --test cloud/sync/` 在本机 Node 24 下只把目录当模块加载，输出 `tests 1 pass 1` 的**假绿**；CI 与 readme 一律用 `node --test "cloud/sync/*.test.js"`。
- **已真实部署并逐条验过 AC**（函数 URL `https://1309510434-0wsqedndx7.ap-guangzhou.tencentscf.com`，`AuthType=NONE`，`ReservedMem=1280`，`Role=IIROSE-MEDIA-SYNC-Role`，Runtime `Nodejs24.11`）：
  - AC1/AC2/AC3 与矩阵其余行**线上 27/27 通过**，含 PUT→GET 字节一致、`ETag == PUT rev`、`If-None-Match` 命中回 304 且 body 为空、非法 uid/白名单外字段/超 512KB 分别 400/400/413 且**对象字节未变**、10 秒内二次 PUT 429、时间戳倒退 409 并回带服务端 `updatedAt`、DELETE 后 `snapshot:null`。
  - AC5 通过：首次运行由脚本创建出函数（此前不存在），重复运行三次结果一致；函数 URL、并发上限均由 API 回读确认。
  - **AC4 未取得运行时证据**：`GetFunctionLogs` 对本函数与既有 `IIROSE-MEDIA-WEB` 均返回 0 条，说明该账号下这条取证路径不可用（非本函数缺陷）。日志零知识目前只有**代码级与单测级**保证（`console.log` 的唯一出口是 `logic.logPayload`，且有两条断言覆盖），运行时未证实。
- **本会话两次自我纠错**，均为测试脚本而非实现的问题，记录以防误判：
  1. 首轮把「二次 PUT 返回 200」判成闸二失效——实际是我在中间插了一次 512KB 上传，耗时超过 10 秒窗口。受控重测（PUT→429→等 12s→200）证明闸二正确。
  2. 一度判定「SCF 吞掉 ETag」并据此加了备用头 `X-Sync-Rev`——实际是我用 `dict(res.headers)` 取值，大小写敏感取不到 `Etag`；另一次「ETag 缺失」是对象正处于 DELETE 后的清空哨兵态，该分支按协议本就不带 rev。**已回退该多余改动**，协议面保持不变。
- `deploy_sync.py` 的 `trigger_url()` 原实现只在 `TriggerDesc` 顶层找地址，实测地址在 `NetConfig.ExtranetUrl`，已修正（对应测试夹具同步改为真实形态）。

## Review Triage Log

审查层：blind-hunter / edge-case-hunter / verification-gap 三层并行。逐条裁决如下（同一 root cause 的归入同一条目）。

| # | 位置 | 主张 | 裁决 | 依据 |
|---|---|---|---|---|
| F1 | `index.js` GET 的 rev 取自 HEAD | HEAD 与 GET 之间若有写入，客户端存下「新 rev + 旧正文」，此后永远 304、看不到新快照 | **false** | 新 rev 只在客户端回带的 rev **等于当前 rev** 时才短路；陈旧 rev 下一次即不相等，会正常回 200 并带回新 ETag，最坏多一次完整 GET，**不会永久 304**。声称的坏结果不成立 |
| F2 | `index.js` 409 分支 | 协议要求「以本地为准强制覆盖」，服务端无出路 | **false** | 强制覆盖走的仍是普通 LWW：客户端上传自己的快照时 `updatedAt` 取当下时刻，必然大于服务端值 → 200。409 只拦「真的更旧」的写入，不是锁 |
| F3 | `logic.js` `updatedAt` 无上界 | 时钟错乱的设备写入超大 `updatedAt` 后，该 uid 后续 PUT 恒 409、同步永久卡死；且 uid 半公开，任何人一次 PUT 即可触发 | **high → patch** | 代码确认只校验 `> 0`；真实可达，影响是该用户同步永久不可用。最小修：加上界（含时钟偏移容忍） |
| F4 | `logic.js` `kdf.iter` 只校验 `>= 1` | 弱信封能落地 | **low → patch** | 结果真实但无害（服务端零知识、不解密、不强加于人）；最小修是一行下限，属直接修正 |
| F5 | `logic.js` `classifySnapshot("")` | 空正文被判为 cleared，可能覆盖仍可解密的快照 | **false** | 空正文经本 API **不可达**：PUT 只在信封校验通过后写原始体，DELETE 写字面量 `null`；只有持有桶凭据的越界写入才造得出空对象 |
| F6 | `index.js` DELETE 绕过闸二 | 每次 DELETE 生成新版本，是无限刷成本的入口 | **low → 驳回** | 行为真实但影响面小（版本有 30 天生命周期封顶、每次仅 4 字节），且修法是在 DELETE 路径**新增守卫分支**，超出直接修正 |
| F7 | `index.js` GET 不区分「从未写入」与「已清空」 | 清空后另一设备会当首次启用并回传本地数据 | **low → 驳回** | 冻结的 I/O 矩阵规定 GET 返回 `{"snapshot":null}`；跨设备后果属尚未实现的客户端（目标 B）职责，改字段会超出直接修正 |
| F8 | `logic.js` `logPayload` 字段过少 | 排障缺 COS 状态码/错误码/方法 | **false** | 冻结的 Always 明确「日志只允许状态码、uid 前 2 位、字节数、耗时」，intent 本身排除该主张 |
| F9 | `index.js` PUT 为读 `updatedAt` 整包 GET | 最多多下载 512KB 密文 | **low → 驳回** | 影响仅限自有流量的极小增量（人均日 PUT 个位数、典型载荷数十 KB）；修法要引入 Range 或对象元数据新路径 |
| F10 | `index.js` 闸二与冲突判定为 TOCTOU | 并发 PUT 可同时通过 | **low → 驳回** | 闸二本就故意宽松（200 次/日），并发最多多放一两次；修法要引入条件写，属新增复杂度 |
| F11 | `index.js` `writeMeta` 失败被吞 | 账本写不进时闸二静默失效 | **low → 驳回** | 静默是代码里写明的有意取舍（不让已落地的快照被误报为失败）；补日志属新增分支 |
| F12 | `deploy_sync.py` 回读与收敛强度不足 | 函数 URL 无重试、URL 取不到仍退出 0、`ResourceNotFound` 未当作未就绪、已存在时不更新 Environment/Role、并发上限无回读 | **medium → patch** | 实机复现其一：首次部署退出码 0 却**没打印函数 URL**（`trigger_url` 返回空串）。其余为同一 root cause 的收敛缺口。准确地说 spec 的 Verification 把并发上限核对列在人工检查里，故代码不算偏离 spec，但 readme 的「回读校验」措辞过度承诺 |
| F13 | `cos.js` 签名与 rev 推导无自动验证 | 手写签名的任何回归都会线上全 403，而 CI 全绿 | **medium → patch** | verification-gap 层已预检：全仓仅两处触及 `cos.js`，且只有 `typeof` 断言；假客户端从不经过真签名路径。线上虽已跑通，回归无防线 |
| F14 | `logic.test.js` 多个分支无覆盖 | HEAD 200/GET 404、`writeMeta` 失败、DELETE 不存在 uid、非字符串 body、伪 base64 等无用例 | **low → patch** | 与 F13 同源（`cos.js` 与边界缺测），并入同一 patch 一并补 |
| F15 | `deploy_sync.py` 打包产物从未被加载 | 包清单与运行时依赖一旦分歧，CI 两步全绿而线上每次调用失败 | **defer** | 当前清单与实际依赖一致（线上已实证函数可加载）；属未来风险，按该层建议 defer |
| F16 | `index.js` `ETag` 未加引号 | 违反 RFC 7232，中间层可能忽略 | **low → 驳回** | 加引号会让 GET 的 `ETag` 与 PUT 回带的 `rev` 不再相等，直接破坏冻结契约里的 304 短路；属协议级改动而非直接修正 |
| F17 | CI 用 Node 22 跑测试，函数跑 Nodejs24.11 | 测试从未在生产运行时上执行 | **low → 驳回** | 风险低（本函数只用 `crypto`/`https`/`Buffer`）；修法会连带改动前端构建所用的 Node 版本，超出直接修正 |
| F18 | CI 任意分支 push 即部署 | 半成品直接生效 | **false** | 这是用户在 Checkpoint 明确裁定的触发策略（「跟现有一样」），intent 排除该主张 |
| F19 | CI concurrency group 名仍带 `iirose-media-web` | 名义与承载不符 | **low → 驳回** | 纯命名；无被证明的伤害 |
| F20 | `index.js` HEAD 404 不区分 NoSuchKey 与 NoSuchBucket | 桶名写错会被当作「无数据」，客户端随即上传后被 503 | **low → 驳回** | 结果真实但属配置错误场景；HEAD 无响应体，要区分必须改走 GET 并解析错误体，超出直接修正 |
| F21 | 注释引用 `.gitignore` 内的 `_bmad-output` 路径 | 克隆仓库的人找不到协议文档 | **low → 驳回** | 这些文档是本机 agent 工件；引用是给实现者指路的注释，非运行时依赖。修法是把协议搬进仓库，超出直接修正 |
| F22 | `readme.md` 功能列表无同步条目、缺前置条件 | 读者以为功能已可用；「只授 `sync/` 前缀」不可验证 | **medium → patch** | 与 F12 同一 root cause（部署文档与事实不符）：应写明本轮只落后端、`src/sync/` 尚未实现，并列前置条件 |
| F23 | `logic.js` `isValidUid` 只收小写、`lookup` 要求调用方传小写名 | 宿主 uid 若含大写会得到不透明 400；改调用方写法会静默失配 | **false** | 实测宿站 uid 为 13 位小写 hex；`lookup` 仅由本模块内部按小写名调用，无外部调用方，未证明可达 |
| F24 | `cos.js` 单连接超时无累计截止 | 一次 PUT 串行 4 次 COS 调用，可能撞上 30s 上限 | **low → 驳回** | 线上实测单次 PUT 约 1.5s，离上限极远；修法要引入 deadline 传播，超出直接修正 |

**结果**：`false` 6 条（F1/F2/F5/F8/F18/F23）、`low` 驳回 12 条、`defer` 1 条（F15）。**接受的 patch**：F3、F4、F12（含 F22 的文档更正）、F13+F14（`cos.js` 及其边界测试）。无 intent_gap、无 bad_spec，故不回炉重 derive。

## Verification

**Commands:**
- `python3 -B -m unittest discover -s scripts -p 'test_*.py'` -- expected: 全绿（含新增的 `test_deploy_sync.py`）
- `node --test "cloud/sync/*.test.js"` -- expected: 全绿，覆盖 I/O 矩阵每行（**注意用 glob**：`node --test cloud/sync/` 只把目录当模块加载，会假绿成 `tests 1 pass 1`）
- `npm run build` -- expected: 成功且产物与改动前一致（本轮不动前端）

**Manual checks (if no CLI):**
- 部署后对函数 URL 跑 AC 里的四条 curl，逐条核对状态码与响应体
- 在腾讯云控制台确认函数的角色为 `IIROSE-MEDIA-SYNC-Role`、函数 URL 鉴权为「开放」、并发上限已生效

<!-- 2026-10-19 追加：信封 v2 扩展（由客户端 story 的需求变更引入） -->

### 变更：信封接受 v2（DEK + 口令包裹）

- 背景：客户端 story 裁定引入「随机 DEK + 口令派生 KEK 包裹」以支持免重复输入口令，信封升到 **v2**，新增 `wrapped` 字段（`{iv, ct}`，KEK 包住的 DEK）。
- 影响本 story 的产物：`cloud/sync/logic.js` 原先**硬校验 `v === 1`** 且拒绝白名单外字段，会把 v2 信封直接 400 掉。
- 需要改为：**接受 `v ∈ {1, 2}`**；`v === 2` 时必须存在并校验 `wrapped`（`iv` base64 12B、`ct` base64 ≥ 48B）；`v === 1` 保持原行为（线上仍有 3 个真实用户的 v1 快照）。
- 线上现存对象：`sync/61/611282ced92f1.json`(itemCount 0)、`sync/61/61f7881cd4538.json`(4)、`sync/6a/6a3414484be3e.json`(1) 均为 v1；GET 只是原样透传，不受影响。
- 本文件的 `ENVELOPE_VERSION` 与 `frozen-after-approval` 中的 I/O 矩阵不因此重写：v1 行的语义不变，v2 是**新增**受理分支。
