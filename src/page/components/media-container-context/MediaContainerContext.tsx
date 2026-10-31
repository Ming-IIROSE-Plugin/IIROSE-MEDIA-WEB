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
  ShowOrHideIMC: () => {},
});

const { Provider, Consumer } = MediaContainerContext;

export { Provider, Consumer };
