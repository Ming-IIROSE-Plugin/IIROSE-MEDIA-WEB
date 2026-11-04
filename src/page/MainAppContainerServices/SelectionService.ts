// SelectionService.ts
import { requestKey as requestGuardKey } from "../../playback/RequestGuard";

/**
 * 内页勾选所在的那份现场：容器当前 state 与模式快照都满足这一形状，
 * 于是「这次发出的几首该从哪儿去掉」对两边是同一份逻辑。
 */
export interface InnerSelectionHolder {
  innerCollection: PlatformData | null;
  innerSelection: InnerSelectionItem[];
}

/**
 * 内页（网易云歌单 / 专辑）多选的纯逻辑：勾选按绝对位置记，
 * 序号即数组下标（取消中间一项，后面的自然前移）；同一首歌重复出现时各自可选。
 * 状态仍归容器持有，这里只做数组变换。
 */
export class SelectionService {
  /** 这一行能不能勾：发送要靠网易云曲目 id，没有 id 的行不可选。 */
  static canSelect(platformData: PlatformData): boolean {
    return platformData.neteaseMusic?.id !== undefined;
  }

  /** 这个绝对位置是否已被勾选。 */
  static hasPosition(
    selection: InnerSelectionItem[],
    position: number,
  ): boolean {
    return selection.some((item) => item.position === position);
  }

  /** 勾选序号（1 起）；没勾选返回 undefined。 */
  static orderOf(
    selection: InnerSelectionItem[],
    position: number,
  ): number | undefined {
    const at = selection.findIndex((item) => item.position === position);
    return at === -1 ? undefined : at + 1;
  }

  /**
   * 勾 / 取消一首：已勾选的位置再点即取消，否则按点选顺序追加到末尾。
   * 没有网易云曲目 id 的行原样返回（调用方可据此跳过 `setState`）。
   */
  static toggle(
    selection: InnerSelectionItem[],
    position: number,
    platformData: PlatformData,
  ): InnerSelectionItem[] {
    const id = platformData.neteaseMusic?.id;
    if (id === undefined) return selection;
    if (this.hasPosition(selection, position))
      return selection.filter((item) => item.position !== position);
    return [...selection, { position, id, title: platformData.title }];
  }

  /** 清空勾选（离开内页 / 新搜索 / 换来源 / 换范围都走它）。 */
  static clear(): InnerSelectionItem[] {
    return [];
  }

  /** 待发送的曲目 id，按点选顺序。 */
  static ids(selection: InnerSelectionItem[]): number[] {
    return selection.map((item) => item.id);
  }

  /**
   * 发送成功后的收尾：只去掉这次发出的几首（等待期间新勾的保留）；
   * 期间已换到别的内页就不动——那些勾选属于原来那张列表。
   */
  static afterSend(
    sent: InnerSelectionItem[],
    current: InnerSelectionHolder,
    collection: PlatformData,
  ): InnerSelectionItem[] {
    if (current.innerCollection !== collection) return current.innerSelection;
    // 位置 + 曲目 id 一起比：等待期间在同一位置改勾了别的歌，不能被这次收尾带走。
    const sentKeys = new Set(sent.map((item) => `${item.position}:${item.id}`));
    return current.innerSelection.filter(
      (item) => !sentKeys.has(`${item.position}:${item.id}`),
    );
  }

  /** 「点播所选」的守卫键：与整张「全部播放」的 `:all` 各自独立。 */
  static requestKey(collection: PlatformData): string {
    return `${requestGuardKey(collection)}:selected`;
  }
}
