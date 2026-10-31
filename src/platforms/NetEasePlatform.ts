import { NeteaseMusicAPI } from "../Api/NeteaseAPI/NeteaseMusic";
import {
  isBatchActive,
  startBatch,
  type BatchHandle,
} from "../playback/BatchProgress";
import { guardedRequest } from "../playback/RequestGuard";
import { NeteaseSearchAPI } from "../Api/NeteaseAPI/NeteaseSearch";
import { SearchData } from "../Api/NeteaseAPI/NeteaseSearch/SearchInterface";
import {
  openEpisodePicker,
  type EpisodePickEntry,
} from "../page/components/episode-picker/openEpisodePicker";
import { IIROSEUtils } from "../iirose_func/IIROSEUtils";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { Socket } from "../iirose_func/Socket";
import { Announce } from "../iirose_func/Socket/Announce";
import { Media } from "../iirose_func/Socket/Media";
import { NetEaseSettings } from "../settings/neteaseSettings/NetEaseSettings";
import { Platform } from "./Platform";

/** 歌单 / 专辑详情里的曲目（两套端点返回同一形状的 song 对象，只取用到的字段）。 */
interface CollectionTrack {
  id: number;
  name?: string;
  ar?: { name: string }[];
  /** 毫秒（song 对象上的 `dt` / `duration` 都是毫秒）。 */
  dt?: number;
  duration?: number;
}

