import { NeteaseMusicAPI } from "../../Api/NeteaseAPI/NeteaseMusic";
import type { BatchHandle } from "../../playback/BatchProgress";
import { ShowMessage } from "../../iirose_func/ShowMessage";
import { reportFailure } from "../../tools/reportFailure";
import { Socket } from "../../iirose_func/Socket";
import {
  Announce,
  type BatchSendOutcome,
} from "../../iirose_func/Socket/Announce";
import { Media } from "../../iirose_func/Socket/Media";
import { mergeLyrics } from "./lyrics";
import { DETAIL_CHUNK, millisOrZero, type SendSongsOptions } from "./shared";

/**
 * 边取边发并返回 `{ sent, reason }`：`sent` 不含无版权跳过与单项失败，
 * `reason` 区分「跑完了」「用户停止」「请求失败」——只有后两者该向房间校正。
 * 停止优先于失败：先点了停止、随后的请求因 abort 返回 null，算 stopped。
 */
export const sendSongs = async (
  songsID: number[],
  batch: BatchHandle | undefined,
  options: SendSongsOptions | undefined,
  baseHex: string,
): Promise<BatchSendOutcome> => {
  const media = new Media();
  const socket = new Socket();
  const signal = batch?.signal;
  const size = DETAIL_CHUNK;

  // 无版权曲目按批聚合计数：循环结束统一提示一次，不逐曲刷屏
  let noCopyrightSkipped = 0;
  // 预计条数：取不到详情的逐段扣掉；段失败时校正为已处理数
  let total = songsID.length;
  let processed = 0;
  let sent = 0;
  // 非中止的段失败（详情返回 null）：结束原因报 failed，没跑完不能说「跑完了」
  let failed = false;

  // 边取边发：每 100 首取一段详情就发这一段，大歌单不必等全部详情
  for (let at = 0; at < songsID.length; at += size) {
    if (batch?.cancelled) break;
    const chunk = songsID.slice(at, at + size);
    const details = await NeteaseMusicAPI.getNeteaseSongDetail(chunk, signal);
    if (batch?.cancelled) break;
    if (!details) {
      // 非中止的失败：提示已由 neteaseRequest 发出，已发的保留，后续段不再取
      batch?.setTotal(processed);
      failed = true;
      break;
    }

    // 按入参顺序重排（正序 / 乱序 / 点选顺序），接口返回顺序不可信
    const songMap = new Map(details.map((s) => [s.id, s]));
    const orderedSongs = chunk
      .map((id) => songMap.get(id))
      .filter((s): s is SongDetailSong => Boolean(s));
    total -= chunk.length - orderedSongs.length;
    batch?.setTotal(total);

    for (const item of orderedSongs) {
      if (batch?.cancelled) break;
      processed++;
      if (item.noCopyrightRcmd) {
        noCopyrightSkipped++;
        batch?.step();
        continue;
      }
      try {
        let playUrl = "";
        // playUrl = `https://v.iarc.top/?type=url&id=${item.id}#.mp3`;
        playUrl = `https://1309510434-1fsutl4dzp.ap-hongkong.tencentscf.com/musicstreamlink/?platform=netease&id=${item.id}&quality=320&vip=${Number.isFinite(item.fee) ? item.fee : 0}#.mp3`;
        //playUrl = `https://1309510434-k3dderqeb9.ap-guangzhou.tencentscf.com/musicstreamlink/?platform=netease&id=${item.id}&quality=320&vip=${item.fee}#.mp3`;
        const lyrdata = await NeteaseMusicAPI.getLyric(item.id, signal);

        let lyric = ``;

        if (lyrdata && lyrdata.lrc && lyrdata.tlyric) {
          lyric = mergeLyrics(lyrdata.lrc.lyric, lyrdata.tlyric.lyric);
        } else if (lyrdata && lyrdata.lrc) {
          lyric = lyrdata.lrc.lyric;
        }
        const mediaData: MediaData = {
          type: "music",
          name: item.name,
          // 残缺详情（无歌手 / 专辑）照发，不让单曲抛错
          singer: item.artists?.[0]?.name ?? "",
          cover: item.album?.picUrl ?? "",
          link: `https://music.163.com/#/song?id=${item.id}`,
          url: playUrl,
          // 残缺详情缺 duration：不能落成 NaN（报文里会变 null，房间进度条坏掉）
          duration: millisOrZero(item.duration) / 1000,
          bitRate: 320,
          color: baseHex,
          lyrics: lyric,
          origin: "netease",
        };

        const mediacard = media.mediaCard(mediaData);
        const mediaEvent = media.mediaEvent(mediaData);

        // 取歌词期间用户点了「停止」：这一首也不再发
        if (batch?.cancelled) break;
        if (options?.cardless) {
          // 自动播放（收藏随机）只发播放报文：卡片会抬高平台活跃度（CAP-2）
          socket.send(mediaEvent);
        } else if (options?.singleWindow) {
          // 单曲窗口只包发卡片这一小段：包住整段点播会让并行批量的逐卡发送
          // 在整段网络请求期间一并放行（批量总结档下会漏出成批卡片）
          await Announce.runSingleAnnounce(() => {
            Announce.sendMediaCard(socket, mediacard);
            socket.send(mediaEvent);
          });
        } else {
          Announce.sendMediaCard(socket, mediacard);
          socket.send(mediaEvent);
        }
        sent++;
      } catch (error) {
        // 单项失败：带曲名提示（同因 10 秒去重）后跳过，剩余曲目照播
        Announce.showBatchItemError(error, item.name);
      }
      batch?.step();
    }
  }

  // 用户停止后不再弹任何提示
  if (noCopyrightSkipped > 0 && !batch?.cancelled) {
    ShowMessage.show(`已跳过 ${noCopyrightSkipped} 首无版权曲目`);
  }
  // 停止优先于失败：先点停止、随后的详情请求因 abort 返回 null，算 stopped
  const reason: BatchSendOutcome["reason"] = batch?.cancelled
    ? "stopped"
    : failed
      ? "failed"
      : "completed";
  return { sent, reason };
};

/** MV 点播：取播放地址后发卡片 + 播放报文（单曲窗口只包发卡片这一段）。 */
export const sendMv = async (platformData: PlatformData, baseHex: string) => {
  try {
    if (!platformData.neteaseMusic || !platformData.duration)
      throw new Error("没有网易云音乐数据");

    // const xcAPI = window.netease?.xcAPI
    // let xcRes: xcSongResource | null = null
    const id = platformData.neteaseMusic.id;

    const res = await NeteaseMusicAPI.getMVPlayURL(id);

    // 请求层失败已提示过；`res.data` 为空才是内容侧失败，仍按原文案提示
    if (!res) return;
    if (!res.data) throw new Error("获取MV资源失败");

    if (res.data.msg) throw new Error(res.data.msg);

    const playUrl = res.data.url;

    const media = new Media();

    const mediaData: MediaData = {
      type: "video",
      name: platformData.title,
      singer: platformData.author,
      cover: await platformData.coverImg,
      link: platformData.websiteUrl,
      url: playUrl,
      duration: platformData.duration,
      bitRate: 1080,
      color: baseHex,
      origin: "netEaseMV",
    };

    const mediacard = media.mediaCard(mediaData);

    const mediaEvent = media.mediaEvent(mediaData);

    const socket = new Socket();

    // 手动单曲点播：包单曲窗口，卡片不被并行批量抑制吞掉
    await Announce.runSingleAnnounce(async () => {
      Announce.sendMediaCard(socket, mediacard);
      socket.send(mediaEvent);
    });
  } catch (error) {
    reportFailure(error);
  }
};
