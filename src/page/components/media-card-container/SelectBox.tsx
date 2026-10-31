// 内页勾选框（spec-collection-inner-batch story 3）：未选为细线空框，选中为蔷薇红实底 +
// 白色点选序号（同选集面板徽章）。点它只切换选择：不点播、不触发网格卡的首点显示胶囊。
// 触摸 / 按下也一律不冒泡：主面板容器上的滑动翻页手势不能从勾选框上起手。
import { stopHostGestures } from "../floating-panel/floatingPanel";
import {
  deskFocusRing,
  deskOnRose,
  deskRoseSolid,
  deskRule,
  deskSheet,
  roundedXs,
  typeMonoNumSm,
} from "../floating-panel/tokens";

export interface SelectBoxProps {
  /** 曲名（读屏名）。 */
  title: string;
  /** 1 起的点选序号；未选为 undefined。 */
  order?: number;
  onToggle: () => void;
  /** 网格卡封面上：空框垫抬起面底色，压在封面图上也看得见。 */
  onCover?: boolean;
  /** 定位类（缺省 `relative`；网格卡上为绝对定位）：点击区外扩靠它作定位基准。 */
  className?: string;
}

export function SelectBox({
  title,
  order,
  onToggle,
  onCover = false,
  className = "relative",
}: SelectBoxProps) {
  const checked = order !== undefined;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked ? "true" : "false"}
      aria-label={checked ? `${title}，已选第 ${order} 首` : `选择 ${title}`}
      data-imw-select-box="true"
      {...stopHostGestures}
      // 视觉 32px、点击区外扩到 44px（手机可点目标 ≥44px，不挤占标题列）
      className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 after:absolute after:-inset-[6px] after:content-[''] ${deskFocusRing} ${roundedXs} ${className}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {checked ? (
        <span
          aria-hidden="true"
          className={`flex h-5 min-w-5 items-center justify-center px-[3px] ${roundedXs} ${deskRoseSolid} ${deskOnRose} ${typeMonoNumSm}`}
        >
          {order}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={`h-5 w-5 border border-solid ${roundedXs} ${deskRule} ${onCover ? deskSheet : ""}`}
        />
      )}
    </button>
  );
}
