// 面板底部条三形态（DESIGN.md `room-deck` / `mini-deck` / `room-deck-expanded`，CAP-6）：
// 桌面三栏底部条、手机迷你条与点主体向上展开的完整底部条。
// 数据与跳转全部来自 `useDeck`（页面级桥接 + 同一个 PlaybackMode），
// 本文件只持有展开 / 收起状态机并把两态分别交给 `RoomDeckDesktop` 与 `MiniDeck`：
// 不新建轮询、不新建模式机。
import { MODE } from "../desk/deskModes";
import { useEffect, useRef, useState } from "preact/hooks";
import { closePanelTier, pushOverlayLayer } from "../desk/overlayLayers";
import { requesterOf } from "./deckParts";
import { MiniDeck } from "./MiniDeck";
import { RoomDeckDesktop } from "./RoomDeckDesktop";
import { useDeck } from "./useDeck";

export interface RoomDeckProps {
  /** 面板是否打开：关闭时收起展开层（渲染本身不按 active 门控，见 Design Notes）。 */
  active: boolean;
  /** 面板当前模式（不是播放模式）：只用于切模式时收起展开层。 */
  mode: number;
}

/** 展开的底部条收起动画时长（滑出后再卸载）。 */
export const DECK_COLLAPSE_MS = 200;

export function RoomDeck({ active, mode }: RoomDeckProps) {
  const deck = useDeck();
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const miniButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  /** 收起动画进行中：展开层先向下滑出，再真正卸载。 */
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  useEffect(() => clearCloseTimer, []);

  const setOpen = (open: boolean) => {
    clearCloseTimer();
    setClosing(false);
    expandedRef.current = open;
    setExpanded(open);
  };
  // 收起：`restoreFocus` 时把焦点还给迷你条主体（点外侧、切模式、点收起钮）。
  // `animate` 为假（面板整体关闭）时直接卸载，不播滑出动画。
  const collapse = (restoreFocus: boolean, animate = true) => {
    if (!expandedRef.current) return;
    expandedRef.current = false;
    const finish = () => {
      setOpen(false);
      if (restoreFocus) miniButton.current?.focus({ preventScroll: true });
    };
    if (!animate) {
      finish();
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(finish, DECK_COLLAPSE_MS);
  };

  // 切模式收起并把焦点还给迷你条主体；首次挂载时没有展开层，什么都不做。
  useEffect(() => {
    collapse(true);
  }, [mode]);

  // 关面板：一并收起（焦点还给面板内元素没有意义）。
  useEffect(() => {
    if (!active) collapse(false, false);
  }, [active]);

  // 展开时焦点移入收起钮（EXPERIENCE：浮层打开即移入、关闭后归还触发元素）。
  useEffect(() => {
    if (expanded) closeButton.current?.focus({ preventScroll: true });
  }, [expanded]);

  // 展开即登记「展开的底部条」层：`Esc` 与宿站返回键先收起它，而不是关掉面板。
  useEffect(() => {
    if (!expanded) return;
    return pushOverlayLayer("deck", () => collapse(true));
  }, [expanded]);

  // 房间停播时收起展开层：与「无播放时点主体不展开」对称，别让拦截层继续盖着列表。
  const idleNow = deck ? !deck.media.playing : false;
  useEffect(() => {
    if (idleNow) collapse(false);
  }, [idleNow]);

  if (!deck) return null;
  const { media } = deck;
  const requester = requesterOf(media);
  const idle = deck.idle;
  const title = idle ? "房间暂时安静" : media.title;
  // 读屏名称随状态：无播放时组名与内容一致。
  const deckName = idle ? "房间暂时安静" : "房间正在播放";
  const cover = idle ? "" : media.cover;

  const openDeck = () => {
    // 房间无播放时点主体不展开。
    if (expandedRef.current || !media.playing) return;
    // 互斥：顺序菜单、来源菜单先收起
    closePanelTier("deck");
    setOpen(true);
  };

  return (
    <>
      <RoomDeckDesktop
        deck={deck}
        active={active}
        // 设置 / 关于不是点歌的页面：电脑上不显示底部条，把高度还给内容（手机迷你条保留）
        hidden={mode === MODE.settings || mode === MODE.about}
        title={title}
        deckName={deckName}
        cover={cover}
        requester={requester}
      />

      <MiniDeck
        deck={deck}
        active={active}
        title={title}
        deckName={deckName}
        cover={cover}
        requester={requester}
        expanded={expanded}
        closing={closing}
        miniButton={miniButton}
        closeButton={closeButton}
        onOpen={openDeck}
        onCollapse={collapse}
      />
    </>
  );
}
