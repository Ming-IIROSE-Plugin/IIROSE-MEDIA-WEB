// 手机迷你条与它向上展开的完整底部条（DESIGN.md `mini-deck` / `room-deck-expanded`）。
// 展开 / 收起的状态机在 `RoomDeck`；这里只把 `expanded` / `closing` 映射到视图与动画类。
import type { RefObject } from "preact";
import { formatTime } from "../../../media-progress/model";
import { stopHostGestures } from "../floating-panel/floatingPanel";
import { trapFocusWithin } from "../desk/focusTrap";
import { Cover } from "../media-card-container/Cover";
import {
  DeskIcon,
  deskDeckProgress,
  deskDeckRing,
  deskDeckSheetShadow,
  deskDeckSurface,
  deskDeckText,
  deskDeckTrack,
  deskFocusRingOnDeck,
  roundedSm,
  typeDeckTitle,
  typeDeckTitleMini,
} from "../floating-panel/tokens";
import { DeckProgress } from "./DeckProgress";
import { DeckLabel, DeckToggles, LiveRow, percentOf } from "./deckParts";
import type { DeckModel } from "./useDeck";

export interface MiniDeckProps {
  deck: DeckModel;
  active: boolean;
  title: string;
  /** 读屏组名：无播放时与标题一致。 */
  deckName: string;
  cover: string;
  requester: string;
  expanded: boolean;
  /** 收起动画进行中：展开层先向下滑出，再真正卸载。 */
  closing: boolean;
  miniButton: RefObject<HTMLButtonElement>;
  closeButton: RefObject<HTMLButtonElement>;
  onOpen: () => void;
  onCollapse: (restoreFocus: boolean) => void;
}

export function MiniDeck({
  deck,
  active,
  title,
  deckName,
  cover,
  requester,
  expanded,
  closing,
  miniButton,
  closeButton,
  onOpen,
  onCollapse,
}: MiniDeckProps) {
  const { media, progress, playback, seekable, live, idle } = deck;
  return (
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
          onClick={onOpen}
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

        <DeckToggles playback={playback} compact onToggle={deck.toggle} />

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
            切换模式本身就会收起（EXPERIENCE「切换模式或打开别的面板浮层时也收起」）。
          */}
          <div
            className="absolute inset-x-0 bottom-0 top-[-100vh]"
            data-imw-deck-backdrop="true"
            aria-hidden="true"
            onClick={() => onCollapse(true)}
            {...stopHostGestures}
          />
          <div
            data-imw-deck="expanded"
            role="dialog"
            aria-modal="true"
            aria-label={deckName}
            onKeyDown={trapFocusWithin}
            className={`absolute inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-[16px] px-4 pt-3 pb-4 ${deskDeckSurface} ${deskDeckText} ${deskDeckRing} ${deskDeckSheetShadow} ${closing ? "animate-[imwSheetSink_200ms_var(--imw-ease)_forwards] motion-reduce:animate-[imwSheetFadeOut_160ms_ease-out_forwards]" : "animate-[imwSheetRise_260ms_var(--imw-ease)] motion-reduce:animate-[imwSheetFade_160ms_ease-out]"}`}
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
                onClick={() => onCollapse(true)}
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

            <div className="grid grid-cols-2 gap-2.5">
              <DeckToggles
                playback={playback}
                compact={false}
                sheet
                onToggle={deck.toggle}
              />
            </div>

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
  );
}
