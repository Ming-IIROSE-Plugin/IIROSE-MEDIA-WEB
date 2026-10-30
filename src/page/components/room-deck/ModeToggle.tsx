// 模式开关（DESIGN.md `mode-toggle` / `mode-toggle-on`）：一处样式，桌面底部条、
// 迷你条与展开的底部条三处复用。互斥、点亮态、待命与不可用规则全在 `PlaybackMode`，
// 这里只映射到 aria 属性与视觉；点击结果（提示 / 随机先开面板）由使用处处理。
import {
  DeskIcon,
  deskDeckText,
  deskDeckToggleBorder,
  deskFocusRingOnDeck,
  deskOnRose,
  deskRoseSolid,
  roundedLg,
  roundedMd,
  typeButtonSm,
  deskPress,
} from "../floating-panel/tokens";
import type { PlaybackModeKind } from "../../../playback/PlaybackMode";

const ICONS: Record<PlaybackModeKind, "repeat" | "shuffle"> = {
  loop: "repeat",
  shuffle: "shuffle",
};

export interface ModeToggleProps {
  kind: PlaybackModeKind;
  label: string;
  active: boolean;
  enabled: boolean;
  /** `title`：待命时为待命原因，否则为不可用原因或开关名。 */
  hint: string;
  /** 迷你条的纯图标形态（文字由 `aria-label` 承担）。 */
  compact?: boolean;
  onToggle: (kind: PlaybackModeKind, element: HTMLButtonElement) => void;
}

export function ModeToggle({
  kind,
  label,
  active,
  enabled,
  hint,
  compact = false,
  onToggle,
}: ModeToggleProps) {
  const base = compact
    ? `flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-solid bg-transparent p-0 ${roundedLg}`
    : `flex h-[38px] shrink-0 cursor-pointer items-center gap-[7px] border border-solid bg-transparent px-3 max-[768px]:h-11 ${roundedMd} ${typeButtonSm}`;
  const tone = active
    ? `border-transparent ${deskRoseSolid} ${deskOnRose}`
    : `${deskDeckToggleBorder} ${deskDeckText} opacity-80`;

  return (
    <button
      type="button"
      data-imw-mode={kind}
      className={`${base} ${tone} ${deskPress} ${deskFocusRingOnDeck}`}
      aria-pressed={active}
      aria-disabled={!enabled}
      aria-label={compact ? label : undefined}
      title={hint}
      onClick={(event) => onToggle(kind, event.currentTarget)}
    >
      <DeskIcon name={ICONS[kind]} size={compact ? 20 : 17} />
      {compact ? null : <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}
