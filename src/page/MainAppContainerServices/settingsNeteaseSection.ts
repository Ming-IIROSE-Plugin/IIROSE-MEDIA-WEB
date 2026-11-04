import { NetEaseSettings } from "../../settings/neteaseSettings/NetEaseSettings";

/** 网易云音乐设置 */
export const buildNetEaseGroups = (): SettingGroupData[] => {
  const s = NetEaseSettings.getNeteaseMusicSetting();

  return [
    {
      title: "音乐设置",
      items: [
        {
          key: "neteaseLyric",
          title: "歌词",
          kind: "value",
          actionTitle: NetEaseSettings.parseNetEaseMusicLyricOption(
            s.lyricOption,
          ),
          icon: "note",
          action: NetEaseSettings.setNeteaseMusicLyric.bind(NetEaseSettings),
        },
        {
          key: "neteaseDefaultApi",
          title: "默认API",
          kind: "value",
          actionTitle: NetEaseSettings.parseNetEaseMusicApi(s.api),
          icon: "code",
          action: NetEaseSettings.setNeteaseDefaultApi.bind(NetEaseSettings),
        },
        {
          key: "neteaseQuality",
          title: "音乐的音质 - 已废弃",
          kind: "value",
          actionTitle: NetEaseSettings.parseNetEaseMusicQuality(s.quality),
          icon: "signal",
          action: NetEaseSettings.setNeteaseMusicQuality.bind(NetEaseSettings),
        },
      ],
    },
  ];
};
