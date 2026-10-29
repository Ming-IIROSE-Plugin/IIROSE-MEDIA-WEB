import { Component, ComponentChildren } from "preact";
import {
  accentText,
  mutedText,
  pressTone,
  themedCard,
  themedDividerBottom,
} from "./floating-panel/floatingPanel";

interface SettingCardProps {
  settingsData: SettingData;
}

interface SettingCardState {
  currentActionTitle: string;
}

export class SettingCard extends Component<SettingCardProps, SettingCardState> {
  constructor(props: SettingCardProps) {
    super(props);
    this.state = {
      currentActionTitle: props.settingsData.actionTitle,
    };
  }

  handleClick = () => {
    this.props.settingsData.action(this.updateActionTitle);
  };

  componentDidUpdate(
    previousProps: Readonly<SettingCardProps>,
    _previousState: Readonly<SettingCardState>,
    _snapshot: any,
  ): void {
    if (previousProps !== this.props) {
      this.setState({
        currentActionTitle: this.props.settingsData.actionTitle,
      });
    }
  }

  private updateActionTitle = (actionTitle?: string) => {
    this.setState({ currentActionTitle: actionTitle });
  };

  render(): ComponentChildren {
    const { title, icon } = this.props.settingsData;
    const { currentActionTitle } = this.state;
    return (
      <div
        className={`IMW-SettingCard flex flex-col h-[200px] m-[12px] rounded-xl overflow-hidden ${themedCard}`}
      >
        {/* 标题区：强调色图标 + 次要色标题，主题分隔线（内阴影，不占高度）。
            commonBoxHead 是宿站类，宿站夜间主题会改它的色与底：覆盖必须带 !（见 ad03018）。 */}
        <div
          className={`commonBoxHead text-inherit! bg-transparent! border-0! ${themedDividerBottom}`}
        >
          <div
            className={`flex font-md ${icon} h-full text-[30px] max-[768px]:text-[24px] items-center shrink-0 ${accentText}`}
          ></div>
          {/* 移动端卡宽约 150px：标题缩小并最多两行，长标题不溢出标题区 */}
          <span
            className={`font-bold flex h-full min-w-0 text-[20px] max-[768px]:text-[15px] max-[768px]:leading-5 items-center ml-[22px] max-[768px]:ml-2.5 ${mutedText}`}
          >
            <span className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]">
              {title}
            </span>
          </span>
        </div>
        {/* 动作区：整块可点，悬停/按压淡强调；当前值用强调色 */}
        <div
          className={`IMW-SettingCard-Action h-[50%] cursor-pointer bg-transparent ${accentText} ${pressTone} transition-colors duration-100!`}
          onClick={this.handleClick}
        >
          {(currentActionTitle ?? "").startsWith("mdi") ? (
            <div
              className={`whoisTouch2 w-full h-full flex items-center justify-center font-md text-[48px] ${currentActionTitle}`}
            />
          ) : (
            <span
              className={`whoisTouch2 text-[16px] w-full h-full flex items-center justify-center font-bold`}
            >
              {currentActionTitle}
            </span>
          )}
        </div>
      </div>
    );
  }
}
