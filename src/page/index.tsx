import { render } from "preact";
import { MainAppControlLayer } from "./MainAppControlLayer";
import { MediaProgress } from "./components/media-progress/MediaProgress";
import { HostMediaBridge } from "../media-progress/HostMediaBridge";
import { SidebarMediaEntry } from "../media-progress/SidebarMediaEntry";
import { PlaybackMode } from "../playback/PlaybackMode";
import { SidebarPlaybackRow } from "../playback/SidebarPlaybackRow";
import { LoopController } from "../playback/LoopController";
import {
  SHUFFLE_REASONS,
  ShuffleController,
} from "../playback/ShuffleController";
import { ShowMessage } from "../iirose_func/ShowMessage";
import { CutWatcher } from "../playback/CutWatcher";
import {
  prepareShuffleTarget,
  queryShuffleCandidates,
} from "../playback/shuffleTargets";
import { loadShuffleSelection } from "../playback/ShuffleSelection";
import { platformOf, readPanelFocus } from "../playback/PanelFocus";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import {
  openShufflePicker,
  releaseShufflePicker,
} from "./components/shuffle-picker/openShufflePicker";
import { MediaPayloadMemory } from "../playback/MediaPayloadMemory";
import { Announce } from "../iirose_func/Socket/Announce";
import { Socket } from "../iirose_func/Socket";
import {
  readMediaProgressPosition,
  saveMediaProgressPosition,
} from "../media-progress/PositionStorage";

let disposeProgress: (() => void) | undefined;

// 页面级单例键：模块级 disposeProgress 只在同一份 bundle 内有效，重复注入（另一份
// 模块实例、热更新残留）感知不到它。后注入者先释放前一份控制器再接管。
const CONTROLLER_KEY = "__imwMediaProgressController";
type ControllerWindow = Window & { [CONTROLLER_KEY]?: () => void };

// 释放旧实例并清掉它可能残留的节点：即使旧 dispose 抛错也不允许出现双行。
function releasePlaybackController(page: ControllerWindow) {
  const previous = page[CONTROLLER_KEY];
  delete page[CONTROLLER_KEY];
  try {
    previous?.();
  } catch {
    /* 旧实例已不可用；残留节点由下面按 id 清除 */
  }
  for (const id of [
    "imw-playback-controls",
    "imw-media-progress-entry",
    "imw-media-progress-root",
  ])
    document.getElementById(id)?.remove();
}

