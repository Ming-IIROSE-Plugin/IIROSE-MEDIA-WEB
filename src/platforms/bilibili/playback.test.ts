import { afterEach, describe, expect, it, vi } from "vitest";
import { SendFetch } from "../../Api";
import { BiliBiliLiveApi } from "../../Api/BilibiliAPI/BiliBiliLive";
import { Socket } from "../../iirose_func/Socket";
import { Announce } from "../../iirose_func/Socket/Announce";
import { reportFailure } from "../../tools/reportFailure";
import { streamLive } from "./playback";

vi.mock("../../tools/reportFailure", () => ({ reportFailure: vi.fn() }));

const room = {
  title: "直播测试",
  author: "主播",
  coverImg: "https://example.com/cover.jpg",
  websiteUrl: "https://live.bilibili.com/544864",
  bilibiliLive: { roomid: 544864 },
} as PlatformData;

const playInfo = (data: unknown) => ({
  code: 0,
  message: "OK",
  ttl: 1,
  data: data as LiveRoomPlayInfoDetailData,
});

const interceptPlayback = () => {
  vi.spyOn(Announce, "runSingleAnnounce").mockImplementation(async (play) => {
    await play();
  });
  vi.spyOn(Announce, "sendMediaCard").mockImplementation(() => {});
  return vi.spyOn(Socket.prototype, "send").mockImplementation(() => {});
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("B站直播点播", () => {
  it("用 GET 验证 HLS 清单并提交备用 CDN 的 H.264 播放地址", async () => {
    vi.spyOn(BiliBiliLiveApi, "getLiveRoomPlayInfo").mockResolvedValue(
      playInfo({
        live_status: 1,
        playurl_info: {
          playurl: {
            stream: [
              {
                protocol_name: "http_hls",
                format: [
                  {
                    format_name: "fmp4",
                    codec: [
                      {
                        codec_name: "avc",
                        current_qn: 250,
                        base_url: "/index.m3u8",
                        url_info: [
                          {
                            host: "https://bad.example.com",
                            extra: "?sign=first",
                          },
                          {
                            host: "https://cdn.example.com",
                            extra: "?sign=a%2Bb",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      }),
    );
    const legacy = vi.spyOn(BiliBiliLiveApi, "getLiveStream");
    const head = vi.spyOn(SendFetch, "tryGetWhithXhr");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("not a playlist"))
        .mockResolvedValueOnce(new Response("#EXTM3U\n")),
    );
    const send = interceptPlayback();

    await streamLive("abcdef", room);

    expect(head).not.toHaveBeenCalled();
    expect(legacy).not.toHaveBeenCalled();
    expect(reportFailure).not.toHaveBeenCalled();
    const [packet] = send.mock.calls[0];
    expect(packet.startsWith("&1")).toBe(true);
    expect(JSON.parse(packet.slice(2))).toMatchObject({
      s: "s://cdn.example.com/index.m3u8?sign=a%2Bb",
      b: "!8",
    });
  });

  it("使用旧接口回退并在取不到流时提示失败", async () => {
    vi.spyOn(BiliBiliLiveApi, "getLiveRoomPlayInfo").mockResolvedValue(null);
    const legacy = vi
      .spyOn(BiliBiliLiveApi, "getLiveStream")
      .mockResolvedValue({ code: 19001012, data: { current_qn: 0 } });
    const send = interceptPlayback();

    await streamLive("abcdef", room);

    expect(legacy).toHaveBeenCalledWith(544864, "web", 10000);
    expect(reportFailure).toHaveBeenCalledWith(new Error("获取直播流失败"));
    expect(send).not.toHaveBeenCalled();
  });

  it("直播间当前锁定时提示不可播放", async () => {
    vi.spyOn(BiliBiliLiveApi, "getLiveRoomPlayInfo").mockResolvedValue(
      playInfo({ is_locked: true, live_status: 1 }),
    );
    const legacy = vi.spyOn(BiliBiliLiveApi, "getLiveStream");
    const send = interceptPlayback();

    await streamLive("abcdef", room);

    expect(reportFailure).toHaveBeenCalledWith(
      new Error("B站直播间当前不可播放"),
    );
    expect(legacy).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
