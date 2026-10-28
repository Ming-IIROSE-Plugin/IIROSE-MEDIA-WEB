import { Component } from "preact";
import { coverPlaceholder } from "../floating-panel/floatingPanel";

interface MediaCardImgProps {
  src: string | Promise<string>;
  platformData: PlatformData;
  compact?: boolean; // 列表行小图模式：固定小尺寸、不渲染 infoArea 覆盖层
}

interface MediaCardImgState {
  displaySrc: string;
}

/**
 * 推导条目的「类型 / 时长(或曲目数)」文字，卡片覆盖层与列表行共用
 */
export function getMediaInfoArea(platformData: PlatformData): string {
  let duration: string | null = null;
  let type: string | null = null;
  let infoArea = "";
  const trackCount = platformData.trackCount;

  if (platformData.duration) {
    duration = formatSecondsToMinutes(platformData.duration);
  }

  if (platformData.bilibili?.course_id) {
    type = "课程";
  } else if (platformData.bilibili?.bvid) {
    type = "视频";
  } else if (platformData.bilibiliLive) {
    type = "直播";
  } else if (platformData.neteaseMusic?.isSongList) {
    type = "歌单";
  } else if (platformData.neteaseMusic?.isAlbum) {
    type = "专辑";
  } else if (platformData.neteaseMusic?.isMV) {
    type = "MV";
  } else if (platformData.neteaseMusic?.isDjRadios) {
    type = "电台";
  } else if (platformData.neteaseMusic) {
    type = "音乐";
  } else if (platformData.radio?.isradio) {
    type = "电台";
  } else if (platformData.subtitle) {
    type = platformData.subtitle;
  }

  if (type) {
    if (trackCount) {
      infoArea = `${type} / ${trackCount}首`;
    } else if (duration) {
      infoArea = `${type} / ${duration}`;
    } else {
      infoArea = type;
    }
  }

  return infoArea;
}

/** 视频类条目（B 站视频/直播、网易云 MV、多源剧集）用 16:9 封面区，其余（音乐等）方形。 */
export function isVideoCover(platformData: PlatformData): boolean {
  return !!(
    platformData.bilibili ||
    platformData.bilibiliLive ||
    platformData.neteaseMusic?.isMV ||
    (platformData.playList?.length ?? 0) > 0
  );
}

function formatSecondsToMinutes(seconds: number) {
  const roundedSeconds = Math.round(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(remainingSeconds).padStart(2, "0");
  return `${formattedMinutes}:${formattedSeconds}`;
}

export class MediaCardImg extends Component<
  MediaCardImgProps,
  MediaCardImgState
> {
  // 初始状态：使用一个透明占位图或 Loading 图
  state: MediaCardImgState = {
    displaySrc:
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  };

  constructor(props: MediaCardImgProps) {
    super(props);
    this.resolveSrc(props.src);
  }

  // 当 Props 改变（比如搜索了新关键词）时重新解析
  componentWillReceiveProps(nextProps: MediaCardImgProps) {
    if (nextProps.src !== this.props.src) {
      this.resolveSrc(nextProps.src);
    }
  }

  private resolveSrc(src: string | Promise<string>) {
    if (typeof src === "string") {
      this.setState({ displaySrc: src });
    } else if (src instanceof Promise) {
      src
        .then((url) => {
          if (url) this.setState({ displaySrc: url });
        })
        .catch(() => {
          // 失败逻辑：可以设为默认图
          this.setState({ displaySrc: "你的默认图地址" });
        });
    }
  }

  render() {
    const { platformData, compact } = this.props;
    const { displaySrc } = this.state;

    const infoArea = getMediaInfoArea(platformData);

    // 判断是否还在加载中（如果是 data 开头则是占位图）
    const isLoading = displaySrc.startsWith("data");
    const openWebsite = () => {
      window.open(platformData.websiteUrl || "");
    };

    return (
      <div
        className={`flex relative transition-none shrink-0 ${
          compact
            ? "w-[72px] h-[72px] max-[768px]:w-[56px] max-[768px]:h-[56px] rounded-md overflow-hidden"
            : `w-full overflow-hidden ${isVideoCover(platformData) ? "aspect-video" : "aspect-square"}`
        }`}
      >
        <img
          src={displaySrc}
          className={`object-cover object-center w-full h-full overflow-hidden ${coverPlaceholder} cursor-pointer ${isLoading ? "MediaCardImg-loading" : "MediaCardImg-loaded"}`}
          onClick={openWebsite}
          style={{
            transition: "opacity 0.3s ease",
            opacity: isLoading ? 0.5 : 1,
          }}
        />
        {/* 类型/时长：封面右下角的深色半透明胶囊，空值不渲染 */}
        {!compact && infoArea && (
          <div
            className="absolute bottom-2 right-2 max-w-[calc(100%-16px)] overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[12px] leading-[18px] font-semibold text-white backdrop-blur-[4px] cursor-pointer"
            onClick={openWebsite}
          >
            {infoArea}
          </div>
        )}
      </div>
    );
  }
}
