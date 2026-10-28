// 选择面板的平台标签行（CAP-12）：与平台类型无关，按项数自适应形态。
// 0～1 项不渲染；2～3 项等宽分段（首尾自动圆角）；4 项及以上为可横向滑动的胶囊。
import { useEffect, useRef, useState } from "preact/hooks";
import { focusRing } from "../floating-panel/floatingPanel";

export interface PlatformTabItem<T extends string = string> {
  id: T;
  label: string;
}

export interface PlatformTabsProps<T extends string = string> {
  items: readonly PlatformTabItem<T>[];
  selected: T;
  /** 用户点选或键盘切到另一项（键盘切换时组件已把焦点移过去）。 */
  onSelect: (id: T) => void;
  dark: boolean;
  /** 不接受切换（确认中、正在关闭）。 */
  disabled?: boolean;
  /** 每个标签的 DOM id。 */
  tabId?: (id: T) => string;
  /** 标签控制的面板 id（`aria-controls`）。 */
  controls?: string;
  ariaLabel?: string;
}

/** 达到该数量改为可横向滑动的胶囊标签。 */
export const PILL_THRESHOLD = 4;

const tabReset = `m-0 p-0 font-[inherit] border-0 bg-transparent text-inherit ${focusRing}`;

export function PlatformTabs<T extends string>({
  items,
  selected,
  onSelect,
  dark,
  disabled = false,
  tabId,
  controls,
  ariaLabel,
}: PlatformTabsProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  // 胶囊形态右缘是否还有被遮住的标签：有则渐隐提示可继续滑动。
  const [more, setMore] = useState(false);
  const count = items.length;
  const pills = count >= PILL_THRESHOLD;
  const selectedIndex = items.findIndex((item) => item.id === selected);
  // 漫游 tabindex：selected 不在 items 里时退回第一项，保证总有一个标签可聚焦。
  const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const measure = () => {
    const node = strip.current;
    if (!node) return;
    setMore(node.scrollLeft + node.clientWidth < node.scrollWidth - 1);
  };

  useEffect(() => {
    if (!pills) return;
    // 选中项滚入可见区：只改标签行自身的 scrollLeft，不带动面板或 iframe 滚动。
    const node = strip.current;
    const button = buttons.current[selectedIndex];
    if (node && button) {
      const left = button.offsetLeft;
      const right = left + button.offsetWidth;
      if (left < node.scrollLeft) node.scrollLeft = left;
      else if (right > node.scrollLeft + node.clientWidth)
        node.scrollLeft = right - node.clientWidth;
    }
    measure();
  }, [pills, selectedIndex]);

  useEffect(() => {
    // 尺寸变化（视口、字体加载）后重新判断右缘是否还有被遮住的标签。
    const node = strip.current;
    if (!pills || !node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [pills]);

  if (count < 2) return null;

  const select = (index: number, focus: boolean) => {
    if (disabled) return;
    const item = items[index];
    if (!item) return;
    if (focus) buttons.current[index]?.focus({ preventScroll: true });
    if (item.id !== selected) onSelect(item.id);
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    let next: number;
    if (event.key === "ArrowLeft") next = (index - 1 + count) % count;
    else if (event.key === "ArrowRight") next = (index + 1) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else return;
    event.preventDefault();
    select(next, true);
  };

  const idle = dark ? "border-white/15" : "border-black/10";

  return (
    <div
      ref={strip}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      data-layout={pills ? "pills" : "segmented"}
      className={
        pills
          ? `relative flex gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${more ? "[mask-image:linear-gradient(to_right,#000_calc(100%_-_32px),transparent)]" : ""}`
          : "flex"
      }
      onScroll={pills ? measure : undefined}
    >
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        const border = isSelected ? "border-sky-500" : idle;
        const fill = isSelected
          ? "bg-sky-500 font-semibold text-white"
          : disabled
            ? ""
            : "hov:hover:bg-sky-500/8 active:bg-sky-500/15";
        const shape = pills
          ? "rounded-full px-4 whitespace-nowrap"
          : `w-full ${index === 0 ? "rounded-l-lg" : ""} ${index === count - 1 ? "rounded-r-lg" : ""} ${index > 0 ? "border-l-0" : ""}`;
        return (
          <button
            key={item.id}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            id={tabId?.(item.id)}
            type="button"
            role="tab"
            aria-selected={isSelected ? "true" : "false"}
            aria-controls={controls}
            aria-disabled={disabled ? "true" : undefined}
            tabIndex={index === focusIndex ? 0 : -1}
            className={`${tabReset} flex min-h-[44px] items-center rounded-lg ${pills ? "shrink-0" : "min-w-0 flex-1"} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            onClick={() => select(index, false)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {/* 视觉 36px，外层按钮保证 44px 点击区。 */}
            <span
              className={`flex h-9 items-center justify-center border border-solid text-[13px] ${border} ${fill} ${shape}`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
