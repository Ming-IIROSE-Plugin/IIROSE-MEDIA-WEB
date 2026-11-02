/** 点播选项：`cardless` 由自动播放（收藏随机）传入，手动入口一律不传。 */
export interface AutoPlayOptions {
  /** 只发播放报文、不发点播卡片（自动点播永不发卡片）。 */
  cardless?: boolean;
}

export class Platform {
  public static baseHex = "000000";
  public static itemPerPage = 10;
}
