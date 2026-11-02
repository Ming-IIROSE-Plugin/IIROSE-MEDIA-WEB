// 收藏随机面板的搜索栏与批量栏：只渲染与转发交互，取值范围由调用处算好
// （底栏的摘要与确认态留在面板本体）。
import type { RefObject } from "preact";
import type { ShuffleWeight } from "../../../playback/ShuffleSelection";
import {
  focusRing,
  iconButton,
  resetBase,
  textButton,
} from "../floating-panel/floatingPanel";
import {
  deskCaret,
  deskFocusRingOnRose,
  deskInk2,
  deskOnRose,
  deskPlaceholder,
  deskPressTone,
  deskRoseBorderFocus,
  deskRoseSolid,
  deskRule,
} from "../floating-panel/tokens";
import { ClearIcon, SearchIcon, WEIGHT_HINT } from "./pickerChrome";

/** 搜索栏：放大镜 + 内联输入框 + 清除钮（输入即回传给调用处做 150ms 防抖）。 */
export function PickerSearch({
  value,
  inputRef,
  onInput,
  onClear,
}: {
  value: string;
  inputRef: RefObject<HTMLInputElement>;
  onInput: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="shrink-0 px-3">
      <div
        className={`flex h-11 items-center rounded-lg border border-solid pl-3 ${deskRule} ${deskRoseBorderFocus}`}
      >
        <SearchIcon />
        <input
          ref={inputRef}
          type="search"
          value={value}
          placeholder="搜索标题或作者…"
          aria-label="搜索标题或作者"
          className={`m-0 h-full min-w-0 flex-1 appearance-none border-0 bg-transparent px-2 font-[inherit] text-[14px] text-inherit outline-none ${deskPlaceholder} ${deskCaret} max-[768px]:text-[16px] [&::-webkit-search-cancel-button]:hidden`}
          onInput={(event) => onInput(event.currentTarget.value)}
        />
        {value && (
          <button
            type="button"
            className={iconButton}
            aria-label="清除搜索"
            onClick={onClear}
          >
            <ClearIcon />
          </button>
        )}
      </div>
    </div>
  );
}

/** 全选 / 全不选与随机权重分段（方向键在两项间切换）。 */
export function PickerBulkBar({
  hasRecords,
  weight,
  onBulk,
  onWeight,
}: {
  hasRecords: boolean;
  weight: ShuffleWeight;
  onBulk: (checked: boolean) => void;
  onWeight: (weight: ShuffleWeight) => void;
}) {
  return (
    <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-1 px-2 py-1">
      <button
        type="button"
        className={textButton}
        disabled={!hasRecords}
        onClick={() => onBulk(true)}
      >
        全选
      </button>
      <button
        type="button"
        className={textButton}
        disabled={!hasRecords}
        onClick={() => onBulk(false)}
      >
        全不选
      </button>
      <div className="ml-auto flex flex-col items-end">
        <div
          role="radiogroup"
          aria-label="随机权重"
          className={`flex h-8 overflow-hidden rounded-lg border border-solid ${deskRule}`}
        >
          {(["entry", "song"] as const).map((option) => {
            const selected = weight === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected ? "true" : "false"}
                tabIndex={selected ? 0 : -1}
                className={`${resetBase} ${selected ? deskFocusRingOnRose : focusRing} relative h-full border-0 px-3 text-[13px] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] max-[768px]:text-[12px] ${selected ? `${deskRoseSolid} ${deskOnRose}` : `bg-transparent text-inherit ${deskPressTone}`}`}
                onClick={() => onWeight(option)}
                onKeyDown={(event) => {
                  if (
                    ![
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(event.key)
                  )
                    return;
                  event.preventDefault();
                  const other = option === "entry" ? "song" : "entry";
                  onWeight(other);
                  const sibling =
                    event.currentTarget.parentElement?.querySelector<HTMLElement>(
                      `[data-weight="${other}"]`,
                    );
                  sibling?.focus();
                }}
                data-weight={option}
              >
                {option === "entry" ? "按条目" : "按歌曲"}
              </button>
            );
          })}
        </div>
        <div className={`mt-0.5 text-[11px] leading-4 ${deskInk2}`}>
          {WEIGHT_HINT[weight]}
        </div>
      </div>
    </div>
  );
}
