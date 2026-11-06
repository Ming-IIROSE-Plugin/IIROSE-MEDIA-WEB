import { ShowMessage } from "../../iirose_func/ShowMessage";
import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";
import {
  PluginSettings,
  type PanelDisplay,
} from "../../settings/pluginSettings/PluginSettings";
import { SyncManager } from "../../sync/SyncManager";
import { chooseEnableStep, formatMergeStats } from "../../sync/SyncGate";
import type { MergeStats } from "../../sync/SyncMerge";
import { isPanelWindowed } from "../../listener/panelPresence";
import { isPhoneLayout } from "../components/media-card-container/mediaFormat";

/** 开关左侧的状态文字：开了但视口放不下窗口时说明原因。 */
const panelDisplayStatus = (display: PanelDisplay) =>
  display === "window" && !isPanelWindowed() ? "页面太小，暂用全屏" : "";

/** 「窗口模式」行的形态取决于视口：变了要重建设置数据（见 `SettingsService`）。 */
export const panelDisplayRowForm = () =>
  isPhoneLayout() ? "phone" : isPanelWindowed() ? "window" : "full";

/** 「窗口模式」行：手机上始终全屏，是灰显的只读行。 */
const buildPanelDisplayRow = (display: PanelDisplay): SettingData =>
  isPhoneLayout()
    ? {
        key: "panelDisplay",
        title: "窗口模式",
        kind: "readonly",
        actionTitle: "手机上始终全屏",
        icon: "layout",
        muted: true,
      }
    : {
        key: "panelDisplay",
        title: "窗口模式",
        kind: "switch",
        checked: display === "window",
        actionTitle: panelDisplayStatus(display),
        icon: "layout",
        action: (report) => {
          const next = PluginSettings.togglePanelDisplay();
          report?.(panelDisplayStatus(next), next === "window");
        },
      };

/**
 * 插件全局设置：聊天框 + 云端同步两张组卡的数据（渲染层只做展示）。
 */
export const buildPluginGroups = async (
  ctx: MainAppContainerActionContext,
  changeSearchKeyword: (keyword: string | null) => void,
  ShowOrHideIMC: () => Promise<void>,
  refresh: () => void,
): Promise<SettingGroupData[]> => {
  const ps = PluginSettings.getPluginSetting();

  return [
    {
      title: "聊天框",
      items: [
        {
          key: "defaultPage",
          title: "插件启动默认页面",
          kind: "value",
          actionTitle: PluginSettings.parseDefaultPage(ps.defaultPage),
          icon: "layout",
          action: (report) =>
            PluginSettings.setDefaultPage((actionTitle) =>
              report?.(actionTitle),
            ),
        },
        {
          key: "searchViewMode",
          title: "搜索结果视图",
          kind: "value",
          actionTitle: PluginSettings.parseSearchViewMode(ps.searchViewMode),
          icon: "list",
          action: (report) => {
            const newMode = PluginSettings.toggleSearchViewMode();
            report?.(PluginSettings.parseSearchViewMode(newMode));
            // 父级也持有视图偏好（结果区渲染用），一并同步
            ctx.setState({ searchViewMode: newMode });
          },
        },
        {
          key: "favoritesPageSize",
          title: "收藏每页显示",
          kind: "value",
          actionTitle: PluginSettings.parseFavoritesPageSize(
            ps.favoritesPageSize,
          ),
          icon: "star",
          action: (report) =>
            PluginSettings.setFavoritesPageSize((actionTitle) =>
              report?.(actionTitle),
            ),
        },
        {
          key: "announceMode",
          title: "点播播报",
          kind: "value",
          actionTitle: PluginSettings.parseAnnounceMode(ps.announceMode),
          icon: "send",
          action: (report) =>
            PluginSettings.setAnnounceMode((actionTitle) =>
              report?.(actionTitle),
            ),
        },
        {
          key: "proxyAtInput",
          title: "代理蔷薇@输入",
          kind: "switch",
          checked: ps.chatBox.isProxyAtInput,
          icon: "at",
          action: (report) => {
            // 开关只认设置逻辑回报的新值：落盘与重装行为都在这里完成
            PluginSettings.isProxyAtInputSetting(
              (checked) => report?.(undefined, checked),
              changeSearchKeyword,
              ShowOrHideIMC,
            );
          },
        },
        buildPanelDisplayRow(ps.panelDisplay),
      ],
    },
    await buildSyncGroup(refresh),
  ];
};

