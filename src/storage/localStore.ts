// localStorage 的唯一入口：插件所有本机键值都经这里读写。
// 隐私模式、配额满、值损坏（解析失败）一律在内部消化——读给默认值、写返回 false，永不抛出。
// 键名与落盘形态由调用方决定：`writeJson` 写的就是 `JSON.stringify` 的结果（与历史存档一致），
// `writeString` 写纯字符串（如随机平台 id、设置版本号），升级后老存档照常读出。

/** 读纯字符串；没有记录或存储不可用时返回 null。 */
export function readString(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    // 隐私模式 / 被禁用：按无记录处理
    return null;
  }
}

/**
 * 读纯字符串，并把「存储不可用」与「没有记录」区分开：
 * `ok: false` = 读不出来（隐私模式 / 被禁用），`{ ok: true, value: null }` = 确实没有记录。
 * 只在「读不出来要采取更保守行为」的地方用（如墓碑清理），其余用 `readString`。
 */
export function tryReadString(key: string): {
  ok: boolean;
  value: string | null;
} {
  try {
    if (typeof localStorage === "undefined") return { ok: false, value: null };
    return { ok: true, value: localStorage.getItem(key) };
  } catch {
    return { ok: false, value: null };
  }
}

/** 写纯字符串；返回是否写入成功（配额满等失败返回 false，不抛）。 */
export function writeString(key: string, value: string): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读 JSON 值；缺失、解析失败或存储不可用时返回 `fallback`。
 * 存档里的 `null` 也按「没有值」处理，避免调用方拿到类型之外的 null。
 */
export function readJson<T>(key: string, fallback: T): T {
  const raw = readString(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw) as T | null;
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

/** 写 JSON 值（落盘仍是 JSON 字符串）；返回是否写入成功，值不可序列化时也返回 false。 */
export function writeJson(key: string, value: unknown): boolean {
  let payload: string | undefined;
  try {
    payload = JSON.stringify(value);
  } catch {
    // 循环引用等：不写半截内容
    return false;
  }
  if (payload === undefined) return false;
  return writeString(key, payload);
}

/** 删除键；返回是否删除成功。 */
export function removeKey(key: string): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
