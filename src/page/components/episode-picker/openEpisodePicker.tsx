// 选集面板的命令式入口（CAP-8 / CAP-14）：独立根挂 body、同页单例，自管加载状态机、
// 点选顺序与退场动效。调用点是平台静态代码（`BilibiliPlatform.VOD`、
// `NetEasePlatform.MLOD/AOD`、`AllVideosPlatform.VOD`）、手机操作条与收藏点播——
// 都可能在主面板之外，所以照随机面板的做法用 body 根 + `z-[90010]`。
//
// `Esc` / 宿站返回键交给 `overlayLayers` 的层栈（新增 `episode` 层），不另开单槽位：
// 两套槽位会在同一次返回里抢。
import { render } from "preact";
import { hostIsDark } from "../../../iirose_func/HostTheme";
import { restoreFocus } from "../desk/focusTrap";
import { ensureOverlayBackHook, pushOverlayLayer } from "../desk/overlayLayers";
import {
  EpisodePicker,
  resolveEpisodeOrder,
  selectAllEpisodes,
  toggleEpisode,
  type EpisodePickEntry,
  type EpisodePickOrder,
  type EpisodePickStatus,
} from "./EpisodePicker";

export const EPISODE_PICKER_ROOT_ID = "imw-episode-picker-root";
/** 退场动效时长上限（退场淡出 160ms，留余量后卸载）。 */
const EXIT_MS = 200;
/** 面板的数据类型对调用方只经这里暴露（平台层只 import 这一个模块）。 */
export type { EpisodePickEntry, EpisodePickOrder } from "./EpisodePicker";

/**
 * 触发元素是否能当焦点归还点：`document.body` / 根元素（移动端点按不聚焦时
 * `document.activeElement` 就是 body）没有意义，按「没有触发元素」处理；
 * 落在选集面板自己的根里也不算——退场中重开时焦点还留在上一份面板的按钮上，
 * 记成归还点会把新面板的焦点送回上一份面板的来源。
 */
function isReturnTarget(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element !== document.body &&
    element !== document.documentElement &&
    !element.closest?.("[data-imw-episode-picker]")
  );
}

export interface OpenEpisodePickerOptions {
  /** 数量单位：视频 / 剧集「集」、网易云曲目「首」。 */
  unit: string;
  /** 打开后取分集；失败留在面板里可重试（不点播）。 */
  load: () => Promise<EpisodePickEntry[]>;
  /** 确认：按播放顺序排好的条目（正序 = 点选顺序，乱序 = 随机置换）。 */
  onConfirm: (entries: EpisodePickEntry[]) => void;
  onCancel?: () => void;
  /** 关闭后焦点交还的元素；缺省为打开时的焦点元素。 */
  returnFocus?: HTMLElement | null;
}

interface PickerHandle {
  /** 立即卸载，不回调。 */
  release: () => void;
  focus: () => void;
  closing: boolean;
}

// 页面级单例键：跨 bundle 实例可见，后注入者据此接管前一份面板。
const PICKER_KEY = "__imwEpisodePicker";
type PickerWindow = Window & { [PICKER_KEY]?: PickerHandle };

/** 卸载当前页面上的选集面板（含旧 bundle 留下的根节点），不触发回调。 */
export function releaseEpisodePicker(): void {
  const page = window as PickerWindow;
  const previous = page[PICKER_KEY];
  delete page[PICKER_KEY];
  try {
    previous?.release();
  } catch {
    /* 旧实例已不可用；残留节点由下面清除 */
  }
  for (const node of document.querySelectorAll(`#${EPISODE_PICKER_ROOT_ID}`))
    node.remove();
}

