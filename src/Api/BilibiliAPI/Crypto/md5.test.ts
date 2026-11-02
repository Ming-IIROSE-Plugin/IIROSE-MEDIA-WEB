import { describe, expect, it } from "vitest";
import { md5Hex } from "./md5";

// 期望值由 node:crypto 的 createHash("md5") 生成，逐字节对齐原 md5 包的行为。
describe("md5Hex", () => {
  it.each([
    ["", "d41d8cd98f00b204e9800998ecf8427e"],
    ["abc", "900150983cd24fb0d6963f7d28e17f72"],
    ["中文", "a7bac2239fcdcb3a067903d8077c4a07"],
    ["x", "9dd4e461268c8034f5c8564e155c67a6"],
    ["0123456789".repeat(20), "c902a17556796a9f97afa23bad130b04"],
  ])("对 %j 输出与 node:crypto 一致", (input, expected) => {
    expect(md5Hex(input)).toBe(expected);
  });

  it("处理跨 64 字节分块与超长输入", () => {
    const long = "a".repeat(1000);
    expect(md5Hex(long)).toBe("cabe45dcc9ae5b66ba86600cca6b8ba8");
    expect(md5Hex("a")).toBe("0cc175b9c0f1b6a831c399e269772661");
  });
});
