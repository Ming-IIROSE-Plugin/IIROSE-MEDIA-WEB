import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BATCH_LEAVE_MS,
  BATCH_LINGER_MS,
  getBatches,
  resetBatches,
  startBatch,
  stopBatch,
} from "./BatchProgress";

describe("批量点播进度", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetBatches();
  });
  afterEach(() => vi.useRealTimers());

  it("准备 → 逐首上报 → 完成后停留再淡出移除", () => {
    const batch = startBatch("千首歌单", 3);
    expect(getBatches()[0]).toMatchObject({ status: "preparing", done: 0 });
    batch.setTotal(2);
    batch.step();
    expect(getBatches()[0]).toMatchObject({
      status: "running",
      done: 1,
      total: 2,
    });
    batch.step();
    batch.finish();
    expect(getBatches()[0].status).toBe("done");
    vi.advanceTimersByTime(BATCH_LINGER_MS);
    expect(getBatches()[0].leaving).toBe(true);
    vi.advanceTimersByTime(BATCH_LEAVE_MS);
    expect(getBatches()).toHaveLength(0);
  });

  it("停止：循环看到标记；之后的上报不会把状态改回进行中", () => {
    const batch = startBatch("专辑", 10);
    batch.step();
    stopBatch(batch.id);
    expect(batch.cancelled).toBe(true);
    expect(getBatches()[0].status).toBe("stopped");
    batch.step();
    expect(getBatches()[0].status).toBe("stopped");
    batch.finish();
    expect(getBatches()[0].status).toBe("stopped");
  });

  it("多次批量各自一张卡", () => {
    startBatch("A", 1);
    startBatch("B", 2);
    expect(getBatches().map((run) => run.title)).toEqual(["A", "B"]);
  });
});
