// 收藏随机的候选读取与「收藏记录 → 可播目标」解析。
// 从组合根挪出来：装配层只接线，平台/接口细节留在播放域内。
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import { FavoritesStorageService } from "../storage/FavoritesStorageService";
import { NetEasePlatform } from "../platforms/NetEasePlatform";
import { BilibiliPlatform } from "../platforms/BilibiliPlatform";
import { NeteaseMusicAPI } from "../Api/NeteaseAPI/NeteaseMusic";
import type { ShufflePrepareOptions, ShuffleTarget } from "./ShuffleController";
import { songKey } from "./ShuffleSelection";

/** 按平台读收藏；范围由随机选择决定，这里不再过滤类型。 */
export function queryShuffleCandidates(
  platform: "netease" | "bilibili",
): Promise<FavoriteRecord[]> {
  return FavoritesStorageService.query({ platform });
}

function httpsCover(value: string): string {
  return (value || "").replace(/^http:\/\//, "https://");
}

/** 在歌单/专辑曲目里挑一首：限定勾选曲目，跳过本轮已播与当前曲目。 */
function pickTrack<T>(
  items: T[],
  idOf: (item: T) => string,
  options: ShufflePrepareOptions,
  titleOf?: (item: T) => string,
): T | "exhausted" {
  const allowed = options.tracks ? new Set(options.tracks) : null;
  const pool = items.filter((item) => {
    const id = idOf(item);
    if (allowed && !allowed.has(id)) return false;
    if (options.exclude.has(songKey("netease", id))) return false;
    return !titleOf || titleOf(item) !== options.currentTitle;
  });
  if (!pool.length) return "exhausted";
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 收藏记录 → 可播目标；专辑/歌单只取其中一首（与手动点播的整张播放区分）。
 * 解析失败返回 null，由控制器换下一个候选；范围内曲目本轮都已播（或已不在歌单里）
 * 返回 "exhausted"，不计失败。
 */
export async function prepareShuffleTarget(
  record: FavoriteRecord,
  options: ShufflePrepareOptions,
): Promise<ShuffleTarget | "exhausted" | null> {
  if (record.type === "song" || record.type === "video") {
    const data = FavoritesStorageService.restorePlatformData(record);
    return {
      key: record.id,
      title: record.title,
      play: () =>
        record.platform === "bilibili"
          ? // 自动随机不能停下来等选集：多分 P 直接播第一集。
            BilibiliPlatform.VOD(data, 1)
          : NetEasePlatform.MOD(data),
    };
  }
  const id = record.platformData.neteaseMusic?.id;
  if (record.platform !== "netease" || !id) return null;
  let trackId: number;
  let title = "";
  let cover = record.coverImg;
  let author = record.author;
  if (record.type === "album") {
    const detail = await NeteaseMusicAPI.getAlbumDetail(id);
    const songs = detail?.songs ?? [];
    if (!songs.length) return null;
    const pick = pickTrack(
      songs,
      (song) => String(song.id),
      options,
      (song) => song.name,
    );
    if (pick === "exhausted") return pick;
    trackId = pick.id;
    title = pick.name;
    cover = pick.al?.picUrl || cover;
    author = pick.ar?.[0]?.name || author;
  } else {
    const list = await NeteaseMusicAPI.getSongListDetail(id);
    const ids = list?.playlist.trackIds ?? [];
    if (!ids.length) return null;
    // 歌单只有 id 列表、没有标题：当前曲目靠本轮已播身份排除。
    const pick = pickTrack(ids, (item) => String(item.id), options);
    if (pick === "exhausted") return pick;
    trackId = pick.id;
    const detail = await NeteaseMusicAPI.getNeteaseSongDetail([trackId]);
    const song = detail?.[0];
    if (!song) return null;
    title = song.name;
    cover = song.album?.picUrl || cover;
    author = song.artists?.[0]?.name || author;
  }
  const data = {
    title,
    coverImg: httpsCover(cover),
    author,
    websiteUrl: `https://music.163.com/#/song?id=${trackId}`,
    neteaseMusic: { id: trackId, fee: 0 },
  };
  return {
    key: songKey("netease", String(trackId)),
    title,
    play: () => NetEasePlatform.MOD(data),
  };
}
