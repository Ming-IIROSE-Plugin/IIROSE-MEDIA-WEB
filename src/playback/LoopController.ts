import type { MediaSnapshot } from "../media-progress/model";
import type { MediaPayloadHit, MediaPayloadMemory } from "./MediaPayloadMemory";
import type { PlaybackMode } from "./PlaybackMode";
import { isSeekCommand, rewindCommand } from "../media-progress/model";
import { endWindow, finiteNumber } from "./endWindow";
import type { CutWatcher } from "./CutWatcher";

/** 循环动作与宿站的唯一接口：卡片走播报档位，报文直发。 */
export interface LoopIo {
  sendCard(card: string): void;
  sendPayload(payload: string): void;
  /** 本人点播但无报文缓存时的兜底：只改本端播放，不广播。 */
  localSeek?: (seconds: number) => void;
}

/** 触发判定与动作所需的最小桥接面；真实实现是 HostMediaBridge。 */
export interface LoopBridge {
  subscribe(listener: (snapshot: MediaSnapshot) => void): () => void;
  send(command: string, instance: number, controlMode: "silent"): boolean;
}

/** 原因文案：可用性由 sidebar-controls.md 表决定，失败文案供行提示一次。 */
export const LOOP_REASONS = {
  unavailable: "无媒体管理权限，且该曲目不由插件点播，无法循环",
  seekFailed: "循环失败：无法回到开头",
  replayFailed: "循环失败：无法重新点播当前曲目",
  tooShort: "曲目过短，已停止循环",
} as const;

/** 循环的触发窗口与单曲随机的发送窗口共用同一口径。 */
export const loopThreshold = endWindow;

const SEEK_VERIFY_MS = 2000;
const REPLAY_VERIFY_MS = 5000;
const MANUAL_SEEK_GUARD_MS = 2000;
const SHORT_TRACK_MAX_TRIGGERS = 2;
const SHORT_TRACK_WINDOW_MS = 30_000;
const PLACEHOLDER_TITLE = "未命名媒体";

interface Pending {
  kind: "seek" | "replay";
  at: number;
  title: string;
  instance: number;
  threshold: number;
  duration: number;
}

/** 切换曲目时宿站可能短暂清空标题，占位值不算换曲。 */
function switchingAway(pending: Pending, snapshot: MediaSnapshot): boolean {
  if (snapshot.title === pending.title) return false;
  const title = snapshot.title.trim();
  return title !== "" && title !== PLACEHOLDER_TITLE;
}

/**
 * 单曲循环：有静默权限时快退回开头，否则在结束前预发缓存的播放报文。
 * 只读快照，不接管播放器；失败即熄灭并提示一次（由 PlaybackMode 的令牌通道呈现）。
 */
export class LoopController {
  private unsubscribe?: () => void;
  private armed = true;
  private seekVersion: number | null = null;
  private seekNotBefore = 0;
  private pending?: Pending;
  private recent: number[] = [];
  private recentKey = "";
  // cut 之后宿站可能清空点播者，这里记住「结束前最后一次是否本人点播」。
  private lastOwn = false;

  constructor(
    private mode: PlaybackMode,
    private bridge: LoopBridge,
    private memory: MediaPayloadMemory,
    private io: LoopIo,
    private now: () => number = () => Date.now(),
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
    this.pending = undefined;
    this.recent = [];
  }

