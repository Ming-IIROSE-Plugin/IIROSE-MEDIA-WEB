import {
  AnnounceMode,
  PluginSettings,
} from "../../../settings/pluginSettings/PluginSettings";
import { ShowMessage } from "../../ShowMessage";
import { Socket } from "../index";

/**
 * 点播播报统一入口：三档模式（card 发卡片 / silent 静默 / summary 批量总结）
 * 的唯一判定点。所有平台的 mediaCard 发送都必须经过这里；
 * mediaEvent 是独立的播放触发报文，永不受档位影响，由调用方照常发送。
 */

/**
 * 打开中的批量窗口的入口档位快照栈：栈深即批量抑制窗口深度（>0 表示仍有
 * 批量循环在执行，多批可交错）。每个批量窗口开启时把入口档位压栈、结束时
 * 弹栈——先结束的一批只弹自己的快照，不会把仍在执行的另一批的窗口提前
 * 关掉（LIFO pop 与「各批只关自己的窗口」语义一致，单一状态无对账裂缝）。
 * 窗口只在 summary 档开启，故栈内快照恒为 summary；逐卡判定只消费栈顶
 * 快照，不读实时档位——批次中途切档不影响进行中的批次（CAP-3）。
 */
const batchModeSnapshots: AnnounceMode[] = [];

/**
 * 单曲强制放行窗口深度：>0 表示有手动点播的单曲正在发送。
 * 手动点播入口（MOD/MVOD/@直链等）用 runSingleAnnounce 包住发送动作，
 * 声明「我是手动点播」——批量抑制窗口挂起时其卡片仍照常发送（CAP-1）。
 * 静默档优先于单曲窗口。
 */
let forceDepth = 0;

export class Announce {
  /** 当前是否应发送 mediaCard（判定序：静默档 → 单曲窗口 → 批量快照 → 实时档位） */
  public static shouldSendCard(): boolean {
    const mode = PluginSettings.getPluginSetting().announceMode;
    if (mode === "silent") return false;
    if (forceDepth > 0) return true;
    if (batchModeSnapshots.length > 0) {
      // 消费入口快照：summary 批次执行中切到 card，本批剩余曲目仍不逐个发卡片
      return batchModeSnapshots[batchModeSnapshots.length - 1] !== "summary";
    }
    return true;
  }

  /** 档位允许时才发送媒体卡片；mediaEvent 由调用方自行照发 */
  public static sendMediaCard(socket: Socket, mediacard: string): void {
    if (!Announce.shouldSendCard()) return;
    socket.send(mediacard);
  }

  /**
   * 单曲点播窗口：手动点播单曲的入口用这个包住发送（或整个点播动作），
   * try/finally 开关 forceDepth，使其卡片不被并行的批量抑制窗口吞掉。
   * 窗口越窄越好：能只包发送动作就不要包整个网络请求过程。受发送点深层
   * 嵌套限制（如 playBiliPage→prepareAndSendMedia 深两层，禁止穿参），
   * 部分入口只能包整个点播动作（含网络请求）——force-before-batch 判定
   * 序下，窗口开启期间并行批量的逐卡发送会被一并放行，这是该设计下已
   * 接受的竞态代价。
   */
  public static async runSingleAnnounce(
    loop: () => Promise<void> | void,
  ): Promise<void> {
    forceDepth++;
    try {
      await loop();
    } finally {
      forceDepth--;
    }
  }

