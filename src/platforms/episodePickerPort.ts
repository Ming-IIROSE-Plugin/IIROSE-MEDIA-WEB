// 选集面板的「端口」：平台层只依赖这里，不 import 视图层。
//
// 背景：`BilibiliPlatform.VOD`、`NetEasePlatform.MLOD/AOD`、`AllVideosPlatform.VOD`
// 都要在点播前弹出选集面板，而面板实现活在 `page/components/episode-picker`。
// 平台层直接 import 它会形成 `platforms → page` 的反向依赖。这里把「打开面板」
// 抽象成一个可注册的能力：视图层启动时注册实现，平台层只调 `openEpisodePicker`。
//
// 类型也放在这一侧：`EpisodePickEntry` 是平台层构造的数据形状，视图层从本模块引入。

/** 一条可选分集：id 由调用方保证在本次列表内唯一。 */
export interface EpisodePickEntry {
  id: string;
  title: string;
  /** 副行（B 站 / 多源留空，网易云放歌手）。 */
  meta?: string;
  /** 时长（秒）；缺省不渲染等宽时长。 */
  duration?: number;
}

export type EpisodePickOrder = "asc" | "shuffle";

export interface OpenEpisodePickerOptions {
  /** 数量单位：视频 / 剧集「集」、网易云曲目「首」。 */
  unit: string;
  /** 打开后取分集；失败留在面板里可重试（不点播）。 */
  load: () => Promise<EpisodePickEntry[]>;
  /**
   * 列表出来后的后台补充（如网易云大歌单的歌名）：`patch` 按 id 合并标题 / 副行 / 时长并刷新，
   * `progress` 报进度；面板关闭（取消、确认、卸载）时 `signal` 触发中止，别再请求。
   * 已点选的项不受影响（id 不变）。
   */
  enrich?: (
    entries: readonly EpisodePickEntry[],
    api: {
      patch: (changes: Map<string, Partial<EpisodePickEntry>>) => void;
      progress: (done: number, total: number) => void;
      signal: AbortSignal;
    },
  ) => Promise<void>;
  /** 确认：按播放顺序排好的条目（正序 = 点选顺序，乱序 = 随机置换）。 */
  onConfirm: (entries: EpisodePickEntry[]) => void;
  onCancel?: () => void;
  /** 关闭后焦点交还的元素；缺省为打开时的焦点元素。 */
  returnFocus?: HTMLElement | null;
}

export type EpisodePickerOpener = (options: OpenEpisodePickerOptions) => void;

let opener: EpisodePickerOpener | null = null;

/** 由视图层在模块加载时调用：把真正的面板实现接上。 */
export function setEpisodePickerOpener(next: EpisodePickerOpener): void {
  opener = next;
}

/**
 * 打开选集面板。视图层尚未注册时抛错——平台层的调用都发生在用户交互之后，
 * 那时页面早已初始化，静默 no-op 只会把「面板没弹出来」伪装成正常流程。
 */
export function openEpisodePicker(options: OpenEpisodePickerOptions): void {
  if (!opener) throw new Error("选集面板尚未注册");
  opener(options);
}
