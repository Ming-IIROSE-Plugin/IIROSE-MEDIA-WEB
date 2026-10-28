import { Component } from "preact";
import { MediaCardImg, getMediaInfoArea } from "./MediaCardImg";
import { MediaCardButton } from "./MediaCardButton";
import { FavoriteStarButton } from "./FavoriteStarButton";
import { mutedText, themedCard } from "../floating-panel/floatingPanel";

interface MediaListRowProps {
  platformData: PlatformData;
}

/**
 * 搜索结果列表视图的单行：
 * 72px 方形缩略图 + 标题/作者/类型时长文字块 + 内联播放/选集按钮
 * 行高由内容撑开（max-content），禁止被 overflow:hidden 裁掉按钮
 */
export class MediaListRow extends Component<MediaListRowProps> {
  render() {
    const { platformData } = this.props;
    const info = getMediaInfoArea(platformData);

    return (
      <div
        className={`flex items-center gap-3 max-[768px]:gap-2 w-full shrink-0 box-border rounded-xl overflow-hidden ${themedCard} px-3 max-[768px]:px-2 py-[10px] max-[768px]:py-[6px] animate-[fadeIn_.25s_ease-out]`}
      >
        <MediaCardImg
          src={platformData.coverImg}
          platformData={platformData}
          compact
        />

        <div className="flex flex-col justify-center min-w-0 grow shrink overflow-hidden">
          <div className="font-bold text-[15px] max-[768px]:text-[14px] leading-[20px] max-[768px]:leading-[18px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
            {platformData.title}
          </div>
          <div
            className={`text-[12px] leading-[16px] mt-[2px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 ${mutedText}`}
          >
            {platformData.author || ""}
          </div>
          {/* 元信息右对齐到按钮组左侧，做右侧视觉锚点（桌面端消除中段大空白）；无内容不渲染空行 */}
          {info && (
            <div className="flex justify-end mt-[2px] overflow-hidden min-w-0">
              <div
                className={`text-[12px] max-[768px]:text-[11px] leading-[16px] max-[768px]:leading-[14px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 max-w-full ${mutedText}`}
              >
                {info}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 max-[768px]:gap-1 shrink-0">
          <FavoriteStarButton platformData={platformData} variant="inline" />
          <MediaCardButton platformData={platformData} variant="compact" />
        </div>
      </div>
    );
  }
}
