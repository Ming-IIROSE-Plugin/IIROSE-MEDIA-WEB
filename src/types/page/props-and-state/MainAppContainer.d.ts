interface MainAppContainerProps {
  /** 当前模式：0 音乐 1 视频 2 电台 3 收藏 4 设置 5 关于。 */
  mode: number;
  /** 由容器发起的模式切换（粘贴视频链接先切到视频模式）。 */
  switchMode: (mode: number) => void;
  searchKeyword: string;
  active: boolean;
  changeSearchKeyword: (keyword: string | null) => void;
  ShowOrHideIMC: () => Promise<void>;
}

interface MainAppContainerState {
  mode: number;
  PlatformIndex: number;
  searchKeyword: string;
  searchViewMode: "card" | "list";
  SubNavBarIndex: number;
  mediaData: Promise<{
    platformData: PlatformData[];
    totalPage: number;
  }> | null;
  allMediaData: PlatformData[];
  currentPage: number;
  updating: boolean;
  totalPage: number;
  oldItems: OldItems | null;
  /** 内页来源（专辑 / 歌单）：内页头显示名称、曲目数与「全部播放」。 */
  innerCollection: PlatformData | null;
  /** 设置 / 关于：一组一张卡（`SettingGroupData.title` 是组卡标题）。 */
  settingsData: SettingGroupData[] | null;
  isCurrentInMultiPage: boolean;
  requestToken: number;
  currentSubNavBarAction: () => void;
  currentOnDemandPlay: (platformData: PlatformData) => void;
}

interface MainAppContainerActionContext {
  getState: () => MainAppContainerState;
  setState: (state: Partial<MainAppContainerState>) => void;
  // 如果需要调用其他控制器方法
  pushAllData: (token: number, data: PlatformData[], total: number) => void;
}

interface BilibiliActionContext extends MainAppContainerActionContext {
  getRefreshCount: () => number;
  incrementRefreshCount: () => void;
}
