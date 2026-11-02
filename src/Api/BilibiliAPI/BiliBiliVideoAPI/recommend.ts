import { BiliBiliTagApi } from "./tag";
import { parseJsonOrNull } from "./shared";

/**
 * 视频推荐与互动视频详情。
 *
 * 静态继承链的一环：继承上一模块只为把静态方法带给 `BiliBiliVideoApi`（见 `index.ts`），
 * 不代表语义上的从属关系。
 */
export class BiliBiliRecommendApi extends BiliBiliTagApi {
  /**
   * 根据视频获取推荐视频
   * @param aid
   * @param bvid
   * @returns
   */
  public static async getRecommandVideoFromSingleVideo(
    aid: number | null = null,
    bvid: string | null = null,
  ) {
    const url = "https://api.bilibili.com/x/web-interface/archive/related";
    const params = new URLSearchParams();

    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);

    const headers = this.returnBilibiliHeaders();

    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<RecommandVideo>(response);
  }

  /**
   * 获取主页推荐视频
   * @param fresh_type
   * @param version
   * @param ps 获取多少，最多30
   * @param fresh_idx
   * @param fresh_idx_1h
   * @returns
   */
  public static async getRecommendVideoFromMainPage(
    fresh_type: number = 3,
    version: number = 1,
    ps: number = 8,
    fresh_idx: number = 1,
    fresh_idx_1h: number = 1,
    brush: number = 0,
  ): Promise<RecommendVideoFromMainPage | null> {
    const bcors = this.getBilibiliCors();

    const url = `${bcors}https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd`;

    const params = new URLSearchParams();

    // ===== query 参数（只放业务参数）=====
    params.set("fresh_type", fresh_type.toString());
    params.set("version", version.toString());
    params.set("ps", ps.toString());
    params.set("fresh_idx", fresh_idx.toString());
    params.set("fresh_idx_1h", fresh_idx_1h.toString());
    params.set("brush", brush.toString());

    // ===== cookie（关键修复）=====
    const cookie = this.buildCookieString();

    if (cookie) {
      params.set("cookie", encodeURIComponent(cookie));
    }

    const response = await this.sendGet(url, params);

    return await parseJsonOrNull<RecommendVideoFromMainPage>(response);
  }

  /**
   * 获取推荐短视频
   * @param fnval
   * @param force_host
   * @param fourk
   * @returns
   */
  public static async getRecommendShortVideo(
    fnval: number = 272,
    force_host: number = 2,
    fourk: number = 1,
  ) {
    const url = "https://app.bilibili.com/x/v2/feed/index";
    const headers = this.returnBilibiliHeaders();

    const params = new URLSearchParams({
      fnval: fnval.toString(),
      fnver: "0",
      force_host: force_host.toString(),
      fourk: fourk.toString(),
    });

    const response = await this.sendGet(url, params, headers);
    return await parseJsonOrNull<RecommentShortVideo>(response);
  }

  /**
   * 获取互动视频详情
   * @see{}
   * @param aid
   * @param bvid
   * @param graph_version
   * @param edge_id
   * @returns
   */
  public static async getInteractiveVideoDetail(
    aid: number | null = null,
    bvid: string | null = null,
    graph_version: number,
    edge_id: number | null = null,
  ) {
    const url = "https://api.bilibili.com/x/stein/edgeinfo_v2";
    const params = new URLSearchParams({
      graph_version: graph_version.toString(),
    });

    aid && params.set("aid", aid.toString());
    bvid && params.set("bvid", bvid);
    edge_id && params.set("edge_id", edge_id.toString());

    const headers = this.returnBilibiliHeaders();

    const response = await this.sendGet(url, params, headers);

    return await parseJsonOrNull<interactVideoDetail>(response);
  }
}
