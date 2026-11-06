import { ShowMessage } from "../../iirose_func/ShowMessage";
import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";
import { Input_Behavior_Module } from "../../input-behavior-module/Input-Behavior-Module";
import { writeJson } from "../../storage/localStore";
import {
  DESK_MODE_LIST,
  deskModeLabel,
  normalizeDeskMode,
  type DeskModeId,
} from "../deskModeCatalog";
import { PLUGIN_SETTINGS_KEY, loadPluginSetting } from "./loadSettings";
import {
  FAVORITES_PAGE_SIZE_MAX,
  FAVORITES_PAGE_SIZE_MIN,
  FAVORITES_PAGE_SIZES,
  defaultSyncSettings,
  normalizeAnnounceMode,
  normalizeFavoritesPageSize,
  normalizeSyncSettings,
  type AnnounceMode,
  type PanelDisplay,
  type PluginSettingsInterface,
  type PluginSyncSettings,
  type SearchViewMode,
} from "./normalize";

export {
  DEFAULT_SYNC_SERVER_URL,
  FAVORITES_PAGE_SIZE_MAX,
  FAVORITES_PAGE_SIZE_MIN,
  FAVORITES_PAGE_SIZES,
} from "./normalize";
export type {
  AnnounceMode,
  PanelDisplay,
  PluginSettingsInterface,
  PluginSyncSettings,
  SearchViewMode,
} from "./normalize";
export { SETTINGS_REV, SETTINGS_REV_KEY } from "./loadSettings";

/** 启动默认页选择框的图标位（按模式 id 取，缺项由类型检查兜住）。 */
const DEFAULT_PAGE_ICONS: Record<DeskModeId, string> = {
  music: "imwModeMusic",
  video: "imwModeVideo",
  radio: "imwModeRadio",
  favorites: "imwModeFavorites",
  settings: "imwModeSettings",
  about: "imwModeAbout",
};

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
    // 存储不可用（隐私模式 / 配额满）时写入失败也无妨：内存里的设置照常生效，不打断交互
    writeJson(PLUGIN_SETTINGS_KEY, pluginSettings);

    onChange?.(pluginSettings.chatBox.isProxyAtInput);
    if (changeSearchKeyword && ShowOrHideIMC)
      Input_Behavior_Module.applyBehavior(changeSearchKeyword, ShowOrHideIMC);
  }

  public static setDefaultPage(
    changeActionTitleAction?: (actionTitle?: string) => void,
  ) {
    const set = (_t: HTMLElement, s: string) => {
      const ps = PluginSettings.getPluginSetting();
      ps.defaultPage = PluginSettings.normalizeDefaultPage(s);
      // 写盘失败就不改标题：否则显示的是「启动页已设为 X」，重启后却回到原值。
      if (!writeJson(PLUGIN_SETTINGS_KEY, ps)) {
        ShowMessage.show("设置保存失败，请重试");
        return;
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
    return normalizeFavoritesPageSize(raw);
  }

  public static parseFavoritesPageSize(size: number): string {
    return `${PluginSettings.normalizeFavoritesPageSize(size)} 条`;
  }

  /** 写盘成功才返回新值：失败返回 null，调用方据此保持标题显示旧值并提示。 */
  private static saveFavoritesPageSize(size: number): number | null {
    const ps = PluginSettings.getPluginSetting();
    ps.favoritesPageSize = PluginSettings.normalizeFavoritesPageSize(size);
    return writeJson(PLUGIN_SETTINGS_KEY, ps) ? ps.favoritesPageSize : null;
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
        const saved = PluginSettings.saveFavoritesPageSize(value);
        if (saved === null) ShowMessage.show("设置保存失败，请重试");
        else report(saved);
      });
    };

    const set = (_t: HTMLElement, s: string) => {
      if (s === "custom") {
        setTimeout(askCustom, 300);
        return;
      }
      const saved = PluginSettings.saveFavoritesPageSize(Number(s));
      if (saved === null) ShowMessage.show("设置保存失败，请重试");
      else report(saved);
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

  /**
   * 切换搜索结果视图（卡片/列表）：读 -> 翻转 -> 写 localStorage -> 返回新值
   */
  public static toggleSearchViewMode(): SearchViewMode {
    const pluginSettings = PluginSettings.getPluginSetting();

    pluginSettings.searchViewMode =
      pluginSettings.searchViewMode === "list" ? "card" : "list";
    writeJson(PLUGIN_SETTINGS_KEY, pluginSettings);

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
      writeJson(PLUGIN_SETTINGS_KEY, pluginSettings);

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
    return normalizeAnnounceMode(raw);
  }

  private static panelDisplayListeners = new Set<
    (display: PanelDisplay) => void
  >();

  /**
   * 切换主面板的全屏 / 窗口：写盘成功才生效并通知订阅方（面板立即切换）；
   * 写盘失败时提示并保持原模式，否则刷新后设置会悄悄退回去。返回切换后实际的模式。
   */
  public static togglePanelDisplay(): PanelDisplay {
    const ps = PluginSettings.getPluginSetting();
    const previous = ps.panelDisplay;
    ps.panelDisplay = previous === "window" ? "full" : "window";
    if (!writeJson(PLUGIN_SETTINGS_KEY, ps)) {
      ShowMessage.show("设置保存失败，请重试");
      return previous;
    }
    for (const listener of PluginSettings.panelDisplayListeners)
      listener(ps.panelDisplay);
    return ps.panelDisplay;
  }

  /** 订阅全屏 / 窗口的切换，返回退订函数。 */
  public static onPanelDisplayChange(
    listener: (display: PanelDisplay) => void,
  ): () => void {
    PluginSettings.panelDisplayListeners.add(listener);
    return () => {
      PluginSettings.panelDisplayListeners.delete(listener);
    };
  }

  public static getPluginSetting(): PluginSettingsInterface {
    return loadPluginSetting();
  }

  /**
   * 云同步设置的两处默认值之一（另一处是 LocalStorageUtils.setPluginSetting）：
   * 漏一处老用户就会读到 undefined。
   */
  public static defaultSyncSettings(): PluginSyncSettings {
    return defaultSyncSettings();
  }

  /** 归一化：手改/残留的非法值一律回退默认，键永不为 undefined */
  public static normalizeSyncSettings(
    raw: Partial<PluginSyncSettings> | undefined | null,
  ): PluginSyncSettings {
    return normalizeSyncSettings(raw);
  }
}
