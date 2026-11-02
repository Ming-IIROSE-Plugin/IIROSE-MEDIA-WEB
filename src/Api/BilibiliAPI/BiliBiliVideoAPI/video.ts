import { SendFetch } from "../..";
import { WBI } from "../Crypto/WBI";
import { parseJsonOrNull } from "./shared";

/**
 * 视频本体：详情、播放地址、分 P 与合集。
 *
 * 静态继承链的一环：继承上一模块只为把静态方法带给 `BiliBiliVideoApi`（见 `index.ts`），
 * 不代表语义上的从属关系。
 */
export class BiliBiliVideoDataApi extends SendFetch {
  /**
   * 获取视频的各种信息
   * @param bvid bv号
   * @param biliBiliSessData BiliBili SessData
   * @returns
   */
  public static async getBilibiliVideoData(
    aid: number | null = null,
    bvid: string | null = null,
  ): Promise<BVideoDetail | null> {
    const bcors = this.getBilibiliCors();

    const url = `${bcors}https://api.bilibili.com/x/web-interface/view`;

    const params = new URLSearchParams();

    if (aid !== null) params.set("aid", aid.toString());
    if (bvid !== null) params.set("bvid", bvid);

    // ===== cookie 单独处理 =====
    const cookie = this.buildCookieString();

    if (cookie) {
      params.set("cookie", encodeURIComponent(cookie));
    }

    const response = await this.sendGet(url, params);

    return await parseJsonOrNull<BVideoDetail>(response);
  }

  /**
   * 获取视频流
   * @param aid
   * @param bvid
   * @param cid
   * @param qn
   * @param platform
   * @param fnval
   * @param ctx
   * @returns
   */
  public static async getBilibiliVideoStream(
    aid: number | null = null,
    bvid: string | null = null,
    cid: number,
    qn: number,
    fnval: number = 16,
    platform: string = "html5",
  ): Promise<BVideoStream | null> {
    const bcors = this.getBilibiliCors();

    const url = `${bcors}https://api.bilibili.com/x/player/wbi/playurl`;

    const params = new URLSearchParams();

    // ===== 基础参数 =====
    params.set("cid", cid.toString());
    params.set("qn", qn.toString());
    params.set("high_quality", "1");
    params.set("platform", platform);
    params.set("fnver", "0");
    params.set("fourk", "1");
    params.set("fnval", fnval.toString());

    if (aid !== null) {
      params.set("avid", aid.toString());
    }

    if (bvid !== null) {
      params.set("bvid", bvid);
    }

    // ===== WBI 签名（必须在 query 完整后执行）=====
    const wbi = new WBI();
    const wbidata = await wbi.main(params);

    if (wbidata.w_rid) {
      params.set("w_rid", wbidata.w_rid);
    }

    if (wbidata.wts) {
      params.set("wts", wbidata.wts.toString());
    }

    // ===== cookie（关键修复点）=====
    const cookie = this.buildCookieString();

    if (cookie) {
      params.set("cookie", encodeURIComponent(cookie));
    }

    const response = await this.sendGet(url, params);

    return await parseJsonOrNull<BVideoStream>(response);
  }

  public static async getBilibiliVideoStreamFromFunctionCompute(
    avid: string,
    bvid: string,
    cid: string,
    biliBiliPlatform: string,
    biliBiliqn: number,
    remoteUrl: string,
  ) {
    const url = remoteUrl + "/GetBiliBiliVideoStream";
    const params = new URLSearchParams({
      bvid: bvid,
      avid: avid,
      cid: cid,
      qn: biliBiliqn.toString(),
      platform: biliBiliPlatform,
      // sessdata: this.BilibiliAccountData?.SESSDATA || ''
    });

    const headers: Headers = this.returnCommonHeaders();

    headers.set("content-type", "application/x-www-form-urlencoded");

    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<BVideoStream>(response);
  }

  /**
   * 获取视频状态数
   * @deprecated 这个接口疑似不再可用
   * @param avid
   * @returns
   */
  public static async getBilibiliVideoStatus(avid: number) {
    const url = "https://api.bilibili.com/archive_stat/stat";
    const params = new URLSearchParams({
      aid: avid.toString(),
    });

    const headers = this.returnCommonHeaders();

    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<videoStatus>(response);
  }

  /**
   * 获取视频快照
   * @param aid
   * @param bvid
   * @param cid
   * @param index
   * @returns
   */
  public static async getBilibiliVideoSnapshot(
    aid: number | null = null,
    bvid: string | null = null,
    cid: string | null = null,
    index: 1 | 0 = 0,
  ) {
    const url = "https://api.bilibili.com/x/player/videoshot";
    const params = new URLSearchParams();
    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);
    cid && params.set("cid", cid);
    params.set("index", index.toString());

    if (cid) params.set("cid", cid);

    const headers = this.returnCommonHeaders();

    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<Snapshot>(response);
  }

  /**
   * 获取视频合集信息
   * @param mid
   * @param season_id
   * @param sort_reverse
   * @param page_num
   * @param page_size
   * @returns
   */
  public static async getSeasonArchivesList(
    mid: number,
    season_id: number,
    sort_reverse: boolean | null = null,
    page_num: number | null = null,
    page_size: number | null = null,
  ) {
    const url =
      "https://api.bilibili.com/x/polymer/web-space/seasons_archives_list";
    const params = new URLSearchParams();
    params.set("mid", mid.toString());
    params.set("season_id", season_id.toString());
    sort_reverse && params.set("sort_reverse", sort_reverse.toString());
    page_num && params.set("page_num", page_num.toString());
    page_size && params.set("page_size", page_size.toString());

    const headers = this.returnBilibiliHeaders();
    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<SeasonArchives>(response);
  }

  public static async getBilibiliPagesAndCids(
    aid: number | null = null,
    bvid: string | null = null,
  ): Promise<BilibiliPagesAndCids | null> {
    const bcors = this.getBilibiliCors();

    const url = `${bcors}https://api.bilibili.com/x/player/pagelist`;

    const params = new URLSearchParams();

    // ===== 只放业务参数 =====
    if (aid !== null) {
      params.set("aid", aid.toString());
    }

    if (bvid !== null) {
      params.set("bvid", bvid);
    }

    // ===== cookie（关键修复点）=====
    const cookie = this.buildCookieString();

    if (cookie) {
      params.set("cookie", encodeURIComponent(cookie));
    }

    const response = await this.sendGet(url, params);

    return await parseJsonOrNull<BilibiliPagesAndCids>(response);
  }
}
