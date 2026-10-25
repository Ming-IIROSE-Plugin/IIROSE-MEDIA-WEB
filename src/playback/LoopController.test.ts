import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaSnapshot } from "../media-progress/model";
import { snapshot } from "./fixtures";
import { LoopController, LOOP_REASONS, loopThreshold } from "./LoopController";
import type { LoopBridge } from "./LoopController";
import { MediaPayloadMemory } from "./MediaPayloadMemory";
import { PlaybackMode } from "./PlaybackMode";

beforeEach(() => {
  // 默认存储器是 sessionStorage：避免上一个用例的报文串到「无缓存」场景。
  sessionStorage.clear();
});

const CARD = '{"m":"m__4@0>测试曲目>歌手>x>000000>320","mc":"000000","i":"1"}';
const PAYLOAD = `&1${JSON.stringify({
  s: "https://a/b.mp3",
  d: 200,
  c: "https://a/c.jpg",
  n: "测试曲目",
  r: "歌手",
  b: "@0",
  o: "https://music.163.com/#/song?id=1",
  l: "",
})}`;

function setup() {
  const mode = new PlaybackMode();
  mode.setMediaPresent(true);
  let listener: ((value: MediaSnapshot) => void) | null = null;
  const send = vi.fn(() => true);
  const bridge: LoopBridge = {
    subscribe(next) {
      listener = next;
      return () => {
        listener = null;
      };
    },
    send,
  };
  const io = { sendCard: vi.fn(), sendPayload: vi.fn() };
  let clock = 1_000_000;
  const memory = new MediaPayloadMemory(() => "fixture-room");
  const controller = new LoopController(mode, bridge, memory, io, () => clock);
  controller.attach();

  const push = (patch: Partial<MediaSnapshot> = {}) => {
    const value = snapshot(patch);
    mode.applySnapshot(value);
    listener?.(value);
    return value;
  };
  const light = () => {
    push();
    mode.toggle("loop");
  };
  const advance = (ms: number) => {
    clock += ms;
  };
  return { mode, memory, io, send, push, light, advance, controller };
}

