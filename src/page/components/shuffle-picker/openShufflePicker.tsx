// 随机选择面板的打开入口（story 7 侧栏按钮接线用）：独立根挂 body、同页单例、
// 确认保存选择后回调，取消不保存。重复注入时由新实例经 releaseShufflePicker 接管旧根。
import { render } from "preact";
import { FavoritesStorageService } from "../../../storage/FavoritesStorageService";
import {
  loadShuffleSelection,
  saveShuffleSelection,
  type ShufflePlatform,
  type ShuffleSelection,
} from "../../../playback/ShuffleSelection";
import { ShufflePicker, type PickerSource } from "./ShufflePicker";

export const SHUFFLE_PICKER_ROOT_ID = "imw-shuffle-picker-root";
/** 退场动效最长时长（移动抽屉 220ms 的一半）。 */
const EXIT_MS = 110;

export interface OpenShufflePickerOptions {
  platform: ShufflePlatform;
  onConfirm?: (selection: ShuffleSelection) => void;
  onCancel?: () => void;
  /** 关闭后焦点交还的元素；缺省为打开时的焦点元素。 */
  returnFocus?: HTMLElement | null;
}

interface PickerHandle {
  /** 立即卸载，不回调、不保存。 */
  release: () => void;
  focus: () => void;
  closing: boolean;
}

// 页面级单例键：跨 bundle 实例可见，后注入者据此接管前一份面板。
const PICKER_KEY = "__imwShufflePicker";
type PickerWindow = Window & { [PICKER_KEY]?: PickerHandle };

// 系统返回：打开时登记一条带插件标记的历史条目，弹出即取消；以其他方式关闭时撤回。
// 标记写在 history.state 上。重复注入接管时只解绑旧面板的监听、不动历史：
// 旧条目会留在历史里（之后按返回只是回到它，不再关闭任何面板）。
const HISTORY_KEY = "__imwShufflePickerEntry";
// 正在撤回（已调 history.back、popstate 未到）的页面级记录：随之而来的 popstate
// 不能被任何面板当作返回取消；期间新开的面板等它落地后再登记条目。
const RETRACT_KEY = "__imwShufflePickerRetract";
const RETRACT_MARK = "__imwShufflePickerRetracted";
/** popstate 迟迟不到（浏览器未执行回退）时放弃等待。 */
const RETRACT_TIMEOUT_MS = 1000;

interface HistoryRetraction {
  waiters: Set<() => void>;
}
type HistoryWindow = Window & { [RETRACT_KEY]?: HistoryRetraction };
type MarkedEvent = Event & { [RETRACT_MARK]?: boolean };

let tokenSeq = 0;

function historyToken(): unknown {
  try {
    const state = history.state as Record<string, unknown> | null;
    return state && typeof state === "object" ? state[HISTORY_KEY] : undefined;
  } catch {
    return undefined;
  }
}

/** 回退一步撤回本面板条目；随之而来的 popstate 打上标记，面板监听据此忽略。 */
function retractHistoryEntry(): void {
  const page = window as HistoryWindow;
  const retraction: HistoryRetraction = { waiters: new Set() };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settle = (event?: Event) => {
    if (event) (event as MarkedEvent)[RETRACT_MARK] = true;
    window.removeEventListener("popstate", settle, true);
    clearTimeout(timer);
    if (page[RETRACT_KEY] === retraction) delete page[RETRACT_KEY];
    // 超时放行等待者，但回退可能只是迟到：保留一次性标记，迟到的 popstate 仍被忽略。
    if (!event)
      window.addEventListener("popstate", markLate, {
        capture: true,
        once: true,
      });
    for (const waiter of retraction.waiters) waiter();
  };
  const markLate = (event: Event) => {
    (event as MarkedEvent)[RETRACT_MARK] = true;
  };
  // 捕获阶段注册：无论面板监听何时注册，同一次派发里总是先打标记。
  window.addEventListener("popstate", settle, true);
  page[RETRACT_KEY] = retraction;
  timer = setTimeout(() => settle(), RETRACT_TIMEOUT_MS);
  try {
    history.back();
  } catch {
    settle();
  }
}

/** 卸载当前页面上的选择面板（含旧 bundle 留下的根节点），不触发回调。 */
export function releaseShufflePicker(): void {
  const page = window as PickerWindow;
  const previous = page[PICKER_KEY];
  delete page[PICKER_KEY];
  try {
    previous?.release();
  } catch {
    /* 旧实例已不可用；残留节点由下面清除 */
  }
  for (const node of document.querySelectorAll(`#${SHUFFLE_PICKER_ROOT_ID}`))
    node.remove();
}

function canRestoreFocus(element: HTMLElement | null | undefined) {
  return (
    !!element &&
    element.isConnected &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden"
  );
}

/** 与 HostMediaBridge 同一判定：宿站 `window.theme` 为假值即深色。 */
function hostDark(): boolean {
  return !(window as unknown as { theme?: unknown }).theme;
}

/** 当前平台收藏只在打开时读一次；读不到按空收藏显示。 */
async function loadSource(platform: ShufflePlatform): Promise<PickerSource> {
  const records = await FavoritesStorageService.query({ platform });
  return { records, saved: loadShuffleSelection(platform) };
}

