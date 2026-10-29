import { describe, expect, it } from "vitest";
import {
  DESK_MODES,
  MODE,
  RAIL_FOOTER_MODES,
  RAIL_MODES,
  TAB_MODES,
  hasPager,
  hasScopeRow,
  hasSearchBar,
  modeInfo,
  modeTitle,
  normalizeMode,
} from "./deskModes";

describe("六种模式的下标语义", () => {
  it("0 音乐 1 视频 2 电台 3 收藏 4 设置 5 关于", () => {
    expect(DESK_MODES.map((mode) => mode.label)).toEqual([
      "音乐",
      "视频",
      "电台",
      "收藏",
      "设置",
      "关于",
    ]);
    expect(modeInfo(MODE.radio).id).toBe("radio");
    expect(modeInfo(MODE.favorites).id).toBe("favorites");
  });

  it("页标题：音乐页是「点歌台」，其余为模式名", () => {
    expect(modeTitle(MODE.music)).toBe("点歌台");
    expect(modeTitle(MODE.video)).toBe("视频");
    expect(modeTitle(MODE.about)).toBe("关于");
  });

  it("非法下标回退音乐（手改 localStorage / 旧版本残留）", () => {
    for (const raw of [-1, 6, 99, 1.5, "abc", null, undefined, NaN])
      expect(normalizeMode(raw)).toBe(MODE.music);
    expect(normalizeMode("3")).toBe(MODE.favorites);
  });

  it("桌面竖栏四项 + 底部两项；手机标签栏五项（关于并入设置）", () => {
    expect(RAIL_MODES.map((mode) => mode.label)).toEqual([
      "音乐",
      "视频",
      "电台",
      "收藏",
    ]);
    expect(RAIL_FOOTER_MODES.map((mode) => mode.label)).toEqual([
      "设置",
      "关于",
    ]);
    expect(TAB_MODES.map((mode) => mode.label)).toEqual([
      "音乐",
      "视频",
      "电台",
      "收藏",
      "设置",
    ]);
  });

  it("搜索栏 / 范围行 / 分页按模式存在", () => {
    expect(hasSearchBar(MODE.music)).toBe(true);
    expect(hasSearchBar(MODE.favorites)).toBe(true);
    expect(hasSearchBar(MODE.settings)).toBe(false);
    expect(hasSearchBar(MODE.about)).toBe(false);

    // 设置页仍有平台分组作范围行，关于页没有
    expect(hasScopeRow(MODE.settings)).toBe(true);
    expect(hasScopeRow(MODE.about)).toBe(false);

    expect(hasPager(MODE.music)).toBe(true);
    expect(hasPager(MODE.settings)).toBe(false);
  });
});