export function openEpisodePicker(options: OpenEpisodePickerOptions): void {
  const page = window as PickerWindow;
  const existing = page[PICKER_KEY];
  // 已在打开态：只把焦点送回面板，不叠第二份。
  if (existing && !existing.closing) {
    existing.focus();
    return;
  }
  // 先在清单例之前读焦点：`releaseEpisodePicker()` 会把旧面板的焦点元素一起摘掉
  // （它自己的清理还会归还一次焦点），这之后再读就不是调用方的触发元素了。
  const captured = isReturnTarget(document.activeElement)
    ? document.activeElement
    : null;
  releaseEpisodePicker();

  const returnFocus = options.returnFocus ?? captured;
  const root = document.createElement("div");
  root.id = EPISODE_PICKER_ROOT_ID;
  // 面板根在 `.IIROSE_MEDIA_CONTAINER` 之外，拿不到它写的 `data-imw-theme`：
  // 自己写一份，`imw-dark:` 成对令牌才会命中（与浮窗同一判定）。
  root.dataset.imwTheme = hostIsDark() ? "dark" : "light";
  document.body.appendChild(root);

  let status: EpisodePickStatus = "loading";
  let entries: EpisodePickEntry[] = [];
  let selected: string[] = [];
  let order: EpisodePickOrder = "asc";
  let finished = false;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  /** 层栈的注销函数（`Esc` / 返回键登记的那一层）。 */
  let releaseLayer: () => void = () => {};

  const update = () => {
    if (!finished && !handle.closing) render(view(false), root);
  };

  const unmount = () => {
    clearTimeout(exitTimer);
    releaseLayer();
    if (finished) return;
    finished = true;
    render(null, root);
    root.remove();
    if (page[PICKER_KEY] === handle) delete page[PICKER_KEY];
    // 触发元素可能已经卸载（网易云从宿站弹窗确认进来时，触发钮随后被清空）：
    // 只对仍在文档内的元素归还焦点，别把焦点丢给 body。
    if (returnFocus?.isConnected) restoreFocus(returnFocus);
  };

  const handle: PickerHandle = {
    release: unmount,
    focus: () => focusClose(),
    closing: false,
  };
  page[PICKER_KEY] = handle;

  const focusClose = () =>
    root
      .querySelector<HTMLElement>('[aria-label="关闭选集"]')
      ?.focus({ preventScroll: true });

  // 关闭：先标记（再次打开不再聚焦它），播退场动效后卸载，焦点归还打开者。
  const close = () => {
    if (handle.closing) return false;
    handle.closing = true;
    render(view(true), root);
    exitTimer = setTimeout(unmount, EXIT_MS);
    return true;
  };
  function cancel() {
    if (close()) options.onCancel?.();
  }

  const confirm = () => {
    if (handle.closing || status !== "ready") return;
    // 未选任何项：按钮本就是禁用态，这里再拦一次（不发报文、不关面板）。
    if (!selected.length) return;
    const ordered = resolveEpisodeOrder(entries, selected, order);
    if (!ordered.length) return;
    close();
    options.onConfirm(ordered);
  };

  const runLoad = async () => {
    try {
      const list = await options.load();
      if (finished || handle.closing) return;
      entries = Array.isArray(list) ? list : [];
      selected = [];
      status = "ready";
    } catch {
      if (finished || handle.closing) return;
      entries = [];
      selected = [];
      status = "failed";
    }
    update();
    focusClose();
  };

  const retry = () => {
    if (status === "loading") return;
    status = "loading";
    entries = [];
    selected = [];
    update();
    void runLoad();
  };

  const view = (exiting: boolean) => (
    <EpisodePicker
      unit={options.unit}
      status={status}
      entries={entries}
      selected={selected}
      order={order}
      exiting={exiting}
      onToggle={(id) => {
        selected = toggleEpisode(selected, id);
        update();
      }}
      onToggleAll={() => {
        selected =
          entries.length > 0 && selected.length === entries.length
            ? []
            : selectAllEpisodes(entries);
        update();
      }}
      onOrderChange={(next) => {
        order = next;
        update();
      }}
      onRetry={retry}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );

  // 层栈登记：`Esc` 与宿站返回键只关这一层（面板内的操作条 / 内页在它下面）。
  releaseLayer = pushOverlayLayer("episode", cancel);
  // 平台层直接打开面板时主面板可能没开：返回键的包装要在这里补装。
  ensureOverlayBackHook();

  render(view(false), root);
  focusClose();
  void runLoad();
}
