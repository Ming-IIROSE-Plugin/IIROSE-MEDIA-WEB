# 网易云失败模式目录（companion of SPEC-netease-search-failover）

实现 CAP-1~CAP-5 时必须按本目录识别两类失败；识别特征与处理动作一一对应。

## FM-1 网易云风控验证（业务码失败）

**请求层表现：** HTTP 200，`Content-Type` JSON，`response.ok === true`——现有 `response.ok` 判断会放行，必须在 JSON 解析后检查 `data.code`。

**识别特征：**

```json
{
  "code": -462,
  "data": {
    "verifyType": 40,
    "verifyId": 1007602,
    "verifyUrl": "https://st.music.163.com/encrypt-pages",
    "verifyToken": "...",
    "url": "https://st.music.163.com/encrypt-pages?params=...&verifyType=40&verifyId=...",
    "blockText": "验证成功后，可进行下一步操作哦~"
  },
  "message": "请完成验证操作"
}
```

- 判定：`code !== 200` 即失败；`-462`、`-460`、`460` 为风控码，归入 FM-1。
- 根因：代理出口 IP（广州 SCF 数据中心 IP，全插件用户共享）被网易云标记；触发后该 IP 持续被要求验证一段时间。
- 关键事实：`verifyUrl` 绑定**代理出口 IP**，用户在自己浏览器完成验证无法解除代理 IP 封禁——不得展示该 URL 或引导用户验证。

**处理动作：** CAP-3/2 → 当次请求换其余节点重试（5 秒超时兜底）；仍失败 → CAP-4 提示「网易云风控」。失败是概率性的，不粘住备用节点——下一个新请求仍从优先节点开始。

**批量请求去重：** 逐曲歌词等循环请求会在数秒内失败多次，因此同一原因（同一条提示文案）在 10 秒窗口内只提示一次；不同原因仍各自提示。

## FM-2 SCF 网关超时（传输层失败）

**请求层表现：** HTTP 433（非标准码，腾讯云 API 网关/Synthetic 定义），`response.ok === false`。

**识别特征：**

- 请求 URL 形如 `https://<instance>.ap-guangzhou.tencentscf.com/proxy?url=https://music.163.com/weapi/search/get`（POST）。
- 响应 body：`Invoking task timed out after 3 seconds`。
- 根因：腾讯云函数同步执行超时配置为 3 秒，向上游 `music.163.com` 的转发未在 3 秒内完成即被强杀。风控慢响应 + 大响应体（歌单/专辑搜索、`/api/v6/playlist/detail?n=100000`）时最易触发；常与 FM-1 连发（先被风控变慢，再超时）。

**处理动作：** 与 FM-1 同路径——CAP-3 5 秒超时兜底 + 换备用节点当次重试；仍失败 → CAP-4 提示「代理超时」。

注意 433 不是网易云返回的状态码；同属传输层失败的还有 fetch 网络错误、AbortSignal 超时，处理路径与 FM-2 一致。

## 受影响端点清单（均需接入检测与重试）

| 端点 | 方法 | 加密 | 调用处 |
|---|---|---|---|
| `/weapi/search/get` | POST | weapi | `NeteaseSearch/index.ts` `getNeteaseMusicSearchData`（歌/歌单/专辑/MV 共用，type 1/1000/10/1004） |
| `/api/v6/playlist/detail` | GET | 明文 | `NeteaseMusic/index.ts` `getSongListDetail` |
| `/weapi/v1/album/{id}` | POST | weapi | `NeteaseMusic/index.ts` `getAlbumDetail` |
| `/api/song/detail` | GET | 明文 | `NeteaseMusic/index.ts` `getNeteaseSongDetail`（注意现 URL 为 http，Mixed Content 隐患另论） |
| `/api/song/lyric` | GET | 明文 | `NeteaseMusic/index.ts` `getLyric`（逐曲歌词，失败同样按本目录提示一次） |
| `/weapi/v1/mv/detail` | POST | weapi | `NeteaseMusic/index.ts` `getNeteaseMVDetail` |
| `/weapi/song/enhance/play/mv/url` | POST | weapi | `NeteaseMusic/index.ts` `getMVPlayURL`（原先硬编码广州前缀，现统一走请求入口） |

## 节点链

- 优先节点（节点1）：用户在网易云设置中选定（`NeteaseSetting.api` 扩为节点枚举，默认广州）；`SendFetch.cors` — `https://1309510434-0ia3djbhr3.ap-guangzhou.tencentscf.com/proxy?url=`（广州 SCF）
- 备用节点：`SendFetch.malaysiacors` — `https://1309510434-j7rmgztk8t.ap-hongkong.tencentscf.com/proxy?url=`（香港 SCF，与广州同构，可复用 `sendPost`）
- 开发者模式：`SendFetch.devcors` — `http://localhost:9000/proxy?url=`（本地代理，仅单节点、不回落 SCF；生产设置里可见，属既有调试逃逸口）

节点 id / 文案 / 图标 / 代理常量的唯一真源是 `src/Api/NeteaseAPI/Nodes.ts` 的 `NETEASE_NODES`；读取端、设置选项与标题解析都从它派生。

轮询规则：每次新请求从优先节点开始；当次请求失败才尝试其余节点；不做会话粘住。设置读取沿用 B 站模式（请求时读 localStorage，参照 `getBilibiliCors`）。
