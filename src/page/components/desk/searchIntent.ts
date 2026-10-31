// 搜索栏的粘贴识别：BV 号 / av 号 / 哔哩哔哩链接一律按「视频目标」处理。
// 只做纯文本判定，不发请求（真实搜索仍走 BilibiliService 的现有链路）。

// 两侧要词边界：`xxabv1234567890yy` 这类普通文本不该被当成 BV 号抢走粘贴。
const BVID = /\bbv([0-9a-z]{10})\b/i;
const AVID = /\bav(\d{1,12})\b/i;

const BILIBILI_HOST = /(^|\.)bilibili\.com$/i;
const SHORT_HOST = "b23.tv";
const VIDEO_ID = /(BV[a-zA-Z0-9]+|av\d+)/i;

/** 哔哩哔哩视频链接的解析结果。 */
export interface BilibiliLinkTarget {
  /** 链接里的 BV / av 号（原样，不做大小写归一）。 */
  videoId: string;
  /** `?p=N` 指定的分 P；没带或非法时为 undefined。 */
  targetP?: number;
  /** 解析后的 URL（拼回提示文案 / 传参用）。 */
  url: URL;
}

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
export function parseBilibiliLink(text: string): BilibiliLinkTarget | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (!BILIBILI_HOST.test(hostname) && hostname !== SHORT_HOST) return null;

  const match = url.href.match(VIDEO_ID);
  if (!match) return null;

  // BV 前缀大小写归一（后面的 id 区分大小写，保持原样）：与搜索词识别的口径一致
  const videoId = /^bv/i.test(match[1]) ? `BV${match[1].slice(2)}` : match[1];

  const rawPage = url.searchParams.get("p");
  const page = rawPage === null ? NaN : parseInt(rawPage, 10);

  return {
    videoId,
    targetP: Number.isFinite(page) && page > 0 ? page : undefined,
    url,
  };
}

/** 提交前统一收口：去首尾空白，空串返回 null。 */
export function normalizeKeyword(text: string): string | null {
  const value = text.trim();
  return value ? value : null;
}
