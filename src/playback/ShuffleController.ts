import type { MediaSnapshot } from "../media-progress/model";
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import type { PlaybackMode } from "./PlaybackMode";
import { platformOf, readPanelFocus } from "./PanelFocus";
import type { FocusPlatform } from "./PanelFocus";
import type { CutWatcher } from "./CutWatcher";
import { endWindow, finiteNumber } from "./endWindow";
import {
  createShuffleRound,
  isSingle,
  pickShuffleEntry,
  resolveShuffleSelection,
} from "./ShuffleSelection";
import type {
  ShuffleEntry,
  ShufflePlatform,
  ShuffleSelection,
  ShuffleWeight,
} from "./ShuffleSelection";

/** 抽中的一个可播目标：标题用于回读校验，play 真正发起点播。 */
export interface ShuffleTarget {
  /** 歌曲身份（见 ShuffleSelection.songKey），用于按歌去重。 */
  key: string;
  title: string;
  play: () => void;
}

export interface ShufflePrepareOptions {
  /** 部分勾选的曲目原始 id；null = 整条。 */
  tracks: string[] | null;
  /** 本轮已播的歌曲身份。 */
  exclude: ReadonlySet<string>;
  currentTitle: string;
}

export interface ShuffleDeps {
  query(platform: ShufflePlatform): Promise<FavoriteRecord[]>;
  /** null = 解析失败（计入失败）；"exhausted" = 该条本轮已无可播曲目（不计失败）。 */
  prepare(
    record: FavoriteRecord,
    options: ShufflePrepareOptions,
  ): Promise<ShuffleTarget | "exhausted" | null>;
  /** 本机保存的随机选择；null = 全部收藏、按条目。 */
  loadSelection(platform: ShufflePlatform): ShuffleSelection | null;
  now(): number;
}

export interface ShuffleBridge {
  subscribe(listener: (snapshot: MediaSnapshot) => void): () => void;
}

