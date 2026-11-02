import { WBI } from "../Crypto/WBI";
import { BiliBiliInteractionApi } from "./interaction";
import { parseJsonOrNull } from "./shared";

/**
 * 视频标签：获取、点赞、点踩。
 *
 * 静态继承链的一环：继承上一模块只为把静态方法带给 `BiliBiliVideoApi`（见 `index.ts`），
 * 不代表语义上的从属关系。
 */
export class BiliBiliTagApi extends BiliBiliInteractionApi {
  /**
   * 获取视频标签
   * @param aid
   * @param bvid
   * @returns
   */
  public static async getVideoTags(
    aid: number | null = null,
    bvid: string | null = null,
  ) {
    const url = "https://api.bilibili.com/x/tag/archive/tags";
    const params = new URLSearchParams();
    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);
    const headers = this.returnBilibiliHeaders();

    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<VideoTags>(response);
  }

  /**
   * 点赞标签, 重复访问会取消点赞
   * @param aid
   * @param tag_id
   * @returns
   */
  public static async likeTag(aid: number, tag_id: number) {
    const url = "https://api.bilibili.com/x/tag/archive/like2";
    const params = new URLSearchParams({
      aid: aid.toString(),
      tag_id: tag_id.toString(),
      // csrf: this.BilibiliAccountData?.csrf || ''
    });

    const wbi = new WBI();
    const wbidata = await wbi.main(params);

    wbidata.w_rid && params.set("w_rid", wbidata.w_rid);
    wbidata.wts && params.set("wts", wbidata.wts.toString());

    const headers = this.returnBilibiliHeaders();

    headers.set("content-type", "application/x-www-form-urlencoded");

    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<LikeTagResult>(response);
  }

  /**
   * 点踩标签, 重复访问会取消点踩
   * @param aid
   * @param tag_id
   * @returns
   */
  public static async dislikeTag(aid: number, tag_id: number) {
    const url = "https://api.bilibili.com/x/tag/archive/hate2";
    const params = new URLSearchParams({
      aid: aid.toString(),
      tag_id: tag_id.toString(),
      // csrf: this.BilibiliAccountData?.csrf || ''
    });

    const headers = this.returnBilibiliHeaders();

    headers.set("content-type", "application/x-www-form-urlencoded");

    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<LikeTagResult>(response);
  }
}
