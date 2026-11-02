import { md5Hex } from "./md5";
import { BiliBiliLoginApi } from "../LoginAPI";

/**
 *
 */
export class WBI {
  mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52,
  ];
  private getMixinKey = (orig: string) =>
    this.mixinKeyEncTab
      .map((n) => orig[n])
      .join("")
      .slice(0, 32);

  /**
   *
   * @see {@link https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/misc/sign/wbi.md#JavaScript}
   * @param Params 你的参数
   * @returns {string}
   */
  public async main(Params: URLSearchParams) {
    const web_keys = await this.getWbiKeys();
    if (!web_keys) return this.extractParams(null);
    const params = Object.fromEntries(Params.entries()),
      img_key = web_keys.img_key,
      sub_key = web_keys.sub_key;
    const query = this.encWbi(params, img_key, sub_key);
    return this.extractParams(query);
  }

  private extractParams(wbikey: string | null): {
    w_rid: string | null;
    wts: number | null;
  } {
    let w_rid: string | null = null;
    let wts: number | null = null;
    if (!wbikey) return { w_rid, wts };
    const paramsArray = wbikey.split("&");
    paramsArray.forEach((param) => {
      const [name, value] = param.split("=");
      if (name === "w_rid") {
        w_rid = value;
      } else if (name === "wts") {
        wts = parseInt(value);
      }
    });

    return { w_rid, wts };
  }

  private async getWbiKeys() {
    // const select = new Select(this.ctx);
    // const bilibiliAccountDataD = await select.select() as unknown as BilibiliAccountData[];
    // if (bilibiliAccountDataD.length !== 1) return null
    // const bilibiliAccountData = bilibiliAccountDataD[0];
    const NavUserData = await BiliBiliLoginApi.getNavUserData();
    if (!NavUserData) return null;
    const img_url = NavUserData.data.wbi_img.img_url;
    const sub_url = NavUserData.data.wbi_img.sub_url;
    return {
      img_key: img_url.slice(
        img_url.lastIndexOf("/") + 1,
        img_url.lastIndexOf("."),
      ),
      sub_key: sub_url.slice(
        sub_url.lastIndexOf("/") + 1,
        sub_url.lastIndexOf("."),
      ),
    };
  }

  private encWbi(
    params: Record<string, unknown>,
    img_key: string,
    sub_key: string,
  ) {
    const mixin_key = this.getMixinKey(img_key + sub_key),
      curr_time = Math.round(Date.now() / 1000),
      chr_filter = /[!'()*]/g;
    // 按照 key 重排参数
    Object.assign(params, { wts: curr_time }); // 添加 wts 字段
    const query = Object.keys(params)
      .sort()
      .map((key) => {
        // 过滤 value 中的 "!'()*" 字符
        const value = (params[key] || "").toString().replace(chr_filter, "");
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join("&");

    const wbi_sign = md5Hex(query + mixin_key); // 计算 w_rid

    return query + "&w_rid=" + wbi_sign;
  }
}