export const SHUFFLE_REASONS = {
  noFavorites: "当前页面没有收藏",
  empty: "收藏为空，先去收藏一些内容",
  gaveUp: "连续 5 首无法播放，已停止随机",
  emptySelection: "随机范围为空，重新选择",
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
  private querying: Promise<FavoriteRecord[] | null> | null = null;
  /** invalidate 递增：作废在途查询的结果。 */
  private generation = 0;
  private prepared?: Prepared;
  private preparing: Promise<void> | null = null;
  private pending?: Pending;
  private failures = 0;
  private round = createShuffleRound();
  /** 最近一次预取选中的歌曲身份：重开一轮时仍排除，避免连续重复同一首。 */
  private lastKey: string | null = null;
  private armed = true;
  private sending = false;
  private idleStarted = false;
  private lastOwn = false;

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

  /** 选择范围变了（面板确认）：丢掉缓存的候选、预取结果与本轮记录。 */
  invalidate(): void {
    this.generation += 1;
    this.querying = null;
    this.queryingFor = null;
    this.preparing = null;
    this.candidates = null;
    this.loadedFor = null;
    this.prepared = undefined;
    this.round = createShuffleRound();
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
    const next = platformOf(readPanelFocus(), settings.defaultPage);
    if (next === this.platform) return;
    this.platform = next;
    // 换平台同样作废在途的查询与预取。
    this.generation += 1;
    this.candidates = null;
    this.loadedFor = null;
    this.prepared = undefined;
    this.round = createShuffleRound();
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

  private loadCandidates(): Promise<FavoriteRecord[] | null> {
    const platform = this.platform;
    if (this.candidates !== null && this.loadedFor === platform)
      return Promise.resolve(this.candidates);
    if (platform === null) return Promise.resolve(null);
    // 同平台的并发调用复用在途查询：预取不能因可用性刷新先发起了查询而空等一帧。
    if (this.querying && this.queryingFor === platform) return this.querying;
    const generation = this.generation;
    this.queryingFor = platform;
    const querying = (async () => {
      let list: FavoriteRecord[];
      try {
        list = await this.deps.query(platform);
      } catch {
        list = [];
      }
      // 期间换了平台或范围被刷新：结果作废，下一次调用重新查。
      if (this.platform !== platform || this.generation !== generation)
        return null;
      this.candidates = list;
      this.loadedFor = platform;
      return list;
    })();
    this.querying = querying;
    void querying.finally(() => {
      if (this.querying !== querying) return;
      this.querying = null;
      this.queryingFor = null;
    });
    return querying;
  }

  /**
   * 选择范围内按权重抽一条；entry 为 null 表示暂无可抽（如范围里只剩当前这一首），
   * reset 表示这次重开了一轮。
   */
  private pick(
    snapshot: MediaSnapshot,
    weight: ShuffleWeight,
    entries: ShuffleEntry[],
  ): { entry: ShuffleEntry | null; reset: boolean } {
    // 当前正在播的单曲不连续重复；歌单内的曲目由 prepare 按标题/身份排除。
    const skip = (entry: ShuffleEntry) =>
      isSingle(entry.record) && entry.record.title === snapshot.title;
    const picked = pickShuffleEntry(entries, weight, this.round, skip);
    if (picked) return { entry: picked, reset: false };
    // 一轮抽完：重开一轮，但刚播的那首（含歌单里的曲目）仍然排除在外。
    this.round = createShuffleRound();
    if (this.lastKey) this.round.played.add(this.lastKey);
    return {
      entry: pickShuffleEntry(entries, weight, this.round, skip),
      reset: true,
    };
  }

  private ensurePrepared(snapshot: MediaSnapshot): Promise<void> {
    if (this.prepared) return Promise.resolve();
    // 同一时刻只跑一次预取；并发调用复用同一个 Promise。
    if (this.preparing) return this.preparing;
    const preparing = this.doPrepare(snapshot).finally(() => {
      // invalidate 可能已换上新的预取：只清自己。
      if (this.preparing === preparing) this.preparing = null;
    });
    this.preparing = preparing;
    return preparing;
  }

  private async doPrepare(snapshot: MediaSnapshot): Promise<void> {
    const generation = this.generation;
    // 期间 invalidate 或换平台：本次预取作废，不再写入新状态。
    const stale = () => this.generation !== generation;
    try {
      const list = await this.loadCandidates();
      const platform = this.platform;
      if (!list || stale() || platform === null) return;
      // 点亮期间收藏被删空：没有候选就熄灭，不空转。
      if (list.length === 0) {
        this.mode.stop(SHUFFLE_REASONS.empty);
        return;
      }
      // 一次预取只读一次选择，循环中途保存的新选择留给下一次预取。
      const { weight, entries } = resolveShuffleSelection(
        this.deps.loadSelection(platform),
        list,
      );
      if (entries.length === 0) {
        this.mode.stop(SHUFFLE_REASONS.emptySelection);
        return;
      }
      // 至多失败 5 次：专辑/歌单解析失败时换下一个；本轮耗尽的条目不计失败。
      // 重开一轮后若只遇到「耗尽」又要再重开，说明范围内已无可播曲目。
      let attempts = 0;
      let reopened = false;
      let onlyExhausted = true;
      while (attempts < MAX_FAILURES) {
        const { entry, reset } = this.pick(snapshot, weight, entries);
        if (reset) {
          if (reopened && onlyExhausted) {
            this.mode.stop(SHUFFLE_REASONS.emptySelection);
            return;
          }
          reopened = true;
          onlyExhausted = true;
        }
        if (!entry) return;
        const { record } = entry;
        const round = this.round;
        const target = await this.deps.prepare(record, {
          tracks: entry.tracks,
          exclude: round.played,
          currentTitle: snapshot.title,
        });
        if (stale()) return;
        if (target === "exhausted") {
          round.exhausted.add(record.id);
          continue;
        }
        if (target) {
          round.played.add(target.key);
          round.fromEntry.set(
            record.id,
            (round.fromEntry.get(record.id) ?? 0) + 1,
          );
          this.lastKey = target.key;
          this.prepared = {
            key: target.key,
            title: target.title,
            play: target.play,
          };
          return;
        }
        // 解析失败：本轮先不再抽这一条。
        attempts += 1;
        onlyExhausted = false;
        round.exhausted.add(record.id);
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
