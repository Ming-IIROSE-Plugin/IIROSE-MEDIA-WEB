// src/settings/pluginSettings/touchScreen.ts
/**
 * 这台设备有没有触屏（能不能用双指下滑）。触屏笔记本也算有。
 * 只决定「点歌台入口」怎么说、给几档，不参与胶囊挂卸和手势放行的判定。
 */
export function hasTouchScreen(): boolean {
  if ((globalThis.navigator?.maxTouchPoints ?? 0) > 0) return true;
  return !!globalThis.matchMedia?.("(any-pointer: coarse)")?.matches;
}
