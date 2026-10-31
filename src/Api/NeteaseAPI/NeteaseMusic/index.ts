import { SendFetch } from "../../index";
import { d } from "../Crypto";

export class NeteaseMusicAPI extends SendFetch {
  /**
   * 直接访问网易云音乐的接口获取歌单详情
   * @param id
   * @returns
   */
  public static async getSongListDetail(id: number) {
    const url = `https://music.163.com/api/v6/playlist/detail`;
    const params = new URLSearchParams({
      id: id.toString(),
      n: "100000",
      s: "8",
    });
    const data: SongList | null = await this.neteaseRequest(url, params, "GET");
    if (data && data.code === 200) {
      return data;
    } else {
      return null;
    }
  }

  public static async getAlbumDetail(id: number) {
    const url = `https://music.163.com/weapi/v1/album/${id}`;
    const params = {
      csrf_token: "",
    };

    const we = await d(params);
    const enc = {
      params: we.encText,
      encSecKey: we.encSecKey,
    };
    const encparams = new URLSearchParams(enc);

    const data: AlbumData | null = await this.neteaseRequest(
      url,
      encparams,
      "POST",
    );

    if (data && data.code === 200) {
      return data;
    } else {
      return null;
    }
  }

  /**
   * 直接访问网易云音乐的接口获取歌曲详情
   * @param id
   * @param signal 中止后不再请求后续分段，飞行中的请求返回 null
   * @returns
   */
  public static async getNeteaseSongDetail(
    ids: number[],
    signal?: AbortSignal,
  ): Promise<SongDetailSong[] | null> {
    // 端点每次最多收 100 个 id；sendSongs / fetchSongDetailsPooled 已按
    // NetEasePlatform.DETAIL_CHUNK = 100 分段，这里只兜底其它调用点
    const CHUNK_SIZE = 100;
    const allSongs: SongDetailSong[] = []; // 用于存储所有的 songs

    // 将 ids 数组拆分为多个子数组
    const chunks = this.chunkArray(ids, CHUNK_SIZE);

    try {
      // 逐个请求每个子数组
      for (const chunk of chunks) {
        if (signal?.aborted) return null;
        const params = new URLSearchParams({
          ids: `[${chunk.toString()}]`,
        });

        const data: SongDetail | null = await this.neteaseRequest(
          "https://music.163.com/api/song/detail",
          params,
          "GET",
          undefined,
          signal,
        );

        if (data && data.code === 200) {
          if (data.songs) {
            // 将当前请求的 songs 合并到最终结果中
            allSongs.push(...data.songs);
          } else {
            console.error("获取歌曲详情失败");
            return null;
          }
        } else {
          return null;
        }
      }

      return allSongs;
    } catch (error) {
      console.error("Error fetching song details", error);
      return null;
    }
  }

  public static async getNeteaseMVDetail(id: number) {
    const url = `https://music.163.com/weapi/v1/mv/detail`;
    const params = {
      id: id.toString(),
      csrf_token: "",
    };

    const headers = new Headers();
    const we = await d(params);
    const enc = {
      params: we.encText,
      encSecKey: we.encSecKey,
    };

    const encparams = new URLSearchParams(enc);

    headers.append("content-type", "application/x-www-form-urlencoded");

    const data: MVDetail | null = await this.neteaseRequest(
      url,
      encparams,
      "POST",
      headers,
    );

    if (data && data.code === 200) {
      return data;
    } else {
      return null;
    }
  }

  // 拆分数组的辅助函数
  private static chunkArray(array: number[], size: number): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  public static async getSongResourceFromIARC(url: string) {
    const response = await this.sendHead(
      url,
      new URLSearchParams(),
      new Headers(),
      false,
      false,
    );
    if (response && response.ok) {
      const redirect = response.headers.get("x-final-url");
      return redirect;
    } else {
      return null;
    }
  }

  public static async getLyric(id: number, signal?: AbortSignal) {
    const url = `https://music.163.com/api/song/lyric`;
    const params = new URLSearchParams({
      id: id.toString(),
      tv: "-1",
      lv: "-1",
      kv: "-1",
      rv: "-1",
    });

    const headers = new Headers();

    const lyric: Lyric | null = await this.neteaseRequest(
      url,
      params,
      "GET",
      headers,
      signal,
    );

    if (lyric && lyric.code === 200) {
      return lyric;
    } else {
      return null;
    }
  }

  public static async getMVPlayURL(id: number) {
    const url = `https://music.163.com/weapi/song/enhance/play/mv/url`;
    const params = {
      id: id,
      r: 1080,
      csrf_token: "",
    };

    const headers = new Headers();
    const we = await d(params);
    const enc = {
      params: we.encText,
      encSecKey: we.encSecKey,
    };

    const encparams = new URLSearchParams(enc);

    headers.append("content-type", "application/x-www-form-urlencoded");

    const data: MVPlayURLData | null = await this.neteaseRequest(
      url,
      encparams,
      "POST",
      headers,
    );

    if (data && data.code === 200) {
      return data;
    } else {
      return null;
    }
  }
}
