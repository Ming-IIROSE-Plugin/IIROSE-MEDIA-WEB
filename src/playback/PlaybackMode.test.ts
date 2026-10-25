import { describe, expect, it, vi } from "vitest";
import { snapshot } from "./fixtures";
import { PlaybackMode } from "./PlaybackMode";
import type { PlaybackModeAvailability } from "./PlaybackMode";

const reasonOf = (value: PlaybackModeAvailability) => value.reason;

// 「有当前媒体且时长已知」的起始态：present 默认 false，须由适配器显式回报存在。
function ready(): PlaybackMode {
  const mode = new PlaybackMode();
  mode.setMediaPresent(true);
  mode.applySnapshot(snapshot());
  return mode;
}

describe("播放模式状态机", () => {
  it("收到快照前按「时长未知」处理：熄灭且不可用", () => {
    const mode = new PlaybackMode();
    expect(mode.mode).toBe("none");
    expect(mode.state).toEqual({
      mode: "none",
      loop: { enabled: false, reason: "直播或时间未知，无法使用" },
      // 收藏随机不依赖媒体：默认可用性来自收藏侧（此处尚未注入，取默认可用）
      shuffle: { enabled: true, reason: "" },
      standby: false,
      standbyReason: "",
      cleared: null,
    });
    mode.applySnapshot(snapshot());
    // 首帧快照还不够：媒体存在性要等首次 adapt 回报。
    expect(mode.state.loop.enabled).toBe(false);
    mode.setMediaPresent(true);
    expect(mode.state).toEqual({
      mode: "none",
      loop: { enabled: true, reason: "" },
      shuffle: { enabled: true, reason: "" },
      standby: false,
      standbyReason: "",
      cleared: null,
    });
  });

  it("互斥单选，再次点击已点亮项回到熄灭", () => {
    const mode = ready();
    mode.toggle("loop");
    expect(mode.mode).toBe("loop");
    mode.toggle("shuffle");
    expect(mode.mode).toBe("shuffle");
    mode.toggle("shuffle");
    expect(mode.mode).toBe("none");
  });

  it("不可用模式拒绝点亮且保留原因", () => {
    const mode = ready();
    mode.setAvailability("loop", {
      enabled: false,
      reason: "无媒体管理权限，且该曲目不由插件点播，无法循环",
    });
    mode.toggle("loop");
    expect(mode.mode).toBe("none");
    expect(reasonOf(mode.state.loop)).toBe(
      "无媒体管理权限，且该曲目不由插件点播，无法循环",
    );
    expect(mode.state.shuffle.enabled).toBe(true);
  });

  it("媒体行消失即灰化并清零点亮态，恢复存在也不自动重新点亮", () => {
    const mode = ready();
    mode.toggle("loop");
    // 删卡后宿站仍可能保留 shareMediaDuration，只有 DOM 存在性能判定「无当前媒体」。
    mode.setMediaPresent(false);
    expect(mode.mode).toBe("none");
    expect(mode.state.loop).toEqual({
      enabled: false,
      reason: "直播或时间未知，无法使用",
    });
    mode.toggle("loop");
    expect(mode.mode).toBe("none");
    mode.setMediaPresent(true);
    expect(mode.state.loop).toEqual({ enabled: true, reason: "" });
    expect(mode.mode).toBe("none");
  });

  it("连接未就绪或断开时灰化，文案不假定已断开", () => {
    const mode = ready();
    mode.toggle("loop");
    mode.applySnapshot(snapshot({ connected: false }));
    expect(mode.mode).toBe("none");
    expect(mode.state.loop).toEqual({
      enabled: false,
      reason: "连接未就绪或已断开，暂时无法调整",
    });
  });

  it("时长未知或为 0 按直播原因禁用；暂停后不能再开启", () => {
    const mode = ready();
    mode.applySnapshot(snapshot({ duration: null }));
    expect(mode.state.loop).toEqual({
      enabled: false,
      reason: "直播或时间未知，无法使用",
    });
    mode.applySnapshot(snapshot({ duration: 0 }));
    expect(mode.state.loop).toEqual({
      enabled: false,
      reason: "直播或时间未知，无法使用",
    });
    // 没在播也能开收藏随机：它只受收藏可用性与连接影响
    mode.applySnapshot(snapshot({ duration: 200, playing: false }));
    expect(mode.state.shuffle.enabled).toBe(true);
  });

  it("循环按「无媒体 → 断线 → 时长未知 → 播放状态」派生；随机只看连接与收藏", () => {
    const mode = ready();
    mode.setAvailability("shuffle", {
      enabled: false,
      reason: "当前页面没有收藏",
    });
    // 随机：媒体/时长都不影响，只跟连接与收藏走
    mode.applySnapshot(snapshot({ duration: null }));
    expect(reasonOf(mode.state.shuffle)).toBe("当前页面没有收藏");
    mode.applySnapshot(snapshot({ connected: false }));
    expect(reasonOf(mode.state.shuffle)).toBe(
      "连接未就绪或已断开，暂时无法调整",
    );
    mode.setMediaPresent(false);
    expect(reasonOf(mode.state.shuffle)).toBe(
      "连接未就绪或已断开，暂时无法调整",
    );
    // 循环：媒体缺失优先
    expect(reasonOf(mode.state.loop)).toBe("直播或时间未知，无法使用");
    mode.setMediaPresent(true);
    mode.applySnapshot(snapshot());
    expect(reasonOf(mode.state.shuffle)).toBe("当前页面没有收藏");
  });

  it("待命原因可用但不灰化", () => {
    const mode = ready();
    mode.setAvailability("shuffle", {
      enabled: true,
      reason: "当前曲目由他人点播，暂不自动续播",
    });
    expect(mode.state.shuffle).toEqual({
      enabled: true,
      reason: "当前曲目由他人点播，暂不自动续播",
    });
    mode.toggle("shuffle");
    expect(mode.mode).toBe("shuffle");
  });

  it("订阅立即回调，只在状态变化时通知，取消后静默", () => {
    const mode = ready();
    const listener = vi.fn();
    const unsubscribe = mode.subscribe(listener);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenLastCalledWith(mode.state);
    mode.applySnapshot(snapshot());
    mode.applySnapshot(snapshot());
    expect(listener).toHaveBeenCalledOnce();
    mode.toggle("loop");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    mode.applySnapshot(snapshot({ connected: false }));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("dispose 后不再改状态也不再通知", () => {
    const mode = ready();
    mode.toggle("loop");
    const listener = vi.fn();
    mode.subscribe(listener);
    mode.dispose();
    mode.toggle("shuffle");
    mode.applySnapshot(snapshot({ connected: false }));
    mode.setMediaPresent(false);
    mode.setAvailability("loop", { enabled: false, reason: "已卸载" });
    expect(mode.mode).toBe("loop");
    expect(mode.state.loop).toEqual({ enabled: true, reason: "" });
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("点播归属与生命周期守卫", () => {
  const STANDBY = "当前曲目由他人点播，暂不自动续播";
  const ROOM_CHANGED = "已切换房间，播放模式已关闭";

  it("本人点播：无待命原因，可用性不受归属影响", () => {
    const mode = ready();
    mode.toggle("loop");
    expect(mode.state.standby).toBe(false);
    expect(mode.state.standbyReason).toBe("");
    expect(mode.state.loop).toEqual({ enabled: true, reason: "" });
    expect(mode.state.cleared).toBeNull();
  });

  it("他人点播：保留点亮并进入待命，可用性不变", () => {
    const mode = ready();
    mode.toggle("loop");
    mode.applySnapshot(snapshot({ ownMedia: false }));
    expect(mode.mode).toBe("loop");
    expect(mode.state.standby).toBe(true);
    expect(mode.state.standbyReason).toBe(STANDBY);
    expect(mode.state.loop).toEqual({ enabled: true, reason: "" });
    expect(mode.state.cleared).toBeNull();
  });

  it("点播者信息缺失（ownMedia 为 false）一律按非本人待命", () => {
    const mode = ready();
    mode.toggle("shuffle");
    // 桥接把「title 缺失 / myself 非字符串 / 不相等」都折算成 false。
    mode.applySnapshot(snapshot({ ownMedia: false, title: "" }));
    expect(mode.state.standby).toBe(true);
    expect(mode.mode).toBe("shuffle");
  });

  it("未点亮时他人点播不进入待命，点亮后立即待命", () => {
    const mode = ready();
    mode.applySnapshot(snapshot({ ownMedia: false }));
    expect(mode.state.standby).toBe(false);
    mode.toggle("shuffle");
    expect(mode.mode).toBe("shuffle");
    expect(mode.state.standby).toBe(true);
  });

  it("本人重新点播立即退出待命，保留原模式", () => {
    const mode = ready();
    mode.toggle("loop");
    mode.applySnapshot(snapshot({ ownMedia: false }));
    expect(mode.state.standby).toBe(true);
    mode.applySnapshot(snapshot({ ownMedia: true }));
    expect(mode.state.standby).toBe(false);
    expect(mode.state.standbyReason).toBe("");
    expect(mode.mode).toBe("loop");
  });

  it("待命变化按签名发布，同一待命快照不重复通知", () => {
    const mode = ready();
    mode.toggle("loop");
    const listener = vi.fn();
    mode.subscribe(listener);
    expect(listener).toHaveBeenCalledOnce();
    mode.applySnapshot(snapshot({ ownMedia: false }));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0]).toMatchObject({
      standby: true,
      standbyReason: STANDBY,
    });
    mode.applySnapshot(snapshot({ ownMedia: false }));
    expect(listener).toHaveBeenCalledTimes(2);
    mode.applySnapshot(snapshot({ ownMedia: true }));
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener.mock.calls[2][0]).toMatchObject({ standby: false });
  });

  it("换房熄灭并暴露一次性原因，可用性不受影响", () => {
    const mode = ready();
    mode.toggle("loop");
    mode.applySnapshot(snapshot({ roomKey: "another-room" }));
    expect(mode.mode).toBe("none");
    expect(mode.state.standby).toBe(false);
    expect(mode.state.loop.enabled).toBe(true);
    expect(mode.state.cleared).toEqual({ id: 1, reason: ROOM_CHANGED });
    // 同一房间的后续快照不再产生新令牌（行据此只提示一次）。
    mode.applySnapshot(snapshot({ roomKey: "another-room" }));
    expect(mode.state.cleared).toEqual({ id: 1, reason: ROOM_CHANGED });
  });

  it("换房时未点亮不产生提示令牌", () => {
    const mode = ready();
    mode.applySnapshot(snapshot({ roomKey: "another-room" }));
    expect(mode.mode).toBe("none");
    expect(mode.state.cleared).toBeNull();
  });

  it("换房后再点亮，再次换房给出新令牌", () => {
    const mode = ready();
    mode.toggle("shuffle");
    mode.applySnapshot(snapshot({ roomKey: "room-b" }));
    expect(mode.state.cleared?.id).toBe(1);
    mode.toggle("shuffle");
    expect(mode.mode).toBe("shuffle");
    mode.applySnapshot(snapshot({ roomKey: "room-c" }));
    expect(mode.mode).toBe("none");
    expect(mode.state.cleared).toEqual({ id: 2, reason: ROOM_CHANGED });
  });

  it("无房间标识视为未变化，不熄灭也不提示", () => {
    const mode = ready();
    mode.toggle("loop");
    mode.applySnapshot(snapshot({ roomKey: null }));
    expect(mode.mode).toBe("loop");
    expect(mode.state.cleared).toBeNull();
    // 读到标识后仍与首次记录的一致：同样不熄灭。
    mode.applySnapshot(snapshot({ roomKey: "fixture-room" }));
    expect(mode.mode).toBe("loop");
    // null 不写入基准：之后真正的换房仍能识别（与桥接的 null 处理刻意不同）。
    mode.applySnapshot(snapshot({ roomKey: "another-room" }));
    expect(mode.mode).toBe("none");
    expect(mode.state.cleared).toEqual({ id: 1, reason: ROOM_CHANGED });
  });

  it("换房优先于断线与媒体消失，只留房间原因", () => {
    const mode = ready();
    mode.toggle("loop");
    mode.applySnapshot(
      snapshot({ roomKey: "room-b", connected: false, duration: null }),
    );
    expect(mode.mode).toBe("none");
    expect(mode.state.cleared).toEqual({ id: 1, reason: ROOM_CHANGED });
    expect(mode.state.loop.enabled).toBe(false);
  });

  it("刷新页面后新实例默认熄灭", () => {
    const mode = ready();
    mode.toggle("shuffle");
    const reloaded = new PlaybackMode();
    expect(reloaded.mode).toBe("none");
    expect(reloaded.state.cleared).toBeNull();
    reloaded.setMediaPresent(true);
    reloaded.applySnapshot(snapshot());
    expect(reloaded.mode).toBe("none");
    expect(reloaded.state.standby).toBe(false);
  });

  it("stop 熄灭已点亮的模式并写一次性原因，熄灭时保持不变", () => {
    const mode = ready();
    mode.toggle("loop");
    mode.stop("循环失败：无法回到开头");
    expect(mode.mode).toBe("none");
    expect(mode.state.cleared).toEqual({
      id: 1,
      reason: "循环失败：无法回到开头",
    });
    mode.stop("循环失败：无法回到开头");
    expect(mode.state.cleared?.id).toBe(1);
    mode.stop("循环失败：无法重新点播当前曲目");
    expect(mode.state.cleared).toEqual({
      id: 1,
      reason: "循环失败：无法回到开头",
    });
  });

  it("停止播放后不能再开启，但已点亮的保持（cut 后要靠它重播）", () => {
    const mode = ready();
    mode.toggle("loop");
    expect(mode.mode).toBe("loop");
    mode.applySnapshot(snapshot({ playing: false }));
    expect(mode.mode).toBe("loop");
    expect(mode.state.loop.enabled).toBe(true);

    const idle = ready();
    idle.applySnapshot(snapshot({ playing: false }));
    expect(idle.state.loop.enabled).toBe(false);
    idle.toggle("loop");
    expect(idle.mode).toBe("none");
  });
});
