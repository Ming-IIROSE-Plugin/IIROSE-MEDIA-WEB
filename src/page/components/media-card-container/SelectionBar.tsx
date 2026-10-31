// 内页选择条（spec-collection-inner-batch story 3）：选中 ≥1 首时取代底部条（桌面 60px）/
// 迷你条（手机 58px），同位同高、不另开浮层：「已选 N 首 · 清空 · 点播所选」。
import { stopHostGestures } from "../floating-panel/floatingPanel";
import {
  DeskIcon,
  deskDeckRing,
  deskDeckSurface,
  deskDeckText,
  deskFocusRingOnDeck,
  deskFocusRingOnRose,
  deskOnRose,
  deskPress,
  deskRoseSolid,
  typeDeckTitle,
  typeLabelStrong,
} from "../floating-panel/tokens";
import { requestLabel, useRequestKeyStatus } from "./requestStatus";
import { notifyRoomUnsupported } from "./roomSupport";

export interface SelectionBarProps {
  count: number;
  /** 「点播所选」的守卫键（读「点播中」状态）。 */
  requestKey: string;
  /** 房间不支持点播：按钮灰化、可点、只提示。 */
  supported: boolean;
  onClear: () => void;
  onPlay: () => void;
}

export function SelectionBar({
  count,
  requestKey,
  supported,
  onClear,
  onPlay,
}: SelectionBarProps) {
  const status = useRequestKeyStatus(requestKey);
  const pending = status === "pending";
  return (
    <div
      id="imw-desk-selection-bar"
      className="relative z-[1] shrink-0"
      data-imw-selection-bar="true"
    >
      <div
        role="group"
        aria-label="已选曲目"
        className={`flex h-[60px] items-center gap-4 px-[36px] max-[768px]:h-[58px] max-[768px]:gap-2 max-[768px]:px-4 ${deskDeckSurface} ${deskDeckText} ${deskDeckRing}`}
        {...stopHostGestures}
      >
        <div
          className={`min-w-0 flex-1 truncate ${typeDeckTitle}`}
          aria-live="polite"
          data-imw-selection-count="true"
        >
          已选 {count} 首
        </div>

        <button
          type="button"
          className={`flex h-9 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent px-3 text-inherit ${typeLabelStrong} ${deskFocusRingOnDeck} ${deskPress} max-[768px]:h-11`}
          onClick={onClear}
        >
          清空
        </button>

        <button
          type="button"
          aria-disabled={!supported || pending}
          aria-busy={pending}
          title={supported ? "按点选顺序点播到房间" : "这个房间不支持点播"}
          data-imw-play-selected="true"
          className={`flex h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-full border-0 px-5 ${deskPress} max-[768px]:h-11 ${deskRoseSolid} ${deskOnRose} ${typeLabelStrong} ${deskFocusRingOnRose} ${supported ? "cursor-pointer" : "opacity-40"} ${pending ? "cursor-wait" : ""} ${status === "failed" ? "animate-[imwShake_360ms_ease-in-out]" : ""}`}
          onClick={() => {
            if (!supported) {
              notifyRoomUnsupported();
              return;
            }
            if (pending) return;
            onPlay();
          }}
        >
          <DeskIcon
            name={
              pending ? "spinner" : status === "failed" ? "refresh" : "play"
            }
            size={16}
            className={pending ? "animate-spin" : ""}
          />
          {requestLabel(status, "点播所选")}
        </button>
      </div>
    </div>
  );
}
