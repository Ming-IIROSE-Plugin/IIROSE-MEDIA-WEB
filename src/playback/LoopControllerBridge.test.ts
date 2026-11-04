import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HostMediaBridge,
  type MediaHost,
} from "../media-progress/HostMediaBridge";
import { MediaPayloadMemory } from "./MediaPayloadMemory";
import { PlaybackMode } from "./PlaybackMode";
import { LoopController } from "./LoopController";

const ROOM = "bridge-room";

const PAYLOAD = `&1${JSON.stringify({
  s: "https://a/b.mp3",
  d: 200,
  c: "https://a/c.jpg",
  n: "桥接曲目",
  r: "歌手",
  b: "@0",
  o: "https://music.163.com/#/song?id=1",
  l: "",
})}`;

/**
 * 桥接级验证：真实 `HostMediaBridge` 的节奏 + 真实 `LoopController`。
 * 用来回答 SPEC 里那条「点亮前没有快照历史，预发还成不成立」——纯控制器测试
 * （直接推 snapshot）绕开了节奏，证明不了这件事。
 */
function setup(remainingSeconds: number) {
  vi.useFakeTimers();
  const host: MediaHost = {
    shareMediaCurrentTime: 200 - remainingSeconds,
    shareMediaDuration: "200",
    roomnFull: ROOM,
    Info: { room: { identity: 1 } },
    socket: { readyState: 1, send: vi.fn() },
    Utils: { service: { isShareMediaPlaying: () => true } },
  };
  document.body.innerHTML =
    '<div id="shareMediaSongName">桥接曲目</div><div id="shareMediaUserName"></div>';

  // 静默通道：有静默权限时循环走 seek，无权限时才走 replay —— 两种都算「重播动作」。
  const control = vi.fn(() => true);
  const bridge = new HostMediaBridge(host, document, control);
  const mode = new PlaybackMode();
  mode.setMediaPresent(true);
  // 可用性来自快照（duration / playing / ownMedia）：先按桥接会读到的值喂一次，
  // 之后再由 bridge 的真实轮询更新。
  mode.applySnapshot({
    instance: 1,
    title: "桥接曲目",
    cover: "",
    current: 200 - remainingSeconds,
    duration: 200,
    playing: true,
    connected: true,
    owner: "",
    ownMedia: true,
    roomKey: ROOM,
    seekVersion: 0,
    dark: false,
    permission: "allowed",
    permissionReason: "",
    controlMode: "silent",
    controlNotice: "",
    controlReason: "",
  });
  const memory = new MediaPayloadMemory(() => ROOM);
  memory.record(PAYLOAD);
  const io = { sendPayload: vi.fn(() => true), localSeek: vi.fn() };
  const cut = {
    tick: vi.fn(),
    recent: () => false,
    consume: vi.fn(),
    activate: vi.fn(),
  };
  const loop = new LoopController(
    mode,
    bridge,
    memory,
    io,
    () => Date.now(),
    cut as never,
  );
  return { bridge, mode, loop, io, control };
}

/** 三种接管方式合计：replay 报文 / 静默 seek 控制 / 本地 seek。 */
function actedOf(
  io: {
    sendPayload: { mock: { calls: unknown[] } };
    localSeek: { mock: { calls: unknown[] } };
  },
  control: { mock: { calls: unknown[] } },
) {
  return (
    io.sendPayload.mock.calls.length +
    io.localSeek.mock.calls.length +
    control.mock.calls.length
  );
}

describe("点亮后的第一拍就能预发", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("点亮前没有任何快照历史，点亮后一拍内仍发出重播报文", () => {
    const { bridge, mode, loop, io, control } = setup(1);
    const acted = () => actedOf(io, control);
    loop.attach();
    expect(io.sendPayload).not.toHaveBeenCalled();

    mode.toggle("loop");
    // 推一拍：`poke()` 与定时器 emit 走同一条 `emit()` 路径，但不依赖相位。
    bridge.poke();
    // 有静默权限走 seek 控制、无权限走重播报文，两者都是「接管了一次播放」。
    expect(acted()).toBe(1);

    loop.dispose();
  });

  it("熄灭后不再预发，重新点亮仍能生效", () => {
    const { bridge, mode, loop, io, control } = setup(1);
    const acted = () => actedOf(io, control);
    loop.attach();
    mode.toggle("loop");
    bridge.poke();
    expect(acted()).toBe(1);

    mode.toggle("loop");
    bridge.poke();
    expect(acted()).toBe(1);

    mode.toggle("loop");
    bridge.poke();
    expect(acted()).toBe(2);

    loop.dispose();
  });

  it("剩余时间充足时不被误触发", () => {
    const { bridge, mode, loop, io, control } = setup(60);
    const acted = () => actedOf(io, control);
    loop.attach();
    mode.toggle("loop");
    bridge.poke();
    expect(acted()).toBe(0);
    loop.dispose();
  });
});
