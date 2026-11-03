import { IIROSEUtils } from "../../iirose_func/IIROSEUtils";
import { readJson, writeJson } from "../../storage/localStore";

export interface CommonSettingsInterface {
  TOS: {
    TOSVersion: string;
    TOSAgree: boolean;
  };
  Privacy: {
    PrivacyVersion: string;
    PrivacyAgree: boolean;
  };
}

export class CommonSettings {
  public setAgree(tosVersion: string, privacyVersion: string) {
    const setTOS = () => {
      const cs = readJson<CommonSettingsInterface | null>(
        "commonSetting",
        null,
      );
      if (cs) {
        cs.TOS.TOSAgree = true;
        writeJson("commonSetting", cs);
      } else {
        const cs = {
          TOS: {
            TOSVersion: tosVersion,
            TOSAgree: true,
          },
          Privacy: {
            PrivacyVersion: privacyVersion,
            PrivacyAgree: false,
          },
        };
        writeJson("commonSetting", cs);
      }

      let content = `IIROSE-MEDIA-WEB 隐私政策\n`;
      content += `版本: ${privacyVersion}\n\n`;
      content += `感谢您使用 IIROSE-MEDIA-WEB。我们非常重视您的隐私，并致力于保护您的个人信息。请仔细阅读以下隐私政策：\n\n`;
      content += `1. 本插件不收集任何可识别您身份的信息，也不做任何形式的数据追踪或分析。插件只有两类会联网：向内容平台取数据（见第 2 条）与您主动启用的收藏云同步（见第 3～8 条）。\n`;
      content += `2. 搜索、播放等取数请求只发往对应内容平台的公开接口，不携带您的蔷薇账号身份；由于浏览器的跨域限制，这些请求会经由维护者搭建的第三方 CORS 代理转发（代理只做请求中转与跨域响应头处理，不记录内容）。\n`;
      content += `3. 收藏云同步默认关闭，只有您主动启用才会生效。首次启用时先做一次纯读预览：只读取云端密文（一次 GET），不向云端写入任何内容。云端已有数据时会先显示「云端 / 本地 / 合并后」的收藏条数，只有您确认「合并并上传」后才会上传，取消则本地与云端都不发生任何变化；云端为空时没有可合并的内容，会跳过确认直接上传本地收藏。启用后插件会自动拉取云端收藏：激活时一次，打开面板、切回标签页或窗口获得焦点时（最快每 60 秒一次），面板打开期间每 5 分钟一次；收藏增删会合并为一次上传。\n`;
      content += `4. 启用云同步后：您的收藏会在本机加密后再上传到维护者的云存储。服务端始终只持有密文，无法读取收藏内容。服务端可见的只有：您的蔷薇账号标识（uid）、密文与密钥包裹块的长度、快照条目数（itemCount）、快照时间戳、写入设备的随机标识（writer），以及密钥派生参数（kdf.salt / kdf.iter）和被口令加密的密钥包（wrapped，没有口令无法解开）。uid 属于半公开标识，因此请妥善保管同步口令。\n`;
      content += `5. 同步口令不落任何存储：它只用于在您的浏览器内派生密钥，我们既不保存也不上传，也不提供口令找回。忘记口令且未保留本机密钥时，云端收藏将无法恢复。\n`;
      content += `6. 为免去重复输入，本机可缓存一份**不可导出**的密钥句柄（仅存于您的浏览器，不含口令，也无法导出密钥本身）；您可在设置面板随时「忘记本机密钥」清除它，清除后需重新输入口令。\n`;
      content += `7. 卸载或停用本插件不会删除云端密文副本：如需彻底删除，请在卸载前于设置面板执行「清空云端」，或联系我代为删除。云端副本会保留到您主动清空为止（云存储自身保留有限的历史版本，用于误删回滚）。\n`;
      content += `8. 本地收藏随浏览器数据一并清除；卸载本插件不会影响云端副本，处理方式同上一条。\n\n`;
      content += `如有任何疑问或建议，请联系我。感谢您的信任与支持！\n`;
      const title = [content];
      IIROSEUtils.sync(0, title, setPrivacy);
    };

    const setPrivacy = () => {
      const cs = readJson<CommonSettingsInterface | null>(
        "commonSetting",
        null,
      );
      if (cs) {
        cs.Privacy.PrivacyAgree = true;
        writeJson("commonSetting", cs);
      } else {
        const cs = {
          TOS: {
            TOSVersion: tosVersion,
            TOSAgree: true,
          },
          Privacy: {
            PrivacyVersion: privacyVersion,
            PrivacyAgree: true,
          },
        };
        writeJson("commonSetting", cs);
      }
    };

    let content = `IIROSE-MEDIA-WEB 用户协议\n`;
    content += `版本: ${tosVersion}\n\n`;
    content += `欢迎使用 IIROSE-MEDIA-WEB！在使用本插件前，请仔细阅读以下条款：\n\n`;
    content += `1. 请合理使用本插件，避免任何形式的滥用行为。\n`;
    content += `2. 希望您能充分体验和享受本插件带来的便捷与乐趣。\n`;
    content += `3. 我将不断改进，期待您的宝贵意见与建议。\n\n`;
    content += `感谢您的支持！\n`;
    const title = [content];
    IIROSEUtils.sync(0, title, setTOS);
  }
}
