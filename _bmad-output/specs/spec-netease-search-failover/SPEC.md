---
id: SPEC-netease-search-failover
companions: [failure-modes.md]
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# 网易云搜索失败检测与代理切换重试

## Why

用户在搜索网易云歌单/专辑时经常遇到两类线上失败：① 代理出口 IP 触发网易云反爬风控（HTTP 200 + `code: -462`，要求完成加密页验证）；② 腾讯 SCF 网关 3 秒函数超时（HTTP 433，`Invoking task timed out after 3 seconds`）。当前代码只判 `response.ok`、从不读业务 `code`，两层失败都被吞成**静默空列表**，用户以为搜不到；且无超时无重试。失败是概率性的（同一节点下次请求大概率成功），所以策略是「失败即换节点重试、新请求仍回主节点」，而非封禁或粘住。影响所有使用网易云搜索/详情链路的用户。

## Capabilities

- **CAP-1 业务错误码检测**
  - **intent:** 网易云 API 层解析响应时检查 `data.code`，将风控码（`-462`、`-460` 等）识别为独立失败类型。
  - **success:** 对返回 `code: -462` 的 HTTP 200 响应，上层得到「风控失败」而非空结果；正常 `code: 200` 响应行为不变。

- **CAP-2 失败换节点重试（无粘住）**
  - **intent:** 单次请求在节点1（用户设置的优先节点）失败后，仅该请求轮询其余节点重试；每一次新请求仍从节点1 开始，失败才走其它节点。
  - **success:** 节点1 返回 `-462`/超时/433、备用节点正常时，用户无感拿到结果；紧随其后的新请求仍先打节点1。

- **CAP-3 超时与传输失败处理**
  - **intent:** 网易云所有出网请求带 5 秒 AbortSignal 超时；超时、HTTP 433、网络错误与风控码走同一条换节点重试路径。
  - **success:** 代理挂起时请求在 5 秒内终结并触发换节点重试，不再无限等待。

- **CAP-4 失败明确提示**
  - **intent:** 重试仍失败的所有路径（风控/超时/网络）toast 说明原因，使用户能区分「真无结果」与「请求失败」。
  - **success:** 构造任一失败场景（mock 或真实复现），用户看到明确原因提示，而非静默空列表。

- **CAP-5 优先节点可选**
  - **intent:** 用户可在网易云平台设置中选择优先节点（广州/香港；另有仅供本地代理调试的「开发者模式」），选择持久化，重试链以该选择为起点。
  - **success:** 切换优先节点为香港后，新的网易云请求从香港 SCF 发起；不改动设置时默认广州，行为与改动前一致。

## Constraints

- 备用节点仅用于失败后的当次重试，轮询顺序为「用户设置的优先节点 → 其余节点」；禁止会话粘住——每次新请求默认从优先节点开始。
- 重试只重试一轮（每个失败请求对每个节点至多尝试一次），禁止循环重试（避免加重 IP 风控）。
- 优先节点选择沿用现有平台设置模式：localStorage 平台设置（参照 `bilibiliSetting.api` 与 `getBilibiliCors` 的请求时读取），`NeteaseSetting.api` 从字面量 `"default"` 扩为节点枚举；候选为广州/香港两个现有 SCF 实例，外加仓库既有的本地代理常量 `devcors`（设置里显示为「开发者模式」，仅供本地调试，选中时**不回落 SCF**）。不引入新代理、不改 `Environment.ts` 静态块竞态（另行立项）。
- 提示复用宿站 `ShowMessage`，不引入新 UI 组件。
- 不向用户展示或引导访问 `verifyUrl`：验证绑定代理出口 IP，用户在浏览器完成也无法解除代理 IP 封禁。
- 改动范围限网易云 API 层（`src/Api/NeteaseAPI/`）与它依赖的统一入口（`src/Api/index.ts` 的 `neteaseRequest` / `getNeteaseCors`）、网易云设置与类型（`src/settings/neteaseSettings/`、`src/types/netease/`），以及由此需要的平台层失败提示去重；不动其它平台的请求逻辑。

## Non-goals

- 不修 `Environment.ts` 静态块竞态（让阿里云代理对全部出网请求生效）——影响所有平台，单独立项。
- 不实现任何绕过网易云风控的手段（模拟验证、打码、cookie 池等）。
- 不修改全局默认代理行为与其它平台的节点选择逻辑（B 站已有自己的设置，互不影响）。
- 不处理其它平台的限流/失败（如 GD Studio 限流已有独立处理逻辑）。

## Success signal

在 iirose.com 实测：搜索歌单/专辑触发 `code: -462` 或 HTTP 433 时，一次换节点重试内拿到正常结果，且下一个新请求仍从优先节点发起；重试也失败时，用户看到明确的风控/超时原因提示——任何情况下都不再出现「静默空列表」。运行时验证环节须实测「歌单/专辑 vs 搜歌」的失败触发频率差异，验证或推翻当前推断，结果回写本 spec。

## Assumptions

- 「多发于搜歌单/专辑」仍为推断（type 1000/10 大响应体 + 连带 `n=100000` 详情请求），已列为运行时验证的必测项（见 Success signal）。
