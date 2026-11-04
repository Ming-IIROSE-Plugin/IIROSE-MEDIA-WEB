import { RadioSettings } from "../../settings/radioSettings/RadioSettings";

/** 无线电设置 */
export const buildRadioGroups = (): SettingGroupData[] => {
  const s = RadioSettings.getRadioSettings();

  return [
    {
      title: "无线电设置",
      items: [
        {
          key: "radioDuration",
          title: "默认播放时长",
          kind: "value",
          actionTitle: `${s.duration / 60} 分钟`,
          icon: "radio",
          action: RadioSettings.setRadioStreamSeconds.bind(RadioSettings),
        },
      ],
    },
  ];
};
