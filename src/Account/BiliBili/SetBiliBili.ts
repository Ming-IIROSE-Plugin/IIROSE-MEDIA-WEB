import { BiliBiliLoginApi } from "../../Api/BilibiliAPI/LoginAPI";
import { ShowImage } from "../../iirose_func/ShowImg";
import { ShowMessage } from "../../iirose_func/ShowMessage";
import { BilibiliACC } from "./BilibiliAccountInterface";

import { renderQRCodeDataUrl } from "./qrCode";

export class BiliBiliAccount {
  public setBiliBiliAccountDefaultCookie() {
    this.setBuvid();
  }

  public async setBuvid() {
    const bilibiliaccount = localStorage.getItem("bilibiliAccount");
    if (bilibiliaccount) {
      const account: BilibiliACC = JSON.parse(bilibiliaccount);
      if (account.buvid3 && account.buvid4) return;
      const buvid = await BiliBiliLoginApi.getBuvid();
      if (!buvid || !buvid.data) return;
      account.buvid3 = buvid.data.b_3;
      account.buvid4 = buvid.data.b_4;
      localStorage.setItem("bilibiliAccount", JSON.stringify(account));
    } else {
      const buvid = await BiliBiliLoginApi.getBuvid();
      if (!buvid || !buvid.data) return;
      const account: BilibiliACC = {
        buvid3: buvid.data.b_3,
        buvid4: buvid.data.b_4,
      };
      localStorage.setItem("bilibiliAccount", JSON.stringify(account));
    }
  }

