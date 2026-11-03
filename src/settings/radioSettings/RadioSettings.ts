import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";
import { readJson, writeJson } from "../../storage/localStore";

export interface RadioSetting {
  duration: number; // 单位秒
}

export class RadioSettings {
  public static setRadioStreamSeconds(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    function set(userInput: string | null) {
      if (!userInput) return;
      const streamMinutes = parseInt(userInput as string);
      const parseRadioSetting = readJson<RadioSetting | null>(
        "radioSettings",
        null,
      );
      if (parseRadioSetting) {
        parseRadioSetting.duration = streamMinutes * 60;
        writeJson("radioSettings", parseRadioSetting);
      }

      if (changeActionTitleAction) {
        changeActionTitleAction(`${streamMinutes} 分钟`);
      }
    }

    const t = [`请输入电台播放时长 (分钟)`, `number`, 8];

    IIROSEUtils.sync(2, t, set);
  }

  public static getRadioSettings(): RadioSetting {
    const radioSettings = readJson<RadioSetting | null>("radioSettings", null);
    if (radioSettings) {
      return radioSettings;
    } else {
      const defaultSetting: RadioSetting = { duration: 43200 };
      writeJson("radioSettings", defaultSetting);
      return defaultSetting;
    }
  }
}
