// SettingsService.ts

import { GetBiliBiliAccount } from "../../Account/BiliBili/GetBiliBili";
import { ShowMessage } from "../../iirose_func/ShowMessage";
import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";
import { BiliBiliSettings } from "../../settings/bilibiliSettings/BiliBiliSettings";
import { NetEaseSettings } from "../../settings/neteaseSettings/NetEaseSettings";
import { PluginSettings } from "../../settings/pluginSettings/PluginSettings";
import { RadioSettings } from "../../settings/radioSettings/RadioSettings";
import { SyncManager } from "../../sync/SyncManager";
import { chooseEnableStep, formatMergeStats } from "../../sync/SyncGate";
import type { MergeStats } from "../../sync/SyncMerge";

export class SettingsService {
  /**
   * B站账号设置
   */
  static showBilibiliAccount(ctx: MainAppContainerActionContext) {
    const getBilibiliAcc = new GetBiliBiliAccount();
    const accData = getBilibiliAcc.getBiliBiliAccount();
    const settings = new BiliBiliSettings();

    const data: SettingData[] = [
      {
        key: "bilibiliAccount",
        title: "账号",
        actionTitle: accData?.uname || "未登录",
        icon: "mdi-account-child-circle",
        action: settings.setAccount.bind(settings),
      },
    ];

    this.setState(ctx, data);
  }

  /**
   * B站视频/直播画质设置
   */
  static showBilibiliVideo(ctx: MainAppContainerActionContext) {
    const settings = new BiliBiliSettings();
    const s = settings.getBilibiliVideoSettings();

    const data: SettingData[] = [
      {
        key: "bilibiliVideoQn",
        title: "点播的视频画质",
        actionTitle: settings.parseBilibiliVideoQn(s.qn),
        icon: "mdi-video",
        action: settings.setBilibiliVideoQuality.bind(settings),
      },
      {
        key: "bilibiliLiveQn",
        title: "点播的直播画质",
        actionTitle: settings.parseBilibiliLiveQn(s.streamqn),
        icon: "mdi-video-wireless",
        action: settings.setBilibiliLiveQuality.bind(settings),
      },
      {
        key: "bilibiliStreamSeconds",
        title: "点播的直播播放时长",
        actionTitle: `${s.streamSeconds / 60} 分钟`,
        icon: "mdi-clock-outline",
        action: settings.setBilibiliStreamSeconds.bind(settings),
      },
      {
        key: "bilibiliVideoStreamFormat",
        title: "点播视频的获取格式",
        actionTitle: settings.parseGetVideoFormat(s.videoStreamFormat),
        icon: "mdi-hammer-wrench",
        action: settings.setGetVideoFormat.bind(settings),
      },
      {
        key: "bilibiliDefaultApi",
        title: "默认API",
        actionTitle: settings.parseBilibiliApi(s.api),
        icon: "mdi-code-braces",
        action: settings.setBilibiliDefaultApi.bind(settings),
      },
    ];

    this.setState(ctx, data);
  }

  /**
   * 网易云音乐设置
   */
  static showNetEaseMusic(ctx: MainAppContainerActionContext) {
    const s = NetEaseSettings.getNeteaseMusicSetting();

    const data: SettingData[] = [
      {
        key: "neteaseLyric",
        title: "歌词",
        actionTitle: NetEaseSettings.parseNetEaseMusicLyricOption(
          s.lyricOption,
        ),
        icon: "mdi-card-bulleted",
        action: NetEaseSettings.setNeteaseMusicLyric.bind(NetEaseSettings),
      },
      {
        key: "neteaseDefaultApi",
        title: "默认API",
        actionTitle: NetEaseSettings.parseNetEaseMusicApi(s.api),
        icon: "mdi-code-braces",
        action: NetEaseSettings.setNeteaseDefaultApi.bind(NetEaseSettings),
      },
      {
        key: "neteaseQuality",
        title: "音乐的音质 - 已废弃",
        actionTitle: NetEaseSettings.parseNetEaseMusicQuality(s.quality),
        icon: "mdi-music",
        action: NetEaseSettings.setNeteaseMusicQuality.bind(NetEaseSettings),
      },
    ];

    this.setState(ctx, data);
  }

