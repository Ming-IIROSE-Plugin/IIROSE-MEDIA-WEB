// 手机操作条（DESIGN.md `action-sheet`，CAP-7）：手机没有悬停，点曲目行（点播钮以外的
// 区域）、视频缩略图或音乐网格卡时从底部升起，给「点播到房间」「收藏」「选集」三步选择。
//
// 挂在主面板内部：面板根的 `transform` 是 `fixed` 后代的包含块，`inset-x-0 bottom-0`
// 正好落在面板底边，压得住迷你条与底部标签栏，也不新设 z-index 根（与顺序菜单同为 z-40）。
// `role="dialog"` + 焦点移入/循环/归还；点外侧、`Esc`、宿站返回键收起由层级栈调度。
import { useEffect, useRef, useState } from "preact/hooks";
import { FavoritesStorageService } from "../../../storage/FavoritesStorageService";
import { restoreFocus, trapFocusWithin } from "../desk/focusTrap";
import { pushOverlayLayer } from "../desk/overlayLayers";
import { stopHostGestures } from "../floating-panel/floatingPanel";
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk2,
  deskRose,
  deskRule,
  deskSheet,
  roundedSm,
  typeLabel,
  typeMonoNumSm,
  typeRowMeta,
  typeRowTitle,
} from "../floating-panel/tokens";
import { Cover } from "../media-card-container/Cover";
import {
  formatDuration,
  hasMultiPage,
  isVideoItem,
} from "../media-card-container/mediaFormat";
import {
  notifyRoomUnsupported,
  roomSupportsRequest,
} from "../media-card-container/roomSupport";

export interface ActionSheetProps {
  platformData: PlatformData;
  /** 触发元素：收起后焦点还给它（不可聚焦时取它内部第一个可聚焦后代）。 */
  returnFocus?: HTMLElement | null;
  /** 收起（点外侧、`Esc`、宿站返回键、执行完某一项）。 */
  onClose: () => void;
  /** 点播到房间：与行内点播同一链路（房间不支持时由本组件先行拦截）。 */
  onPlay: () => void;
  /** 选集：插件自有选集面板（不再经 `buildSelect2`，也不再 `switchToMultiPage` 钻取）。 */
  onSelectEpisodes?: () => void;
}

/** 一行选项：整行 ≥44px、图标 22px + 14px 标签，行间 1px 细线。 */
function SheetOption({
  icon,
  label,
  tone,
  first,
  dimmed,
  optionRef,
  onClick,
}: {
  icon: "play" | "star" | "starf" | "list";
  label: string;
  tone: string;
  first: boolean;
  dimmed?: boolean;
  optionRef?: { current: HTMLButtonElement | null };
  onClick: () => void;
}) {
  return (
    <button
      ref={optionRef}
      type="button"
      aria-disabled={dimmed ? "true" : undefined}
      title={dimmed ? "这个房间不支持点播" : label}
      className={`flex min-h-[44px] w-full cursor-pointer items-center gap-3 border-0 border-solid bg-transparent px-4 py-2 text-left ${typeLabel} ${tone} ${deskFocusRing} ${first ? "" : `border-t ${deskRule}`} ${dimmed ? "opacity-40" : ""}`}
      onClick={onClick}
    >
      <DeskIcon name={icon} size={22} />
      {label}
    </button>
  );
}

export function ActionSheet({
  platformData,
  returnFocus,
  onClose,
  onPlay,
  onSelectEpisodes,
}: ActionSheetProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const favoritable = !!FavoritesStorageService.deriveFavoriteId(platformData);
  const [favorited, setFavorited] = useState(
    () => favoritable && FavoritesStorageService.isFavorited(platformData),
  );
  const [multipage, setMultipage] = useState(false);
  const supported = roomSupportsRequest();

  // 收藏状态以存储为准：慢速 IndexedDB 就绪后重读，别把已收藏的条目显示成「收藏」。
  useEffect(() => {
    if (!favoritable) return;
    let alive = true;
    const reread = () => {
      if (alive)
        setFavorited(FavoritesStorageService.isFavorited(platformData));
    };
    reread();
    void FavoritesStorageService.init().then(reread);
    return () => {
      alive = false;
    };
  }, [platformData, favoritable]);

  // 多 P / 多集才有「选集」；`multiPage` 拒绝或为空时按没有多集处理。
  useEffect(() => {
    let alive = true;
    void hasMultiPage(platformData).then((value) => {
      if (alive) setMultipage(value);
    });
    return () => {
      alive = false;
    };
  }, [platformData]);

  // 打开即登记层级（`Esc` / 宿站返回键只关这一层）；收起后焦点归还触发元素。
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const release = pushOverlayLayer("sheet", () => onCloseRef.current());
    primaryRef.current?.focus({ preventScroll: true });
    return () => {
      release();
      // 「选集」会先开上层选集面板（`role="dialog" aria-modal="true"`）再卸载本操作条：
      // 此时焦点已经落在面板里，不能抢回行体，否则模态面板拿不到焦点。
      if (!document.querySelector("[data-imw-episode-picker]"))
        restoreFocus(returnFocus);
    };
  }, []);

  const play = () => {
    // 首项灰化但仍可点：不支持点播的房间只提示，不发报文、不收起。
    if (!roomSupportsRequest()) {
      notifyRoomUnsupported();
      return;
    }
    onPlay();
  };

  const toggleFavorite = () => {
    // 立即切换并收起；失败由星标自己回滚，不向用户刷错误。
    void FavoritesStorageService.toggle(platformData).catch(() => {});
    onClose();
  };

  const duration = formatDuration(platformData.duration);
  const coverIcon = isVideoItem(platformData) ? "film" : "note";

  return (
    <div
      className="fixed inset-0 z-40"
      data-imw-action-sheet="true"
      onClick={onClose}
      {...stopHostGestures}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${platformData.title} 的操作`}
        className={`absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[16px] border-t border-solid pb-[max(8px,env(safe-area-inset-bottom))] animate-[imwSheetRise_220ms_ease-out] motion-reduce:animate-[imwSheetFade_160ms_ease-out] ${deskRule} ${deskSheet}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapFocusWithin}
        {...stopHostGestures}
      >
        {/* 条目摘要：封面 + 标题 + 副行，同曲目行的手机形态。 */}
        <div
          className={`flex min-h-[62px] items-center gap-3 border-b border-solid px-4 py-2 ${deskRule}`}
        >
          <Cover
            src={platformData.coverImg}
            icon={coverIcon}
            alt={platformData.title}
            rounded={roundedSm}
            className="h-12 w-12"
          />
          <div className="min-w-0">
            <div className={`truncate ${typeRowTitle} ${deskInk}`}>
              {platformData.title}
            </div>
            {(platformData.author || duration) && (
              <div className={`truncate ${typeRowMeta} ${deskInk2}`}>
                {platformData.author}
                {platformData.author && duration && " · "}
                {duration && <span className={typeMonoNumSm}>{duration}</span>}
              </div>
            )}
          </div>
        </div>

        <SheetOption
          icon="play"
          label="点播到房间"
          tone={deskRose}
          first
          dimmed={!supported}
          optionRef={primaryRef}
          onClick={play}
        />

        {favoritable && (
          <SheetOption
            icon={favorited ? "starf" : "star"}
            label={favorited ? "取消收藏" : "收藏"}
            tone={deskInk}
            first={false}
            onClick={toggleFavorite}
          />
        )}

        {multipage && onSelectEpisodes && (
          <SheetOption
            icon="list"
            label="选集"
            tone={deskInk}
            first={false}
            onClick={onSelectEpisodes}
          />
        )}
      </div>
    </div>
  );
}
