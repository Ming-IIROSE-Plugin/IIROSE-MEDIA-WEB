import type { MediaSnapshot } from "../media-progress/model";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import type { PlaybackMode } from "./PlaybackMode";
import type { CutWatcher } from "./CutWatcher";
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
  ShuffleWeight,
} from "./ShuffleSelection";
import { SHUFFLE_REASONS } from "./shuffleContract";
import type { ShuffleBridge, ShuffleDeps } from "./shuffleContract";
import { ShuffleFavorites } from "./shuffleFavorites";
import {
  createLedger,
  finite,
  MAX_FAILURES,
  PREFETCH_SECONDS,
  SEND_SECONDS,
  sendTarget,
  thresholdOf,
  verifyTarget,
  type SendDeps,
  type ShuffleLedger,
} from "./shuffleSending";

export { SHUFFLE_REASONS } from "./shuffleContract";
export type {
  ShuffleBridge,
  ShuffleDeps,
  ShufflePrepareOptions,
  ShuffleTarget,
} from "./shuffleContract";

/**
 * 收藏随机：按选择面板确认的随机平台抽收藏（无记录按 defaultPage），
 * 与主插件面板焦点无关；剩余 20 秒预取、5 秒发送。
 * 只读快照，不接管播放器；失败换曲，连续失败达上限即熄灭并提示。
 *
 * 协作方：`ShuffleFavorites` 管候选与可用性，`shuffleSending` 管发送与回读确认，
 * 本类只保留状态机（本轮记录、预取票号、平台切换）与快照接线。
 */
export class ShuffleController {
  private unsubscribe?: () => void;
  private unsubscribeFavorites?: () => void;
  private platform: ShufflePlatform | null = null;
  private favorites: ShuffleFavorites;
  /** 发送侧共享状态：已备好的下一首、在途确认、失败计数与起播闸门。 */
  private ledger: ShuffleLedger = createLedger();
  private sendDeps: SendDeps;
  /** invalidate 或换平台递增：作废在途的预取结果。 */
  private generation = 0;
  private preparing: Promise<void> | null = null;
  private round = createShuffleRound();
  /** 最近一次预取选中的歌曲身份：重开一轮时仍排除，避免连续重复同一首。 */
  private lastKey: string | null = null;
  private lastOwn = false;

  constructor(
    private mode: PlaybackMode,
    private bridge: ShuffleBridge,
    private deps: ShuffleDeps,
    private cut?: CutWatcher,
  ) {
    this.favorites = new ShuffleFavorites(
      (platform) => this.deps.query(platform),
      (enabled, reason) =>
        this.mode.setAvailability("shuffle", { enabled, reason }),
    );
    this.sendDeps = {
      now: () => this.deps.now(),
      stop: (reason) => this.mode.stop(reason),
      ensurePrepared: (snapshot) => this.ensurePrepared(snapshot),
    };
  }

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
    this.favorites.clear();
    this.favorites.publish();
  }

  /** 选择范围变了（面板确认）：丢掉缓存的候选、预取结果与本轮记录。 */
  invalidate(): void {
    this.generation += 1;
    this.favorites.clear();
    this.preparing = null;
    this.ledger.prepared = undefined;
    this.round = createShuffleRound();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.unsubscribeFavorites?.();
    this.unsubscribeFavorites = undefined;
    this.ledger.prepared = undefined;
    this.ledger.pending = undefined;
  }

  private onSnapshot(snapshot: MediaSnapshot): void {
    this.cut?.tick();
    if (snapshot.ownMedia) this.lastOwn = true;
    if (!snapshot.ownMedia && snapshot.playing) this.lastOwn = false;
    this.trackPlatform();
    this.favorites.publish();
    const state = this.mode.state;
    if (state.mode !== "shuffle") {
      this.ledger.pending = undefined;
      this.ledger.prepared = undefined;
      this.ledger.armed = true;
      this.ledger.idleStarted = false;
      return;
    }
    if (this.ledger.pending) {
      verifyTarget(this.ledger, this.sendDeps, snapshot);
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
        (selfCut || !this.ledger.idleStarted)
      ) {
        this.ledger.idleStarted = true;
        void sendTarget(this.ledger, this.sendDeps, snapshot);
      }
      return;
    }
    if (!finite(snapshot.current) || !finite(duration) || duration <= 0) return;

    const remaining = duration - snapshot.current;
    const threshold = thresholdOf(duration);
    if (!this.ledger.armed && remaining > threshold * 2)
      this.ledger.armed = true;
    if (!this.ledger.armed) return;
    if (this.platform === null) return;

    if (remaining <= PREFETCH_SECONDS && snapshot.current > threshold)
      void this.ensurePrepared(snapshot);
    if (remaining <= SEND_SECONDS)
      void sendTarget(this.ledger, this.sendDeps, snapshot);
  }

  private trackPlatform(): void {
    const settings = PluginSettings.getPluginSetting();
    const next = resolveShufflePlatform(settings.defaultPage);
    if (next === this.platform) return;
    this.platform = next;
    // 换平台（面板确认了另一平台）同样作废在途的预取与本轮记录。
    this.generation += 1;
    this.preparing = null;
    this.ledger.prepared = undefined;
    this.round = createShuffleRound();
    this.ledger.failures = 0;
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
    if (this.ledger.prepared) return Promise.resolve();
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
      const list = await this.favorites.load(platform);
      if (!list || stale() || platform !== this.platform) return;
      // 随机平台没有收藏就熄灭，不空转：全部平台都空才是「收藏为空」，
      // 否则只是所选平台的范围为空。
      if (list.length === 0) {
        const others = await Promise.all(
          SHUFFLE_PLATFORMS.filter((p) => p !== platform).map((p) =>
            this.favorites.load(p),
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
          this.ledger.prepared = {
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
      this.ledger.failures = MAX_FAILURES;
      this.mode.stop(SHUFFLE_REASONS.gaveUp);
    } catch {
      /* 候选读取失败按「没有可用候选」处理，下一帧再试 */
    }
  }
}
