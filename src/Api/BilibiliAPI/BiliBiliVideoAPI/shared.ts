/**
 * B 站视频接口模块共用的响应处理。
 *
 * 与原实现逐字等价：响应存在且 `ok` 时取 JSON，其余情况（含请求异常返回 null）一律 null；
 * `json()` 解析失败照常抛出，不做吞错。
 */
export async function parseJsonOrNull<T>(
  response: Response | null,
): Promise<T | null> {
  if (response && response.ok) {
    return (await response.json()) as T;
  }

  return null;
}
