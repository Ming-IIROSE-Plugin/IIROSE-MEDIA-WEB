# 腾讯云函数部署与运维

## IIROSE-MEDIA-WEB 自动部署

仓库 `Ming-IIROSE-Plugin/IIROSE-MEDIA-WEB` 的 **Build and deploy** workflow 在所有分支的 push（不含标签）和手动 `workflow_dispatch` 时部署；面向 `main` 的 PR 只运行构建和离线测试。构建统一使用 Node.js 22、`npm ci` 和 `npm run build`，构建或测试失败不会进入部署。

目标固定为广州 `ap-guangzhou` 地域的 `IIROSE-MEDIA-WEB` 函数，默认命名空间是 `default`；如需覆盖，在仓库 Settings → Secrets and variables → Actions → Variables 配置 `SCF_NAMESPACE`。函数必须已存在，流程不会创建函数。

组织 Secrets `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY` 已授权给此仓库，部署时才注入环境变量。该身份需对目标 namespace/函数资源拥有以下 SCF API 权限：

- `scf:GetFunctionAddress`：获取现有 `$LATEST` 代码包的签名下载地址。
- `scf:UpdateFunctionCode`：更新函数代码。
- `scf:GetFunction`：轮询异步更新状态。

脚本在内存中读取现有 zip，识别 `src/` 或包根目录下配对的 `app.js`、`bundle.js`，替换这两个文件：`bundle.js` 用本次构建产物，`app.js` 用仓库里的 `cloud/bundle/app.js`。SCF 控制台的 `src` 可能表示编辑器根目录；若两种布局同时存在或均不存在则停止。上传前以及部署后重新下载时，都会校验文件列表、其他文件内容及 zip 元数据；路径缺失或校验失败会使 job 失败。代码包、签名 URL 和凭据不会打印或上传为 artifact，跨 job 传递的 artifact 只有本次构建的 `dist/bundle.js`。CI 的 Python SDK 依赖单独固定在 `scripts/requirements-scf.txt`。

### Cors-Anywhere 转发函数

插件的外网请求经两台 `Cors-Anywhere`（`ap-guangzhou` / `ap-hongkong`，代码相同）转发。入口源码在 `cloud/cors-anywhere/app.js`，用 `scripts/deploy_function_app.py` 部署：

```bash
python3 scripts/deploy_function_app.py --name Cors-Anywhere --region ap-guangzhou --app cloud/cors-anywhere/app.js
```

该脚本只替换包内 `app.js`，其余文件（`node_modules` 等）原样保留，并在上传前与回读后校验。

已修的三处：不再设置 `rejectUnauthorized: false`（上游证书必须校验）；上游 `set-cookie` 只放在 `X-Proxy-Set-Cookie` 里、不再原样透传（否则会往代理域名种 cookie）；上游请求加了 20 秒超时。

#### 已知风控现象（未登录时）

B 站 `x/web-interface/view`（点播取详情）在**未登录 + 浏览器 UA** 下返回 412，与代理代码无关：

| 请求头的 UA | view | search | passport/nav/spi |
|---|---|---|---|
| `curl/8.x` 或空 | 200 | 200 | 正常 |
| 浏览器 UA（含补齐 Sec-Fetch-* 指纹头） | **412** | 200 | 正常 |

也就是说 B 站按 UA 分流：浏览器 UA 的请求要求带有效 buvid/cookie，否则判爬虫。登录态下正常（维护者确认）。若要覆盖未登录场景，可在代理里对 `bilibili.com` 改写 UA —— 但这会改变登录态链路的 UA 一致性，需要真机验证后再决定。

### 前端入口的 gzip

`cloud/bundle/app.js` 是云函数的 HTTP 入口，随仓库维护：启动时把 `bundle.js` 压一次（`zlib.gzipSync`，level 9），`/bundle.js` 直接返回 gzip 内容并带 `Content-Encoding: gzip`。

有一个必须知道的坑：**SCF 的函数 URL 网关会把请求头 `Accept-Encoding` 改写成 `identity`**（实测：客户端发 `gzip, br`，函数收到 `identity`）。因此不要按 `Accept-Encoding` 协商——协商永远不命中，会一直发明文。当前实现默认发 gzip（浏览器与油猴 `@require` 都必然支持），需要明文诊断时用 `/bundle.js?plain=1`。

效果：线上单次下载从 432,847 字节降到 128,739 字节；`gzip -dc` 解压后与 `dist/bundle.js` 逐字节一致。

更新只针对 **`$LATEST`**，`Publish=FALSE`，不改变 Handler、环境变量、触发器或别名。已发布版本和指向这些版本的别名不会自动切换；如果线上入口绑定的是已发布版本，需要另行发布或调整绑定才能提供新 bundle。同一目标的部署 job 共用 concurrency group，`cancel-in-progress: false`，不会由新 push 取消正在运行的部署。GitHub concurrency 只保留一个 pending job，密集 push 可能替换较早的待执行部署，且不保证执行顺序。

