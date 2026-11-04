import { NeteaseMusicAPI } from "../../Api/NeteaseAPI/NeteaseMusic";
import {
  openEpisodePicker,
  type EpisodePickEntry,
} from "../../page/components/episode-picker/openEpisodePicker";
import { ShowMessage } from "../../iirose_func/ShowMessage";
import { playlistSkeleton } from "./collection";
import { collectionKey, millisOrZero, type CollectionTrack } from "./shared";

/** 面板在后台补详情 / 确认时回调回平台层：保持 `playSongIds` 等入口仍可被替换。 */
export interface CollectionPickerDeps {
  fetchDetails: (
    ids: number[],
    options: {
      signal: AbortSignal;
      onChunk: (songs: SongDetailSong[]) => void;
      onProgress?: (done: number, total: number) => void;
    },
  ) => Promise<void>;
  playIds: (
    ids: number[],
    title: string,
    description?: string,
    key?: string,
  ) => Promise<void>;
  /** 歌单骨架：与 `fetchDetails` 一样走注入，保证平台层的同名入口仍可被替换。 */
  playlistSkeleton: (
    playlist: Parameters<typeof playlistSkeleton>[0],
  ) => ReturnType<typeof playlistSkeleton>;
}

/**
 * 行 id 带位置（`位置:曲目id`）：同一首歌在歌单里重复出现时行仍唯一，
 * 否则一次点选会勾中两行、徽章重复、全选计数对不上。
 */
const entriesOf = (tracks: CollectionTrack[]): EpisodePickEntry[] =>
  tracks.map((track, index) => ({
    id: `${index}:${track.id}`,
    title: track.name || `曲目 ${index + 1}`,
    meta: track.ar?.map((artist) => artist.name).join("/") || "",
    duration:
      typeof track.dt === "number" && Number.isFinite(track.dt)
        ? Math.round(track.dt / 1000)
        : typeof track.duration === "number" && Number.isFinite(track.duration)
          ? Math.round(track.duration / 1000)
          : undefined,
  }));

/** 行 id 回填真实曲目 id（确认顺序 = 点选顺序）。 */
const songIdOf = (entry: EpisodePickEntry) =>
  Number(entry.id.slice(entry.id.indexOf(":") + 1));

/**
 * 选集（CAP-8）：插件自有选集面板——歌单 / 专辑曲目按点选顺序点播。
 * 详情在面板的 `load` 里取（失败留在面板里可重试），一级菜单（正序 / 乱序 / 选集）保留：
 * 「整张点播」在收藏里只靠它。
 */
export const openCollectionEpisodePicker = (
  platformData: PlatformData,
  deps: CollectionPickerDeps,
) => {
  if (!platformData.neteaseMusic) {
    ShowMessage.show("没有网易云音乐数据");
    return;
  }
  const id = platformData.neteaseMusic.id;
  const isSongList = !!platformData.neteaseMusic.isSongList;
  /** `load` 里记下的集合信息：确认时拼批量播报的标题 / 简介。 */
  let collection = { title: platformData.title, description: "" };

  /** 骨架里还没有名字的曲目 id（歌单才有；由 `enrich` 在后台补）。 */
  let missing: number[] = [];

  openEpisodePicker({
    unit: "首",
    enrich: async (entries, { patch, progress, signal }) => {
      if (!missing.length) return;
      // 曲目 id → 它在列表里的所有行（同一首歌可重复出现）
      const rowsOf = new Map<number, string[]>();
      for (const entry of entries) {
        const trackId = songIdOf(entry);
        rowsOf.set(trackId, [...(rowsOf.get(trackId) ?? []), entry.id]);
      }
      progress(0, missing.length);
      await deps.fetchDetails(missing, {
        signal,
        onProgress: progress,
        onChunk: (songs) => {
          const changes = new Map<string, Partial<EpisodePickEntry>>();
          for (const song of songs) {
            for (const rowId of rowsOf.get(song.id) ?? []) {
              changes.set(rowId, {
                title: song.name,
                meta:
                  song.artists?.map((artist) => artist.name).join("/") ?? "",
                duration: Math.round(millisOrZero(song.duration) / 1000),
              });
            }
          }
          patch(changes);
        },
      });
    },
    load: async () => {
      if (isSongList) {
        const detail = await NeteaseMusicAPI.getSongListDetail(id);
        if (!detail) throw new Error("获取歌单失败");
        const { playlist } = detail;
        collection = {
          title: playlist.name,
          description: playlist.description ?? "",
        };
        const skeleton = deps.playlistSkeleton(playlist);
        missing = skeleton.missing;
        return entriesOf(skeleton.tracks);
      }

      const detail = await NeteaseMusicAPI.getAlbumDetail(id);
      if (!detail) throw new Error("获取专辑失败");
      collection = {
        title: detail.album.name,
        description: detail.album.description ?? "",
      };
      return entriesOf(detail.songs ?? []);
    },
    onConfirm: (chosen) => {
      void deps.playIds(
        chosen.map(songIdOf),
        collection.title,
        collection.description,
        collectionKey(id, isSongList),
      );
    },
  });
};
