// src/settings/pluginSettings/normalize.ts
// 插件设置的取值规则：类型、上下限、以及「读进来的东西一律归一化」的纯函数。
// 不读盘、不写盘——落盘与一次性迁移见 `loadSettings.ts`，对外的门面仍是 PluginSettings。
export type SearchViewMode = "card" | "list";

/**
 * 点播播报模式：card 逐个发卡片（默认/现状） / silent 只不发卡片（点播与播放照常） /
 * summary 批量总结
 */
export type AnnounceMode = "card" | "silent" | "summary";

/** 主面板显示方式：full 全屏（原版）/ window 窗口。 */
export type PanelDisplay = "full" | "window";

/**
 * 点歌台入口（打开 / 收起面板的两种手势入口怎么组合，设置「点歌台入口」四选一）：
 * - pillSwipe 胶囊 + 双指下滑（默认，双指下滑能开能关）
 * - pillSwipeClose 胶囊 + 双指下滑只收起（面板关着时双指下滑没反应）
 * - pill 只用胶囊（双指下滑完全不响应）
 * - swipe 只用双指下滑（不显示胶囊）
 * 没有「两样都没有」：手机上会没有打开面板的入口。
 */
export type PanelEntry = "pillSwipe" | "pillSwipeClose" | "pill" | "swipe";

export const PANEL_ENTRIES: readonly PanelEntry[] = [
  "pillSwipe",
  "pillSwipeClose",
  "pill",
  "swipe",
];

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

export interface PluginSettingsInterface {
  chatBox: {
    isProxyAtInput: boolean;
  };
  defaultPage: number;
  searchViewMode: SearchViewMode;
  announceMode: AnnounceMode;
  /** 收藏每页显示条数（1–500，默认 10） */
  favoritesPageSize: number;
  /** 主面板显示方式（默认全屏；旧存档没有这一项） */
  panelDisplay: PanelDisplay;
  /** 点歌台入口（默认胶囊 + 双指下滑；旧存档没有这一项） */
  panelEntry: PanelEntry;
  sync: PluginSyncSettings;
}

/** IIROSE-MEDIA-SYNC 函数 URL（ap-guangzhou，开放鉴权，自带 CORS 头） */
export const DEFAULT_SYNC_SERVER_URL =
  "https://1309510434-0wsqedndx7.ap-guangzhou.tencentscf.com";

/** 信封 writer 字段的设备 id 形态，与服务端 cloud/sync/logic.js 的 WRITER_PATTERN 一致 */
const DEVICE_ID_PATTERN = /^[0-9a-f]{16}$/;

/** 收藏每页条数的预设与上下限。 */
export const FAVORITES_PAGE_SIZES = [10, 50, 100] as const;
export const FAVORITES_PAGE_SIZE_MIN = 1;
export const FAVORITES_PAGE_SIZE_MAX = 500;

/** 收藏每页条数：1–500 的整数，其余（含旧存档缺这一项）回退 10。 */
export function normalizeFavoritesPageSize(raw: unknown): number {
  const value = Number(raw);
  return Number.isInteger(value) &&
    value >= FAVORITES_PAGE_SIZE_MIN &&
    value <= FAVORITES_PAGE_SIZE_MAX
    ? value
    : 10;
}

/** 归一化：手改 localStorage 产生的非法值一律回退 "card"（单点归一化，同 searchViewMode） */
export function normalizeAnnounceMode(raw: unknown): AnnounceMode {
  return raw === "silent" || raw === "summary" ? raw : "card";
}

/** 归一化：缺失或非法值一律回退「胶囊 + 双指下滑」（与没有这项设置之前的行为一致）。 */
export function normalizePanelEntry(raw: unknown): PanelEntry {
  return PANEL_ENTRIES.includes(raw as PanelEntry)
    ? (raw as PanelEntry)
    : "pillSwipe";
}

/** 这一档面板收起后显示不显示胶囊。 */
export function panelEntryShowsPill(entry: PanelEntry): boolean {
  return entry !== "swipe";
}

/** 这一档下双指下滑此刻响不响应：`panelOpen` 时是收起，否则是打开。 */
export function panelEntryAllowsSwipe(
  entry: PanelEntry,
  panelOpen: boolean,
): boolean {
  if (entry === "pill") return false;
  if (entry === "pillSwipeClose") return panelOpen;
  return true;
}

/** 归一化：缺失或非法值一律回退全屏。 */
export function normalizePanelDisplay(raw: unknown): PanelDisplay {
  return raw === "window" ? "window" : "full";
}

/**
 * 云同步设置的两处默认值之一（另一处是 LocalStorageUtils.setPluginSetting）：
 * 漏一处老用户就会读到 undefined。
 */
export function defaultSyncSettings(): PluginSyncSettings {
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
export function normalizeSyncSettings(
  raw: Partial<PluginSyncSettings> | undefined | null,
): PluginSyncSettings {
  const fallback = defaultSyncSettings();
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
