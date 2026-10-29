// 房间是否支持点播：灰化判定与提示的唯一出口。
// 宿站 `window.mediaShareRoom === false` 表示该房间不播放点播媒体。
import { ShowMessage } from "../../../iirose_func/ShowMessage";

export function roomSupportsRequest(): boolean {
  return window.mediaShareRoom !== false;
}

export function notifyRoomUnsupported(): void {
  ShowMessage.show("这个房间不支持点播");
}