  public async setBiliBiliAccount() {
    function getCookie(name: string, setCookies: string[]): string | null {
      const cookie = setCookies.find((cookie) => cookie.startsWith(`${name}=`));

      if (!cookie) return null;

      return cookie.slice(name.length + 1).split(";")[0];
    }

    function delay(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    function getRandomInt(min: number, max: number) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    let bilibiliQrcode = await BiliBiliLoginApi.getQRCode();
    if (!bilibiliQrcode || !bilibiliQrcode.data) return null;

    let qrcode = await this.generateQRCodeBase64(bilibiliQrcode.data.url);
    const showImage = new ShowImage();
    showImage.show(qrcode);
    const albumShowHolder = document.getElementById("albumShowHolder");

    if (!albumShowHolder) return null;
    let qrLogin = await BiliBiliLoginApi.QRLogin(
      bilibiliQrcode.data.qrcode_key,
    );
    let noPerformAction = 0; // 记录扫码未登录的次数
    let shouldContinue = true; // 控制循环继续的变量

    while (shouldContinue) {
      if (!bilibiliQrcode || !bilibiliQrcode.data) {
        shouldContinue = false; // 如果二维码数据无效，退出循环
        break;
      }

      qrLogin = await BiliBiliLoginApi.QRLogin(bilibiliQrcode.data.qrcode_key);

      if (albumShowHolder.style.display === "none") {
        shouldContinue = false; // 如果页面不显示，退出循环
        break;
      }

      if (!qrLogin) {
        shouldContinue = false; // 如果登录请求失败，退出循环
        break;
      }

      if (qrLogin.data.code === 0) {
        shouldContinue = false; // 登录成功，退出循环
        break;
      } else if (qrLogin.data.code === 86101) {
        // 未扫码，继续等待
      } else if (qrLogin.data.code === 86038) {
        // 二维码失效，重新获取
        bilibiliQrcode = await BiliBiliLoginApi.getQRCode();
        if (bilibiliQrcode && bilibiliQrcode.data) {
          console.log("重新获取二维码");
          qrcode = await this.generateQRCodeBase64(bilibiliQrcode.data.url);
          showImage.show(qrcode);
        }
      } else if (qrLogin.data.code === 86090) {
        // 扫码未登录
        noPerformAction++;
        if (noPerformAction > 10) {
          bilibiliQrcode = await BiliBiliLoginApi.getQRCode();
          ShowMessage.show("长时间扫码未登录，刷新了二维码");
          if (bilibiliQrcode && bilibiliQrcode.data) {
            console.log("长时间扫码未登录，刷新了二维码");
            qrcode = await this.generateQRCodeBase64(bilibiliQrcode.data.url);
            noPerformAction = 0;
            showImage.show(qrcode);
          }
        }
      }
      await delay(getRandomInt(1800, 2200)); // 等待随机时间后继续循环
    }

    if (!qrLogin) return null;
    const parsedUrl = new URL(qrLogin.data.url);
    const gourl = parsedUrl.searchParams.get("gourl");
    const refresh_token = qrLogin.data.refresh_token;

    const DedeUserID = getCookie("DedeUserID", qrLogin.setCookies);
    const DedeUserID__ckMd5 = getCookie(
      "DedeUserID__ckMd5",
      qrLogin.setCookies,
    );
    const SESSDATA = getCookie("SESSDATA", qrLogin.setCookies);
    const bili_jct = getCookie("bili_jct", qrLogin.setCookies);
    const Expires = parsedUrl.searchParams.get("Expires");

    const bilibiliaccount: BilibiliACC = {
      DedeUserID: DedeUserID ? DedeUserID : "",
      DedeUserID__ckMd5: DedeUserID__ckMd5 ? DedeUserID__ckMd5 : "",
      Expires: Expires ? Expires : "",
      SESSDATA: SESSDATA ? SESSDATA : "",
      bili_jct: bili_jct ? bili_jct : "",
      gourl: gourl ? gourl : "",
      refresh_token: refresh_token ? refresh_token : "",
    };
    let lsBilibiliAccount = localStorage.getItem("bilibiliAccount");
    if (lsBilibiliAccount) {
      const lsBilibiliAccountParsed: BilibiliACC =
        JSON.parse(lsBilibiliAccount);
      lsBilibiliAccountParsed.DedeUserID = bilibiliaccount.DedeUserID;
      lsBilibiliAccountParsed.DedeUserID__ckMd5 =
        bilibiliaccount.DedeUserID__ckMd5;
      lsBilibiliAccountParsed.Expires = bilibiliaccount.Expires;
      lsBilibiliAccountParsed.SESSDATA = bilibiliaccount.SESSDATA;
      lsBilibiliAccountParsed.bili_jct = bilibiliaccount.bili_jct;
      lsBilibiliAccountParsed.gourl = bilibiliaccount.gourl;
      lsBilibiliAccountParsed.refresh_token = bilibiliaccount.refresh_token;
      localStorage.setItem(
        "bilibiliAccount",
        JSON.stringify(lsBilibiliAccountParsed),
      );
    } else
      localStorage.setItem("bilibiliAccount", JSON.stringify(bilibiliaccount));
    const navUserData = await BiliBiliLoginApi.getNavUserData(
      bilibiliaccount.SESSDATA,
    );
    if (navUserData && navUserData.data) {
      lsBilibiliAccount = localStorage.getItem("bilibiliAccount");
      if (lsBilibiliAccount) {
        const lsBilibiliAccountParsed: BilibiliACC =
          JSON.parse(lsBilibiliAccount);
        lsBilibiliAccountParsed.uname = navUserData.data.uname;
        lsBilibiliAccountParsed.face = navUserData.data.face;
        localStorage.setItem(
          "bilibiliAccount",
          JSON.stringify(lsBilibiliAccountParsed),
        );
      }
      ShowMessage.show(`登录成功，用户名：${navUserData.data.uname}`);
      showImage.hide();
      return navUserData.data.uname;
    }
    return null;
  }

  private generateQRCodeBase64(qrcodetext: string): Promise<string> {
    // 放到 then 里求值：生成失败要变成 rejection，而不是同步抛出。
    return Promise.resolve().then(() => renderQRCodeDataUrl(qrcodetext));
  }
}
