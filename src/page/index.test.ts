import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Socket } from "../iirose_func/Socket";
import { IMCInit } from "./index";

const sent = vi.fn();
const payload = `&1${JSON.stringify({
  s: "https://a/b.mp3",
  d: 300,
  c: "https://a/c.jpg",
  n: "甲",
  r: "歌手",
  b: "@0",
  o: "https://music.163.com/#/song?id=1",
  l: "",
})}`;

const loop = () =>
  document.getElementById("imw-toggle-loop") as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", function WebSocketStub() {});
  sent.mockClear();
  Object.assign(window, {
    shareMediaCurrentTime: 80,
    shareMediaDuration: 300,
    socket: { readyState: 1, send: sent },
    // 无媒体管理权限且非本人点播：循环是否可用完全取决于报文缓存。
    rank: "0",
    myself: "",
    roomnFull: "wiring-room",
    Info: { room: { identity: 0 } },
    shareMedia: () => {},
    Utils: {
      service: { isShareMediaPlaying: () => true, seekDemandMedia: () => {} },
    },
  });
  document.body.innerHTML =
    '<div id="mainContainer"></div><div id="functionHolder"><div id="functionHolderExtBox">' +
    '<div class="functionButtonExt"><div id="shareMediaBox">' +
    '<div id="shareMediaSongName">甲</div><div id="shareMediaUserName"></div>' +
    "</div></div></div></div>";
});

afterEach(() => {
  window.dispatchEvent(
    new PageTransitionEvent("pagehide", { persisted: false }),
  );
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Socket.observe = undefined;
  document.body.innerHTML = "";
});

describe("播放报文观察接线", () => {
  it("插件自己发出的报文让循环可用，卸载后钩子被摘除", () => {
    IMCInit.init(document.getElementById("mainContainer") as HTMLDivElement);
    expect(typeof Socket.observe).toBe("function");
    vi.advanceTimersByTime(250);
    expect(loop().getAttribute("aria-disabled")).toBe("true");

    new Socket().send(payload);
    vi.advanceTimersByTime(250);
    expect(loop().getAttribute("aria-disabled")).toBe("false");
    loop().click();
    expect(loop().getAttribute("aria-pressed")).toBe("true");

    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false }),
    );
    expect(Socket.observe).toBeUndefined();
  });
});

describe("主面板单实例", () => {
  const panels = () => document.querySelectorAll("#IIROSE_MEDIA_CONTAINER");
  const mainContainer = () =>
    document.getElementById("mainContainer") as HTMLDivElement;

  afterEach(() => {
    delete (window as Window & { __imwMainPanel?: () => void }).__imwMainPanel;
  });

  it("重复初始化与另一份 bundle 接管后同页只有一个主面板", async () => {
    IMCInit.init(mainContainer());
    IMCInit.init(mainContainer());
    expect(panels()).toHaveLength(1);
    expect(mainContainer().children).toHaveLength(1);

    // 另一份 bundle 实例：模块级状态全新，只能靠页面级单例键接管。
    vi.resetModules();
    const reloaded = await import("./index");
    reloaded.IMCInit.init(mainContainer());
    expect(panels()).toHaveLength(1);
    expect(mainContainer().children).toHaveLength(1);
  });

  it("没有单例键的旧版残留容器也会被清掉", () => {
    const legacy = document.createElement("div");
    legacy.innerHTML = '<div id="IIROSE_MEDIA_CONTAINER"></div>';
    mainContainer().append(legacy);
    IMCInit.init(mainContainer());
    expect(legacy.isConnected).toBe(false);
    expect(panels()).toHaveLength(1);
  });

  it("面板开着时被接管，归还宿站聊天区", () => {
    const holder = document.createElement("div");
    holder.id = "mainHolder";
    document.body.append(holder);
    IMCInit.init(mainContainer());
    holder.classList.add("hidemainHolder");
    IMCInit.init(mainContainer());
    expect(holder.classList.contains("hidemainHolder")).toBe(false);
  });
});
