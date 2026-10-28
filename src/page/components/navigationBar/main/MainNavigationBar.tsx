import { Component } from "preact";
import {
  pressTone,
  themedDividerBottom,
} from "../../floating-panel/floatingPanel";

interface MainNavigationBarProps {
  switchCategories: (index: number) => void;
  ShowHideMainApp: () => void;
  activeButtonIndex: number;
}

interface MainNavigationBarState {}

export class MainNavigationBar extends Component<
  MainNavigationBarProps,
  MainNavigationBarState
> {
  constructor(props: MainNavigationBarProps) {
    super(props);
  }

  quitFromMainApp = () => {
    const { ShowHideMainApp } = this.props;
    ShowHideMainApp();
  };

  handleSwitchPage = (index: number) => {
    this.props.switchCategories(index);
    this.setState({ activeButtonIndex: index }); // 更新活动按钮索引
  };

  // NavBarButton：图标按钮语言（透明底、`rounded-lg`、悬停淡天蓝），选中项天蓝字 + 淡天蓝底
  // 移动端（≤768px）：隐藏文字，44px 触控区紧密相连无间距，纯图标高密度
  private navButtonClass = (active: boolean) =>
    `min-w-[40px] min-h-[40px] max-[768px]:min-w-[44px] max-[768px]:min-h-[44px] max-[768px]:w-[44px] max-[768px]:h-[44px] px-[20px] max-[768px]:px-0 flex items-center justify-center cursor-pointer rounded-lg text-2xl transition-all duration-100! [&>div]:transition-transform [&>div]:duration-100 active:[&>div]:scale-95 ${active ? "bg-sky-500/10 text-sky-500 active:bg-sky-500/15" : `text-inherit ${pressTone}`}`;

  render() {
    const { activeButtonIndex } = this.props;

    return (
      <div
        className={`flex min-h-[40px] max-[768px]:min-h-[44px] justify-between ${themedDividerBottom}`}
      >
        <div className="flex">
          <div
            className={this.navButtonClass(false)}
            id="BackButton"
            title="返回"
            onClick={this.quitFromMainApp}
          >
            <div
              className="text-2xl pl-[10px] mr-[20px] cursor-pointer max-[768px]:p-0 max-[768px]:mr-0 max-[768px]:text-[24px]"
              id="BackIcon"
            ></div>
          </div>

          <div
            className="px-[20px] max-[768px]:hidden flex items-center cursor-auto text-base transition-opacity duration-300"
            id="NavBarTitle"
          >
            <div
              className="text-2xl text-sky-500 pl-[10px] mr-[20px] cursor-pointer"
              id="TitleIcon"
            ></div>
            <div className="text-[15px] font-semibold transition-all duration-500 max-[768px]:hidden whitespace-nowrap">
              {" "}
              IIROSE - MEDIA{" "}
            </div>
          </div>
        </div>

        <div className="flex">
          <div
            className={this.navButtonClass(activeButtonIndex === 0)}
            id=""
            title="音乐"
            onClick={() => this.handleSwitchPage(0)}
          >
            <div
              className="text-2xl pl-[10px] mr-[20px] cursor-pointer max-[768px]:p-0 max-[768px]:mr-0 max-[768px]:text-[24px]"
              id="MusicIcon"
            ></div>
            <div className="text-sm transition-all duration-500 max-[768px]:hidden whitespace-nowrap">
              {" "}
              音乐{" "}
            </div>
          </div>

          <div
            className={this.navButtonClass(activeButtonIndex === 1)}
            id=""
            title="视频"
            onClick={() => this.handleSwitchPage(1)}
          >
            <div
              className="text-2xl pl-[10px] mr-[20px] cursor-pointer max-[768px]:p-0 max-[768px]:mr-0 max-[768px]:text-[24px]"
              id="VideoIcon"
            ></div>
            <div className="text-sm transition-all duration-500 max-[768px]:hidden whitespace-nowrap">
              {" "}
              视频{" "}
            </div>
          </div>

          <div
            className={this.navButtonClass(activeButtonIndex === 2)}
            id=""
            title="设置"
            onClick={() => this.handleSwitchPage(2)}
          >
            <div
              className="text-2xl pl-[10px] mr-[20px] cursor-pointer max-[768px]:p-0 max-[768px]:mr-0 max-[768px]:text-[24px]"
              id="SettingIcon"
            ></div>
            <div className="text-sm transition-all duration-500 max-[768px]:hidden whitespace-nowrap">
              {" "}
              设置{" "}
            </div>
          </div>

          <div
            className={this.navButtonClass(activeButtonIndex === 3)}
            id=""
            title="关于"
            onClick={() => this.handleSwitchPage(3)}
          >
            <div
              className="text-2xl pl-[10px] mr-[20px] cursor-pointer max-[768px]:p-0 max-[768px]:mr-0 max-[768px]:text-[24px]"
              id="AboutIcon"
            ></div>
            <div className="text-sm transition-all duration-500 max-[768px]:hidden whitespace-nowrap">
              {" "}
              关于{" "}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
