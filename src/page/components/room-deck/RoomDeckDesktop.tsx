// 桌面三栏底部条（DESIGN.md `room-deck`）：封面 + 标题 + 点播者 / 进度 / 两组开关。
// 只排版，数据与跳转来自 `useDeck` 的模型（由 `RoomDeck` 传入）。
import type { DeckModel } from "./useDeck";
import { stopHostGestures } from "../floating-panel/floatingPanel";
import { Cover } from "../media-card-container/Cover";
import {
  deskDeckRing,
  deskDeckSurface,
  deskDeckText,
  roundedSm,
  typeDeckTitle,
} from "../floating-panel/tokens";
import { DeckProgress } from "./DeckProgress";
import { DeckToggles, LiveRow } from "./deckParts";

export interface RoomDeckDesktopProps {
  deck: DeckModel;
  /** 面板是否打开：关闭后不再播报状态（只是移出视口）。 */
  active: boolean;
  /** 设置 / 关于不是点歌的页面：电脑上隐藏底部条，把高度还给内容。 */
  hidden: boolean;
  title: string;
  /** 读屏组名：无播放时与标题一致。 */
  deckName: string;
  cover: string;
  requester: string;
}

export function RoomDeckDesktop({
  deck,
  active,
  hidden,
  title,
  deckName,
  cover,
  requester,
}: RoomDeckDesktopProps) {
  const { media, progress, playback, seekable, live, idle } = deck;
  return (
    <div
      id="imw-desk-room-deck"
      className={`relative shrink-0 max-[768px]:hidden ${hidden ? "hidden" : ""}`}
    >
      <div
        data-imw-deck="room"
        role="group"
        aria-label={deckName}
        className={`flex h-[60px] items-center gap-6 px-[36px] ${deskDeckSurface} ${deskDeckText} ${deskDeckRing}`}
        {...stopHostGestures}
      >
        <div className="flex w-[280px] min-w-0 shrink-0 items-center gap-3 max-[900px]:w-[190px]">
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

        <div className="flex w-[260px] shrink-0 items-center justify-end gap-2 max-[900px]:w-[210px]">
          <DeckToggles
            playback={playback}
            compact={false}
            onToggle={deck.toggle}
          />
        </div>

        {/* 读屏状态区：面板关闭后（只是移出视口）不再播报，避免打断聊天中的读屏用户 */}
        {active && (
          <span role="status" className="sr-only">
            {deck.status}
          </span>
        )}
      </div>
    </div>
  );
}
