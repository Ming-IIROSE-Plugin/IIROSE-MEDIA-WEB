import { NeteaseMusicAPI } from "../Api/NeteaseAPI/NeteaseMusic";
import {
  isBatchActive,
  startBatch,
  type BatchHandle,
} from "../playback/BatchProgress";
import { guardedRequest } from "../playback/RequestGuard";
import { IIROSEUtils } from "../iirose_func/IIROSEUtils";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { reportFailure } from "../tools/reportFailure";
import {
  Announce,
  type BatchSendOutcome,
} from "../iirose_func/Socket/Announce";
import { Platform } from "./Platform";
import type { AutoPlayOptions } from "./Platform";
import type { CollectionSegments } from "./CollectionSegments";
import { openCollectionEpisodePicker } from "./netease/collectionPicker";
import {
  getAlbumMultiPageData as albumSegments,
  getSongListMultiPageData as songListSegments,
  playlistSkeleton as playlistSkeletonOf,
  fetchSongDetailsPooled as fetchSongDetailsPooledOf,
} from "./netease/collection";
import { sendMv, sendSongs } from "./netease/playback";
import { getNeteasePlatformDataByIds } from "./netease/search";
import {
  searchAlbumBasics,
  searchMusicListBasics,
  searchMvBasics,
  searchMusicsBasics,
} from "./netease/searchResults";
import {
  collectionKey,
  shuffleIds,
  type SendSongsOptions,
} from "./netease/shared";

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
  public static selectEpisodes = (platformData: PlatformData) =>
    openCollectionEpisodePicker(platformData, {
      fetchDetails: (ids, options) =>
        NetEasePlatform.fetchSongDetailsPooled(ids, options),
      playIds: (ids, title, description, key) =>
        NetEasePlatform.playSongIds(ids, title, description, key),
    });

  /**
   * 歌单曲目骨架（选集面板用）：`trackIds` 才是完整列表与顺序，详情接口的 `tracks`
   * 在部分网络 / 未登录时只给前 10 首（千首歌单曾只列出 10 首）。这里**不发请求**：
   * 有详情的曲目带名字，其余只有 id，由 `fetchSongDetailsPooled` 在后台补；
   * 上万首的歌单因此能立刻列出，不必等全部详情取回。
   */
  public static playlistSkeleton = playlistSkeletonOf;

  /**
   * 并发取歌曲详情：每批到达就回调 `onChunk`，随时可由 `signal` 中止（关面板即停）。
   * 单批失败（`null`）跳过，对应曲目保留占位名；不抛错。
   */
  public static fetchSongDetailsPooled = fetchSongDetailsPooledOf;

  /**
   * 按给定顺序点播一组曲目（选集面板与内页多选共用）：单首走单曲播报，
   * 多首走批量进度浮窗 + 批量播报。返回发送过程：点播守卫据此显示「点播中」。
   * `key` 是集合身份（`id:list` / `id:album`）：同一集合的一批还在跑时不另开
   * 第二轮，两轮交错会把卡片和进度刷成一团。
   */
  public static playSongIds = (
    ids: number[],
    title: string,
    description?: string,
    key?: string,
  ): Promise<void> => {
    if (ids.length === 0) return Promise.resolve();
    if (ids.length === 1) {
      // 单项：单曲窗口只包发卡片那一小段（见 MOD 的同款说明）
      return NetEasePlatform.finalODSONG(ids, undefined, {
        singleWindow: true,
      })
        .then(() => undefined)
        .catch((error) => Announce.showBatchItemError(error));
    }
    // 无 key 的调用点退回按标题判（旧行为），有 key 时标题改名也绕不过守卫
    if (isBatchActive(key ?? title)) {
      ShowMessage.show("这张歌单 / 专辑正在点播中");
      return Promise.resolve();
    }
    // `finalODSONG` 按入参顺序重排详情结果，这里传的就是点选顺序
    const batch = startBatch(title, ids.length, key);
    return Promise.resolve(
      Announce.runBatchAnnounce(
        title,
        ids.length,
        () => NetEasePlatform.finalODSONG(ids, batch),
        description,
      ),
    ).finally(() => batch.finish());
  };

  public static getNeteasePlatformData = (
    ids: number[],
    type: "song" | "playlist" | "album" | "mv" | "radio",
  ) => getNeteasePlatformDataByIds(ids, type);

  /**
   * 搜索歌单
   * @param keyword
   * @param page
   * @returns
   */
  public static searchForMusicsBasicsData = (keyword: string, page: number) =>
    searchMusicsBasics(
      keyword,
      page,
      NetEasePlatform.itemPerPage,
      NetEasePlatform.getNeteasePlatformData,
    );

  /**
   * @description 搜索歌单
   * @param keyword
   * @param page
   * @returns
   */
  public static searchForMusicListBasicsData = (
    keyword: string,
    page: number,
  ) => searchMusicListBasics(keyword, page, NetEasePlatform.itemPerPage);

  /**
   * @description 搜索专辑
   * @param keyword
   * @param page
   * @returns
   */
  public static searchForAlbumBasicsData = (keyword: string, page: number) =>
    searchAlbumBasics(keyword, page, NetEasePlatform.itemPerPage);

  /**
   * @description 搜索MV
   * @param keyword
   * @param page
   * @returns
   */
  public static searchForMVBasicsData = (keyword: string, page: number) =>
    searchMvBasics(keyword, page, NetEasePlatform.itemPerPage);

  /** 歌单内页：完整 `trackIds` 交给分段加载器按页取详情。 */
  public static getSongListMultiPageData = (
    platformData: PlatformData,
  ): Promise<CollectionSegments | null> => songListSegments(platformData);

  /** 专辑内页：同歌单，id 列表取自专辑详情。 */
  public static getAlbumMultiPageData = (
    platformData: PlatformData,
  ): Promise<CollectionSegments | null> => albumSegments(platformData);

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
      // 身份键按 id 而非标题：歌单 / 专辑被改名或标题被截断也绕不过并发守卫
      const key = collectionKey(id, !!platformData.neteaseMusic.isSongList);

      // 同一张歌单 / 专辑的整张点播还在准备或发送：再点不另开第二轮（两轮会交错刷屏）
      if (isBatchActive(key)) {
        ShowMessage.show(`《${platformData.title}》正在点播中`);
        return;
      }

      if (platformData.neteaseMusic.isSongList) {
        const songListDetail = await NeteaseMusicAPI.getSongListDetail(id);
        // 失败提示已由统一入口发出，这里静默结束本次点播
        if (!songListDetail) return;
        const trackID = songListDetail.playlist.trackIds.map((item) => item.id);
        const ids = order === "shuffle" ? shuffleIds(trackID) : trackID;
        // 进度浮窗：关掉点播面板也还在，可随时停止
        const batch = startBatch(songListDetail.playlist.name, ids.length, key);
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
        const ids = order === "shuffle" ? shuffleIds(songsID) : songsID;
        const batch = startBatch(albumDetails.album.name, ids.length, key);
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
  public static MLOD = (platformData: PlatformData) =>
    NetEasePlatform.collectionMenu(platformData);

  /**
   * @description 点播专辑
   * @param platformData
   */
  public static AOD = (platformData: PlatformData) =>
    NetEasePlatform.collectionMenu(platformData);

  /** 整单点播菜单：正序 / 乱序走 `playCollectionAll`，选集开插件自有面板。 */
  private static collectionMenu = (platformData: PlatformData) => {
    const action = async (select: number) => {
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
      NetEasePlatform.buildSelect(action);
    } catch (error) {
      reportFailure(error);
    }
  };

  /**
   * @description 点播歌曲
   * @param platformData
   * @param options.cardless 自动播放（收藏随机）用：只发播放报文、不发点播卡片。
   *   卡片会抬高平台活跃度，无人值守的连续自动点播必须静默（CAP-2）。
   */
  public static MOD = (
    platformData: PlatformData,
    options?: AutoPlayOptions,
  ) => {
    try {
      if (!platformData.neteaseMusic) throw new Error("没有网易云音乐数据");
      const id = platformData.neteaseMusic.id;
      // 手动单曲点播：单曲窗口只包「发卡片」那一小段（不是整段点播），
      // 否则并行批量的卡片会在网络请求期间被一并放行
      // 返回发送过程：点播守卫据此显示「点播中 / 已点播」
      return NetEasePlatform.finalODSONG([id], undefined, {
        singleWindow: true,
        cardless: options?.cardless,
      }).catch((e) => Announce.showBatchItemError(e));
    } catch (error) {
      reportFailure(error);
    }
  };

  public static MVOD = async (platformData: PlatformData) => {
    await sendMv(platformData, NetEasePlatform.baseHex);
  };

  /**
   * @param options.singleWindow 手动单曲窗口：卡片不被并行批量抑制吞掉。
   * @param options.cardless 自动播放（收藏随机）：只发播放报文、不发卡片。
   * @param batch 批量点播进度句柄（整张播放 / 选集多选）：逐首上报，
   *   每首发送前检查「停止」；单曲点播不传。
   * @returns 实际发出的条数与结束原因（stopped / failed / completed）：
   *   批量总结据此决定要不要补校正——跑完但有跳过时不能报「已停止」。
   */
  private static finalODSONG = async (
    songsID: number[],
    batch?: BatchHandle,
    options?: SendSongsOptions,
  ): Promise<BatchSendOutcome> => {
    try {
      return await sendSongs(songsID, batch, options, NetEasePlatform.baseHex);
    } finally {
      batch?.finish();
    }
  };
}
