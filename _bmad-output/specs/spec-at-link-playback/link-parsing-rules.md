# 链接解析与分发规则矩阵 (Link Parsing Rules Matrix)

本文档定义输入框 `@` 接收到的各类内容格式识别、正则匹配、短链重定向与点播分发规则。

## 1. 链接识别与提取 (URL Extraction)

用户输入的原始文本形式多样，包括直接以 `@` 开头的纯链接，以及携带分享文字的复合文案。

### 1.1 提取策略
1. 移除首个 `@` 字符后的前导空格。
2. 通过正则从文本中提取 URL 候选串：
   - 包含协议：`https?://[^\s"'<>\u4e00-\u9fa5]+`
   - 无协议但以常见域名开头：`(?<![a-zA-Z0-9])(?:www\.)?(?:bilibili\.com|163\.com|music\.163\.com)[^\s"'<>\u4e00-\u9fa5]+`（自动前置补齐 `https://`）
3. 若提取出有效 URL，进入 **平台与直链分发** 逻辑；若未提取出 URL，则按 **纯文本搜索** 逻辑处理。

---

## 2. 平台链接解析规则 (Platform Rules)

### 2.1 网易云音乐 (NetEase Cloud Music)

| 类型 | 示例格式 | 提取方式 | 目标操作与交互 |
| :--- | :--- | :--- | :--- |
| **单曲长链 (Hash)** | `https://music.163.com/#/song?id=22770026` | 提取 hash 或 query 中 `id` 参数 | `NetEasePlatform.MOD`（直接点播） |
| **单曲长链 (Path)** | `https://music.163.com/song?id=22770026`<br>`https://y.music.163.com/m/song?id=22770026` | 提取 query 中 `id` 参数 | `NetEasePlatform.MOD`（直接点播） |
| **单曲短链** | `https://163cn.tv/bit1nU3J` | 经 CORS 代理追踪 302 重定向获取长链，解析 `id` | `NetEasePlatform.MOD`（直接点播） |
| **单曲分享文案** | `分享Cro的单曲《ALLES DOPE》: https://163cn.tv/bit1nU3J (来自@网易云音乐)` | 提取短链并重定向解析 | `NetEasePlatform.MOD`（直接点播） |
| **专辑长链 (Hash)** | `https://music.163.com/#/album?id=2091784` | 提取 hash 中 `id` 参数 | 弹出「正序点播 / 乱序点播 / 选集点播」|
| **专辑短/长链 (Path)**| `http://music.163.com/album/251795697` | 从路径提取 `/album/(\d+)` 或 query 中 `id` | 弹出「正序点播 / 乱序点播 / 选集点播」|
| **专辑分享文案** | `分享Cro/BUNT.的专辑《BOOM》: http://music.163.com/album/251795697/?userid=1365227856 (来自@网易云音乐)` | 提取链接并匹配 ID | 弹出「正序点播 / 乱序点播 / 选集点播」|
| **歌单长链 (Hash)** | `https://music.163.com/#/playlist?id=331841455` | 提取 hash 中 `id` 参数 | 弹出「正序点播 / 乱序点播 / 选集点播」|
| **歌单移动端/Path** | `https://music.163.com/m/playlist?id=8735850242` 或 `/playlist/(\d+)` | 提取 query `id` 或 path | 弹出「正序点播 / 乱序点播 / 选集点播」|
| **歌单分享文案** | `分享歌单: CRO 铭铭_280 https://music.163.com/m/playlist?id=8735850242&creatorId=1365227856` | 提取 URL 后解析 `id` | 弹出「正序点播 / 乱序点播 / 选集点播」|

> **多选与顺序流转机制**：选择「选集点播」后唤起多选列表，用户勾选目标分曲后点击「完成」，触发二级选择器（正序 / 乱序），随后播放选定曲目。

### 2.2 哔哩哔哩 (Bilibili)