  static showRadio(ctx: MainAppContainerActionContext) {
    const s = RadioSettings.getRadioSettings();

    const data: SettingData[] = [
      {
        key: "radioDuration",
        title: "默认播放时长",
        actionTitle: `${s.duration / 60} 分钟`,
        icon: "mdi-clock-outline",
        action: RadioSettings.setRadioStreamSeconds.bind(RadioSettings),
      },
    ];

    this.setState(ctx, data);
  }

  /**
   * 插件全局设置
   */
  static showPluginSettings(
    ctx: MainAppContainerActionContext,
    changeSearchKeyword: (keyword: string | null) => void,
    ShowOrHideIMC: () => Promise<void>,
  ) {
    const ps = PluginSettings.getPluginSetting();
    const isProxyAtInputInText = ps.chatBox.isProxyAtInput
      ? "mdi-toggle-switch"
      : "mdi-toggle-switch-off-outline";

    const data: SettingData[] = [
      {
        key: "defaultPage",
        title: "插件启动默认页面",
        actionTitle: PluginSettings.parseDefaultPage(ps.defaultPage),
        icon: "mdi-page-layout-header-footer",
        action: (doSomethings) => PluginSettings.setDefaultPage(doSomethings),
      },
      {
        key: "searchViewMode",
        title: "搜索结果视图",
        actionTitle: PluginSettings.parseSearchViewMode(ps.searchViewMode),
        icon: ps.searchViewMode === "list" ? "listViewIcon" : "cardViewIcon",
        action: (doSomethings) => {
          const newMode = PluginSettings.toggleSearchViewMode();
          doSomethings?.(PluginSettings.parseSearchViewMode(newMode));
          // ctx.setState 触发父级重渲染时，SettingCard 会用 props.actionTitle
          // 覆盖内部标题，因此需同步更新 settingsData 里的 actionTitle 与 icon
          ctx.setState({
            searchViewMode: newMode,
            settingsData: data.map((item) =>
              item.key === "searchViewMode"
                ? {
                    ...item,
                    actionTitle: PluginSettings.parseSearchViewMode(newMode),
                    icon: newMode === "list" ? "listViewIcon" : "cardViewIcon",
                  }
                : item,
            ),
          });
        },
      },
      {
        key: "announceMode",
        title: "点播播报",
        actionTitle: PluginSettings.parseAnnounceMode(ps.announceMode),
        icon:
          ps.announceMode === "silent"
            ? "announceSilentIcon"
            : ps.announceMode === "summary"
              ? "announceSummaryIcon"
              : "announceCardIcon",
        action: (doSomethings) => {
          PluginSettings.setAnnounceMode((actionTitle) => {
            doSomethings?.(actionTitle);
            // 同「搜索结果视图」：ctx.setState 触发父级重渲染时，SettingCard 会用
            // props.actionTitle/icon 覆盖内部状态，因此需同步更新 settingsData
            const mode = PluginSettings.getPluginSetting().announceMode;
            ctx.setState({
              settingsData: data.map((item) =>
                item.key === "announceMode"
                  ? {
                      ...item,
                      actionTitle: actionTitle ?? item.actionTitle,
                      icon:
                        mode === "silent"
                          ? "announceSilentIcon"
                          : mode === "summary"
                            ? "announceSummaryIcon"
                            : "announceCardIcon",
                    }
                  : item,
              ),
            });
          });
        },
      },
      {
        key: "proxyAtInput",
        title: "代理蔷薇@输入",
        actionTitle: isProxyAtInputInText,
        icon: "mdi-at",
        action: (doSomethings) => {
          PluginSettings.isProxyAtInputSetting(
            doSomethings!,
            changeSearchKeyword,
            ShowOrHideIMC,
          );
        },
      },
    ];

    this.setState(ctx, data);
  }

  /**
   * 收藏云同步设置面板（唯一入口，全部改动都发生在这里）
   */
  static async showSyncSettings(ctx: MainAppContainerActionContext) {
    // 直接 setState 会先清订阅；这里反过来：先渲染，再（重）订阅
    ctx.setState({ settingsData: await this.buildSyncSettings(ctx) });
    this.syncStatusUnsub?.();
    this.syncStatusUnsub = SyncManager.onStateChange(() => {
      void this.showSyncSettings(ctx);
    });
  }

