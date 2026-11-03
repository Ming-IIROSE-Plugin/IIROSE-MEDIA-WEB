import { ShowMessage } from "../iirose_func/ShowMessage";

/**
 * 把抛出物收敛成可读文案：`Error` 取 `message`，其余按字符串。
 * 平台层抛出物未必是 `Error`（字符串、`undefined` 都有），直接读 `.message`
 * 会把 `undefined` 提示给用户。
 */
export const failureMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * 平台层失败提示的唯一出口：有 `fallbackMessage` 用 fallback，否则用错误自身
 * 文案；内部只调用一次 `ShowMessage.show`。
 *
 * 需要「先报错因再补一条固定建议」时，把两条提示分开写：第一条走本入口，
 * 第二条仍是显式 `ShowMessage.show`（同因去重、静默策略留在各自模块，不并入这里）。
 */
export const reportFailure = (
  error: unknown,
  fallbackMessage?: string,
): void => {
  ShowMessage.show(fallbackMessage ?? failureMessage(error));
};
