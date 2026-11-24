// 底部条共用的小块：标签行、直播行、两组模式开关，以及点播者文案与进度百分比两处派生。
// 三形态（桌面三栏 / 手机迷你条 / 展开层）只拼这些块，状态与跳转仍在 `useDeck`。
import { formatTime } from "../../../media-progress/model";
import type { MediaSnapshot } from "../../../media-progress/model";
import type {
  PlaybackModeKind,
  PlaybackModeState,
} from "../../../playback/PlaybackMode";
import {
  DeskIcon,
  deskDeckToggleBorder,
  deskFocusRingOnDeck,
  deskHover,
  deskInk,
  deskInk2,
  deskKeyBorder,
  deskOnRose,
  deskPress,
  deskPressTone,
  deskRoseFill,
  deskRoseSolid,
  roundedLg,
  roundedMd,
  roundedXs,
  typeDeckLabel,
  typeMonoNumSm,
  typeMonoPill,
} from "../floating-panel/tokens";
import { ModeToggle } from "./ModeToggle";

export const LABEL = "Now in room";
export const TOGGLES: { kind: PlaybackModeKind; label: string }[] = [
  { kind: "loop", label: "单曲循环" },
  { kind: "shuffle", label: "收藏随机" },
];

/** 点播者行：本人为「由你点播」，他人为「某某 点播」；无播放或无昵称时不显示。 */
export function requesterOf(media: MediaSnapshot): string {
  if (!media.playing) return "";
  if (media.ownMedia) return "由你点播";
  return media.owner ? `${media.owner} 点播` : "";
}

/** 顶边进度线用的百分比（0–100，越界夹到两端）。 */
export function percentOf(current: number | null, duration: number): number {
  if (!(duration > 0)) return 0;
  return Math.min(100, Math.max(0, ((current ?? 0) / duration) * 100));
}

/** 标签行：蔷薇红圆点 + 等宽大写 `Now in room`（文字 65% 不透明度：浅色 sheet 底上对比 5.3，达 AA）。 */
export function DeckLabel() {
  return (
    <div className={`flex items-center gap-1.5 ${typeDeckLabel}`}>
      <span
        aria-hidden="true"
        className={`h-[7px] w-[7px] shrink-0 rounded-full ${deskRoseFill}`}
      />
      <span className="opacity-[0.65]">{LABEL}</span>
    </div>
  );
}

/** 直播 / 电台流：无总时长，「直播」徽章 + 等宽已播时长，不可跳转。 */
export function LiveRow({ media }: { media: MediaSnapshot }) {
  return (
    <div className="flex w-full items-center justify-center gap-2">
      <span
        className={`inline-flex h-5 items-center px-2 ${roundedXs} ${deskRoseSolid} ${deskOnRose} ${typeMonoPill}`}
      >
        直播
      </span>
      <span className={`opacity-80 ${typeMonoNumSm}`}>
        {formatTime(media.current)}
      </span>
    </div>
  );
}

/** 两组模式开关（互斥、点亮态与待命文案都来自 `PlaybackMode`）。 */
export function DeckToggles({
  playback,
  compact,
  sheet = false,
  narrowIconOnly = false,
  onToggle,
}: {
  playback: PlaybackModeState;
  compact: boolean;
  sheet?: boolean;
  narrowIconOnly?: boolean;
  onToggle: (kind: PlaybackModeKind, element: HTMLButtonElement) => void;
}) {
  return (
    <>
      {TOGGLES.map((item) => {
        const active = playback.mode === item.kind;
        const availability = playback[item.kind];
        return (
          <ModeToggle
            key={item.kind}
            kind={item.kind}
            label={item.label}
            active={active}
            enabled={availability.enabled}
            hint={
              active && playback.standby
                ? playback.standbyReason
                : availability.reason || item.label
            }
            compact={compact}
            sheet={sheet}
            narrowIconOnly={narrowIconOnly}
            onToggle={onToggle}
          />
        );
      })}
    </>
  );
}

export interface MediaLoadingToggleProps {
  supported: boolean;
  enabled: boolean;
  reason: string;
  /** 手机展开底部条右上角形态（44×44 纯图标）。 */
  sheet?: boolean;
  onToggle: () => void;
}

/**
 * 本机媒体加载双态开关（中性墨色层级，不占蔷薇红）：
 * 动作文案随态切换（「关闭媒体」/「开启媒体」），不叠 `aria-pressed` 免读屏冲突。
 */
export function MediaLoadingToggle({
  supported,
  enabled,
  reason,
  sheet = false,
  onToggle,
}: MediaLoadingToggleProps) {
  const action = enabled ? "关闭媒体" : "开启媒体";
  const hint = supported ? action : reason;
  const cursor = supported ? "cursor-pointer" : "cursor-not-allowed";
  const base = sheet
    ? `flex h-11 w-11 shrink-0 ${cursor} items-center justify-center border border-solid p-0 ${roundedLg}`
    : `flex h-8 w-8 shrink-0 ${cursor} items-center justify-center border border-solid p-0 ${roundedMd}`;
  const tone = enabled
    ? `bg-transparent ${sheet ? "border-transparent" : deskDeckToggleBorder} ${deskInk2} ${supported ? deskPressTone : ""}`
    : `${deskHover} ${deskInk} ${deskKeyBorder}`;

  return (
    <button
      type="button"
      data-imw-media-loading={enabled ? "on" : "off"}
      aria-label={supported ? action : `${action}，${reason}`}
      aria-disabled={!supported}
      title={hint}
      className={`${base} ${tone} ${supported ? deskPress : "opacity-40"} ${deskFocusRingOnDeck}`}
      onKeyDown={(event) => {
        // 宿站 `window.onkeydown` 在非输入框聚焦时会对 Enter 调 preventDefault 并截胡按键；
        // 仅阻断无修饰键的非组字 Enter 冒泡，并拦住长按 repeat 防止高频误切或叠弹睡眠确认框。
        if (
          event.key === "Enter" &&
          !event.isComposing &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          event.stopPropagation();
          if (event.repeat) event.preventDefault();
        }
      }}
      onClick={onToggle}
    >
      <DeskIcon name={enabled ? "note" : "noteOff"} size={sheet ? 20 : 17} />
    </button>
  );
}
