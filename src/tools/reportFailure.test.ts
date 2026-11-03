import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../iirose_func/ShowMessage", () => ({
  ShowMessage: { show: vi.fn() },
}));

import { ShowMessage } from "../iirose_func/ShowMessage";
import { failureMessage, reportFailure } from "./reportFailure";

const showMock = ShowMessage.show as unknown as ReturnType<typeof vi.fn>;

describe("reportFailure", () => {
  beforeEach(() => {
    showMock.mockClear();
  });

  it("Error 实例取 message", () => {
    expect(failureMessage(new Error("请求失败"))).toBe("请求失败");
    reportFailure(new Error("请求失败"));
    expect(showMock).toHaveBeenCalledTimes(1);
    expect(showMock).toHaveBeenCalledWith("请求失败");
  });

  it("非 Error 值按字符串收敛", () => {
    expect(failureMessage("网络异常")).toBe("网络异常");
    expect(failureMessage(404)).toBe("404");
    reportFailure(404);
    expect(showMock).toHaveBeenCalledWith("404");
  });

  it("fallback 优先于错误自身文案", () => {
    reportFailure(new Error("原始文案"), "遇到了一些问题");
    expect(showMock).toHaveBeenCalledTimes(1);
    expect(showMock).toHaveBeenCalledWith("遇到了一些问题");
  });

  it("一次调用只弹一条提示", () => {
    reportFailure(new Error("a"), "b");
    reportFailure(undefined);
    expect(showMock).toHaveBeenCalledTimes(2);
  });
});
