import { setPanelFocus } from "../playback/PanelFocus";
import { Component } from "preact";
import { MediaSearchBar } from "./components/mediaContainerBar/MediaSearchBar";
import { PlatformSelector } from "./components/mediaContainerBar/PlatformSelector";
import { MediaContainerSubNavBar } from "./components/mediaContainerBar/MediaContainerSubNavBar";
import { MediaCard } from "./components/media-card-container/MediaCard";
import { BilibiliPlatform } from "../platforms/BilibiliPlatform";
import { NetEasePlatform } from "../platforms/NetEasePlatform";
import { AllVideosPlatform } from "../platforms/AllVideosPlatform";
import { SendFetch } from "../Api";
import { PluginSettings } from "../settings/pluginSettings/PluginSettings";
import {
  MediaContainerContext,
  Provider,
} from "./components/media-container-context/MediaContainerContext";
import { BilibiliService } from "./MainAppContainerServices/BilibiliService";
import { AllVideosService } from "./MainAppContainerServices/AllVideoService";
import { AboutService } from "./MainAppContainerServices/AboutService";
import { SettingsService } from "./MainAppContainerServices/SettingsService";
import { NetEaseService } from "./MainAppContainerServices/NetEaseService";
import { MediaContainerGesture } from "./MainAppContainerServices/MediaContainerGesture";
import { RadioService } from "./MainAppContainerServices/RadioService";
import { FavoritesService } from "./MainAppContainerServices/FavoritesService";
import { FavoritesStorageService } from "../storage/FavoritesStorageService";
import { SyncManager } from "../sync/SyncManager";
import { themedDividerBottom } from "./components/floating-panel/floatingPanel";

export class MainAppContainer extends Component<
  MainAppContainerProps,
  MainAppContainerState
