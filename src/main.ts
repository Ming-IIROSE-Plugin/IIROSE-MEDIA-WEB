import { BiliBiliAccount } from "./Account/BiliBili/SetBiliBili";
import { Environment } from "./environment/Environment";
import { IMCInit } from "./page";
import "./app.css";
import { LocalStorageUtils } from "./settings/localStorageUtils/LocalStorageUtils";

class APP {
  public static async init() {
    if (typeof document === "undefined") {
      console.log(
        `%c [Ming's IIROSE-MEDIA-WEB] - FAILED `,
        `color: #FF5733; background: black; margin: 1em 0; padding: 5px 0; font-weight: 900`,
      );
      return;
    }

    Environment.setEnv();
    LocalStorageUtils.Init();
    const bilibiliAcc = new BiliBiliAccount();
    bilibiliAcc.setBiliBiliAccountDefaultCookie();

    const mainFrame = document.getElementById(
      "mainFrame",
    ) as HTMLIFrameElement | null;
    const mainContainer = document.getElementById(
      "mainContainer",
    ) as HTMLDivElement | null;
    if (!mainContainer) {
      return;
    }

    // 初始化主要功能
    IMCInit.init(mainContainer);

    // 检查 mainFrame 是否存在并注入脚本
    if (mainFrame && mainFrame.contentWindow && mainFrame.contentDocument) {
      this.injectScriptIntoIframe(mainFrame);
    }

    console.log(
      `%c [Ming's IIROSE-MEDIA-WEB] - LOADED `,
      `color: #4CAF50; background: black; margin: 1em 0; padding: 5px 0; font-weight: 900`,
    );
  }

  public static injectScriptIntoIframe(iframe: HTMLIFrameElement) {
    // 获取 iframe 的文档对象
    const iframeDocument =
      iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDocument) {
      console.log(
        `%c [Ming's IIROSE-MEDIA-WEB] - UNABLE TO GET IFRAME `,
        `color: #FF5733; background: black; margin: 1em 0; padding: 5px 0; font-weight: 900`,
      );

      return;
    }

    // 创建一个新的 script 标签
    const script = iframeDocument.createElement("script");
    script.type = "module"; // 使用模块类型
    script.textContent = `
            (() => {

                const app = new (${APP.toString()})();
                app.init();
            })();
        `;

    // 将 script 标签插入到 iframe 的 body 中
    iframeDocument.body.appendChild(script);
  }
}

APP.init();
