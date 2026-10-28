import { Component, ContextType } from "preact";
import { MediaContainerContext } from "../media-container-context/MediaContainerContext";
import {
  accentFill,
  accentFillButton,
  accentOutlineButton,
  accentText,
} from "../floating-panel/floatingPanel";

interface MediaContainerProps {
  platformData: PlatformData;
  variant?: "full" | "compact"; // compact 为列表行的内联图标按钮
}

interface State {
  multipage?: MultiPageData;
}

export class MediaCardButton extends Component<MediaContainerProps> {
  static contextType = MediaContainerContext;
  declare context: ContextType<typeof MediaContainerContext>;

  // 初始化 state，用来记录 Promise 是否已经有了结果
  // resolved: 是否已经解析完成 (无论结果是数据还是 undefined)
  state: State & { resolved: boolean } = { resolved: false };

  private demandPlay = async () => {
    const { platformData } = this.props;
    const { currentOnDemandPlay, ShowOrHideIMC } = this.context;

    // 如果定义了 multiPage 但还没解析完，拦截点击
    if (platformData.multiPage && !this.state.resolved) {
      return;
    }

    ShowOrHideIMC();
    currentOnDemandPlay(platformData);
  };

  private confirmMultiPageAction = async () => {
    const { platformData } = this.props;
    const { switchToMultiPage, updateCurrentInMultiPageStatus } = this.context;
    await updateCurrentInMultiPageStatus(true);
    // 执行到这里肯定已经 resolved 了
    switchToMultiPage(platformData, !!this.state.multipage);
  };

  // 提取解析逻辑
  private handlePromise(promise?: Promise<MultiPageData | undefined>) {
    if (promise) {
      promise
        .then((value) => {
          this.setState({ multipage: value, resolved: true });
        })
        .catch(() => {
          this.setState({ resolved: true }); // 出错也视为完成，退回到普通播放
        });
    } else {
      this.setState({ resolved: true }); // 没有 Promise，直接视为完成
    }
  }

  componentDidMount() {
    this.handlePromise(this.props.platformData.multiPage);
  }

  componentDidUpdate(prevProps: Readonly<MediaContainerProps>) {
    if (this.props.platformData !== prevProps.platformData) {
      this.setState({ multipage: undefined, resolved: false });
      this.handlePromise(this.props.platformData.multiPage);
    }
  }

  render() {
    const { multipage, resolved } = this.state;
    const { platformData, variant = "full" } = this.props;

    // 加载状态
    const isLoading = !!platformData.multiPage && !resolved;

    // 平台识别
    const isNetease =
      platformData.neteaseMusic || platformData.websiteUrl?.includes("163.com");
    const hasMultiPage = !!multipage;

    const playIconClass = isNetease ? "headphonesIcon" : "playIcon";
    const actionText = isNetease ? "选歌" : "选集";

    // 卡片底部按钮行：播放为强调色实心钮（白字），选集/选歌为强调色描边次要钮；44px 高
    const containerBaseClass =
      "MediaCardButtonContainer w-full flex justify-center items-center h-11 rounded-lg text-[14px] font-semibold transition-all duration-100! ease-in-out";

    // 图标公共类
    const iconBaseClass = "font-['md'] text-[20px]";

    // 列表行的整高分段方钮（与 full 共享 demandPlay / multiPage 解析逻辑）
    // 与缩略图同高(72px)填满行的上下边缘：单个 72×72 方块，双个并排方格 + 分割线
    if (variant === "compact") {
      const compactBtnClass = (disabled: boolean) =>
        `flex items-center justify-center w-[72px] ${
          hasMultiPage ? "max-[768px]:w-[40px]" : "max-[768px]:w-[56px]"
        } transition-all duration-100! ease-in-out! ${
          disabled
            ? "opacity-30 cursor-not-allowed"
            : "cursor-pointer hov:hover:bg-(color:--imw-accent)/12 active:scale-95"
        }`;
      const compactIconClass =
        "font-['md'] text-[26px] max-[768px]:text-[20px] font-bold transition-all duration-100! ease-in-out!";
      return (
        <div
          className={`flex items-stretch h-[72px] max-[768px]:h-[56px] rounded-xl overflow-hidden bg-(color:--imw-accent)/10 shrink-0 ${accentText}`}
        >
          <div
            className={compactBtnClass(isLoading)}
            onClick={isLoading ? undefined : this.demandPlay}
          >
            <div className={`${playIconClass} ${compactIconClass}`}></div>
          </div>
          {hasMultiPage && (
            <div
              className={`${compactBtnClass(false)} border-l border-(color:--imw-accent)/20`}
              onClick={this.confirmMultiPageAction}
            >
              <div className={`playlistPlusIcon ${compactIconClass}`}></div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex w-full gap-2 px-3 pb-3 max-[768px]:px-2 max-[768px]:pb-2 shrink-0">
        {/* 播放按钮 */}
        <div
          className={`${containerBaseClass} ${
            isLoading
              ? `${accentFill} opacity-30 cursor-not-allowed`
              : `${accentFillButton} cursor-pointer`
          }`}
          onClick={isLoading ? undefined : this.demandPlay}
        >
          <div className={`${playIconClass} ${iconBaseClass}`}></div>
          <div className="ml-1.5">播放</div>
        </div>

        {/* 选集/选歌按钮 */}
        {hasMultiPage && (
          <div
            className={`${containerBaseClass} ${accentOutlineButton} cursor-pointer`}
            onClick={this.confirmMultiPageAction}
          >
            <div className={`playlistPlusIcon ${iconBaseClass}`}></div>
            <div className="ml-1.5">{actionText}</div>
          </div>
        )}
      </div>
    );
  }
}
