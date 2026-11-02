import { NeteaseMusicAPI } from "../../Api/NeteaseAPI/NeteaseMusic";
import { NeteaseSearchAPI } from "../../Api/NeteaseAPI/NeteaseSearch";
import { SearchData } from "../../Api/NeteaseAPI/NeteaseSearch/SearchInterface";
import { songPlatformData } from "./shared";

/** 搜索入口：按类型取 id 列表与结果区条目（`id=` 直链视为单条结果）。 */
export const searchNetease = async (
  keyword: string,
  page: number,
  type: "song" | "playlist" | "album" | "mv" | "radio",
  itemPerPage: number,
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

  totalPage = Math.ceil(totalResult / itemPerPage);

  return { ids, totalPage, result: searchData.result, mediaCardData };
};

/** id 列表 → 结果区条目（歌单 / 专辑取集合详情，其余按类型直接取歌曲详情）。 */
export const getNeteasePlatformDataByIds = async (
  ids: number[],
  type: "song" | "playlist" | "album" | "mv" | "radio",
) => {
  const PlatformData: PlatformData[] = [];

  if (type === "song") {
    const songDetail = await NeteaseMusicAPI.getNeteaseSongDetail(ids);

    if (!songDetail) return null;

    for (const item of songDetail) PlatformData.push(songPlatformData(item));
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
