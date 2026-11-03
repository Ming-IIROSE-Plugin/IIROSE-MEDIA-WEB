import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readJson,
  readString,
  removeKey,
  tryReadString,
  writeJson,
  writeString,
} from "./localStore";

describe("localStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("纯字符串按原样存回（不加引号）", () => {
    expect(readString("k")).toBeNull();
    expect(writeString("k", "netease")).toBe(true);
    expect(localStorage.getItem("k")).toBe("netease");
    expect(readString("k")).toBe("netease");
  });

  it("JSON 值落盘是 JSON 字符串，读回是对象", () => {
    expect(writeJson("k", { x: 1, y: 2 })).toBe(true);
    expect(localStorage.getItem("k")).toBe('{"x":1,"y":2}');
    expect(readJson("k", null)).toEqual({ x: 1, y: 2 });
  });

  it("缺失、损坏与存档里的 null 都返回 fallback", () => {
    expect(readJson("missing", { a: 1 })).toEqual({ a: 1 });
    localStorage.setItem("bad", "{oops");
    expect(readJson("bad", { a: 1 })).toEqual({ a: 1 });
    localStorage.setItem("nil", "null");
    expect(readJson("nil", { a: 1 })).toEqual({ a: 1 });
  });

  it("存储不可用时：读给默认值、写返回 false，都不抛", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(readString("k")).toBeNull();
    expect(readJson("k", 3)).toBe(3);
    expect(writeString("k", "v")).toBe(false);
    expect(writeJson("k", { x: 1 })).toBe(false);
    expect(removeKey("k")).toBe(false);
  });

  it("值不可序列化时不写入", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(writeJson("k", circular)).toBe(false);
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("writeJson(undefined) 不写入并返回 false", () => {
    expect(writeJson("k", undefined)).toBe(false);
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("readJson 保留合法的 falsy 值，只把 null 当无记录", () => {
    writeJson("k", 0);
    expect(readJson("k", 7)).toBe(0);
    writeJson("k", false);
    expect(readJson("k", true)).toBe(false);
    writeJson("k", "");
    expect(readJson("k", "fallback")).toBe("");
    writeJson("k", null);
    expect(readJson("k", "fallback")).toBe("fallback");
  });

  it("tryReadString 区分「读不出来」与「没有记录」", () => {
    expect(tryReadString("missing")).toEqual({ ok: true, value: null });
    writeString("k", "v");
    expect(tryReadString("k")).toEqual({ ok: true, value: "v" });
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
    expect(tryReadString("k")).toEqual({ ok: false, value: null });
    expect(readString("k")).toBeNull();
    getItem.mockRestore();
  });

  it("removeKey 删掉记录", () => {
    writeString("k", "v");
    expect(removeKey("k")).toBe(true);
    expect(readString("k")).toBeNull();
  });
});
