// 面板内浮层的层级栈（CAP-14 单点调度）：谁打开谁登记一层，`Esc` 与宿站返回键
// 都只问「最上层是谁」，每按一次只关一层。取代旧的 DOM 探针（`[data-imw-order-menu]`）
// 与各浮层自管的 `Esc` 监听。
//
// 关闭顺序：选集 / 收藏随机面板（独立根，自己管）> 操作条 / 展开的底部条 / 顺序菜单
//（主面板内最上层，三者互斥）> 专辑·歌单内页 > 主面板。

export type OverlayLayerKind = "sheet" | "deck" | "order" | "inner";

interface OverlayLayer {
  kind: OverlayLayerKind;
  dismiss: () => void;
}

/** 主面板内最上层：三者互斥，`closePanelTier` 保证同时只留一个。 */
const PANEL_TIER: readonly OverlayLayerKind[] = ["sheet", "deck", "order"];

/** 从下到上登记；栈顶是最后一个。 */
const layers: OverlayLayer[] = [];

/** 面板自己的返回处理器：非空 = 面板开着。 */
let panelBackHandler: (() => void) | null = null;
let escapeListenerInstalled = false;
/** `Utils.backward` 的包装每个页面只装一次（随机面板会再包一层，别跟着它叠）。 */
let backHookInstalled = false;

/**
 * 独立根：随机面板与播放进度浮窗在**自己的元素上**处理 `Esc`。栈监听是 `document`
 * 捕获、跑在最前，所以必须放行这两处的来源事件，否则面板内的层会先吃掉它们的 `Esc`。
 */
const FOREIGN_ROOTS = "#imw-shuffle-picker-root, #imw-media-progress-root";

function isForeignEvent(target: EventTarget | null): boolean {
  const node = target as Node | null;
  if (!node) return false;
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return !!element?.closest?.(FOREIGN_ROOTS);
}

function handleEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.isComposing) return;
  if (event.defaultPrevented) return;
  if (!layers.length) return;
  if (isForeignEvent(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  // 按住不放产生的重复事件照样吞掉，但不再往下走：一次按键只关一层。
  if (event.repeat) return;
  dismissTopOverlay();
}

/** 栈非空时装 `document` 捕获监听，空时卸下（不留空监听）。 */
function syncEscapeListener(): void {
  const wanted = layers.length > 0;
  if (wanted === escapeListenerInstalled) return;
  escapeListenerInstalled = wanted;
  if (wanted) document.addEventListener("keydown", handleEscape, true);
  else document.removeEventListener("keydown", handleEscape, true);
}

/** 登记一层，返回幂等的注销函数（组件卸载时调用）。 */
export function pushOverlayLayer(
  kind: OverlayLayerKind,
  dismiss: () => void,
): () => void {
  const layer: OverlayLayer = { kind, dismiss };
  layers.push(layer);
  syncEscapeListener();
  return () => {
    const index = layers.indexOf(layer);
    if (index === -1) return;
    layers.splice(index, 1);
    syncEscapeListener();
  };
}

/**
 * 关掉最上一层（`Esc` 与宿站返回键共用）。先把层从栈里摘掉再执行 `dismiss`：
 * dismiss 引起的组件注销因此是空操作，连按不会第二次落到同一层上。
 */
export function dismissTopOverlay(): boolean {
  const layer = layers.pop();
  if (!layer) return false;
  syncEscapeListener();
  layer.dismiss();
  return true;
}

/** 互斥：收起面板内最上层的其它成员；内页是另一档，不参与互斥。 */
export function closePanelTier(keep: OverlayLayerKind): void {
  for (const layer of [...layers]) {
    if (layer.kind === keep || !PANEL_TIER.includes(layer.kind)) continue;
    const index = layers.indexOf(layer);
    if (index === -1) continue;
    layers.splice(index, 1);
    layer.dismiss();
  }
  syncEscapeListener();
}

export function hasOverlayLayers(): boolean {
  return layers.length > 0;
}

// —— 宿站返回键 ——
// 宿站自己用 `onpopstate → Utils.backward()` 实现返回。面板打开期间接管它：有层只关层，
// 没有层时关面板；面板关着时把调用原样交还原函数。插件不读写浏览历史。
// 包装函数每页只装一次（函数对象带标记），当前分发器经页面级槽位登记，
// 这样重复注入时新实例仍能接管旧包装留下的一次返回。
const BACK_HOOK_MARK = "__imwOverlayBackHook";
const BACK_DISPATCH_KEY = "__imwOverlayBackDispatch";
/** 随机面板的槽位键（`openShufflePicker.tsx` 的 `BACK_SLOT_KEY`）：它在时返回先交给它。 */
const SHUFFLE_BACK_SLOT = "__imwShufflePickerBack";

type HostBackward = ((...args: unknown[]) => unknown) & {
  [BACK_HOOK_MARK]?: true;
};
type BackWindow = Window & {
  Utils?: { backward?: HostBackward };
  [BACK_DISPATCH_KEY]?: (callOriginal: () => unknown) => unknown;
  [SHUFFLE_BACK_SLOT]?: (() => void) | null;
};

/**
 * 一次返回只关一层：随机面板 > 面板内的层 > 面板；都没有时交还宿站照常执行。
 * 随机面板是单槽位包装——面板关着从侧栏打开它、再 `Alt+S` 打开面板时它反而在里层，
 * 此时把调用交给它自己的包装，返回才会先关它。
 */
function dispatchBack(callOriginal: () => unknown): unknown {
  const page = window as BackWindow;
  if (page[SHUFFLE_BACK_SLOT]) return callOriginal();
  if (!layers.length && !panelBackHandler) return callOriginal();
  if (layers.length) {
    dismissTopOverlay();
    return undefined;
  }
  panelBackHandler?.();
  return undefined;
}

/** 确保宿站 `Utils.backward` 已被包装；宿站没有该函数时返回 false（返回键不关层）。 */
function ensureBackHook(page: BackWindow): boolean {
  const utils = page.Utils;
  const original = utils?.backward;
  if (!utils || typeof original !== "function") return false;
  // 每页只装一次：随机面板会再包一层（`__imwShufflePickerBackHook`），只看自身标记会
  // 在它之后每次重开面板时又包一层，链一整个会话越叠越长。装过就复用，委托给当时的前一个函数。
  if (backHookInstalled || original[BACK_HOOK_MARK]) return true;
  const wrapped: HostBackward = function (this: unknown, ...args: unknown[]) {
    const dispatch = page[BACK_DISPATCH_KEY];
    if (!dispatch) return original.apply(this, args);
    return dispatch(() => original.apply(this, args));
  };
  wrapped[BACK_HOOK_MARK] = true;
  backHookInstalled = true;
  utils.backward = wrapped;
  return true;
}

/** 面板开 / 关时登记处理器（`null` = 面板关着，返回键原样交还宿站）。 */
export function setPanelBackHandler(handler: (() => void) | null): void {
  panelBackHandler = handler;
  if (!handler) return;
  const page = window as BackWindow;
  page[BACK_DISPATCH_KEY] = dispatchBack;
  ensureBackHook(page);
}
