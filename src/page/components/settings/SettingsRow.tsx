// 设置行（DESIGN.md `settings-row`）：图标 + 标签 + 右侧值 / 开关。
//
// 行语义由数据声明（`SettingData.kind`），这里只做四种分支，不按 key 或中文文案猜：
//   value    值 + 右向 chev，整行可点，触发既有设置动作（宿站选择/输入弹窗）
//   action   值（无 chev），整行可点，执行既有动作（含既有确认步骤）
//   readonly 静态行，不可点、不可聚焦、无 chev
//   switch   整行即 `role="switch"`，`aria-checked` 与开关视觉同步
//
// 值与开关态都优先跟随数据；动作回报了新值时先用回报值，父级重建数据后跟新数据。
import { useEffect, useState } from "preact/hooks";
import {
  DeskIcon,
  type DeskIconName,
  deskFocusRing,
  deskInk,
  deskInk2,
  deskInk3,
  deskPressTone,
  deskRose,
  deskRule,
  typeLabel,
} from "../floating-panel/tokens";
import { SettingsSwitch } from "./SettingsSwitch";

export interface SettingsRowProps {
  item: SettingData;
  /** 组卡末行不加底线（DESIGN.md `settings-row.divider`）。 */
  last?: boolean;
}

/** ≥56px（手机 ≥44px，DESIGN.md `settings-row.height` + 触控目标约定）。 */
const rowBase =
  "flex min-h-[56px] w-full items-center gap-3 border-0 border-solid bg-transparent px-4 text-left max-[768px]:min-h-11";

export function SettingsRow({ item, last = false }: SettingsRowProps) {
  const kind = item.kind ?? "value";
  const [value, setValue] = useState(item.actionTitle ?? "");
  const [checked, setChecked] = useState(item.checked === true);

  useEffect(() => setValue(item.actionTitle ?? ""), [item.actionTitle]);
  useEffect(() => setChecked(item.checked === true), [item.checked]);

  const report = (actionTitle?: string, nextChecked?: boolean) => {
    if (typeof actionTitle === "string") setValue(actionTitle);
    if (typeof nextChecked === "boolean") setChecked(nextChecked);
  };

  const divider = last ? "" : `border-b ${deskRule}`;
  const icon = (
    <DeskIcon name={item.icon as DeskIconName} size={20} className={deskInk3} />
  );
  const label = (
    <span className={`min-w-0 flex-1 truncate ${typeLabel} ${deskInk}`}>
      {item.title}
    </span>
  );
  const valueText = (
    <span
      className={`max-w-[52%] shrink-0 truncate ${typeLabel} ${
        item.external ? deskRose : deskInk2
      }`}
    >
      {value}
    </span>
  );

  if (kind === "readonly") {
    return (
      <div
        data-imw-settings-row="readonly"
        className={`${rowBase} cursor-default ${divider}`}
      >
        {icon}
        {label}
        {valueText}
      </div>
    );
  }

  if (kind === "switch") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-imw-settings-row="switch"
        className={`${rowBase} cursor-pointer ${divider} ${deskPressTone} ${deskFocusRing}`}
        onClick={() => item.action?.(report)}
      >
        {icon}
        {label}
        <SettingsSwitch checked={checked} />
      </button>
    );
  }

  const chevron =
    kind === "value" ? (
      <DeskIcon
        name={item.external ? "external" : "right"}
        size={16}
        className={item.external ? deskRose : deskInk3}
      />
    ) : null;

  return (
    <button
      type="button"
      data-imw-settings-row={kind}
      className={`${rowBase} cursor-pointer ${divider} ${deskPressTone} ${deskFocusRing}`}
      onClick={() => item.action?.(report)}
    >
      {icon}
      {label}
      {valueText}
      {chevron}
    </button>
  );
}
