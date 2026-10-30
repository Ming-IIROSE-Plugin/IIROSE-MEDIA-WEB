// 设置组卡 / 关于卡（DESIGN.md `settings-group` / `about-card`）：纸色底上一张 sheet 卡，
// 1px rule 细线描边 + `lg` 圆角，卡内若干设置行；组名在卡片上方 8px（ink2、label-strong）。
// 卡与卡的间距由使用处给（24px，DESIGN.md `settings-group.note`）。
import {
  deskInk2,
  deskRule,
  deskSheet,
  roundedLg,
  typeLabelStrong,
} from "../floating-panel/tokens";
import { SettingsRow } from "./SettingsRow";

const cardClass = `overflow-hidden border border-solid ${roundedLg} ${deskRule} ${deskSheet}`;

const rows = (items: SettingData[]) =>
  items.map((item, index) => (
    <SettingsRow
      key={`${index}:${item.key}`}
      item={item}
      last={index === items.length - 1}
    />
  ));

export interface SettingsGroupProps {
  group: SettingGroupData;
}

export function SettingsGroup({ group }: SettingsGroupProps) {
  return (
    <section
      data-imw-settings-group={group.title}
      className="flex flex-col gap-2"
    >
      {group.title ? (
        <h2 className={`m-0 ${typeLabelStrong} ${deskInk2}`}>{group.title}</h2>
      ) : null}
      <div className={cardClass}>{rows(group.items)}</div>
    </section>
  );
}

/** 关于卡：同一张卡的变体，没有组名（页头已经说明这一屏是「关于」）。 */
export function AboutCard({ items }: { items: SettingData[] }) {
  return (
    <section data-imw-about-card="true" className={cardClass}>
      {rows(items)}
    </section>
  );
}
