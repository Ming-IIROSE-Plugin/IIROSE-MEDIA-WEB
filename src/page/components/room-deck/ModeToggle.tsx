// 模式开关（DESIGN.md `mode-toggle` / `mode-toggle-on`）：一处样式，桌面底部条、
// 迷你条与展开的底部条三处复用。互斥、点亮态、待命与不可用规则全在 `PlaybackMode`，
// 这里只映射到 aria 属性与视觉；点击结果（提示 / 随机先开面板）由使用处处理。
import {
  DeskIcon,
  deskDeckToggleBorder,
  deskFocusRingOnDeck,
  deskOnRose,
  deskRoseSolid,
  roundedLg,
  roundedMd,
  typeButtonSm,
  deskPress,
  deskInk2,
  deskPressTone,
  deskHover,
  deskRose,
  deskRoseTint,
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
  /** 手机展开底部条的形态：无描边的柔和胶囊，开启为蔷薇红淡底（描边方框在浅色底板上太硬）。 */
  sheet?: boolean;
  onToggle: (kind: PlaybackModeKind, element: HTMLButtonElement) => void;
}

export function ModeToggle({
  kind,
  label,
  active,
  enabled,
  hint,
  compact = false,
  sheet = false,
  onToggle,
}: ModeToggleProps) {
  if (sheet) {
    return (
      <button
        type="button"
        data-imw-mode={kind}
        className={`flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border-0 px-4 ${typeButtonSm} ${active ? `${deskRoseTint} ${deskRose} font-semibold` : `${deskHover} ${deskInk2}`} ${deskPress} ${deskFocusRingOnDeck} ${enabled ? "" : "opacity-40"}`}
        aria-pressed={active}
        aria-disabled={!enabled}
        title={hint}
        onClick={(event) => onToggle(kind, event.currentTarget)}
      >
        <DeskIcon name={ICONS[kind]} size={17} />
        <span className="whitespace-nowrap">{label}</span>
      </button>
    );
  }
  const base = compact
    ? `flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-solid bg-transparent p-0 ${roundedLg}`
    : `flex h-8 shrink-0 cursor-pointer items-center gap-1.5 border border-solid bg-transparent px-2.5 max-[768px]:h-11 ${roundedMd} ${typeButtonSm}`;
  const tone = active
    ? `border-transparent ${deskRoseSolid} ${deskOnRose}`
    : `${deskDeckToggleBorder} ${deskInk2} ${deskPressTone}`;

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
