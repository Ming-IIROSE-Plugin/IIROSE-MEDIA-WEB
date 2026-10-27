import type { MediaSnapshot } from "../media-progress/model";
import type { FavoriteRecord } from "../storage/FavoritesStorageService";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import type { PlaybackMode } from "./PlaybackMode";
import type { CutWatcher } from "./CutWatcher";
import { endWindow, finiteNumber } from "./endWindow";
import {
  createShuffleRound,
  isSingle,
  pickShuffleEntry,
  resolveShufflePlatform,
  resolveShuffleSelection,
  SHUFFLE_PLATFORMS,
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
  /** 收藏增删（含云端落地）时通知；返回取消订阅。 */
  onFavoritesChange?(listener: () => void): () => void;
  now(): number;
}

export interface ShuffleBridge {
  subscribe(listener: (snapshot: MediaSnapshot) => void): () => void;
}

export const SHUFFLE_REASONS = {
  empty: "收藏为空，先去收藏一些内容",
  gaveUp: "连续 5 首无法播放，已停止随机",
  emptySelection: "随机范围为空，重新选择",
} as const;

const PREFETCH_SECONDS = 20;
const SEND_SECONDS = 5;
/** 上一首停下后等新曲目回读的时长（与循环重播一致，留出宿站切歌与加载时间）。 */
const VERIFY_MS = 10_000;
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
 * 收藏随机：按选择面板确认的随机平台抽收藏（无记录按 defaultPage），
 * 与主插件面板焦点无关；剩余 20 秒预取、5 秒发送。
 * 只读快照，不接管播放器；失败换曲，连续失败达上限即熄灭并提示。
 */
export class ShuffleController {
  private unsubscribe?: () => void;
  private unsubscribeFavorites?: () => void;
  /** 收藏变更或 invalidate 递增：作废在途的收藏查询结果。 */
  private listGeneration = 0;
  private platform: ShufflePlatform | null = null;
  /** 各平台已读出的收藏：可用性看全部平台，抽取只用随机平台。 */
  private lists = new Map<ShufflePlatform, FavoriteRecord[]>();
  private querying = new Map<
    ShufflePlatform,
    Promise<FavoriteRecord[] | null>
  >();
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
    this.unsubscribeFavorites ??= this.deps.onFavoritesChange?.(() =>
      this.onFavoritesChange(),
    );
  }

  /** 收藏增删：只丢掉缓存的收藏列表并刷新可用性，本轮记录与预取保留。 */
  private onFavoritesChange(): void {
    this.listGeneration += 1;
    this.lists.clear();
    this.querying.clear();
    this.publishAvailability();
  }

  /** 选择范围变了（面板确认）：丢掉缓存的候选、预取结果与本轮记录。 */
  invalidate(): void {
    this.generation += 1;
    this.listGeneration += 1;
    this.querying.clear();
    this.preparing = null;
    this.lists.clear();
    this.prepared = undefined;
    this.round = createShuffleRound();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.unsubscribeFavorites?.();
    this.unsubscribeFavorites = undefined;
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
    const next = resolveShufflePlatform(settings.defaultPage);
    if (next === this.platform) return;
    this.platform = next;
    // 换平台（面板确认了另一平台）同样作废在途的预取与本轮记录。
    this.generation += 1;
    this.preparing = null;
    this.prepared = undefined;
    this.round = createShuffleRound();
    this.failures = 0;
  }

  /** 连接就绪且任一平台有收藏即可用；随机平台本身是否有收藏留给抽取时判定。 */
  private publishAvailability(): void {
    const missing = SHUFFLE_PLATFORMS.filter((p) => !this.lists.has(p));
    if (missing.length > 0) {
      // 收藏还没读全：先取一次，读到后再刷新可用性（查询中不重复触发）。
      for (const platform of missing)
        if (!this.querying.has(platform))
          void this.loadList(platform).then((list) => {
            if (list) this.publishAvailability();
          });
      return;
    }
    const any = SHUFFLE_PLATFORMS.some(
      (platform) => (this.lists.get(platform)?.length ?? 0) > 0,
    );
    if (!any) {
      this.setAvailability(false, SHUFFLE_REASONS.empty);
      return;
    }
    this.setAvailability(true, "");
  }

  private setAvailability(enabled: boolean, reason: string): void {
    this.mode.setAvailability("shuffle", { enabled, reason });
  }

  private loadList(
    platform: ShufflePlatform,
  ): Promise<FavoriteRecord[] | null> {
    const cached = this.lists.get(platform);
    if (cached) return Promise.resolve(cached);
    // 同平台的并发调用复用在途查询：预取不能因可用性刷新先发起了查询而空等一帧。
    const inflight = this.querying.get(platform);
    if (inflight) return inflight;
    const generation = this.listGeneration;
    const querying = (async () => {
      let list: FavoriteRecord[];
      try {
        list = await this.deps.query(platform);
      } catch {
        list = [];
      }
      // 期间范围被刷新或收藏有变：结果作废，下一次调用重新查。
      if (this.listGeneration !== generation) return null;
      this.lists.set(platform, list);
      return list;
    })();
    this.querying.set(platform, querying);
    void querying.finally(() => {
      if (this.querying.get(platform) === querying)
        this.querying.delete(platform);
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
      const platform = this.platform;
      if (platform === null) return;
      const list = await this.loadList(platform);
      if (!list || stale() || platform !== this.platform) return;
      // 随机平台没有收藏就熄灭，不空转：全部平台都空才是「收藏为空」，
      // 否则只是所选平台的范围为空。
      if (list.length === 0) {
        const others = await Promise.all(
          SHUFFLE_PLATFORMS.filter((p) => p !== platform).map((p) =>
            this.loadList(p),
          ),
        );
        if (stale()) return;
        const anyOther = others.some((other) => (other?.length ?? 0) > 0);
        this.mode.stop(
          anyOther ? SHUFFLE_REASONS.emptySelection : SHUFFLE_REASONS.empty,
        );
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
    // 剩余 5 秒就发出：上一首还在播时宿站不会切歌，这段时间不计入回读等待，
    // 否则旧歌没放完就判失败并补发，结尾会连发两首。
    if (snapshot.playing && snapshot.title === pending.previousTitle) {
      pending.at = this.deps.now();
      return;
    }
    if (this.deps.now() - pending.at < VERIFY_MS) return;
    this.pending = undefined;
    this.failures += 1;
    if (this.failures >= MAX_FAILURES) {
      this.mode.stop(SHUFFLE_REASONS.gaveUp);
      return;
    }
    // 换下一首：仍在播（宿站已切到别的曲目）就立刻补发；已经停下则交给空闲起播
    // 在下一帧补发（允许它再起播一次），直到失败上限。
    this.idleStarted = false;
    if (snapshot.playing && finiteNumber(snapshot.duration))
      void this.send(snapshot);
  }
}
