// 哔哩哔哩链接的纯解析：不依赖任何视图代码，供平台层的直点入口与搜索栏共用。
// 放在 platforms/ 是为了让 `platforms/bilibiliLink` 不必反向 import page。

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
