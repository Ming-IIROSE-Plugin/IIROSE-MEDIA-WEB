import { afterEach, describe, expect, it, vi } from "vitest";
import { HostMediaBridge, MediaHost } from "./HostMediaBridge";
import { ProgressSession } from "./ProgressSession";
import { Socket } from "../iirose_func/Socket";

function fixture() {
  let playing = true;
  const host: MediaHost = {
    shareMediaCurrentTime: 80,
    shareMediaDuration: "300",
    socket: { readyState: 1, send: vi.fn() },
    rank: "0",
    roomnFull: "fixture-room",
    Info: { room: { identity: 1 } },
    shareMedia: vi.fn(function (this: unknown) {
      host.shareMediaCurrentTime = 0;
      return this;
    }),
    Utils: {
      service: {
        isShareMediaPlaying: () => playing,
        seekDemandMedia: function (time: unknown) {
          host.shareMediaCurrentTime = time;
          return "seek-return";
        },
      },
    },
  };
  document.body.innerHTML =
    '<div id="shareMediaSongName">同名媒体</div><div id="shareMediaUserName"></div><input id="draft" value="未发送的草稿">';
  const send = vi.fn();
  const bridge = new HostMediaBridge(host, document, send);
  const session = new ProgressSession(bridge, vi.fn());
  return {
    host,
    bridge,
    session,
    send,
    end: () => {
      playing = false;
    },
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("宿站桥接与交互生命周期", () => {
  it("默认发送器仅发送独立控制报文，保留 socket 接收者及输入草稿选区", () => {
    vi.useFakeTimers();
    const { host, session: unused } = fixture();
    unused.dispose();
    const publicSend = vi.spyOn(Socket.prototype, "sendMessage");
    const otherSocketSend = vi.fn();
    vi.stubGlobal("socket", { readyState: 1, send: otherSocketSend });
    document.body.innerHTML = '<textarea id="moveinput"></textarea>';
    const draft = document.getElementById("moveinput") as HTMLTextAreaElement;
    draft.value = '保留草稿："未发送"\n第二行';
    draft.setSelectionRange(2, 5, "backward");
    const originalDraft = draft.value;
    const service = host.Utils!.service!;
    const chat = {
      moveinputDo: vi.fn(),
      msgfetch: vi.fn(),
      getcontents: vi.fn(),
    };
    Object.assign(service, chat);
    Object.assign(host, chat);
    const control = vi.fn(function (this: unknown) {
      expect(this).toBe(host.socket);
    });
    host.socket!.send = control;
    const session = new ProgressSession(new HostMediaBridge(host), vi.fn());
    try {
      session.begin();
      session.preview(120);
      expect(control).not.toHaveBeenCalled();
      session.commit();
      session.commit();
      expect(control.mock.calls).toEqual([['!16["120s"]']]);
      expect(session.state.waiting).toBe(true);
      service.seekDemandMedia!(120);
      expect(session.state.media.current).toBe(120);
      expect(session.state.waiting).toBe(false);
      session.step(60);
      expect(control.mock.calls).toEqual([['!16["120s"]'], ['!15[">","1m"]']]);
      expect(publicSend).not.toHaveBeenCalled();
      for (const send of Object.values(chat))
        expect(send).not.toHaveBeenCalled();
      expect(otherSocketSend).not.toHaveBeenCalled();
      expect(draft.value).toBe(originalDraft);
      expect([
        draft.selectionStart,
        draft.selectionEnd,
        draft.selectionDirection,
      ]).toEqual([2, 5, "backward"]);
    } finally {
      session.dispose();
    }
  });
  it("顶层全局媒体角色允许普通身份控制", () => {
    const { host, bridge, session: unused, send } = fixture();
    unused.dispose();
    host.Info!.room = { identity: 0 };
    host.rank = "5";
    const session = new ProgressSession(bridge, vi.fn());
    try {
      expect(session.state.media.permission).toBe("allowed");
      session.step(1);
      expect(send).toHaveBeenCalledOnce();
    } finally {
      session.dispose();
    }
  });
  it("普通身份无全局角色时立即拒绝，不创建等待或发送", () => {
    vi.useFakeTimers();
    const { host, bridge, session: unused, send } = fixture();
    unused.dispose();
    host.Info!.room = { identity: 0 };
    host.rank = "4";
    host.roomnFull = "ordinary";
    const session = new ProgressSession(bridge, vi.fn());
    try {
      expect(session.state.media.permission).toBe("denied");
      expect(session.state.media.permissionReason).toBe(
        "当前房间无媒体管理权限",
      );
      session.step(60);
      expect(send).not.toHaveBeenCalled();
      expect(session.state.waiting).toBe(false);
      expect(session.state.message).toBe("当前房间无媒体管理权限");
    } finally {
      session.dispose();
    }
  });
  it("本人点播缺少宿站函数时禁用，不降级为静默发送", () => {
    const { host, bridge, session: unused, send } = fixture();
    unused.dispose();
    host.Info!.room = { identity: 0 };
    host.rank = "4";
    host.roomnFull = "ordinary";
    host.myself = "测试账号";
    document
      .getElementById("shareMediaUserName")!
      .setAttribute("title", "测试账号");
    const session = new ProgressSession(bridge, vi.fn());
    try {
      expect(session.state.media.permission).toBe("denied");
      expect(session.state.media.controlMode).toBe("owner");
      expect(session.state.media.controlReason).toContain("本人点播控制不可用");
      session.step(1);
      expect(send).not.toHaveBeenCalled();
    } finally {
      session.dispose();
    }
  });
  it("缺失或非法权限字段保守禁用并提示信息未就绪", () => {
    const { host, bridge, session: unused, send } = fixture();
    unused.dispose();
    host.Info = { room: { identity: "1" } };
    host.rank = 4;
    host.roomnFull = "unknown";
    const session = new ProgressSession(bridge, vi.fn());
    try {
      expect(session.state.media.permission).toBe("unknown");
      expect(session.state.media.permissionReason).toBe(
        "权限信息未就绪，暂时无法调整",
      );
      session.step(1);
      expect(send).not.toHaveBeenCalled();
      expect(session.state.waiting).toBe(false);
    } finally {
      session.dispose();
    }
  });
  it("权限恢复后清除旧拒绝提示，失权时取消等待", () => {
    vi.useFakeTimers();
    const { host, bridge, session: unused, send } = fixture();
    unused.dispose();
    host.Info!.room = { identity: 0 };
    host.rank = "4";
    host.roomnFull = "changing";
    const session = new ProgressSession(bridge, vi.fn());
    try {
      session.step(1);
      expect(session.state.message).toBe("当前房间无媒体管理权限");
      host.Info!.room!.identity = 1;
      vi.advanceTimersByTime(250);
      expect(session.state.media.permission).toBe("allowed");
      expect(session.state.message).toBe("");
      session.step(1);
      expect(send).toHaveBeenCalledOnce();
      expect(session.state.waiting).toBe(true);
      host.Info!.room!.identity = 0;
      vi.advanceTimersByTime(250);
      expect(session.state.waiting).toBe(false);
      expect(session.state.media.permission).toBe("denied");
      expect(session.state.message).toBe("当前房间无媒体管理权限");
    } finally {
      session.dispose();
    }
  });
  it("预览后失权在轮询前提交仍零发送、零等待", () => {
    vi.useFakeTimers();
    const { host, session, send } = fixture();
    try {
      expect(session.begin()).toBe(true);
      session.preview(120);
      expect(session.state.preview).toBe(120);
      host.Info!.room!.identity = 0;
      host.rank = "4";
      // 不推进轮询：提交边界必须重新读取宿站权限。
      expect(session.state.media.permission).toBe("allowed");
      session.commit();
      expect(send).not.toHaveBeenCalled();
      expect(session.state.waiting).toBe(false);
      expect(session.state.preview).toBeNull();
      expect(session.state.media.permission).toBe("denied");
      expect(session.state.message).toBe("当前房间无媒体管理权限");
      vi.advanceTimersByTime(5000);
      expect(send).not.toHaveBeenCalled();
      expect(session.state.waiting).toBe(false);
      expect(session.state.message).toBe("当前房间无媒体管理权限");
    } finally {
      session.dispose();
    }
  });
  it("等待期间换房后旧定位回调与超时不覆盖取消状态", () => {
    vi.useFakeTimers();
    const { host, session, send } = fixture();
    try {
      session.step(60);
      expect(session.state.waiting).toBe(true);
      expect(send).toHaveBeenCalledExactlyOnceWith('!15[">","1m"]');
      const previousInstance = session.state.media.instance;
      const oldSeek = host.Utils!.service!.seekDemandMedia!;
      host.roomnFull = "another-room";
      vi.advanceTimersByTime(250);
      expect(session.state.media.instance).not.toBe(previousInstance);
      expect(session.state.waiting).toBe(false);
      expect(session.state.preview).toBeNull();
      const cancellation = "媒体已切换，已取消上次操作";
      expect(session.state.message).toBe(cancellation);
      // 回调时间恰好命中旧目标，也不能确认已取消的操作。
      oldSeek(140);
      expect(session.state.media.current).toBe(140);
      expect(session.state.waiting).toBe(false);
      expect(session.state.message).toBe(cancellation);
      vi.advanceTimersByTime(5000);
      expect(session.state.waiting).toBe(false);
      expect(session.state.preview).toBeNull();
      expect(session.state.message).toBe(cancellation);
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      session.dispose();
    }
  });
  it("房间标识变化使预览和等待实例失效", () => {
    vi.useFakeTimers();
    const { host, bridge, session: unused, send } = fixture();
    unused.dispose();
    const session = new ProgressSession(bridge, vi.fn());
    try {
      session.begin();
      session.preview(120);
      host.roomnFull = "another-room";
      session.commit();
      expect(send).not.toHaveBeenCalled();
      expect(session.state.preview).toBeNull();
      expect(session.state.waiting).toBe(false);
      expect(session.state.message).toContain("媒体已切换");
    } finally {
      session.dispose();
    }
  });
  it("mediaShareRoom 明确为 false 时不调用控制函数或普通公聊", () => {
    vi.useFakeTimers();
    const { host, session: unused } = fixture();
    unused.dispose();
    host.mediaShareRoom = false;
    const control = host.socket!.send as ReturnType<typeof vi.fn>;
    const publicSend = vi.spyOn(Socket.prototype, "sendMessage");
    const session = new ProgressSession(new HostMediaBridge(host), vi.fn());
    try {
      session.step(60);
      expect(control).not.toHaveBeenCalled();
      expect(publicSend).not.toHaveBeenCalled();
      expect(session.state.waiting).toBe(false);
      expect(session.state.message).toBe("当前房间不支持媒体进度控制");
    } finally {
      session.dispose();
    }
  });
  it.each(["missing", "throws", "disconnect", "no-socket"])(
    "socket %s 时安全失败且保护草稿选区",
    (mode) => {
      vi.useFakeTimers();
      const { host, session: unused } = fixture();
      unused.dispose();
      document.body.innerHTML =
        '<textarea id="moveinput">未发送草稿</textarea>';
      const draft = document.getElementById("moveinput") as HTMLTextAreaElement;
      draft.setSelectionRange(1, 3, "backward");
      const control = vi.fn(() => {
        throw new Error("unavailable");
      });
      host.socket!.send = mode === "missing" ? undefined : control;
      if (mode === "disconnect") host.socket!.readyState = 3;
      if (mode === "no-socket") host.socket = undefined;
      const chat = {
        moveinputDo: vi.fn(),
        msgfetch: vi.fn(),
        getcontents: vi.fn(),
      };
      Object.assign(host.Utils!.service!, chat);
      Object.assign(host, chat);
      const publicSend = vi.spyOn(Socket.prototype, "sendMessage");
      const session = new ProgressSession(new HostMediaBridge(host), vi.fn());
      try {
        session.step(60);
        expect(publicSend).not.toHaveBeenCalled();
        expect(control).toHaveBeenCalledTimes(mode === "throws" ? 1 : 0);
        expect(draft.value).toBe("未发送草稿");
        expect([
          draft.selectionStart,
          draft.selectionEnd,
          draft.selectionDirection,
        ]).toEqual([1, 3, "backward"]);
        for (const send of Object.values(chat))
          expect(send).not.toHaveBeenCalled();
        expect(session.state.waiting).toBe(false);
        if (mode === "missing")
          expect(session.state.message).toContain("控制不可用");
        if (mode === "throws")
          expect(session.state.message).toContain("连接、房间权限");
      } finally {
        session.dispose();
      }
    },
  );
  it.each([
    [1, '!15[">","1s"]'],
    [-1, '!15["<","1s"]'],
    [60, '!15[">","1m"]'],
    [-60, '!15["<","1m"]'],
  ])("默认发送器步进 %s 只发 %s，无权限回执时5秒未确认", (seconds, command) => {
    vi.useFakeTimers();
    const { host, session: unused } = fixture();
    unused.dispose();
    const publicSend = vi.spyOn(Socket.prototype, "sendMessage");
    const chat = {
      moveinputDo: vi.fn(),
      msgfetch: vi.fn(),
      getcontents: vi.fn(),
    };
    Object.assign(host, chat);
    Object.assign(host.Utils!.service!, chat);
    const session = new ProgressSession(new HostMediaBridge(host), vi.fn());
    try {
      session.step(Number(seconds));
      expect(host.socket!.send).toHaveBeenCalledExactlyOnceWith(command);
      expect(session.state.waiting).toBe(true);
      vi.advanceTimersByTime(4999);
      expect(session.state.waiting).toBe(true);
      vi.advanceTimersByTime(1);
      expect(session.state.waiting).toBe(false);
      expect(session.state.message).toBe("未收到调整确认，请稍后重试");

      vi.advanceTimersByTime(10000);
      expect(host.socket!.send).toHaveBeenCalledTimes(1);
      expect(publicSend).not.toHaveBeenCalled();
      for (const send of Object.values(chat))
        expect(send).not.toHaveBeenCalled();
    } finally {
      session.dispose();
    }
  });
  it("发送边界拒绝任意文本、其他协议及非正安全整数，不调用任何发送器", () => {
    const { host, bridge, session, send } = fixture();
    const defaultBridge = new HostMediaBridge(host);
    try {
      for (const command of [
        "快进1s",
        "普通聊天",
        '!16[">","1s"]',
        '!16["301s"]',
        '!16["01s"]',
        '!15[">","0s"]',
        '!15["<","-1m"]',
        '!15[">","1.5s"]',
        '!15[">","01s"]',
        '!15[">","1e2s"]',
        '!15[">","9007199254740992m"]',
        '!15[">","Infinitys"]',
        '!15[">","NaNs"]',
        '!15["x","1s"]',
        '!15[">","1h"]',
        '!15[">",1]',
        '!15[">","1s","m"]',
        '!15[">","1s"]\n',
        '!15[">","1s"]m聊天',
        '{"m":"快进1s"}',
        '{"mc":"快进1s","i":"1"}',
      ]) {
        expect(defaultBridge.send(command, 0, "silent")).toBe(false);
        expect(bridge.send(command, 0, "silent")).toBe(false);
      }
      expect(host.socket!.send).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    } finally {
      session.dispose();
      defaultBridge.dispose();
    }
  });
  it("绝对定位允许零秒，拒绝超过当前媒体时长", () => {
    const { host, bridge, session, send } = fixture();
    try {
      expect(
        bridge.send('!16["0s"]', session.state.media.instance, "silent"),
      ).toBe(true);
      expect(
        bridge.send('!16["301s"]', session.state.media.instance, "silent"),
      ).toBe(false);
      expect(send).toHaveBeenCalledExactlyOnceWith('!16["0s"]');
    } finally {
      session.dispose();
    }
  });

  it.each([
    [300.8, 300],
    [0.8, 0],
  ])("小数时长 %s 末尾预览、发送及确认统一为 %s", (duration, target) => {
    vi.useFakeTimers();
    const { session, host, bridge, send } = fixture();
    try {
      host.shareMediaDuration = duration;
      host.shareMediaCurrentTime = 0;
      session.begin();
      session.preview(duration);
      expect(session.state.preview).toBe(target);
      session.commit();
      expect(send).toHaveBeenCalledExactlyOnceWith(`!16["${target}s"]`);
      expect(session.state.waiting).toBe(true);
      expect(
        bridge.send(
          `!16["${target + 1}s"]`,
          session.state.media.instance,
          "silent",
        ),
      ).toBe(false);
      host.Utils!.service!.seekDemandMedia!(target);
      expect(session.state.waiting).toBe(false);
      expect(session.state.message).toBe("宿站进度已更新");
      vi.advanceTimersByTime(5000);
      expect(session.state.message).toBe("宿站进度已更新");
      expect(send).toHaveBeenCalledOnce();
    } finally {
      session.dispose();
    }
  });
  it.each(["silent", "owner"])(
    "%s 相对控制三秒后真实回读143立即确认",
    (mode) => {
      vi.useFakeTimers();
      const { session, host, send } = fixture();
      const ownerSend = vi.fn();
      try {
        if (mode === "owner") {
          host.Info!.room!.identity = 0;
          host.myself = "测试账号";
          document.getElementById("shareMediaUserName")!.title = "测试账号";
          host.Utils!.service!.moveinputDo = ownerSend;
          session.begin();
          session.preview(140);
          session.commit();
        } else session.step(60);
        vi.advanceTimersByTime(3000);
        host.Utils!.service!.seekDemandMedia!(143);
        expect(session.state.waiting).toBe(false);
        expect(session.state.message).toBe("宿站进度已更新");
        vi.advanceTimersByTime(5000);
        expect(session.state.message).toBe("宿站进度已更新");
        if (mode === "owner")
          expect(ownerSend).toHaveBeenCalledExactlyOnceWith("快进1m");
        else expect(send).toHaveBeenCalledExactlyOnceWith('!15[">","1m"]');
      } finally {
        session.dispose();
      }
    },
  );
  it("绝对目标不放宽延迟容差，无关回调及自然推进不能确认", () => {
    vi.useFakeTimers();
    const { session, host, send } = fixture();
    try {
      session.begin();
      session.preview(140);
      session.commit();
      vi.advanceTimersByTime(3000);
      host.Utils!.service!.seekDemandMedia!(143);
      expect(session.state.waiting).toBe(true);
      host.shareMediaCurrentTime = 140;
      vi.advanceTimersByTime(250);
      expect(session.state.waiting).toBe(true);
      vi.advanceTimersByTime(1750);
      expect(session.state.message).toBe("未收到调整确认，请稍后重试");
      expect(send).toHaveBeenCalledOnce();
    } finally {
      session.dispose();
    }
  });
  it.each([137, 146])(
    "相对回读%s超出三秒区间，后续自然推进不确认",
    (readback) => {
      vi.useFakeTimers();
      const { session, host, send } = fixture();
      try {
        session.step(60);
        host.shareMediaCurrentTime = 140;
        vi.advanceTimersByTime(3000);
        expect(session.state.waiting).toBe(true);
        host.Utils!.service!.seekDemandMedia!(readback);
        expect(session.state.waiting).toBe(true);
        host.shareMediaCurrentTime = 143;
        vi.advanceTimersByTime(250);
        expect(session.state.waiting).toBe(true);
        vi.advanceTimersByTime(1750);
        expect(session.state.waiting).toBe(false);
        expect(session.state.message).toBe("未收到调整确认，请稍后重试");
        host.Utils!.service!.seekDemandMedia!(145);
        expect(session.state.message).toBe("未收到调整确认，请稍后重试");
        expect(send).toHaveBeenCalledOnce();
      } finally {
        session.dispose();
      }
    },
  );
  it("相对确认以编码后的整秒偏移为准", () => {
    vi.useFakeTimers();
    const { session, host, send } = fixture();
    try {
      host.shareMediaCurrentTime = 80.4;
      session.begin("step");
      session.preview(140);
      session.commit();
      expect(send).toHaveBeenCalledExactlyOnceWith('!15[">","1m"]');
      host.Utils!.service!.seekDemandMedia!(138.2);
      expect(session.state.waiting).toBe(true);
      host.Utils!.service!.seekDemandMedia!(142.3);
      expect(session.state.waiting).toBe(false);
    } finally {
      session.dispose();
    }
  });
  it("相对确认区间不越过媒体时长，且超过单调五秒预算不确认", () => {
    vi.useFakeTimers();
    const { session, host } = fixture();
    try {
      host.shareMediaCurrentTime = 280;
      session.step(60);
      vi.advanceTimersByTime(3000);
      host.Utils!.service!.seekDemandMedia!(301);
      expect(session.state.waiting).toBe(true);
      host.Utils!.service!.seekDemandMedia!(300);
      expect(session.state.waiting).toBe(false);
      session.step(-60);
      // 定时器尚未执行也必须拒绝预算外的回执。
      vi.spyOn(performance, "now").mockReturnValue(performance.now() + 5000);
      host.Utils!.service!.seekDemandMedia!(240);
      expect(session.state.waiting).toBe(true);
      vi.advanceTimersByTime(5000);
      expect(session.state.message).toBe("未收到调整确认，请稍后重试");
    } finally {
      session.dispose();
    }
  });
  it("拖动中零消息，释放按最新时间发一条并保护草稿", () => {
    vi.useFakeTimers();
    const { session, host, send } = fixture();
    session.begin();
    session.preview(120);
    session.preview(121);
    expect(send).not.toHaveBeenCalled();
    host.shareMediaCurrentTime = 81;
    session.commit();
    session.commit();
    session.step(1);
    expect(send.mock.calls).toEqual([['!16["121s"]']]);
    expect((document.getElementById("draft") as HTMLInputElement).value).toBe(
      "未发送的草稿",
    );
    expect(session.state.waiting).toBe(true);
    host.shareMediaCurrentTime = 121;
    vi.advanceTimersByTime(1000);
    expect(session.state.waiting).toBe(true);
    expect(host.Utils!.service!.seekDemandMedia!(121)).toBe("seek-return");
    expect(session.state.waiting).toBe(false);
    expect(session.state.media.current).toBe(121);
    session.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("同标题的新播放实例取消拖动与等待，旧回调不确认新媒体", () => {
    vi.useFakeTimers();
    const { session, host, send } = fixture();
    session.begin();
    session.preview(120);
    const receiver = {};
    expect(host.shareMedia!.call(receiver)).toBe(receiver);
    session.commit();
    expect(send).not.toHaveBeenCalled();
    session.step(60);
    expect(session.state.waiting).toBe(true);
    host.shareMedia!();
    host.Utils!.service!.seekDemandMedia!(60);
    expect(session.state.waiting).toBe(false);
    expect(session.state.message).toContain("媒体已切换");
    expect(send).toHaveBeenCalledTimes(1);
    session.dispose();
  });
  it("5秒无定位确认则提示未确认，不重发", () => {
    vi.useFakeTimers();
    const { session, host, send } = fixture();
    session.step(-60);
    expect(send).toHaveBeenCalledWith('!15["<","1m"]');
    host.Utils!.service!.seekDemandMedia!(10);
    expect(session.state.waiting).toBe(true);
    host.shareMediaCurrentTime = 20;
    vi.advanceTimersByTime(4999);
    expect(session.state.waiting).toBe(true);
    vi.advanceTimersByTime(1);
    expect(session.state.waiting).toBe(false);
    expect(session.state.message).toBe("未收到调整确认，请稍后重试");
    vi.advanceTimersByTime(20000);
    expect(send).toHaveBeenCalledTimes(1);
    session.dispose();
  });
  it("边界步进只发实际差值，取消手势不发", () => {
    vi.useFakeTimers();
    const { session, host, send } = fixture();
    host.shareMediaCurrentTime = 10;
    session.step(-60);
    expect(send).toHaveBeenCalledWith('!15["<","10s"]');
    host.Utils!.service!.seekDemandMedia!(0);
    session.step(-1);
    expect(send).toHaveBeenCalledTimes(1);
    session.begin();
    session.preview(60);
    session.cancel();
    session.commit();
    expect(send).toHaveBeenCalledTimes(1);
    session.dispose();
  });
  it.each(["empty", "unknown", "disconnect"])(
    "%s 禁用且取消旧操作",
    (reason) => {
      vi.useFakeTimers();
      const { session, host, send, end } = fixture();
      session.begin();
      session.preview(120);
      if (reason === "empty") end();
      if (reason === "unknown") host.shareMediaDuration = Infinity;
      if (reason === "disconnect") host.socket!.readyState = 3;
      session.commit();
      session.step(1);
      expect(send).not.toHaveBeenCalled();
      expect(session.state.preview).toBeNull();
      session.dispose();
    },
  );
  it("发送异常解除等待；关闭释放观察，重新打开读新值", () => {
    vi.useFakeTimers();
    const { bridge, session, host, send } = fixture();
    send.mockImplementation(() => {
      throw new Error("closed");
    });
    session.step(1);
    expect(session.state.waiting).toBe(false);
    expect(session.state.message).toContain("发送失败");
    session.dispose();
    expect(vi.getTimerCount()).toBe(0);
    host.shareMediaCurrentTime = 200;
    const reopened = new ProgressSession(bridge, vi.fn());
    expect(reopened.state.media.current).toBe(200);
    reopened.dispose();
  });
  it("外部嵌套包装在关闭后失效，重开与重新包装只通知一次", () => {
    vi.useFakeTimers();
    const original = vi.fn(function (this: unknown) {
      return this;
    });
    const host: MediaHost = { shareMedia: original };
    const bridge = new HostMediaBridge(host);
    let stop = bridge.subscribe(vi.fn());
    const receiver = {};
    for (let index = 0; index < 3; index++) {
      const nested = host.shareMedia!;
      const external = function (this: unknown, ...args: unknown[]) {
        return nested.apply(this, args);
      };
      host.shareMedia = external;
      vi.advanceTimersByTime(250);
      stop();
      const before = bridge.read().instance;
      expect(external.call(receiver)).toBe(receiver);
      expect(bridge.read().instance).toBe(before);
      const listener = vi.fn();
      stop = bridge.subscribe(listener);
      listener.mockClear();
      expect(host.shareMedia!.call(receiver)).toBe(receiver);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(bridge.read().instance).toBe(before + 1);
    }
    stop();
    expect(original).toHaveBeenCalledTimes(6);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("支持延迟初始化并还原包装，不覆盖后安装的钩子", () => {
    vi.useFakeTimers();
    const host: MediaHost = {};
    const bridge = new HostMediaBridge(host);
    const stop = bridge.subscribe(vi.fn());
    const original = vi.fn();
    host.shareMedia = original;
    vi.advanceTimersByTime(250);
    expect(host.shareMedia).not.toBe(original);
    const later = vi.fn();
    host.shareMedia = later;
    stop();
    expect(host.shareMedia).toBe(later);
    const stopAgain = bridge.subscribe(vi.fn());
    stopAgain();
    expect(host.shareMedia).toBe(later);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("快照中的点播归属与房间标识", () => {
  it("owner 与 ownMedia 同源：昵称去首尾空白，空白与缺失为空串", () => {
    const { host, bridge, session } = fixture();
    const owner = document.getElementById("shareMediaUserName")!;
    try {
      // 缺失（没有 title 属性）
      expect(bridge.read().owner).toBe("");
      // 有昵称：只 trim，不做其他归一化
      owner.setAttribute("title", "  小飞鱼  ");
      expect(bridge.read().owner).toBe("小飞鱼");
      // 全空白
      owner.setAttribute("title", "   ");
      expect(bridge.read().owner).toBe("");
      // owner 不影响归属判定：非本人时仍写入他人昵称
      owner.setAttribute("title", "小飞鱼");
      host.myself = "铭铭";
      expect(bridge.read()).toMatchObject({ owner: "小飞鱼", ownMedia: false });
      host.myself = "小飞鱼";
      expect(bridge.read()).toMatchObject({ owner: "小飞鱼", ownMedia: true });
    } finally {
      session.dispose();
    }
  });

  it("ownMedia 取两侧去首尾空白后的严格相等，未知与不等一律 false", () => {
    const { host, bridge, session } = fixture();
    const owner = document.getElementById("shareMediaUserName")!;
    try {
      // 点播者信息缺失（title 与 myself 都没有）
      expect(bridge.read().ownMedia).toBe(false);
      host.myself = "测试账号";
      expect(bridge.read().ownMedia).toBe(false);
      owner.setAttribute("title", "  测试账号  ");
      host.myself = " 测试账号 ";
      expect(bridge.read().ownMedia).toBe(true);
      owner.setAttribute("title", "测试账号2");
      expect(bridge.read().ownMedia).toBe(false);
      owner.setAttribute("title", "   ");
      expect(bridge.read().ownMedia).toBe(false);
      // window.myself 不是字符串时不做隐式转换。
      owner.setAttribute("title", "42");
      host.myself = 42;
      expect(bridge.read().ownMedia).toBe(false);
      // 不做 HTML 实体/全角归一化：形近即视为非本人。
      host.myself = "测试账号";
      owner.setAttribute("title", "测试帐号");
      expect(bridge.read().ownMedia).toBe(false);
    } finally {
      session.dispose();
    }
  });

  it("roomKey 暴露 roomnFull 字符串化值，缺失为 null 且不影响 instance 语义", () => {
    const { host, bridge, session } = fixture();
    try {
      expect(bridge.read().roomKey).toBe("fixture-room");
      host.roomnFull = 1024;
      expect(bridge.read().roomKey).toBe("1024");
      host.roomnFull = "   ";
      expect(bridge.read().roomKey).toBeNull();
      delete host.roomnFull;
      expect(bridge.read().roomKey).toBeNull();
      // 换房仍靠 instance 失效：每次读取只在房间标识变化时自增一次。
      const instance = bridge.read().instance;
      host.roomnFull = "another-room";
      expect(bridge.read().instance).toBe(instance + 1);
      expect(bridge.read().instance).toBe(instance + 1);
      expect(bridge.read().roomKey).toBe("another-room");
    } finally {
      session.dispose();
    }
  });
});
