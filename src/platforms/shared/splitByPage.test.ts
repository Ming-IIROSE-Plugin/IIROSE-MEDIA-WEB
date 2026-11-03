import { describe, expect, it } from "vitest";
import { splitByPage } from "./splitByPage";

const rows = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => ({ title: `第 ${i + 1} 项` }) as PlatformData,
  );

describe("splitByPage", () => {
  it("按每页数切出当前页，完整列表另行返回", () => {
    const data = rows(25);
    const { platformData, allPlatformData } = splitByPage(data, 10);
    expect(platformData).toHaveLength(10);
    expect(allPlatformData).toHaveLength(25);
    expect(allPlatformData).toBe(
      data === allPlatformData ? data : allPlatformData,
    );
  });

  it("少于每页 / 正好整除 / 空列表", () => {
    expect(splitByPage(rows(3), 10).platformData).toHaveLength(3);
    expect(splitByPage(rows(20), 10).platformData).toHaveLength(10);
    expect(splitByPage([], 10).platformData).toEqual([]);
    expect(splitByPage([], 10).allPlatformData).toEqual([]);
  });

  it("每页数非正或非整数时按一页装下全部（与旧循环一致）", () => {
    for (const size of [0, -1, Number.NaN, 2.5]) {
      const { platformData } = splitByPage(rows(25), size);
      expect(platformData).toHaveLength(25);
    }
  });
});