> {
  static contextType = MediaContainerContext;
  private itemsPerPage = 10;
  bilibiliRefreshCount = 1;
  mediaContainerGesture = new MediaContainerGesture(this.props.ShowOrHideIMC);

  constructor(props: MainAppContainerProps) {
    super(props);
    this.state = {
      searchKeyword: "",
      searchViewMode:
        PluginSettings.getPluginSetting().searchViewMode || "card",
      SubNavBarIndex: 0,
      currentPage: 1,
      updating: false,
      totalPage: 0,
      PlatformIndex: 0,
      isCurrentInMultiPage: false,
      mediaData: null as Promise<{
        platformData: PlatformData[];
        totalPage: number;
      }> | null,
      allMediaData: [] as PlatformData[],
      oldItems: null as OldItems | null,
      settingsData: null as SettingData[] | null,
      requestToken: 0,
      currentSubNavBarAction: () => {},
      currentOnDemandPlay: () => {},
      favoritesMode: false,
      favoritesSearchKeyword: "",
    };
  }

  private discoveryOldItems: OldItems | null = null;

  componentDidMount() {
    setPanelFocus({
      category: this.props.CategoriesIndex,
      platform: this.state.PlatformIndex,
    });
    FavoritesStorageService.init();
    // 云端拉取落地后刷新已渲染的收藏列表（外部变更通知，不会反向触发上传）
    FavoritesStorageService.onExternalChange(() => {
      if (!this.state.favoritesMode) return;
      void FavoritesService.reloadLastQuery(this.getActionContext());
    });
    void SyncManager.init();
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  componentDidUpdate(
    prevProps: Readonly<MainAppContainerProps>,
    prevState: Readonly<MainAppContainerState>,
  ): void {
    if (prevProps.CategoriesIndex !== this.props.CategoriesIndex) {
      setPanelFocus({ category: this.props.CategoriesIndex, platform: 0 });
      this.discoveryOldItems = null;
      this.setState({
        PlatformIndex: 0,
        SubNavBarIndex: 0,
        currentPage: 1,
        allMediaData: [],
        mediaData: null,
        favoritesSearchKeyword: "",
      });
      return;
    }

    // 收藏模式切换时不触发任何数据重置逻辑
    if (prevState.favoritesMode !== this.state.favoritesMode) {
      return;
    }

    const { needOutFromMultiPage, needOutFromSettings } = this.props;
    const {
      settingsData,
      isCurrentInMultiPage,
      oldItems,
      mediaData,
      allMediaData,
      totalPage,
    } = this.state;
    const propsSearchKeyword = this.props.searchKeyword;
    const prevPropsSearchKeyword = prevProps.searchKeyword;

    if (prevState.SubNavBarIndex !== this.state.SubNavBarIndex) {
      this.setState({ updating: false });
    }

    if (prevState.PlatformIndex !== this.state.PlatformIndex) {
      this.setState({ updating: false });
    }

    if (prevPropsSearchKeyword !== propsSearchKeyword) {
      const { SubNavBarIndex, favoritesMode } = this.state;
      if (favoritesMode) {
        // 如果在收藏模式下收到外部全局搜索指令（如聊天框 @点歌），退出收藏模式进入全网模式
        this.discoveryOldItems = null;
        this.setState(
          {
            favoritesMode: false,
            allMediaData: [],
            mediaData: null,
            searchKeyword: propsSearchKeyword || "",
            currentPage: 1,
          },
          () => {
            const categories = this.categories[this.props.CategoriesIndex];
            const plat = categories?.platform[this.state.PlatformIndex];
            plat?.subNavBarItems[this.state.SubNavBarIndex]?.searchAction();
          },
        );
      } else if (propsSearchKeyword === null || propsSearchKeyword === "") {
        if (SubNavBarIndex === 0) return;
        this.setState({
          allMediaData: [],
          mediaData: null,
          searchKeyword: "",
          currentPage: 1,
        });
      } else if (propsSearchKeyword !== this.state.searchKeyword) {
        this.setState(
          {
            allMediaData: [],
            mediaData: null,
            searchKeyword: propsSearchKeyword,
            currentPage: 1,
          },
          () => {
            const categories = this.categories[this.props.CategoriesIndex];
            const plat = categories?.platform[this.state.PlatformIndex];
            plat?.subNavBarItems[this.state.SubNavBarIndex]?.searchAction();
          },
        );
      }
    }

    // 退出多页
    if (needOutFromMultiPage && isCurrentInMultiPage) {
      this.setState({ isCurrentInMultiPage: false });
    }

    // 退出设置页面
    if (needOutFromSettings && settingsData) {
      this.setState({ settingsData: null });
    }

    // 储存mediaItems
    if (isCurrentInMultiPage && !oldItems) {
      this.setState({
        oldItems: {
          mediaData: this.state.mediaData,
          allMediaData: this.state.allMediaData,
          totalPage: this.state.totalPage,
          currentPage: this.state.currentPage,
          SubNavBarAction: this.state.currentSubNavBarAction,
          OnDemandPlay: this.state.currentOnDemandPlay,
        },
      });
    }

    // 搜索关键字改变, 重置页面
    if (
      prevState.searchKeyword !== this.state.searchKeyword &&
      prevState.SubNavBarIndex !== this.state.SubNavBarIndex
    ) {
      this.setState({
        totalPage: 0,
        currentPage: 1,
        allMediaData: [],
        mediaData: null,
      });
    }

    // 当前页面改变
    if (!mediaData && allMediaData.length > 0 && totalPage > 0) {
      this.setState({
        totalPage: 0,
        currentPage: 1,
        allMediaData: [],
        mediaData: null,
      });
    }
  }

  render() {
    const { CategoriesIndex, ShowOrHideIMC, changeSearchKeyword } = this.props;
    const {
      PlatformIndex,
      SubNavBarIndex,
      mediaData,
      settingsData,
      searchKeyword,
      favoritesSearchKeyword,
      currentPage,
      totalPage,
      isCurrentInMultiPage,
      currentOnDemandPlay,
      searchViewMode,
      favoritesMode,
    } = this.state;
    const {
      changecurrentPage,
      updateSubNavBarIndex,
      updateCurrentSubNavBarAction,
      updateCurrentInMultiPageStatus,
      switchPlatform,
      switchToMultiPage,
      switchToOutFromMultiPage,
      toggleSearchViewMode,
      toggleFavoritesMode,
      handleSearchKeywordChange,
    } = this.controller;
    const currentDisplayKeyword = favoritesMode
      ? favoritesSearchKeyword
      : searchKeyword || this.props.searchKeyword || "";
    const categories = this.getActiveCategories(CategoriesIndex);
    const categoriesPlatform =
      categories?.platform[PlatformIndex] || categories.platform[0];
    const color = categoriesPlatform?.color || "rgb(100, 149, 237)";

    const providerValue = {
      color,
      switchToMultiPage,
      currentOnDemandPlay,
      updateCurrentInMultiPageStatus,
      ShowOrHideIMC,
    };
    return (
      <Provider value={providerValue}>
        <div
          className="relative overflow-hidden h-full flex justify-center items-center"
          onTouchStart={(e) =>
            this.mediaContainerGesture.handleStart(
              e,
              currentPage,
              totalPage,
              changecurrentPage,
            )
          }
          onMouseDown={(e) =>
            this.mediaContainerGesture.handleStart(
              e,
              currentPage,
              totalPage,
              changecurrentPage,
            )
          }
        >
          <div className="h-full w-full flex flex-col absolute transition-all duration-250">
            <div className={`flex flex-col gap-1 pb-1 ${themedDividerBottom}`}>
              {!settingsData && (
                <MediaSearchBar
                  searchKeyword={currentDisplayKeyword}
                  currentPage={currentPage}
                  totalPage={totalPage}
                  isCurrentInMultiPage={isCurrentInMultiPage}
                  viewMode={searchViewMode}
                  favoritesMode={favoritesMode}
                  mediaSearchBarActions={{
                    changeSearchKeyword: handleSearchKeywordChange,
                    changecurrentPage,
                    switchToOutFromMultiPage,
                    toggleSearchViewMode,
                    toggleFavoritesMode,
                  }}
                />
              )}
              <PlatformSelector
                platform={categories.platform}
                isCurrentInMultiPage={isCurrentInMultiPage}
                switchPlatform={switchPlatform}
                PlatformIndex={PlatformIndex}
                favoritesMode={favoritesMode}
              />
              <MediaContainerSubNavBar
                platform={categoriesPlatform}
                searchKeyword={currentDisplayKeyword}
                categories={categories}
                isCurrentInMultiPage={isCurrentInMultiPage}
                PlatformIndex={PlatformIndex}
                SubNavBarIndex={SubNavBarIndex}
                favoritesMode={favoritesMode}
                actions={{
                  updateCurrentSubNavBarAction,
                  updateSubNavBarIndex,
                }}
              />
            </div>

            <MediaCard
              mediaData={mediaData}
              settingsData={settingsData}
              viewMode={searchViewMode}
            />
          </div>
        </div>
      </Provider>
    );
  }

  private controller = {
    handleSearchKeywordChange: (keyword: string | null) => {
      const kw = (keyword || "").trim();

      if (this.state.favoritesMode) {
        // 收藏模式：仅修改收藏内部的过滤关键词，刷新收藏列表
        this.setState(
          {
            favoritesSearchKeyword: kw,
            currentPage: 1,
            allMediaData: [],
            mediaData: null,
          },
          () => {
            this.state.currentSubNavBarAction();
          },
        );
      } else {
        // 全网模式：同步清空缓存与重置分页，并发起检索
        this.state.allMediaData.length = 0;
        this.setState(
          {
            searchKeyword: kw,
            currentPage: 1,
            allMediaData: [],
            mediaData: null,
          },
          () => {
            if (this.props.searchKeyword === kw) {
              const categories = this.categories[this.props.CategoriesIndex];
              const plat = categories?.platform[this.state.PlatformIndex];
              const action =
                plat?.subNavBarItems[this.state.SubNavBarIndex]?.searchAction;
              if (action) {
                action();
              } else if (this.state.currentSubNavBarAction) {
                this.state.currentSubNavBarAction();
              }
            } else {
              this.props.changeSearchKeyword(kw);
            }
          },
        );
      }
    },

    /**
     * @description 切换搜索结果视图（卡片/列表），并持久化到 localStorage
     */
    toggleSearchViewMode: () => {
      const searchViewMode = PluginSettings.toggleSearchViewMode();
      this.setState({ searchViewMode });
    },

    /**
     * @description 切换收藏显示模式（点亮/点暗）
     */
    toggleFavoritesMode: async () => {
      const nextMode = !this.state.favoritesMode;

      if (nextMode) {
        // 全网 -> 收藏：拍摄全网现场快照（若处于选集模式则直接复用外层 oldItems）
        const src =
          this.state.isCurrentInMultiPage && this.state.oldItems
            ? this.state.oldItems
            : this.state;

        this.discoveryOldItems = {
          mediaData: src.mediaData,
          allMediaData: src.allMediaData,
          totalPage: src.totalPage,
          currentPage: src.currentPage,
          SubNavBarAction:
            (src as any).SubNavBarAction || this.state.currentSubNavBarAction,
          OnDemandPlay:
            (src as any).OnDemandPlay || this.state.currentOnDemandPlay,
          PlatformIndex: this.state.PlatformIndex,
          SubNavBarIndex: this.state.SubNavBarIndex,
          searchKeyword:
            this.state.searchKeyword || this.props.searchKeyword || "",
        };

        await this.setState({
          favoritesMode: true,
          currentPage: 1,
          PlatformIndex: 0,
          SubNavBarIndex: 0,
          isCurrentInMultiPage: false,
          oldItems: null,
          allMediaData: [],
          mediaData: null,
        });
      } else {
        // 收藏 -> 全网：类似 switchToOutFromMultiPage 恢复全网现场
        const old = this.discoveryOldItems;

        if (old) {
          await this.setState({
            favoritesMode: false,
            currentPage: old.currentPage,
            totalPage: old.totalPage,
            PlatformIndex: old.PlatformIndex ?? 0,
            SubNavBarIndex: old.SubNavBarIndex ?? 0,
            isCurrentInMultiPage: false,
            oldItems: null,
            searchKeyword: old.searchKeyword ?? "",
            allMediaData: old.allMediaData,
            mediaData: old.mediaData,
            currentSubNavBarAction:
              old.SubNavBarAction || this.state.currentSubNavBarAction,
            currentOnDemandPlay:
              old.OnDemandPlay || this.state.currentOnDemandPlay,
          });
        } else {
          await this.setState({
            favoritesMode: false,
            currentPage: 1,
            PlatformIndex: 0,
            SubNavBarIndex: 0,
            isCurrentInMultiPage: false,
            oldItems: null,
            allMediaData: [],
            mediaData: null,
          });
        }
      }
    },

    /**
     * @description 更新目前的页面
     * @param page
     * @returns
     */
    changecurrentPage: async (page: number) => {
      const {
        updating,
        currentSubNavBarAction,
        isCurrentInMultiPage,
        allMediaData,
        totalPage,
      } = this.state;
      if (updating) return;

      if (isCurrentInMultiPage) {
        const safePage = Math.min(Math.max(1, page), totalPage || 1);
        const startIndex = (safePage - 1) * this.itemsPerPage;
        const endIndex = Math.min(
          startIndex + this.itemsPerPage,
          allMediaData.length,
        );
        const currentPageData = allMediaData.slice(startIndex, endIndex);

        await this.setState({
          currentPage: safePage,
          mediaData: Promise.resolve({
            platformData: currentPageData,
            totalPage: totalPage,
          }),
        });
        return;
      }

      await this.setState({ currentPage: page });
      currentSubNavBarAction();
    },

    /**
     * @description 更新平台的子选项
     * @param current
     * @param prev
     */
    updateSubNavBarIndex: async (current: number) => {
      await this.setState({ SubNavBarIndex: current, currentPage: 1 });
      this.setState({ allMediaData: [] });
    },

    /**
     * @description 更新平台的子选项点下去之后会发生什么
     * @param action
     */
    updateCurrentSubNavBarAction: (action: () => void) => {
      this.setState({ currentSubNavBarAction: action });
    },

    /**
     * @description 更新目前是否在多集页面里面
     * @param status
     */
    updateCurrentInMultiPageStatus: (status: boolean) => {
      this.setState({ isCurrentInMultiPage: status });
    },

    /**
     * 更新平台
     * @param index
     */
    switchPlatform: (index: number) => {
      setPanelFocus({ category: this.props.CategoriesIndex, platform: index });
      this.setState({
        PlatformIndex: index,
        SubNavBarIndex: 0,
        currentPage: 1,
        allMediaData: [],
      });
    },

    /**
     * @description 切换到多集页面
     * @param platformData
     * @param isCurrentInMultiPage
     */
    switchToMultiPage: async (
      platformData: PlatformData,
      _isCurrentInMultiPage?: boolean,
    ) => {
      if (platformData.bilibili) {
        const data = BilibiliPlatform.getMultiPageBasicsData(platformData);
        const vod = BilibiliPlatform.VOD;
        this.setState({ currentPage: 1, totalPage: 0, allMediaData: [] });
        this.setState({ mediaData: data });
        this.setState({ currentOnDemandPlay: vod });
        data.then((res) => {
          if (!this.state.isCurrentInMultiPage) return;
          if (!res) return;
          this.setState({ totalPage: res.totalPage });
          if (res.allPlatformData) {
            this.setState({ allMediaData: res.allPlatformData });
          }
        });
      } else if (platformData.neteaseMusic?.isSongList) {
        const data = NetEasePlatform.getSongListMultiPageData(platformData);
        this.setState({ currentPage: 1, totalPage: 0, allMediaData: [] });
        this.setState({ mediaData: data });
        this.setState({ currentOnDemandPlay: NetEasePlatform.MOD });

        data.then((res) => {
          if (!this.state.isCurrentInMultiPage) return;
          if (!res) return;
          this.setState({ totalPage: res.totalPage });
          if (res.allPlatformData) {
            this.setState({ allMediaData: res.allPlatformData });
          }
        });
      } else if (platformData.neteaseMusic?.isAlbum) {
        const data = NetEasePlatform.getAlbumMultiPageData(platformData);

        this.setState({ currentPage: 1, totalPage: 0, allMediaData: [] });
        this.setState({ mediaData: data });
        this.setState({ currentOnDemandPlay: NetEasePlatform.MOD });

        data.then((res) => {
          if (!this.state.isCurrentInMultiPage) return;
          if (!res) return;
          this.setState({ totalPage: res.totalPage });
          if (res.allPlatformData) {
            this.setState({ allMediaData: res.allPlatformData });
          }
        });
      } else {
        const multipage = await platformData.multiPage;
        if (!multipage) return;
        if (multipage.platform === "video") {
          // 1. 获取当前点击资源对应的完整数据（从 state 或直接从传入的 platformData）
          // 注意：你提供的 JSON 结构显示 playList 已经存在于 platformData 中
          const playList = platformData.playList || [];

          // 2. 将 playList 转换为 PlatformData 数组
          const multiPageDatas: PlatformData[] = playList.map((item) => ({
            title: `${platformData.title}`, // "第01集"
            coverImg: platformData.coverImg,
            author: item.episode,
            websiteUrl: item.url, // 视频流地址或详情页
            multiPage: Promise.resolve(undefined), // 标记为单页
            playList: [item], // 包含单个播放项
          }));

          // 3. 计算总页数（假设 itemPerPage 是 10）
          const itemsPerPage = 10;
          const totalPage = Math.ceil(multiPageDatas.length / itemsPerPage);

          // 4. 更新 State
          const VOD = AllVideosPlatform.VOD;

          this.setState({
            currentPage: 1,
            totalPage: totalPage,
            // 将数据包装成 Promise 格式以兼容 MediaCard 的 props
            mediaData: Promise.resolve({
              platformData: multiPageDatas.slice(0, itemsPerPage),
              totalPage: totalPage,
            }),
            allMediaData: multiPageDatas, // 存储完整列表供翻页使用
            currentOnDemandPlay: VOD,
          });

          console.log(
            "Video MultiPage 构建完成，总集数:",
            multiPageDatas.length,
          );
        }
      }
    },

    /**
     * @description 退出多集页面
     * @returns
     */
    switchToOutFromMultiPage: () => {
      const oldItems = this.state.oldItems;
      if (!oldItems) return;
      this.setState({ oldItems: null });
      this.setState({ mediaData: oldItems.mediaData });
      this.setState({ allMediaData: oldItems.allMediaData });
      this.setState({ totalPage: oldItems.totalPage });
      this.setState({ currentPage: oldItems.currentPage });
      this.setState({ isCurrentInMultiPage: false });
      this.setState({ currentSubNavBarAction: oldItems.SubNavBarAction });
      this.setState({ currentOnDemandPlay: oldItems.OnDemandPlay });
    },

    pushAllData: (
      currentRequestToken: number,
      allPlatformData: PlatformData[] | undefined,
      totalPage: number,
    ) => {
      const { allMediaData } = this.state;
      if (this.state.requestToken !== currentRequestToken) {
        return;
      }

      if (allPlatformData) {
        allMediaData.push(...allPlatformData);
        this.setState({ allMediaData: allMediaData, updating: false });
        this.setState({ totalPage: totalPage });
      }
    },
  };
  private getActionContext(): MainAppContainerActionContext {
    return {
      getState: () => this.state,
      setState: (state) => this.setState(state as MainAppContainerState),
      pushAllData: this.controller.pushAllData, // 直接引用已有的 controller 方法
    };
  }

  private getActiveCategories(
    categoriesIndex: number,
    favoritesMode?: boolean,
  ): Categories {
    const isFav =
      favoritesMode !== undefined ? favoritesMode : this.state.favoritesMode;
    if (isFav && this.favoritesCategories[categoriesIndex]) {
      return this.favoritesCategories[categoriesIndex];
    }
    return this.categories[categoriesIndex] || this.categories[0];
  }

  private favoritesCategories: Categories[] = [
    {
      // 0: 音乐
      platform: [
        {
          title: "网易云音乐",
          iconsrc:
            "https://static.codemao.cn/rose/v0/images/system/media/music/NeteaseMusic/logo.png",
          color: "rgb(221, 28, 4)",
          subNavBarItems: [
            {
              title: "全部",
              class: "search",
              searchAction: () => {
                FavoritesService.loadFavorites(
                  this.getActionContext(),
                  "netease",
                  "all",
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "单曲",
              class: "search",
              searchAction: () => {
                FavoritesService.loadFavorites(
                  this.getActionContext(),
                  "netease",
                  "song",
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "专辑",
              class: "search",
              searchAction: () => {
                FavoritesService.loadFavorites(
                  this.getActionContext(),
                  "netease",
                  "album",
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "歌单",
              class: "search",
              searchAction: () => {
                FavoritesService.loadFavorites(
                  this.getActionContext(),
                  "netease",
                  "playlist",
                  this.itemsPerPage,
                );
              },
            },
          ],
        },
      ],
    },
    {
      // 1: 视频
      platform: [
        {
          title: "哔哩哔哩视频",
          iconsrc:
            "https://static.codemao.cn/rose/v0/images/system/media/video/bilibili/ic_launcher.png",
          color: "rgb(209, 79, 118)",
          subNavBarItems: [
            {
              title: "全部",
              class: "search",
              searchAction: () => {
                FavoritesService.loadFavorites(
                  this.getActionContext(),
                  "bilibili",
                  "all",
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "视频",
              class: "search",
              searchAction: () => {
                FavoritesService.loadFavorites(
                  this.getActionContext(),
                  "bilibili",
                  "video",
                  this.itemsPerPage,
                );
              },
            },
          ],
        },
      ],
    },
  ];

  private categories: Categories[] = [
    {
      platform: [
        {
          title: "网易云音乐",
          iconsrc:
            "https://static.codemao.cn/rose/v0/images/system/media/music/NeteaseMusic/logo.png",
          color: "rgb(221, 28, 4)",
          subNavBarItems: [
            {
              title: "搜索音乐",
              class: "search",
              searchAction: () => {
                NetEaseService.searchMusic(
                  this.getActionContext(),
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "搜索专辑",
              class: "search",
              searchAction: () => {
                NetEaseService.searchAlbum(
                  this.getActionContext(),
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "搜索MV",
              class: "search",
              searchAction: () => {
                NetEaseService.searchMV(
                  this.getActionContext(),
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "搜索歌单",
              class: "search",
              searchAction: () => {
                NetEaseService.searchPlaylist(
                  this.getActionContext(),
                  this.itemsPerPage,
                );
              },
            },
          ],
        },
        {
          title: "无线电广播",
          iconsrc: "http://r.iirose.com/i/26/3/6/4/3635-UJ.png",
          color: "rgb(100, 149, 237)",
          subNavBarItems: [
            {
              title: "日本",
              class: "search",
              searchAction: () => {
                RadioService.search(
                  this.getActionContext(),
                  this.itemsPerPage,
                  "japan",
                );
              },
            },
          ],
        },
      ],
    },
    {
      platform: [
        {
          title: "哔哩哔哩视频",
          iconsrc:
            "https://static.codemao.cn/rose/v0/images/system/media/video/bilibili/ic_launcher.png",
          color: "rgb(209, 79, 118)",
          subNavBarItems: [
            {
              title: "首页推荐",
              searchAction: () => {
                const ctx: BilibiliActionContext = {
                  ...this.getActionContext(),
                  getRefreshCount: () => this.bilibiliRefreshCount,
                  incrementRefreshCount: () => {
                    this.bilibiliRefreshCount++;
                  },
                };
                // 直接通过静态类调用
                BilibiliService.snbclickRecommand(ctx);
              },
            },
            {
              title: "搜索视频",
              class: "search",
              searchAction: () => {
                BilibiliService.snbclickSearchVideo(
                  this.getActionContext(),
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "搜索直播",
              class: "search",
              searchAction: () => {
                BilibiliService.snbclickSearchLive(this.getActionContext());
              },
            },
          ],
        },
        {
          title: "多源剧集检索",
          iconsrc: "http://r.iirose.com/i/26/1/10/8/2516-PN.png",
          color: "rgb(1, 77, 103)",
          subNavBarItems: [
            {
              title: "U库资源网",
              class: "search",
              searchAction: () => {
                const baseUrl = `${SendFetch.cors}https://api.ukuapi88.com`;
                AllVideosService.searchAllVideos(
                  this.getActionContext(),
                  baseUrl,
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "非凡资源",
              class: "search",
              searchAction: () => {
                const baseUrl = `${SendFetch.cors}https://ffzy.tv`;
                AllVideosService.searchAllVideos(
                  this.getActionContext(),
                  baseUrl,
                  this.itemsPerPage,
                );
              },
            },
            {
              title: "最大资源网",
              class: "search",
              searchAction: () => {
                const baseUrl = `${SendFetch.cors}https://zuidazy.co`;
                AllVideosService.searchAllVideos(
                  this.getActionContext(),
                  baseUrl,
                  this.itemsPerPage,
                );
              },
            },
          ],
        },
      ],
    },
    {
      platform: [
        {
          title: "哔哩哔哩视频",
          iconsrc:
            "https://static.codemao.cn/rose/v0/images/system/media/video/bilibili/ic_launcher.png",
          color: "rgb(209, 79, 118)",
          subNavBarItems: [
            {
              title: "账号",
              searchAction: () => {
                SettingsService.showBilibiliAccount(this.getActionContext());
              },
            },
            {
              title: "视频设置",
              searchAction: () => {
                SettingsService.showBilibiliVideo(this.getActionContext());
              },
            },
          ],
        },
        {
          title: "网易云音乐",
          iconsrc:
            "https://static.codemao.cn/rose/v0/images/system/media/music/NeteaseMusic/logo.png",
          color: "rgb(221, 28, 4)",
          subNavBarItems: [
            {
              title: "音乐设置",
              searchAction: () => {
                SettingsService.showNetEaseMusic(this.getActionContext());
              },
            },
          ],
        },
        {
          title: "无线电广播",
          iconsrc: "http://r.iirose.com/i/26/3/6/4/3635-UJ.png",
          color: "rgb(100, 149, 237)",
          subNavBarItems: [
            {
              title: "无线电设置",
              searchAction: () => {
                SettingsService.showRadio(this.getActionContext());
              },
            },
          ],
        },
        {
          title: "插件设置",
          iconsrc:
            "data:image/png;base64,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",
          color: "rgb(150,171,188)",
          subNavBarItems: [
            {
              title: "聊天框",
              searchAction: () => {
                SettingsService.showPluginSettings(
                  this.getActionContext(),
                  this.props.changeSearchKeyword,
                  this.props.ShowOrHideIMC,
                );
              },
            },
            {
              title: "云端同步",
              searchAction: () => {
                SettingsService.showSyncSettings(this.getActionContext());
              },
            },
          ],
        },
      ],
    },
    {
      platform: [
        {
          title: "关于这个插件",
          iconsrc:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAJAUExURQAAAB6D/ABB0CGG/iOH/iSI/yWI/yWJ/wBX5x6D/SCF/RyC+yKH/hyC/BuC/COH/yeK/x2C/B+E/S2O/yyO/xF69wx29QBt8BN7+COI/xyB+x2D/AA91QBF2ABr8QBu7wBs9QBn9CGG/iOH/iOH/yKH/yGG/yKH/yOH/yKH/iCG/yGH/yOH/ySI/ySI/ySI/yOH/yKG/iKH/yCG/ySI/yOH/iGG/yiK/ySI/ySI/yOH/yOH/iGG/yKH/hJ69wFu8QBt8CKH/gBt8ABt8ABt8ABt8ABt8ABt8ABt8ABt8ABt8CKH/iKH/wBt8ABt8CKH/yqL/wBt8ABt8CGG/wBt8ABt8CSI/wBt8ABt8ABt8ABt8ABt8ABt8ABt8CyM/jyU/S2N/iSI/1mj/I6/+Fai/Gaq+8DZ9WWq+yKH/2Wp+7TT9r7Y9ZLB+EWZ/S+O/kCW/S6N/jiT/p7H93Ox+jSQ/iOI/0GX/bbU9qHJ9zuU/iGG/yOH/yGH/xJ79yuM/zmO536klgFu8ABt8CqK+K+0Xf/OADqP5eLEInKx+lqk/L7X9TiO55DA+JHB+CCH/x6G/x2G/7LS9lCWzI2phZKrf36klzeO5xF6+TWR/kuc/TON7s6+Of/PAKeuWghx6v/NAN7BHhx41QBs8k+VzZqtdfLJD+DCHR950zuP5OTEH+DBHTCG2uHCHRB6+SB50wBt8h9409/BHt7AHxx31gBt8Qdw6aKqV5unXgZv6wBs8Rh22WmVjWWTkRR13QBs9P///47GG8oAAABedFJOUwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKK1FvfX1uH7zp+/vpvW8ObtfXJ6/9/a8nMszMMcolDq0N/GvVHmy6CSvp6ClR+/tPb3xOvMowrNYdbQqPlktnAAAAAWJLR0S/09uzVQAAAAd0SU1FB+gJEw0KKyf0K9YAAAJiSURBVDjLZZP3QxJhGMevGJcEQSS+Ni0EBUsDt+YgAQULCsN2yTXgUsuRlwNcp682bdkeJJWU2bZhw7+tO+69w6Pvj+/nc+94nucwjM+KlRKpTI7jcplUsioNS41itRLXZxuMObkmQ7Yel6oUIrxGrdSYjXnbd5xsCRD5BTstZo1SvTbJtevU1sKiwKnTZ84GQyTBpNhkVadrBa6TlZSWnWttaz9/oaOTSKS8olKXATiuSpftqurqDl7sIUmKpAiU6ppMwBnr1SVVl3r7+gfCBEFFIsgID9baOEGh3F3a1ds+xJ5NDY+MDFMcH6Xr7Aljg6awrLtvKMwuj41DOD6GOO1wssJGpbkoFOxP3J2amIRwcoLiOE3XNzDGJtwYaL08wB2MdkCcpl2MINHnXbnaE+YE6hp7B4HT7kaASffsvX6D5DgZmbp5i0xy2uMFmGzf/tsh7gTqzt3p6Xv3Hwic9jUBTH7gYdsj7oqPnzyFED57TifjAhie0xLs4AUYjcIXM7Gk4GeE3ECok6se9fLV6yicjYsFuYUg+fJPvXkL4dxygTlCZsjnORF5Ny8WfM3sMwt4Hn7/YU4ssM+U6A/yfPDjpxSBLdRm3MLz0Vg8RXCBLVia0lzM9zcWn4VwPikkmoWpNKZy1N/YzGcIv3zlBa7dzMBYK1D/Fr59h/DHT34DNDDMyFVWo/4s/vr95+8C4ofQyDFDq6upRYuLS0sCPwyQgGkzMm1HHLQojjobyAL8j8Godmf9cn7UaRe+RwY45nJ7fIn6etzHG4CII6XR2+zy+11N3hP/4YSyFQjZlsT/AMQ+TuO/9QpwAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI0LTA5LTE5VDEzOjEwOjM5KzAwOjAwLv+9+gAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNC0wOS0xOVQxMzoxMDozOSswMDowMF+iBUYAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjQtMDktMTlUMTM6MTA6NDMrMDA6MDCmAnLOAAAAAElFTkSuQmCC",
          color: "rgb(100, 149, 237)",
          subNavBarItems: [
            {
              title: "关于",
              searchAction: () => {
                AboutService.showAbout(
                  this.getActionContext(),
                  this.props.ShowOrHideIMC,
                );
              },
            },
          ],
        },
      ],
    },
  ];
}