export class NetEasePlatform extends Platform {
  public static buildSelect = (action: (select: number) => Promise<void>) => {
    function cb(_t: HTMLElement, s: string) {
      const selectNumber = parseInt(s);
      action(selectNumber);
    }

    function enterCB() {}

    const select = [
      [
        0,
        "正序点播",
        `<div class="mdi-sort-alphabetical-variant" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
      ],
      [
        1,
        "乱序点播",
        `<div class="mdi-sort" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
      ],
      [
        2,
        "选集点播",
        `<div class="mdi-playlist-check" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
      ],
    ];

    const startElement = null;
    const multiSelect = false;
    const allowClear = false;
    const showIcon = true;
    const topHTMLELEMENT = null;
    const bottomHTMLELEMENT = null;

    IIROSEUtils.buildSelect2(
      startElement,
      select,
      cb,
      allowClear,
      showIcon,
      topHTMLELEMENT,
      multiSelect,
      bottomHTMLELEMENT,
      enterCB,
    );
  };

  /**
   * 选集（CAP-8）：插件自有选集面板——歌单 / 专辑曲目按点选顺序点播。
   * 详情在面板的 `load` 里取（失败留在面板里可重试），一级菜单（正序 / 乱序 / 选集）保留：
   * 「整张点播」在收藏里只靠它。
   */
  /**
   * 歌单曲目骨架（选集面板用）：`trackIds` 才是完整列表与顺序，详情接口的 `tracks`
   * 在部分网络 / 未登录时只给前 10 首（千首歌单曾只列出 10 首）。这里**不发请求**：
   * 有详情的曲目带名字，其余只有 id，由 `fetchSongDetailsPooled` 在后台补；
   * 上万首的歌单因此能立刻列出，不必等全部详情取回。
   */
  public static playlistSkeleton = (playlist: {
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

  /** 每批 100 个 id、同时进行的请求数：上万首要 100 批，串行要几分钟，并发 4 路约四分之一。 */
  public static readonly DETAIL_CHUNK = 100;
  public static readonly DETAIL_CONCURRENCY = 4;

  /**
   * 并发取歌曲详情：每批到达就回调 `onChunk`，随时可由 `signal` 中止（关面板即停）。
   * 单批失败（`null`）跳过，对应曲目保留占位名；不抛错。
   */
  public static fetchSongDetailsPooled = async (
    ids: number[],
    options: {
      signal: AbortSignal;
      onChunk: (songs: SongDetailSong[]) => void;
      onProgress?: (done: number, total: number) => void;
    },
  ): Promise<void> => {
    const size = NetEasePlatform.DETAIL_CHUNK;
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += size)
      chunks.push(ids.slice(i, i + size));
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (!options.signal.aborted) {
        const at = next++;
        if (at >= chunks.length) return;
        const songs = await NeteaseMusicAPI.getNeteaseSongDetail(chunks[at]);
        if (options.signal.aborted) return;
        if (songs) options.onChunk(songs);
        done += chunks[at].length;
        options.onProgress?.(done, ids.length);
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(NetEasePlatform.DETAIL_CONCURRENCY, chunks.length) },
        worker,
      ),
    );
  };

  public static selectEpisodes = (platformData: PlatformData) => {
    if (!platformData.neteaseMusic) {
      ShowMessage.show("没有网易云音乐数据");
      return;
    }
    const id = platformData.neteaseMusic.id;
    const isSongList = !!platformData.neteaseMusic.isSongList;
    /** `load` 里记下的集合信息：确认时拼批量播报的标题 / 简介。 */
    let collection = { title: platformData.title, description: "" };

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
          typeof track.dt === "number"
            ? Math.round(track.dt / 1000)
            : typeof track.duration === "number"
              ? Math.round(track.duration / 1000)
              : undefined,
      }));

    /** 行 id 回填真实曲目 id（确认顺序 = 点选顺序）。 */
    const songIdOf = (entry: EpisodePickEntry) =>
      Number(entry.id.slice(entry.id.indexOf(":") + 1));

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
        await NetEasePlatform.fetchSongDetailsPooled(missing, {
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
                  duration: Math.round(song.duration / 1000),
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
          const skeleton = NetEasePlatform.playlistSkeleton(playlist);
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
        const ids = chosen.map(songIdOf);
        if (ids.length === 1) {
          // 单项：单曲播报窗口，卡片不被并行批量抑制吞掉
          void Announce.runSingleAnnounce(() =>
            NetEasePlatform.finalODSONG(ids),
          ).catch((error) => Announce.showBatchItemError(error));
          return;
        }
        // `finalODSONG` 按入参顺序重排详情结果，这里传的就是点选顺序
        const batch = startBatch(collection.title, ids.length);
        void Promise.resolve(
          Announce.runBatchAnnounce(
            collection.title,
            ids.length,
            () => NetEasePlatform.finalODSONG(ids, batch),
            collection.description,
          ),
        ).finally(() => batch.finish());
      },
    });
  };

  private static Search = async (
    keyword: string,
    page: number,
    type: "song" | "playlist" | "album" | "mv" | "radio",
  ) => {
    let ids: number[] = [];
    let totalResult = 0;
    let totalPage = 0;
    let mediaCardData: PlatformData[] = [];
    const offset = (page - 1) * 100;
    let searchType = 1;

    if (type === "song") searchType = 1;
    if (type === "playlist") searchType = 1000;
    if (type === "album") searchType = 10;
    if (type === "mv") searchType = 1004;
    if (type === "radio") searchType = 1009;

    let searchData: SearchData | null = null;

    if (keyword.includes("id=")) {
      const id = parseInt(keyword.split("id=")[1]);
      ids.push(id);

      if (type === "song") {
        return { ids, totalPage: 1 };
      } else if (type === "playlist") {
        let songListDetail: SongList | null = null;
        songListDetail = await NeteaseMusicAPI.getSongListDetail(id);
        if (!songListDetail) return null;
        const playList = songListDetail.playlist;
        mediaCardData = [
          {
            title: playList.name,
            coverImg: playList.coverImgUrl,
            author: playList.creator?.nickname || "无法获取",
            websiteUrl: `https://music.163.com/#/playlist?id=${playList.id}`,
            trackCount: `${playList.trackCount}`,
            multiPage: Promise.resolve({ platform: "neteasemusic" }),
            neteaseMusic: {
              id: playList.id,
              isSongList: true,
              fee: 0,
            },
          },
        ];
        return { ids, totalPage: 1, mediaCardData };
      } else if (type === "album") {
        let albumDetail: AlbumData | null = null;
        albumDetail = await NeteaseMusicAPI.getAlbumDetail(id);

        if (!albumDetail) return null;
        const album = albumDetail.album;
        mediaCardData = [
          {
            title: album.name,
            coverImg: album.picUrl,
            author: album.artist.name,
            websiteUrl: `https://music.163.com/#/album?id=${album.id}`,
            trackCount: `${album.size}`,
            multiPage: Promise.resolve({ platform: "neteasemusic" }),
            neteaseMusic: {
              id: album.id,
              isAlbum: true,
              fee: albumDetail.songs[0].fee,
            },
          },
        ];
        return { ids, totalPage: 1, mediaCardData };
      }
    }

    searchData = await NeteaseSearchAPI.getNeteaseMusicSearchData(
      keyword,
      searchType,
      offset,
    );

    if (!searchData || !searchData.result) {
      return null;
    }

    const result = searchData.result;

    if (result.songs && result.songCount) {
      ids = result.songs.map((item) => item.id);
      totalResult = result.songCount;
    } else if (result.playlists && result.playlistCount) {
      ids = result.playlists.map((item) => item.id);
      totalResult = result.playlistCount;
      mediaCardData = result.playlists.map((item) => {
        return {
          title: item.name,
          coverImg: item.coverImgUrl,
          author: item.creator.nickname,
          websiteUrl: `https://music.163.com/#/playlist?id=${item.id}`,
          trackCount: `${item.trackCount}`,
          multiPage: Promise.resolve({ platform: "neteasemusic" }),
          neteaseMusic: {
            id: item.id,
            isSongList: true,
            fee: 0,
          },
        };
      });
    } else if (result.albums && result.albumCount) {
      ids = result.albums.map((item) => item.id);
      totalResult = result.albumCount;
      mediaCardData = result.albums.map((item) => {
        return {
          title: item.name,
          coverImg: item.picUrl,
          author: item.artist.name,
          websiteUrl: `https://music.163.com/#/album?id=${item.id}`,
          trackCount: `${item.size}`,
          multiPage: Promise.resolve({ platform: "neteasemusic" }),
          neteaseMusic: {
            id: item.id,
            isAlbum: true,
            fee: 0,
          },
        };
      });
    } else if (result.mvs && result.mvCount) {
      ids = result.mvs.map((item) => item.id);
      totalResult = result.mvCount;
      mediaCardData = result.mvs.map((item) => {
        return {
          title: item.name,
          coverImg: item.cover,
          author: item.artistName || item.artists[0].name,
          websiteUrl: `https://music.163.com/#/mv?id=${item.id}`,
          neteaseMusic: {
            id: item.id,
            isMV: true,
            fee: 0,
          },
        };
      });
    } else if (result.djRadios) {
      ids = result.djRadios.map((item) => item.id);

      mediaCardData = result.djRadios.map((item) => {
        return {
          title: item.name,
          coverImg: item.picUrl,
          author: item.dj.nickname,
          websiteUrl: `https://music.163.com/#/djradio?id=${item.id}`,
          trackCount: `${item.programCount}`,
          neteaseMusic: {
            id: item.id,
            isDjRadios: true,
            fee: 0,
          },
        };
      });
    } else {
      return null;
    }

    totalPage = Math.ceil(totalResult / this.itemPerPage);

    return { ids, totalPage, result: searchData.result, mediaCardData };
  };

  public static getNeteasePlatformData = async (
    ids: number[],
    type: "song" | "playlist" | "album" | "mv" | "radio",
  ) => {
    const PlatformData: PlatformData[] = [];

    if (type === "song") {
      const songDetail = await NeteaseMusicAPI.getNeteaseSongDetail(ids);

      if (!songDetail) return null;

      for (const item of songDetail) {
        const data: PlatformData = {
          title: item.name,
          subtitle: item?.transNames?.[0] || item.alias[0],
          coverImg: item.album.picUrl || item.album.blurPicUrl,
          author: item.artists[0].name,
          websiteUrl: `https://music.163.com/#/song?id=${item.id}`,
          duration: Math.ceil(item.duration / 1000),
          neteaseMusic: {
            id: item.id,
            fee: item.fee,
          },
        };
        PlatformData.push(data);
      }
      return PlatformData;
    } else if (type === "playlist") {
      let songListDetail: SongList | null = null;
      songListDetail = await NeteaseMusicAPI.getSongListDetail(ids[0]);

      // 统一入口已在全节点失败时提示过，这里直接空返回，避免再弹一遍
      if (!songListDetail) return null;

      const platformData: PlatformData = {
        title: songListDetail.playlist.name,
        coverImg: songListDetail.playlist.coverImgUrl,
        author: songListDetail.playlist.creator?.nickname || "无法获取",
        websiteUrl: `https://music.163.com/#/playlist?id=${songListDetail.playlist.id}`,
        trackCount: `${songListDetail.playlist.trackCount}`,
        multiPage: Promise.resolve({ platform: "neteasemusic" }),
        neteaseMusic: {
          id: songListDetail.playlist.id,
          isSongList: true,
          fee: songListDetail.privileges[0]?.fee || 0,
        },
      };

      return [platformData];
    } else if (type === "album") {
      let albumDetails: AlbumData | null = null;
      albumDetails = await NeteaseMusicAPI.getAlbumDetail(ids[0]);

      if (!albumDetails) return null;
      const platformData: PlatformData = {
        title: albumDetails.album.name,
        coverImg: albumDetails.album.picUrl,
        author: albumDetails.album.artist.name,
        websiteUrl: `https://music.163.com/#/album?id=${albumDetails.album.id}`,
        trackCount: `${albumDetails.album.size}`,
        multiPage: Promise.resolve({ platform: "neteasemusic" }),
        neteaseMusic: {
          id: albumDetails.album.id,
          isAlbum: true,
          fee: albumDetails.songs[0]?.fee || 0,
        },
      };
      return [platformData];
    }
  };

  /**
   * 搜索歌单
   * @param keyword
   * @param page
   * @returns
   */
  public static searchForMusicsBasicsData = async (
    keyword: string,
    page: number,
  ) => {
    try {
      const platformData: PlatformData[] = [];
      const allPlatformData: PlatformData[] = [];

      const searchData = await this.Search(keyword, page, "song");

      if (!searchData)
        return { platformData: [], totalPage: 0, allPlatformData: [] };

      const ids = searchData.ids;
      const totalPage = searchData.totalPage;

      const pd = await this.getNeteasePlatformData(ids, "song");

      if (!pd) return { platformData: [], totalPage: 0, allPlatformData: [] };

      let count = 0;

      for (const item of pd) {
        const data = item;
        if (count >= this.itemPerPage) {
          allPlatformData.push(data);
        } else {
          allPlatformData.push(data);
          platformData.push(data);
        }
        count++;
      }

      return { platformData, totalPage, allPlatformData };
    } catch (error) {
      ShowMessage.show((error as Error).message);
      ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
      return { platformData: [], totalPage: 0, allPlatformData: [] };
    }
  };

  /**
   * @description 搜索歌单
   * @param keyword
   * @param page
   * @returns
   */
  public static searchForMusicListBasicsData = async (
    keyword: string,
    page: number,
  ) => {
    try {
      const searchData = await this.Search(keyword, page, "playlist");
      if (!searchData)
        return { platformData: [], totalPage: 0, allPlatformData: [] };

      const mediaCardData = searchData.mediaCardData;

      const totalPage = searchData.totalPage;

      const platformData: PlatformData[] = [];

      const allPlatformData: PlatformData[] = [];

      let count = 0;

      if (!mediaCardData)
        return { platformData: [], totalPage: 0, allPlatformData: [] };

      for (const item of mediaCardData) {
        const data = item;

        if (count >= this.itemPerPage) {
          allPlatformData.push(data);
        } else {
          allPlatformData.push(data);
          platformData.push(data);
        }

        count++;
      }

      return { platformData, totalPage, allPlatformData };
    } catch (error) {
      ShowMessage.show((error as Error).message);
      ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
      return { platformData: [], totalPage: 0, allPlatformData: [] };
    }
  };

  /**
   * @description 搜索专辑
   * @param keyword
   * @param page
   * @returns
   */
  public static searchForAlbumBasicsData = async (
    keyword: string,
    page: number,
  ) => {
    try {
      const platformData: PlatformData[] = [];

      const allPlatformData: PlatformData[] = [];

      const searchData = await this.Search(keyword, page, "album");
      if (!searchData)
        return { platformData: [], totalPage: 0, allPlatformData: [] };

      const totalPage = searchData.totalPage;

      const mediaCardData = searchData.mediaCardData;

      if (!mediaCardData)
        return { platformData: [], totalPage: 0, allPlatformData: [] };

      let count = 0;

      for (const item of mediaCardData) {
        const data = item;
        if (count >= this.itemPerPage) {
          allPlatformData.push(data);
        } else {
          allPlatformData.push(data);
          platformData.push(data);
        }
        count++;
      }

      return { platformData, totalPage, allPlatformData };
    } catch (error) {
      ShowMessage.show((error as Error).message);
      ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
      return { platformData: [], totalPage: 0, allPlatformData: [] };
    }
  };

  /**
   * @description 搜索MV
   * @param keyword
   * @param page
   * @returns
   */
  public static searchForMVBasicsData = async (
    keyword: string,
    page: number,
  ) => {
    try {
      const platformData: PlatformData[] = [];

      const allPlatformData: PlatformData[] = [];

      const searchData = await this.Search(keyword, page, "mv");

      if (!searchData)
        return { platformData: [], totalPage: 0, allPlatformData: [] };

      const totalPage = searchData.totalPage;

      const mediaCardData = searchData.mediaCardData;

      if (!mediaCardData)
        return { platformData: [], totalPage: 0, allPlatformData: [] };

      let count = 0;

      for (const item of mediaCardData) {
        const data = item;

        if (count >= this.itemPerPage) {
          allPlatformData.push(data);
        } else {
          allPlatformData.push(data);
          platformData.push(data);
        }

        count++;
      }
      return { platformData, totalPage, allPlatformData };
    } catch (error) {
      ShowMessage.show((error as Error).message);
      ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
      return { platformData: [], totalPage: 0, allPlatformData: [] };
    }
  };

  public static getSongListMultiPageData = async (
    platformData: PlatformData,
  ) => {
    try {
      if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");

      let songListDetail: SongList | null = null;

      const id = platformData.neteaseMusic.id;

      const neteaseSetting = NetEaseSettings.getNeteaseMusicSetting();

      const neteaseAPI = neteaseSetting.api;

      songListDetail = await NeteaseMusicAPI.getSongListDetail(id);

      if (!songListDetail)
        return { platformData: [], totalPage: 0, allPlatformData: [] };
      const ids = songListDetail.playlist.trackIds.map((item) => item.id);

      return this.processSongPlatformData(ids);
    } catch (error) {
      ShowMessage.show((error as Error).message);
      ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
      return { platformData: [], totalPage: 0, allPlatformData: [] };
    }
  };

  public static getAlbumMultiPageData = async (platformData: PlatformData) => {
    try {
      if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");

      let albumDetails: AlbumData | null = null;

      const id = platformData.neteaseMusic.id;

      albumDetails = await NeteaseMusicAPI.getAlbumDetail(id);

      if (!albumDetails)
        return { platformData: [], totalPage: 0, allPlatformData: [] };

      const ids = albumDetails.songs.map((item) => item.id);

      return this.processSongPlatformData(ids);
    } catch (error) {
      ShowMessage.show((error as Error).message);
      ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
      return { platformData: [], totalPage: 0, allPlatformData: [] };
    }
  };

  public static processSongPlatformData = async (trackID: number[]) => {
    const platformData: PlatformData[] = [];

    const allPlatformData: PlatformData[] = [];

    const totalResult = trackID.length;

    const totalPage = Math.ceil(totalResult / this.itemPerPage);

    let count = 0;

    const songDetail = await NeteaseMusicAPI.getNeteaseSongDetail(trackID);
    if (!songDetail)
      return { platformData: [], totalPage: 0, allPlatformData: [] };

    for (const item of songDetail) {
      const data: PlatformData = {
        title: item.name,
        subtitle: item?.transNames?.[0] || item.alias[0],
        coverImg: item.album.picUrl || item.album.blurPicUrl,
        author: item.artists[0].name,
        websiteUrl: `https://music.163.com/#/song?id=${item.id}`,
        duration: Math.ceil(item.duration / 1000),
        neteaseMusic: {
          id: item.id,
          fee: item.fee,
        },
      };
      if (count >= this.itemPerPage) {
        allPlatformData.push(data);
      } else {
        allPlatformData.push(data);
        platformData.push(data);
      }
      count++;
    }

    return {
      platformData: platformData,
      totalPage,
      allPlatformData: allPlatformData,
    };
  };

  /**
   * @description 合并歌词
   * @param jpLyrics
   * @param cnLyrics
   * @returns
   */
  private static mergeLyrics = (jpLyrics: string, cnLyrics: string): string => {
    const neteaseSetting = NetEaseSettings.getNeteaseMusicSetting();

    const lyricOption = neteaseSetting.lyricOption;

    if (lyricOption === "off") return "";

    if (lyricOption === "original") return jpLyrics;

    if (lyricOption === "translated") return cnLyrics;

    const jpLines = jpLyrics.split("\n");
    const cnLines = cnLyrics.split("\n");

    const jpEntries: { [key: string]: string } = {};
    const cnEntries: { [key: string]: string } = {};

    // Parse Japanese lyrics
    for (const line of jpLines) {
      const timeRegex = /\[(\d+:\d+\.\d+)\]/;
      const timeMatch = line.match(timeRegex);
      if (timeMatch) {
        const time = timeMatch[1];
        const content = line.replace(timeRegex, "").trim();
        jpEntries[time] = content;
      }
    }

    // Parse Chinese lyrics
    for (const line of cnLines) {
      const timeRegex = /\[(\d+:\d+\.\d+)\]/;
      const timeMatch = line.match(timeRegex);
      if (timeMatch) {
        const time = timeMatch[1];
        const content = line.replace(timeRegex, "").trim();
        cnEntries[time] = content;
      }
    }

    // Merge and format
    const mergedLines: {
      time: string;
      content: string;
      translation: string;
    }[] = [];
    for (const time in jpEntries) {
      const jpContent = jpEntries[time];
      const cnContent = cnEntries[time] || ""; // Use empty string if no translation

      mergedLines.push({ time, content: jpContent, translation: cnContent });
    }

    // Format the merged lines
    const mergedOutput = mergedLines
      .map((line) => {
        const { time, content, translation } = line;
        let outputLine = `[${time}] ${content}`;
        if (translation) {
          outputLine += ` | ${translation}`;
        }
        return outputLine;
      })
      .join("\n");

    return mergedOutput;
  };

  /** 等概率洗牌（Fisher–Yates）：`sort(() => Math.random() - 0.5)` 的分布不均。 */
  private static shuffleIds(ids: number[]): number[] {
    const result = [...ids];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * @description 整张点播（专辑 / 歌单）：按所选顺序批量点播全部曲目。
   * 宿站弹窗入口（`MLOD` / `AOD` 的 select 0/1）与内页头「全部播放」共用本入口，
   * 因而不需要 `buildSelect2`，也不需要跨弹窗的 300ms 延迟。
   */
  public static playCollectionAll = async (
    platformData: PlatformData,
    order: "asc" | "shuffle",
  ) => {
    try {
      if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");
      const id = platformData.neteaseMusic.id;

      // 同一张歌单 / 专辑的整张点播还在准备或发送：再点不另开第二轮（两轮会交错刷屏）
      if (isBatchActive(platformData.title)) {
        ShowMessage.show(`《${platformData.title}》正在点播中`);
        return;
      }

      if (platformData.neteaseMusic.isSongList) {
        const songListDetail = await NeteaseMusicAPI.getSongListDetail(id);
        // 失败提示已由统一入口发出，这里静默结束本次点播
        if (!songListDetail) return;
        const trackID = songListDetail.playlist.trackIds.map((item) => item.id);
        const ids =
          order === "shuffle" ? NetEasePlatform.shuffleIds(trackID) : trackID;
        // 进度浮窗：关掉点播面板也还在，可随时停止
        const batch = startBatch(songListDetail.playlist.name, ids.length);
        void Promise.resolve(
          Announce.runBatchAnnounce(
            songListDetail.playlist.name,
            ids.length,
            () => NetEasePlatform.finalODSONG(ids, batch),
            songListDetail.playlist.description,
          ),
        ).finally(() => batch.finish());
        return;
      }

      if (platformData.neteaseMusic.isAlbum) {
        const albumDetails = await NeteaseMusicAPI.getAlbumDetail(id);
        if (!albumDetails) return;
        const songsID = albumDetails.songs.map((item) => item.id);
        const ids =
          order === "shuffle" ? NetEasePlatform.shuffleIds(songsID) : songsID;
        const batch = startBatch(albumDetails.album.name, ids.length);
        void Promise.resolve(
          Announce.runBatchAnnounce(
            albumDetails.album.name,
            ids.length,
            () => NetEasePlatform.finalODSONG(ids, batch),
            albumDetails.album.description,
          ),
        ).finally(() => batch.finish());
        return;
      }

      throw new Error("这不是专辑或歌单");
    } catch (error) {
      // 抛出物未必是 Error：统一成可读文案，别把 `undefined` 提示给用户
      ShowMessage.show(
        error instanceof Error ? error.message : String(error || "点播失败"),
      );
    }
  };

  /**
   * @description 点播歌单
   * @param platformData
   */
  public static MLOD = (platformData: PlatformData) => {
    const MLODACTION = async (select: number) => {
      // 整单正序 / 乱序：与内页头「全部播放」同一入口
      if (select === 0 || select === 1) {
        // 选完顺序后交给点播守卫：这一行的点播按钮转圈到第一首发出
        await guardedRequest(platformData, () =>
          NetEasePlatform.playCollectionAll(
            platformData,
            select === 0 ? "asc" : "shuffle",
          ),
        );
        return;
      }

      // 选集：插件自有面板（详情在面板里取，点选顺序 = 播放顺序）
      if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");
      NetEasePlatform.selectEpisodes(platformData);
    };

    try {
      if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");
      this.buildSelect(MLODACTION);
    } catch (error) {
      ShowMessage.show((error as Error).message);
    }
  };

  /**
   * @description 点播专辑
   * @param platformData
   */
  public static AOD = (platformData: PlatformData) => {
    const AODACTION = async (select: number) => {
      // 整单正序 / 乱序：与内页头「全部播放」同一入口
      if (select === 0 || select === 1) {
        // 选完顺序后交给点播守卫：这一行的点播按钮转圈到第一首发出
        await guardedRequest(platformData, () =>
          NetEasePlatform.playCollectionAll(
            platformData,
            select === 0 ? "asc" : "shuffle",
          ),
        );
        return;
      }

      // 选集：插件自有面板（详情在面板里取，点选顺序 = 播放顺序）
      if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");
      NetEasePlatform.selectEpisodes(platformData);
    };

    try {
      if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");
      this.buildSelect(AODACTION);
    } catch (error) {
      ShowMessage.show((error as Error).message);
    }
  };

  /**
   * @description 点播歌曲
   * @param platformData
   */
  public static MOD = (platformData: PlatformData) => {
    try {
      if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");
      const id = platformData.neteaseMusic.id;
      // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
      // 返回发送过程：点播守卫据此显示「点播中 / 已点播」
      return Announce.runSingleAnnounce(() => this.finalODSONG([id])).catch(
        (e) => Announce.showBatchItemError(e),
      );
    } catch (error) {
      ShowMessage.show((error as Error).message);
    }
  };

  public static MVOD = async (platformData: PlatformData) => {
    try {
      if (!platformData.neteaseMusic || !platformData.duration)
        throw new Error("没有网易云音乐数据");

      // const xcAPI = window.netease?.xcAPI
      // let xcRes: xcSongResource | null = null
      const id = platformData.neteaseMusic.id;

      const res = await NeteaseMusicAPI.getMVPlayURL(id);

      // 请求层失败已提示过；`res.data` 为空才是内容侧失败，仍按原文案提示
      if (!res) return;
      if (!res.data) throw new Error("获取MV资源失败");

      if (res.data.msg) throw new Error(res.data.msg);

      const playUrl = res.data.url;

      const media = new Media();

      const mediaData: MediaData = {
        type: "video",
        name: platformData.title,
        singer: platformData.author,
        cover: await platformData.coverImg,
        link: platformData.websiteUrl,
        url: playUrl,
        duration: platformData.duration,
        bitRate: 1080,
        color: this.baseHex,
        origin: "netEaseMV",
      };

      const mediacard = media.mediaCard(mediaData);

      const mediaEvent = media.mediaEvent(mediaData);

      const socket = new Socket();

      // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
      await Announce.runSingleAnnounce(async () => {
        Announce.sendMediaCard(socket, mediacard);
        socket.send(mediaEvent);
      });
    } catch (error) {
      ShowMessage.show((error as Error).message);
    }
  };

  /**
   * @param batch 批量点播进度句柄（整张播放 / 选集多选）：逐首上报，
   *   每首发送前检查「停止」；单曲点播不传。
   */
  private static finalODSONG = async (
    songsID: number[],
    batch?: BatchHandle,
  ) => {
    try {
      await NetEasePlatform.sendSongs(songsID, batch);
    } finally {
      batch?.finish();
    }
  };

  private static sendSongs = async (songsID: number[], batch?: BatchHandle) => {
    const media = new Media();
    const socket = new Socket();
    const neteaseSetting = NetEaseSettings.getNeteaseMusicSetting();

    let songDetailSongs: SongDetailSong[] | null = null;
    let songDetailFromBinaryify: SongsFromBinaryify[] | null = null;
    songDetailSongs = await NeteaseMusicAPI.getNeteaseSongDetail(songsID);
    if (!songDetailSongs && !songDetailFromBinaryify) return;
    const quality = neteaseSetting.quality;

    if (songDetailSongs) {
      const songMap = new Map(songDetailSongs.map((s) => [s.id, s]));
      const orderedSongs = songsID
        .map((id) => songMap.get(id))
        .filter((s): s is SongDetailSong => Boolean(s));

      // 无版权曲目按批聚合计数：循环结束统一提示一次，不逐曲刷屏
      let noCopyrightSkipped = 0;
      batch?.setTotal(orderedSongs.length);

      for (const item of orderedSongs) {
        if (batch?.cancelled) break;
        if (item.noCopyrightRcmd) {
          noCopyrightSkipped++;
          batch?.step();
          continue;
        }
        try {
          let playUrl = "";
          // playUrl = `https://v.iarc.top/?type=url&id=${item.id}#.mp3`;
          playUrl = `https://1309510434-1fsutl4dzp.ap-hongkong.tencentscf.com/musicstreamlink/?platform=netease&id=${item.id}&quality=320&vip=${item.fee}#.mp3`;
          //playUrl = `https://1309510434-k3dderqeb9.ap-guangzhou.tencentscf.com/musicstreamlink/?platform=netease&id=${item.id}&quality=320&vip=${item.fee}#.mp3`;
          const lyrdata = await NeteaseMusicAPI.getLyric(item.id);

          let lyric = ``;

          if (lyrdata && lyrdata.lrc && lyrdata.tlyric) {
            lyric = this.mergeLyrics(lyrdata.lrc.lyric, lyrdata.tlyric.lyric);
          } else if (lyrdata && lyrdata.lrc) {
            lyric = lyrdata.lrc.lyric;
          }
          const mediaData: MediaData = {
            type: "music",
            name: item.name,
            singer: item.artists[0].name,
            cover: item.album.picUrl,
            link: `https://music.163.com/#/song?id=${item.id}`,
            url: playUrl,
            duration: item.duration / 1000,
            bitRate: 320,
            color: this.baseHex,
            lyrics: lyric,
            origin: "netease",
          };

          const mediacard = media.mediaCard(mediaData);
          const mediaEvent = media.mediaEvent(mediaData);

          // 取歌词期间用户点了「停止」：这一首也不再发
          if (batch?.cancelled) break;
          Announce.sendMediaCard(socket, mediacard);
          socket.send(mediaEvent);
        } catch (error) {
          // 单项失败：带曲名提示（同因 10 秒去重）后跳过，剩余曲目照播
          Announce.showBatchItemError(error, item.name);
        }
        batch?.step();
      }

      if (noCopyrightSkipped > 0) {
        ShowMessage.show(`已跳过 ${noCopyrightSkipped} 首无版权曲目`);
      }
    }
  };

  private static convertQualityToReadable = (
    quality: NeteaseSongQuality,
  ): string => {
    switch (quality) {
      case "standard":
        return "标准音质";

      case "higher":
        return "较高音质";

      case "exhigh":
        return "极高音质";

      case "lossless":
        return "无损音质";

      case "hires":
        return "Hi-Res";

      case "jyeffect":
        return "高清环绕声";

      case "sky":
        return "沉浸环绕声";

      case "jymaster":
        return "超清母带";

      default: {
        // 理论上不会执行到这里
        const _exhaustive: never = quality;
        return _exhaustive;
      }
    }
  };
}
