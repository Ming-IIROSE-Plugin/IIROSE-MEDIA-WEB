// 面板内浮层共用的焦点规则（CAP-14）：`Tab` 在浮层内首尾循环、关闭后把焦点
// 归还触发元素。抽自 `RoomDeck` 展开层的实现，展开的底部条与其他面板浮层共用一套。

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 容器内可聚焦元素（按 DOM 顺序）。 */
export function focusableWithin(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.tabIndex >= 0);
}

/**
 * `Tab` / `Shift+Tab` 在浮层内首尾循环（挂在浮层容器的 `onKeyDown` 上）。
 * 焦点已不在浮层里时按「从外面进来」处理，直接送到首/尾项，不落到背后的列表与标签栏。
 */
export function trapFocusWithin(event: KeyboardEvent): void {
  if (event.key !== "Tab") return;
  const panel = event.currentTarget as HTMLElement | null;
  if (!panel) return;
  const items = focusableWithin(panel);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const inside = panel.contains(document.activeElement);
  if (!event.shiftKey && (!inside || document.activeElement === last)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && (!inside || document.activeElement === first)) {
    event.preventDefault();
    last.focus();
  }
}

/**
 * 关闭浮层后归还焦点：先试触发元素本身；它不可聚焦（手机曲目行体是没有 `tabIndex`
 * 的 `<div>`）就取它内部第一个可聚焦后代，别把焦点丢回 `body`。
 */
export function restoreFocus(target: HTMLElement | null | undefined): void {
  if (!target) return;
  target.focus?.({ preventScroll: true });
  if (document.activeElement === target) return;
  focusableWithin(target)[0]?.focus({ preventScroll: true });
}
