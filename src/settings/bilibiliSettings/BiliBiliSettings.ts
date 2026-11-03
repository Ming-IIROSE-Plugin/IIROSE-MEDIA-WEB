import { BilibiliACC } from "../../Account/BiliBili/BilibiliAccountInterface";
import { BiliBiliAccount } from "../../Account/BiliBili/SetBiliBili";
import { BiliBiliLoginApi } from "../../Api/BilibiliAPI/LoginAPI";
import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";
import { readJson, removeKey, writeJson } from "../../storage/localStore";

export interface BilibiliVideoSettings {
  qn: number;
  streamqn: number;
  streamSeconds: number;
  videoStreamFormat: number;
  api: "HK" | "Guangzhou" | "Dev";
}

export type BilibiliApiId = BilibiliVideoSettings["api"];

/** 默认 API 节点：线上构建里未知值与不可用的节点都回落到它。 */
export const DEFAULT_BILIBILI_API: BilibiliApiId = "Guangzhou";

/**
 * API 节点目录：id / 文案 / 图标**逐项绑定**，顺序即设置项展示顺序。
 * 以前是两份按下标对齐的数组，隐藏其中一项就会把图标错位到别的行上。
 */
const BILIBILI_API_NODES: {
  id: BilibiliApiId;
  label: string;
  icon: string;
}[] = [
  { id: "HK", label: "香港-海外优化", icon: "mdi-crosshairs-gps" },
  { id: "Guangzhou", label: "广州-中国优化", icon: "mdi-crosshairs-gps" },
  { id: "Dev", label: "开发者模式", icon: "mdi-dev-to" },
];

/**
 * 「开发者模式」指向 localhost:9000 且没有兜底节点，只有开发构建才可能连得上；
 * 线上构建既不提供该选项，也要把存档里残留的 Dev 归一化回默认节点。
 */
function isDevApiAvailable(): boolean {
  return Boolean(import.meta.env.DEV);
}

/** 当前构建里可选的节点（线上构建不含 Dev）。 */
function availableApiNodes() {
  return BILIBILI_API_NODES.filter(
    (node) => node.id !== "Dev" || isDevApiAvailable(),
  );
}

export class BiliBiliSettings {
  public setAccount(changeActionTitleAction?: (actionTitle?: string) => void) {
    const login = (_t: HTMLElement, s: string) => {
      const handleUserInputCookie = async (input: string | null) => {
        if (!input) return;
        const cookie = input;

        const cookies = this.parseCookie(cookie);
        const navData = await BiliBiliLoginApi.getNavUserData(
          cookies["SESSDATA"],
        );

        // 从本机存档获取已有的 bilibiliAccount
        let bilibiliaccount: BilibiliACC = readJson<BilibiliACC>(
          "bilibiliAccount",
          {},
        );

        // 更新 bilibiliAccount 对象中的字段
        bilibiliaccount = {
          ...bilibiliaccount,
          DedeUserID: cookies["DedeUserID"] || bilibiliaccount.DedeUserID || "",
          DedeUserID__ckMd5:
            cookies["DedeUserID__ckMd5"] ||
            bilibiliaccount.DedeUserID__ckMd5 ||
            "",
          Expires:
            cookies["bili_ticket_expires"] || bilibiliaccount.Expires || "",
          SESSDATA: cookies["SESSDATA"] || bilibiliaccount.SESSDATA || "",
          bili_jct: cookies["bili_jct"] || bilibiliaccount.bili_jct || "",
          gourl: cookies["gourl"] || bilibiliaccount.gourl || "",
          refresh_token:
            cookies["refresh_token"] || bilibiliaccount.refresh_token || "",
          uname: navData?.data.uname || bilibiliaccount.uname || "",
          face: navData?.data.face || bilibiliaccount.face || "",
        };

        // 更新本机存档中的值；没落盘就不要把标题改成“已登录”，否则下一次启动又变回未登录。
        if (
          writeJson("bilibiliAccount", bilibiliaccount) &&
          changeActionTitleAction
        ) {
          changeActionTitleAction(bilibiliaccount.uname);
        }
      };

      if (s === "0") {
        const bilibiliaccount = new BiliBiliAccount();
        const uname = bilibiliaccount.setBiliBiliAccount();

        uname.then((username) => {
          if (username) {
            if (changeActionTitleAction) {
              changeActionTitleAction(username);
            }
          }
        });
      }

      if (s === "1") {
        IIROSEUtils.sync(
          2,
          ["请输入B站Cookie", "text", 100000],
          handleUserInputCookie,
        );
      }
    };

    function logOut(_t: HTMLElement, s: string) {
      if (s === "1") {
        removeKey("bilibiliAccount");
        if (changeActionTitleAction) {
          changeActionTitleAction("未登录");
        }
      }
    }

    const bilibiliAccount = this.getBiliBiliAccount();

    if (bilibiliAccount && bilibiliAccount.uname && bilibiliAccount.face) {
      const selectOption = [
        [
          0,
          bilibiliAccount.uname,
          `<div style="height:100px;width:100px;position:absolute;top:0;left:0;"><div class="bgImgBox"><img class="bgImg" loading="lazy" decoding="async" src="${bilibiliAccount.face}" onerror="this.style.display='none';"><div class="fullBox"></div></div></div>`,
        ],
        [
          1,
          "登出账号",
          `<div class="mdi-logout" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
        ],
      ];
      IIROSEUtils.buildSelect2(
        null,
        selectOption,
        logOut,
        false,
        true,
        null,
        false,
        null,
        () => {},
      );
    } else {
      const selectOption = [
        [
          0,
          "扫码登录账号",
          `<div class="mdi-qrcode" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
        ],
        [
          1,
          "输入B站Cookie",
          `<div class="mdi-cookie" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
        ],
      ];
      IIROSEUtils.buildSelect2(
        null,
        selectOption,
        login,
        false,
        true,
        null,
        false,
        null,
        () => {},
      );
    }
  }

  public setBilibiliVideoQuality(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    const setBilibiliVideoQuality = (_t: HTMLElement, s: string) => {
      const qn = parseInt(s);

      const parseBilibiliSetting = readJson<BilibiliVideoSettings | null>(
        "bilibiliSetting",
        null,
      );
      if (parseBilibiliSetting) {
        parseBilibiliSetting.qn = parseInt(s);
        writeJson("bilibiliSetting", parseBilibiliSetting);
      }

      const qnText = this.parseBilibiliVideoQn(qn);

      if (changeActionTitleAction) {
        changeActionTitleAction(qnText);
      }
    };
    const mdiClass = [
      "mdi-motion-play",
      "mdi-motion-play",
      "mdi-motion-play",
      "mdi-high-definition-box",
      "mdi-high-definition-box",
      "mdi-high-definition-box",
      "mdi-high-definition-box",
      "mdi-high-definition-box",
      "mdi-high-definition-box",
      "mdi-dolby",
      "mdi-grain",
    ];

    const selectOption = [
      [6, "240P 极速"],
      [16, "360P 流畅"],
      [32, "480P 清晰"],
      [64, "720P 高清"],
      [74, "720P60 高帧率"],
      [80, "1080P 高清"],
      [112, "1080P+ 高码率"],
      [116, "1080P60 高帧率"],
      [120, "4K 超清"],
      [126, "杜比视界"],
      [127, "8K 超高清"],
    ];

    selectOption.forEach((item, index) => {
      item.push(
        `<div class="${mdiClass[index]}" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
      );
    });

    IIROSEUtils.buildSelect2(
      null,
      selectOption,
      setBilibiliVideoQuality,
      false,
      true,
      null,
      false,
      null,
      () => {},
    );
  }

