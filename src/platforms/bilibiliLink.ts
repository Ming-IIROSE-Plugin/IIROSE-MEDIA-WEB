// 哔哩哔哩链接直点：聊天输入框的链接拦截（`InputPlatformAnalysis`）与
// 搜索栏粘贴的「带 `?p=` 的分 P 链接」共用这一份实现，不要在任一处另写一遍。
// 链接的纯解析在同目录的 `bilibiliLinkParse`（视图层的 `searchIntent` 只是再导出）。

import { BilibiliPlatform } from "./BilibiliPlatform";
import { parseBilibiliLink } from "./bilibiliLinkParse";

export interface BilibiliLinkPlayOptions {
  /** 只接管带 `?p=N` 的链接（搜索栏：不带分 P 的链接仍按搜索词提交）。 */
  requirePage?: boolean;
}

/**
 * 按链接点播哔哩哔哩视频，返回「是否已处理」：
 * - `false`：不是哔哩哔哩视频链接（或 `requirePage` 下没带分 P），调用方照原样继续；
 * - `true`：已接管。取详情失败也算接管——失败提示由平台层 `ShowMessage` 弹出，
 *   不要再把链接退化成搜索词 / 直链探测。
 */
export async function playBilibiliLink(
  url: string,
  options: BilibiliLinkPlayOptions = {},
): Promise<boolean> {
  const link = parseBilibiliLink(url);
  if (!link) return false;

  const { videoId, targetP } = link;
  if (options.requirePage && !targetP) return false;

  const detail = await BilibiliPlatform.getBilibiliVideoDetail(videoId);
  if (!detail) return true;

  const isMulti = !!detail.pages && detail.pages.length > 1;
  const platformData: PlatformData = {
    title: detail.title,
    coverImg: detail.pic,
    author: detail.owner?.name || "bilibili",
    websiteUrl: `https://www.bilibili.com/video/${detail.bvid}${
      targetP ? `?p=${targetP}` : ""
    }`,
    duration: detail.duration,
    bilibili: {
      aid: detail.aid,
      bvid: detail.bvid,
      cid: detail.cid,
    },
    multiPage: isMulti ? Promise.resolve({ platform: "bilibili" }) : undefined,
  };

  await BilibiliPlatform.VOD(platformData, targetP);
  return true;
}
