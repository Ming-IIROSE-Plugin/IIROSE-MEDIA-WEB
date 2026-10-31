import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Announce } from "./index";
import { Socket } from "../index";
import { PluginSettings } from "../../../settings/pluginSettings/PluginSettings";

/**
 * 点播播报三档模式的矩阵行覆盖。
 * 矩阵出处：_bmad-output/implementation-artifacts/spec-request-announce-modes.md
 * 的 frozen 块「I/O & Edge-Case Matrix」（human-owned intent，行为以此为准）：
 * 默认/老用户回退 card、静默不发卡片、summary 单曲发卡片、
 * summary 批量 ≥2 仅一条总结消息、总结报文合法 JSON（\n 转义）、设置持久化读取。
 * 批次作用域矩阵（单曲窗口放行 / 批次档位快照 / 逐项失败去重）出处：
 * _bmad-output/implementation-artifacts/spec-announce-batch-scope.md。
 */

const sendMock = vi.fn<(data: string) => void>();
const alertMock = vi.fn<(message: string) => void>();

function setMode(raw: unknown) {
  localStorage.setItem(
    "imwPluginSetting",
    JSON.stringify({ announceMode: raw }),
  );
}

beforeEach(() => {
  localStorage.clear();
  (window as unknown as Record<string, unknown>).WebSocket =
    function WebSocket() {};
  (window as unknown as Record<string, unknown>).socket = { send: sendMock };
  // 宿站 toast 通道：showBatchItemError 经 ShowMessage.show 走 window._alert
  (window as unknown as Record<string, unknown>)._alert = alertMock;
  sendMock.mockClear();
  alertMock.mockClear();
  // 同因提示有 10 秒去重窗口：用例之间必须重置，否则后一条断言会被上一条压掉
  (Announce as unknown as Record<string, unknown>).batchItemErrorToastAt = 0;
  (Announce as unknown as Record<string, unknown>).batchItemErrorToastMessage =
    "";
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as Record<string, unknown>).socket;
  delete (window as unknown as Record<string, unknown>).WebSocket;
  delete (window as unknown as Record<string, unknown>)._alert;
});

describe("announceMode 归一化（默认/老用户回退发卡片）", () => {
  it("未设置 announceMode 读取回退 card", () => {
    localStorage.setItem("imwPluginSetting", JSON.stringify({}));
    expect(PluginSettings.getPluginSetting().announceMode).toBe("card");
  });

  it("非法值一律回退 card；合法值原样保留", () => {
    setMode("loud");
    expect(PluginSettings.getPluginSetting().announceMode).toBe("card");
    setMode(undefined);
    expect(PluginSettings.getPluginSetting().announceMode).toBe("card");
    setMode("silent");
    expect(PluginSettings.getPluginSetting().announceMode).toBe("silent");
    setMode("summary");
    expect(PluginSettings.getPluginSetting().announceMode).toBe("summary");
  });

  it("设置持久化：写入什么档位，重新读取仍是什么档位", () => {
    setMode("summary");
    expect(PluginSettings.getPluginSetting().announceMode).toBe("summary");
  });
});

