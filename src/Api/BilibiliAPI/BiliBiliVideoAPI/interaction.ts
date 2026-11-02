import { BiliBiliVideoDataApi } from "./video";
import { parseJsonOrNull } from "./shared";

/**
 * 视频互动：点赞 / 投币 / 收藏 / 三连 / 分享 / 投诉。
 *
 * 静态继承链的一环：继承上一模块只为把静态方法带给 `BiliBiliVideoApi`（见 `index.ts`），
 * 不代表语义上的从属关系。
 */
export class BiliBiliInteractionApi extends BiliBiliVideoDataApi {
  /**
   * 点赞视频
   * @param aid
   * @param bvid
   * @param like 1: 点赞 2: 取消点赞, 3: 点踩, 4: 取消点踩
   * @returns
   */
  public static async likeOrDislikeBilibiliVideo(
    aid: number | null = null,
    bvid: string | null = null,
    like: 1 | 2 | 3 | 4,
  ) {
    const url = "https://api.bilibili.com/x/web-interface/archive/like";
    const params = new URLSearchParams({
      like: like.toString(),
      // csrf: this.BilibiliAccountData?.csrf || '',
      source: "web_normal",
    });

    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);

    const headers = this.returnBilibiliHeaders();

    headers.set("content-type", "application/x-www-form-urlencoded");

    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<LikeVideo>(response);
  }

  /**
   * 检查是否已经点赞/点踩
   * @param aid
   * @param bvid
   * @returns
   */
  public static async checkIsLikedAndUnliked(
    aid: number | null = null,
    bvid: string | null = null,
  ): Promise<hasLiked | null> {
    const url = "https://api.bilibili.com/x/web-interface/archive/has/like";
    const params = new URLSearchParams();
    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);

    const headers = this.returnBilibiliHeaders();

    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<hasLiked>(response);
  }

  /**
   * 投币视频
   * @param aid
   * @param bvid
   * @param multilpy
   * @param select_like
   * @returns
   */
  public static async addCoin(
    aid: number | null = null,
    bvid: string | null = null,
    multilpy: 1 | 2,
    select_like: 0 | 1,
  ) {
    const url = "https://api.bilibili.com/x/web-interface/coin/add";
    const params = new URLSearchParams({
      multiply: multilpy.toString(),
      select_like: select_like.toString(),
      source: "web_normal",
      eab_x: "2", // 必要，不然无法执行投币但不点赞的操作
      // csrf: this.BilibiliAccountData?.csrf || '',
    });

    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);

    const headers = this.returnBilibiliHeaders();

    headers.set("content-type", "application/x-www-form-urlencoded");

    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<AddCoin>(response);
  }

  /**
   * 检查是否已经投币
   * @param aid
   * @param bvid
   * @returns
   */
  public static async checkIsAddedCoin(
    aid: number | null = null,
    bvid: string | null = null,
  ) {
    const url = "https://api.bilibili.com/x/web-interface/archive/coins";
    const params = new URLSearchParams();
    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);

    const headers = this.returnBilibiliHeaders();

    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<isAddedCoin>(response);
  }

  /**
   * 收藏或者取消收藏视频
   * @param aid
   * @param add_media_ids
   * @param del_media_ids
   * @returns
   */
  public static async addFavorite(
    aid: number,
    add_media_ids: number[] | null = null,
    del_media_ids: number[] | null = null,
  ) {
    const url = "https://api.bilibili.com/x/v3/fav/resource/deal";
    const params = new URLSearchParams({
      rid: aid.toString(),
      type: "2",
      add_media_ids: add_media_ids?.join(",") || "",
      del_media_ids: del_media_ids?.join(",") || "",
      // csrf: this.BilibiliAccountData?.csrf || '',
      eab_x: "2",
    });

    const headers = this.returnBilibiliHeaders();

    headers.set("content-type", "application/x-www-form-urlencoded");

    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<AddFavorite>(response);
  }

  /**
   * 检查是否已经收藏
   * @param aid
   * @returns
   */
  public static async checkIsFavorite(
    aid: number,
  ): Promise<isAddFavorited | null> {
    const url = "https://api.bilibili.com/x/v2/fav/video/favoured";
    const params = new URLSearchParams({
      aid: aid.toString(),
    });

    const headers = this.returnBilibiliHeaders();

    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<isAddFavorited>(response);
  }

  /**
   * 一键三连
   * @param aid
   * @param bvid
   * @returns
   */
  public static async archiveLikeTriple(
    aid: number | null = null,
    bvid: string | null = null,
  ) {
    const url = "https://api.bilibili.com/x/web-interface/archive/like/triple";
    const params = new URLSearchParams({
      // csrf: this.BilibiliAccountData?.csrf || ''
    });

    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);

    const headers = this.returnBilibiliHeaders();

    headers.set("content-type", "application/x-www-form-urlencoded");

    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<likeTriple>(response);
  }

  /**
   * 分享视频（仅仅为了增加那个分享数）
   * @param aid
   * @param bvid
   * @returns
   */
  public static async shareVideo(
    aid: number | null = null,
    bvid: string | null = null,
  ) {
    const url = "https://api.bilibili.com/x/web-interface/share/add";
    const params = new URLSearchParams({
      // csrf: this.BilibiliAccountData?.csrf || ''
    });

    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);

    const headers = this.returnBilibiliHeaders();

    headers.set("content-type", "application/x-www-form-urlencoded");

    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<ShareVideo>(response);
  }

  /**
   * 获取投诉类型
   * @returns
   */
  public static async getAppealType() {
    const url = "https://api.bilibili.com/x/web-interface/archive/appeal/tags";
    const headers = this.returnBilibiliHeaders();
    const response = await this.sendGet(url, new URLSearchParams(), headers);

    return await parseJsonOrNull<AppealType>(response);
  }

  /**
   * 投诉稿件
   * @param aid
   * @param tid
   * @param desc
   * @param attach
   * @returns
   */
  public static async makeAppeal(
    aid: number,
    tid: number,
    desc: string,
    attach: string | null = null,
  ) {
    const url = "https://api.bilibili.com/x/web-interface/appeal/v2/submit";
    const params = new URLSearchParams();
    params.set("aid", aid.toString());
    params.set("tid", tid.toString());
    params.set("desc", desc);
    attach && params.set("attach", attach);

    const headers = await this.returnBilibiliHeaders();
    headers.set("content-type", "application/x-www-form-urlencoded");
    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<MakeAppealResult>(response);
  }
}