  private onSnapshot(snapshot: MediaSnapshot): void {
    this.cut?.tick();
    // 首次订阅不建立抑制窗口：只有「已经在跟踪后又发生定位」才算手动操作。
    if (this.seekVersion !== null && snapshot.seekVersion !== this.seekVersion)
      this.seekNotBefore = this.now() + MANUAL_SEEK_GUARD_MS;
    this.seekVersion = snapshot.seekVersion;
    if (snapshot.ownMedia) this.lastOwn = true;
    if (!snapshot.ownMedia && snapshot.playing) this.lastOwn = false;
    this.publishAvailability(snapshot);

    const state = this.mode.state;
    if (state.mode !== "loop") {
      this.pending = undefined;
      this.armed = true;
      this.recent = [];
      return;
    }
    // 转待命也要继续校验：否则 pending 会跨过校验窗口，恢复后误判失败。
    if (this.pending) {
      this.verify(snapshot, state.standby);
      return;
    }
    if (state.standby) return;
    // 手动拖到结尾时宿站直接置为停止，不会留出「剩余 ≤ 阈值」的一格：结束态也要接管。
    if (!snapshot.playing) {
      if (this.replayAfterSelfCut(snapshot)) return;
      this.replayEnded(snapshot);
      return;
    }
    if (
      !finiteNumber(snapshot.current) ||
      !finiteNumber(snapshot.duration) ||
      snapshot.duration <= 0
    )
      return;

    const threshold = loopThreshold(snapshot.duration);
    const remaining = snapshot.duration - snapshot.current;
    this.resetShortTrack(snapshot);
    // 进度回到开头（快退或重播生效）后重新武装：同一实例可循环多次。
    if (!this.armed && remaining > threshold * 2) this.armed = true;
    if (!this.armed) return;
    if (this.now() < this.seekNotBefore) return;

    const hit = this.memory.hit(snapshot.roomKey, snapshot.title);
    const silentUsable =
      snapshot.controlMode === "silent" && !snapshot.controlReason;
    if (silentUsable) {
      if (remaining > threshold || snapshot.current <= threshold) return;
      if (this.tooShort(snapshot, threshold)) return;
      this.seek(snapshot, threshold, hit);
      return;
    }
    // 与快退同一窗口：2 秒窗口会被 250ms 轮询整体跳过，实测导致重播从未发出。
    if (remaining > threshold) return;
    if (this.tooShort(snapshot, threshold)) return;
    if (hit) {
      this.replay(snapshot, hit, threshold);
      return;
    }
    // 无缓存但仍是本人点播：本地回到开头（房间不跟随）。
    if (snapshot.ownMedia) this.seekLocal(snapshot, threshold);
  }

  // 自己喊 cut 导致的中途结束：只有本次操作是本端发出、且曲目仍是本人点播时才重播。
  private replayAfterSelfCut(snapshot: MediaSnapshot): boolean {
    if (!this.cut?.recent()) return false;
    if (!snapshot.ownMedia && !this.lastOwn) return false;
    const hit = this.memory.last(snapshot.roomKey);
    if (!hit) return false;
    this.cut.consume();
    this.replay(snapshot, hit, loopThreshold(snapshot.duration ?? 0));
    return true;
  }

  // 播放已停止且停在末尾（拖到底/自然结束）时，按缓存的报文重新点播一次。
  private replayEnded(snapshot: MediaSnapshot): void {
    if (this.pending) return;
    if (!finiteNumber(snapshot.current) || !finiteNumber(snapshot.duration))
      return;
    if (snapshot.duration <= 0) return;
    if (snapshot.current < snapshot.duration - 1) return;
    const hit = this.memory.hit(snapshot.roomKey, snapshot.title);
    if (this.tooShort(snapshot, loopThreshold(snapshot.duration))) return;
    if (hit) this.replay(snapshot, hit, loopThreshold(snapshot.duration));
    else if (snapshot.ownMedia)
      this.seekLocal(snapshot, loopThreshold(snapshot.duration));
  }

  private publishAvailability(snapshot: MediaSnapshot): void {
    const usable =
      (snapshot.controlMode === "silent" && !snapshot.controlReason) ||
      !!this.memory.hit(snapshot.roomKey, snapshot.title) ||
      // 缓存丢失（如刷新后）但曲目仍是本人点播：允许用本地 seek 兜底，避免按钮变灰。
      snapshot.ownMedia;
    this.mode.setAvailability("loop", {
      enabled: usable,
      reason: usable ? "" : LOOP_REASONS.unavailable,
    });
  }

  // 短曲预算按房间+曲目隔离：换曲/换房不继承上一首的计数。
  private resetShortTrack(snapshot: MediaSnapshot): void {
    const key = `${snapshot.roomKey ?? ""}\u0000${snapshot.title}`;
    if (key === this.recentKey) return;
    this.recentKey = key;
    this.recent = [];
  }

  private tooShort(snapshot: MediaSnapshot, threshold: number): boolean {
    if (!finiteNumber(snapshot.duration) || snapshot.duration > threshold * 3)
      return false;
    const now = this.now();
    this.recent = this.recent.filter((at) => now - at < SHORT_TRACK_WINDOW_MS);
    if (this.recent.length >= SHORT_TRACK_MAX_TRIGGERS) {
      this.armed = false;
      this.mode.stop(LOOP_REASONS.tooShort);
      return true;
    }
    this.recent.push(now);
    return false;
  }

