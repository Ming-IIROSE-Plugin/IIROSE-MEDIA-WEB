import { describe, expect, it } from "vitest";
import {
  PANEL_ENTRIES,
  normalizePanelEntry,
  panelEntryAllowsSwipe,
  panelEntryShowsPill,
} from "./normalize";

describe("点歌台入口的四档", () => {
  it("胶囊：只有「只用双指下滑」不显示", () => {
    expect(PANEL_ENTRIES.map(panelEntryShowsPill)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("双指下滑：面板关着（打开）/ 开着（收起）各档响不响应", () => {
    const table = PANEL_ENTRIES.map((entry) => [
      entry,
      panelEntryAllowsSwipe(entry, false),
      panelEntryAllowsSwipe(entry, true),
    ]);
    expect(table).toEqual([
      ["pillSwipe", true, true],
      ["pillSwipeClose", false, true],
      ["pill", false, false],
      ["swipe", true, true],
    ]);
  });

  it("没有「两样都没有」：每一档要么有胶囊，要么能用双指下滑打开", () => {
    for (const entry of PANEL_ENTRIES)
      expect(
        panelEntryShowsPill(entry) || panelEntryAllowsSwipe(entry, false),
      ).toBe(true);
  });

  it("不认识的值回到默认", () => {
    expect(normalizePanelEntry(undefined)).toBe("pillSwipe");
    expect(normalizePanelEntry("swipe")).toBe("swipe");
    expect(normalizePanelEntry({})).toBe("pillSwipe");
  });
});
