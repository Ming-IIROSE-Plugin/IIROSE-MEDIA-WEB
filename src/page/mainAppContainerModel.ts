// mainAppContainerModel.ts
import type { CollectionSegments } from "../platforms/CollectionSegments";
import { SelectionService } from "./MainAppContainerServices/SelectionService";

/** 一次检索的结果（结果区自己解 Promise；这里是 `mediaData` 的形状）。 */
export type ModeMediaData = Promise<{
  platformData: PlatformData[];
  totalPage: number;
}> | null;

/** 一个模式的全部现场：切走时快照、切回时原样恢复（关键词、范围、页码、结果）。 */
export interface ModeSnapshot {
  searchKeyword: string;
  PlatformIndex: number;
  SubNavBarIndex: number;
  currentPage: number;
  totalPage: number;
  mediaData: ModeMediaData;
  allMediaData: PlatformData[];
  isCurrentInMultiPage: boolean;
  oldItems: OldItems | null;
  innerCollection: PlatformData | null;
  collectionSegments: CollectionSegments | null;
  innerSelection: InnerSelectionItem[];
  settingsData: SettingGroupData[] | null;
  currentSubNavBarAction: () => void;
  currentOnDemandPlay: (platformData: PlatformData) => void;
}

/** 空现场的字段（不取自任何模式）。 */
export function emptyModeState(): ModeSnapshot {
  return {
    searchKeyword: "",
    PlatformIndex: 0,
    SubNavBarIndex: 0,
    currentPage: 1,
    totalPage: 0,
    mediaData: null,
    allMediaData: [],
    isCurrentInMultiPage: false,
    oldItems: null,
    innerCollection: null,
    collectionSegments: null,
    innerSelection: SelectionService.clear(),
    settingsData: null,
    currentSubNavBarAction: () => {},
    currentOnDemandPlay: () => {},
  };
}

/** 当前现场的快照（切走一个模式时记下它，切回时恢复）。 */
export function takeSnapshot(state: MainAppContainerState): ModeSnapshot {
  return {
    searchKeyword: state.searchKeyword,
    PlatformIndex: state.PlatformIndex,
    SubNavBarIndex: state.SubNavBarIndex,
    currentPage: state.currentPage,
    totalPage: state.totalPage,
    mediaData: state.mediaData,
    // 复制一份：分页缓存后续会被追加，快照不能与当前现场共享同一数组
    allMediaData: [...state.allMediaData],
    isCurrentInMultiPage: state.isCurrentInMultiPage,
    oldItems: state.oldItems,
    innerCollection: state.innerCollection,
    collectionSegments: state.collectionSegments,
    innerSelection: state.innerSelection,
    settingsData: state.settingsData,
    currentSubNavBarAction: state.currentSubNavBarAction,
    currentOnDemandPlay: state.currentOnDemandPlay,
  };
}