  private seek(
    snapshot: MediaSnapshot,
    threshold: number,
    hit: MediaPayloadHit | null,
  ): void {
    if (!finiteNumber(snapshot.current) || !finiteNumber(snapshot.duration))
      return;
    const command = rewindCommand(Math.floor(snapshot.current));
    if (!command || !isSeekCommand(command)) return;
    this.armed = false;
    this.pending = {
      kind: "seek",
      at: this.now(),
      title: snapshot.title,
      instance: snapshot.instance,
      threshold,
      duration: snapshot.duration,
    };
    if (!this.bridge.send(command, snapshot.instance, "silent")) {
      this.pending = undefined;
      // 静默通道不可用：优先重播，其次本地 seek，最后才报失败。
      if (hit) this.replay(snapshot, hit, threshold);
      else if (snapshot.ownMedia) this.seekLocal(snapshot, threshold);
      else this.fail(LOOP_REASONS.seekFailed);
    }
  }

  // 本地兜底：不发送任何报文，只把本端进度拉回 0（宿站允许无权限调用）。
  private seekLocal(snapshot: MediaSnapshot, threshold: number): void {
    if (!this.io.localSeek) return;
    this.armed = false;
    this.pending = {
      kind: "seek",
      at: this.now(),
      title: snapshot.title,
      instance: snapshot.instance,
      threshold,
      duration: finiteNumber(snapshot.duration) ? snapshot.duration : 0,
    };
    try {
      this.io.localSeek(0);
    } catch {
      this.fail(LOOP_REASONS.seekFailed);
    }
  }

  private replay(
    snapshot: MediaSnapshot,
    hit: MediaPayloadHit,
    threshold: number,
  ): void {
    this.armed = false;
    this.pending = {
      kind: "replay",
      at: this.now(),
      title: snapshot.title,
      instance: snapshot.instance,
      threshold,
      duration: finiteNumber(snapshot.duration) ? snapshot.duration : 0,
    };
    if (hit.card) this.io.sendCard(hit.card);
    this.io.sendPayload(hit.payload);
  }

  private verify(snapshot: MediaSnapshot, standby: boolean): void {
    const pending = this.pending;
    if (!pending) return;
    const elapsed = this.now() - pending.at;
    // 快退期间实例变化说明有人换了歌；重播本身会让宿站自增实例，故只对快退判定。
    if (
      pending.kind === "seek" &&
      snapshot.instance !== pending.instance &&
      snapshot.title === pending.title
    ) {
      this.fail(LOOP_REASONS.replayFailed);
      return;
    }
    // 触发后曲目被换走：不补发、不抢占。
    if (switchingAway(pending, snapshot)) {
      this.fail(LOOP_REASONS.replayFailed);
      return;
    }
    const started =
      finiteNumber(snapshot.current) &&
      snapshot.playing &&
      snapshot.current < pending.threshold;
    if (pending.kind === "seek" && started) {
      this.pending = undefined;
      this.armed = true;
      return;
    }
    if (pending.kind === "replay" && started) {
      this.pending = undefined;
      this.armed = true;
      return;
    }
    const limit = pending.kind === "seek" ? SEEK_VERIFY_MS : REPLAY_VERIFY_MS;
    if (elapsed < limit) return;
    // 待命导致无法判定：丢掉本次等待，不误报失败。
    if (standby) {
      this.pending = undefined;
      return;
    }
    if (pending.kind === "seek") {
      this.pending = undefined;
      const hit = this.memory.hit(snapshot.roomKey, snapshot.title);
      if (hit) this.replay(snapshot, hit, pending.threshold);
      else if (snapshot.ownMedia) this.seekLocal(snapshot, pending.threshold);
      else this.fail(LOOP_REASONS.seekFailed);
      return;
    }
    const resumed =
      finiteNumber(snapshot.duration) &&
      finiteNumber(snapshot.current) &&
      snapshot.current < snapshot.duration / 2;
    if (resumed) {
      this.pending = undefined;
      this.armed = true;
      return;
    }
    this.fail(LOOP_REASONS.replayFailed);
  }

  private fail(reason: string): void {
    this.pending = undefined;
    this.armed = false;
    this.mode.stop(reason);
  }
}
