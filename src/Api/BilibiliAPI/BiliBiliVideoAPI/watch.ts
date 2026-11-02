import { WBI } from "../Crypto/WBI";
import { BiliBiliRecommendApi } from "./recommend";
import { parseJsonOrNull } from "./shared";

/**
 * 观看侧数据：弹幕趋势、观看进度、心跳、在线人数与 AI 总结。
 *
 * 静态继承链的一环：继承上一模块只为把静态方法带给 `BiliBiliVideoApi`（见 `index.ts`），
 * 不代表语义上的从属关系。
 */
export class BiliBiliWatchApi extends BiliBiliRecommendApi {
  /**
   * 获取弹幕趋势顶点列表
   * @param cid
   * @param aid
   * @param bvid
   * @returns
   */
  public static async getHighEnergyBarList(
    cid: number,
    aid: number | null = null,
    bvid: string | null = null,
  ) {
    const url = "https://bvc.bilivideo.com/pbp/data";
    const params = new URLSearchParams({
      cid: cid.toString(),
    });

    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);

    const headers = this.returnBilibiliHeaders();

    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<HighEnergyBar>(response);
  }

  /**
   * 设置观看历史 (在视频的哪一秒)
   * @param aid
   * @param cid
   * @param progress
   * @param platform
   * @returns
   */
  public static async setViewHistory(
    aid: number,
    cid: number,
    progress: number = 0,
    platform: string = "",
  ): Promise<reportResult | null> {
    const url = "https://api.bilibili.com/x/v2/history/report";
    const params = new URLSearchParams({
      aid: aid.toString(),
      cid: cid.toString(),
      progress: progress.toString(),
      platform: platform,
    });

    const headers = this.returnBilibiliHeaders();

    headers.set("content-type", "application/x-www-form-urlencoded");

    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<reportResult>(response);
  }

  /**
   * 上报心跳
   * @param aid
   * @param bvid
   * @param cid
   * @param epid
   * @param sid
   * @param mid
   * @param played_time
   * @param realtime
   * @param start_ts
   * @param type
   * @param sub_type
   * @param dt
   * @param play_type
   * @returns
   */
  public static async postHeartbeat(
    aid: number | null = null,
    bvid: string | null = null,
    cid: number | null = null,
    epid: number | null = null,
    sid: number | null = null,
    mid: number | null = null,
    played_time: number = 0,
    realtime: number | null = null,
    start_ts: number | null = null,
    type: number | null = null,
    sub_type: number | null = null,
    dt: number | null = null,
    play_type: number | null = null,
  ) {
    const url = "https://api.bilibili.com/x/click-interface/web/heartbeat";
    const params = new URLSearchParams();
    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);
    cid && params.set("cid", cid.toString());
    epid && params.set("epid", epid.toString());
    sid && params.set("sid", sid.toString());
    mid && params.set("mid", mid.toString());
    played_time && params.set("played_time", played_time.toString());
    realtime && params.set("realtime", realtime.toString());
    start_ts && params.set("start_ts", start_ts.toString());
    type && params.set("type", type.toString());
    sub_type && params.set("sub_type", sub_type.toString());
    dt && params.set("dt", dt.toString());
    play_type && params.set("play_type", play_type.toString());

    const headers = this.returnBilibiliHeaders();

    headers.set("content-type", "application/x-www-form-urlencoded");

    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<reportResult>(response);
  }

  /**
   * 获取当前在线观看人数
   * @param aid
   * @param bvid
   * @returns
   */
  public static async getCurrentOnlineViewers(
    aid: number | null = null,
    bvid: string | null = null,
    cid: number,
  ) {
    const url = "https://api.bilibili.com/x/player/online/total";
    const params = new URLSearchParams({
      cid: cid.toString(),
    });
    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);

    const headers = this.returnBilibiliHeaders();

    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<OnlineViewer>(response);
  }

  /**
   * 获取AI总结内容
   * @param aid
   * @param bvid
   * @param cid
   * @param up_mid
   * @param ctx
   * @returns
   */
  public static async getAIConclusionAboutVideo(
    aid: number | null = null,
    bvid: string | null = null,
    cid: number,
    up_mid: number,
  ): Promise<AIConclusion | null> {
    const url = "https://api.bilibili.com/x/web-interface/view/conclusion/get";
    const params = new URLSearchParams();

    params.set("cid", cid.toString());
    params.set("up_mid", up_mid.toString());
    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);

    const wbi = new WBI();
    const wbidata = await wbi.main(params);

    wbidata.w_rid && params.set("w_rid", wbidata.w_rid);
    wbidata.wts && params.set("wts", wbidata.wts.toString());

    const headers = this.returnBilibiliHeaders();
    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<AIConclusion>(response);
  }

  /**
   * 点赞或者取消点赞AI总结
   * @param aid
   * @param bvid
   * @param cid
   * @param up_mid
   * @param stid
   * @param like_state
   * @param ctx
   * @returns
   */
  public static async likeAndDislikeAIConclusion(
    aid: number | null = null,
    bvid: string | null = null,
    cid: number,
    up_mid: number | null = null,
    stid: number,
    like_state: 1 | 2 | 3 | 4,
  ) {
    const params = new URLSearchParams();

    // 是的，他需要空的参数
    const wbi = new WBI();
    const wbidata = await wbi.main(params);
    const url = `https://api.bilibili.com/x/web-interface/view/conclusion/set?w_rid=${wbidata.w_rid}&wts=${wbidata.wts}`;

    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);
    params.set("cid", cid.toString());
    up_mid && params.set("up_mid", up_mid.toString());
    params.set("stid", stid.toString());
    params.set("like_state", like_state.toString());

    const headers = this.returnBilibiliHeaders();
    headers.set("content-type", "application/x-www-form-urlencoded");
    const response = await this.sendPost(url, params, headers);

    return await parseJsonOrNull<likeAndDislikeAIConclusion>(response);
  }
}