  /**
   * 批量点播播报入口：summary 档且 count ≥ 2 时，先发一条总结消息，再在抑制
   * 窗口内执行 loop；否则直接执行 loop。
   * 消息格式（宿站 markdown）：首行 `\\\*`（三反斜杠+星号）触发 markdown，
   * 第二行「🎵 已提交点播 **《标题》**，共 **N** 项」，平台有简介时再附一行 blockquote。
   * 总结先于循环发送；循环中单项失败由平台层逐项 catch 提示并跳过，
   * 逐项 catch 之外的异常走本函数的兜底 catch：终止本批、提示一次、不上抛。
   */
  public static async runBatchAnnounce(
    title: string,
    count: number,
    loop: () => Promise<void> | void,
    description?: string | null,
  ): Promise<void> {
    try {
      const mode = PluginSettings.getPluginSetting().announceMode;
      if (mode !== "summary" || count < 2) {
        await loop();
        return;
      }

      // 报文必须经 JSON.stringify 构造，换行/反斜杠才能以 \n、\\* 合法转义嵌入；
      // 标题经净化（剥 HTML/转义 md 元字符/trim），空标题兜底为通用措辞
      const safeTitle = Announce.sanitizeText(title) || "批量点播";
      const lines = [
        "\\\\\\*",
        // 「已提交」而非「已点播」：无版权跳过、分集解析失败会让实际播放数 < N，不用确定语气
        `🎵 已提交点播 **《${safeTitle}》**，共 **${count}** 项`,
      ];
      const quote = Announce.buildDescriptionQuote(description);
      if (quote) lines.push(quote);
      new Socket().sendMessage(lines.join("\n"));

      batchModeSnapshots.push(mode);
      try {
        await loop();
      } finally {
        batchModeSnapshots.pop();
      }
    } catch (error) {
      // 兜底 catch 契约：本函数任何路径均不上抛，异常一律转为提示
      // （同因 10 秒去重），消除 void 调用点的 unhandled rejection
      Announce.showBatchItemError(error);
    }
  }

  /**
   * 批量点播单项失败的公开提示入口：平台层逐项 catch 与本模块兜底 catch 共用。
   * 同因 10 秒窗口去重（模式同 SendFetch.showNeteaseFailure）：
   * 一次大批量多曲同因失败只提示一次，避免逐曲刷屏。
   * label（曲名/分P名）只进显示文案（「《label》播放失败：原因」），
   * 去重键始终是原因本身。
   */
  private static batchItemErrorToastAt = 0;
  private static batchItemErrorToastMessage = "";

  public static showBatchItemError(error: unknown, label?: string): void {
    // 非 Error 抛出物：字符串原样，其余 JSON 序列化兜底——避免 String()
    // 把不同对象都渲染成 "[object Object]" 撞成同因
    const cause =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    // 同因去重按「原因」而非显示文案：大批量多曲同因失败只提示一次，
    // 曲名（label）只进显示文案（首支失败曲），不参与去重键
    const now = Date.now();
    if (
      cause === Announce.batchItemErrorToastMessage &&
      now - Announce.batchItemErrorToastAt < 10000
    ) {
      // 提示被去重吞掉，失败仍要记账：点播守卫靠这个计数把按钮置为「重试」
      ShowMessage.shownCount++;
      return;
    }
    Announce.batchItemErrorToastMessage = cause;
    Announce.batchItemErrorToastAt = now;
    ShowMessage.show(label ? `《${label}》播放失败：${cause}` : cause);
  }

  /**
   * 文本净化：剥 HTML 标签（B 站 desc 常含 <br> 等）、压平换行为单行、
   * 转义 markdown 元字符（*_`）防止打乱总结消息排版、去首尾空白。
   */
  private static sanitizeText(raw: string): string {
    if (!raw) return "";
    return raw
      .replace(/<[^>]*>/g, " ")
      .replace(/\s*\n+\s*/g, " ")
      .replace(/([*_`])/g, "\\$1")
      .trim();
  }

  /**
   * 集合简介整理为单行 blockquote；空白简介返回空串（不带详情行）。
   * 按码点截断（防 emoji 被劈成孤立代理项），119 码点 + 省略号保证总长 ≤120。
   */
  private static buildDescriptionQuote(description?: string | null): string {
    if (!description) return "";
    const flat = Announce.sanitizeText(description);
    if (!flat) return "";
    const cps = Array.from(flat);
    const clipped = cps.length > 119 ? cps.slice(0, 119).join("") + "…" : flat;
    return `> ${clipped}`;
  }
}
