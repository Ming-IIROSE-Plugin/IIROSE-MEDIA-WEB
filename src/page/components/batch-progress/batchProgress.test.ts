import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { BatchProgressStack } from "./BatchProgressStack";
import {
  getBatches,
  resetBatches,
  startBatch,
} from "../../../playback/BatchProgress";

let host: HTMLDivElement;

beforeEach(() => {
  resetBatches();
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  render(null, host);
  host.remove();
});

const buttons = () => Array.from(host.querySelectorAll("button"));

describe("批量点播进度浮窗", () => {
  it("没有批量时不渲染", () => {
    act(() => {
      render(h(BatchProgressStack, {}), host);
    });
    expect(host.querySelector("[data-imw-batch-card]")).toBeNull();
  });

  it("进行中：标题、进度条、计数与「停止」；停止后换成关闭", () => {
    act(() => {
      render(h(BatchProgressStack, {}), host);
    });
    let batch!: ReturnType<typeof startBatch>;
    act(() => {
      batch = startBatch("千首歌单", 130);
      batch.setTotal(130);
      batch.step();
    });
    expect(host.textContent).toContain("正在点播《千首歌单》");
    expect(host.textContent).toContain("1 / 130");
    const bar = host.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBe("1");

    const stop = buttons().find((el) => el.textContent === "停止")!;
    act(() => stop.click());
    expect(batch.cancelled).toBe(true);
    expect(host.textContent).toContain("已停止《千首歌单》");
    expect(
      buttons().some((el) => el.getAttribute("aria-label") === "关闭"),
    ).toBe(true);
  });

  it("完成后点 × 淡出", () => {
    act(() => {
      render(h(BatchProgressStack, {}), host);
    });
    act(() => {
      const batch = startBatch("专辑", 2);
      batch.setTotal(2);
      batch.step();
      batch.step();
      batch.finish();
    });
    expect(host.textContent).toContain("已点播完《专辑》");
    const close = buttons().find(
      (el) => el.getAttribute("aria-label") === "关闭",
    )!;
    act(() => close.click());
    expect(getBatches()[0].leaving).toBe(true);
  });
});
