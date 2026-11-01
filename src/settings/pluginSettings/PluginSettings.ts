import { ShowMessage } from "../../iirose_func/ShowMessage";
import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";
import { Input_Behavior_Module } from "../../input-behavior-module/Input-Behavior-Module";
import {
  DEFAULT_DESK_MODE,
  DESK_MODE_LIST,
  deskModeLabel,
  normalizeDeskMode,
  type DeskModeId,
} from "../deskModeCatalog";

/** 插件设置存档键。 */
const PLUGIN_SETTINGS_KEY = "imwPluginSetting";

/**
 * 设置版本标记：单独一个键，**不放进 `imwPluginSetting` 存档里**。
 * `LocalStorageUtils.mergeSetting` 启动时会把默认值合并进已有存档，
 * 标记若在存档内，会被它悄悄盖上，迁移就永远看不到「旧存档」。
 */
export const SETTINGS_REV_KEY = "imwSettingsRev";

/**
 * 当前设置版本：
 * 1 = 模式重编号（0 视频 / 1 音乐 / 2 设置 / 3 关于 → 0 音乐 / 1 视频 / 2 电台 /
 * 3 收藏 / 4 设置 / 5 关于）后的一次性迁移：不猜测旧值原意，统一重置为音乐。
 */
export const SETTINGS_REV = 1;

/** 启动默认页选择框的图标位（按模式 id 取，缺项由类型检查兜住）。 */
const DEFAULT_PAGE_ICONS: Record<DeskModeId, string> = {
  music: "imwModeMusic",
  video: "imwModeVideo",
  radio: "imwModeRadio",
  favorites: "imwModeFavorites",
  settings: "imwModeSettings",
  about: "imwModeAbout",
};

export type SearchViewMode = "card" | "list";

/**
 * 点播播报模式：card 逐个发卡片（默认/现状） / silent 只不发卡片（点播与播放照常） /
 * summary 批量总结
 */
export type AnnounceMode = "card" | "silent" | "summary";

/** 云同步设置；口令**绝不**入此结构（只存内存，刷新即失锁） */
export interface PluginSyncSettings {
  enabled: boolean;
  /** base64 盐，首次启用时生成并固定保存 */
  salt: string | null;
  lastSyncAt: number | null;
  /**
   * 上次成功写入/拉取到的云端版本号（COS VersionId）。
   * 落盘是为了让「重开页面后的第一次 GET」也能带 If-None-Match 走 304，
   * 而不是每次都整包下载一遍密文。
   */
  lastRev: string | null;
  /** 设备随机 hex id，用于信封 writer 字段 */
  deviceId: string;
  /** 同步函数 URL 基址 */
  serverUrl: string;
}

/** IIROSE-MEDIA-SYNC 函数 URL（ap-guangzhou，开放鉴权，自带 CORS 头） */
export const DEFAULT_SYNC_SERVER_URL =
  "https://1309510434-0wsqedndx7.ap-guangzhou.tencentscf.com";

/** 信封 writer 字段的设备 id 形态，与服务端 cloud/sync/logic.js 的 WRITER_PATTERN 一致 */
const DEVICE_ID_PATTERN = /^[0-9a-f]{16}$/;

export interface PluginSettingsInterface {
  chatBox: {
    isProxyAtInput: boolean;
  };
  defaultPage: number;
  searchViewMode: SearchViewMode;
  announceMode: AnnounceMode;
  /** 收藏每页显示条数（1–500，默认 10） */
  favoritesPageSize: number;
  sync: PluginSyncSettings;
}

/** 收藏每页条数的预设与上下限。 */
export const FAVORITES_PAGE_SIZES = [10, 50, 100] as const;
export const FAVORITES_PAGE_SIZE_MIN = 1;
export const FAVORITES_PAGE_SIZE_MAX = 500;

