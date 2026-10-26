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
  const unmount = () => {
    clearTimeout(exitTimer);
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
      // 对齐期间被接管（重复注入）则作废：不保存、不回调。
      if (finished) return;
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
}
