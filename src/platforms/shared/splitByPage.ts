/**
 * 按 `itemPerPage` 拆出当前页与完整列表：两者顺序与入参一致，
 * 当前页是完整列表的前缀（缓存翻页要用完整列表）。
 *
 * 平台层共用：B 站与网易云的搜索结果都按「一页 + 余下留作缓存」落库，
 * 各平台只转发/引用这一份，不要互相 import 对方的目录。
 */
export const splitByPage = (
  data: PlatformData[],
  itemPerPage: number,
): { platformData: PlatformData[]; allPlatformData: PlatformData[] } => {
  // 每页数非正 / 非整数时按「一页装下全部」处理：与旧实现的逐项 push 循环一致
  // （`count >= itemPerPage` 对负数与 NaN 恒为 false），避免 slice 的负数语义改变结果。
  const pageSize =
    Number.isInteger(itemPerPage) && itemPerPage > 0
      ? itemPerPage
      : data.length;
  return {
    platformData: data.slice(0, pageSize),
    allPlatformData: data.slice(),
  };
};
