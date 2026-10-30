// 页头（DESIGN.md `page-header`）：等宽眉题 + 宋体模式名 + 右侧描边关闭钮。
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk2,
  deskInk3,
  deskPressTone,
  deskRule,
  roundedLg,
  typeDisplay,
  typeDisplayFamily,
  typeEyebrow,
  deskPress,
} from "../floating-panel/tokens";

interface PageHeaderProps {
  /** 当前模式名（音乐页为「点歌台」）。 */
  title: string;
  onClose: () => void;
}

export function PageHeader({ title, onClose }: PageHeaderProps) {
  return (
    <header className="flex items-end gap-5 px-[36px] pt-[26px] max-[768px]:px-[20px] max-[768px]:pt-1.5">
      <div className="min-w-0">
        <div className={`${typeEyebrow} ${deskInk3} mb-1.5`}>
          <span className="max-[768px]:hidden">IIROSE · Media Desk</span>
          <span className="hidden max-[768px]:inline">Media Desk</span>
        </div>
        <h1 className={`m-0 ${typeDisplay} ${typeDisplayFamily} ${deskInk}`}>
          {title}
        </h1>
      </div>
      <button
        type="button"
        aria-label="关闭点歌台"
        className={`ml-auto grid h-10 w-10 shrink-0 cursor-pointer place-items-center border border-solid bg-transparent p-0 ${roundedLg} ${deskRule} ${deskInk2} ${deskPressTone} ${deskPress} ${deskFocusRing}`}
        onClick={onClose}
      >
        <DeskIcon name="close" size={20} />
      </button>
    </header>
  );
}
