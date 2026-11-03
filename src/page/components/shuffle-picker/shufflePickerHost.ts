/**
 * 选择面板与宿站之间的接线：页面级单例、宿站返回键包装、焦点恢复判定。
 * 这些逻辑不依赖面板本身，拆出来让 `openShufflePicker.tsx` 只保留打开/关闭流程。
 */

export const SHUFFLE_PICKER_ROOT_ID = "imw-shuffle-picker-root";

export interface PickerHandle {
  /** 立即卸载，不回调、不保存。 */
  release: () => void;
  focus: () => void;
  closing: boolean;
}

// 页面级单例键：跨 bundle 实例可见，后注入者据此接管前一份面板。
export const PICKER_KEY = "__imwShufflePicker";
export type PickerWindow = Window & { [PICKER_KEY]?: PickerHandle };

// 系统返回：宿站自己用 onpopstate → `Utils.backward()` 实现返回，并会补回它的
// "forward" 历史条目。面板打开期间接管 `Utils.backward`：只关面板、不执行宿站返回；
// 插件本身不读写浏览历史（任何 history.back 都会被宿站当成一次返回）。
// 包装函数每页只装一次（带标记，重复注入复用），当前面板经页面级槽位登记。
export const BACK_SLOT_KEY = "__imwShufflePickerBack";
const BACK_HOOK_MARK = "__imwShufflePickerBackHook";

type HostBackward = ((...args: unknown[]) => unknown) & {
  [BACK_HOOK_MARK]?: true;
};
export type BackWindow = Window & {
  Utils?: { backward?: HostBackward };
  [BACK_SLOT_KEY]?: (() => void) | null;
};

/** 确保宿站 `Utils.backward` 已被包装；宿站没有该函数时返回 false（返回键不关面板）。 */
export function ensureBackHook(page: BackWindow): boolean {
  const utils = page.Utils;
  const original = utils?.backward;
  if (!utils || typeof original !== "function") return false;
  if (original[BACK_HOOK_MARK]) return true;
  const wrapped: HostBackward = function (this: unknown, ...args: unknown[]) {
    const dismiss = page[BACK_SLOT_KEY];
    if (dismiss) {
      dismiss();
      return undefined;
    }
    return original.apply(this, args);
  };
  wrapped[BACK_HOOK_MARK] = true;
  utils.backward = wrapped;
  return true;
}

/** 卸载当前页面上的选择面板（含旧 bundle 留下的根节点），不触发回调。 */
export function releaseShufflePicker(): void {
  const page = window as PickerWindow;
  const previous = page[PICKER_KEY];
  delete page[PICKER_KEY];
  try {
    previous?.release();
  } catch {
    /* 旧实例已不可用；残留节点由下面清除 */
  }
  for (const node of document.querySelectorAll(`#${SHUFFLE_PICKER_ROOT_ID}`))
    node.remove();
}

export function canRestoreFocus(element: HTMLElement | null | undefined) {
  return (
    !!element &&
    element.isConnected &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden"
  );
}
