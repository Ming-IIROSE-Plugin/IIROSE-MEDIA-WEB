import { afterEach, describe, expect, it, vi } from "vitest";
import { WBI } from "./WBI";

const IMG_KEY = "7cd084941338484aae1ad9425b84077c";
const SUB_KEY = "4932caff0ff746eab6f01bf08b70ac45";

describe("WBI.encWbi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("按 mixin key 生成与 node:crypto 一致的 w_rid", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    // private 方法在这里只做纯签名，不触网；期望值由 node:crypto 独立算出。
    const wbi = new WBI() as unknown as {
      encWbi: (p: Record<string, unknown>, i: string, s: string) => string;
    };
    const encWbi = wbi.encWbi.bind(wbi);
    expect(encWbi({ a: 1 }, IMG_KEY, SUB_KEY)).toBe(
      "a=1&wts=1700000000&w_rid=d8cf009c576715f53091b66b3ce51a12",
    );
  });
});