  public setBilibiliLiveQuality(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    const selectOption = [
      [250, "超清"],
      [10000, "原生画质"],
    ];

    const set = (_t: HTMLElement, s: string) => {
      const qn = parseInt(s);

      const parseBilibiliSetting = readJson<BilibiliVideoSettings | null>(
        "bilibiliSetting",
        null,
      );
      if (parseBilibiliSetting) {
        parseBilibiliSetting.streamqn = parseInt(s);
        writeJson("bilibiliSetting", parseBilibiliSetting);
      }

      const qnText = this.parseBilibiliLiveQn(qn);

      if (changeActionTitleAction) {
        changeActionTitleAction(qnText);
      }
    };

    const mdiClass = ["mdi-motion-play", "mdi-high-definition-box"];

    selectOption.forEach((item, index) => {
      item.push(
        `<div class="${mdiClass[index]}" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
      );
    });

    IIROSEUtils.buildSelect2(
      null,
      selectOption,
      set,
      false,
      true,
      null,
      false,
      null,
      () => {},
    );
  }

  public setBilibiliStreamSeconds(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    function set(userInput: string | null) {
      if (!userInput) return;
      const streamMinutes = parseInt(userInput as string);
      const parseBilibiliSetting = readJson<BilibiliVideoSettings | null>(
        "bilibiliSetting",
        null,
      );
      if (parseBilibiliSetting) {
        parseBilibiliSetting.streamSeconds = streamMinutes * 60;
        writeJson("bilibiliSetting", parseBilibiliSetting);
      }

      if (changeActionTitleAction) {
        changeActionTitleAction(`${streamMinutes} 分钟`);
      }
    }

    const t = [`请输入直播播放时长 (分钟)`, `number`, 8];

    IIROSEUtils.sync(2, t, set);
  }

  public setGetVideoFormat(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    const set = (_t: HTMLElement, s: string) => {
      const format = parseInt(s);

      const parseBilibiliSetting = readJson<BilibiliVideoSettings | null>(
        "bilibiliSetting",
        null,
      );
      if (parseBilibiliSetting) {
        parseBilibiliSetting.videoStreamFormat = parseInt(s);
        writeJson("bilibiliSetting", parseBilibiliSetting);
      }

      const formatText = this.parseGetVideoFormat(format);

      if (changeActionTitleAction) {
        changeActionTitleAction(formatText);
      }
    };

    const selectOption = [
      [0, "durl - 音频视频不分离，最高720p画质"],
      [1, "dash - 视频音频分离，可以获取高画质"],
      [2, "混合 (高于720p自动使用dash)"],
    ];

    const mdiClass = [
      "mdi-motion-play",
      "mdi-high-definition-box",
      `mdi-tune-vertical`,
    ];

    selectOption.forEach((item, index) => {
      item.push(
        `<div class="${mdiClass[index]}" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
      );
    });

    IIROSEUtils.buildSelect2(
      null,
      selectOption,
      set,
      false,
      true,
      null,
      false,
      null,
      () => {},
    );
  }

