// 主面板的开合与窗口态：输入模块（`@` 搜索）和层级栈（`Esc`）都要问它们，
// 又不该反向依赖 page，所以放在 listener/。写入方只有 `MainAppControlLayer`。

let panelOpen = false;
let panelWindowed = false;

export function setPanelPresence(next: {
  open?: boolean;
  windowed?: boolean;
}): void {
  if (next.open !== undefined) panelOpen = next.open;
  if (next.windowed !== undefined) panelWindowed = next.windowed;
}

export function isPanelOpen(): boolean {
  return panelOpen;
}

/** 面板当前是否按窗口显示（设置开启且视口放得下）；与开合无关。 */
export function isPanelWindowed(): boolean {
  return panelWindowed;
}

const TEXT_ENTRY = /^(INPUT|TEXTAREA|SELECT)$/;
/** 插件自己的根：里面的输入框归面板管。 */
const PLUGIN_ROOTS = '#IIROSE_MEDIA_CONTAINER, [id^="imw-"]';

/**
 * 按键是否落在宿站的输入框里（窗口开着才可能为真）：全屏时聊天区被藏起，
 * 判定恒假，`Esc` 的行为与原版一致。
 */
export function isHostTextTarget(target: EventTarget | null): boolean {
  if (!panelOpen || !panelWindowed) return false;
  const element = target as HTMLElement | null;
  if (!element?.tagName) return false;
  if (!element.isContentEditable && !TEXT_ENTRY.test(element.tagName))
    return false;
  return !element.closest(PLUGIN_ROOTS);
}
