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
  deskFocusRing,
  deskInk,
  deskInk2,
  deskInk3,
  deskPressTone,
  deskRose,
  deskRule,
  isDeskIconName,
  roundedLg,
  typeLabel,
} from "../floating-panel/tokens";
import { SettingsSwitch } from "./SettingsSwitch";

export interface SettingsRowProps {
  item: SettingData;
  /**
   * 组卡首行 / 末行补上卡片的 12px 圆角：卡片不裁切（焦点环画在行框外），
   * 悬停底与焦点环才不会被直角越出卡边。
   */
  first?: boolean;
  /** 组卡末行不加底线（DESIGN.md `settings-row.divider`）。 */
  last?: boolean;
}

/** ≥56px（手机 ≥44px，DESIGN.md `settings-row.height` + 触控目标约定）。 */
const rowBase =
  "flex min-h-[56px] w-full items-center gap-3 border-0 border-solid bg-transparent px-4 text-left max-[768px]:min-h-11";

/** 首行圆上两角、末行圆下两角；组卡只有一行时整行圆。 */
const cornersOf = (first: boolean, last: boolean) =>
  first && last
    ? roundedLg
    : first
      ? "rounded-t-[12px]"
      : last
        ? "rounded-b-[12px]"
        : "";

export function SettingsRow({
  item,
  first = false,
  last = false,
}: SettingsRowProps) {
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
  const corners = cornersOf(first, last);
  // 图标名拼错时不静默渲染空 svg：回退到 info（SETTING 行的图标在数据层由测试守住）
  const icon = (
    <DeskIcon
      name={isDeskIconName(item.icon) ? item.icon : "info"}
      size={20}
      className={deskInk3}
    />
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
        // 只读值随订阅实时刷新（同步中… → 正常），读屏要能听到变化
        aria-live="polite"
        className={`${rowBase} cursor-default ${divider} ${corners}`}
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
        className={`${rowBase} cursor-pointer ${divider} ${corners} ${deskPressTone} ${deskFocusRing}`}
        onClick={() => item.action?.(report)}
      >
        {icon}
        {label}
        {/* 不可用原因 / 现有状态文字（如「未登录账号」）照旧留在开关左侧 */}
        {value ? valueText : null}
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
      className={`${rowBase} cursor-pointer ${divider} ${corners} ${deskPressTone} ${deskFocusRing}`}
      onClick={() => item.action?.(report)}
    >
      {icon}
      {label}
      {valueText}
      {chevron}
    </button>
  );
}
