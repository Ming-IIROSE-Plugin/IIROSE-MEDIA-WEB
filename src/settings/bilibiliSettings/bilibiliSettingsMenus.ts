// B 站设置页的 UI 构造：宿站选择弹窗 / 输入弹窗的选项与回调。
//
// 只做「弹什么、点了写什么」，读写存档与文案解析都在 `BiliBiliSettings`。
// 每个菜单的回调收到宿站回传的取值后交给传入的 changeActionTitleAction 更新标题。

import { BiliBiliAccount } from "../../Account/BiliBili/SetBiliBili";
import { BiliBiliLoginApi } from "../../Api/BilibiliAPI/LoginAPI";
import type { BilibiliACC } from "../../Account/BiliBili/BilibiliAccountInterface";
import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";
import { readJson, removeKey, writeJson } from "../../storage/localStore";
import type {
  BilibiliSettingsReader,
  BilibiliVideoSettings,
} from "./bilibiliSettingsShared";
import { availableApiNodes } from "./bilibiliSettingsShared";

/** 宿站单选选择弹窗：参数与各菜单早就固定成这一串，别按调用点各自改。 */
const openMenu = (
  selectOption: (string | number)[][],
  onSelect: (t: HTMLElement, value: string) => void,
) =>
  IIROSEUtils.buildSelect2(
    null,
    selectOption,
    onSelect,
    false,
    true,
    null,
    false,
    null,
    () => {},
  );

const iconCell = (mdiClass: string) =>
  `<div class="${mdiClass}" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`;

export const showAccountMenu = (
  reader: BilibiliSettingsReader,
  changeActionTitleAction?: (actionTitle?: string) => void,
) => {
  const login = (_t: HTMLElement, s: string) => {
    const handleUserInputCookie = async (input: string | null) => {
      if (!input) return;
      const cookie = input;

      const cookies = reader.parseCookie(cookie);
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

  const bilibiliAccount = reader.getBiliBiliAccount();

  if (bilibiliAccount && bilibiliAccount.uname && bilibiliAccount.face) {
    const selectOption = [
      [
        0,
        bilibiliAccount.uname,
        `<div style="height:100px;width:100px;position:absolute;top:0;left:0;"><div class="bgImgBox"><img class="bgImg" loading="lazy" decoding="async" src="${bilibiliAccount.face}" onerror="this.style.display='none';"><div class="fullBox"></div></div></div>`,
      ],
      [1, "登出账号", iconCell("mdi-logout")],
    ];
    openMenu(selectOption, logOut);
  } else {
    const selectOption = [
      [0, "扫码登录账号", iconCell("mdi-qrcode")],
      [1, "输入B站Cookie", iconCell("mdi-cookie")],
    ];
    openMenu(selectOption, login);
  }
};

export const showVideoQualityMenu = (
  reader: BilibiliSettingsReader,
  changeActionTitleAction?: (actionTitle?: string) => void,
) => {
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

    const qnText = reader.parseBilibiliVideoQn(qn);

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
    item.push(iconCell(mdiClass[index]));
  });

  openMenu(selectOption, setBilibiliVideoQuality);
};

export const showLiveQualityMenu = (
  reader: BilibiliSettingsReader,
  changeActionTitleAction?: (actionTitle?: string) => void,
) => {
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

    const qnText = reader.parseBilibiliLiveQn(qn);

    if (changeActionTitleAction) {
      changeActionTitleAction(qnText);
    }
  };

  const mdiClass = ["mdi-motion-play", "mdi-high-definition-box"];

  selectOption.forEach((item, index) => {
    item.push(iconCell(mdiClass[index]));
  });

  openMenu(selectOption, set);
};

export const showStreamSecondsPrompt = (
  changeActionTitleAction?: (actionTitle?: string) => void,
) => {
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
};

export const showVideoFormatMenu = (
  reader: BilibiliSettingsReader,
  changeActionTitleAction?: (actionTitle?: string) => void,
) => {
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

    const formatText = reader.parseGetVideoFormat(format);

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
    item.push(iconCell(mdiClass[index]));
  });

  openMenu(selectOption, set);
};

export const showDefaultApiMenu = (
  reader: BilibiliSettingsReader,
  changeActionTitleAction?: (actionTitle?: string) => void,
) => {
  const set = (_t: HTMLElement, s: string) => {
    const api = reader.normalizeBilibiliApi(s);

    const parseBilibiliSetting = readJson<BilibiliVideoSettings | null>(
      "bilibiliSetting",
      null,
    );
    if (parseBilibiliSetting) {
      parseBilibiliSetting.api = api;
      writeJson("bilibiliSetting", parseBilibiliSetting);
    }

    const apiText = reader.parseBilibiliApi(api);

    if (changeActionTitleAction) {
      changeActionTitleAction(apiText);
    }
  };

  // 选项与图标一起由目录生成：隐藏 Dev 时剩下的行不会拿到别人的图标
  const selectOption: (string | number)[][] = availableApiNodes().map(
    (node) => [node.id, node.label, iconCell(node.icon)],
  );

  openMenu(selectOption, set);
};
