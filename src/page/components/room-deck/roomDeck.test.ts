import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import { h, render } from "preact";
import type { HostMediaBridge } from "../../../media-progress/HostMediaBridge";
import {
  provideMediaSession,
  releaseMediaSession,
} from "../../../media-progress/MediaSession";
import type { MediaSessionHandle } from "../../../media-progress/MediaSession";
import {
  unavailableReason,
  type MediaControlMode,
  type MediaSnapshot,
} from "../../../media-progress/model";
import { PlaybackMode } from "../../../playback/PlaybackMode";
import { SidebarPlaybackRow } from "../../../playback/SidebarPlaybackRow";
import { snapshot } from "../../../playback/fixtures";
import { RoomDeck } from "./RoomDeck";

// 底部条的桥接替身：与宿站桥接同一个形状（read / subscribe / send），
// 只在测试里改快照与记录报文；真实的 250ms 轮询与宿站钩子由 HostMediaBridge 自己测。
class FakeBridge {
  current: MediaSnapshot;
  sent: string[] = [];
  controlUnavailable = false;
  controlUnavailableMessage = "宿站进度控制不可用";
  private listeners = new Set<(media: MediaSnapshot) => void>();

  constructor(media: MediaSnapshot) {
    this.current = media;
  }

  read(): MediaSnapshot {
    return { ...this.current };
  }

  subscribe(listener: (media: MediaSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.read());
    return () => {
      this.listeners.delete(listener);
    };
  }

  send(command: string, instance: number, controlMode: MediaControlMode) {
    if (unavailableReason(this.current)) return false;
    if (
      this.current.instance !== instance ||
      this.current.controlMode !== controlMode
    )
      return false;
    this.sent.push(command);
    return true;
  }

  emit(patch: Partial<MediaSnapshot>) {
    this.current = { ...this.current, ...patch };
    for (const listener of [...this.listeners]) listener(this.read());
  }
}

let host: HTMLDivElement;
let alert: ReturnType<typeof vi.fn>;

interface Harness {
  bridge: FakeBridge;
  playback: PlaybackMode;
  session: MediaSessionHandle;
  picks: (() => void)[];
}

function harness(patch: Partial<MediaSnapshot> = {}, present = true): Harness {
  const media = snapshot(patch);
  const bridge = new FakeBridge(media);
  const playback = new PlaybackMode();
  // 与页面接线一致：桥接快照驱动模式机的 availability。
  bridge.subscribe((next) => playback.applySnapshot(next));
  playback.setMediaPresent(present);
  const picks: (() => void)[] = [];
  const session: MediaSessionHandle = {
    bridge: bridge as unknown as HostMediaBridge,
    playback,
    pickShuffle: (done) => picks.push(done),
  };
  return { bridge, playback, session, picks };
}

const deck = (name: "room" | "mini" | "expanded") =>
  host.querySelector<HTMLElement>(`[data-imw-deck="${name}"]`);
const toggleIn = (
  name: "room" | "mini" | "expanded",
  kind: "loop" | "shuffle",
) => deck(name)?.querySelector<HTMLButtonElement>(`[data-imw-mode="${kind}"]`);
const miniBody = () => deck("mini")!.querySelector("button")!;

function mount(active = true, mode = 0) {
  act(() => {
    render(h(RoomDeck, { active, mode }), host);
  });
}

/** 派发一次指针事件（jsdom 没有 PointerEvent 构造器的完整实现）。 */
function pointer(target: Element, type: string, clientX: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX,
  });
  act(() => {
    target.dispatchEvent(event);
  });
}

function key(target: Element, value: string, shiftKey = false) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: value,
        shiftKey,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  alert = vi.fn();
  Object.assign(window, { _alert: alert });
});

afterEach(() => {
  act(() => {
    render(null, host);
  });
  host.remove();
  releaseMediaSession();
  delete (window as { _alert?: unknown })._alert;
});

describe("会话尚未提供", () => {
  it("底部条不渲染；提供后立即渲染，无需重开面板", () => {
    mount();
    expect(host.childElementCount).toBe(0);

    const { session } = harness();
    act(() => {
      provideMediaSession(session);
    });
    expect(deck("room")).not.toBeNull();
    expect(deck("mini")).not.toBeNull();
    // 两个挂载点 id 保留（三形态的落点）
    expect(host.querySelector("#imw-desk-room-deck")).not.toBeNull();
    expect(host.querySelector("#imw-desk-mini-deck")).not.toBeNull();
  });
});

