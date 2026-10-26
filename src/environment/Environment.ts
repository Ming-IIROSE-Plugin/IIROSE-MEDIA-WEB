import { SendFetch } from "../Api";
// 全局声明，告诉 TypeScript window 具有 iirosemedia 属性

declare global {
  interface Window {
    device: number | 1 | 7; // 1: 电脑的游览器, 7: Windows app
    ClientLocation?: "CN" | "Global";
    iirosemedia?: {
      cors?: string;
      /** 调试入口：打开收藏随机选择面板；缺省取当前 focus 平台。 */
      openShufflePicker?: (platform?: "netease" | "bilibili") => void;
      // 其他属性...
    };
  }
}
export class Environment {
  public static async setEnv() {
    window.iirosemedia = {};
    await this.setCors();
  }

  private static async setCors() {
    // const ua = navigator.userAgent;
    // const device = window.device;
    // if (device === 7)
    // {
    //     if(window.iirosemedia)
    //     window.iirosemedia.cors = ``;
    //     return;
    // }
    // if (ua.includes('IIROSE'))
    // {
    //     if(window.iirosemedia)
    //     window.iirosemedia.cors = ``;
    //     return;
    // } else {
    //     this.selectCorsBySpeed();
    // }
    const res = await SendFetch.sendGet(
      `https://ipinfo.io/json`,
      new URLSearchParams(),
      new Headers(),
    );

    if (res) {
      const data: ipinfo = await res.json();
      if (!window.iirosemedia) return;

      if (data.country === "CN") {
        window.ClientLocation = "CN";
        window.iirosemedia.cors = `https://cors-anywhere-cwimzudkuk.cn-shenzhen.fcapp.run/`;
      } else {
        window.ClientLocation = "Global";
        window.iirosemedia.cors = `https://cors-anywhere-cwimzudkuk.cn-hongkong.fcapp.run/`;
      }
    } else {
      this.selectCorsBySpeed();
    }
  }

  private static async selectCorsBySpeed() {
    if (!window.iirosemedia) return;
    const corss = [
      "https://cors-anywhere-cwimzudkuk.cn-hongkong.fcapp.run/",
      "https://cors-anywhere-cwimzudkuk.cn-shenzhen.fcapp.run/",
    ];

    // 存储每个请求的时间
    const requestTimes = [];

    // 循环发送请求
    for (const cors of corss) {
      try {
        const startTime = performance.now(); // 获取当前时间戳
        await SendFetch.sendGet(cors, new URLSearchParams(), new Headers());
        const endTime = performance.now(); // 获取请求结束时间戳
        const elapsedTime = endTime - startTime; // 计算请求时间
        requestTimes.push({ cors, time: elapsedTime }); // 存储请求时间
      } catch (error) {
        console.error("请求出错:", error);
      }
    }
    // 根据时间排序，找到最快的 CORS 代理
    requestTimes.sort((a, b) => a.time - b.time);
    // 最快的 CORS 代理
    const fastestCors = requestTimes[0].cors;
    window.iirosemedia.cors = fastestCors;
  }
}
