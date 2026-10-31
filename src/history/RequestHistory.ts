// 本地点播历史（CAP-10）：只由 `Socket.send` 的观察钩子写入，落在 localStorage，
// 读取只认这一份本地存档。同一媒体移到最前、上限 50 条、跨房间共用；
// 不提供删除界面，也不进云同步。

export const REQUEST_HISTORY_KEY = "imwRequestHistory";

/** 存档版本：结构变化时整体按空历史处理，不做迁移。 */
const STORAGE_VERSION = 1;
/** 最多保留的条数（超出的最旧记录丢弃）。 */
const MAX_ENTRIES = 50;
/** 报文前缀：只认点播报文，卡片报文（`{"m":...}`）不写。 */
const PAYLOAD_PREFIX = "&1";
/** 合并写盘的最短间隔（毫秒）：超出窗口的改动并进下一次写，至多一秒一次。 */
const WRITE_INTERVAL_MS = 1000;

/** 来源：`@0` 网易云单曲、`!7` 网易云 MV、`!3`/`!8` B 站、其余记「其他」。 */
export type RequestHistorySource =
  "netease" | "neteaseMV" | "bilibili" | "other";

/** 条目形态：与来源码一一对应；无来源（电台流、`@` 直链）记 `other`。 */
export type RequestHistoryKind = "music" | "mv" | "video" | "other";

export interface RequestHistoryEntry {
  /** 去重键：`source:mediaId`；没有媒体 id 时退化为 `source:标题|歌手`。 */
  key: string;
  source: RequestHistorySource;
  kind: RequestHistoryKind;
  /** 平台媒体 id（网易云曲目 id、B 站 BV 号 / 直播间号）；解析不出时为 null。 */
  mediaId: string | null;
  title: string;
  artist: string;
  /** 封面（已升 https）。 */
  cover: string;
  /** 来源页链接（已升 https）。 */
  link: string;
  /** 时长（秒）；报文缺值时没有这一项。 */
  duration?: number;
  /** 写入时间（毫秒）。 */
  at: number;
}

/** 平台码 → 来源 / 形态（`Socket/Media` 的 `mediaEvent` 表）。 */
const PLATFORM_CODES: Record<
  string,
  { source: RequestHistorySource; kind: RequestHistoryKind }
> = {
  "@0": { source: "netease", kind: "music" },
  "!7": { source: "neteaseMV", kind: "mv" },
  "!3": { source: "bilibili", kind: "video" },
  "!8": { source: "bilibili", kind: "video" },
  "=0": { source: "other", kind: "other" },
  "!1": { source: "other", kind: "other" },
};

const SOURCES = new Set<RequestHistorySource>([
  "netease",
  "neteaseMV",
  "bilibili",
  "other",
]);
const KINDS = new Set<RequestHistoryKind>(["music", "mv", "video", "other"]);

interface PayloadShape {
  d?: unknown;
  c?: unknown;
  n?: unknown;
  r?: unknown;
  b?: unknown;
  o?: unknown;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

/** 报文里的 `c` / `o` 已被截掉 `http`（`s://…` / `://…`），统一补回 https。 */
function restoreUrl(raw: unknown): string {
  if (!isString(raw)) return "";
  if (raw.startsWith("s://")) return `https://${raw.slice(4)}`;
  if (raw.startsWith("://")) return `https://${raw.slice(3)}`;
  if (raw.startsWith("http://")) return `https://${raw.slice(7)}`;
  return raw;
}

/** 从来源页链接里取媒体 id：网易云 `id=`、B 站 BV 号 / 直播间号。 */
function mediaIdOf(source: RequestHistorySource, link: string): string | null {
  if (source === "netease" || source === "neteaseMV") {
    const match = /[?&#]id=(\d+)/.exec(link);
    return match?.[1] ?? null;
  }
  if (source === "bilibili") {
    const video = /\/video\/(BV[0-9A-Za-z]+)/.exec(link);
    if (video) return video[1];
    const live = /live\.bilibili\.com\/(\d+)/.exec(link);
    return live?.[1] ?? null;
  }
  return null;
}

function isEntry(value: unknown): value is RequestHistoryEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const entry = value as Record<string, unknown>;
  return (
    isString(entry.key) &&
    isString(entry.title) &&
    isString(entry.artist) &&
    isString(entry.cover) &&
    isString(entry.link) &&
    isString(entry.source) &&
    SOURCES.has(entry.source as RequestHistorySource) &&
    isString(entry.kind) &&
    KINDS.has(entry.kind as RequestHistoryKind) &&
    (entry.mediaId === null || isString(entry.mediaId)) &&
    (entry.duration === undefined || typeof entry.duration === "number") &&
    typeof entry.at === "number"
  );
}

/** 解析一条 `&1` 点播报文；不是点播报文 / 没有标题时返回 null。 */
function parsePayload(text: string): RequestHistoryEntry | null {
  if (!text.startsWith(PAYLOAD_PREFIX)) return null;
  const parsed = JSON.parse(text.slice(PAYLOAD_PREFIX.length)) as PayloadShape;
  const title = isString(parsed.n) ? parsed.n.trim() : "";
  if (!title) return null;
  const code = isString(parsed.b) ? parsed.b : "";
  const { source, kind } = PLATFORM_CODES[code] ?? {
    source: "other" as const,
    kind: "other" as const,
  };
  const link = restoreUrl(parsed.o);
  const mediaId = mediaIdOf(source, link);
  const artist = isString(parsed.r) ? parsed.r : "";
  const duration =
    typeof parsed.d === "number" && Number.isFinite(parsed.d)
      ? parsed.d
      : undefined;
  return {
    key: mediaId ? `${source}:${mediaId}` : `${source}:${title}|${artist}`,
    source,
    kind,
    mediaId,
    title,
    artist,
    cover: restoreUrl(parsed.c),
    link,
    duration,
    at: Date.now(),
  };
}

/**
 * 点播历史：写入点收在 `Socket.send` 的观察钩子上（覆盖面板、收藏、
 * 电台、选集与 `@` 链接拦截）。存储不可用或写入抛错一律静默，绝不影响点播报文。
 *
 * 写盘是旁路：内存里的列表才是读的真相，落盘按「一秒内至多一次合并写」节流
 * （一次千首批量点播不会再重写一千遍整份存档），页面隐藏 / 卸载时立即补写一次。
 */
export class RequestHistory {
  /** 内存副本：`load` 的唯一来源；`null` 表示还未从存储种子化。 */
  private static entries: RequestHistoryEntry[] | null = null;
  /** 上次与存储对齐时的原始串，用来发现外部改动（另一个标签页 / 存档被清）。 */
  private static snapshot: string | null = null;
  /** 有尚未落盘的改动。 */
  private static dirty = false;
  private static timer: ReturnType<typeof setTimeout> | null = null;
  /** pagehide / beforeunload 只登记一次。 */
  private static unloadHooked = false;