describe("桌面三栏（room-deck）", () => {
  it("封面 + 标签 + 标题 + 点播者、时间 · 轨道 · 总时长、两组带文字开关", () => {
    const { session } = harness({
      owner: "小飞鱼",
      ownMedia: false,
      current: 30,
      duration: 200,
    });
    provideMediaSession(session);
    mount();

    const root = deck("room")!;
    expect(root.textContent).toContain("Now in room");
    expect(root.textContent).toContain("测试曲目");
    expect(root.textContent).toContain("小飞鱼 点播");
    expect(root.textContent).toContain("0:30");
    expect(root.textContent).toContain("3:20");
    expect(root.querySelector('[role="slider"]')).not.toBeNull();
    expect(toggleIn("room", "loop")!.textContent).toContain("单曲循环");
    expect(toggleIn("room", "shuffle")!.textContent).toContain("收藏随机");
  });

  it("本人点播显示「由你点播」，进度可拖动，并给出「会在房间发消息」的提示", () => {
    const { session } = harness({
      owner: "铭铭",
      ownMedia: true,
      controlMode: "owner",
      controlNotice: "本人点播模式：调整会在房间发送快进/快退消息",
    });
    provideMediaSession(session);
    mount();
    expect(deck("room")!.textContent).toContain("由你点播");
    expect(toggleIn("room", "loop")).not.toBeNull();
    const slider = deck("room")!.querySelector('[role="slider"]');
    expect(slider!.getAttribute("tabindex")).toBe("0");
    // 与进度浮窗同一句提示：可跳转时挂在滑块的 title 上
    expect(slider!.getAttribute("title")).toBe(
      "本人点播模式：调整会在房间发送快进/快退消息",
    );
  });

  it("进度填充按当前时间比例：桌面轨道与迷你条顶边线", () => {
    const { session } = harness({ current: 50, duration: 200 });
    provideMediaSession(session);
    mount();

    const fill = deck("room")!.querySelector<HTMLElement>(
      "[data-imw-deck-fill]",
    )!;
    expect(fill.style.width).toBe("25%");
    const line = deck("mini")!.querySelector<HTMLElement>(
      "[data-imw-deck-line] > span",
    )!;
    expect(line.style.width).toBe("25%");
  });

  it("他人点播、无媒体权限：时间照常走，轨道只读不可聚焦", () => {
    const { session, bridge } = harness({
      owner: "小飞鱼",
      ownMedia: false,
      permission: "denied",
      permissionReason: "当前房间无媒体管理权限",
      controlMode: "unavailable",
    });
    provideMediaSession(session);
    mount();

    const root = deck("room")!;
    expect(root.textContent).toContain("0:30");
    expect(root.querySelector('[role="slider"]')).toBeNull();
    // 不可跳转时轨道不带控制提示
    expect(
      root.querySelector("[data-imw-deck-track]")!.getAttribute("title"),
    ).toBeNull();

    act(() => {
      bridge.emit({ current: 40 });
    });
    expect(deck("room")!.textContent).toContain("0:40");
    // 点击与方向键都不发报文、时间不变
    const track = deck("room")!.querySelector("[data-imw-deck-track]")!;
    pointer(track, "pointerdown", 40);
    key(deck("room")!, "ArrowRight");
    expect(bridge.sent).toEqual([]);
    expect(deck("room")!.textContent).toContain("0:40");
  });

  it("直播 / 电台流：换「直播」徽章 + 已播时长，无轨道与总时长", () => {
    const { session } = harness({ duration: null, current: 90 });
    provideMediaSession(session);
    mount();

    const root = deck("room")!;
    expect(root.textContent).toContain("直播");
    expect(root.textContent).toContain("1:30");
    expect(root.querySelector('[role="slider"]')).toBeNull();
    // 迷你条不画顶边进度线，副行不带时间
    expect(deck("mini")!.querySelector("[data-imw-deck-line]")).toBeNull();
    expect(deck("mini")!.textContent).not.toContain("1:30");
  });

  it("房间无播放：只剩标题位与开关，无点播者行与轨道", () => {
    const { session } = harness({ playing: false, owner: "小飞鱼" });
    provideMediaSession(session);
    mount();

    const root = deck("room")!;
    expect(root.textContent).toContain("房间暂时安静");
    expect(root.getAttribute("aria-label")).toBe("房间暂时安静");
    expect(root.querySelector("[data-imw-deck-requester]")).toBeNull();
    expect(root.querySelector('[role="slider"]')).toBeNull();
    expect(toggleIn("room", "loop")).not.toBeNull();
    expect(toggleIn("room", "shuffle")).not.toBeNull();
    // 无播放时不承诺能展开对话框
    expect(miniBody().getAttribute("aria-haspopup")).toBeNull();
    expect(miniBody().getAttribute("aria-expanded")).toBeNull();
    // 点迷你条主体不展开
    act(() => {
      miniBody().click();
    });
    expect(deck("expanded")).toBeNull();
  });

  it("宿站没有点播者昵称时不渲染点播者行", () => {
    const { session } = harness({ owner: "", ownMedia: false });
    provideMediaSession(session);
    mount();

    expect(deck("room")!.textContent).toContain("测试曲目");
    expect(deck("room")!.querySelector("[data-imw-deck-requester]")).toBeNull();
    expect(deck("room")!.textContent).not.toContain(" 点播");
  });
});

