// mainAppContainerModes.ts
import { setPanelFocus } from "../playback/PanelFocus";
import type { CollectionSegments } from "../platforms/CollectionSegments";
import { SettingsService } from "./MainAppContainerServices/SettingsService";
import { MODE } from "./components/desk/deskModes";
import {
  emptyModeState,
  takeSnapshot,
  type ModeSnapshot,
} from "./mainAppContainerModel";
import type { MainAppController } from "./mainAppContainerController";

/**
 * 切模式向容器要的那一口：快照表与几个现场字段仍归容器持有，
 * 这里只做「快照 → 恢复 → 首个范围」的编排，落地一律走 `mergeState`。
 */
export interface MainAppModesHost {
  readonly state: MainAppContainerState;
  mergeState(
    patch: Partial<MainAppContainerState>,
    callback?: () => void,
  ): void;
  readonly props: MainAppContainerProps;
  /** 各模式现场快照；没有 = 该模式首次进入。 */
  readonly snapshots: Map<number, ModeSnapshot>;
  /** 切模式时待提交的关键词（粘贴视频链接要先切到视频模式）。 */
  pendingSearch: string | null;
  /** 内页的来源条目：重试时按它重新载入内页。 */
  innerPageSource: PlatformData | null;
  /** 当前模式内页的分段加载器（与 state 同步，但 setState 生效前也能拿到）。 */
  activeSegments: CollectionSegments | null;
  readonly controller: MainAppController;
  /** 当前模式的下标 → 分类表。 */
  getActiveCategories(mode?: number): Categories;
  /** 执行当前范围的动作（搜索/筛选/读取设置）。 */
  runCurrentScope(): void;
  /** 外部关键词能落在哪个模式：视频链接→视频，其余在音乐/视频里就地搜，其他模式回音乐。 */
  modeForKeyword(keyword: string): number;
}

/** 当前模式空现场的默认值：第一个来源的第一个范围。 */
function defaultModeState(host: MainAppModesHost, mode: number): ModeSnapshot {
  const item = host.getActiveCategories(mode).platform[0]?.subNavBarItems[0];
  return {
    ...emptyModeState(),
    currentSubNavBarAction: item?.searchAction ?? (() => {}),
  };
}

/**
 * 切模式：快照现场 → 恢复目标现场（无历史用默认）→ 首次进入时执行首个范围。
 * 设置页的数据是本地读取、且同步状态订阅随离开释放，所以每次回到设置页都重跑一次；
 * 收藏与音乐首屏同理：收藏要重新出现已取消收藏的行，首屏要反映最新的点播历史。
 */
export function applyMode(host: MainAppModesHost, next: number) {
  const previous = host.state.mode;
  if (previous === next) return;
  host.snapshots.set(previous, takeSnapshot(host.state));
  if (previous === MODE.settings) SettingsService.release();

  const snapshot = host.snapshots.get(next);
  const restored: ModeSnapshot = snapshot
    ? { ...snapshot, allMediaData: [...snapshot.allMediaData] }
    : defaultModeState(host, next);
  const pending = host.pendingSearch;
  host.pendingSearch = null;
  setPanelFocus({ category: next, platform: restored.PlatformIndex });
  host.innerPageSource = restored.innerCollection;
  // 加载器随现场走：切回来已取的段不重取（离开的模式的加载器留在快照里）
  host.activeSegments = restored.collectionSegments;

  host.mergeState(
    {
      mode: next,
      ...restored,
      updating: false,
      requestToken: host.state.requestToken + 1,
    },
    () => {
      // 待提交的关键词走完整提交：浏览型范围（视频「推荐」）会先落到可搜索的范围
      if (pending) host.controller.runSearch(pending, { propagate: false });
      else if (
        !snapshot ||
        next === MODE.settings ||
        // 收藏：取消收藏的行要重新出现；音乐首屏：反映最新的点播历史
        next === MODE.favorites ||
        (next === MODE.music && restored.searchKeyword.trim() === "")
      )
        host.runCurrentScope();
    },
  );
}

/** 全局关键词（聊天框 `@` 点歌、外部调用）：切到能承接它的模式再提交。 */
export function handleExternalKeyword(host: MainAppModesHost, keyword: string) {
  const target = host.modeForKeyword(keyword);
  if (target === host.state.mode) {
    host.controller.runSearch(keyword, { propagate: false });
    return;
  }
  host.pendingSearch = keyword;
  host.props.switchMode(target);
}
