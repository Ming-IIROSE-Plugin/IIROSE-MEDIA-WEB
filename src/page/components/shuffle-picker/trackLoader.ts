// 面板展开歌单/专辑时的曲目加载：经既有 NeteaseMusicAPI（内部走 neteaseRequest），
// 会话内按收藏 id 缓存成功结果；失败返回 null 且不缓存，重试会重新请求。
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import { NeteaseMusicAPI } from "../../../Api/NeteaseAPI/NeteaseMusic";
import type { PickerTrack } from "./pickerModel";

const cache = new Map<string, PickerTrack[]>();
const pending = new Map<string, Promise<PickerTrack[] | null>>();

type RawTrack = { id: number; name: string; ar?: { name: string }[] };

function toTracks(raw: RawTrack[]): PickerTrack[] {
  return raw.map((track) => ({
    id: String(track.id),
    name: track.name ?? "",
    artist: (track.ar ?? []).map((artist) => artist.name).join(" / "),
  }));
}

/** 只有网易云歌单/专辑能展开；B 站视频与单曲只能整条勾选。 */
export function canExpand(record: FavoriteRecord): boolean {
  return (
    record.platform === "netease" &&
    (record.type === "playlist" || record.type === "album") &&
    !!record.platformData.neteaseMusic?.id
  );
}

export function cachedTracks(id: string): PickerTrack[] | undefined {
  return cache.get(id);
}

/**
 * 歌单以 trackIds 为准（随机抽取也取 trackIds）：`tracks` 可能不完整，
 * 缺名字的曲目再经 getNeteaseSongDetail 补齐；补齐失败按加载失败处理。
 */
async function playlistTracks(
  tracks: RawTrack[],
  trackIds: { id: number }[],
): Promise<PickerTrack[] | null> {
  if (!trackIds.length) return toTracks(tracks);
  const named = new Map(toTracks(tracks).map((track) => [track.id, track]));
  const missing = trackIds
    .map((item) => item.id)
    .filter((trackId) => !named.has(String(trackId)));
  if (missing.length) {
    const songs = await NeteaseMusicAPI.getNeteaseSongDetail(missing);
    if (!songs) return null;
    for (const song of songs)
      named.set(String(song.id), {
        id: String(song.id),
        name: song.name ?? "",
        artist: (song.artists ?? []).map((artist) => artist.name).join(" / "),
      });
  }
  return trackIds.map(
    (item) =>
      named.get(String(item.id)) ?? {
        id: String(item.id),
        name: `#${item.id}`,
        artist: "",
      },
  );
}

async function fetchTracks(
  record: FavoriteRecord,
): Promise<PickerTrack[] | null> {
  const id = record.platformData.neteaseMusic?.id;
  if (!canExpand(record) || !id) return null;
  try {
    if (record.type === "album") {
      const detail = await NeteaseMusicAPI.getAlbumDetail(id);
      if (!detail) return null;
      return toTracks((detail.songs ?? []) as RawTrack[]);
    }
    const detail = await NeteaseMusicAPI.getSongListDetail(id);
    if (!detail) return null;
    return await playlistTracks(
      (detail.playlist?.tracks ?? []) as RawTrack[],
      detail.playlist?.trackIds ?? [],
    );
  } catch {
    return null;
  }
}

export function loadTracks(
  record: FavoriteRecord,
): Promise<PickerTrack[] | null> {
  const hit = cache.get(record.id);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(record.id);
  if (inflight) return inflight;
  const request = fetchTracks(record).then((tracks) => {
    pending.delete(record.id);
    if (tracks) cache.set(record.id, tracks);
    return tracks;
  });
  pending.set(record.id, request);
  return request;
}

/** 测试用：清空会话缓存。 */
export function clearTrackCache(): void {
  cache.clear();
  pending.clear();
}