  /** 读取本地历史（最新在前）；损坏 / 版本不符 / 非数组一律按空历史。 */
  public static load(): RequestHistoryEntry[] {
    return [...this.current()];
  }

  /** 记录一条报文：同一媒体移到最前，超过上限丢弃最旧的。写入失败静默。 */
  public static recordPayload(text: string): void {
    try {
      const entry = parsePayload(text);
      if (!entry) return;
      this.entries = [
        entry,
        ...this.current().filter((item) => item.key !== entry.key),
      ].slice(0, MAX_ENTRIES);
      this.dirty = true;
      this.scheduleWrite();
    } catch {
      /* 存储不可用或报文异常：历史只是旁路，不影响点播 */
    }
  }

  /** 立即把待写内容落盘（页面隐藏 / 卸载、批量空闲时调用）。失败保留待写标记。 */
  public static flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) return;
    const payload = JSON.stringify({
      version: STORAGE_VERSION,
      entries: this.current(),
    });
    try {
      localStorage.setItem(REQUEST_HISTORY_KEY, payload);
      this.snapshot = payload;
      this.dirty = false;
    } catch {
      /* 存储不可用：保留内容在内存里，下次再试 */
    }
  }

  /** 「最近点播」只列网易云单曲（能经 `NetEasePlatform.MOD` 重新解析音源）。 */
  public static recentMusic(): RequestHistoryEntry[] {
    return this.current().filter(
      (entry) =>
        entry.source === "netease" && entry.kind === "music" && !!entry.mediaId,
    );
  }

  /** 内存副本（必要时先按存储种子化 / 跟随外部改动）。 */
  private static current(): RequestHistoryEntry[] {
    if (this.entries === null) return this.reseed(this.readRaw());
    if (this.dirty) return this.entries;
    // 没有待写改动时跟随存储：另一个标签页写过、存档被清掉都立刻可见。
    const raw = this.readRaw();
    if (raw !== this.snapshot) return this.reseed(raw);
    return this.entries;
  }

  private static reseed(raw: string | null): RequestHistoryEntry[] {
    this.entries = this.parseSaved(raw);
    this.snapshot = raw;
    return this.entries;
  }

  private static readRaw(): string | null {
    try {
      return localStorage.getItem(REQUEST_HISTORY_KEY);
    } catch {
      return null;
    }
  }

  private static parseSaved(raw: string | null): RequestHistoryEntry[] {
    if (!raw) return [];
    try {
      const saved = JSON.parse(raw) as { version?: unknown; entries?: unknown };
      if (saved.version !== STORAGE_VERSION) return [];
      if (!Array.isArray(saved.entries)) return [];
      return saved.entries.filter(isEntry);
    } catch {
      return [];
    }
  }

  /** 节流：一秒窗口内多条报文只排一次合并写（不因新报文顺延，避免长批量一直不落盘）。 */
  private static scheduleWrite(): void {
    this.hookUnload();
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, WRITE_INTERVAL_MS);
  }

  /** 页面隐藏 / 卸载时补写：批量还在跑就关页面也不丢最近一秒的记录。 */
  private static hookUnload(): void {
    if (this.unloadHooked) return;
    this.unloadHooked = true;
    if (typeof window === "undefined" || !window.addEventListener) return;
    window.addEventListener("pagehide", this.onUnload);
    window.addEventListener("beforeunload", this.onUnload);
  }

  private static readonly onUnload = (): void => {
    RequestHistory.flush();
  };

  /** 仅供测试：丢弃内存副本与待写定时器，让下一次读取重新从存储种子化。 */
  public static resetForTests(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.entries = null;
    this.snapshot = null;
    this.dirty = false;
  }

  /** 历史条目还原成首屏曲目行：`neteaseMusic.id`、秒级时长、https 封面。 */
  public static toPlatformData(entry: RequestHistoryEntry): PlatformData {
    const platformData: PlatformData = {
      title: entry.title,
      coverImg: entry.cover,
      author: entry.artist,
      websiteUrl: entry.link,
    };
    if (typeof entry.duration === "number")
      platformData.duration = entry.duration;
    if (entry.source === "netease" && entry.mediaId)
      platformData.neteaseMusic = { id: Number(entry.mediaId), fee: 0 };
    return platformData;
  }
}
