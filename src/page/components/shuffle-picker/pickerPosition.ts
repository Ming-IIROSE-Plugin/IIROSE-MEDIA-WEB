// 收藏随机面板的拖动位置：存本机 localStorage（不分账号），读写失败不影响使用。
import type { MediaProgressPosition } from "../../../media-progress/model";
import {
  readPosition,
  savePosition,
} from "../../../media-progress/PositionStorage";

export const SHUFFLE_PICKER_POSITION_KEY = "imwShufflePickerPosition";

export function readShufflePickerPosition(): MediaProgressPosition | undefined {
  return readPosition(SHUFFLE_PICKER_POSITION_KEY);
}

export function saveShufflePickerPosition(
  position: MediaProgressPosition,
): void {
  savePosition(SHUFFLE_PICKER_POSITION_KEY, position);
}
