import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MEDIA_PROGRESS_POSITION_KEY,
  saveMediaProgressPosition,
} from "../../../media-progress/PositionStorage";
import {
  SHUFFLE_PICKER_POSITION_KEY,
  readShufflePickerPosition,
  saveShufflePickerPosition,
} from "./pickerPosition";

afterEach(() => localStorage.clear());

describe("收藏随机面板位置存储", () => {
  it("存取 {x,y}，只克隆坐标", () => {
    const position = { x: 40, y: 60 };
    saveShufflePickerPosition(position);
    position.x = 99;
    expect(localStorage.getItem(SHUFFLE_PICKER_POSITION_KEY)).toBe(
      '{"x":40,"y":60}',
    );
    expect(readShufflePickerPosition()).toEqual({ x: 40, y: 60 });
  });

  it("与播放进度浮窗的键互不影响", () => {
    saveShufflePickerPosition({ x: 1, y: 2 });
    saveMediaProgressPosition({ x: 3, y: 4 });
    expect(localStorage.getItem(SHUFFLE_PICKER_POSITION_KEY)).toBe(
      '{"x":1,"y":2}',
    );
    expect(localStorage.getItem(MEDIA_PROGRESS_POSITION_KEY)).toBe(
      '{"x":3,"y":4}',
    );
  });

  it.each([
    ["空", ""],
    ["非法 JSON", "{"],
    ["null", "null"],
    ["数组", "[1,2]"],
    ["缺少 y", '{"x":1}'],
    ["字符串坐标", '{"x":"1","y":2}'],
    ["负数坐标", '{"x":-1,"y":2}'],
  ])("非法值 %s 按无记录", (_label, raw) => {
    localStorage.setItem(SHUFFLE_PICKER_POSITION_KEY, raw);
    expect(readShufflePickerPosition()).toBeUndefined();
  });

  it("localStorage 读写抛错时不抛错", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(readShufflePickerPosition()).toBeUndefined();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => saveShufflePickerPosition({ x: 1, y: 2 })).not.toThrow();
  });
});
