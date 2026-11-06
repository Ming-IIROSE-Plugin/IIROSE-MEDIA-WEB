import { afterEach, describe, expect, it, vi } from "vitest";
import { InputPlatformAnalysis } from "./InputPlatformAnalysis";
import { setPanelPresence } from "../listener/panelPresence";

afterEach(() => setPanelPresence({ open: false, windowed: false }));

const search = async () => {
  const toggle = vi.fn(async () => {});
  const changeKeyword = vi.fn();
  await InputPlatformAnalysis.Analysis(
    "@周杰伦",
    () => {},
    undefined,
    changeKeyword,
    toggle,
  );
  return { toggle, changeKeyword };
};

describe("聊天框 @ 搜索", () => {
  it("面板关着：打开并搜索", async () => {
    const { toggle, changeKeyword } = await search();
    expect(toggle).toHaveBeenCalledOnce();
    expect(changeKeyword).toHaveBeenCalledWith("周杰伦");
  });

  it("窗口开着：不关窗口，只搜索", async () => {
    setPanelPresence({ open: true, windowed: true });
    const { toggle, changeKeyword } = await search();
    expect(toggle).not.toHaveBeenCalled();
    expect(changeKeyword).toHaveBeenCalledWith("周杰伦");
  });
});
