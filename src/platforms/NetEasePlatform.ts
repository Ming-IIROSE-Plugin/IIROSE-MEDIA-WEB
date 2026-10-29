import { NeteaseMusicAPI } from "../Api/NeteaseAPI/NeteaseMusic";
import { NeteaseSearchAPI } from "../Api/NeteaseAPI/NeteaseSearch";
import { SearchData } from "../Api/NeteaseAPI/NeteaseSearch/SearchInterface";
import { IIROSEUtils } from "../iirose_func/IIROSEUtils";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { Socket } from "../iirose_func/Socket";
import { Announce } from "../iirose_func/Socket/Announce";
import { Media } from "../iirose_func/Socket/Media";
import { NetEaseSettings } from "../settings/neteaseSettings/NetEaseSettings";
import { Platform } from "./Platform";

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
   * 选集多选完成后的二次排序确认选择器
   */
  public static buildOrderConfirmSelect = (
    action: (select: number) => Promise<void> | void,
  ) => {
    const select = [
      [
        0,
        "正序播放",
        `<div class="mdi-sort-alphabetical-variant" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
      ],
      [
        1,
        "乱序播放",
        `<div class="mdi-sort" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
      ],
    ];

    IIROSEUtils.buildSelect2(
      null,
      select,
      (_t: HTMLElement, s: string) => {
        action(parseInt(s));
      },
      false,
      true,
      null,
      false,
      null,
      () => {},
    );
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

      if (platformData.neteaseMusic.isSongList) {
        const songListDetail = await NeteaseMusicAPI.getSongListDetail(id);
        // 失败提示已由统一入口发出，这里静默结束本次点播
        if (!songListDetail) return;
        const trackID = songListDetail.playlist.trackIds.map((item) => item.id);
        const ids =
          order === "shuffle" ? NetEasePlatform.shuffleIds(trackID) : trackID;
        void Announce.runBatchAnnounce(
          songListDetail.playlist.name,
          ids.length,
          () => NetEasePlatform.finalODSONG(ids),
          songListDetail.playlist.description,
        );
        return;
      }

      if (platformData.neteaseMusic.isAlbum) {
        const albumDetails = await NeteaseMusicAPI.getAlbumDetail(id);
        if (!albumDetails) return;
        const songsID = albumDetails.songs.map((item) => item.id);
        const ids =
          order === "shuffle" ? NetEasePlatform.shuffleIds(songsID) : songsID;
        void Announce.runBatchAnnounce(
          albumDetails.album.name,
          ids.length,
          () => NetEasePlatform.finalODSONG(ids),
          albumDetails.album.description,
        );
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
        await NetEasePlatform.playCollectionAll(
          platformData,
          select === 0 ? "asc" : "shuffle",
        );
        return;
      }

      if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");
      const id = platformData.neteaseMusic.id;
      const songListDetail = await NeteaseMusicAPI.getSongListDetail(id);

      // 失败提示已由统一入口发出，这里静默结束本次点播
      if (!songListDetail) return;

      const trackIds = songListDetail.playlist.trackIds;
      const trackID = trackIds.map((item) => item.id);

      if (select === 2) {
        // 选集多选点播
        const tracks = songListDetail.playlist.tracks || [];
        const playlistCover =
          (await platformData.coverImg) ||
          songListDetail.playlist.coverImgUrl ||
          "";
        const selectOptions = (tracks.length > 0 ? tracks : trackIds).map(
          (item: any, idx: number) => {
            const songId = item.id;
            const name = item.name || `曲目 ${idx + 1}`;
            const ar = item.ar?.map((a: any) => a.name).join("/") || "";
            const cover =
              item.al?.picUrl || item.album?.picUrl || playlistCover;
            return [
              songId,
              `${idx + 1}. ${name}${ar ? ` - ${ar}` : ""}`,
              IIROSEUtils.generatePicHtml(cover, "mdi-music-note"),
            ];
          },
        );

        IIROSEUtils.buildSelect2(
          null,
          selectOptions,
          (_t: HTMLElement, selected: any) => {
            const rawArr = Array.isArray(selected) ? selected : [selected];
            const checkedIds = rawArr
              .filter((x: any) => x !== "" && x !== null && x !== undefined)
              .map(Number);
            if (checkedIds.length === 0) {
              ShowMessage.show("未选择任何曲目");
              return;
            }
            if (checkedIds.length === 1) {
              // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
              void Announce.runSingleAnnounce(() =>
                NetEasePlatform.finalODSONG(checkedIds),
              ).catch((e) => Announce.showBatchItemError(e));
              return;
            }
            setTimeout(() => {
              NetEasePlatform.buildOrderConfirmSelect((order) => {
                if (order === 1) {
                  checkedIds.sort(() => Math.random() - 0.5);
                }
                void Announce.runBatchAnnounce(
                  songListDetail.playlist.name,
                  checkedIds.length,
                  () => NetEasePlatform.finalODSONG(checkedIds),
                  songListDetail.playlist.description,
                );
              });
            }, 300);
          },
          false,
          true,
          null,
          true,
          null,
          () => {},
        );
      }
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
        await NetEasePlatform.playCollectionAll(
          platformData,
          select === 0 ? "asc" : "shuffle",
        );
        return;
      }

      if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");
      const id = platformData.neteaseMusic.id;
      const albumDetails = await NeteaseMusicAPI.getAlbumDetail(id);

      if (!albumDetails) return;

      const Songs = albumDetails.songs;

      if (select === 2) {
        // 专辑选集多选点播
        const albumCover =
          albumDetails.album.picUrl || (await platformData.coverImg) || "";
        const selectOptions = Songs.map((item: any, idx: number) => {
          const songId = item.id;
          const name = item.name || `曲目 ${idx + 1}`;
          const ar = item.ar?.map((a: any) => a.name).join("/") || "";
          const cover = item.al?.picUrl || albumCover;
          return [
            songId,
            `${idx + 1}. ${name}${ar ? ` - ${ar}` : ""}`,
            IIROSEUtils.generatePicHtml(cover, "mdi-music-note"),
          ];
        });

        IIROSEUtils.buildSelect2(
          null,
          selectOptions,
          (_t: HTMLElement, selected: any) => {
            const rawArr = Array.isArray(selected) ? selected : [selected];
            const checkedIds = rawArr
              .filter((x: any) => x !== "" && x !== null && x !== undefined)
              .map(Number);
            if (checkedIds.length === 0) {
              ShowMessage.show("未选择任何曲目");
              return;
            }
            if (checkedIds.length === 1) {
              // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
              void Announce.runSingleAnnounce(() =>
                NetEasePlatform.finalODSONG(checkedIds),
              ).catch((e) => Announce.showBatchItemError(e));
              return;
            }
            setTimeout(() => {
              NetEasePlatform.buildOrderConfirmSelect((order) => {
                if (order === 1) {
                  checkedIds.sort(() => Math.random() - 0.5);
                }
                void Announce.runBatchAnnounce(
                  albumDetails.album.name,
                  checkedIds.length,
                  () => NetEasePlatform.finalODSONG(checkedIds),
                  albumDetails.album.description,
                );
              });
            }, 300);
          },
          false,
          true,
          null,
          true,
          null,
          () => {},
        );
      }
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
      void Announce.runSingleAnnounce(() => this.finalODSONG([id])).catch((e) =>
        Announce.showBatchItemError(e),
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

  private static finalODSONG = async (songsID: number[]) => {
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

      for (const item of orderedSongs) {
        if (item.noCopyrightRcmd) {
          noCopyrightSkipped++;
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

          Announce.sendMediaCard(socket, mediacard);
          socket.send(mediaEvent);
        } catch (error) {
          // 单项失败：带曲名提示（同因 10 秒去重）后跳过，剩余曲目照播
          Announce.showBatchItemError(error, item.name);
        }
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
