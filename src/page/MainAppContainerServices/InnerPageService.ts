// InnerPageService.ts
import { NetEasePlatform } from "../../platforms/NetEasePlatform";
import type { CollectionSegments } from "../../platforms/CollectionSegments";

/** 内页首屏（第 1 段）数据：与 `mediaData` 同形。 */
export interface InnerPageData {
  platformData: PlatformData[];
  totalPage: number;
}

/**
 * 容器交给服务的现场读写口：服务不持有 state、也不调 `setState`。
 * 详情回来时可能已经切模式或换掉内页，所以判断一律靠访问器当场求值，
 * 落地走容器给的两个 setter（当前现场 / 原模式快照）。
 */
export interface InnerPageHost {
  /** 内页每页条数（歌单 / 专辑固定 10 首一页）。 */
  readonly itemsPerPage: number;
  /** 发起时的模式：详情回来时可能已经切走。 */
  readonly originMode: number;
  /** 该模式当前票号：进出 / 换掉内页即递增，迟到的详情凭它作废。 */
  ticketOf(mode: number): number;
  /** 当前模式。 */
  currentMode(): number;
  /** 当前模式的内页是否还开着。 */
  isInnerPageOpen(): boolean;
  /** 加载器落到当前模式（与 state 同步，`activeSegments` 也换掉）。 */
  setSegments(segments: CollectionSegments, totalPage: number): void;
  /** 详情回来时已切到别的模式：落进原模式的现场快照，切回时原样恢复。 */
  setSnapshotSegments(
    mode: number,
    segments: CollectionSegments,
    totalPage: number,
  ): void;
}

export interface InnerPageLoad {
  /** 首屏数据：交给 `mediaData`。 */
  mediaData: Promise<InnerPageData>;
  /** 分段加载器（详情回来后才确定；作废 / 失败时为 null）。 */
  segments: Promise<CollectionSegments | null>;
}

/**
 * 网易云歌单 / 专辑内页的加载编排：先取完整 id 列表（得到分段加载器），
 * 记票与模式校验通过后落到现场，再取第 1 段作首屏。
 */
export class InnerPageService {
  static load(host: InnerPageHost, platformData: PlatformData): InnerPageLoad {
    const mode = host.originMode;
    const ticket = host.ticketOf(mode);
    // 只取歌单（专辑）详情得到完整 id 列表，首屏再取第 1 段
    const entry = platformData.neteaseMusic?.isSongList
      ? NetEasePlatform.getSongListMultiPageData
      : NetEasePlatform.getAlbumMultiPageData;

    const loaded = entry(platformData).then((segments) => {
      if (!segments) throw new Error("内页加载失败");
      // 换过内页（票号变了）或已经退出内页：迟到的详情丢弃，不落进任何现场
      if (
        ticket !== host.ticketOf(mode) ||
        (host.currentMode() === mode && !host.isInnerPageOpen())
      ) {
        segments.abort();
        throw new Error("内页已离开");
      }
      const totalPage = segments.totalPage(host.itemsPerPage);
      if (host.currentMode() === mode) host.setSegments(segments, totalPage);
      else host.setSnapshotSegments(mode, segments, totalPage);
      return { segments, totalPage };
    });

    // 第 1 段拼成首屏；失败交给结果区的「加载失败 / 重试」，
    // 换掉内页后被丢弃的那一份不算未处理
    const mediaData = loaded.then(async ({ segments, totalPage }) => ({
      platformData: await segments.loadPage(1, host.itemsPerPage),
      totalPage,
    }));
    mediaData.catch(() => {});

    return {
      mediaData,
      // 作废 / 失败就是没有加载器：错误本身由 `mediaData` 那条链交给结果区
      segments: loaded.then(
        ({ segments }) => segments,
        () => null,
      ),
    };
  }
}
