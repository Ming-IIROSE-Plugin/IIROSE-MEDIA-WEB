// src/sync/SyncEnableFlow.ts
// 首次启用的两段式流程：纯读预览 → 用户确认后写入。
// 「预览不落地、确认才上传」的边界全在这里；任何一次提前写入都会让取消变成假动作。
import { SyncClient, describeSyncError } from "./SyncClient";
import { SyncCrypto } from "./SyncCrypto";
import {
  normalizePassphrase,
  rememberUnlocked,
  resolveContext,
} from "./SyncContext";
import { formatMergeStats } from "./SyncGate";
import { getSyncSettings, updateSyncSettings } from "./SyncSettingsStore";
import {
  beginRun,
  cancelDebounce,
  endRun,
  getUid,
  rt,
  setBusy,
} from "./SyncRuntime";
import {
  flushPendingUpload,
  performSync,
  scheduleUpload,
} from "./SyncTransport";
import type {
  PrefetchedRemote,
  SyncPreviewResult,
  SyncResult,
} from "./SyncTypes";

/**
 * 首次启用第 1 段：**纯读**预览。
 *
 * 只做 GET → 解密 → 并集合并，算出「云端 / 本地 / 合并后」三个数字就停手：
 * 不 PUT、不翻转 `enabled`、不写 salt、不写本机密钥缓存。
 * 已解密的上下文与云端快照暂存在内存里，`commitEnable()` 直接复用（确认后不再二次 GET）。
 * 云端为空时没有可确认的合并，调用方可以直接 `commitEnable()`（`cloudEmpty` 为真）。
 */
export async function previewEnable(
  passphrase: string,
): Promise<SyncPreviewResult> {
  const phrase = normalizePassphrase(passphrase);
  const rawPhrase = typeof passphrase === "string" ? passphrase : "";
  const uid = getUid();
  if (!uid) {
    return { ok: false, message: "未登录蔷薇账号，无法启用云端同步" };
  }
  if (!phrase) {
    return { ok: false, message: "同步口令不能为空" };
  }
  if (!SyncCrypto.isAvailable()) {
    return {
      ok: false,
      message: "当前环境不支持 WebCrypto，无法启用云端同步",
    };
  }
  if (rt.busy) return { ok: false, message: "同步正在进行，请稍候" };

  const settings = getSyncSettings();
  // 预览是纯读：缺 deviceId 时只在本轮内生成候选值，**不落盘**（确认时才随 enabled/salt 一起写）
  const deviceId = settings.deviceId || SyncCrypto.generateDeviceId();
  // 重新预览先丢掉上一次的暂存，避免确认时用上过期的云端快照
  rt.pendingEnable = null;
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

    const prefetched: PrefetchedRemote =
      envelope && resolved.snapshot
        ? {
            kind: "snapshot",
            envelope,
            rev: remote.notModified ? null : remote.rev,
            snapshot: resolved.snapshot,
          }
        : { kind: "empty" };

    // dryRun：算完三个数字就返回，不加密、不上传（见 performSync 的提前返回点）
    const preview = await performSync(resolved.ctx, prefetched, {
      dryRun: true,
    });
    if (!preview.ok || !preview.stats) {
      return { ok: false, message: preview.message };
    }

    rt.pendingEnable = {
      ctx: resolved.ctx,
      prefetched,
      stats: preview.stats,
    };
    return {
      ok: true,
      // 预览阶段什么都没写，提示语只描述「将会发生什么」，不要复用上传成功的文案
      message:
        prefetched.kind === "empty"
          ? `云端暂无收藏，确认后将上传本地 ${preview.stats.merged} 条`
          : `合并预览：${formatMergeStats(preview.stats)}`,
      stats: preview.stats,
      cloudEmpty: prefetched.kind === "empty",
    };
  } catch (error) {
    return { ok: false, message: describeSyncError(error) };
  } finally {
    endRun(controller);
    setBusy(false);
    flushPendingUpload();
  }
}

/**
 * 首次启用第 2 段：用户确认后真正写入。
 *
 * 复用预览阶段已解密的上下文与云端快照，**不再二次 GET**；上传成功后才置 `enabled`、
 * 写 salt 与密钥缓存。上传失败则作废预览（保持未启用），重试会重新走一次预览。
 */
export async function commitEnable(): Promise<SyncResult> {
  const pending = rt.pendingEnable;
  if (!pending) {
    return { ok: false, message: "没有待确认的合并结果，请重新启用云端同步" };
  }
  const uid = getUid();
  if (!uid) {
    rt.pendingEnable = null;
    return { ok: false, message: "未登录蔷薇账号，无法启用云端同步" };
  }
  if (rt.busy) return { ok: false, message: "同步正在进行，请稍候" };
  if (uid !== pending.ctx.uid) {
    rt.pendingEnable = null;
    return { ok: false, message: "账号已切换，请重新启用云端同步" };
  }

  const generation = rt.generation;
  setBusy(true);
  const controller = beginRun();
  try {
    const result = await performSync(pending.ctx, pending.prefetched);
    if (!result.ok) {
      // 上传失败：本地与云端都没落地新状态，作废预览即可（重试重新预览）
      rt.pendingEnable = null;
      return result;
    }

    rt.pendingEnable = null;
    rt.unlocked = pending.ctx;
    // 本机写不进（配额 / 隐私模式）：云端密文已上传，但本机没有 salt 与 deviceId，
    // 刷新后就再也解不开自己刚传上去的数据 —— 必须如实报失败。
    if (
      !updateSyncSettings({
        enabled: true,
        salt: pending.ctx.salt,
        deviceId: pending.ctx.deviceId,
      })
    ) {
      return {
        ok: false,
        message: "本机存储不可用，启用未保存，请检查浏览器存储后重试",
      };
    }
    // 本机密钥缓存只是「免重复输口令」的便利，写失败不影响本次会话与已落地的云端结果，
    // 不能让它把一次成功的启用报成失败。
    try {
      await rememberUnlocked(pending.ctx);
    } catch (cacheError) {
      console.warn(
        "[SyncManager] 本机密钥缓存写入失败，本次会话仍可继续使用",
        cacheError,
      );
    }

    // 上传窗口内又有收藏增删：performSync 只在 enabled 后才会自己补传，这里补排一次防抖
    if (rt.generation !== generation) scheduleUpload();
    return result;
  } catch (error) {
    rt.pendingEnable = null;
    return { ok: false, message: describeSyncError(error) };
  } finally {
    endRun(controller);
    setBusy(false);
    flushPendingUpload();
  }
}

/**
 * 取消首次启用：丢掉预览暂存，本地与云端都不发生任何变化，同步保持未启用。
 * 预览期间新增/删除的收藏仍留在本地（预览是纯读的）。
 */
export function cancelEnable(): SyncResult {
  rt.pendingEnable = null;
  cancelDebounce();
  rt.pendingAfterBusy = false;
  return { ok: true, message: "已取消合并，本地与云端均未改动" };
}
