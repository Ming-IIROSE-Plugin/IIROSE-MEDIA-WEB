import type { BilibiliACC } from "../../Account/BiliBili/BilibiliAccountInterface";
import { readJson, writeJson } from "../../storage/localStore";
import {
  showAccountMenu,
  showDefaultApiMenu,
  showLiveQualityMenu,
  showStreamSecondsPrompt,
  showVideoFormatMenu,
  showVideoQualityMenu,
} from "./bilibiliSettingsMenus";
import type {
  BilibiliApiId,
  BilibiliVideoSettings,
} from "./bilibiliSettingsShared";
import {
  availableApiNodes,
  BILIBILI_API_NODES,
  DEFAULT_BILIBILI_API,
  isDevApiAvailable,
} from "./bilibiliSettingsShared";

export type { BilibiliApiId, BilibiliVideoSettings };
export { DEFAULT_BILIBILI_API };

/**
 * B 站设置的读写与文案解析。
 * 设置页的选项表 / 弹窗回调都在 `bilibiliSettingsMenus`，这里只留「读什么、写什么」。
 */
export class BiliBiliSettings {
  public setAccount(changeActionTitleAction?: (actionTitle?: string) => void) {
    showAccountMenu(this, changeActionTitleAction);
  }

  public setBilibiliVideoQuality(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    showVideoQualityMenu(this, changeActionTitleAction);
  }

  public setBilibiliLiveQuality(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    showLiveQualityMenu(this, changeActionTitleAction);
  }

  public setBilibiliStreamSeconds(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    showStreamSecondsPrompt(changeActionTitleAction);
  }

  public setGetVideoFormat(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    showVideoFormatMenu(this, changeActionTitleAction);
  }

  public setBilibiliDefaultApi(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    showDefaultApiMenu(this, changeActionTitleAction);
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
