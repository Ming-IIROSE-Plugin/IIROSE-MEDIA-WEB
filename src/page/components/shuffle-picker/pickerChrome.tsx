// 收藏随机面板的共用零件：平台/类型/权重文案、元素 id 与自包含图标。
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import type {
  ShufflePlatform,
  ShuffleWeight,
} from "../../../playback/ShuffleSelection";
import { Svg } from "../floating-panel/floatingPanel";
import { deskInk3 } from "../floating-panel/tokens";

export const PLATFORM_LABEL: Record<ShufflePlatform, string> = {
  netease: "网易云",
  bilibili: "B站",
};

export const TYPE_LABEL: Record<FavoriteRecord["type"], string> = {
  song: "单曲",
  video: "视频",
  playlist: "歌单",
  album: "专辑",
};

export const WEIGHT_HINT: Record<ShuffleWeight, string> = {
  entry: "每个收藏机会相同",
  song: "每首歌机会相同，大歌单出现更多",
};

/** 曲目展开区 id：由收藏主键派生（非法字符换成下划线），不随搜索过滤变化。 */
export function tracksRegionId(id: string): string {
  return `imw-shuffle-picker-tracks-${id.replace(/[^\w-]/g, "_")}`;
}

export const tabId = (platform: ShufflePlatform) =>
  `imw-shuffle-picker-tab-${platform}`;
export const LIST_ID = "imw-shuffle-picker-list";

export const ShuffleIcon = ({ size = 22 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M16 3h5v5" />
    <path d="M4 20 21 3" />
    <path d="M21 16v5h-5" />
    <path d="m15 15 6 6" />
    <path d="M4 4l5 5" />
  </Svg>
);

export const SearchIcon = () => (
  <Svg size={18} className={deskInk3}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const ClearIcon = () => (
  <Svg size={18} className={deskInk3}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Svg>
);

export const NoteIcon = () => (
  <Svg size={20} strokeWidth={1.5}>
    <path d="M9 18V5l11-2v13M9 8l11-2" />
    <ellipse cx="6" cy="18" rx="3" ry="2.5" />
    <ellipse cx="17" cy="16" rx="3" ry="2.5" />
  </Svg>
);

export const VideoIcon = () => (
  <Svg size={20} strokeWidth={1.5}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m10 9 5 3-5 3z" />
  </Svg>
);

export const Spinner = () => (
  <Svg size={18} className="animate-spin">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Svg>
);
