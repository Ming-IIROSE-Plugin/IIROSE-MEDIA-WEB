// 面板底部条三形态（DESIGN.md `room-deck` / `mini-deck` / `room-deck-expanded`，CAP-6）：
// 桌面三栏底部条、手机迷你条与点主体向上展开的完整底部条。
// 数据与跳转全部来自 `useDeck`（页面级桥接 + 同一个 PlaybackMode），
// 本文件只做视图与展开 / 收起状态机：不新建轮询、不新建模式机。
import { useEffect, useRef, useState } from "preact/hooks";
import { formatTime } from "../../../media-progress/model";
import type { MediaSnapshot } from "../../../media-progress/model";
import type { PlaybackModeKind } from "../../../playback/PlaybackMode";
import { stopHostGestures } from "../floating-panel/floatingPanel";
import { trapFocusWithin } from "../desk/focusTrap";
import { closePanelTier, pushOverlayLayer } from "../desk/overlayLayers";
import { Cover } from "../media-card-container/Cover";
import {
  DeskIcon,
  deskDeckProgress,
  deskDeckRing,
  deskDeckSurface,
  deskDeckText,
  deskDeckTrack,
  deskFocusRingOnDeck,
  deskOnRose,
  deskRoseFill,
  deskRoseSolid,
  roundedSm,
  roundedXs,
  typeDeckLabel,
  typeDeckTitle,
  typeDeckTitleMini,
  typeMonoNumSm,
  typeMonoPill,
} from "../floating-panel/tokens";
import { DeckProgress } from "./DeckProgress";
import { ModeToggle } from "./ModeToggle";
import { useDeck } from "./useDeck";

export interface RoomDeckProps {
  /** 面板是否打开：关闭时收起展开层（渲染本身不按 active 门控，见 Design Notes）。 */
  active: boolean;
  /** 面板当前模式（不是播放模式）：只用于切模式时收起展开层。 */
  mode: number;
}

const LABEL = "Now in room";
const TOGGLES: { kind: PlaybackModeKind; label: string }[] = [
  { kind: "loop", label: "单曲循环" },
  { kind: "shuffle", label: "收藏随机" },
];

/** 点播者行：本人为「由你点播」，他人为「某某 点播」；无播放或无昵称时不显示。 */
function requesterOf(media: MediaSnapshot): string {
  if (!media.playing) return "";
  if (media.ownMedia) return "由你点播";
  return media.owner ? `${media.owner} 点播` : "";
}

/** 顶边进度线用的百分比（0–100，越界夹到两端）。 */
function percentOf(current: number | null, duration: number): number {
  if (!(duration > 0)) return 0;
  return Math.min(100, Math.max(0, ((current ?? 0) / duration) * 100));
}

/** 标签行：蔷薇红圆点 + 等宽大写 `Now in room`（只有文字 55% 不透明度）。 */
function DeckLabel() {
  return (
    <div className={`flex items-center gap-1.5 ${typeDeckLabel}`}>
      <span
        aria-hidden="true"
        className={`h-[7px] w-[7px] shrink-0 rounded-full ${deskRoseFill}`}
      />
      <span className="opacity-[0.55]">{LABEL}</span>
    </div>
  );
}

/** 直播 / 电台流：无总时长，「直播」徽章 + 等宽已播时长，不可跳转。 */
function LiveRow({ media }: { media: MediaSnapshot }) {
  return (
    <div className="flex w-full items-center justify-center gap-2">
      <span
        className={`inline-flex h-5 items-center px-2 ${roundedXs} ${deskRoseSolid} ${deskOnRose} ${typeMonoPill}`}
      >
        直播
      </span>
      <span className={`opacity-80 ${typeMonoNumSm}`}>
        {formatTime(media.current)}
      </span>
    </div>
  );
}

