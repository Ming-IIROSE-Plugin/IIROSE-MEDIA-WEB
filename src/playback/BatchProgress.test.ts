import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BATCH_LEAVE_MS,
  BATCH_LINGER_MS,
  BATCH_STOP_LINGER_MS,
  getBatches,
  isBatchActive,
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
    // 停止后很快收起，不等正常播完的 4 秒
    vi.advanceTimersByTime(BATCH_STOP_LINGER_MS + BATCH_LEAVE_MS);
    expect(getBatches()).toHaveLength(0);
  });

  it("停止即 abort 句柄信号；卡片移除后停止标记仍有效", () => {
    const batch = startBatch("千首歌单", 130);
    expect(batch.signal.aborted).toBe(false);
    stopBatch(batch.id);
    expect(batch.signal.aborted).toBe(true);
    vi.advanceTimersByTime(BATCH_STOP_LINGER_MS + BATCH_LEAVE_MS);
    expect(getBatches()).toHaveLength(0);
    // 准备阶段停掉的批次不能在详情取回后「复活」
    expect(batch.cancelled).toBe(true);
    expect(batch.signal.aborted).toBe(true);
  });

  it("正常结束不 abort 信号", () => {
    const batch = startBatch("专辑", 1);
    batch.step();
    batch.finish();
    vi.advanceTimersByTime(BATCH_LINGER_MS + BATCH_LEAVE_MS);
    expect(getBatches()).toHaveLength(0);
    expect(batch.cancelled).toBe(false);
    expect(batch.signal.aborted).toBe(false);
  });

  it("多次批量各自一张卡", () => {
    startBatch("A", 1);
    startBatch("B", 2);
    expect(getBatches().map((run) => run.title)).toEqual(["A", "B"]);
  });

  it("一首都没发出（取详情失败）：结束时是「失败」，不是「完成」", () => {
    const batch = startBatch("千首歌单", 130);
    batch.finish();
    expect(getBatches()[0].status).toBe("failed");
  });

  it("同名批量进行中可查询（防止整张歌单被连点出第二轮）", () => {
    expect(isBatchActive("专辑")).toBe(false);
    const batch = startBatch("专辑", 3);
    expect(isBatchActive("专辑")).toBe(true);
    expect(isBatchActive("别的")).toBe(false);
    batch.setTotal(3);
    batch.step();
    batch.step();
    batch.step();
    batch.finish();
    expect(isBatchActive("专辑")).toBe(false);
    stopBatch(startBatch("停掉的", 5).id);
    expect(isBatchActive("停掉的")).toBe(false);
  });
});
