// 桌面竖栏 / 手机底部标签栏（DESIGN.md `rail` / `bottom-tab-bar`）。
// 两个容器是同一个组件的两套形态：竖栏在 >768px 显示，标签栏在 ≤768px 显示。
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk3,
  deskInkSurface,
  deskPaper,
  deskPaperText,
  deskPressTone,
  deskRail,
  deskRailWidth,
  deskRing,
  deskRose,
  deskRoseFill,
  deskRule,
  deskSheet,
  roundedLg,
  touchMin,
  typeNavLabel,
  typeNavLabelTab,
  deskPress,
} from "../floating-panel/tokens";
import type { DeskIconName } from "../floating-panel/tokens";
import {
  MODE,
  RAIL_FOOTER_MODES,
  RAIL_MODES,
  TAB_MODES,
  type DeskModeInfo,
} from "./deskModes";

const RAIL_ICONS: Record<DeskModeInfo["id"], DeskIconName> = {
  music: "note",
  video: "film",
  radio: "radio",
  favorites: "star",
  settings: "gear",
  about: "info",
};

interface DeskNavigationProps {
  mode: number;
  onSelectMode: (mode: number) => void;
}

const railItem = (active: boolean) =>
  [
    "relative flex w-16 shrink-0 cursor-pointer flex-col items-center gap-[5px] border-0 bg-transparent px-0 pt-2.5 pb-2",
    roundedLg,
    typeNavLabel,
    deskPress,
    deskFocusRing,
    active
      ? `${deskInk} ${deskSheet} ${deskRing}`
      : `${deskInk3} ${deskPressTone}`,
  ].join(" ");

const tabItem = (active: boolean) =>
  [
    "flex cursor-pointer flex-col items-center justify-center gap-1 border-0 bg-transparent px-0 text-[11px]",
    typeNavLabelTab,
    touchMin,
    deskPress,
    deskFocusRing,
    active ? `font-semibold ${deskRose}` : deskInk3,
  ].join(" ");

export function DeskNavigation({ mode, onSelectMode }: DeskNavigationProps) {
  // 手机端「关于」并入设置：停在关于页时设置标签仍算当前模式。
  const tabActive = (item: DeskModeInfo) =>
    mode === item.index ||
    (item.index === MODE.settings && mode === MODE.about);

  return (
    <div className="contents">
      <nav
        aria-label="模式"
        className={`flex ${deskRailWidth} shrink-0 flex-col items-center gap-1 border-r border-solid ${deskRule} ${deskRail} px-0 pt-[18px] pb-4 max-[768px]:hidden`}
      >
        {/* 品牌标：纯标识，无操作、不可聚焦 */}
        <div
          className={`mb-[22px] grid h-10 w-10 place-items-center ${roundedLg} ${deskInkSurface} ${deskPaperText}`}
          aria-hidden="true"
        >
          <DeskIcon name="mark" size={24} />
        </div>

        {RAIL_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={railItem(mode === item.index)}
            aria-current={mode === item.index ? "page" : undefined}
            onClick={() => onSelectMode(item.index)}
          >
            {mode === item.index && (
              <span
                aria-hidden="true"
                className={`absolute top-[14px] bottom-[14px] left-[-10px] w-[3px] rounded-l-none rounded-r-[3px] ${deskRoseFill}`}
              />
            )}
            <DeskIcon name={RAIL_ICONS[item.id]} size={22} />
            <span>{item.label}</span>
          </button>
        ))}

        <div className="flex-1" />

        {RAIL_FOOTER_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={railItem(mode === item.index)}
            aria-current={mode === item.index ? "page" : undefined}
            onClick={() => onSelectMode(item.index)}
          >
            {mode === item.index && (
              <span
                aria-hidden="true"
                className={`absolute top-[14px] bottom-[14px] left-[-10px] w-[3px] rounded-l-none rounded-r-[3px] ${deskRoseFill}`}
              />
            )}
            <DeskIcon name={RAIL_ICONS[item.id]} size={22} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <nav
        aria-label="模式"
        className={`mt-2.5 hidden grid-cols-5 border-t border-solid ${deskRule} ${deskPaper} px-1.5 pt-2.5 pb-[26px] max-[768px]:order-last max-[768px]:grid`}
      >
        {TAB_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tabItem(tabActive(item))}
            aria-current={tabActive(item) ? "page" : undefined}
            onClick={() => onSelectMode(item.index)}
          >
            <DeskIcon name={RAIL_ICONS[item.id]} size={22} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
