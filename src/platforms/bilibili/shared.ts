/** B 站分 P（`BiliBiliVideoApi.getBilibiliVideoData` 的 `pages` 项）。 */
export type BiliPage = {
  page: number;
  part: string;
  duration: number;
  cid: number;
};

export const timeToSeconds = (timeString: string) => {
  // 使用 ':' 分隔时间字符串
  const [minutes, seconds] = timeString.split(":").map(Number);
  // 将分钟转换为秒并加上秒数
  return minutes * 60 + seconds;
};

export const removeEmTagsUsingDOMParser = (input: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");
  return doc.body.textContent || "";
};

/** 分页切分与网易云共用一份，这里只作本平台的转发出口。 */
export { splitByPage } from "../shared/splitByPage";
