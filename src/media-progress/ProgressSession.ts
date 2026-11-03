import { HostMediaBridge } from "./HostMediaBridge";
import {
  absoluteSeekCommand,
  absoluteSeekTarget,
  seekOffset,
  clamp,
  MediaControlMode,
  MediaSnapshot,
  seekCommand,
  unavailableReason,
} from "./model";

export interface ProgressState {
  media: MediaSnapshot;
  preview: number | null;
  waiting: boolean;
  message: string;
}

// 将手势与发送边界集中管理，避免 pointerup / blur / keyup 重复提交。
export class ProgressSession {
  state: ProgressState;
  private gesture: {
    instance: number;
    controlMode: MediaControlMode;
    kind: "slider" | "step";
    target: number;
  } | null = null;
  private pending: {
    instance: number;
    seekVersion: number;
    target: number;
    kind: "absolute" | "relative";
    sentAt: number;
    duration: number;
  } | null = null;
  private timeout?: ReturnType<typeof setTimeout>;
  private unsubscribe: () => void;
  private disposed = false;

  constructor(
    private bridge: HostMediaBridge,
    private changed: (state: ProgressState) => void,
    /** 是否把「有人看着进度」记为活跃场景：浮窗为 true，常驻的面板底条为 false。 */
    private readsProgress = true,
  ) {
    this.state = {
      media: bridge.read(),
      preview: null,
      waiting: false,
      message: "",
    };
    this.unsubscribe = bridge.subscribe((media) => this.receive(media));
    if (this.readsProgress) bridge.setActive("progress", true);
  }

  private publish() {
    if (!this.disposed) this.changed({ ...this.state });
  }

  private receive(media: MediaSnapshot) {
    const changedMedia = this.state.media.instance !== media.instance;
    const changedMode = this.state.media.controlMode !== media.controlMode;
    const lostOwnership =
      this.state.media.controlMode === "owner" &&
      media.controlMode === "unavailable";
    const previousUnavailable = unavailableReason(this.state.media);
    const reason = unavailableReason(media);
    this.state.media = media;
    if (changedMedia || changedMode || reason) {
      const hadOperation = !!(this.gesture || this.pending);
      this.clearOperation();
      if (hadOperation || reason)
        this.state.message = changedMedia
          ? "媒体已切换，已取消上次操作"
          : lostOwnership && hadOperation
            ? "当前媒体已非本人点播，已取消上次操作"
            : reason || "控制通道已切换，已取消上次操作";
      else if (changedMode) this.state.message = "";
    } else if (previousUnavailable && !reason) {
      this.state.message = "";
    } else if (
      this.pending &&
      media.instance === this.pending.instance &&
      media.seekVersion > this.pending.seekVersion &&
      media.current !== null &&
      this.confirmsPending(media.current)
    ) {
      // 只认定位回调后的真实时间；普通时钟推进不构成确认。
      this.clearOperation();
      this.state.message = "宿站进度已更新";
    } else if (this.pending) {
      // 不相关的定位事件只消费一次，后续自然推进到目标仍不能确认。
      this.pending.seekVersion = media.seekVersion;
    }
    this.publish();
  }

  private confirmsPending(current: number): boolean {
    const pending = this.pending!;
    const elapsed = (performance.now() - pending.sentAt) / 1000;
    if (elapsed < 0 || elapsed >= 5) return false;
    const advance = pending.kind === "relative" ? elapsed : 0;
    return (
      current >= Math.max(0, pending.target - 2) &&
      current <= Math.min(pending.duration, pending.target + advance + 2)
    );
  }

  begin(kind: "slider" | "step" = "slider"): boolean {
    const media = this.bridge.read();
    this.receive(media);
    if (this.disposed || this.pending || unavailableReason(media)) return false;
    this.gesture = {
      instance: media.instance,
      controlMode: media.controlMode,
      kind,
      target: media.current!,
    };
    this.state.preview = media.current;
    this.state.message = "预览中，释放或按 Enter 提交";
    this.publish();
    return true;
  }

  preview(target: number) {
    if (!this.gesture || !Number.isFinite(target)) return;
    const media = this.bridge.read();
    this.receive(media);
    if (!this.gesture || unavailableReason(media)) return;
    const normalized =
      this.gesture.controlMode === "silent" && this.gesture.kind === "slider"
        ? absoluteSeekTarget(target, media.duration!)
        : clamp(target, 0, media.duration!);
    if (normalized === null) return;
    this.gesture.target = normalized;
    this.state.preview = normalized;
    this.publish();
  }

  commit() {
    const gesture = this.gesture;
    if (!gesture || this.disposed) return;
    const media = this.bridge.read();
    this.receive(media);
    if (
      !this.gesture ||
      gesture.instance !== media.instance ||
      unavailableReason(media)
    )
      return;
    this.gesture = null;
    this.state.preview = null;
    const absolute =
      gesture.controlMode === "silent" && gesture.kind === "slider";
    const target = absolute
      ? absoluteSeekTarget(gesture.target, media.duration!)
      : clamp(gesture.target, 0, media.duration!);
    const command =
      target === null
        ? null
        : absolute
          ? absoluteSeekCommand(target, media.duration!)
          : seekCommand(media.current!, target, media.duration!);
    if (!command) {
      this.state.message = "已在目标位置";
      this.publish();
      return;
    }
    this.pending = {
      instance: media.instance,
      seekVersion: media.seekVersion,
      // 相对报文按整秒偏移编码，确认目标必须采用实际发送的偏移。
      target: absolute
        ? target!
        : clamp(
            media.current! +
              seekOffset(media.current!, target!, media.duration!)!,
            0,
            media.duration!,
          ),
      kind: absolute ? "absolute" : "relative",
      sentAt: performance.now(),
      duration: media.duration!,
    };
    this.state.waiting = true;
    this.state.message = "等待宿站更新…";
    // 先登记等待状态，允许宿站同步触发回调。
    this.timeout = setTimeout(() => {
      this.clearOperation();
      this.state.message = "未收到调整确认，请稍后重试";
      this.publish();
    }, 5000);
    if (!this.bridge.send(command, gesture.instance, gesture.controlMode)) {
      this.clearOperation();
      this.state.message = this.bridge.controlUnavailable
        ? this.bridge.controlUnavailableMessage
        : "发送失败，请检查连接、房间权限与当前媒体";
    }
    this.publish();
  }

  step(seconds: number) {
    if (!this.begin("step")) return;
    this.preview(this.state.media.current! + seconds);
    this.commit();
  }

  cancel() {
    if (!this.gesture) return;
    this.gesture = null;
    this.state.preview = null;
    this.state.message = "已取消预览";
    this.publish();
  }

  private clearOperation() {
    this.gesture = null;
    this.pending = null;
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.state.preview = null;
    this.state.waiting = false;
  }

  dispose() {
    this.disposed = true;
    this.clearOperation();
    this.unsubscribe();
    if (this.readsProgress) this.bridge.setActive("progress", false);
  }
}