export class PluginSettings {
  /**
   * 翻转「代理蔷薇@输入」并重装输入行为。
   * @param onChange 回报翻转后的布尔（开关行的单一真相：值取自设置逻辑的结果）
   */
  public static isProxyAtInputSetting(
    onChange?: (checked: boolean) => void,
    changeSearchKeyword?: (keyword: string | null) => void,
    ShowOrHideIMC?: () => Promise<void>,
  ) {
    const pluginSettings = PluginSettings.getPluginSetting();

    pluginSettings.chatBox.isProxyAtInput =
      !pluginSettings.chatBox.isProxyAtInput;
    try {
      localStorage.setItem(PLUGIN_SETTINGS_KEY, JSON.stringify(pluginSettings));
    } catch {
      // 存储不可用（隐私模式 / 配额满）：内存里的设置照常生效，不打断交互
    }

    onChange?.(pluginSettings.chatBox.isProxyAtInput);
    if (changeSearchKeyword && ShowOrHideIMC)
      Input_Behavior_Module.applyBehavior(changeSearchKeyword, ShowOrHideIMC);
  }

  public static setDefaultPage(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    const set = (_t: HTMLElement, s: string) => {
      const ps = PluginSettings.getPluginSetting();
      if (ps) {
        ps.defaultPage = PluginSettings.normalizeDefaultPage(s);
        localStorage.setItem(PLUGIN_SETTINGS_KEY, JSON.stringify(ps));
      }

      if (changeActionTitleAction) {
        changeActionTitleAction(
          PluginSettings.parseDefaultPage(ps.defaultPage),
        );
      }
    };

    // 选项由共享模式目录生成：下标、文案、顺序都只有一份
    const selectOption: (string | number)[][] = DESK_MODE_LIST.map((mode) => [
      mode.index,
      mode.label,
      `<div class="${DEFAULT_PAGE_ICONS[mode.id]}" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
    ]);

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

  /** 收藏每页条数：1–500 的整数，其余（含旧存档缺这一项）回退 10。 */
  public static normalizeFavoritesPageSize(raw: unknown): number {
    const value = Number(raw);
    return Number.isInteger(value) &&
      value >= FAVORITES_PAGE_SIZE_MIN &&
      value <= FAVORITES_PAGE_SIZE_MAX
      ? value
      : 10;
  }

  public static parseFavoritesPageSize(size: number): string {
    return `${PluginSettings.normalizeFavoritesPageSize(size)} 条`;
  }

  private static saveFavoritesPageSize(size: number): number {
    const ps = PluginSettings.getPluginSetting();
    ps.favoritesPageSize = PluginSettings.normalizeFavoritesPageSize(size);
    try {
      localStorage.setItem(PLUGIN_SETTINGS_KEY, JSON.stringify(ps));
    } catch {
      // 存储不可用：本次会话内不生效，不打断交互
    }
    return ps.favoritesPageSize;
  }

  /**
   * 收藏每页显示：10 / 50 / 100 / 自定义。
   * 选「自定义」后等宿站选择框淡出（250ms）再弹数字输入框，否则新弹窗会被一并清掉。
   */
  public static setFavoritesPageSize(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    const report = (size: number) =>
      changeActionTitleAction?.(PluginSettings.parseFavoritesPageSize(size));

    const askCustom = () => {
      const prompt = [
        `请输入收藏每页显示条数（${FAVORITES_PAGE_SIZE_MIN}–${FAVORITES_PAGE_SIZE_MAX}）`,
        `number`,
        8,
      ];
      IIROSEUtils.sync(2, prompt, (input: string | null) => {
        if (!input) return;
        const value = Number(input);
        if (
          !Number.isInteger(value) ||
          value < FAVORITES_PAGE_SIZE_MIN ||
          value > FAVORITES_PAGE_SIZE_MAX
        ) {
          ShowMessage.show(
            `请输入 ${FAVORITES_PAGE_SIZE_MIN} 到 ${FAVORITES_PAGE_SIZE_MAX} 之间的整数`,
          );
          return;
        }
        report(PluginSettings.saveFavoritesPageSize(value));
      });
    };

    const set = (_t: HTMLElement, s: string) => {
      if (s === "custom") {
        setTimeout(askCustom, 300);
        return;
      }
      report(PluginSettings.saveFavoritesPageSize(Number(s)));
    };

    // 宿站选项第三项是图标位（缺了会渲染成 "undefined"）：这里放条数本身
    const badge = (text: string) =>
      `<div style="font-size:24px;font-weight:600;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;">${text}</div>`;
    const selectOption: (string | number)[][] = [
      ...FAVORITES_PAGE_SIZES.map((size) => [
        size,
        `${size} 条`,
        badge(String(size)),
      ]),
      ["custom", "自定义…", badge("#")],
    ];

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

  /**
   * 启动默认页面：合法范围与文案都取自共享模式目录
   * （`settings/deskModeCatalog`），不再在这里硬编码 0..5 与一套中文表。
   */
  public static normalizeDefaultPage(raw: unknown): number {
    return normalizeDeskMode(raw);
  }

  public static parseDefaultPage(page: number): string {
    return deskModeLabel(page);
  }

  /** 读已有存档的设置版本标记；读不到（首次 / 存储不可用）按「未迁移」处理。 */
  private static settingsRev(): number {
    try {
      return Number(localStorage.getItem(SETTINGS_REV_KEY));
    } catch {
      return Number.NaN;
    }
  }

  /**
   * 一次性迁移：旧存档的 `defaultPage` 下标对应的是另一套模式（0 视频 / 1 音乐 /
   * 2 设置 / 3 关于），无法反推用户原意，因此**只重置一次**为音乐，随后写版本标记。
   * 幂等：标记存在即不再动 `defaultPage`，用户之后自己选的页面留得住。
   * 其余设置原样保留（写盘的就是刚归一化过的这个对象）。
   */
  private static migrateSettingsRevision(
    parsed: PluginSettingsInterface,
  ): number {
    if (PluginSettings.settingsRev() === SETTINGS_REV)
      return PluginSettings.normalizeDefaultPage(parsed.defaultPage);

    parsed.defaultPage = DEFAULT_DESK_MODE;
    try {
      localStorage.setItem(PLUGIN_SETTINGS_KEY, JSON.stringify(parsed));
      localStorage.setItem(SETTINGS_REV_KEY, String(SETTINGS_REV));
    } catch {
      // 存储不可用：本次会话内照样按音乐启动，下次读取再试（迁移幂等）
    }
    return parsed.defaultPage;
  }

  /**
   * 切换搜索结果视图（卡片/列表）：读 -> 翻转 -> 写 localStorage -> 返回新值
   */
  public static toggleSearchViewMode(): SearchViewMode {
    const pluginSettings = PluginSettings.getPluginSetting();

    pluginSettings.searchViewMode =
      pluginSettings.searchViewMode === "list" ? "card" : "list";
    localStorage.setItem(PLUGIN_SETTINGS_KEY, JSON.stringify(pluginSettings));

    return pluginSettings.searchViewMode;
  }

  public static parseSearchViewMode(mode: SearchViewMode): string {
    return mode === "list" ? "列表" : "卡片";
  }

  /**
   * 点播播报模式设置入口：三选一选择框（发卡片 / 静默（不发卡片）/ 批量总结）。
   * silent 只是不打点播卡片，点播与播放照常——选项文案要写清这一点，
   * 「静默」单独出现会被读成「什么都不播」。
   */
  public static setAnnounceMode(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    const set = (_t: HTMLElement, s: string) => {
      const pluginSettings = PluginSettings.getPluginSetting();
      pluginSettings.announceMode = PluginSettings.normalizeAnnounceMode(s);
      localStorage.setItem(PLUGIN_SETTINGS_KEY, JSON.stringify(pluginSettings));

      if (changeActionTitleAction) {
        changeActionTitleAction(
          PluginSettings.parseAnnounceMode(pluginSettings.announceMode),
        );
      }
    };

    const iconClass = [
      "announceCardIcon",
      "announceSilentIcon",
      "announceSummaryIcon",
    ];

    const selectOption: (string | number)[][] = [
      ["card", "发卡片"],
      ["silent", "静默（不发卡片）"],
      ["summary", "批量总结"],
    ];

    selectOption.forEach((item, index) => {
      item.push(
        `<div class="${iconClass[index]}" style="font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;"></div>`,
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

  public static parseAnnounceMode(mode: AnnounceMode): string {
    return mode === "silent"
      ? "静默（仅不发卡片）"
      : mode === "summary"
        ? "批量总结"
        : "发卡片";
  }

  /** 归一化：手改 localStorage 产生的非法值一律回退 "card"（单点归一化，同 searchViewMode） */
  public static normalizeAnnounceMode(raw: unknown): AnnounceMode {
    return raw === "silent" || raw === "summary" ? raw : "card";
  }

  public static getPluginSetting(): PluginSettingsInterface {
    const pluginSettings = localStorage.getItem(PLUGIN_SETTINGS_KEY);
    if (pluginSettings) {
      const parsed = JSON.parse(pluginSettings) as PluginSettingsInterface;
      // 单点归一化：手改 localStorage 产生的非法值一律回退 "card"
      parsed.searchViewMode =
        parsed.searchViewMode === "list" ? "list" : "card";
      parsed.announceMode = PluginSettings.normalizeAnnounceMode(
        parsed.announceMode,
      );
      parsed.sync = PluginSettings.normalizeSyncSettings(parsed.sync);
      parsed.favoritesPageSize = PluginSettings.normalizeFavoritesPageSize(
        parsed.favoritesPageSize,
      );
      // 已退役的「随机包含专辑/歌单」：随机范围改由面板选择决定，旧值不再生效。
      delete (parsed as { shuffleIncludeCollections?: unknown })
        .shuffleIncludeCollections;
      // 模式重编号的一次性迁移放在归一化之后：写盘时落的是已经清干净的对象
      parsed.defaultPage = PluginSettings.migrateSettingsRevision(parsed);
      return parsed;
    }
    return {
      chatBox: {
        isProxyAtInput: true,
      },
      defaultPage: DEFAULT_DESK_MODE,
      searchViewMode: "card",
      announceMode: "card",
      favoritesPageSize: 10,
      sync: PluginSettings.defaultSyncSettings(),
    };
  }

  /**
   * 云同步设置的两处默认值之一（另一处是 LocalStorageUtils.setPluginSetting）：
   * 漏一处老用户就会读到 undefined。
   */
  public static defaultSyncSettings(): PluginSyncSettings {
    return {
      enabled: false,
      salt: null,
      lastSyncAt: null,
      lastRev: null,
      deviceId: "",
      serverUrl: DEFAULT_SYNC_SERVER_URL,
    };
  }

  /** 归一化：手改/残留的非法值一律回退默认，键永不为 undefined */
  public static normalizeSyncSettings(
    raw: Partial<PluginSyncSettings> | undefined | null,
  ): PluginSyncSettings {
    const fallback = PluginSettings.defaultSyncSettings();
    if (!raw || typeof raw !== "object") return fallback;
    return {
      enabled: raw.enabled === true,
      salt: typeof raw.salt === "string" && raw.salt ? raw.salt : null,
      lastSyncAt: typeof raw.lastSyncAt === "number" ? raw.lastSyncAt : null,
      lastRev:
        typeof raw.lastRev === "string" && raw.lastRev ? raw.lastRev : null,
      // 服务端强制 ^[0-9a-f]{16}$：非法值会让每次 PUT 400，因此直接清空，
      // 由 SyncManager.ensureDeviceId() 重新生成并落盘（设置面板没有重置入口）。
      deviceId:
        typeof raw.deviceId === "string" && DEVICE_ID_PATTERN.test(raw.deviceId)
          ? raw.deviceId
          : "",
      serverUrl:
        typeof raw.serverUrl === "string" && raw.serverUrl
          ? raw.serverUrl
          : fallback.serverUrl,
    };
  }
}