| 类型 | 示例格式 | 提取方式 | 目标操作与交互 |
| :--- | :--- | :--- | :--- |
| **视频长链** | `bilibili.com/video/BV1FVp96CEM3/?trackid=...`<br>`https://www.bilibili.com/video/BV1FVp96CEM3` | 正则提取 `(BV[a-zA-Z0-9]+|av\d+)` | 获取详情；单 P 直接播，多 P 弹选择框 |
| **短链** | `https://b23.tv/wHdK6aI` | 经 CORS 代理请求短链，获取 302 `Location`，提取 BVID 与 query | 获取详情并进入点播/分 P 流程 |
| **分享文案** | `【用巨大水球撞击火星...】 https://b23.tv/wHdK6aI` | 提取短链 URL，按短链规则重定向并提取 BVID | 获取详情并进入点播/分 P 流程 |
| **带指定分 P** | `https://www.bilibili.com/video/BV1mm411z7y6/?p=2` | 提取 BVID 与 query 中 `p` 参数值（如 2） | 直接解析对应第 2 P 的 CID 并点播单 P |
| **多 P 选集** | 多分 P 视频且 URL 未携带 `p` 参数 | 视频详情中 `pages.length > 1` | 弹出「正序点播 / 乱序点播 / 选集点播」对话框 |

> **B 站选集多选流转**：同网易云，选择「选集点播」后唤起分 P 多选列表，完成选择后二次确认正序/乱序并发送。

---

## 3. 直链媒体探测与放行规则 (Direct Media & Fallback)

### 3.1 直链格式分类
1. **显式扩展名直链**：URL 结尾（排除 query 参数后）带常见音频/视频扩展名：
   - 音频：`.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.aac`, `.weba`
   - 视频：`.mp4`, `.m3u8`, `.webm`, `.flv`, `.mov`, `.mkv`
2. **隐式无扩展名直链**：URL 不带上述扩展名（例如 CDN 流地址、短链或 API 媒体流端点）。

### 3.2 探测与处理机制
1. **元数据占位填充**：
   - 标题：尝试从 URL pathname 提取文件名并解码；提取失败则使用“直链媒体”。
   - 歌手：统一占位为“直链播放”。
   - 封面：使用插件默认封面（`Fallback.demandPic.url` 或插件内置静态图）。
2. **显式扩展名处理**：
   - 音频：调用 `ParseMediaMetaData.getAudioDuration` 探测时长，发送 `music` 媒体卡片（`b: "=0"`）。
   - 视频：m3u8 走 `ParseMediaMetaData.getM3U8Duration` 获取时长，常规视频通过 Video 对象获取时长，发送 `video` 媒体卡片（`b: "=1"`）。
3. **隐式无扩展名探测 (HEAD Probe)**：
   - 发送 HEAD 请求探测 `Content-Type`（设置 **8 秒** 超时限制）：
     - 若 `Content-Type` 为 `audio/*`，按音频直链处理；
     - 若 `Content-Type` 为 `video/*` 或 `application/vnd.apple.mpegurl` / `application/x-mpegURL`，按视频直链处理；
     - 若 HEAD 请求 **超时（>8秒）**：弹窗提示“直链媒体探测超时”（`ShowMessage.show("直链媒体探测超时，请检查链接有效性")`）。
     - 若探测失败或明确为非媒体类型（如普通网页 text/html）：**优雅放行至宿站原生逻辑**。
4. **优雅放行 (Graceful Fallback)**：
   - 调用备份的原生方法 `backupMethod(e, t)`，由宿站原生 `moveinputDo` 执行其原生正则与提示，插件不做侵入也不报错。

---

## 4. 纯文本 `@关键词` 规则 (Plain-Text Keyword Search)

若输入文本除去首字符 `@` 后不包含任何有效 URL（且不是宿站原生快捷键如 `@#`, `@@@`, `@!` 等）：
1. 判定为媒体检索意图。
2. 呼出插件主面板（若未打开）。
3. 调用 `changeSearchKeyword(keyword)` 将检索词填入搜索栏。
4. 在公屏与私聊模式下均阻止该文本发送至聊天流。
