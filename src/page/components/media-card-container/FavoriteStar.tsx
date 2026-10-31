// 收藏星（DESIGN.md `favorite-star`）：18px，空心 ink3 / 实心 star-on。
// 点击即时切换（乐观更新，失败回滚）；不可收藏的条目返回 null。
import { useEffect, useRef, useState } from "preact/hooks";
import { FavoritesStorageService } from "../../../storage/FavoritesStorageService";
import {
  DeskIcon,
  deskFocusRing,
  deskInk3,
  deskStarOn,
  deskPress,
} from "../floating-panel/tokens";

export interface FavoriteStarProps {
  platformData: PlatformData;
  onToggle?: (isFavorited: boolean) => void;
  /** 卡片里的紧凑形态：手机上也保持 32px（点击区外扩到 44px），给窄卡的标题留位置。 */
  compact?: boolean;
}

export function FavoriteStar({
  platformData,
  onToggle,
  compact = false,
}: FavoriteStarProps) {
  const favoritable = !!FavoritesStorageService.deriveFavoriteId(platformData);
  const [isFavorited, setIsFavorited] = useState(() =>
    favoritable ? FavoritesStorageService.isFavorited(platformData) : false,
  );

  const reread = () => {
    setIsFavorited(FavoritesStorageService.isFavorited(platformData));
  };

  /** 连点期间只认第一次：两次 toggle 交错落地会让星标与存储对不上。 */
  const pending = useRef(false);
  /** 只在用户亲手点亮的那一下弹跳：加载出来就已收藏的星不弹。 */
  const [popKey, setPopKey] = useState(0);

  useEffect(() => {
    reread();
  }, [platformData]);

  // 存储层就绪、外部变更（云端拉取落地）与其它入口的收藏切换（手机操作条）后重读一次：
  // 否则慢速 IndexedDB 下已收藏的条目会显示成空心星，操作条里收藏完行内也不更新。
  useEffect(() => {
    let alive = true;
    void FavoritesStorageService.init().then(() => {
      if (alive) reread();
    });
    const offExternal = FavoritesStorageService.onExternalChange?.(() => {
      if (alive) reread();
    });
    const offChange = FavoritesStorageService.onChange?.(() => {
      if (alive) reread();
    });
    return () => {
      alive = false;
      offExternal?.();
      offChange?.();
    };
  }, [platformData]);

  if (!favoritable) return null;

  const toggle = async (event: MouseEvent) => {
    // 行本身可点（进入内页 / 打开操作条），星标不能连带动到整行。
    event.stopPropagation();
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    const next = !isFavorited;
    setIsFavorited(next);
    if (next) setPopKey((key) => key + 1);
    try {
      const result = await FavoritesStorageService.toggle(platformData);
      setIsFavorited(result.isFavorited);
      onToggle?.(result.isFavorited);
    } catch {
      setIsFavorited(!next);
    } finally {
      pending.current = false;
    }
  };

  return (
    <button
      type="button"
      aria-pressed={isFavorited}
      aria-label={isFavorited ? "取消收藏" : "收藏"}
      title={isFavorited ? "已收藏，点击取消" : "点击添加到收藏"}
      className={`relative grid h-8 w-8 cursor-pointer place-items-center border-0 bg-transparent p-0 after:absolute after:content-[''] ${compact ? "after:-inset-[6px]" : "after:-inset-[2px] max-[768px]:h-10 max-[768px]:w-10"} ${deskFocusRing} ${deskPress} ${isFavorited ? deskStarOn : deskInk3}`}
      onClick={toggle}
    >
      <DeskIcon
        key={popKey}
        name={isFavorited ? "starf" : "star"}
        size={18}
        className={
          popKey > 0 && isFavorited
            ? "animate-[imwPop_260ms_var(--imw-ease)] motion-reduce:animate-none"
            : ""
        }
      />
    </button>
  );
}