/**
 * 云端同步组卡（唯一入口，全部改动都发生在这里）。
 * 开关的 `checked` 只取自 `SyncManager.getState().enabled`：启用要过「口令 → 云端预览 →
 * 合并确认」两段弹窗，中途取消或预览失败都不该点亮；流程结束后 `refresh` 重建数据才变开。
 */
export const buildSyncGroup = async (
  refresh: () => void,
): Promise<SettingGroupData> => {
  const uid = SyncManager.getUid();
  const state = SyncManager.getState();
  const enabled = state.enabled;
  const unlocked = state.unlocked;
  // 「忘记本机密钥」按缓存是否存在判定：关闭同步后缓存仍在，也必须能清除
  const hasLocalKey = await SyncManager.hasLocalKey().catch(() => false);

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

  const items: SettingData[] = [
    {
      key: "syncEnabled",
      title: "云端同步",
      kind: "switch",
      checked: enabled,
      // 值位留现有状态文字：游客态「未登录账号」是开关点亮不了的原因
      actionTitle: !uid ? "未登录账号" : enabled ? "已启用" : "未启用",
      icon: "cloud",
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
            void previewThenEnable(passphrase, refresh);
          },
        );
      },
    },
    ...(enabled
      ? [
          {
            key: "syncStatus",
            title: "同步状态",
            kind: "readonly",
            actionTitle:
              state.status.phase === "syncing"
                ? "同步中…"
                : state.status.phase === "error"
                  ? "待重试"
                  : "正常",
            icon: "refresh",
          } satisfies SettingData,
        ]
      : []),
    {
      key: "syncPassphrase",
      title: "同步口令（忘记不可找回）",
      kind: "value",
      actionTitle: !enabled ? "未启用" : unlocked ? "已解锁" : "未解锁",
      icon: "key",
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
      kind: "readonly",
      actionTitle: SyncManager.formatLastSyncAt(state.lastSyncAt),
      icon: "clock",
    },
    {
      key: "syncNow",
      title: "立即同步",
      kind: "action",
      actionTitle: !enabled ? "未启用" : unlocked ? "立即同步" : "需先解锁",
      icon: "refresh",
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
      kind: "action",
      actionTitle: "清空云端",
      icon: "trash",
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
      kind: "action",
      actionTitle: hasLocalKey ? "清除本机密钥" : "无本机密钥",
      icon: "key",
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

  return { title: "云端同步", items };
};

/**
 * 首次启用第 1 段：先纯读预览，云端有数据时弹「合并并上传 / 取消」确认框。
 * 确认前不会写云端（`previewEnable` 不翻转 enabled、不写密钥缓存）。
 */
const previewThenEnable = async (
  passphrase: string,
  refresh: () => void,
): Promise<void> => {
  const preview = await SyncManager.previewEnable(passphrase);
  const step = chooseEnableStep(preview);
  if (step === "abort") {
    ShowMessage.show(preview.message);
    refresh();
    return;
  }
  if (step === "commit") {
    // 云端为空：没有可确认的合并，直接上传
    const result = await SyncManager.commitEnable();
    ShowMessage.show(result.message);
    refresh();
    return;
  }
  // 仅为类型收窄：chooseEnableStep 已经排除失败，走到这里必定是成功预览
  if (!preview.ok) return;
  // 口令输入框刚关闭，宿站随后还要 fadeOut + empty() 选择器容器：
  // 立刻开新弹窗会被它清掉，必须让出 300ms（见 AGENTS.md 的弹窗流转坑）
  window.setTimeout(() => {
    confirmMerge(
      preview.stats,
      () => {
        void SyncManager.commitEnable().then((result) => {
          ShowMessage.show(result.message);
          refresh();
        });
      },
      () => {
        ShowMessage.show(SyncManager.cancelEnable().message);
        refresh();
      },
    );
  }, 300);
};

/**
 * 「合并并上传 / 取消」两选项确认框：宿站单选选择弹窗（取值类，不是选集）。
 * 点空白/关闭一律按取消处理，避免预览结果悬空。
 */
const confirmMerge = (
  stats: MergeStats,
  onMerge: () => void,
  onCancel: () => void,
): void => {
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
};