/** 确认时与当前收藏对齐：打开期间已删除的收藏丢弃。 */
async function alignWithFavorites(
  platform: ShufflePlatform,
  selection: ShuffleSelection,
): Promise<ShuffleSelection> {
  try {
    const current = new Set(
      (await FavoritesStorageService.query({ platform })).map(
        (record) => record.id,
      ),
    );
    return {
      ...selection,
      items: selection.items.filter((item) => current.has(item.id)),
    };
  } catch {
    return selection;
  }
}

export function openShufflePicker(options: OpenShufflePickerOptions): void {
  const page = window as PickerWindow;
  const existing = page[PICKER_KEY];
  if (existing && !existing.closing) {
    existing.focus();
    return;
  }
  releaseShufflePicker();

  const returnFocus =
    options.returnFocus ??
    (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);
  const root = document.createElement("div");
  root.id = SHUFFLE_PICKER_ROOT_ID;
  document.body.appendChild(root);

  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  // —— 历史条目 ——
  const token = `${Date.now()}-${++tokenSeq}`;
  let pushed = false;
  // 登记后的会话历史长度：变长说明有新条目（如宿站改 hash），不是回退越过本条目。
  let pushedLength = 0;
  const pushEntry = () => {
    (window as HistoryWindow)[RETRACT_KEY]?.waiters.delete(pushEntry);
    if (finished || handle.closing || pushed) return;
    try {
      history.pushState({ [HISTORY_KEY]: token }, "");
      pushed = true;
      pushedLength = history.length;
    } catch {
      /* 历史不可写（沙箱等）：面板照常可用，只是返回键不关它 */
    }
  };
  // 本面板条目被弹出（系统返回）即按取消处理；撤回引起的 popstate 一律忽略。
  const onPopState = (event: Event) => {
    if ((event as MarkedEvent)[RETRACT_MARK]) return;
    if (!pushed || historyToken() === token) return;
    if (history.length > pushedLength) return;
    pushed = false;
    dismiss();
  };
  // 接管只解绑监听、不动历史；关闭时另行撤回。
  const unbindHistory = () => {
    window.removeEventListener("popstate", onPopState);
    (window as HistoryWindow)[RETRACT_KEY]?.waiters.delete(pushEntry);
  };
  const retract = () => {
    unbindHistory();
    // 历史已被他人改动（当前条目不是本面板的，或会话历史已变长——联合历史里
    // 回退会退掉别人的条目）则不撤回。
    if (pushed && historyToken() === token && history.length === pushedLength)
      retractHistoryEntry();
    pushed = false;
  };

  const unmount = () => {
    clearTimeout(exitTimer);
    unbindHistory();
    if (finished) return;
    finished = true;
    render(null, root);
    root.remove();
    if (page[PICKER_KEY] === handle) delete page[PICKER_KEY];
  };
  const handle: PickerHandle = {
    release: unmount,
    focus: () =>
      root
        .querySelector<HTMLElement>("#imw-shuffle-picker")
        ?.focus({ preventScroll: true }),
    closing: false,
  };
  page[PICKER_KEY] = handle;

  const dark = hostDark();
  const load = () => loadSource(options.platform);
  // 确认对齐收藏的短暂异步期间不再接受取消或二次确认；主按钮显示忙碌。
  let confirming = false;
  let error = "";
  const view = (exiting = false) => (
    <ShufflePicker
      platform={options.platform}
      dark={dark}
      load={load}
      exiting={exiting}
      busy={confirming}
      error={error}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
  const update = () => {
    if (!finished && !handle.closing) render(view(), root);
  };

  // 关闭：先标记（再次打开不再聚焦它），播退场动效后卸载，焦点还给打开者。
  const close = () => {
    if (handle.closing) return false;
    handle.closing = true;
    retract();
    render(view(true), root);
    exitTimer = setTimeout(unmount, EXIT_MS);
    if (canRestoreFocus(returnFocus))
      returnFocus!.focus({ preventScroll: true });
    return true;
  };
  function cancel() {
    if (confirming) return;
    if (close()) options.onCancel?.();
  }
  // 系统返回：条目已不在，确认对齐中也照样取消（对齐结果随后作废）。
  function dismiss() {
    if (close()) options.onCancel?.();
  }
  // 失败时留在面板：复位忙碌态并在底栏给出原因，可重试或取消。
  const fail = (message: string) => {
    confirming = false;
    error = message;
    update();
  };
  function confirm(selection: ShuffleSelection) {
    if (handle.closing || confirming) return;
    confirming = true;
    error = "";
    update();
    void alignWithFavorites(options.platform, selection).then((aligned) => {
      // 对齐期间被接管（重复注入）或经系统返回取消则作废：不保存、不回调。
      if (finished || handle.closing) return;
      if (aligned.items.length === 0) {
        fail("所选收藏已被删除，请重新选择");
        return;
      }
      try {
        saveShuffleSelection(options.platform, aligned);
      } catch {
        // 本机存储写不进（配额、隐私模式）。
        fail("保存失败，请重试");
        return;
      }
      confirming = false;
      close();
      options.onConfirm?.(aligned);
    });
  }

  render(view(false), root);
  window.addEventListener("popstate", onPopState);
  const pending = (window as HistoryWindow)[RETRACT_KEY];
  if (pending) pending.waiters.add(pushEntry);
  else pushEntry();
}
