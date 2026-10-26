import type { MediaSnapshot } from "../media-progress/model";
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import type { PlaybackMode } from "./PlaybackMode";
import { platformOf, readPanelFocus } from "./PanelFocus";
import type { FocusPlatform } from "./PanelFocus";
import type { CutWatcher } from "./CutWatcher";
import { endWindow, finiteNumber } from "./endWindow";

/** 抽中的一个可播目标：标题用于回读校验，play 真正发起点播。 */
export interface ShuffleTarget {
  title: string;
  play: () => void;
}

export interface ShuffleDeps {
  query(
    platform: "netease" | "bilibili",
    includeCollections: boolean,
  ): Promise<FavoriteRecord[]>;
  prepare(record: FavoriteRecord): Promise<ShuffleTarget | null>;
  now(): number;
}

export interface ShuffleBridge {
  subscribe(listener: (snapshot: MediaSnapshot) => void): () => void;
}

export const SHUFFLE_REASONS = {
  noFavorites: "当前页面没有收藏",
  empty: "收藏为空，先去收藏一些内容",
  gaveUp: "连续 5 首无法播放，已停止随机",
} as const;

const PREFETCH_SECONDS = 20;
const SEND_SECONDS = 5;
const VERIFY_MS = 5000;
const MAX_FAILURES = 5;
const THRESHOLD_RATIO = 0.25;
const MIN_THRESHOLD = 1;

function thresholdOf(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return MIN_THRESHOLD;
  return Math.min(
    SEND_SECONDS,
    Math.max(MIN_THRESHOLD, duration * THRESHOLD_RATIO),
  );
}

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

interface Pending {
  title: string;
  previousTitle: string;
  at: number;
}

interface Prepared {
  key: string;
  title: string;
  play: () => void;
}

/**
 * 收藏随机：按面板焦点平台抽收藏，剩余 20 秒预取、5 秒发送。
 * 只读快照，不接管播放器；失败换曲，连续失败达上限即熄灭并提示。
 */
export class ShuffleController {
  private unsubscribe?: () => void;
  private platform: FocusPlatform = null;
  private candidates: FavoriteRecord[] | null = null;
  private loadedFor: FocusPlatform = null;
  private queryingFor: FocusPlatform = null;
  private prepared?: Prepared;
  private preparing: Promise<void> | null = null;
  private pending?: Pending;
  private failures = 0;
  private played = new Set<string>();
  private armed = true;
  private sending = false;
  private idleStarted = false;
  private lastOwn = false;
  private includeCollections: boolean | null = null;

  constructor(
    private mode: PlaybackMode,
    private bridge: ShuffleBridge,
    private deps: ShuffleDeps,
    private cut?: CutWatcher,
  ) {}

  attach(): void {
    this.unsubscribe ??= this.bridge.subscribe((snapshot) =>
      this.onSnapshot(snapshot),
    );
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.prepared = undefined;
    this.pending = undefined;
  }

  private onSnapshot(snapshot: MediaSnapshot): void {
    this.cut?.tick();
    if (snapshot.ownMedia) this.lastOwn = true;
    if (!snapshot.ownMedia && snapshot.playing) this.lastOwn = false;
    this.trackPlatform();
    this.publishAvailability();
    const state = this.mode.state;
    if (state.mode !== "shuffle") {
      this.pending = undefined;
      this.prepared = undefined;
      this.armed = true;
      this.idleStarted = false;
      return;
    }
    if (this.pending) {
      this.verify(snapshot);
      return;
    }
    if (state.standby) return;
    const duration = snapshot.duration;
    if (!snapshot.playing) {
      const noMedia = !finite(duration) || duration <= 0;
      const ended =
        finite(duration) &&
        finite(snapshot.current) &&
        snapshot.current >= duration - 1;
      // 自己喊 cut：本人点播才接管，接着放下一首。
      const selfCut =
        !!this.cut?.recent() && (snapshot.ownMedia || this.lastOwn);
      if (selfCut) this.cut?.consume();
      // 完全没媒体、已播完或自己 cut 时可以立即起播；一次只自动起播一次，避免空转。
      if (
        (noMedia || ended || selfCut) &&
        this.platform !== null &&
        (selfCut || !this.idleStarted)
      ) {
        this.idleStarted = true;
        void this.send(snapshot);
      }
      return;
    }
    if (!finite(snapshot.current) || !finite(duration) || duration <= 0) return;

    const remaining = duration - snapshot.current;
    const threshold = thresholdOf(duration);
    if (!this.armed && remaining > threshold * 2) this.armed = true;
    if (!this.armed) return;
    if (this.platform === null) return;

    if (remaining <= PREFETCH_SECONDS && snapshot.current > threshold)
      void this.ensurePrepared(snapshot);
    if (remaining <= SEND_SECONDS) void this.send(snapshot);
  }

