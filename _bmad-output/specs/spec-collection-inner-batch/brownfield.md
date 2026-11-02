# 现状与根因（2026-10-31，基于 c00a528）

## ① 内页无多选（CAP-1）

- `CollectionHeader.tsx` 只有「全部播放」→ `OrderMenu`（正序/乱序）。
- 内页行点播为 `currentOnDemandPlay = NetEasePlatform.MOD`（逐首）；`MainAppContainer.switchToMultiPage` 设置。
- 有序多选只存在于选集面板（`episode-picker`），入口仅点播弹窗 `buildSelect` 的选项 2（`MLOD` / `AOD` → `selectEpisodes`）。

## ② 万首歌单首屏慢（CAP-2）

- `switchToMultiPage` → `getSongListMultiPageData` → `processSongPlatformData(全部 trackIds)` → `NeteaseMusicAPI.getNeteaseSongDetail`：按 100 一批 **串行** 取完全部才返回。万首 ≈ 100 次请求，节点失败时每次还换节点重试。
- 专辑走 `getAlbumMultiPageData` → 同一 `processSongPlatformData`。
- 内页分页 = `allMediaData` 本地切片，`Platform.itemPerPage = 10`（`changecurrentPage` 里 slice）。
- 可复用：`NetEasePlatform.playlistSkeleton`（按 `trackIds` 出骨架、不发请求）。

## ③ 停止后请求仍在发（CAP-3 / CAP-4）

- `NetEasePlatform.sendSongs` 先 `getNeteaseSongDetail(全部 ids)` 串行取完再进发送循环；这段期间不查 `batch.cancelled`。
- 发送循环每首 `getLyric`，只在请求前后查停止；飞行中的请求无法中止。
- `SendFetch.neteaseRequest`（`src/Api/index.ts`）每节点自建 `AbortController` 做 5s 超时，不接外部 signal。
- **复活隐患**：`BatchProgress.stopBatch` 后约 1.4s（`BATCH_STOP_LINGER_MS` + `BATCH_LEAVE_MS`）`remove()` 从模块级 `cancelled` 集合删掉 id，`handle.cancelled` 变回 `false`。准备阶段停止、详情取数超过 1.4s 的批次会照常开始发歌。
