/** 宿站当前是否深色主题：`window.theme` 为假值即深色（浮窗与主面板同一判定）。 */
export function hostIsDark(): boolean {
  return !window.theme;
}