export function RoomDeck({ active, mode }: RoomDeckProps) {
  const deck = useDeck();
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const miniButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const setOpen = (open: boolean) => {
    expandedRef.current = open;
    setExpanded(open);
  };
  // 收起：`restoreFocus` 时把焦点还给迷你条主体（点外侧、切模式、点收起钮）。
  const collapse = (restoreFocus: boolean) => {
    if (!expandedRef.current) return;
    setOpen(false);
    if (restoreFocus) miniButton.current?.focus();
  };

  // 切模式收起并把焦点还给迷你条主体；首次挂载时没有展开层，什么都不做。
  useEffect(() => {
    collapse(true);
  }, [mode]);

  // 关面板：一并收起（焦点还给面板内元素没有意义）。
  useEffect(() => {
    if (!active) collapse(false);
  }, [active]);

  // 展开时焦点移入收起钮（EXPERIENCE：浮层打开即移入、关闭后归还触发元素）。
  useEffect(() => {
    if (expanded) closeButton.current?.focus();
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
  const { media, progress, playback, seekable, live, idle } = deck;
  const requester = requesterOf(media);
  const title = idle ? "房间暂时安静" : media.title;
  // 读屏名称随状态：无播放时组名与内容一致。
  const deckName = idle ? "房间暂时安静" : "房间正在播放";
  const cover = idle ? "" : media.cover;

  // 展开层是面板内浮层：Tab 只在其中循环（背后是列表与标签栏）。焦点规则见 `focusTrap.ts`。
  const toggle = (kind: PlaybackModeKind, element: HTMLButtonElement) =>
    deck.toggle(kind, element);

  const togglesFor = (compact: boolean) => (
    <>
      {TOGGLES.map((item) => {
        const active = playback.mode === item.kind;
        const availability = playback[item.kind];
        return (
          <ModeToggle
            key={item.kind}
            kind={item.kind}
            label={item.label}
            active={active}
            enabled={availability.enabled}
            hint={
              active && playback.standby
                ? playback.standbyReason
                : availability.reason || item.label
            }
            compact={compact}
            onToggle={toggle}
          />
        );
      })}
    </>
  );

  const openDeck = () => {
    // 房间无播放时点主体不展开。
    if (expandedRef.current || !media.playing) return;
    // 三者互斥：操作条与顺序菜单先收起
    closePanelTier("deck");
    setOpen(true);
  };

  return (
    <>
      <div
        id="imw-desk-room-deck"
        className="relative shrink-0 max-[768px]:hidden"
      >
        <div
          data-imw-deck="room"
          role="group"
          aria-label={deckName}
          className={`flex h-[60px] items-center gap-6 px-[36px] ${deskDeckSurface} ${deskDeckText} ${deskDeckRing}`}
          {...stopHostGestures}
        >
          <div className="flex w-[280px] min-w-0 shrink-0 items-center gap-3">
            <Cover
              src={cover}
              icon="note"
              className="h-10 w-10"
              rounded={roundedSm}
            />
            <div className="min-w-0 flex-1">
              <div className={`truncate ${typeDeckTitle}`} title={title}>
                {title}
              </div>
              {requester && (
                <div
                  className="mt-px truncate text-[12px] opacity-60"
                  data-imw-deck-requester="true"
                >
                  {requester}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center">
            {idle ? null : live ? (
              <LiveRow media={media} />
            ) : (
              <DeckProgress
                state={progress}
                session={deck.progressSession}
                seekable={seekable}
              />
            )}
          </div>

          <div className="flex w-[260px] shrink-0 items-center justify-end gap-2">
            {togglesFor(false)}
          </div>

          {/* 读屏状态区：面板关闭后（只是移出视口）不再播报，避免打断聊天中的读屏用户 */}
          {active && (
            <span role="status" className="sr-only">
              {deck.status}
            </span>
          )}
        </div>
      </div>

      <div
        id="imw-desk-mini-deck"
        className="relative z-[1] hidden h-[58px] shrink-0 max-[768px]:block"
      >
        <div
          data-imw-deck="mini"
          className={`relative flex h-full items-center gap-[11px] overflow-hidden px-4 ${deskDeckSurface} ${deskDeckText} ${deskDeckRing}`}
          {...stopHostGestures}
        >
          {/* 顶边 3px 进度线：仅显示，不可拖动；直播 / 电台流与无播放时不画。 */}
          {!idle && !live && media.duration ? (
            <span
              aria-hidden="true"
              data-imw-deck-line="true"
              className={`absolute inset-x-0 top-0 h-[3px] ${deskDeckTrack}`}
            >
              <span
                className={`absolute top-0 bottom-0 left-0 ${deskDeckProgress}`}
                style={{
                  width: `${percentOf(progress.preview ?? media.current, media.duration)}%`,
                  // 同桌面轨道：绕开通配过渡，否则进度线永远慢半拍。
                  transition: "none",
                }}
              />
            </span>
          ) : null}

          <button
            ref={miniButton}
            type="button"
            // 房间无播放时点主体不展开：去掉 popup 语义，别承诺一个打不开的对话层。
            {...(idle
              ? {}
              : { "aria-haspopup": "dialog", "aria-expanded": expanded })}
            aria-label={idle ? "房间暂时安静" : `${title}，展开房间播放条`}
            className={`flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-[11px] border-0 bg-transparent p-0 text-left text-inherit ${deskFocusRingOnDeck}`}
            onClick={openDeck}
          >
            <Cover
              src={cover}
              icon="note"
              className="h-11 w-11"
              rounded={roundedSm}
            />
            <span className="min-w-0 flex-1">
              <span className={`block truncate ${typeDeckTitleMini}`}>
                {title}
              </span>
              {!idle && (requester || (!live && media.current !== null)) && (
                <span className="mt-px block truncate text-[12px] opacity-60">
                  {[requester, live ? "" : formatTime(media.current)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </span>
          </button>

          {togglesFor(true)}

          {/* 迷你条自己的读屏状态区：桌面那块被 `display:none` 移出无障碍树，
              展开层又只在打开时存在——收起态下手机的提示与待命原因没有别处播报。 */}
          {active && !expanded && (
            <span role="status" className="sr-only">
              {deck.status}
            </span>
          )}
        </div>

        {expanded && (
          <>
            {/*
              点展开区外收起：挂在迷你条挂载点内、向上铺满列表区（`top-[-100vh]` 由列的
              `overflow-hidden` 裁到面板顶），刻意不盖住标签栏——点标签栏直接切模式，
              切换模式本身就会收起（EXPERIENCE「切换模式或打开操作条时也收起」）。
            */}
            <div
              className="absolute inset-x-0 bottom-0 top-[-100vh]"
              data-imw-deck-backdrop="true"
              aria-hidden="true"
              onClick={() => collapse(true)}
              {...stopHostGestures}
            />
            <div
              data-imw-deck="expanded"
              role="dialog"
              aria-modal="true"
              aria-label={deckName}
              onKeyDown={trapFocusWithin}
              className={`absolute inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-[16px] px-4 pt-3 pb-4 ${deskDeckSurface} ${deskDeckText} ${deskDeckRing}`}
              {...stopHostGestures}
            >
              <div className="flex items-start gap-3">
                <Cover
                  src={cover}
                  icon="note"
                  className="h-[50px] w-[50px]"
                  rounded={roundedSm}
                />
                <div className="min-w-0 flex-1 pr-11">
                  <DeckLabel />
                  <div
                    className={`mt-[3px] truncate ${typeDeckTitle}`}
                    title={title}
                  >
                    {title}
                  </div>
                  {requester && (
                    <div
                      className="mt-px truncate text-[12px] opacity-60"
                      data-imw-deck-requester="true"
                    >
                      {requester}
                    </div>
                  )}
                </div>
                <button
                  ref={closeButton}
                  type="button"
                  aria-label="收起"
                  title="收起"
                  className={`absolute top-1 right-1 flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 ${deskDeckText} ${deskFocusRingOnDeck}`}
                  onClick={() => collapse(true)}
                >
                  <DeskIcon name="chev" size={20} />
                </button>
              </div>

              <div className="flex items-center">
                {idle ? null : live ? (
                  <LiveRow media={media} />
                ) : (
                  <DeckProgress
                    state={progress}
                    session={deck.progressSession}
                    seekable={seekable}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">{togglesFor(false)}</div>

              {/* 面板关闭后（只是移出视口）不再留在无障碍树里播报 */}
              {active && (
                <span role="status" className="sr-only">
                  {deck.status}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
