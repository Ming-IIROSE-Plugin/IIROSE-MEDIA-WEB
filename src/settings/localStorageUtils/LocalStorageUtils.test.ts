import { beforeEach, describe, expect, it, vi } from "vitest";
import { readJson, writeJson } from "../../storage/localStore";
import { LocalStorageUtils } from "./LocalStorageUtils";

vi.mock("../commonSettings/CommonSettings", () => ({
  CommonSettings: class {
    setAgree() {}
  },
}));

describe("启动时迁移旧的默认 API 节点", () => {
  beforeEach(() => localStorage.clear());

  it.each([
    ["Dev", "Dev", "default", "Guangzhou"],
    ["HK", "Dev", "HK", "Guangzhou"],
    ["Dev", "HK", "default", "HK"],
    ["HK", "HK", "HK", "HK"],
  ])(
    "网易云 %s、B 站 %s 分别迁移到 %s、%s",
    (music, video, musicApi, videoApi) => {
      writeJson("neteaseSetting", { api: music, lyricOption: "off" });
      writeJson("bilibiliSetting", { api: video, qn: 80 });

      LocalStorageUtils.Init();

      const netease = readJson("neteaseSetting", {});
      const bilibili = readJson("bilibiliSetting", {});
      expect(netease).toMatchObject({ api: musicApi, lyricOption: "off" });
      expect(bilibili).toMatchObject({ api: videoApi, qn: 80 });

      writeJson("neteaseSetting", { ...netease, api: "HK" });
      writeJson("bilibiliSetting", { ...bilibili, api: "HK" });
      LocalStorageUtils.Init();

      expect(readJson("neteaseSetting", {})).toEqual({ ...netease, api: "HK" });
      expect(readJson("bilibiliSetting", {})).toEqual({
        ...bilibili,
        api: "HK",
      });
    },
  );
});
