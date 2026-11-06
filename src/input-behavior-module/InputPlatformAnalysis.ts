import { playBilibiliLink } from "../platforms/bilibiliLink";
import { NetEasePlatform } from "../platforms/NetEasePlatform";
import { UrlExtractor } from "../tools/UrlExtractor";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { Announce } from "../iirose_func/Socket/Announce";
import { Media } from "../iirose_func/Socket/Media";
import { Socket } from "../iirose_func/Socket";
import { isPanelOpen } from "../listener/panelPresence";

export class InputPlatformAnalysis {
  /**
   * 输入框 @ 指令解析与分发主入口
   */
  public static async Analysis(
    e: string,
    originalMethod: Function,
    t?: any,
    changeSearchKeyword?: (keyword: string | null) => void,
    ShowOrHideIMC?: () => Promise<void>,
  ): Promise<any> {
    try {
      // 1. 尝试从输入文本中提取 URL
      const extracted = UrlExtractor.extract(e);

      // 2. 若未提取到任何 URL，判定为纯文本 @ 搜索指令
      if (!extracted) {
        const keyword = e.slice(1).trim();
        if (keyword) {
          // 窗口开着时聊天框也能发 `@`：切换函数会把它关掉，只搜索不切换
          if (ShowOrHideIMC && !isPanelOpen()) {
            await ShowOrHideIMC();
          }
          if (changeSearchKeyword) {
            changeSearchKeyword(keyword);
          }
        }
        return;
      }

      // 3. 提取到 URL，先追踪解析可能的短链（163cn.tv, b23.tv）
      const resolvedUrl = await UrlExtractor.resolveShortUrl(extracted.url);

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(resolvedUrl);
      } catch {
        return originalMethod(e, t);
      }

      const hostname = parsedUrl.hostname.toLowerCase();

      // 4. 网易云音乐平台链接处理
      if (
        hostname === "music.163.com" ||
        hostname === "y.music.163.com" ||
        hostname.endsWith(".163.com") ||
        hostname === "163cn.tv"
      ) {
        const neteaseResult = this.parseNetEaseUrl(parsedUrl);
        if (neteaseResult) {
          const { type, id } = neteaseResult;
          const platformData = await NetEasePlatform.getNeteasePlatformData(
            [id],
            type,
          );
          if (platformData && platformData[0]) {
            const data = platformData[0];
            if (type === "song") {
              NetEasePlatform.MOD(data);
            } else if (type === "playlist") {
              NetEasePlatform.MLOD(data);
            } else if (type === "album") {
              NetEasePlatform.AOD(data);
            } else if (type === "mv") {
              NetEasePlatform.MVOD(data);
            }
          }
          return;
        }
      }

      // 5. 哔哩哔哩平台链接处理（取详情、`?p=` 分 P 直达在 platforms/bilibiliLink 共用）
      if (hostname.includes("bilibili.com") || hostname === "b23.tv") {
        if (await playBilibiliLink(resolvedUrl)) return;
      }

      // 6. 直链媒体探测与处理（支持扩展名及无扩展名探测，限制 8 秒超时）
      const probeResult = await UrlExtractor.probeDirectMedia(
        resolvedUrl,
        8000,
      );

      if (probeResult.timedOut) {
        ShowMessage.show("直链媒体探测超时，请检查链接有效性");
        return;
      }

      if (probeResult.isMedia) {
        const filename = UrlExtractor.getFilenameFromUrl(resolvedUrl);
        const title = extracted.titleHint || filename;
        const cover = "https://r.iirose.com/i/26/3/6/4/5918-8B.png";

        const mediaData: MediaData = {
          type: probeResult.type || "music",
          name: title,
          singer: "直链播放",
          cover: cover,
          link: resolvedUrl,
          url: resolvedUrl,
          duration: probeResult.duration || 0,
          bitRate: 128,
          color: "#1e88e5",
          origin: probeResult.type === "video" ? "video" : null,
        };

        const media = new Media();
        const socket = new Socket();
        // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
        await Announce.runSingleAnnounce(async () => {
          Announce.sendMediaCard(socket, media.mediaCard(mediaData));
          socket.send(media.mediaEvent(mediaData));
        });
        return;
      }

      // 7. 非媒体链接或探测失败：透传放行至宿站原生逻辑
      return originalMethod(e, t);
    } catch (error) {
      console.error("[InputPlatformAnalysis Error]:", error);
      // 异常兜底放行
      return originalMethod(e, t);
    }
  }

  /**
   * 从网易云 URL 解析资源类型 (song / playlist / album / mv) 与 ID
   */
  private static parseNetEaseUrl(
    url: URL,
  ): { type: "song" | "playlist" | "album" | "mv"; id: number } | null {
    const hash = url.hash;
    const pathname = url.pathname;
    const searchParams = url.searchParams;

    let type: "song" | "playlist" | "album" | "mv" | null = null;
    let idStr: string | null = null;

    // 1. 优先解析 Hash 路由 (如 #/song?id=22770026 或 #/my/m/music/playlist?id=...)
    if (hash) {
      const [hashPath, hashQuery] = hash.split("?");
      if (hashPath.includes("song")) type = "song";
      else if (hashPath.includes("playlist") || hashPath.includes("toplist"))
        type = "playlist";
      else if (hashPath.includes("album")) type = "album";
      else if (hashPath.includes("mv")) type = "mv";

      if (hashQuery) {
        const params = new URLSearchParams(hashQuery);
        idStr = params.get("id");
      } else {
        const pathMatch = hashPath.match(/\/(song|playlist|album|mv)\/(\d+)/i);
        if (pathMatch) {
          type = pathMatch[1].toLowerCase() as any;
          idStr = pathMatch[2];
        }
      }
    }

    // 2. 解析 Query 参数与 Path (如 /song?id=22770026 或 /m/playlist?id=8735850242)
    if (!idStr) {
      if (pathname.includes("/song")) type = "song";
      else if (pathname.includes("/playlist") || pathname.includes("/toplist"))
        type = "playlist";
      else if (pathname.includes("/album")) type = "album";
      else if (pathname.includes("/mv")) type = "mv";

      idStr = searchParams.get("id");

      // 3. 解析路径内嵌 ID (如 /album/251795697)
      if (!idStr) {
        const pathNumMatch = pathname.match(
          /\/(song|playlist|album|mv)\/(\d+)/i,
        );
        if (pathNumMatch) {
          type = pathNumMatch[1].toLowerCase() as any;
          idStr = pathNumMatch[2];
        }
      }
    }

    if (type && idStr) {
      const id = parseInt(idStr, 10);
      if (!isNaN(id) && id > 0) {
        return { type, id };
      }
    }

    return null;
  }
}
