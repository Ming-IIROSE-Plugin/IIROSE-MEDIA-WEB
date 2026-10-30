// 列表 / 网格视图切换（DESIGN.md `view-segmented`）：范围行与专辑·歌单内页头共用。
// 只有一种视图的范围：仍在原位，灰色锁定并说明原因（不消失，分页不跳）。
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk3,
  deskPress,
  deskRule,
  deskSheet,
  roundedMd,
} from "../floating-panel/tokens";

export interface ViewToggleProps {
  viewMode: "card" | "list";
  locked?: boolean;
  onToggle?: () => void;
}

const OPTIONS = [
  ["list", "列表", "list"],
  ["card", "网格", "grid"],
] as const;

export function ViewToggle({
  viewMode,
  locked = false,
  onToggle,
}: ViewToggleProps) {
  const lockedTitle =
    viewMode === "list" ? "这里只有列表视图" : "这里只有网格视图";
  return (
    <div
      role="radiogroup"
      aria-label="视图"
      title={locked ? lockedTitle : undefined}
      className={`flex overflow-hidden border border-solid ${roundedMd} ${deskRule}`}
    >
      {OPTIONS.map(([value, name, icon]) => {
        const active = viewMode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={locked || undefined}
            aria-label={name}
            title={locked ? lockedTitle : name}
            className={`grid h-[30px] w-[34px] place-items-center border-0 bg-transparent p-0 max-[768px]:h-11 max-[768px]:w-11 ${deskFocusRing} ${locked ? "cursor-not-allowed" : `cursor-pointer ${deskPress}`} ${active ? `${deskSheet} ${deskInk}` : deskInk3} ${locked && !active ? "opacity-40" : ""}`}
            onClick={() => {
              if (!active && !locked) onToggle?.();
            }}
          >
            <DeskIcon name={icon} size={17} />
          </button>
        );
      })}
    </div>
  );
}
