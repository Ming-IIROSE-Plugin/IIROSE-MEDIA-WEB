import { createContext } from "preact";

export const MediaContainerContext = createContext({
  switchToMultiPage: (
    platformData: PlatformData,
    isCurrentInMultiPage?: boolean,
  ) => {
    platformData;
    isCurrentInMultiPage;
  },
  /** 内页「‹ 返回」：回到进入内页前的外层结果（关键词、页码与滚动位置不变）。 */
  switchToOutFromMultiPage: () => {},
  currentOnDemandPlay: (platformData: PlatformData) => {
    platformData;
  },
  updateCurrentInMultiPageStatus: (isCurrentInMultiPage: boolean) => {
    isCurrentInMultiPage;
  },
  /** 手机点行 / 卡主体：操作条挂点（story 4 填充）。 */
  onRowActivate: (platformData: PlatformData) => {
    platformData;
  },
  ShowOrHideIMC: () => {},
});

const { Provider, Consumer } = MediaContainerContext;

export { Provider, Consumer };
