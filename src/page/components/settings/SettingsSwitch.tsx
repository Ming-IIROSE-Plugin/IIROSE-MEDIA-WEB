// 设置开关（DESIGN.md `settings-switch`）：36×20 轨道、14px 圆钮，关态 sheet 底 +
// 1.5px ink3 描边，开态蔷薇红实底 + on-rose 圆钮。
//
// 纯装饰：自身不接事件、不 focusable，点击区由整行（`role="switch"`）承担，
// 触屏目标因此恒为整行高度（DESIGN.md `settings-switch.hit-area`）。
import {
  deskInk3Border,
  deskInk3Fill,
  deskOnRoseFill,
  deskRoseSolid,
  deskSheet,
} from "../floating-panel/tokens";

export interface SettingsSwitchProps {
  checked: boolean;
}

export function SettingsSwitch({ checked }: SettingsSwitchProps) {
  return (
    <span
      aria-hidden="true"
      data-imw-settings-switch={checked ? "on" : "off"}
      className={`flex h-5 w-9 shrink-0 items-center rounded-full border-[1.5px] border-solid px-[3px] ${
        checked
          ? `justify-end border-transparent ${deskRoseSolid}`
          : `justify-start ${deskSheet} ${deskInk3Border}`
      }`}
    >
      <span
        className={`block h-[14px] w-[14px] rounded-full ${
          checked ? deskOnRoseFill : deskInk3Fill
        }`}
      />
    </span>
  );
}
