import { Component } from "preact";
import { mutedText } from "../floating-panel/floatingPanel";

interface MediaCardInfoProps {
  platformData: PlatformData;
}

export class MediaCardInfo extends Component<MediaCardInfoProps> {
  render() {
    const { platformData } = this.props;
    return (
      // 卡片文字：标题 14px semibold、作者与副标题 12px 次要色；颜色继承面板正文色（随主题）。
      // grow：同一网格行内卡片等高时把按钮行推到卡片底部对齐。
      <div className="px-4 py-3 relative shrink-0 grow">
        {platformData.title && (
          <div className="relative font-semibold leading-5">
            <div className="overflow-hidden text-ellipsis whitespace-pre text-[14px]">
              {platformData.title}
            </div>
            {platformData.subtitle && (
              <div
                className={`mt-0.5 text-[12px] leading-4 font-normal max-w-[80%] overflow-hidden whitespace-pre text-ellipsis ${mutedText}`}
              >
                {platformData.subtitle}
              </div>
            )}
          </div>
        )}

        <div
          className={`mt-0.5 text-[12px] leading-4 overflow-hidden text-ellipsis whitespace-pre ${mutedText}`}
        >
          {platformData.author || ""}
        </div>
      </div>
    );
  }

  state = {
    collected: false,
  };
}
