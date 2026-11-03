// src/sync/SyncLifecycle.ts
// 同步的生命周期：注册触发、解锁、启用开关、清空云端与状态查询。
// 这一层只改「会话态」，真正的读写交给 SyncTransport。
import { FavoritesStorageService } from "../storage/FavoritesStorageService";
import { SyncKeyCache } from "./SyncKeyCache";
import { SyncClient, describeSyncError } from "./SyncClient";
import {
  SYNC_MESSAGE_WRONG_PASSPHRASE,
  normalizePassphrase,
  rememberUnlocked,
  resolveContext,
} from "./SyncContext";
import { shouldAutoPull } from "./SyncGate";
import {
  ensureDeviceId,
  getSyncSettings,
  restoreRemoteRev,
  setRemoteRev,
  updateSyncSettings,
} from "./SyncSettingsStore";
import {
  activeContext,
  beginRun,
  cancelDebounce,
  endRun,
  getSyncStatus,
  getUid,
  rt,
  setBusy,
} from "./SyncRuntime";
import {
  flushPendingUpload,
  performSync,
  pullOnly,
  scheduleUpload,
} from "./SyncTransport";
import type { SyncResult, SyncStateView } from "./SyncTypes";

/** 插件 UI 打开期间的兜底拉取间隔：聊天站里页面常驻可见，光靠可见性事件不会触发 */
const UI_PULL_INTERVAL_MS = 5 * 60_000;

export function getState(): SyncStateView {
  const settings = getSyncSettings();
  return {
    uid: getUid(),
    enabled: settings.enabled,
    unlocked: settings.enabled && !!activeContext(),
    busy: rt.busy,
    lastSyncAt: settings.lastSyncAt,
    serverUrl: settings.serverUrl,
    status: getSyncStatus(),
  };
}

export function formatLastSyncAt(lastSyncAt: number | null): string {
  if (!lastSyncAt) return "从未同步";
  const date = new Date(lastSyncAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 注册收藏变更监听，并尝试用本机缓存里的 DEK 句柄自动解锁 + 拉取
 * （「刷新后再进来不用重新输口令」与「插件激活时自动拉取」都靠这一步）。
 * 收藏的增删只在存储层发生，同步层通过回调感知，存储层不需要认识同步模块。
 */
export async function init(): Promise<void> {
  if (!rt.listenerRegistered) {
    rt.listenerRegistered = true;
    FavoritesStorageService.onChange(() => {
      rt.generation += 1;
      if (!getSyncSettings().enabled || !activeContext()) return;
      scheduleUpload();
    });
  }
  registerActivateTriggers();
  await autoUnlockFromCache();
}

/**
 * 注册「用户回到页面」类触发：切回标签页、窗口获得焦点。
 * 聊天站里页面常驻可见，光靠这些事件不够，因此插件 UI 打开期间另有兜底定时器
 * （见 onUiOpened），两条路都只发一次 GET，命中 304 时出网约 200 字节。
 */
function registerActivateTriggers(): void {
  if (rt.activateTriggersRegistered) return;
  if (typeof document === "undefined" || typeof window === "undefined") return;
  rt.activateTriggersRegistered = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") maybeAutoPull();
  });
  window.addEventListener("focus", () => maybeAutoPull());
}

/** 事件触发的静默拉取：只拉不写，失败不打扰用户 */
function maybeAutoPull(): void {
  const allowed = shouldAutoPull({
    enabled: getSyncSettings().enabled,
    hasContext: !!activeContext(),
    busy: rt.busy,
    lastPullAt: rt.lastPullAt,
    now: Date.now(),
  });
  if (!allowed) return;
  // 先占位再发请求，避免同一批事件（focus + visibilitychange）连发两次
  rt.lastPullAt = Date.now();
  void pullOnly();
}

/** 插件 UI 打开：立刻尝试拉一次，并启动 UI 期间的兜底定时器 */
export function onUiOpened(): void {
  if (rt.uiPullTimer === null && typeof window !== "undefined") {
    rt.uiPullTimer = window.setInterval(maybeAutoPull, UI_PULL_INTERVAL_MS);
  }
  maybeAutoPull();
}

/** 插件 UI 关闭：停掉兜底定时器，避免后台空转 */
export function onUiClosed(): void {
  if (rt.uiPullTimer !== null) {
    clearInterval(rt.uiPullTimer);
    rt.uiPullTimer = null;
  }
}

/**
 * 已启用状态下用口令解锁。若有本机缓存句柄，通常无需走到这里。
 */
