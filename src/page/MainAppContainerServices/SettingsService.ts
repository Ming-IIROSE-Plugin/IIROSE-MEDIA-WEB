// SettingsService.ts
//
// 设置页的数据层：每个范围返回「组 → 行」两级结构（`SettingGroupData[]`），
// 一组一张组卡（DESIGN.md `settings-group`）。行语义（值 / 开关 / 动作 / 只读）
// 在这里随数据声明，渲染层不按 key 或中文文案猜。
// 既有设置项与动作原样保留：取值类仍走宿站选择 / 输入弹窗，动作类仍带既有确认步骤。
//
// 各范围的内容分别落在同目录的 settings*Section.ts，这里只负责范围切换、
// 订阅生命周期与（插件的）异步构建竞态保护。

import { SyncManager } from "../../sync/SyncManager";
import { buildBilibiliGroups } from "./settingsBilibiliSection";
import { buildNetEaseGroups } from "./settingsNeteaseSection";
import { buildPluginGroups } from "./settingsPluginSection";
import { buildRadioGroups } from "./settingsRadioSection";

export class SettingsService {
  /**
   * B站：账号 + 视频设置两张组卡（原「账号」「视频设置」两个范围合并）
   */
  static showBilibili(ctx: MainAppContainerActionContext) {
    this.setState(ctx, buildBilibiliGroups());
  }

  /**
   * 网易云音乐设置
   */
  static showNetEaseMusic(ctx: MainAppContainerActionContext) {
    this.setState(ctx, buildNetEaseGroups());
  }

  static showRadio(ctx: MainAppContainerActionContext) {
    this.setState(ctx, buildRadioGroups());
  }

  /**
   * 插件全局设置：聊天框 + 云端同步两张组卡。
   *
   * 云同步状态是本机实时状态（同步中 / 上次同步时间），因此这里接管
   * `SyncManager.onStateChange` 订阅并在任何变化时重跑自身重建数据；
   * 离开设置模式时由 `release` 释放，避免别处导航后仍被状态变化重绘。
   */
  static async showPluginSettings(
    ctx: MainAppContainerActionContext,
    changeSearchKeyword: (keyword: string | null) => void,
    ShowOrHideIMC: () => Promise<void>,
  ) {
    // 构建要 await 本机密钥缓存：期间用户可能切走范围或离开设置模式，
    // 迟到的结果不能覆盖当前范围、也不能在 release 之后重新订阅；
    // 同一范围内也可能有两次构建交错（同步状态连续变化），先发后到的一样作废。
    const revision = this.revision;
    const build = ++this.buildSeq;
    const stale = () => revision !== this.revision || build !== this.buildSeq;

    const refresh = () =>
      void this.showPluginSettings(ctx, changeSearchKeyword, ShowOrHideIMC);

    const groups = await buildPluginGroups(
      ctx,
      changeSearchKeyword,
      ShowOrHideIMC,
      refresh,
    );
    if (stale()) return;

    // 先渲染，再（重）订阅：反过来会先被 `ctx.setState` 前的清理摘掉
    ctx.setState({ settingsData: groups });
    this.syncStatusUnsub?.();
    this.syncStatusUnsub = SyncManager.onStateChange(refresh);
  }

  /** 同步状态订阅：离开设置模式时必须释放，避免别处导航后仍被状态变化重绘 */
  private static syncStatusUnsub: (() => void) | null = null;

  /**
   * 离开设置模式时释放同步状态订阅：否则后台状态变化会把设置卡写进别的模式的结果区。
   * 重新进入设置模式时由当前范围动作重新订阅。
   */
  static release() {
    this.revision += 1;
    this.syncStatusUnsub?.();
    this.syncStatusUnsub = null;
  }

  static setState = (
    ctx: MainAppContainerActionContext,
    settingsData: SettingGroupData[],
  ) => {
    // 换了范围 = 之前还在构建的设置数据作废（迟到的 setState 不得覆盖当前范围）
    this.revision += 1;
    this.syncStatusUnsub?.();
    this.syncStatusUnsub = null;
    ctx.setState({ settingsData });
  };

  /**
   * 设置数据的版本号：`setState` / `release` 自增。异步构建（`showPluginSettings`
   * 要读本机密钥缓存）在开始时捕获它，落地前发现变了就丢弃结果且不重订阅。
   */
  private static revision = 0;

  /**
   * 构建序号：每开始一次构建自增。`revision` 只区分「换了范围 / 离开了设置」，
   * 同一范围内两次构建交错完成时，先发的那次会盖掉后发的，所以落地前还要比对序号。
   */
  private static buildSeq = 0;
}