  private static async buildSyncSettings(
    ctx: MainAppContainerActionContext,
  ): Promise<SettingData[]> {
    const refresh = () => void this.showSyncSettings(ctx);

    const uid = SyncManager.getUid();
    const state = SyncManager.getState();
    const enabled = state.enabled;
    const unlocked = state.unlocked;
    // 「忘记本机密钥」按缓存是否存在判定：关闭同步后缓存仍在，也必须能清除
    const hasLocalKey = await SyncManager.hasLocalKey();

    const promptPassphrase = (
      title: string,
      onConfirm: (passphrase: string) => void,
    ) => {
      IIROSEUtils.sync(2, [title, "", 64], (value) => {
        const passphrase = typeof value === "string" ? value.trim() : "";
        if (!passphrase) return;
        onConfirm(passphrase);
      });
    };

    return [
      {
        key: "syncEnabled",
        title: "云端同步",
        actionTitle: !uid ? "未登录账号" : enabled ? "已启用" : "未启用",
        icon: "syncCloudIcon",
        action: () => {
          if (!SyncManager.getUid()) {
            ShowMessage.show("未登录蔷薇账号，无法启用云端同步");
            return;
          }
          if (SyncManager.getState().enabled) {
            ShowMessage.show(SyncManager.disable().message);
            refresh();
            return;
          }
          promptPassphrase(
            "设置同步口令（忘记口令将无法找回云端收藏，建议至少 8 位）",
            (passphrase) => {
              void this.previewThenEnable(ctx, passphrase);
            },
          );
        },
      },
      ...(enabled
        ? [
            {
              key: "syncStatus",
              title: "同步状态",
              actionTitle:
                state.status.phase === "syncing"
                  ? "同步中…"
                  : state.status.phase === "error"
                    ? "待重试"
                    : "正常",
              icon: "syncRefreshIcon",
              action: () => {
                const current = SyncManager.getStatus();
                if (current.message) {
                  ShowMessage.show(current.message);
                  return;
                }
                refresh();
              },
            } satisfies SettingData,
          ]
        : []),
      {
        key: "syncPassphrase",
        title: "同步口令（忘记不可找回）",
        actionTitle: !enabled ? "未启用" : unlocked ? "已解锁" : "未解锁",
        icon: "syncKeyIcon",
        action: () => {
          if (!SyncManager.getState().enabled) {
            ShowMessage.show("请先启用云端同步");
            return;
          }
          promptPassphrase(
            "输入同步口令解锁（本机已缓存密钥时无需输入；换设备或清除本机密钥后才需要）",
            (passphrase) => {
              void SyncManager.unlock(passphrase).then((res) => {
                ShowMessage.show(res.message);
                refresh();
              });
            },
          );
        },
      },
      {
        key: "syncLastSyncAt",
        title: "上次同步时间",
        actionTitle: SyncManager.formatLastSyncAt(state.lastSyncAt),
        icon: "syncClockIcon",
        action: () => refresh(),
      },
      {
        key: "syncNow",
        title: "立即同步",
        actionTitle: !enabled ? "未启用" : unlocked ? "立即同步" : "需先解锁",
        icon: "syncRefreshIcon",
        action: () => {
          const current = SyncManager.getState();
          if (!current.enabled) {
            ShowMessage.show("请先启用云端同步");
            return;
          }
          if (!current.unlocked) {
            ShowMessage.show("请先输入同步口令解锁");
            return;
          }
          void SyncManager.syncNow().then((res) => {
            ShowMessage.show(res.message);
            refresh();
          });
        },
      },
      {
        key: "syncClearCloud",
        title: "清空云端",
        actionTitle: "清空云端",
        icon: "syncDeleteIcon",
        action: () => {
          const content =
            "确认清空云端收藏？\n\n" +
            "云端保存的收藏密文将被清空（服务端保留历史版本以供回滚），本地收藏不受影响。\n" +
            "注意：只要本地仍保留收藏且同步处于启用状态，之后的收藏增删仍会上传并重建云端副本。";
          IIROSEUtils.sync(0, [content], () => {
            void SyncManager.clearCloud().then((res) => {
              ShowMessage.show(res.message);
              refresh();
            });
          });
        },
      },
      {
        key: "syncForgetKey",
        title: "忘记本机密钥",
        actionTitle: hasLocalKey ? "清除本机密钥" : "无本机密钥",
        icon: "syncKeyIcon",
        action: () => {
          if (!hasLocalKey) {
            ShowMessage.show("本机没有可清除的密钥缓存");
            return;
          }
          const content =
            "确认清除本机密钥？\n\n" +
            "清除后本机不再缓存解密的密钥句柄，下次进入插件需要重新输入同步口令。\n" +
            "云端收藏密文与本地收藏都不受影响；没有口令就再也解不开云端副本。";
          IIROSEUtils.sync(0, [content], () => {
            void SyncManager.forgetLocalKey().then((res) => {
              ShowMessage.show(res.message);
              refresh();
            });
          });
        },
      },
    ];
  }

