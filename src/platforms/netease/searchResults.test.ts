import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({
  searchNetease: vi.fn(),
  getNeteasePlatformDataByIds: vi.fn(),
}));

vi.mock("./search", () => search);

import { ShowMessage } from "../../iirose_func/ShowMessage";
import { searchMusicsBasics } from "./searchResults";

describe("网易云搜索失败提示", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    search.searchNetease.mockReset();
    search.getNeteasePlatformDataByIds.mockReset();
  });

  it("把错因与建议各提示一次，并返回空页", async () => {
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    search.searchNetease.mockRejectedValue(new Error("网络断了"));

    await expect(searchMusicsBasics("关键词", 1, 10)).resolves.toEqual({
      platformData: [],
      totalPage: 0,
      allPlatformData: [],
    });
    // 文案是用户可见契约：第一条来自统一上报入口，第二条是既有的建议文案。
    expect(show.mock.calls.map(([text]) => text)).toEqual([
      "网络断了",
      "遇到了一些问题，你可以在设置中切换API以解决",
    ]);
  });

  it("抛出非 Error 值时也只会提示一条可用文案", async () => {
    const show = vi.spyOn(ShowMessage, "show").mockImplementation(() => {});
    search.searchNetease.mockRejectedValue("字符串错误");

    await searchMusicsBasics("关键词", 1, 10);
    expect(show.mock.calls.map(([text]) => text)).toEqual([
      "字符串错误",
      "遇到了一些问题，你可以在设置中切换API以解决",
    ]);
  });
});
