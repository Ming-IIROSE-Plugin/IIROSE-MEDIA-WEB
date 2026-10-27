import type { MediaProgressPosition } from "./model";

export const MEDIA_PROGRESS_POSITION_KEY = "imwMediaProgressPosition";

function isPosition(value: unknown): value is MediaProgressPosition {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const position = value as Record<string, unknown>;
  return (
    typeof position.x === "number" &&
    typeof position.y === "number" &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    position.x >= 0 &&
    position.y >= 0
  );
}

/** 按键读取 `{x,y}`；非法值或 localStorage 抛错都按无记录。 */
export function readPosition(key: string): MediaProgressPosition | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const value: unknown = JSON.parse(raw);
    return isPosition(value) ? { x: value.x, y: value.y } : undefined;
  } catch {
    return undefined;
  }
}

/** 按键保存 `{x,y}`；写入失败静默忽略。 */
export function savePosition(
  key: string,
  position: MediaProgressPosition | undefined,
): void {
  if (!position) return;
  try {
    localStorage.setItem(key, JSON.stringify({ x: position.x, y: position.y }));
  } catch {
    // localStorage 受限或配额耗尽时，位置仍由当前页面内存状态保留。
  }
}

export function readMediaProgressPosition(): MediaProgressPosition | undefined {
  return readPosition(MEDIA_PROGRESS_POSITION_KEY);
}

export function saveMediaProgressPosition(
  position: MediaProgressPosition | undefined,
): void {
  savePosition(MEDIA_PROGRESS_POSITION_KEY, position);
}