  public setBilibiliDefaultApi(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    const set = (_t: HTMLElement, s: string) => {
      const api = this.normalizeBilibiliApi(s);

      const parseBilibiliSetting = readJson<BilibiliVideoSettings | null>(
        "bilibiliSetting",
        null,
      );
      if (parseBilibiliSetting) {
        parseBilibiliSetting.api = api;
        writeJson("bilibiliSetting", parseBilibiliSetting);
      }

      const apiText = this.parseBilibiliApi(api);

      if (changeActionTitleAction) {
        changeActionTitleAction(apiText);
      }
    };

    // 选项与图标一起由目录生成：隐藏 Dev 时剩下的行不会拿到别人的图标
    const selectOption: (string | number)[][] = availableApiNodes().map(
      (node) => [
        node.id,
        node.label,
        `<div class="${node.icon}" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
      ],
    );

    IIROSEUtils.buildSelect2(
      null,
      selectOption,
      set,
      false,
      true,
      null,
      false,
      null,
      () => {},
    );
  }

  public getBiliBiliAccount() {
    return readJson<BilibiliACC | null>("bilibiliAccount", null);
  }

  /**
   * 读 B 站设置：`api` 过归一化。
   * 线上构建里存档残留 `Dev` 会回退默认节点，并顺手写回存档——
   * 请求层 `Api.getBilibiliCors` 直接读原始存档，不写回它还会打到 localhost。
   */
  public getBilibiliVideoSettings(): BilibiliVideoSettings {
    const parsed = readJson<BilibiliVideoSettings | null>(
      "bilibiliSetting",
      null,
    );
    if (parsed) {
      const api = this.normalizeBilibiliApi(parsed.api);
      if (api !== parsed.api) {
        parsed.api = api;
        // 存储不可用时写回失败也无妨：本次会话按归一化后的节点走，不打断交互
        writeJson("bilibiliSetting", parsed);
      }
      return parsed;
    } else {
      return {
        qn: 112,
        streamqn: 10000,
        streamSeconds: 43200,
        videoStreamFormat: 2,
        api: DEFAULT_BILIBILI_API,
      };
    }
  }

  /** 归一化：未知值与线上构建里的 `Dev` 一律回退默认节点。 */
  public normalizeBilibiliApi(raw: unknown): BilibiliApiId {
    const node = BILIBILI_API_NODES.find((item) => item.id === raw);
    if (!node) return DEFAULT_BILIBILI_API;
    if (node.id === "Dev" && !isDevApiAvailable()) return DEFAULT_BILIBILI_API;
    return node.id;
  }

  /** 当前构建里可选的节点 id（设置项展示顺序，线上构建不含 `Dev`）。 */
  public availableBilibiliApis(): BilibiliApiId[] {
    return availableApiNodes().map((node) => node.id);
  }

  public parseBilibiliVideoQn(qn: number) {
    const selectOption = [
      [6, "240P 极速"],
      [16, "360P 流畅"],
      [32, "480P 清晰"],
      [64, "720P 高清"],
      [74, "720P60 高帧率"],
      [80, "1080P 高清"],
      [112, "1080P+ 高码率"],
      [116, "1080P60 高帧率"],
      [120, "4K 超清"],
      [126, "杜比视界"],
      [127, "8K 超高清"],
    ];

    const selectedOption = selectOption.find((option) => option[0] === qn);
    if (selectedOption) {
      return selectedOption[1] as string;
    } else {
      return "未知";
    }
  }

  public parseBilibiliLiveQn(qn: number) {
    const selectOption = [
      [250, "超清"],
      [10000, "原生画质"],
    ];

    const selectedOption = selectOption.find((option) => option[0] === qn);
    if (selectedOption) {
      return selectedOption[1] as string;
    } else {
      return "未知";
    }
  }

  public parseGetVideoFormat(format: number) {
    const selectOption = [
      [0, "durl - 音频视频不分离，最高720p画质"],
      [1, "dash - 视频音频分离，可以获取高画质"],
      [2, "混合"],
    ];

    const selectedOption = selectOption.find((option) => option[0] === format);

    if (selectedOption) {
      return selectedOption[1] as string;
    } else {
      return "未知";
    }
  }

  public parseCookie(cookie: string) {
    return cookie.split("; ").reduce((acc: Record<string, string>, part) => {
      const [key, value] = part.split("=");
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
  }

  /** 节点文案取自目录（含 Dev：开发构建里它仍是合法取值，线上构建由归一化先挡住）。 */
  public parseBilibiliApi(api: BilibiliApiId) {
    const node = BILIBILI_API_NODES.find((option) => option.id === api);
    if (node) {
      return node.label;
    } else {
      return "未知";
    }
  }
}
