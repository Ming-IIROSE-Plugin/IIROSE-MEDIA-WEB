// 状态部件（DESIGN.md `state-message` / `text-button`）：结果区内水平居中的一行文案，
// 可跟一个蔷薇红文字钮（「重试」「清除搜索」）。无插画、无自绘 toast。
import {
  deskFocusRing,
  deskInk2,
  deskTextButton,
  typeLabel,
} from "../floating-panel/tokens";

export interface StateMessageProps {
  message: string;
  /** 文字钮文案（不传则只有一行文案）。 */
  action?: string;
  onAction?: () => void;
}

export function StateMessage({ message, action, onAction }: StateMessageProps) {
  return (
    <div className="mt-[72px] flex flex-col items-center px-4 text-center max-[768px]:mt-[48px]">
      <p className={`m-0 ${typeLabel} ${deskInk2}`}>{message}</p>
      {action && (
        <button
          type="button"
          className={`mt-3 inline-flex min-h-[44px] items-center px-3 ${deskTextButton} ${deskFocusRing}`}
          onClick={onAction}
        >
          {action}
        </button>
      )}
    </div>
  );
}