在仓库 Actions → **Build and deploy** 查看 `build` / `deploy` 结果；只有更新状态就绪且下载校验通过后才会输出成功。首次真实部署需先将 workflow 推送到仓库，云凭据无需也不应导出到本机。更新失败时在腾讯云控制台检查函数状态；脚本不自动回滚。

部署期间请避免同时在腾讯云控制台或其他流水线更新同一函数：GitHub 的并发控制只约束此仓库的部署任务，读取并替换代码包不是跨系统的原子操作。

离线验证（无需云凭据）：

```bash
npm run build
node --test "cloud/sync/*.test.js"
python3 -B -m unittest discover -s scripts -p 'test_*.py' -v
```

同步函数的门禁测试基于 Node 内置 `node:test`（零依赖、零网络）。注意 `node --test cloud/sync/` 这类目录写法在当前 Node 下不会展开目录内的测试文件，因此命令显式给出 glob。

## IIROSE-MEDIA-SYNC 自动部署

同一 workflow 的 `deploy` job 在 `IIROSE-MEDIA-WEB` 之后执行 `python scripts/deploy_sync.py`，幂等地创建或更新收藏云同步后端。插件侧的同步客户端（`src/sync/`）已经就绪：两级密钥（随机 DEK + 口令派生的 KEK）在本机完成加解密，请求直连该函数 URL，入口在设置面板的「插件设置 → 云端同步」（默认关闭，需用户主动启用并设置同步口令；启用后：插件激活时拉取一次、打开面板/切回标签页/窗口获得焦点时按 60 秒冷却即时拉取、面板打开期间每 5 分钟兜底拉取）。

### 前置条件

脚本不创建以下资源；缺失时部署会失败：

- COS 桶 `iirose-media-sync-1309510434` 已创建，私有读写、**版本控制已开启**、生命周期规则以 `sync/` 前缀限定。
- 角色 `IIROSE-MEDIA-SYNC-Role` 与只授该桶 `sync/` 前缀的策略 `IIROSE-MEDIA-SYNC-COS` 已存在（`PutObject` / `GetObject` / `HeadObject`）；不要复用 `SCF_QcsRole`。
- 目标命名空间已存在（默认 `default`，可用 `SCF_NAMESPACE` 覆盖）。
- 部署身份除函数基础 API 外，还需 `scf:CreateFunction`、`scf:ListTriggers`、`scf:CreateTrigger`、`scf:UpdateTrigger`、`scf:UpdateFunctionConfiguration`、`scf:PutReservedConcurrencyConfig` 权限。

目标固定为广州 `ap-guangzhou` 的 `IIROSE-MEDIA-SYNC`；运行时 Nodejs24.11、128MB、30s、Handler `index.main_handler`；执行角色 `IIROSE-MEDIA-SYNC-Role`；环境变量 `COS_BUCKET=iirose-media-sync-1309510434`、`COS_REGION=ap-guangzhou`。函数每次调用都从 `TENCENTCLOUD_SECRETID` / `TENCENTCLOUD_SECRETKEY` / `TENCENTCLOUD_SESSIONTOKEN` 读取角色的临时凭据，仓库与函数配置里不出现任何长期密钥。

函数不存在则一次性创建（角色、内存/超时、环境变量、代码），已存在则先收敛 Role / Environment / MemorySize / Timeout，再替换代码（`CodeSource=ZipFile`、`Publish=FALSE`，只更新 `$LATEST`），两次变更之间等函数就绪；就绪轮询期间把 `ResourceNotFound` 当作「尚未就绪」而不是失败。

随后确保**函数 URL**（`Type=http` 触发器、开放鉴权 `AuthType=NONE`、开启公网访问）：刚创建或刚改鉴权会短暂重试，地址从触发器描述的 `NetConfig.ExtranetUrl` 回读，**读不到地址即部署失败**，不会静默通过。最后下发**函数最大独占配额 1280MB**（约 10 并发）——这一步只调用 `PutReservedConcurrencyConfig`，脚本不回读，是否生效需在控制台确认。

地址形如 `https://<app-id>-<url-id>.ap-guangzhou.tencentscf.com`，浏览器直连、不经 CORS 代理。函数内部实现 `sync-protocol.md` 的 `GET` / `PUT` / `DELETE` / `OPTIONS` 与 `If-None-Match` 304 短路，四道闸（uid 白名单、信封字段白名单、512KB 体积、10 秒频率与 200 次/日配额）全部在函数内；日志只含状态码、uid 前 2 位、字节数与耗时，不含请求体、`ct` 或凭据。

需要人工确认（脚本不做）：控制台里函数 URL 鉴权为「开放」、角色绑定与最大独占配额符合预期、费用与日调用量告警已配置（运维清单见后端架构文档）。函数 URL 绑定版本 `$LATEST`；本轮不发布版本、不配置告警。
