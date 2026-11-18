import { SendFetch } from "../..";

export class BiliBiliLiveApi extends SendFetch {
  /**
   *
   * @param roomId
   * @returns
   */
  public static async getLiveRoomDetail(roomId: number) {
    const bcors = this.getBilibiliCors();

    const url = `${bcors}https://api.live.bilibili.com/room/v1/Room/get_info`;

    const params = new URLSearchParams({
      room_id: roomId.toString(),
    });

    // ✔ 单独处理 cookie
    const cookie = this.buildCookieString();

    if (cookie) {
      params.append("cookie", encodeURIComponent(cookie));
    }

    const response = await this.sendGet(url, params);

    if (response && response.ok) {
      return await response.json();
    }

    return null;
  }

  /**
   * 获取用户对应的直播间状态 (根据用户mid)
   * @see {@link https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/live/info.md}
   * @param mid
   * @returns
   */
  public static async getLiveRoomStatusByMid(mid: number) {
    const url = "https://api.live.bilibili.com/room/v1/Room/getRoomInfoOld";
    const params = new URLSearchParams({
      mid: mid.toString(),
    });
    const headers = this.returnBilibiliHeaders();
    const response = await this.sendGet(url, params, headers);
    if (response && response.ok) {
      const data: LiveRoomStatus = await response.json();
      return data;
    } else {
      return null;
    }
  }

  /**
   * 获取房间页初始化信息
   * @param id
   * @returns
   */
  public static async getLiveRoomInitDetail(id: number) {
    const url = "https://api.live.bilibili.com/room/v1/Room/room_init";
    const params = new URLSearchParams({
      id: id.toString(),
    });
    const headers = this.returnBilibiliHeaders();
    const response = await this.sendGet(url, params, headers);
    if (response && response.ok) {
      const data: LiveRoomInitDetail = await response.json();
      return data;
    } else {
      return null;
    }
  }

  /**
   * 获取主播信息
   * @param uid
   * @returns
   */
  public static async getLiveUserDetail(uid: number) {
    const url = "https://api.live.bilibili.com/live_user/v1/Master/info";
    const params = new URLSearchParams({
      uid: uid.toString(),
    });
    const headers = this.returnBilibiliHeaders();
    const response = await this.sendGet(url, params, headers);
    if (response && response.ok) {
      const data: LiveUserDetail = await response.json();
      return data;
    } else {
      return null;
    }
  }

  /**
   * 获取直播间信息
   * @param room_id
   * @param protocol
   * @param format
   * @param codec
   * @param qn
   * @param platform
   * @param ptype
   * @param dolby
   * @param panorama
   * @returns
   */
  public static async getLiveRoomPlayInfo(
    room_id: number,
    protocol: string,
    format: string,
    codec: string,
    qn: number,
    platform: string = "web",
    ptype: number = 8,
    dolby: number = 5,
    panorama: number = 1,
  ): Promise<LiveRoomPlayInfoDetail | null> {
    const url =
      "https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo";
    const params = new URLSearchParams({
      room_id: room_id.toString(),
      protocol: protocol,
      format: format,
      codec: codec,
      qn: qn.toString(),
      platform: platform,
      ptype: ptype.toString(),
      dolby: dolby.toString(),
      panorama: panorama.toString(),
    });
    const cookie = this.buildCookieString();
    if (cookie) params.set("cookie", encodeURIComponent(cookie));
    const response = await this.sendGet(
      `${this.getBilibiliCors()}${url}`,
      params,
      undefined,
      false,
      AbortSignal.timeout(8000),
    );
    if (response && response.ok) {
      const data: LiveRoomPlayInfoDetail = await response
        .json()
        .catch(() => null);
      return data;
    } else {
      return null;
    }
  }

  public static async getLiveStream(
    cid: number,
    platform: string | null = null,
    quality: number | null = null,
    qn: number | null = null,
  ) {
    const bcors = this.getBilibiliCors();

    const url = `${bcors}https://api.live.bilibili.com/room/v1/Room/playUrl`;

    const params = new URLSearchParams();

    // ✔ 强制参数
    params.set("cid", cid.toString());

    // ✔ 可选参数（更安全写法）
    if (platform !== null) {
      params.set("platform", platform);
    }

    if (quality !== null) {
      params.set("quality", quality.toString());
    }

    if (qn !== null) {
      params.set("qn", qn.toString());
    }

    // ✔ cookie 单独处理（关键）
    const cookie = this.buildCookieString();

    if (cookie) {
      params.set("cookie", encodeURIComponent(cookie));
    }

    const response = await this.sendGet(
      url,
      params,
      undefined,
      false,
      AbortSignal.timeout(8000),
    );
    return response?.ok ? await response.json().catch(() => null) : null;
  }
}
