export type MediaPermission = "allowed" | "denied" | "unknown";
export type MediaControlMode = "silent" | "owner" | "unavailable";

export interface MediaSnapshot {
  instance: number;
  title: string;
  cover: string;
  current: number | null;
  duration: number | null;
  playing: boolean;
  connected: boolean;
  // 当前曲目点播者昵称（`#shareMediaUserName[title]`，去首尾空白）；缺失为空串。
  // 只用于底部条「某某 点播」，归属判定仍走 ownMedia。
  owner: string;
  // 当前曲目点播者与本人昵称一致；任一缺失或不等即为 false（保守）。
  ownMedia: boolean;
  // 宿站房间标识（roomnFull 字符串化）；缺失为 null，无标识视为未变化。
  roomKey: string | null;
  seekVersion: number;
  dark: boolean;
  permission: MediaPermission;
  permissionReason: string;
  controlMode: MediaControlMode;
  controlNotice: string;
  controlReason: string;
}

// 归属判定：两侧去除首尾空白后严格相等；非字符串、空白或不等都不是本人。
// 不做 HTML 实体/全角归一化，宁可判定为非本人也不误动他人的曲目。
export function ownMediaOf(owner: unknown, myself: unknown): boolean {
  if (typeof owner !== "string" || typeof myself !== "string") return false;
  const mediaOwner = owner.trim();
  const self = myself.trim();
  return !!mediaOwner && !!self && mediaOwner === self;
}

// 房间标识与 instance 语义分离：instance 会在每次点播时自增，不能代表房间。
export function roomIdentifier(value: unknown): string | null {
  // 去首尾空白后返回：「room-a 」与「room-a」是同一房间，不能触发误熄灭。
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export interface MediaProgressPosition {
  x: number;
  y: number;
}

const globalMediaRanks = new Set(["1", "5", "3", "6", "7", "a"]);

export function mediaPermission(
  identity: unknown,
  rank: unknown,
): MediaPermission {
  const hasKnownRank = typeof rank === "string" && /^\S+$/.test(rank);
  const hasGlobalMediaRole =
    hasKnownRank && globalMediaRanks.has((rank as string).charAt(0));
  if (hasGlobalMediaRole) return "allowed";
  if (identity === 1 || identity === 2 || identity === 3) return "allowed";
  if (identity === 0 && hasKnownRank) return "denied";
  return "unknown";
}

export function mediaPermissionReason(permission: MediaPermission): string {
  if (permission === "allowed") return "";
  if (permission === "denied") return "当前房间无媒体管理权限";
  return "权限信息未就绪，暂时无法调整";
}

export function finiteTime(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const time = Number(value);
  return Number.isFinite(time) && time >= 0 ? time : null;
}

export function formatTime(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return "--:--";
  const seconds = Math.floor(value);
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function seekOffset(
  current: number,
  target: number,
  duration: number,
): number | null {
  if (
    ![current, target, duration].every(Number.isFinite) ||
    current < 0 ||
    duration <= 0
  )
    return null;
  const delta = Math.round(clamp(target, 0, duration) - current);
  return delta && Number.isSafeInteger(delta) ? delta : null;
}

export function seekCommand(
  current: number,
  target: number,
  duration: number,
): string | null {
  const delta = seekOffset(current, target, duration);
  if (delta === null) return null;
  const amount = Math.abs(delta);
  return `!15${JSON.stringify([
    delta > 0 ? ">" : "<",
    amount % 60 === 0 ? `${amount / 60}m` : `${amount}s`,
  ])}`;
}

/** 相对快退到开头：秒数必须是正整数，与 `isSeekCommand` 的白名单一致。 */
export function rewindCommand(seconds: number): string | null {
  if (!Number.isSafeInteger(seconds) || seconds < 1) return null;
  return `!15["<","${seconds}s"]`;
}

export function isSeekCommand(command: string): boolean {
  // 仅接受已确认的独立控制协议，不接受聊天文本或其他宿站指令。
  if (typeof command !== "string") return false;
  const match = /^!15\["[<>]","([1-9]\d*)[sm]"\]$/.exec(command);
  return (
    !!match && match[0] === command && Number.isSafeInteger(Number(match[1]))
  );
}

export function absoluteSeekTarget(
  target: number,
  duration: number,
): number | null {
  if (!Number.isFinite(target) || !Number.isFinite(duration) || duration <= 0)
    return null;
  const position = Math.min(
    Math.round(clamp(target, 0, duration)),
    Math.floor(duration),
  );
  return Number.isSafeInteger(position) ? position : null;
}

export function absoluteSeekCommand(
  target: number,
  duration: number,
): string | null {
  const position = absoluteSeekTarget(target, duration);
  if (position === null) return null;
  return `!16${JSON.stringify([`${position}s`])}`;
}

export function isAbsoluteSeekCommand(command: string): boolean {
  if (typeof command !== "string") return false;
  const match = /^!16\["(0|[1-9]\d*)s"\]$/.exec(command);
  return (
    !!match && match[0] === command && Number.isSafeInteger(Number(match[1]))
  );
}

export function unavailableReason(media: MediaSnapshot): string {
  if (media.controlReason) return media.controlReason;
  if (media.controlMode === "unavailable") return media.permissionReason;
  if (!media.connected) return "连接已断开，暂时无法调整";
  if (!media.playing) return "暂无播放内容";
  if (media.current === null || media.duration === null || media.duration <= 0)
    return "直播或时间未知，无法调整进度";
  return "";
}

export function coverUrl(value: string): string {
  try {
    const url = new URL(value.replace(/^http:\/\//i, "https://"));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function constrainPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  viewportOffsetX = 0,
  viewportOffsetY = 0,
) {
  return {
    x: clamp(
      x,
      viewportOffsetX + 12,
      Math.max(
        viewportOffsetX + 12,
        viewportOffsetX + viewportWidth - width - 12,
      ),
    ),
    y: clamp(
      y,
      viewportOffsetY + 12,
      Math.max(
        viewportOffsetY + 12,
        viewportOffsetY + viewportHeight - height - 12,
      ),
    ),
  };
}
