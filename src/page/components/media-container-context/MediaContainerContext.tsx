import { createContext } from "preact";

export const MediaContainerContext = createContext({
  switchToMultiPage: (
    platformData: PlatformData,
    isCurrentInMultiPage?: boolean,
  ) => {
    platformData;
    isCurrentInMultiPage;
  },
  /** 内页「‹ 返回」由 `CollectionHeader` 的 `onBack` prop 承担，不放进上下文。 */
  currentOnDemandPlay: (platformData: PlatformData) => {
    platformData;
  },
  updateCurrentInMultiPageStatus: (isCurrentInMultiPage: boolean) => {
    isCurrentInMultiPage;
  },
  /** 手机点行 / 卡主体：操作条挂点（story 4 填充）。 */
  onRowActivate: (platformData: PlatformData, trigger?: HTMLElement | null) => {
    platformData;
    trigger;
  },
  ShowOrHideIMC: () => {},
});

const { Provider, Consumer } = MediaContainerContext;

export { Provider, Consumer };