  private trackPlatform(): void {
    const settings = PluginSettings.getPluginSetting();
    if (this.includeCollections !== settings.shuffleIncludeCollections) {
      this.includeCollections = settings.shuffleIncludeCollections;
      this.candidates = null;
      this.loadedFor = null;
      this.prepared = undefined;
    }
    const next = platformOf(readPanelFocus(), settings.defaultPage);
    if (next === this.platform) return;
    this.platform = next;
    this.candidates = null;
    this.loadedFor = null;
    this.prepared = undefined;
    this.played = new Set();
    this.failures = 0;
  }

  private publishAvailability(): void {
    if (this.platform === null) {
      this.setAvailability(false, SHUFFLE_REASONS.noFavorites);
      return;
    }
    if (this.candidates === null) {
      // 候选还没读出来：先取一次，读到后再刷新可用性（查询中不重复触发）。
      if (this.queryingFor === null)
        void this.loadCandidates().then(() => this.publishAvailability());
      return;
    }
    if (this.candidates.length === 0) {
      this.setAvailability(false, SHUFFLE_REASONS.empty);
      return;
    }
    this.setAvailability(true, "");
  }

  private setAvailability(enabled: boolean, reason: string): void {
    this.mode.setAvailability("shuffle", { enabled, reason });
  }

  private async loadCandidates(): Promise<FavoriteRecord[] | null> {
    const platform = this.platform;
    if (this.candidates !== null && this.loadedFor === platform)
      return this.candidates;
    if (platform === null) return null;
    if (this.queryingFor === platform) return null;
    this.queryingFor = platform;
    try {
      const list = await this.deps.query(
        platform,
        PluginSettings.getPluginSetting().shuffleIncludeCollections,
      );
      if (this.platform !== platform) return null;
      this.candidates = list;
      this.loadedFor = platform;
      return list;
    } catch {
      this.candidates = [];
      this.loadedFor = platform;
      return this.candidates;
    } finally {
      this.queryingFor = null;
    }
  }

  private pick(snapshot: MediaSnapshot): FavoriteRecord | null {
    const list = this.candidates;
    if (!list || list.length === 0) return null;
    const usable = (record: FavoriteRecord) =>
      record.title !== snapshot.title && !this.played.has(record.id);
    let pool = list.filter(usable);
    if (pool.length === 0) {
      // 一轮抽完：重置已播集合，但当前曲目仍然排除在外。
      this.played = new Set();
      pool = list.filter((record) => record.title !== snapshot.title);
    }
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private ensurePrepared(snapshot: MediaSnapshot): Promise<void> {
    if (this.prepared) return Promise.resolve();
    // 同一时刻只跑一次预取；并发调用复用同一个 Promise。
    this.preparing ??= this.doPrepare(snapshot).finally(() => {
      this.preparing = null;
    });
    return this.preparing;
  }

  private async doPrepare(snapshot: MediaSnapshot): Promise<void> {
    try {
      const list = await this.loadCandidates();
      if (!list) return;
      // 点亮期间收藏被删空：没有候选就熄灭，不空转。
      if (list.length === 0) {
        this.mode.stop(SHUFFLE_REASONS.empty);
        return;
      }
      // 至多尝试 5 个候选：专辑/歌单解析失败时换下一个。
      for (let attempt = 0; attempt < MAX_FAILURES; attempt++) {
        const record = this.pick(snapshot);
        if (!record) return;
        this.played.add(record.id);
        const target = await this.deps.prepare(record);
        if (target) {
          this.prepared = {
            key: record.id,
            title: target.title,
            play: target.play,
          };
          return;
        }
      }
      this.failures = MAX_FAILURES;
      this.mode.stop(SHUFFLE_REASONS.gaveUp);
    } catch {
      /* 候选读取失败按「没有可用候选」处理，下一帧再试 */
    }
  }

  private async send(snapshot: MediaSnapshot): Promise<void> {
    // 空闲时每帧都会走到这里：一次只允许一个发送在途。
    if (this.sending || this.pending) return;
    this.sending = true;
    try {
      await this.sendingFlow(snapshot);
    } finally {
      this.sending = false;
    }
  }

  private async sendingFlow(snapshot: MediaSnapshot): Promise<void> {
    if (!this.prepared) {
      await this.ensurePrepared(snapshot);
      if (!this.prepared) return;
    }
    const prepared = this.prepared;
    this.prepared = undefined;
    this.armed = false;
    this.pending = {
      title: prepared.title,
      previousTitle: snapshot.title,
      at: this.deps.now(),
    };
    prepared.play();
  }

  private verify(snapshot: MediaSnapshot): void {
    const pending = this.pending;
    if (!pending) return;
    const changed =
      snapshot.title !== pending.previousTitle && snapshot.playing;
    if (changed) {
      this.pending = undefined;
      this.failures = 0;
      this.armed = true;
      this.idleStarted = false;
      return;
    }
    if (this.deps.now() - pending.at < VERIFY_MS) return;
    this.pending = undefined;
    this.failures += 1;
    if (this.failures >= MAX_FAILURES) {
      this.mode.stop(SHUFFLE_REASONS.gaveUp);
      return;
    }
    // 换下一首：当前曲目结束时立刻补发，避免整段空档。
    if (snapshot.playing && finiteNumber(snapshot.duration))
      void this.send(snapshot);
  }
}
