// AboutService.ts
//
// 关于页数据：一张 `about-card`（DESIGN.md），行样式同设置行；条目与动作沿用现有四项，
// 只有图标换成自包含内联 SVG、外链值由「GitHub 🔗」改成「GitHub」+ 外链图标。
import { About } from "../../platforms/About";

export class AboutService {
  /**
   * @description 构建并显示“关于”菜单
   * @param ctx 核心操作上下文
   * @param ShowOrHideIMC 组件传入的显示/隐藏控制方法
   */
  static showAbout(
    ctx: MainAppContainerActionContext,
    ShowOrHideIMC: () => Promise<void>,
  ) {
    const aboutData: SettingGroupData[] = [
      {
        // 关于卡没有组名（DESIGN.md `about-card`）：空串让结果区渲染无标题的关于卡，
        // 手机（设置内点「关于」）与桌面（独立关于模式）因此得到同一张卡。
        title: "",
        items: [
          {
            key: "aboutAuthor",
            title: "作者",
            kind: "value",
            actionTitle: "铭", // 这里对应你的名字 Ming
            icon: "user",
            action: async () => {
              await ShowOrHideIMC();
              new About().aboutCreator();
            },
          },
          {
            key: "aboutSource",
            title: "项目源代码地址",
            kind: "value",
            actionTitle: "GitHub",
            external: true,
            icon: "github",
            action: () => {
              window.open("https://github.com/jingming295/IIROSE-MEDIA-WEB");
            },
          },
          {
            key: "aboutDonate",
            title: "投喂我",
            kind: "value",
            actionTitle: "投喂",
            icon: "coffee",
            action: () => {
              new About().aboutDonate();
            },
          },
          {
            key: "aboutSponsorList",
            title: "赞助列表",
            kind: "value",
            actionTitle: "感谢名单",
            icon: "users",
            action: () => {
              new About().aboutSponsorList(ShowOrHideIMC);
            },
          },
        ],
      },
    ];

    ctx.setState({ settingsData: aboutData });
  }
}