function initMediaProgress() {
  disposeProgress?.();
  disposeProgress = undefined;
  const page = window as ControllerWindow;
  releasePlaybackController(page);
  const root = document.createElement("div");
  root.id = "imw-media-progress-root";
  // 宿站 mainContainer 和插件主面板都会平移；独立挂到 body。
  document.body.appendChild(root);
  // 构造阶段的资源先占位后赋值：dispose 可能在构造中途（或构造抛错后）被调用。
  let bridge!: HostMediaBridge;
  let playback!: PlaybackMode;
  let playbackRow!: SidebarPlaybackRow;
  let loop!: LoopController;
  let shuffle: ShuffleController | undefined;
  const cutWatcher = new CutWatcher();
  let memory: MediaPayloadMemory | undefined;
  let sidebar!: SidebarMediaEntry;
  let unsubscribePlayback: (() => void) | undefined;
  let close: (restoreFocus?: boolean) => void = () => {};
  let onPageHide: (event: PageTransitionEvent) => void = () => {};
  let disposed = false;
  // 每一步独立兜错：任一环节抛错都不能跳过后面的解绑（定时器、pagehide、页面键）。
  const safely = (step: () => void) => {
    try {
      step();
    } catch {
      /* 继续释放其余环节 */
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    try {
      // 释放顺序：先断订阅，再让状态机与适配器、行、桥接依次停摆。
      // 行元素由 SidebarPlaybackRow 自己移除，SidebarMediaEntry 只解除适配。
      safely(() => close(false));
      safely(() => releaseShufflePicker());
      safely(() => unsubscribePlayback?.());
      safely(() => loop?.dispose());
      safely(() => shuffle?.dispose());
      // 只摘掉属于自己的观察者：后注入者接管后不能清掉新实例的钩子。
      if (Socket.observe === observeSocket) Socket.observe = undefined;
      safely(() => memory?.clear());
      safely(() => playback?.dispose());
      safely(() => sidebar?.dispose());
      safely(() => playbackRow?.dispose());
      safely(() => bridge?.dispose());
      safely(() => root.remove());
    } finally {
      window.removeEventListener("pagehide", onPageHide);
      // 只摘掉属于自己的标记：后注入者接管后这里不能清掉新实例。
      if (page[CONTROLLER_KEY] === dispose) delete page[CONTROLLER_KEY];
    }
  };
  // 先登记页面键再构造：构造中途抛错时，后注入者仍能释放已创建的实例（含 250ms 轮询）。
  page[CONTROLLER_KEY] = dispose;
  disposeProgress = dispose;
  bridge = new HostMediaBridge();
  playback = new PlaybackMode();
  // 随机点亮前先经选择面板：确认才作废旧预取并点亮，取消什么都不改。
  // shuffle 在行之后构造，回调运行时再读取。
  playbackRow = new SidebarPlaybackRow(playback, document, {
    pickShuffle: (done) => {
      const platform = platformOf(
        readPanelFocus(),
        PluginSettings.getPluginSetting().defaultPage,
      );
      // 可用性已覆盖「当前页面没有收藏」；这里只防焦点与可用性求值之间的竞态。
      if (!platform) {
        ShowMessage.show(SHUFFLE_REASONS.noFavorites);
        return;
      }
      openShufflePicker({
        platform,
        returnFocus: playbackRow.element.querySelector<HTMLElement>(
          "#imw-toggle-shuffle",
        ),
        onConfirm: () => {
          if (disposed) return;
          shuffle?.invalidate();
          done();
        },
      });
    },
  });
  memory = new MediaPayloadMemory();
  // 只观察插件自己发出的报文：重播只对插件点播过的曲目可用。
  const observeSocket = (data: string) => memory?.record(data);
  Socket.observe = observeSocket;
  shuffle = new ShuffleController(
    playback,
    bridge,
    {
      query: (platform) => queryShuffleCandidates(platform),
      prepare: (record, options) => prepareShuffleTarget(record, options),
      loadSelection: (platform) => loadShuffleSelection(platform),
      now: () => Date.now(),
    },
    cutWatcher,
  );
  loop = new LoopController(
    playback,
    bridge,
    memory,
    {
      sendCard: (card) => Announce.sendMediaCard(new Socket(), card),
      sendPayload: (payload) => new Socket().send(payload),
      localSeek: (seconds) => {
        const service = (
          window as unknown as {
            Utils?: { service?: { seekDemandMedia?: (time: number) => void } };
          }
        ).Utils?.service;
        if (typeof service?.seekDemandMedia !== "function")
          throw new Error("宿站本地定位不可用");
        service.seekDemandMedia(seconds);
      },
    },
    () => Date.now(),
    cutWatcher,
  );
  let visible = false;
  let lastPosition = readMediaProgressPosition();
  close = (restoreFocus = true) => {
    saveMediaProgressPosition(lastPosition);
    visible = false;
    render(null, root);
    const entry = document.getElementById("imw-media-progress-entry");
    if (
      restoreFocus &&
      entry?.getClientRects().length &&
      getComputedStyle(entry).visibility === "visible"
    )
      entry.focus({ preventScroll: true });
  };
  sidebar = new SidebarMediaEntry(
    () => {
      if (!visible) {
        visible = true;
        render(
          <MediaProgress
            bridge={bridge}
            close={close}
            initialPosition={lastPosition}
            onPositionChange={(position) => {
              lastPosition = position;
              saveMediaProgressPosition(position);
            }}
          />,
          root,
        );
      }
      root.querySelector<HTMLElement>("#imw-media-progress")?.focus();
    },
    document,
    playbackRow.element,
    (present) => playback.setMediaPresent(present),
  );
  unsubscribePlayback = bridge.subscribe((snapshot) =>
    playback.applySnapshot(snapshot),
  );
  loop.attach();
  shuffle.attach();
  onPageHide = (event: PageTransitionEvent) => {
    saveMediaProgressPosition(lastPosition);
    if (!event.persisted) dispose();
  };
  window.addEventListener("pagehide", onPageHide);
}

// 主面板同样按页面级单例键接管：卸载要用挂载它的那份 Preact，才能走到
// componentWillUnmount 摘掉全局热键与手势监听。
const PANEL_KEY = "__imwMainPanel";
type PanelWindow = Window & { [PANEL_KEY]?: () => void };

function releaseMainPanel(page: PanelWindow) {
  const previous = page[PANEL_KEY];
  delete page[PANEL_KEY];
  try {
    previous?.();
  } catch {
    /* 旧实例已不可用；残留容器由下面清除 */
  }
  // 没有单例键的旧版 bundle 只能清 DOM：至少不让同页出现两个主面板。
  for (const panel of document.querySelectorAll("#IIROSE_MEDIA_CONTAINER"))
    (panel.parentElement ?? panel).remove();
}

// 调试入口（不经侧栏、不点亮）：真机控制台 `window.iirosemedia.openShufflePicker()`。
function registerShufflePickerEntry() {
  const namespace = (window.iirosemedia ??= {});
  namespace.openShufflePicker = (platform) => {
    // 控制台调用不受类型约束：只认两个收藏平台。
    if (
      platform !== undefined &&
      platform !== "netease" &&
      platform !== "bilibili"
    ) {
      console.warn(
        `[IIROSE-MEDIA-WEB] 未知的收藏平台 ${String(platform)}，只支持 netease / bilibili`,
      );
      return;
    }
    const target =
      platform ??
      platformOf(
        readPanelFocus(),
        PluginSettings.getPluginSetting().defaultPage,
      );
    if (!target) {
      console.warn("[IIROSE-MEDIA-WEB] 当前面板平台没有收藏，无法打开收藏随机");
      return;
    }
    openShufflePicker({ platform: target });
  };
}

export class IMCInit {
  public static init(mc: HTMLDivElement) {
    const page = window as PanelWindow;
    releaseMainPanel(page);
    releaseShufflePicker();
    registerShufflePickerEntry();
    const container = document.createElement("div");
    mc.appendChild(container);
    render(<MainAppControlLayer />, container);
    page[PANEL_KEY] = () => {
      render(null, container);
      container.remove();
    };
    initMediaProgress();
  }
}
