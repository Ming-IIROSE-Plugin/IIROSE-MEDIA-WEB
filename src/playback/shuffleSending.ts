// 收藏随机的「发送与确认」：预取窗口、点播发出、回读校验与失败换曲。
// 状态机本体（进程字段）仍在 ShuffleController；这里只操作它持有的一份 ledger。
import type { MediaSnapshot } from "../media-progress/model";
import { finiteNumber } from "./endWindow";
import { SHUFFLE_REASONS, type ShuffleTarget } from "./shuffleContract";

/** 剩余多少秒时开始预取下一首。 */
export const PREFETCH_SECONDS = 20;
/** 剩余多少秒时发出点播。 */
export const SEND_SECONDS = 5;
/** 上一首停下后等新曲目回读的时长（与循环重播一致，留出宿站切歌与加载时间）。 */
// 队列切歌可能延迟到 20 秒左右（循环重播实测同一队列 ~20 秒）：窗口留够，
// 否则会在宿站真正切歌前判失败并补发下一首（复盘 B2）。
export const VERIFY_MS = 20_000;
/** 连续失败上限：达到即熄灭随机并提示。 */
export const MAX_FAILURES = 5;
const THRESHOLD_RATIO = 0.25;
const MIN_THRESHOLD = 1;

export function thresholdOf(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return MIN_THRESHOLD;
  return Math.min(
    SEND_SECONDS,
    Math.max(MIN_THRESHOLD, duration * THRESHOLD_RATIO),
  );
}

export function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

interface Pending {
  title: string;
  previousTitle: string;
  at: number;
}

/**
 * 发送侧状态：已解析的下一首、在途确认、连续失败数、起播闸门。
 * 由控制器持有并在快照处理与发送之间共享。
 */
export interface ShuffleLedger {
  prepared?: ShuffleTarget;
  pending?: Pending;
  failures: number;
  armed: boolean;
  idleStarted: boolean;
  sending: boolean;
}

export const createLedger = (): ShuffleLedger => ({
  prepared: undefined,
  pending: undefined,
  failures: 0,
  armed: true,
  idleStarted: false,
  sending: false,
});

export interface SendDeps {
  now(): number;
  /** 熄灭随机并提示原因。 */
  stop(reason: string): void;
  /** 立即（或在无候选时）准备好下一首；并发调用复用同一次预取。 */
  ensurePrepared(snapshot: MediaSnapshot): Promise<void>;
}

export async function sendTarget(
  ledger: ShuffleLedger,
  deps: SendDeps,
  snapshot: MediaSnapshot,
): Promise<void> {
  // 空闲时每帧都会走到这里：一次只允许一个发送在途。
  if (ledger.sending || ledger.pending) return;
  ledger.sending = true;
  try {
    await sendingFlow(ledger, deps, snapshot);
  } finally {
    ledger.sending = false;
  }
}

async function sendingFlow(
  ledger: ShuffleLedger,
  deps: SendDeps,
  snapshot: MediaSnapshot,
): Promise<void> {
  if (!ledger.prepared) {
    await deps.ensurePrepared(snapshot);
    if (!ledger.prepared) return;
  }
  const prepared = ledger.prepared;
  ledger.prepared = undefined;
  ledger.armed = false;
  ledger.pending = {
    title: prepared.title,
    previousTitle: snapshot.title,
    at: deps.now(),
  };
  prepared.play();
}

export function verifyTarget(
  ledger: ShuffleLedger,
  deps: SendDeps,
  snapshot: MediaSnapshot,
): void {
  const pending = ledger.pending;
  if (!pending) return;
  const changed = snapshot.title !== pending.previousTitle && snapshot.playing;
  if (changed) {
    ledger.pending = undefined;
    ledger.failures = 0;
    ledger.armed = true;
    ledger.idleStarted = false;
    return;
  }
  // 剩余 5 秒就发出：上一首还在播时宿站不会切歌，这段时间不计入回读等待，
  // 否则旧歌没放完就判失败并补发，结尾会连发两首。
  if (snapshot.playing && snapshot.title === pending.previousTitle) {
    pending.at = deps.now();
    return;
  }
  if (deps.now() - pending.at < VERIFY_MS) return;
  ledger.pending = undefined;
  ledger.failures += 1;
  if (ledger.failures >= MAX_FAILURES) {
    deps.stop(SHUFFLE_REASONS.gaveUp);
    return;
  }
  // 换下一首：仍在播（宿站已切到别的曲目）就立刻补发；已经停下则交给空闲起播
  // 在下一帧补发（允许它再起播一次），直到失败上限。
  ledger.idleStarted = false;
  if (snapshot.playing && finiteNumber(snapshot.duration))
    void sendTarget(ledger, deps, snapshot);
}
