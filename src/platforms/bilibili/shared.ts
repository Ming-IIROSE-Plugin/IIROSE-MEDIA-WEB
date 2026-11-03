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

/**
 * 按 `itemPerPage` 拆出当前页与完整列表：两者顺序与入参一致，
 * 当前页是完整列表的前缀（缓存翻页要用完整列表）。
 */
export const splitByPage = (
  data: PlatformData[],
  itemPerPage: number,
): { platformData: PlatformData[]; allPlatformData: PlatformData[] } => {
  const platformData: PlatformData[] = [];
  const allPlatformData: PlatformData[] = [];
  let count = 0;

  for (const item of data) {
    if (count >= itemPerPage) {
      allPlatformData.push(item);
    } else {
      allPlatformData.push(item);
      platformData.push(item);
    }
    count++;
  }

  return { platformData, allPlatformData };
};
