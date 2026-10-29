import { Component } from "preact";
import { DeskNavigation } from "./components/desk/DeskNavigation";
import { MainAppContainer } from "./MainAppContainer";
import { setPanelFocus } from "../playback/PanelFocus";
import { LocalStorageUtils } from "../settings/localStorageUtils/LocalStorageUtils";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import { normalizeMode } from "./components/desk/deskModes";
import { deskInk, deskPaper } from "./components/floating-panel/tokens";

interface MainAppState {
  mode: number;
}

interface MainAppProps {
  ShowHideMainApp: () => Promise<void>;
  searchKeyword: string;
  changeSearchKeyword: (keyword: string | null) => void;
  mainAppDisplay: boolean;
}

export class MainApp extends Component<MainAppProps, MainAppState> {
  constructor(props: MainAppProps) {
    super(props);
    LocalStorageUtils.Init();
    this.state = {
      // 首次打开进入「插件启动默认页面」指定的模式（非法值回退音乐）
      mode: normalizeMode(PluginSettings.getPluginSetting().defaultPage),
    };
  }

  itemsPerPage = 10;

  componentDidMount(): void {
    setPanelFocus({ category: this.state.mode, platform: 0 });
  }

  render() {
    const { mode } = this.state;
    const { searchKeyword, mainAppDisplay, changeSearchKeyword } = this.props;
    return (
      <div
        className={`flex h-full w-full max-[768px]:flex-col ${deskPaper} ${deskInk}`}
        id="IIROSE_MEDIA"
      >
        <DeskNavigation mode={mode} onSelectMode={this.switchMode} />
        <MainAppContainer
          mode={mode}
          switchMode={this.switchMode}
          ShowOrHideIMC={this.props.ShowHideMainApp}
          searchKeyword={searchKeyword}
          changeSearchKeyword={changeSearchKeyword}
          active={mainAppDisplay}
        />
      </div>
    );
  }

  /**
   * @param index 0 音乐 1 视频 2 电台 3 收藏 4 设置 5 关于
   */
  protected switchMode = async (index: number) => {
    const mode = normalizeMode(index);
    if (mode === this.state.mode) return;
    await this.setState({ mode });
    // 平台下标由 MainAppContainer 按各模式的现场快照写回
  };
}
