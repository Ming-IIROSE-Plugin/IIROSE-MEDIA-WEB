import type { MediaSnapshot } from "../media-progress/model";

// 播放模式两个用例文件共享同一份快照工厂；model 增删字段时只改这一处。
export function snapshot(patch: Partial<MediaSnapshot> = {}): MediaSnapshot {
  return {
    instance: 1,
    title: "测试曲目",
    cover: "",
    current: 30,
    duration: 200,
    playing: true,
    connected: true,
    owner: "",
    ownMedia: true,
    roomKey: "fixture-room",
    seekVersion: 0,
    dark: false,
    permission: "allowed",
    permissionReason: "",
    controlMode: "silent",
    controlNotice: "",
    controlReason: "",
    ...patch,
  };
}
