interface PlatformData {
  title: string;
  subtitle?: string;
  coverImg: string | Promise<string>;
  author: string;
  websiteUrl: string;
  duration?: number;
  trackCount?: string;
  multiPage?: Promise<MultiPageData | undefined>;
  playList?: PlayItem[];
  bilibili?: {
    aid?: number;
    bvid?: string;
    cid?: number;
    course_id?: number;
  };
  bilibiliLive?: {
    roomid: number;
  };
  neteaseMusic?: {
    id: number;
    isSongList?: boolean;
    isAlbum?: boolean;
    isMV?: boolean;
    isDjRadios?: boolean;
    fee: number;
  };
  radio?: {
    isradio: boolean;
    id: number;
  };
}

interface MultiPageData {
  platform: "video" | "bilibili" | "neteasemusic";
}
interface OldItems {
  mediaData: Promise<{
    platformData: PlatformData[];
    totalPage: number;
  }> | null;
  allMediaData: PlatformData[];
  SubNavBarAction?: () => void;
  OnDemandPlay?: (platformData: PlatformData) => void;
  totalPage: number;
  currentPage: number;
  PlatformIndex?: number;
  SubNavBarIndex?: number;
  searchKeyword?: string;
}

interface Platform {
  title: string;
  /** 来源切换器里的简称（手机只显示简称；缺省用 title）。 */
  shortTitle?: string;
  /** 来源圆点令牌：网易云 / 哔哩哔哩 / 电台；缺省无圆点（如收藏模式的「全部」）。 */
  sourceKey?: "netease" | "bilibili" | "radio";
  subNavBarItems: {
    title: string;
    class?: string;
    searchAction: () => void;
  }[];
}

interface Categories {
  platform: Platform[];
}
