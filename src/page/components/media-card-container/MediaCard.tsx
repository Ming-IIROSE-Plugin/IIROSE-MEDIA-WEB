import { Component, createRef } from "preact";
import { MediaCardImg } from "./MediaCardImg";
import { MediaCardInfo } from "./MediaCardInfo";
import { MediaCardButton } from "./MediaCardButton";
import { MediaCardMessage } from "./MediaCardMessage";
import { MediaListRow } from "./MediaListRow";
import { FavoriteStarButton } from "./FavoriteStarButton";
import { SettingCard } from "../../../page/components/SettingCard";
import { themedCard } from "../floating-panel/floatingPanel";

interface MediaCardProps {
  mediaData: Promise<{
    platformData: PlatformData[];
    totalPage: number;
  }> | null;
  settingsData: SettingData[] | null;
  viewMode: "card" | "list"; // 搜索结果视图（只作用于结果分支）
}

interface MediaCardState {
  data: { platformData: PlatformData[]; totalPage: number } | null;
  loading: boolean;
  error: string | null;
  requestId: number;
}

export class MediaCard extends Component<MediaCardProps, MediaCardState> {
  private requestId: number = 0; // 初始化请求 ID
  private containerRef = createRef<HTMLDivElement>();
  constructor(props: MediaCardProps) {
    super(props);
    this.state = {
      data: null,
      loading: true,
      error: null,
      requestId: 0, // 初始化请求 ID
    };
  }

  // 2. 封装滚动逻辑
  private scrollToTop = () => {
    if (this.containerRef.current) {
      this.containerRef.current.scrollTop = 0;
    }
  };

  async componentDidUpdate(prevProps: MediaCardProps) {
    // viewMode 切换不重置滚动位置，保留用户浏览上下文
    if (
      prevProps !== this.props &&
      prevProps.viewMode === this.props.viewMode
    ) {
      this.scrollToTop();
    }

    if (this.props.settingsData !== prevProps.settingsData) {
      return;
    }

    if (this.props.mediaData !== prevProps.mediaData) {
      // 生成新的请求 ID
      const newRequestId = ++this.requestId;
      this.setState({ loading: true, requestId: newRequestId });
      try {
        const data = await this.props.mediaData;
        // 只有当请求 ID 匹配时才更新状态
        if (this.state.requestId === newRequestId) {
          this.setState({ data, loading: false });
        }
      } catch (error) {
        if (this.state.requestId === newRequestId) {
          this.setState({ error: "Failed to load data", loading: false });
        }
      }
    }
  }

  async componentDidMount() {
    if (this.props.mediaData) {
      // 生成新的请求 ID
      const newRequestId = ++this.requestId;
      try {
        const data = await this.props.mediaData;
        // 只有当请求 ID 匹配时才更新状态
        if (this.state.requestId === newRequestId) {
          this.setState({ data, loading: false });
        }
      } catch (error) {
        if (this.state.requestId === newRequestId) {
          this.setState({ error: "Failed to load data", loading: false });
        }
      }
    } else {
      this.setState({ loading: false });
    }
  }

  render() {
    const { data, loading, error } = this.state;
    const { settingsData } = this.props;
    if (settingsData) {
      return (
        <div
          className="relative grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] max-[780px]:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] max-[768px]:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 max-[768px]:gap-[10px] [grid-auto-rows:max-content] [align-content:start] overflow-auto p-3 box-border transition-all duration-250"
          ref={this.containerRef}
        >
          {settingsData.map((item, index) => (
            <SettingCard key={index} settingsData={item} />
          ))}
        </div>
      );
    }

    if (loading) {
      return (
        <div
          className="relative h-full grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] max-[780px]:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] max-[768px]:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 max-[768px]:gap-[10px] [grid-auto-rows:max-content] [align-content:start] overflow-auto p-3 box-border transition-all duration-250"
          ref={this.containerRef}
        >
          <MediaCardMessage message={1} />
        </div>
      );
    }

    if (error) {
      return (
        <div
          className="relative h-full grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] max-[780px]:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] max-[768px]:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 max-[768px]:gap-[10px] [grid-auto-rows:max-content] [align-content:start] overflow-auto p-3 box-border transition-all duration-250"
          ref={this.containerRef}
        >
          <MediaCardMessage message={0} />
        </div>
      );
    }

    if (!data) {
      return (
        <div
          className="relative h-full grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] max-[780px]:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] max-[768px]:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 max-[768px]:gap-[10px] [grid-auto-rows:max-content] [align-content:start] overflow-auto p-3 box-border transition-all duration-250"
          ref={this.containerRef}
        >
          <MediaCardMessage message={2} />
        </div>
      );
    }
    if (data.platformData.length === 0) {
      return (
        <div
          className="relative h-full grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] max-[780px]:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] max-[768px]:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 max-[768px]:gap-[10px] [grid-auto-rows:max-content] [align-content:start] overflow-auto p-3 box-border transition-all duration-250"
          ref={this.containerRef}
        >
          <MediaCardMessage message={0} />
        </div>
      );
    }

    if (this.props.viewMode === "list") {
      return (
        <div
          className="relative flex flex-col gap-[10px] max-[768px]:gap-[8px] overflow-auto p-3 box-border transition-all duration-250"
          ref={this.containerRef}
        >
          {data.platformData.map((item, index) => (
            <MediaListRow key={index} platformData={item} />
          ))}
        </div>
      );
    }

    return (
      <div
        className="relative grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] max-[780px]:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] max-[768px]:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 max-[768px]:gap-[10px] [grid-auto-rows:max-content] [align-content:start] overflow-auto p-3 box-border transition-all duration-250"
        ref={this.containerRef}
      >
        {data.platformData.map((item, index) => (
          <div
            className={`flex grow shrink flex-col m-3 max-[768px]:m-0 max-[980px]:max-h-full relative animate-[fadeIn_.25s_ease-out] rounded-xl overflow-hidden ${themedCard}`}
            key={index}
          >
            <MediaCardImg src={item.coverImg} platformData={item} />
            <FavoriteStarButton platformData={item} variant="floating" />
            <MediaCardInfo platformData={item} />
            <MediaCardButton platformData={item} />
          </div>
        ))}
      </div>
    );
  }
}