describe("单曲循环控制器", () => {
  it("有静默权限时只发一条快退报文，回到开头后重新武装可再次循环", () => {
    const { mode, io, send, push, light } = setup();
    light();
    expect(mode.mode).toBe("loop");

    push({ current: 196 });
    expect(send).toHaveBeenCalledExactlyOnceWith(
      '!15["<","196s"]',
      1,
      "silent",
    );
    expect(io.sendCard).not.toHaveBeenCalled();

    push({ current: 0.4 });
    expect(send).toHaveBeenCalledTimes(1);
    push({ current: 196 });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("快退未生效时降级重播，命中缓存则发卡片与报文", () => {
    const { mode, io, memory, push, light, advance } = setup();
    memory.record(PAYLOAD);
    memory.record(CARD);
    light();

    push({ current: 196 });
    advance(2100);
    push({ current: 196 });
    expect(io.sendCard).toHaveBeenCalledExactlyOnceWith(CARD);
    expect(io.sendPayload).toHaveBeenCalledExactlyOnceWith(PAYLOAD);

    push({ current: 1 });
    expect(mode.mode).toBe("loop");
    expect(mode.state.cleared).toBeNull();
  });

  it("快退失败且无缓存时报文不补发，熄灭并给出原因", () => {
    const { mode, io, send, push, light, advance } = setup();
    light();
    push({ current: 196 });
    advance(2100);
    push({ current: 196 });

    expect(send).toHaveBeenCalledTimes(1);
    expect(io.sendPayload).not.toHaveBeenCalled();
    expect(mode.mode).toBe("none");
    expect(mode.state.cleared?.reason).toBe(LOOP_REASONS.seekFailed);
  });

  it("无静默权限时在剩余 5 秒窗口内预发重播，5 秒内回读成功即保持点亮", () => {
    const { mode, io, memory, push, light } = setup();
    memory.record(PAYLOAD);
    memory.record(CARD);
    push({ controlMode: "owner", ownMedia: true });
    mode.toggle("loop");
    expect(mode.mode).toBe("loop");

    push({ controlMode: "owner", current: 196.5 });
    expect(io.sendPayload).toHaveBeenCalledExactlyOnceWith(PAYLOAD);
    expect(io.sendCard).toHaveBeenCalledExactlyOnceWith(CARD);

    push({ controlMode: "owner", current: 0.6 });
    expect(mode.mode).toBe("loop");
  });

  it("无静默权限且无缓存时循环不可用并给出原因", () => {
    const { mode, push } = setup();
    push({ controlMode: "owner" });
    expect(mode.state.loop).toEqual({
      enabled: false,
      reason: LOOP_REASONS.unavailable,
    });
    mode.toggle("loop");
    expect(mode.mode).toBe("none");
  });

  it("他人点播、暂停、直播都不触发任何发送", () => {
    const { mode, io, send, push, light } = setup();
    light();
    push({ current: 196, ownMedia: false });
    expect(mode.state.standby).toBe(true);
    expect(send).not.toHaveBeenCalled();
    push({ current: 196, playing: false });
    push({ current: 196, duration: null });
    expect(send).not.toHaveBeenCalled();
    expect(io.sendPayload).not.toHaveBeenCalled();
  });

  it("短曲 30 秒内第三次到末尾即熄灭并提示", () => {
    const { mode, push, light } = setup();
    light();
    const at = (current: number) => push({ duration: 3, current });
    at(2.2);
    at(0.2);
    at(2.2);
    at(0.2);
    expect(mode.mode).toBe("loop");
    at(2.2);
    expect(mode.mode).toBe("none");
    expect(mode.state.cleared?.reason).toBe(LOOP_REASONS.tooShort);
  });

  it("手动定位后 2 秒内不触发", () => {
    const { send, push, light, advance } = setup();
    light();
    push({ current: 196, seekVersion: 1 });
    expect(send).not.toHaveBeenCalled();
    advance(2100);
    push({ current: 196, seekVersion: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("触发后曲目被换走视为失败，不补发", () => {
    const { mode, io, push, light } = setup();
    light();
    push({ current: 196 });
    push({ title: "别的曲目" });
    expect(io.sendPayload).not.toHaveBeenCalled();
    expect(mode.mode).toBe("none");
  });

  it("熄灭后不再触发，重新点亮恢复", () => {
    const { mode, send, push, light } = setup();
    light();
    mode.toggle("loop");
    push({ current: 196 });
    expect(send).not.toHaveBeenCalled();
    light();
    push({ current: 0.4 });
    push({ current: 196 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("静默通道返回 false 时降级重播；无缓存则熄灭", () => {
    const { mode, io, memory, send, push, light } = setup();
    memory.record(PAYLOAD);
    send.mockReturnValueOnce(false);
    light();
    push({ current: 196 });
    expect(io.sendPayload).toHaveBeenCalledExactlyOnceWith(PAYLOAD);
    expect(mode.mode).toBe("loop");

    sessionStorage.clear();
    const second = setup();
    second.send.mockReturnValueOnce(false);
    second.light();
    second.push({ current: 196 });
    expect(second.mode.mode).toBe("none");
    expect(second.mode.state.cleared?.reason).toBe(LOOP_REASONS.seekFailed);
  });

  it("播报静默时没有卡片，只重发报文", () => {
    const { io, memory, push, light } = setup();
    memory.record(PAYLOAD);
    push({ controlMode: "owner" });
    light();
    push({ current: 196.5, controlMode: "owner" });
    expect(io.sendCard).not.toHaveBeenCalled();
    expect(io.sendPayload).toHaveBeenCalledExactlyOnceWith(PAYLOAD);
  });

  it("已播完（宿站自动续播前）仍可接管", () => {
    const { io, memory, push, light } = setup();
    memory.record(PAYLOAD);
    push({ controlMode: "owner" });
    light();
    push({ current: 205, duration: 200, controlMode: "owner" });
    expect(io.sendPayload).toHaveBeenCalledExactlyOnceWith(PAYLOAD);
  });

  it("待命期间不做失败判定，恢复后仍按成功处理", () => {
    const { mode, push, light, advance } = setup();
    light();
    push({ current: 196 });
    advance(6000);
    push({ current: 196, ownMedia: false });
    expect(mode.mode).toBe("loop");
    push({ current: 0.4, ownMedia: true });
    expect(mode.mode).toBe("loop");
    expect(mode.state.cleared).toBeNull();
  });

  it("切换曲目时宿站短暂给出占位标题不算换曲", () => {
    const { mode, push, light } = setup();
    light();
    push({ current: 196 });
    push({ current: 196, title: "未命名媒体" });
    expect(mode.mode).toBe("loop");
  });

  it("阈值随时长收敛，非法时长不产生 NaN 阈值", () => {
    expect(loopThreshold(200)).toBe(5);
    expect(loopThreshold(20)).toBe(5);
    expect(loopThreshold(4)).toBe(1);
    expect(loopThreshold(10)).toBe(2.5);
    expect(Number.isNaN(loopThreshold(Number.NaN))).toBe(false);
    expect(loopThreshold(0)).toBe(1);
  });

  it("非有限时长或进度不触发任何发送", () => {
    const { send, io, push, light } = setup();
    light();
    push({ current: Number.NaN });
    push({ current: 196, duration: Number.POSITIVE_INFINITY });
    expect(send).not.toHaveBeenCalled();
    expect(io.sendPayload).not.toHaveBeenCalled();
  });

  it("快退期间实例变化（他人重新点播同曲）按失败处理", () => {
    const { mode, push, light } = setup();
    light();
    push({ current: 196 });
    push({ current: 196, instance: 2 });
    expect(mode.mode).toBe("none");
    expect(mode.state.cleared?.reason).toBe(LOOP_REASONS.replayFailed);
  });
});
