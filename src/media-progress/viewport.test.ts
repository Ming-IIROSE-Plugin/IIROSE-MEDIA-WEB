import { afterEach, describe, expect, it, vi } from "vitest";
import { viewportMetrics } from "./viewport";

const element = (visualWidth: number, offsetWidth: number) => {
  const el = document.createElement("div");
  el.getBoundingClientRect = () => ({ width: visualWidth }) as DOMRect;
  Object.defineProperty(el, "offsetWidth", { value: offsetWidth });
  return el;
};

const computedScale = (scale: string) =>
  vi
    .spyOn(window, "getComputedStyle")
    .mockReturnValue({ scale } as CSSStyleDeclaration);

afterEach(() => vi.restoreAllMocks());

describe("viewportMetrics", () => {
  it("实测比例就是宿站缩放", () => {
    computedScale("none");
    expect(viewportMetrics(element(1150, 1000)).scale).toBeCloseTo(1.15);
  });

  it("元素自身的 scale（最小化收缩）不算进宿站缩放，否则视口会被算大", () => {
    computedScale("0.2");
    const metrics = viewportMetrics(element(230, 1000));
    expect(metrics.scale).toBeCloseTo(1.15);
    expect(metrics.width).toBeCloseTo(window.innerWidth / 1.15);
  });

  it("量不出来（元素宽 0）按 1", () => {
    computedScale("none");
    expect(viewportMetrics(element(0, 0)).scale).toBe(1);
  });
});
