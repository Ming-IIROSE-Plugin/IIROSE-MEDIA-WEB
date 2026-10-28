import { Component } from "preact";
import {
  idleSegment,
  segmentEdge,
  selectedSegment,
} from "../floating-panel/floatingPanel";

interface PlatformSelectorProps {
  platform: Platform[];
  switchPlatform: (index: number) => void;
  isCurrentInMultiPage: boolean;
  PlatformIndex?: number;
  favoritesMode?: boolean;
}

interface PlatformSelectorState {
  activeIndex: number; // 记录当前激活的项的索引
}

export class PlatformSelector extends Component<
  PlatformSelectorProps,
  PlatformSelectorState
> {
  constructor(props: PlatformSelectorProps) {
    super(props);
    this.state = {
      activeIndex: props.PlatformIndex ?? 0, // 初始状态，激活对应项
    };
  }

  componentDidUpdate(prevProps: Readonly<PlatformSelectorProps>): void {
    // 收藏模式切换导致的 platform 变化绝对不能触发 switchPlatform(0)！
    if (prevProps.favoritesMode !== this.props.favoritesMode) {
      if (this.props.PlatformIndex !== undefined) {
        this.setState({ activeIndex: this.props.PlatformIndex });
      }
      return;
    }

    if (prevProps.platform !== this.props.platform) {
      this.setState({ activeIndex: 0 });
      this.handleSwitchPlatform(0);
    }
  }

  handleSwitchPlatform = (index: number) => {
    const { switchPlatform } = this.props;
    this.setState({ activeIndex: index });
    switchPlatform(index);
  };

  render() {
    const { platform, isCurrentInMultiPage, PlatformIndex } = this.props;
    const activeIndex =
      PlatformIndex !== undefined ? PlatformIndex : this.state.activeIndex;
    return (
      <div
        className={`${isCurrentInMultiPage ? "hidden" : "flex"} px-[20px] max-[768px]:px-2 items-center overflow-x-auto no-scrollbar animate-[fadeIn_.25s_ease-out,expandHeight_.25s_ease-in-out]`}
      >
        {!isCurrentInMultiPage &&
          platform.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                className={`flex items-center shrink-0 h-10 max-[768px]:h-10 border border-solid cursor-pointer transition-all duration-100! animate-[fadeIn_.25s_ease-out] ${segmentEdge(index, platform.length)} ${
                  isActive ? selectedSegment : idleSegment
                }`}
                key={index}
                // 点击区挂在外层：整个 40px 标签（含 1px 描边）都可点
                onClick={() => {
                  this.handleSwitchPlatform(index);
                }}
              >
                <div
                  className="flex items-center justify-center h-full px-[10px] max-[768px]:px-3 transition-all duration-100! active:scale-95"
                  title={item.title}
                >
                  <img
                    className="w-8 h-8 max-[768px]:w-[26px] max-[768px]:h-[26px] rounded-sm object-cover shrink-0"
                    src={item.iconsrc}
                    alt={item.title}
                  ></img>
                  <div className="mx-[10px] max-[768px]:mx-1.5 text-[14px] max-[768px]:text-[13px] whitespace-nowrap">
                    {item.title}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    );
  }
}