describe("迷你条与展开的底部条", () => {
  it("迷你条：标题 + 「某某 点播 · 时间」+ 两个图标开关 + 顶边进度线", () => {
    const { session } = harness({
      owner: "小飞鱼",
      ownMedia: false,
      current: 98,
      duration: 300,
    });
    provideMediaSession(session);
    mount();

    const mini = deck("mini")!;
    expect(mini.textContent).toContain("测试曲目");
    expect(mini.textContent).toContain("小飞鱼 点播 · 1:38");
    expect(mini.querySelector("[data-imw-deck-line]")).not.toBeNull();
    expect(toggleIn("mini", "loop")!.getAttribute("aria-label")).toBe(
      "单曲循环",
    );
    expect(toggleIn("mini", "loop")!.textContent).toBe("");
  });

  it("点主体展开三行底部条：role=dialog，焦点进收起钮；点收起钮归还焦点", () => {
    const { session } = harness();
    provideMediaSession(session);
    mount();

    act(() => {
      miniBody().click();
    });
    const panel = deck("expanded")!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(panel.getAttribute("aria-label")).toBe("房间正在播放");
    expect(panel.querySelector('[role="slider"]')).not.toBeNull();
    const close =
      panel.querySelector<HTMLButtonElement>('[aria-label="收起"]')!;
    expect(document.activeElement).toBe(close);

    act(() => {
      close.click();
    });
    expect(deck("expanded")).toBeNull();
    expect(document.activeElement).toBe(miniBody());
  });

  it("展开层内 Tab 首尾循环，不走到拦截层背后的元素", () => {
    const { session } = harness();
    provideMediaSession(session);
    mount();
    act(() => {
      miniBody().click();
    });

    const panel = deck("expanded")!;
    const items = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = items[0];
    const last = items[items.length - 1];
    const tab = (shiftKey: boolean) => {
      act(() => {
        panel.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Tab",
            shiftKey,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
    };

    last.focus();
    tab(false);
    expect(document.activeElement).toBe(first);

    first.focus();
    tab(true);
    expect(document.activeElement).toBe(last);
  });

  it("点展开区外收起并把焦点还给迷你条主体", () => {
    const { session } = harness();
    provideMediaSession(session);
    mount();
    act(() => {
      miniBody().click();
    });
    const backdrop = host.querySelector<HTMLElement>(
      "[data-imw-deck-backdrop]",
    )!;
    act(() => {
      backdrop.click();
    });
    expect(deck("expanded")).toBeNull();
    expect(document.activeElement).toBe(miniBody());
  });

  it("切模式与关面板都收起展开层", () => {
    const { session } = harness();
    provideMediaSession(session);
    mount();
    act(() => {
      miniBody().click();
    });
    expect(deck("expanded")).not.toBeNull();

    mount(true, 1);
    expect(deck("expanded")).toBeNull();

    act(() => {
      miniBody().click();
    });
    expect(deck("expanded")).not.toBeNull();
    mount(false, 1);
    expect(deck("expanded")).toBeNull();
  });
});

describe("模式开关（同一个 PlaybackMode）", () => {
  it("点亮互斥，两个形态状态一致；再点熄灭", () => {
    const { session, playback } = harness({ owner: "铭铭" });
    provideMediaSession(session);
    mount();

    act(() => {
      toggleIn("room", "loop")!.click();
    });
    expect(playback.mode).toBe("loop");
    expect(toggleIn("room", "loop")!.getAttribute("aria-pressed")).toBe("true");
    expect(toggleIn("mini", "loop")!.getAttribute("aria-pressed")).toBe("true");
    expect(toggleIn("room", "shuffle")!.getAttribute("aria-pressed")).toBe(
      "false",
    );

    act(() => {
      toggleIn("mini", "loop")!.click();
    });
    expect(playback.mode).toBe("none");
    expect(toggleIn("room", "loop")!.getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("与侧栏播放行是同一个 PlaybackMode（两个入口同步点亮与熄灭）", () => {
    const { session, playback } = harness({ owner: "铭铭" });
    const row = new SidebarPlaybackRow(playback, document);
    document.body.append(row.element);
    const rowButton = () =>
      row.element.querySelector<HTMLButtonElement>("#imw-toggle-loop")!;
    try {
      provideMediaSession(session);
      mount();

      act(() => {
        toggleIn("room", "loop")!.click();
      });
      expect(playback.mode).toBe("loop");
      expect(rowButton().getAttribute("aria-pressed")).toBe("true");

      // 反向：侧栏行熄灭后底部条同步
      act(() => {
        rowButton().click();
      });
      expect(playback.mode).toBe("none");
      expect(toggleIn("room", "loop")!.getAttribute("aria-pressed")).toBe(
        "false",
      );
    } finally {
      row.dispose();
    }
  });

  it("收藏随机熄灭态：先开选择面板，取消不变，确认后点亮", () => {
    const { session, playback, picks } = harness();
    provideMediaSession(session);
    mount();

    act(() => {
      toggleIn("room", "shuffle")!.click();
    });
    expect(picks).toHaveLength(1);
    expect(playback.mode).toBe("none");

    // 取消：什么都不改
    act(() => {
      toggleIn("room", "shuffle")!.click();
    });
    expect(picks).toHaveLength(2);
    expect(playback.mode).toBe("none");

    // 确认：面板回调里点亮
    act(() => {
      picks[1]();
    });
    expect(playback.mode).toBe("shuffle");
    expect(toggleIn("room", "shuffle")!.getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("确认时已不可用：提示原因并保持熄灭", () => {
    const { session, playback, bridge, picks } = harness();
    provideMediaSession(session);
    mount();
    act(() => {
      toggleIn("room", "shuffle")!.click();
    });
    // 面板打开期间断线：确认时复检
    bridge.emit({ connected: false });
    act(() => {
      picks[0]();
    });
    expect(playback.mode).toBe("none");
    expect(alert).toHaveBeenCalledExactlyOnceWith(
      "连接未就绪或已断开，暂时无法调整",
    );
  });

  it("不可用时提示原因，同一原因 10 秒内只提示一次", () => {
    const { session } = harness({}, false);
    provideMediaSession(session);
    mount();

    act(() => {
      toggleIn("room", "loop")!.click();
    });
    act(() => {
      toggleIn("mini", "loop")!.click();
    });
    expect(alert).toHaveBeenCalledOnce();
    expect(alert).toHaveBeenCalledWith("直播或时间未知，无法使用");
    expect(toggleIn("room", "loop")!.getAttribute("aria-disabled")).toBe(
      "true",
    );

    const now = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now + 10_001);
    try {
      act(() => {
        toggleIn("room", "loop")!.click();
      });
      expect(alert).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it("亲手点亮即待命：当场说明一次，下一次点按直接熄灭", () => {
    const { session, playback } = harness({ owner: "小飞鱼", ownMedia: false });
    provideMediaSession(session);
    mount();
    act(() => {
      toggleIn("room", "loop")!.click();
    });
    expect(playback.mode).toBe("loop");
    expect(playback.state.standby).toBe(true);
    expect(alert).toHaveBeenCalledOnce();
    expect(alert).toHaveBeenCalledWith("当前曲目由他人点播，暂不自动续播");
    expect(toggleIn("room", "loop")!.getAttribute("title")).toBe(
      "当前曲目由他人点播，暂不自动续播",
    );

    // 已当面说明过：下一次点按直接熄灭
    act(() => {
      toggleIn("room", "loop")!.click();
    });
    expect(playback.mode).toBe("none");
  });

  it("自动转入待命：首次点按只说明原因，再点才熄灭", () => {
    const { session, playback, bridge } = harness({
      owner: "铭铭",
      ownMedia: true,
    });
    provideMediaSession(session);
    mount();
    act(() => {
      toggleIn("room", "loop")!.click();
    });
    expect(playback.mode).toBe("loop");
    expect(playback.state.standby).toBe(false);
    expect(alert).not.toHaveBeenCalled();

    // 房间换到他人点播：已点亮的模式保持点亮待命，不主动弹提示
    act(() => {
      bridge.emit({ ownMedia: false, owner: "小飞鱼" });
    });
    expect(playback.state.standby).toBe(true);
    expect(alert).not.toHaveBeenCalled();
    expect(toggleIn("room", "loop")!.getAttribute("title")).toBe(
      "当前曲目由他人点播，暂不自动续播",
    );

    // 首次点按只说明原因，模式保持点亮
    act(() => {
      toggleIn("room", "loop")!.click();
    });
    expect(playback.mode).toBe("loop");
    expect(alert).toHaveBeenCalledOnce();
    expect(alert).toHaveBeenCalledWith("当前曲目由他人点播，暂不自动续播");

    // 再点才熄灭
    act(() => {
      toggleIn("room", "loop")!.click();
    });
    expect(playback.mode).toBe("none");
  });

  it("读屏状态区并列给出待命原因与后续会话消息，不被旧提示盖住", () => {
    const { session, bridge } = harness({ owner: "小飞鱼", ownMedia: false });
    provideMediaSession(session);
    mount();
    act(() => {
      toggleIn("room", "loop")!.click();
    });
    let status = deck("room")!.querySelector('[role="status"]')!;
    expect(status.textContent).toBe("当前曲目由他人点播，暂不自动续播");
    expect(status.getAttribute("class")).toContain("sr-only");

    // 换曲：先取消一次待确认的定位，会话消息必须能播出来，不被先前的提示长期掩盖
    const slider = deck("room")!.querySelector('[role="slider"]')!;
    key(slider, "ArrowRight");
    act(() => {
      bridge.emit({ instance: 2 });
    });
    status = deck("room")!.querySelector('[role="status"]')!;
    expect(status.textContent).toContain("媒体已切换，已取消上次操作");
    expect(status.textContent).toContain("当前曲目由他人点播，暂不自动续播");

    // 面板关闭（只是移出视口）后不再留在无障碍树里
    mount(false);
    expect(deck("room")!.querySelector('[role="status"]')).toBeNull();
  });
});

describe("进度跳转", () => {
  it("键盘：→ 快进 5 秒、Shift+← 快退 30 秒", () => {
    const { session, bridge } = harness({ current: 30, duration: 200 });
    provideMediaSession(session);
    mount();

    const slider = deck("room")!.querySelector('[role="slider"]')!;
    key(slider, "ArrowRight");
    expect(bridge.sent).toEqual(['!15[">","5s"]']);

    // 宿站确认上一次定位后才接受下一次手势
    act(() => {
      bridge.emit({ current: 35, seekVersion: 1 });
    });
    key(slider, "ArrowLeft", true);
    expect(bridge.sent).toEqual(['!15[">","5s"]', '!15["<","30s"]']);
  });

  it("拖动提交一次、取消回到原时间", () => {
    const { session, bridge } = harness({ current: 30, duration: 200 });
    provideMediaSession(session);
    mount();

    const slider = deck("room")!.querySelector<HTMLElement>('[role="slider"]')!;
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 100, 44),
    );

    pointer(slider, "pointerdown", 40);
    expect(deck("room")!.textContent).toContain("1:20");
    pointer(slider, "pointermove", 50);
    expect(deck("room")!.textContent).toContain("1:40");
    expect(bridge.sent).toEqual([]);
    pointer(slider, "pointerup", 60);
    expect(bridge.sent).toEqual(['!16["120s"]']);

    act(() => {
      bridge.emit({ current: 120, seekVersion: 1 });
    });
    pointer(slider, "pointerdown", 20);
    expect(deck("room")!.textContent).toContain("0:40");
    pointer(slider, "pointercancel", 20);
    expect(deck("room")!.textContent).toContain("2:00");
    expect(bridge.sent).toHaveLength(1);
  });

  it("窗口失焦取消拖动：时间回到原值且发不出报文", () => {
    const { session, bridge } = harness({ current: 30, duration: 200 });
    provideMediaSession(session);
    mount();

    const slider = deck("room")!.querySelector<HTMLElement>('[role="slider"]')!;
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 100, 44),
    );
    pointer(slider, "pointerdown", 40);
    expect(deck("room")!.textContent).toContain("1:20");

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(deck("room")!.textContent).toContain("0:30");
    pointer(slider, "pointerup", 40);
    expect(bridge.sent).toEqual([]);
  });

  it("没有当前时间时不画 0:00 与空进度：时间 --:--、填充 0", () => {
    const { session } = harness({ current: null, duration: 200 });
    provideMediaSession(session);
    mount();

    const root = deck("room")!;
    expect(root.textContent).toContain("--:--");
    expect(
      root.querySelector<HTMLElement>("[data-imw-deck-fill]")!.style.width,
    ).toBe("0%");
    // 时间未知不可跳转（与 unavailableReason 同源），轨道只读
    expect(root.querySelector('[role="slider"]')).toBeNull();
  });

  it("当前时间超出总时长时 aria-valuenow 夹在上限内", () => {
    const { session } = harness({ current: 250, duration: 200 });
    provideMediaSession(session);
    mount();

    const slider = deck("room")!.querySelector('[role="slider"]')!;
    expect(slider.getAttribute("aria-valuemax")).toBe("200");
    expect(slider.getAttribute("aria-valuenow")).toBe("200");
    expect(
      deck("room")!.querySelector<HTMLElement>("[data-imw-deck-fill]")!.style
        .width,
    ).toBe("100%");
  });
});

describe("可访问性与触控目标", () => {
  it("aria：滑块、开关、展开层与收起钮", () => {
    const { session } = harness({ owner: "小飞鱼" });
    provideMediaSession(session);
    mount();

    const slider = deck("room")!.querySelector('[role="slider"]')!;
    expect(slider.getAttribute("aria-valuenow")).toBe("30");
    expect(slider.getAttribute("aria-valuetext")).toBe("0:30 / 3:20");
    expect(toggleIn("room", "loop")!.getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(toggleIn("room", "loop")!.getAttribute("aria-disabled")).toBe(
      "false",
    );
    expect(miniBody().getAttribute("aria-haspopup")).toBe("dialog");
    expect(miniBody().getAttribute("aria-expanded")).toBe("false");

    act(() => {
      miniBody().click();
    });
    expect(miniBody().getAttribute("aria-expanded")).toBe("true");
    expect(deck("expanded")!.getAttribute("aria-label")).toBe("房间正在播放");
  });

  it("手机可点目标 ≥44px，断点用 max-[768px]", () => {
    const { session } = harness();
    provideMediaSession(session);
    mount();

    for (const kind of ["loop", "shuffle"] as const) {
      const button = toggleIn("mini", kind)!;
      expect(button.getAttribute("class")).toContain("h-11");
      expect(button.getAttribute("class")).toContain("w-11");
    }
    expect(miniBody().getAttribute("class")).toContain("min-h-[44px]");
    expect(
      host.querySelector("#imw-desk-room-deck")!.getAttribute("class"),
    ).toContain("max-[768px]:hidden");
    expect(
      host.querySelector("#imw-desk-mini-deck")!.getAttribute("class"),
    ).toContain("max-[768px]:block");
  });
});

describe("底部条源码零裸值", () => {
  it("不含裸颜色、rgba、themed / accentVar、emoji 与宿站 mdi 类", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "src", "page", "components", "room-deck");
    const files = (readdirSync(dir) as string[]).filter(
      (name) =>
        (name.endsWith(".tsx") || name.endsWith(".ts")) &&
        !name.endsWith(".test.ts"),
    );
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const name of files) {
      const source = readFileSync(join(dir, name), "utf8");
      expect(
        `${name}: ${source.match(/#[0-9a-fA-F]{3,8}/g) ?? "无裸色值"}`,
      ).toBe(`${name}: 无裸色值`);
      expect(source).not.toMatch(/rgba\(|themed|accentVar|mdi-/);
      expect(source).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });
});
