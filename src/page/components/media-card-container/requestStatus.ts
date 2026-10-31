// 行 / 卡读取自己的点播状态（点播守卫的订阅封装）。
import { useEffect, useState } from "preact/hooks";
import {
  getRequestStatus,
  requestKey,
  subscribeRequestStatus,
  type RequestStatus,
} from "../../../playback/RequestGuard";

export function useRequestStatus(data: PlatformData): RequestStatus {
  return useRequestKeyStatus(requestKey(data));
}

/** 按守卫键读状态：自定键的入口（内页「点播所选」`…:selected`）用它。 */
export function useRequestKeyStatus(key: string): RequestStatus {
  const [current, setCurrent] = useState(() => getRequestStatus(key));
  useEffect(() => {
    setCurrent(getRequestStatus(key));
    return subscribeRequestStatus(() => setCurrent(getRequestStatus(key)));
  }, [key]);
  return current;
}

/** 按钮文案：空闲用调用方给的动词（「点播」/「点播到房间」）。 */
export function requestLabel(status: RequestStatus, idle: string): string {
  switch (status) {
    case "pending":
      return "点播中";
    case "failed":
      return "重试";
    default:
      return idle;
  }
}