  /**
   * 首次启用第 1 段：先纯读预览，云端有数据时弹「合并并上传 / 取消」确认框。
   * 确认前不会写云端（`previewEnable` 不翻转 enabled、不写密钥缓存）。
   */
  private static async previewThenEnable(
    ctx: MainAppContainerActionContext,
    passphrase: string,
  ): Promise<void> {
    const preview = await SyncManager.previewEnable(passphrase);
    const step = chooseEnableStep(preview);
    if (step === "abort") {
      ShowMessage.show(preview.message);
      await this.showSyncSettings(ctx);
      return;
    }
    if (step === "commit") {
      // 云端为空：没有可确认的合并，直接上传
      const result = await SyncManager.commitEnable();
      ShowMessage.show(result.message);
      await this.showSyncSettings(ctx);
      return;
    }
    // 仅为类型收窄：chooseEnableStep 已经排除失败，走到这里必定是成功预览
    if (!preview.ok) return;
    // 口令输入框刚关闭，宿站随后还要 fadeOut + empty() 选择器容器：
    // 立刻开新弹窗会被它清掉，必须让出 300ms（见 AGENTS.md 的弹窗流转坑）
    window.setTimeout(() => {
      this.confirmMerge(
        preview.stats,
        () => {
          void SyncManager.commitEnable().then((result) => {
            ShowMessage.show(result.message);
            void this.showSyncSettings(ctx);
          });
        },
        () => {
          ShowMessage.show(SyncManager.cancelEnable().message);
          void this.showSyncSettings(ctx);
        },
      );
    }, 300);
  }

  /**
   * 「合并并上传 / 取消」两选项确认框：范式同 NetEasePlatform.buildOrderConfirmSelect。
   * 点空白/关闭一律按取消处理，避免预览结果悬空。
   */
  private static confirmMerge(
    stats: MergeStats,
    onMerge: () => void,
    onCancel: () => void,
  ): void {
    let answered = false;
    const choose = (merge: boolean) => {
      if (answered) return;
      answered = true;
      if (merge) onMerge();
      else onCancel();
    };

    const iconStyle =
      "font-family:md;font-size:28px;text-align:center;line-height:100px;height:100px;width:100px;position:absolute;top:0;opacity:.7;left:0;";
    const options: (string | number)[][] = [
      [
        0,
        "合并并上传",
        `<div class="mdi-cloud-upload" style="${iconStyle}"></div>`,
      ],
      [1, "取消", `<div class="mdi-close" style="${iconStyle}"></div>`],
    ];
    const topHtml =
      `<div style="padding:14px 18px 6px;line-height:1.7;font-size:15px;">` +
      `<div style="font-weight:600;">首次启用需要合并云端与本地收藏</div>` +
      `<div>${formatMergeStats(stats)}</div>` +
      `<div style="opacity:.7;font-size:13px;margin-top:4px;">确认后才会把合并结果上传到云端；取消则本地与云端都不改动。</div>` +
      `</div>`;

    IIROSEUtils.buildSelect2(
      null,
      options,
      (_t: HTMLElement, value: string) => choose(Number(value) === 0),
      false,
      true,
      topHtml,
      false,
      null,
      () => choose(false),
    );
  }

  /** 同步状态订阅：离开同步面板时必须释放，避免别处导航后仍被状态变化重绘 */
  private static syncStatusUnsub: (() => void) | null = null;

  static setState = (
    ctx: MainAppContainerActionContext,
    settingsData: SettingData[],
  ) => {
    this.syncStatusUnsub?.();
    this.syncStatusUnsub = null;
    ctx.setState({ settingsData });
  };
}
