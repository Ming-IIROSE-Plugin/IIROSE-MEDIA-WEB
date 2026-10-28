import { Component } from "preact";
import { MainNavigationBar } from "./components/navigationBar/main/MainNavigationBar";
import { MainAppContainer } from "./MainAppContainer";
import { setPanelFocus } from "../playback/PanelFocus";
import { LocalStorageUtils } from "../settings/localStorageUtils/LocalStorageUtils";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import { themedSurface } from "./components/floating-panel/floatingPanel";

interface MainAppState {
  CategoriesIndex: number;
  needOutFromMultiPage: boolean;
  needOutFromSettings: boolean;
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
      CategoriesIndex: PluginSettings.getPluginSetting().defaultPage,
      needOutFromMultiPage: false,
      needOutFromSettings: false,
    };
  }

  itemsPerPage = 10;

  componentDidMount(): void {
    setPanelFocus({ category: this.state.CategoriesIndex, platform: 0 });
  }

  componentDidUpdate(
    _prevProps: Readonly<MainAppProps>,
    prevState: Readonly<MainAppState>,
  ): void {
    const { needOutFromMultiPage, CategoriesIndex } = this.state;
    if (CategoriesIndex !== prevState.CategoriesIndex) {
      this.setState({ needOutFromMultiPage: true });
    } else if (needOutFromMultiPage) {
      this.setState({ needOutFromMultiPage: false });
    }
  }

  render() {
    const { CategoriesIndex, needOutFromMultiPage, needOutFromSettings } =
      this.state;
    const { searchKeyword, mainAppDisplay, changeSearchKeyword } = this.props;
    return (
      <div
        className={`flex flex-col w-full h-full ${themedSurface}`}
        id="IIROSE_MEDIA"
      >
        <MainNavigationBar
          switchCategories={this.switchCategories}
          ShowHideMainApp={this.props.ShowHideMainApp}
          activeButtonIndex={CategoriesIndex}
        />
        <MainAppContainer
          CategoriesIndex={CategoriesIndex}
          needOutFromMultiPage={needOutFromMultiPage}
          needOutFromSettings={needOutFromSettings}
          ShowOrHideIMC={this.props.ShowHideMainApp}
          searchKeyword={searchKeyword}
          changeSearchKeyword={changeSearchKeyword}
          active={mainAppDisplay}
        />
      </div>
    );
  }

  /**
   *
   * @param index 0: 视频 1: 音乐 2: 设置 3: 关于
   */
  protected switchCategories = async (index: number) => {
    await this.setState({ CategoriesIndex: index });
    setPanelFocus({ category: index, platform: 0 });
    if (index !== 2 && index !== 3) {
      this.setState({ needOutFromSettings: true });
    } else if (this.state.needOutFromSettings) {
      this.setState({ needOutFromSettings: false });
    }
  };
}
