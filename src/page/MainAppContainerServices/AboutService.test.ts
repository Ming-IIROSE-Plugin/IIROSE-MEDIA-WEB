import { afterEach, describe, expect, it, vi } from "vitest";
import { AboutService } from "./AboutService";
import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";

// 关于页的数据层：一张无标题卡片 + 四行（值位 + 动作）。
// 这里只锁结构与关键动作（谁被叫到、按什么顺序、开哪个链接），不锁文案的具体措辞。

type Ctx = Parameters<typeof AboutService.showAbout>[0];

/** 建卡并取出组卡 / 行，`ShowOrHideIMC` 换成可断言的 spy。 */
function showAbout() {
  const setState = vi.fn();
  const ShowOrHideIMC = vi.fn(async () => {});
  AboutService.showAbout({ setState } as unknown as Ctx, ShowOrHideIMC);

  const groups = setState.mock.lastCall?.[0]
    ?.settingsData as SettingGroupData[];
  const items = groups.flatMap((group) => group.items);
  const rowOf = (key: string): SettingData => {
    const found = items.find((item) => item.key === key);
    if (!found) throw new Error(`没有这一行：${key}`);
    return found;
  };
  return { groups, items, rowOf, setState, ShowOrHideIMC };
}

/** 跑一行动作：声明是 void，实现里有 async 的，统一按 Promise 等。 */
const run = (item: SettingData) => Promise.resolve(item.action?.() as unknown);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("关于卡结构", () => {
  it("一张无标题组卡，四行都是值位 + 动作", () => {
    const { groups } = showAbout();

    expect(groups).toHaveLength(1);
    // 关于卡没有组名：手机（设置里点「关于」）与桌面得到同一张卡
    expect(groups[0].title).toBe("");
    expect(groups[0].items).toHaveLength(4);

    for (const item of groups[0].items) {
      expect(item.key).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(item.icon).not.toContain("mdi-");
      expect(item.kind).toBe("value");
      expect(item.title).toBeTruthy();
      expect(item.actionTitle).toBeTruthy();
      expect(typeof item.action).toBe("function");
    }
  });

  it("只有源代码那行是外链行", () => {
    const { items } = showAbout();

    expect(
      items.filter((item) => item.external).map((item) => item.key),
    ).toEqual(["aboutSource"]);
  });

  it("只写 settingsData，不动其它现场", () => {
    const { groups, setState } = showAbout();

    expect(setState).toHaveBeenCalledOnce();
    expect(setState).toHaveBeenLastCalledWith({ settingsData: groups });
  });
});

describe("关于卡动作", () => {
  it("作者：先收起面板，再开宿站名片", async () => {
    const userCard = vi
      .spyOn(IIROSEUtils, "getUserCard")
      .mockImplementation(() => {});
    const { rowOf, ShowOrHideIMC } = showAbout();

    await run(rowOf("aboutAuthor"));

    expect(ShowOrHideIMC).toHaveBeenCalledOnce();
    expect(userCard).toHaveBeenCalledOnce();
    // 顺序有意义：名片要在面板收起之后弹
    expect(ShowOrHideIMC.mock.invocationCallOrder[0]).toBeLessThan(
      userCard.mock.invocationCallOrder[0],
    );
  });

  it("源代码：直接开仓库地址，不需要经过宿站弹窗", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const buildSelect = vi.spyOn(IIROSEUtils, "buildSelect2");
    const { rowOf } = showAbout();

    rowOf("aboutSource").action?.();

    expect(open).toHaveBeenCalledWith(
      "https://github.com/jingming295/IIROSE-MEDIA-WEB",
    );
    expect(buildSelect).not.toHaveBeenCalled();
  });

  it("投喂：给出两个渠道，选中后各开对应外链", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const buildSelect = vi
      .spyOn(IIROSEUtils, "buildSelect2")
      .mockImplementation(() => {});
    const { rowOf } = showAbout();

    await run(rowOf("aboutDonate"));

    expect(buildSelect).toHaveBeenCalledOnce();
    const [, options, handler] = buildSelect.mock.calls[0];
    expect(options).toHaveLength(2);

    handler(null as unknown as HTMLElement, "0");
    expect(open).toHaveBeenLastCalledWith("https://afdian.com/a/mingj");
    handler(null as unknown as HTMLElement, "1");
    expect(open).toHaveBeenLastCalledWith(
      "https://github.com/sponsors/jingming295",
    );
  });

  it("赞助列表：先收起面板，再按选中项开名片", async () => {
    const buildSelect = vi
      .spyOn(IIROSEUtils, "buildSelect2")
      .mockImplementation(() => {});
    const userCard = vi
      .spyOn(IIROSEUtils, "getUserCard")
      .mockImplementation(() => {});
    const { rowOf, ShowOrHideIMC } = showAbout();

    await run(rowOf("aboutSponsorList"));

    expect(buildSelect).toHaveBeenCalledOnce();
    const [, options, handler] = buildSelect.mock.calls[0];
    expect(options.length).toBeGreaterThan(0);

    const uid = String(options[0][0]);
    await handler(null as unknown as HTMLElement, uid);

    expect(userCard).toHaveBeenCalledWith(uid);
    expect(ShowOrHideIMC.mock.invocationCallOrder[0]).toBeLessThan(
      userCard.mock.invocationCallOrder[0],
    );
  });
});
