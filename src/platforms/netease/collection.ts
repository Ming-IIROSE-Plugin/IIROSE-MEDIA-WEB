import { NeteaseMusicAPI } from "../../Api/NeteaseAPI/NeteaseMusic";
import { ShowMessage } from "../../iirose_func/ShowMessage";
import { CollectionSegments } from "../CollectionSegments";
import {
  DETAIL_CHUNK,
  DETAIL_CONCURRENCY,
  songPlatformData,
  type CollectionTrack,
} from "./shared";

/**
 * 歌单曲目骨架（选集面板用）：`trackIds` 才是完整列表与顺序，详情接口的 `tracks`
 * 在部分网络 / 未登录时只给前 10 首（千首歌单曾只列出 10 首）。这里**不发请求**：
 * 有详情的曲目带名字，其余只有 id，由 `fetchSongDetailsPooled` 在后台补；
 * 上万首的歌单因此能立刻列出，不必等全部详情取回。
 */
export const playlistSkeleton = (playlist: {
  tracks?: CollectionTrack[] | null;
  trackIds?: { id: number }[] | null;
}): { tracks: CollectionTrack[]; missing: number[] } => {
  const tracks: CollectionTrack[] = playlist.tracks ?? [];
  const ids = (playlist.trackIds ?? []).map((item) => item.id);
  if (ids.length <= tracks.length) return { tracks, missing: [] };
  const known = new Map<number, CollectionTrack>(
    tracks.map((track) => [track.id, track]),
  );
  const missing = [...new Set(ids.filter((id) => !known.has(id)))];
  return { tracks: ids.map((id) => known.get(id) ?? { id }), missing };
};

/**
 * 并发取歌曲详情：每批到达就回调 `onChunk`，随时可由 `signal` 中止（关面板即停）。
 * 单批失败（`null`）跳过，对应曲目保留占位名；不抛错。
 */
export const fetchSongDetailsPooled = async (
  ids: number[],
  options: {
    signal: AbortSignal;
    onChunk: (songs: SongDetailSong[]) => void;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<void> => {
  const size = DETAIL_CHUNK;
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += size)
    chunks.push(ids.slice(i, i + size));
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (!options.signal.aborted) {
      const at = next++;
      if (at >= chunks.length) return;
      // 传入 signal：关面板时进行中的请求一并静默中止
      const songs = await NeteaseMusicAPI.getNeteaseSongDetail(
        chunks[at],
        options.signal,
      );
      if (options.signal.aborted) return;
      if (songs) options.onChunk(songs);
      done += chunks[at].length;
      options.onProgress?.(done, ids.length);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(DETAIL_CONCURRENCY, chunks.length) }, worker),
  );
};

const collectionSegments = (ids: number[]) =>
  new CollectionSegments(
    ids,
    async (chunk, signal) => {
      const songs = await NeteaseMusicAPI.getNeteaseSongDetail(chunk, signal);
      return songs ? songs.map(songPlatformData) : null;
    },
    DETAIL_CHUNK,
  );

/**
 * 歌单内页：只取歌单详情拿到完整 `trackIds`，曲目详情交给分段加载器按页取。
 * 详情失败返回 null（统一入口已提示）。
 */
export const getSongListMultiPageData = async (
  platformData: PlatformData,
): Promise<CollectionSegments | null> => {
  try {
    if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");
    const songListDetail = await NeteaseMusicAPI.getSongListDetail(
      platformData.neteaseMusic.id,
    );
    if (!songListDetail) return null;
    const ids = songListDetail.playlist.trackIds.map((item) => item.id);
    return collectionSegments(ids);
  } catch (error) {
    ShowMessage.show((error as Error).message);
    ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
    return null;
  }
};

/** 专辑内页：同歌单，id 列表取自专辑详情。 */
export const getAlbumMultiPageData = async (
  platformData: PlatformData,
): Promise<CollectionSegments | null> => {
  try {
    if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");
    const albumDetails = await NeteaseMusicAPI.getAlbumDetail(
      platformData.neteaseMusic.id,
    );
    if (!albumDetails) return null;
    const ids = albumDetails.songs.map((item) => item.id);
    return collectionSegments(ids);
  } catch (error) {
    ShowMessage.show((error as Error).message);
    ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
    return null;
  }
};
