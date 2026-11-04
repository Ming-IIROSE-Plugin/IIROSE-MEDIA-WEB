// 搜索栏的粘贴识别：BV 号 / av 号 / 哔哩哔哩链接一律按「视频目标」处理。
// 只做纯文本判定，不发请求（真实搜索仍走 BilibiliService 的现有链路）。
// 链接解析本身在 `platforms/bilibiliLinkParse`（平台层也要用，不能反向依赖视图层）。

export {
  parseBilibiliLink,
  type BilibiliLinkTarget,
} from "../../../platforms/bilibiliLinkParse";

// 两侧要词边界：`xxabv1234567890yy` 这类普通文本不该被当成 BV 号抢走粘贴。
const BVID = /\bbv([0-9a-z]{10})\b/i;
const AVID = /\bav(\d{1,12})\b/i;

/**
 * 从粘贴或输入的文字里认出视频目标，返回应当提交的关键词（标准化后的 BV/av 号）。
 * 不是视频目标时返回 null。
 */
export function detectVideoTarget(text: string): string | null {
  const value = text.trim();
  if (!value) return null;

  const bv = value.match(BVID);
  if (bv) return `BV${bv[1]}`;

  const av = value.match(AVID);
  if (av) return `av${av[1]}`;

  // 哔哩哔哩链接但没带 BV 号（短链）：原样提交，由现有无结果文案兜底。
  if (/^(https?:\/\/)?([\w-]+\.)*(bilibili\.com|b23\.tv)\//i.test(value))
    return value;

  return null;
}

/**
 * 解析哔哩哔哩视频链接，拿到视频号与 `?p=` 分 P。
 * 不是这类链接（含没有视频号的 b23.tv 短链——需先由调用方展开）返回 null。
 * 纯解析：点播那一侧的副作用在 `platforms/bilibiliLink`。
 */
