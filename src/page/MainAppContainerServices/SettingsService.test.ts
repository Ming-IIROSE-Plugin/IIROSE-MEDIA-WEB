import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "./SettingsService";

afterEach(() => {
  localStorage.clear();
});

describe("插件全局设置", () => {
  it("不再显示已退役的「随机包含专辑/歌单」", () => {
    const setState = vi.fn();
    SettingsService.showPluginSettings(
      { setState } as unknown as Parameters<
        typeof SettingsService.showPluginSettings
      >[0],
      () => {},
      async () => {},
    );
    const data = setState.mock.lastCall?.[0]?.settingsData as {
      key: string;
    }[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.map((item) => item.key)).not.toContain(
      "shuffleIncludeCollections",
    );
  });
});
