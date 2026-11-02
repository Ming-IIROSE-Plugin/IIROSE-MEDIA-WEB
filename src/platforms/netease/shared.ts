import { NeteaseMusicAPI } from "../../Api/NeteaseAPI/NeteaseMusic";
import type { AutoPlayOptions } from "../Platform";

/** 歌单 / 专辑详情里的曲目（两套端点返回同一形状的 song 对象，只取用到的字段）。 */
export interface CollectionTrack {
  id: number;
  name?: string;
  ar?: { name: string }[];
  /** 毫秒（song 对象上的 `dt` / `duration` 都是毫秒）。 */
  dt?: number;
  duration?: number;
}

/**
 * 点播发送选项。`cardless` 只由自动播放（收藏随机）传入：自动点播永不发卡片，
 * 卡片会抬高平台活跃度、容易被当作刷活跃度（CAP-2）；手动入口一律不传。
 */
export interface SendSongsOptions extends AutoPlayOptions {
  singleWindow?: boolean;
}

/**
 * 每批 100 个 id、同时进行的请求数：上万首要 100 批，串行要几分钟，并发 4 路约四分之一。
 * 批大小只有一处来源：API 层端点的上限 `NeteaseMusicAPI.CHUNK_SIZE`。
 */
export const DETAIL_CHUNK = NeteaseMusicAPI.CHUNK_SIZE;
export const DETAIL_CONCURRENCY = 4;

/** 批量身份键：`id:list` / `id:album`。标题会改名 / 截断，不能拿它当身份。 */
export const collectionKey = (id: number, isSongList: boolean): string =>
  `${id}:${isSongList ? "list" : "album"}`;

/**
 * 毫秒时长 → 安全毫秒数：残缺详情缺 `duration` 时是 `undefined`，`a / 1000`
 * 会得到 NaN，进 `mediaEvent` 的 JSON 后变成 `null`，房间进度条直接坏掉。
 * 非数值 / 非有限 / 负数一律按 0。
 */
export const millisOrZero = (ms: number | undefined): number =>
  typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : 0;

/** 等概率洗牌（Fisher–Yates）：`sort(() => Math.random() - 0.5)` 的分布不均。 */
export const shuffleIds = (ids: number[]): number[] => {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/**
 * 歌曲详情 → 结果区条目。字段一律可选读：一首残缺的歌抛错会让整段 100 首都加载失败；
 * 封面为空时 `Cover` 自动回退图标。
 */
export const songPlatformData = (item: SongDetailSong): PlatformData => ({
  title: item.name,
  subtitle: item?.transNames?.[0] || item.alias?.[0],
  coverImg: item.album?.picUrl || item.album?.blurPicUrl || "",
  author: item.artists?.[0]?.name ?? "",
  websiteUrl: `https://music.163.com/#/song?id=${item.id}`,
  duration: Math.ceil(millisOrZero(item.duration) / 1000),
  neteaseMusic: {
    id: item.id,
    fee: Number.isFinite(item.fee) ? item.fee : 0,
  },
});
