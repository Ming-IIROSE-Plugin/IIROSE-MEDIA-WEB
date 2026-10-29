// 收藏星（DESIGN.md `favorite-star`）：18px，空心 ink3 / 实心 star-on。
// 点击即时切换（乐观更新，失败回滚）；不可收藏的条目返回 null。
import { useEffect, useRef, useState } from "preact/hooks";
import { FavoritesStorageService } from "../../../storage/FavoritesStorageService";
import {
  DeskIcon,
  deskFocusRing,
  deskInk3,
  deskStarOn,
} from "../floating-panel/tokens";

export interface FavoriteStarProps {
  platformData: PlatformData;
  onToggle?: (isFavorited: boolean) => void;
}

export function FavoriteStar({ platformData, onToggle }: FavoriteStarProps) {
  const favoritable = !!FavoritesStorageService.deriveFavoriteId(platformData);
  const [isFavorited, setIsFavorited] = useState(() =>
    favoritable ? FavoritesStorageService.isFavorited(platformData) : false,
  );

  const reread = () => {
    setIsFavorited(FavoritesStorageService.isFavorited(platformData));
  };

  /** 连点期间只认第一次：两次 toggle 交错落地会让星标与存储对不上。 */
  const pending = useRef(false);

  useEffect(() => {
    reread();
  }, [platformData]);

  // 存储层就绪与外部变更（云端拉取落地）后重读一次：否则慢速 IndexedDB 下
  // 已收藏的条目会显示空心星，点一下反而取消收藏。
  useEffect(() => {
    let alive = true;
    void FavoritesStorageService.init().then(() => {
      if (alive) reread();
    });
    const off = FavoritesStorageService.onExternalChange?.(() => {
      if (alive) reread();
    });
    return () => {
      alive = false;
      off?.();
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
      className={`grid h-8 w-8 cursor-pointer place-items-center border-0 bg-transparent p-0 ${deskFocusRing} ${isFavorited ? deskStarOn : deskInk3}`}
      onClick={toggle}
    >
      <DeskIcon name={isFavorited ? "starf" : "star"} size={18} />
    </button>
  );
}
