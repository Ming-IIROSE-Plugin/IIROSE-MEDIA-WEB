import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";
import { NETEASE_NODES, getNeteaseNode } from "../../Api/NeteaseAPI/Nodes";
import { readJson, writeJson } from "../../storage/localStore";

export class NetEaseSettings {
  public static setNeteaseMusicQuality(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    const set = (_t: HTMLElement, s: string) => {
      const neteaseSetting = readJson<NeteaseSetting | null>(
        "neteaseSetting",
        null,
      );

      if (neteaseSetting) {
        neteaseSetting.quality = s as
          | "standard"
          | "higher"
          | "exhigh"
          | "lossless"
          | "hires"
          | "jyeffect"
          | "sky"
          | "jymaster";
        writeJson("neteaseSetting", neteaseSetting);
      }

      if (changeActionTitleAction) {
        const qualityInText = this.parseNetEaseMusicQuality(s);
        changeActionTitleAction(qualityInText);
      }
    };

    const mdiClass = [
      "mdi-music-note",
      "mdi-music-note",
      "mdi-music-note",
      "mdi-music-note-plus",
      "mdi-music-note-plus",
      "mdi-surround-sound-7-1",
      "mdi-surround-sound-7-1",
      "mdi-grain",
    ];

    const selectOption = [
      ["standard", "标准音质"],
      ["higher", "较高音质"],
      ["exhigh", "极高音质"],
      ["lossless", "无损音质"],
      ["hires", "Hi-Res"],
      ["jyeffect", "高清环绕声"],
      ["sky", "沉浸环绕声"],
      ["jymaster", "超清母带"],
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

  public static setNeteaseDefaultApi(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    const set = (_t: HTMLElement, s: string) => {
      const neteaseSetting = readJson<NeteaseSetting | null>(
        "neteaseSetting",
        null,
      );

      if (neteaseSetting) {
        neteaseSetting.api = s as "default" | "HK" | "Dev";
        writeJson("neteaseSetting", neteaseSetting);
      }

      if (changeActionTitleAction) {
        const apiIntext = this.parseNetEaseMusicApi(s);
        changeActionTitleAction(apiIntext);
      }
    };

    // 节点文案与图标统一取自 NETEASE_NODES，避免选项表与读取端各写一份
    const selectOption = NETEASE_NODES.map((node) => [node.id, node.label]);

    const mdiClass = NETEASE_NODES.map((node) => node.icon);

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

  public static setNeteaseMusicLyric(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    const set = (_t: HTMLElement, s: string) => {
      const neteaseSetting = readJson<NeteaseSetting | null>(
        "neteaseSetting",
        null,
      );

      if (neteaseSetting) {
        neteaseSetting.lyricOption = s as
          "off" | "original" | "translated" | "both";
        writeJson("neteaseSetting", neteaseSetting);
      }

      if (changeActionTitleAction) {
        const lyricOptionInText = this.parseNetEaseMusicLyricOption(s);
        changeActionTitleAction(lyricOptionInText);
      }
    };

    const mdiClass = [
      "mdi-close",
      "mdi-book-open-variant",
      "mdi-translate",
      "mdi-book-open-variant",
    ];

    const selectOption = [
      ["off", "关闭歌词"],
      ["original", "原文歌词"],
      ["translated", "翻译歌词"],
      ["both", "原文 + 翻译歌词"],
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

  public static getNeteaseMusicSetting(): NeteaseSetting {
    const neteaseSetting = readJson<NeteaseSetting | null>(
      "neteaseSetting",
      null,
    );
    if (neteaseSetting) {
      return neteaseSetting;
    } else {
      return {
        quality: "lossless",
        api: "default",
        lyricOption: "both",
      };
    }
  }

  public static parseNetEaseMusicQuality(quality: string) {
    const selectOption = [
      ["standard", "标准音质"],
      ["higher", "较高音质"],
      ["exhigh", "极高音质"],
      ["lossless", "无损音质"],
      ["hires", "Hi-Res"],
      ["jyeffect", "高清环绕声"],
      ["sky", "沉浸环绕声"],
      ["jymaster", "超清母带"],
    ];

    const optionInText = selectOption.find((option) => option[0] === quality);

    return optionInText ? optionInText[1] : "为止";
  }

  public static parseNetEaseMusicApi(api: string) {
    return getNeteaseNode(api).label;
  }

  public static parseNetEaseMusicLyricOption(lyricOption: string) {
    const selectOption = [
      ["off", "关闭歌词"],
      ["original", "原文歌词"],
      ["translated", "翻译歌词"],
      ["both", "原文 + 翻译歌词"],
    ];

    const optionInText = selectOption.find(
      (option) => option[0] === lyricOption,
    );

    return optionInText ? optionInText[1] : "原文 + 翻译歌词";
  }
}
