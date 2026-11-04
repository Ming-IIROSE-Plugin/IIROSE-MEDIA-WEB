import { GetBiliBiliAccount } from "../../Account/BiliBili/GetBiliBili";
import { BiliBiliSettings } from "../../settings/bilibiliSettings/BiliBiliSettings";

/**
 * B站：账号 + 视频设置两张组卡（原「账号」「视频设置」两个范围合并）
 */
export const buildBilibiliGroups = (): SettingGroupData[] => {
  const getBilibiliAcc = new GetBiliBiliAccount();
  const accData = getBilibiliAcc.getBiliBiliAccount();
  const settings = new BiliBiliSettings();
  const s = settings.getBilibiliVideoSettings();

  return [
    {
      title: "账号",
      items: [
        {
          key: "bilibiliAccount",
          title: "账号",
          kind: "value",
          actionTitle: accData?.uname || "未登录",
          icon: "user",
          action: settings.setAccount.bind(settings),
        },
      ],
    },
    {
      title: "视频设置",
      items: [
        {
          key: "bilibiliVideoQn",
          title: "点播的视频画质",
          kind: "value",
          actionTitle: settings.parseBilibiliVideoQn(s.qn),
          icon: "film",
          action: settings.setBilibiliVideoQuality.bind(settings),
        },
        {
          key: "bilibiliLiveQn",
          title: "点播的直播画质",
          kind: "value",
          actionTitle: settings.parseBilibiliLiveQn(s.streamqn),
          icon: "signal",
          action: settings.setBilibiliLiveQuality.bind(settings),
        },
        {
          key: "bilibiliStreamSeconds",
          title: "点播的直播播放时长",
          kind: "value",
          actionTitle: `${s.streamSeconds / 60} 分钟`,
          icon: "clock",
          action: settings.setBilibiliStreamSeconds.bind(settings),
        },
        {
          key: "bilibiliVideoStreamFormat",
          title: "点播视频的获取格式",
          kind: "value",
          actionTitle: settings.parseGetVideoFormat(s.videoStreamFormat),
          icon: "wrench",
          action: settings.setGetVideoFormat.bind(settings),
        },
        {
          key: "bilibiliDefaultApi",
          title: "默认API",
          kind: "value",
          actionTitle: settings.parseBilibiliApi(s.api),
          icon: "code",
          action: settings.setBilibiliDefaultApi.bind(settings),
        },
      ],
    },
  ];
};
