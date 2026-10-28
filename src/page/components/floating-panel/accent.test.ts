import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BRAND,
  contrastRatio,
  parseColor,
  readableAccent,
  textBackdrop,
} from "./accent";

// 主面板浅色强调色两份：fill 只保证白字 ≥4.5:1（贴近品牌色）；
// ink 保证落在最深的实际底色（柔灰底 + 26% fill：顶部光晕 + /10 淡底）上 ≥4.5:1。
const WHITE: [number, number, number] = [255, 255, 255];
const rgb = (c: string) => parseColor(c)!;

const BRANDS = [
  "rgb(221, 28, 4)", // 网易云
  "rgb(209, 79, 118)", // B 站
  "rgb(100, 149, 237)", // 无线电等
  "rgb(150,171,188)", // 插件设置
  "rgb(1, 77, 103)",
  "#ffffff",
];

describe("readableAccent", () => {
  it.each(BRANDS)("%s：fill 上白字 ≥4.5:1", (brand) => {
    const fill = rgb(readableAccent(brand).fill);
    expect(contrastRatio(fill, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(BRANDS)("%s：ink 在柔灰底 + 26% fill 上 ≥4.5:1", (brand) => {
    const { fill, ink } = readableAccent(brand);
    expect(
      contrastRatio(rgb(ink), textBackdrop(rgb(fill))),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("fill 贴近品牌色：网易云各通道偏差 ≤10", () => {
    const fill = rgb(readableAccent("rgb(221, 28, 4)").fill);
    [221, 28, 4].forEach((c, i) =>
      expect(Math.abs(fill[i] - c)).toBeLessThanOrEqual(10),
    );
  });

  it("fill 只压到白字达标即止：ink 不浅于 fill", () => {
    for (const brand of BRANDS) {
      const { fill, ink } = readableAccent(brand);
      expect(rgb(ink)[0]).toBeLessThanOrEqual(rgb(fill)[0]);
    }
  });

  it("已够深的品牌色 fill 原样返回", () => {
    expect(readableAccent("rgb(1, 77, 103)").fill).toBe("rgb(1, 77, 103)");
  });

  it("过浅的品牌色只压深不变色相（各通道同比例缩小）", () => {
    const [r, g, b] = rgb(readableAccent("rgb(100, 149, 237)").fill);
    expect(r).toBeLessThan(100);
    expect(g / b).toBeCloseTo(149 / 237, 1);
    expect(r / b).toBeCloseTo(100 / 237, 1);
  });

  it("无法解析的输入退回默认色并只告警一次", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = readableAccent("not-a-color");
    expect(out).toEqual(readableAccent(DEFAULT_BRAND));
    readableAccent("also-bad");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("parseColor", () => {
  it("解析逗号/空格分隔的 rgb()/rgba()、#rrggbb 与 #rgb，拒绝越界值", () => {
    expect(parseColor("rgb(150,171,188)")).toEqual([150, 171, 188]);
    expect(parseColor("rgba(1, 2, 3, 0.5)")).toEqual([1, 2, 3]);
    expect(parseColor("rgb(100 149 237)")).toEqual([100, 149, 237]);
    expect(parseColor("rgb(1 2 3 / 50%)")).toEqual([1, 2, 3]);
    expect(parseColor("#0ea5e9")).toEqual([14, 165, 233]);
    expect(parseColor("#f0a")).toEqual([255, 0, 170]);
    expect(parseColor("rgb(300, 0, 0)")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
  });
});