export async function unlock(passphrase: string): Promise<SyncResult> {
  const phrase = normalizePassphrase(passphrase);
  const rawPhrase = typeof passphrase === "string" ? passphrase : "";
  const uid = getUid();
  if (!uid) {
    return { ok: false, message: "未登录蔷薇账号，无法使用云端同步" };
  }
  if (!phrase) {
    return { ok: false, message: "同步口令不能为空" };
  }
  const settings = getSyncSettings();
  if (!settings.enabled) {
    return { ok: false, message: "请先启用云端同步" };
  }
  if (rt.busy) return { ok: false, message: "同步正在进行，请稍候" };

  const deviceId = ensureDeviceId();
  setBusy(true);
  const controller = beginRun();
  try {
    const client = new SyncClient(settings.serverUrl, uid);
    const remote = await client.get(null, controller.signal);
    const envelope = remote.notModified ? null : remote.envelope;
    const resolved = await resolveContext(
      uid,
      settings,
      deviceId,
      client,
      phrase,
      rawPhrase,
      envelope,
    );
    if (!resolved.ok) return resolved;

    rt.unlocked = resolved.ctx;
    restoreRemoteRev();
    if (settings.salt !== resolved.ctx.salt) {
      updateSyncSettings({ salt: resolved.ctx.salt });
    }
    await rememberUnlocked(resolved.ctx);

    return await performSync(
      resolved.ctx,
      envelope && resolved.snapshot
        ? {
            kind: "snapshot",
            envelope,
            rev: remote.notModified ? null : remote.rev,
            snapshot: resolved.snapshot,
          }
        : { kind: "empty" },
    );
  } catch (error) {
    return { ok: false, message: describeSyncError(error) };
  } finally {
    endRun(controller);
    setBusy(false);
    flushPendingUpload();
  }
}

/**
 * 本机是否为该 uid 缓存了 DEK 句柄（与「是否解锁」无关：关闭同步后缓存仍然在，
 * 设置面板要能据此清除它）。
 */
export async function hasLocalKey(): Promise<boolean> {
  const uid = getUid();
  if (!uid) return false;
  return !!(await SyncKeyCache.get(uid));
}

/** 关闭同步：停止一切请求（含在途请求），本地数据保留不动 */
export function disable(): SyncResult {
  cancelDebounce();
  rt.pendingAfterBusy = false;
  rt.pendingEnable = null; // 未确认的预览在这里一并作废，绝不会因为关闭而落地
  rt.runController?.abort();
  rt.runController = null;
  rt.unlocked = null;
  setRemoteRev(null);
  rt.lastPullAt = 0; // 重新启用后可以立刻拉一次
  // 写不进就别报「已关闭」：刷新后同步会复活，用户以为关掉了却在后台上传。
  if (!updateSyncSettings({ enabled: false }))
    return {
      ok: false,
      message: "本机存储不可用，关闭状态未保存，请检查浏览器存储后重试",
    };
  return { ok: true, message: "已关闭云端同步，本地收藏保持不变" };
}

/**
 * 忘记本机密钥：删除本机缓存的 DEK 句柄，回到需要输口令的状态。
 * 云端密文与本地收藏都不受影响；没有口令就再也解不开云端副本。
 */
export async function forgetLocalKey(): Promise<SyncResult> {
  const uid = getUid();
  cancelDebounce();
  rt.pendingAfterBusy = false;
  rt.pendingEnable = null;
  rt.unlocked = null;
  setRemoteRev(null);
  if (uid) await SyncKeyCache.forget(uid);
  return {
    ok: true,
    message: "已清除本机密钥缓存，下次进入需重新输入同步口令",
  };
}

/**
 * 清空云端副本：DELETE 后本地数据不变。
 * 只需要 uid，**不需要**口令——否则「关掉同步又忘了口令」就成了死路。
 */
export async function clearCloud(): Promise<SyncResult> {
  const uid = getUid();
  if (!uid) {
    return { ok: false, message: "未登录蔷薇账号，无法使用云端同步" };
  }
  if (rt.busy) return { ok: false, message: "同步正在进行，请稍候" };

  // 取消待发的防抖上传，并丢掉排队中的补传标记，
  // 否则 finally 的 flush 会在清空后 5 秒把云端重新写回去
  cancelDebounce();
  rt.pendingAfterBusy = false;
  setBusy(true);
  const controller = beginRun();
  try {
    const client = new SyncClient(getSyncSettings().serverUrl, uid);
    await client.removeCloud(controller.signal);
    setRemoteRev(null);
    return { ok: true, message: "云端收藏已清空，本地收藏不受影响" };
  } catch (error) {
    return { ok: false, message: describeSyncError(error) };
  } finally {
    endRun(controller);
    setBusy(false);
    flushPendingUpload();
  }
}

/** 用本机缓存的 DEK 句柄自动解锁并发起一次「只拉不写」的同步 */
async function autoUnlockFromCache(): Promise<void> {
  const uid = getUid();
  const settings = getSyncSettings();
  if (!uid || !settings.enabled || activeContext() || rt.busy) return;

  const cached = await SyncKeyCache.get(uid);
  if (!cached) return;

  rt.unlocked = {
    uid,
    deviceId: ensureDeviceId(),
    salt: cached.salt,
    iterations: cached.iterations,
    wrapped: cached.wrapped,
    dek: cached.dek,
    client: new SyncClient(settings.serverUrl, uid),
  };
  restoreRemoteRev();

  const result = await pullOnly();
  if (!result.ok && result.message === SYNC_MESSAGE_WRONG_PASSPHRASE) {
    // 本机句柄与云端快照对不上（云端换了密钥等）：清掉缓存，回到需输口令的状态
    console.warn("[SyncManager] 本机密钥与云端快照不匹配，已清除本机密钥缓存");
    await forgetLocalKey();
  }
}
