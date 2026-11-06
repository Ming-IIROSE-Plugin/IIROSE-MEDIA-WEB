import { BilibiliVideoSettings } from "../bilibiliSettings/BiliBiliSettings";
import {
  CommonSettings,
  CommonSettingsInterface,
} from "../commonSettings/CommonSettings";
import {
  PluginSettings,
  PluginSettingsInterface,
} from "../pluginSettings/PluginSettings";
import { readJson, writeJson } from "../../storage/localStore";

export class LocalStorageUtils {
  public static Init() {
    this.setBilibili();
    this.setNetease();
    this.setCommonSetting();
    this.setPluginSetting();
  }

  /**
   * 通用合并方法：确保本地存储的配置包含所有默认键值对
   * @param key LocalStorage 的键名
   * @param defaultSetting 默认配置对象
   */
  private static mergeSetting<T extends object>(
    key: string,
    defaultSetting: T,
  ): void {
    const currentSetting = readJson<T | null>(key, null);
    if (!currentSetting) {
      // 如果完全没有记录（或存档损坏），直接写入默认值
      writeJson(key, defaultSetting);
      return;
    }

    // 使用展开运算符进行合并：默认值在前，现有值在后（覆盖默认值）
    // 注意：如果存在深层嵌套（如 chatBox），需要手动处理深层合并
    const merged = { ...defaultSetting, ...currentSetting };

    // 针对你代码中存在的深层对象特殊处理（例如 imwPluginSetting.chatBox / sync）
    const stored = currentSetting as { chatBox?: unknown; sync?: unknown };
    if (key === "imwPluginSetting" && stored.chatBox) {
      (merged as any).chatBox = {
        ...(defaultSetting as any).chatBox,
        ...stored.chatBox,
      };
    }

    if (key === "imwPluginSetting" && stored.sync) {
      (merged as any).sync = {
        ...(defaultSetting as any).sync,
        ...stored.sync,
      };
    }

    writeJson(key, merged);
  }

  private static setBilibili() {
    const defaultBilibili: BilibiliVideoSettings = {
      qn: 112,
      streamqn: 10000,
      streamSeconds: 43200,
      videoStreamFormat: 1,
      api: "Guangzhou",
    };
    this.mergeSetting("bilibiliSetting", defaultBilibili);
  }

  private static setNetease() {
    const defaultNetease: NeteaseSetting = {
      quality: "lossless",
      api: "default",
      lyricOption: "both",
    };
    this.mergeSetting("neteaseSetting", defaultNetease);
  }

  private static setCommonSetting() {
    // CommonSetting 逻辑较为特殊（涉及版本校验和协议同意），保持原逻辑并增强鲁棒性
    const commonSetting = readJson<CommonSettingsInterface | null>(
      "commonSetting",
      null,
    );
    const latestCommonSetting = this.getCommonSetting();

    if (!commonSetting) {
      writeJson("commonSetting", latestCommonSetting);
      const cs = new CommonSettings();
      cs.setAgree(
        latestCommonSetting.TOS.TOSVersion,
        latestCommonSetting.Privacy.PrivacyVersion,
      );
    } else {
      try {
        // 合并基础结构，防止缺少 Privacy 或 TOS 对象报错
        const mergedSetting = { ...latestCommonSetting, ...commonSetting };

        const tosVersion = mergedSetting.TOS.TOSVersion;
        const privacyVersion = mergedSetting.Privacy.PrivacyVersion;

        // 版本不一致时，强制覆盖协议内容但保留同意状态（或根据需求重置）
        if (tosVersion !== latestCommonSetting.TOS.TOSVersion) {
          mergedSetting.TOS = { ...latestCommonSetting.TOS, TOSAgree: false };
        }
        if (privacyVersion !== latestCommonSetting.Privacy.PrivacyVersion) {
          mergedSetting.Privacy = {
            ...latestCommonSetting.Privacy,
            PrivacyAgree: false,
          };
        }

        if (
          !mergedSetting.Privacy.PrivacyAgree ||
          !mergedSetting.TOS.TOSAgree
        ) {
          const cs = new CommonSettings();
          cs.setAgree(
            mergedSetting.TOS.TOSVersion,
            mergedSetting.Privacy.PrivacyVersion,
          );
        }

        writeJson("commonSetting", mergedSetting);
      } catch (e) {
        writeJson("commonSetting", latestCommonSetting);
      }
    }
  }

  private static getCommonSetting(): CommonSettingsInterface {
    return {
      TOS: {
        TOSVersion: "1.0.1",
        TOSAgree: false,
      },
      Privacy: {
        // 1.0.1 → 1.0.2：新增「收藏密文上传」说明；
        // 1.0.2 → 1.0.3：文案自洽化 + 新增「本机缓存不可导出密钥句柄」的告知。
        // 1.0.3 → 1.0.4：第 3 条改为与实现一致——首次启用先纯读预览，云端有数据才确认，
        //                云端为空跳过确认直接上传。
        // 版本变化会强制把同意状态重置为未同意，老用户必须重新确认一次（有意为之）。
        PrivacyVersion: "1.0.4",
        PrivacyAgree: false,
      },
    };
  }

  private static setPluginSetting() {
    const defaultPlugin: PluginSettingsInterface = {
      chatBox: {
        isProxyAtInput: true,
      },
      defaultPage: 0, // 0 音乐 1 视频 2 电台 3 收藏 4 设置 5 关于
      searchViewMode: "card", // 搜索结果视图：card 卡片网格 / list 列表
      announceMode: "card", // 点播播报模式：card 发卡片 / silent 静默 / summary 批量总结（与 PluginSettings.getPluginSetting 两处一致）
      favoritesPageSize: 10, // 收藏每页显示条数（与 PluginSettings.getPluginSetting 两处一致）
      panelDisplay: "full", // 主面板显示方式：full 全屏 / window 窗口（与 loadPluginSetting 两处一致）
      // 云同步默认值（与 PluginSettings.getPluginSetting 保持两处一致）
      sync: PluginSettings.defaultSyncSettings(),
    };
    this.mergeSetting("imwPluginSetting", defaultPlugin);
  }
}
