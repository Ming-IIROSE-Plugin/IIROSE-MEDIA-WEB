// src/settings/pluginSettings/loadSettings.ts
// 插件设置的读盘：归一化 + 模式重编号的一次性迁移。
// 迁移的原子语义在这里落地——存档写成功才写版本标记，否则（存储不可用）下次读取再试。
import {
  readJson,
  readString,
  writeJson,
  writeString,
} from "../../storage/localStore";
import { DEFAULT_DESK_MODE, normalizeDeskMode } from "../deskModeCatalog";
import {
  defaultSyncSettings,
  normalizeAnnounceMode,
  normalizeFavoritesPageSize,
  normalizeSyncSettings,
  type PluginSettingsInterface,
} from "./normalize";

/** 插件设置存档键。 */
export const PLUGIN_SETTINGS_KEY = "imwPluginSetting";

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

/** 读已有存档的设置版本标记；读不到（首次 / 存储不可用）按「未迁移」处理。 */
function settingsRev(): number {
  const raw = readString(SETTINGS_REV_KEY);
  // 读不到（首次 / 存储不可用）按「未迁移」处理：不能落成 0，否则 SETTINGS_REV 为 0 时会跳过迁移。
  return raw === null ? Number.NaN : Number(raw);
}

/**
 * 一次性迁移：旧存档的 `defaultPage` 下标对应的是另一套模式（0 视频 / 1 音乐 /
 * 2 设置 / 3 关于），无法反推用户原意，因此**只重置一次**为音乐，随后写版本标记。
 * 幂等：标记存在即不再动 `defaultPage`，用户之后自己选的页面留得住。
 * 其余设置原样保留（写盘的就是刚归一化过的这个对象）。
 */
function migrateSettingsRevision(parsed: PluginSettingsInterface): number {
  if (settingsRev() === SETTINGS_REV)
    return normalizeDeskMode(parsed.defaultPage);

  parsed.defaultPage = DEFAULT_DESK_MODE;
  // 存储不可用时写入失败也无妨：本次会话内照样按音乐启动，下次读取再试（迁移幂等）。
  // 标记只在存档写成功后才落：否则会跳过迁移却没保存新的 defaultPage。
  if (writeJson(PLUGIN_SETTINGS_KEY, parsed)) {
    writeString(SETTINGS_REV_KEY, String(SETTINGS_REV));
  }
  return parsed.defaultPage;
}

/** 读存档并归一化；没有存档时返回默认设置。 */
export function loadPluginSetting(): PluginSettingsInterface {
  const parsed = readJson<PluginSettingsInterface | null>(
    PLUGIN_SETTINGS_KEY,
    null,
  );
  if (parsed) {
    // 单点归一化：手改 localStorage 产生的非法值一律回退 "card"
    parsed.searchViewMode = parsed.searchViewMode === "list" ? "list" : "card";
    parsed.announceMode = normalizeAnnounceMode(parsed.announceMode);
    parsed.sync = normalizeSyncSettings(parsed.sync);
    parsed.favoritesPageSize = normalizeFavoritesPageSize(
      parsed.favoritesPageSize,
    );
    // 已退役的「随机包含专辑/歌单」：随机范围改由面板选择决定，旧值不再生效。
    delete (parsed as { shuffleIncludeCollections?: unknown })
      .shuffleIncludeCollections;
    // 模式重编号的一次性迁移放在归一化之后：写盘时落的是已经清干净的对象
    parsed.defaultPage = migrateSettingsRevision(parsed);
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
    sync: defaultSyncSettings(),
  };
}
