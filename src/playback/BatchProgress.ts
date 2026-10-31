// 批量点播进度（整张正序 / 乱序、选集多选）：发送循环逐首上报，浮窗订阅显示，
// 用户可随时「停止」——循环在下一首发送前看到停止标记就结束，已发出的不撤回。
// 浮窗挂在面板之外，关掉点播面板后进度仍在。

export type BatchStatus =
  | "preparing"
  | "running"
  | "done"
  | "stopped"
  /** 结束时一首都没发出（如取曲目详情失败）：不能显示成「已点播完」。 */
  | "failed";

export interface BatchRun {
  id: number;
  title: string;
  total: number;
  /** 已处理（发出或跳过）的条数。 */
  done: number;
  status: BatchStatus;
  /** 结束后淡出中（浮窗据此播放退场动画）。 */
  leaving: boolean;
}

/** 发送循环拿到的句柄。 */
export interface BatchHandle {
  readonly id: number;
  /** 用户点了「停止」：循环应在下一首之前结束。 */
  readonly cancelled: boolean;
  /** 详情取回后才知道实际可发的条数（去掉取不到详情的）。 */
  setTotal(total: number): void;
  /** 处理完一首（发出或跳过）。 */
  step(): void;
  /** 循环结束（正常结束或停止都调用；重复调用无害）。 */
  finish(): void;
}

/** 正常播完后停留多久再淡出。 */
export const BATCH_LINGER_MS = 4_000;
/** 用户点了「停止」：看清「已停止」即可，很快收起（用户要求不要停留太久）。 */
export const BATCH_STOP_LINGER_MS = 1_200;
/** 淡出动画时长。 */
export const BATCH_LEAVE_MS = 200;

let runs: BatchRun[] = [];
const cancelled = new Set<number>();
const timers = new Map<number, ReturnType<typeof setTimeout>[]>();
const listeners = new Set<() => void>();
let seq = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

function update(id: number, patch: Partial<BatchRun>) {
  runs = runs.map((run) => (run.id === id ? { ...run, ...patch } : run));
  emit();
}

function find(id: number): BatchRun | undefined {
  return runs.find((run) => run.id === id);
}

function later(id: number, ms: number, step: () => void) {
  const timer = setTimeout(step, ms);
  timers.set(id, [...(timers.get(id) ?? []), timer]);
}

function remove(id: number) {
  timers.get(id)?.forEach((timer) => clearTimeout(timer));
  timers.delete(id);
  cancelled.delete(id);
  runs = runs.filter((run) => run.id !== id);
  emit();
}

/** 同名批量是否还在进行（准备 / 发送中）：整张播放据此拒绝连点出第二轮。 */
export function isBatchActive(title: string): boolean {
  return runs.some(
    (run) =>
      run.title === title &&
      !run.leaving &&
      (run.status === "preparing" || run.status === "running"),
  );
}

export function getBatches(): BatchRun[] {
  return runs;
}

export function subscribeBatches(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 已点「停止」的不再被循环里的上报改回「进行中」。 */
function liveStatus(id: number): BatchStatus {
  return cancelled.has(id) ? "stopped" : "running";
}

/** 开始一次批量点播；`total` 是预计条数，详情取回后可用 `setTotal` 校正。 */
export function startBatch(title: string, total: number): BatchHandle {
  const id = ++seq;
  runs = [
    ...runs,
    { id, title, total, done: 0, status: "preparing", leaving: false },
  ];
  emit();
  let finished = false;
  return {
    id,
    get cancelled() {
      return cancelled.has(id);
    },
    setTotal(next: number) {
      if (!find(id) || finished) return;
      update(id, { total: next, status: liveStatus(id) });
    },
    step() {
      const run = find(id);
      if (!run || finished) return;
      update(id, {
        done: Math.min(run.done + 1, run.total),
        status: liveStatus(id),
      });
    },
    finish() {
      if (finished) return;
      finished = true;
      if (!find(id)) return;
      // 停止时 stopBatch 已安排收起，这里不再重复
      if (cancelled.has(id)) return;
      const run = find(id);
      update(id, { status: run && run.done === 0 ? "failed" : "done" });
      later(id, BATCH_LINGER_MS, () => dismissBatch(id));
    },
  };
}

/** 用户点「停止」：标记后由循环自行结束（界面立即显示「已停止」）。 */
export function stopBatch(id: number): void {
  const run = find(id);
  if (!run || run.status === "done" || run.status === "stopped") return;
  cancelled.add(id);
  update(id, { status: "stopped" });
  later(id, BATCH_STOP_LINGER_MS, () => dismissBatch(id));
}

/** 关掉一张卡（结束后自动调用，或用户点 ×）：先淡出再移除。 */
export function dismissBatch(id: number): void {
  const run = find(id);
  if (!run || run.leaving) return;
  update(id, { leaving: true });
  later(id, BATCH_LEAVE_MS, () => remove(id));
}

/** 测试用：清空全部状态。 */
export function resetBatches(): void {
  timers.forEach((list) => list.forEach((timer) => clearTimeout(timer)));
  timers.clear();
  cancelled.clear();
  runs = [];
  listeners.clear();
}
