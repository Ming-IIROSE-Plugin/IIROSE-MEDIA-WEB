import { beforeEach, describe, expect, it, vi } from "vitest";

// 宿站选择框走 jQuery 体系（buildSelect2），测试里截获选项表与回调即可，
// 不需要真实弹窗。
vi.mock("../../iirose_func/IIROSEUtils", () => ({
  IIROSEUtils: { buildSelect2: vi.fn() },
}));

import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";
import { SendFetch } from "../../Api";
import { NetEaseSettings } from "./NetEaseSettings";

const buildSelect2 = IIROSEUtils.buildSelect2 as unknown as ReturnType<
  typeof vi.fn
>;

/**
 * 写入端（设置弹窗）与读取端（`getNeteaseCors`）必须共用同一份
 * `neteaseSetting` localStorage key 和同一个节点枚举值；写成 `"hk"` 之类
 * 会让设置看起来生效、实际请求仍走广州。
 */
describe("NetEaseSettings.setNeteaseDefaultApi", () => {
  beforeEach(() => {
    localStorage.clear();
    buildSelect2.mockReset();
    localStorage.setItem(
      "neteaseSetting",
      JSON.stringify({
        quality: "lossless",
        api: "default",
        lyricOption: "both",
      }),
    );
  });

  it("选中「香港-海外优化」写入 api: HK，且 getNeteaseCors() 读到同一份设置", () => {
    const changeActionTitleAction = vi.fn();

    NetEaseSettings.setNeteaseDefaultApi(changeActionTitleAction);

    expect(buildSelect2).toHaveBeenCalledTimes(1);
    const [, options, set] = buildSelect2.mock.calls[0] as [
      null,
      (string | number)[][],
      (target: HTMLElement, value: string) => void,
    ];

    const hkOption = options.find((option) => option[1] === "香港-海外优化");
    expect(options.map((option) => option.slice(0, 2))).toEqual([
      ["default", "广州-默认节点"],
      ["HK", "香港-海外优化"],
    ]);
    expect(hkOption).toBeDefined();
    expect(hkOption?.[0]).toBe("HK");

    set(document.createElement("div"), String(hkOption?.[0]));

    const stored = JSON.parse(localStorage.getItem("neteaseSetting")!);
    expect(stored.api).toBe("HK");
    expect((SendFetch as any).getNeteaseCors()).toBe(SendFetch.malaysiacors);
    expect(changeActionTitleAction).toHaveBeenCalledWith("香港-海外优化");
  });
});
