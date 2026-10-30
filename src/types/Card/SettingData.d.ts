/** 设置行的语义：由造数据的一方声明，渲染层不按 key 或中文文案猜（复盘 F7）。 */
type SettingKind = "value" | "switch" | "action" | "readonly";

interface SettingData {
  /** 稳定标识（如 "searchViewMode"）：面板内按它匹配行，不得用 title 中文文案匹配 */
  key: string;
  title: string;
  /** 值位文字：值 / 动作 / 只读行显示；开关行用它当开关左侧的状态说明（如「未启用」），可为空。 */
  actionTitle?: string;
  /** 设置行图标：`tokens.ts` 的 `DeskIconName`（自包含内联 SVG，不借宿站 mdi-* 类）。 */
  icon: string;
  /** 行语义，默认 "value"（CAP-11）。 */
  kind?: SettingKind;
  /** 开关行的当前态，只取自设置逻辑的结果（云同步流程完成后才为开）。 */
  checked?: boolean;
  /** 外链行：值位用蔷薇红文字 + 外链图标，不用 emoji（DESIGN.md `about-card`）。 */
  external?: boolean;
  /** 行动作：完成后回报新值（值 → 新文字；开关 → 新布尔），不回报则保持原态。 */
  action?: (report?: (actionTitle?: string, checked?: boolean) => void) => void;
}

/** 一个子分组 = 一张设置组卡（CAP-11：平台分组作范围标签、子分组作组卡）。 */
interface SettingGroupData {
  /** 组卡标题（现有子分组名，如「账号」「视频设置」）。 */
  title: string;
  items: SettingData[];
}