describe("shouldSendCard / sendMediaCard（按档位决定是否发卡片）", () => {
  it("card 档：发送卡片", () => {
    setMode("card");
    Announce.sendMediaCard(new Socket(), "CARD");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith("CARD");
  });

  it("silent 档：不发送卡片（mediaEvent 由调用方照发，不受档位影响）", () => {
    setMode("silent");
    expect(Announce.shouldSendCard()).toBe(false);
    Announce.sendMediaCard(new Socket(), "CARD");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("summary 档默认（无批量窗口）：单曲点播仍发卡片", () => {
    setMode("summary");
    expect(Announce.shouldSendCard()).toBe(true);
    Announce.sendMediaCard(new Socket(), "CARD");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe("runBatchAnnounce（批量点播播报）", () => {
  it("card 档批量 ≥2：不总结，循环内外卡片照发（与现状一致）", async () => {
    setMode("card");
    let inLoop = false;
    await Announce.runBatchAnnounce("歌单", 5, async () => {
      inLoop = Announce.shouldSendCard();
    });
    expect(inLoop).toBe(true);
    expect(Announce.shouldSendCard()).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("silent 档批量：循环内不发卡片，也不发总结", async () => {
    setMode("silent");
    let inLoop = true;
    await Announce.runBatchAnnounce("歌单", 5, async () => {
      inLoop = Announce.shouldSendCard();
    });
    expect(inLoop).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("summary 档批量 ≥2：先发一条总结消息，循环内抑制卡片，结束后恢复", async () => {
    setMode("summary");
    let inLoop = true;
    await Announce.runBatchAnnounce("冬日歌单", 5, async () => {
      inLoop = Announce.shouldSendCard();
    });
    // 仅一条总结消息，无逐曲卡片
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(inLoop).toBe(false);
    expect(Announce.shouldSendCard()).toBe(true);
  });

  it("总结报文：合法 JSON，解析后 m 为 \\\* 独行 + 正文行（换行经 \\n 转义）", async () => {
    setMode("summary");
    await Announce.runBatchAnnounce("冬日歌单", 5, async () => {});
    const raw = sendMock.mock.calls[0][0];
    const parsed = JSON.parse(raw) as { m: string; mc: string; i: string };
    // 首行为宿站 markdown 触发写法：三个反斜杠 + 星号
    expect(parsed.m).toBe(
      "\\\\\\*\n🎵 已提交点播 **《冬日歌单》**，共 **5** 项",
    );
    expect(parsed.m.split("\n")[0]).toBe("\\\\\\*");
    expect(parsed.m.split("\n")[1]).toBe(
      "🎵 已提交点播 **《冬日歌单》**，共 **5** 项",
    );
    // 无简介时正文只有两行，不带详情行
    expect(parsed.m.split("\n")).toHaveLength(2);
    // 封套契约：mc 颜色固定，i 为字符串形态（宿站对该字段类型兼容未验证，钉住形状）
    expect(parsed.mc).toBe("008000");
    expect(typeof parsed.i).toBe("string");
    // 原始报文里不允许出现裸换行
    expect(raw).not.toMatch(/\n/);
  });

  it("loop 报回实际数 = N：不发校正", async () => {
    setMode("summary");
    await Announce.runBatchAnnounce("冬日歌单", 5, async () => 5);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("loop 报回 0：补发「已取消，未提交曲目」", async () => {
    setMode("summary");
    await Announce.runBatchAnnounce("冬日*歌单", 5, async () => 0);
    expect(sendMock).toHaveBeenCalledTimes(2);
    const parsed = JSON.parse(sendMock.mock.calls[1][0]) as { m: string };
    expect(parsed.m).toBe("\\\\\\*\n🎵 《冬日\\*歌单》已取消，未提交曲目");
  });

  it("loop 报回部分数：补发「已停止，实际提交 X / N 项」", async () => {
    setMode("summary");
    await Announce.runBatchAnnounce("冬日歌单", 5, async () => 3);
    expect(sendMock).toHaveBeenCalledTimes(2);
    const parsed = JSON.parse(sendMock.mock.calls[1][0]) as { m: string };
    expect(parsed.m).toBe(
      "\\\\\\*\n🎵 《冬日歌单》已停止，实际提交 **3** / 5 项",
    );
  });

  it("card / silent 档没发总结：实际数少了也不校正", async () => {
    for (const mode of ["card", "silent"]) {
      setMode(mode);
      await Announce.runBatchAnnounce("冬日歌单", 5, async () => 0);
    }
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("总结附简介：平台有详细介绍时以 blockquote 追加为第三行", async () => {
    setMode("summary");
    await Announce.runBatchAnnounce(
      "冬日歌单",
      5,
      async () => {},
      "第一行简介\n\n第二行简介",
    );
    const parsed = JSON.parse(sendMock.mock.calls[0][0]) as { m: string };
    const lines = parsed.m.split("\n");
    expect(lines).toHaveLength(3);
    // 简介压平为单行 blockquote
    expect(lines[2]).toBe("> 第一行简介 第二行简介");
  });

  it("简介超长按码点截断（emoji 不劈代理对，总长 ≤120）；空白简介不带详情行", async () => {
    setMode("summary");
    await Announce.runBatchAnnounce("歌单", 2, async () => {}, "a".repeat(150));
    let parsed = JSON.parse(sendMock.mock.calls[0][0]) as { m: string };
    // 119 码点 + 省略号 = 120 字符，与冻结矩阵「≤120」一致
    expect(parsed.m.split("\n")[2]).toBe(`> ${"a".repeat(119)}…`);

    // emoji 跨截断点不产生孤立代理项
    await Announce.runBatchAnnounce(
      "歌单",
      2,
      async () => {},
      "x" + "🎵".repeat(130),
    );
    parsed = JSON.parse(sendMock.mock.calls[1][0]) as { m: string };
    expect(parsed.m.split("\n")[2]).toBe(`> x${"🎵".repeat(118)}…`);

    await Announce.runBatchAnnounce("歌单", 2, async () => {}, "  \n  ");
    parsed = JSON.parse(sendMock.mock.calls[2][0]) as { m: string };
    expect(parsed.m.split("\n")).toHaveLength(2);
  });

  it("简介/标题净化：剥 HTML 标签、转义 markdown 元字符", async () => {
    setMode("summary");
    await Announce.runBatchAnnounce(
      "歌单",
      2,
      async () => {},
      "第一行<br>第二行 **加粗**",
    );
    let parsed = JSON.parse(sendMock.mock.calls[0][0]) as { m: string };
    // <br> 剥为空格、md 元字符转义，不破坏 blockquote 排版
    expect(parsed.m.split("\n")[2]).toBe("> 第一行 第二行 \\*\\*加粗\\*\\*");

    // 标题里的 md 元字符同样转义，不破坏 **《...》** 包裹
    await Announce.runBatchAnnounce("*星*号", 2, async () => {});
    parsed = JSON.parse(sendMock.mock.calls[1][0]) as { m: string };
    expect(parsed.m.split("\n")[1]).toBe(
      "🎵 已提交点播 **《\\*星\\*号》**，共 **2** 项",
    );
  });

  it("summary 档批量 count=2 边界（<2 判定的唯一边界）：仍发总结并抑制", async () => {
    setMode("summary");
    let inLoop = true;
    await Announce.runBatchAnnounce("双曲歌单", 2, async () => {
      inLoop = Announce.shouldSendCard();
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(inLoop).toBe(false);
    expect(Announce.shouldSendCard()).toBe(true);
  });

  it("summary 档单曲（count=1）：不总结、不抑制，仍发卡片", async () => {
    setMode("summary");
    let inLoop = false;
    await Announce.runBatchAnnounce("单曲", 1, async () => {
      inLoop = Announce.shouldSendCard();
    });
    expect(inLoop).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("循环抛异常：兜底 catch 消化异常（无 unhandled rejection）、提示一次、finally 关窗", async () => {
    setMode("summary");
    await Announce.runBatchAnnounce("歌单", 3, async () => {
      throw new Error("循环级异常");
    });
    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(alertMock).toHaveBeenCalledWith("循环级异常");
    expect(Announce.shouldSendCard()).toBe(true);
  });

  it("空标题兜底：标题为空串/undefined/纯空白时正文使用「批量点播」", async () => {
    setMode("summary");
    await Announce.runBatchAnnounce("", 2, async () => {});
    await Announce.runBatchAnnounce(
      undefined as unknown as string,
      2,
      async () => {},
    );
    // 纯空白串是 truthy，不能绕过 trim 兜底
    await Announce.runBatchAnnounce("   ", 2, async () => {});
    const first = JSON.parse(sendMock.mock.calls[0][0]) as { m: string };
    const second = JSON.parse(sendMock.mock.calls[1][0]) as { m: string };
    const third = JSON.parse(sendMock.mock.calls[2][0]) as { m: string };
    const expected = "\\\\\\*\n🎵 已提交点播 **《批量点播》**，共 **2** 项";
    expect(first.m).toBe(expected);
    expect(second.m).toBe(expected);
    expect(third.m).toBe(expected);
  });

  it("并发批量回归：后启动的一批先结束，先启动批量的剩余部分仍被抑制", async () => {
    setMode("summary");
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let inRestOfFirst = true;

    // 第一批：进入 loop 后挂起（窗口深度 1）。runBatchAnnounce 的同步前缀
    // （发总结、深度 +1）在调用返回前就已执行完，无需额外让步。
    const first = Announce.runBatchAnnounce("歌单A", 3, async () => {
      await firstGate;
      inRestOfFirst = Announce.shouldSendCard();
    });

    // 第二批完成时第一批仍在执行：旧的单布尔实现会在此把窗口整个关掉
    const second = Announce.runBatchAnnounce("歌单B", 2, async () => {});
    await second;

    releaseFirst();
    await first;

    expect(inRestOfFirst).toBe(false);
    expect(Announce.shouldSendCard()).toBe(true);
    // 两个批量各一条总结，无逐曲卡片
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});

describe("批次作用域：单曲窗口 / 批次快照 / 逐项失败（spec-announce-batch-scope）", () => {
  it("CAP-1 批间手动点播：批量挂起中开单曲窗口，单曲卡片放行，批量其余仍抑制", async () => {
    setMode("summary");
    let releaseBatch!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseBatch = resolve;
    });
    let batchRest = true;

    const batch = Announce.runBatchAnnounce("歌单", 5, async () => {
      await gate;
      batchRest = Announce.shouldSendCard();
    });

    try {
      // 批量挂起中用户手动点播单曲（如 @直链/MOD/MVOD）：单曲窗口内卡片立即发送
      await Announce.runSingleAnnounce(async () => {
        Announce.sendMediaCard(new Socket(), "SINGLE_CARD");
      });

      // 一条总结 + 一张单曲卡片
      expect(sendMock).toHaveBeenCalledTimes(2);
      expect(sendMock).toHaveBeenLastCalledWith("SINGLE_CARD");
    } finally {
      // 断言失败也先放行批量并收尾窗口，避免状态泄漏级联污染后续用例
      releaseBatch();
    }
    await batch;
    // 批量其余曲目仍无卡片（单曲窗口不泄漏到批量判定）
    expect(batchRest).toBe(false);
    expect(Announce.shouldSendCard()).toBe(true);
  });

  it("CAP-1 单曲窗口×silent：静默档优先于单曲窗口，仍不发卡片", async () => {
    setMode("silent");
    let inSingleWindow = true;
    await Announce.runSingleAnnounce(async () => {
      inSingleWindow = Announce.shouldSendCard();
      Announce.sendMediaCard(new Socket(), "SINGLE_CARD");
    });
    expect(inSingleWindow).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("CAP-3 批次快照：批量执行中切到 card，本批剩余仍抑制；下一批按新档位", async () => {
    setMode("summary");
    let releaseBatch!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseBatch = resolve;
    });
    let batchRest = true;

    const batch = Announce.runBatchAnnounce("歌单", 5, async () => {
      await gate;
      setMode("card"); // 中途切档
      batchRest = Announce.shouldSendCard();
    });

    try {
      releaseBatch();
      await batch;
    } finally {
      // 断言失败也确保批量已收尾、窗口已关，不污染后续用例
    }

    // 快照生效：本批剩余曲目不逐个发卡片，无「总结+逐卡」分裂
    expect(batchRest).toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(1);
    // 批量结束后读实时档位：card → 放行（下一次点播立即按新档）
    expect(Announce.shouldSendCard()).toBe(true);
  });

  it("CAP-3 silent 读实时档：批量挂起中切 silent，剩余曲目立即静默（优先于批次快照）", async () => {
    setMode("summary");
    let releaseBatch!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseBatch = resolve;
    });
    let batchRest = true;

    const batch = Announce.runBatchAnnounce("歌单", 5, async () => {
      await gate;
      setMode("silent"); // 中途切静默档
      batchRest = Announce.shouldSendCard();
    });

    try {
      releaseBatch();
      await batch;
    } finally {
      // 断言失败也确保批量已收尾、窗口已关，不污染后续用例
    }

    // 刻意不对称：silent 读实时档且优先于批次快照，切静默立即生效
    expect(batchRest).toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(1); // 仍只有一条总结
  });

  it("CAP-2 逐项失败：逐项 catch 跳过失败曲、剩余照播、同因只提示一次、关窗", async () => {
    setMode("summary");
    const played: number[] = [];
    await Announce.runBatchAnnounce("歌单", 3, async () => {
      // 模拟平台层批量循环的逐项 try/catch 结构（如 finalODSONG）
      for (const i of [1, 2, 3]) {
        try {
          if (i === 2) throw new Error("第2曲解析失败");
          played.push(i);
        } catch (error) {
          Announce.showBatchItemError(error);
        }
      }
    });
    expect(played).toEqual([1, 3]); // 失败曲跳过，剩余照播
    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(alertMock).toHaveBeenCalledWith("第2曲解析失败");
    expect(Announce.shouldSendCard()).toBe(true); // finally 关窗
  });

  it("CAP-2 同因去重：10 秒窗口内同因失败只提示一次，不同因仍提示", async () => {
    setMode("summary");
    await Announce.runBatchAnnounce("歌单A", 2, async () => {
      throw new Error("同因失败");
    });
    await Announce.runBatchAnnounce("歌单B", 2, async () => {
      throw new Error("同因失败");
    });
    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(alertMock).toHaveBeenCalledWith("同因失败");

    await Announce.runBatchAnnounce("歌单C", 2, async () => {
      throw new Error("另一原因");
    });
    expect(alertMock).toHaveBeenCalledTimes(2);
    expect(alertMock).toHaveBeenLastCalledWith("另一原因");
  });

  it("失败提示带曲名：label 只进显示文案，去重键仍是原因", () => {
    const err = new Error("解析失败");
    Announce.showBatchItemError(err, "海阔天空");
    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(alertMock).toHaveBeenCalledWith("《海阔天空》播放失败：解析失败");

    // 同因不同曲名：10 秒窗口内不重复提示
    Announce.showBatchItemError(err, "月半小夜曲");
    expect(alertMock).toHaveBeenCalledTimes(1);

    // 无 label：裸原因
    Announce.showBatchItemError(new Error("裸原因"));
    expect(alertMock).toHaveBeenCalledTimes(2);
    expect(alertMock).toHaveBeenLastCalledWith("裸原因");
  });

  it("CAP-2 同因去重：10 秒窗口到期后，同因失败再次提示", async () => {
    vi.useFakeTimers();
    setMode("summary");
    await Announce.runBatchAnnounce("歌单A", 2, async () => {
      throw new Error("到期同因");
    });
    await Announce.runBatchAnnounce("歌单B", 2, async () => {
      throw new Error("到期同因");
    });
    expect(alertMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_500);

    await Announce.runBatchAnnounce("歌单C", 2, async () => {
      throw new Error("到期同因");
    });
    expect(alertMock).toHaveBeenCalledTimes(2);
  });

  it("CAP-1 单曲窗口 try/finally：loop 抛异常也会关闭窗口", async () => {
    setMode("summary");
    await expect(
      Announce.runSingleAnnounce(async () => {
        throw new Error("单曲失败");
      }),
    ).rejects.toThrow("单曲失败");
    // 窗口已关：批量抑制与档位判定恢复原状
    await Announce.runSingleAnnounce(async () => {});
    expect(Announce.shouldSendCard()).toBe(true);
  });
});
