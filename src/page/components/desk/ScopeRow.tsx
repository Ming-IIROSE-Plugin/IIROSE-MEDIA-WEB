// 范围行（DESIGN.md `scope-tab` / `view-segmented` / `pager-button`）。
// 左：范围标签（tablist，方向键在标签间移动，选中项压一条墨色下划线）；右：视图切换 + 等宽分页。
// 手机标签区可横向滚动，视图切换与分页固定在右侧。
import { ViewToggle } from "./ViewToggle";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk2,
  deskInk3,
  deskInkSurface,
  deskRule,
  deskSheet,
  roundedMd,
  roundedSm,
  typeLabel,
  typeMonoCaption,
  typeMonoNum,
  deskPress,
} from "../floating-panel/tokens";

export interface ScopeItem {
  title: string;
  /** 结果数：本 story 只留位置，数据由 story 2 提供。 */
  count?: number | null;
}

interface ScopeRowProps {
  items: ScopeItem[];
  activeIndex: number;
  onChange: (index: number) => void;
  /** 视图切换：传 null 表示该范围只有一种视图，不显示切换。 */
  viewMode?: "card" | "list" | null;
  onToggleView?: () => void;
  /** 该范围只有一种视图：切换仍在原位，灰色不可点并说明原因。 */
  viewLocked?: boolean;
  currentPage: number;
  totalPage: number;
  /** 分页：设置 / 关于不分页。 */
  showPager?: boolean;
  onPageChange: (page: number) => void;
  label?: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

const pagerButton = `grid h-[30px] w-[30px] shrink-0 cursor-pointer place-items-center border border-solid bg-transparent p-0 ${roundedSm} ${deskRule} ${deskInk2} ${deskFocusRing} ${deskPress} max-[768px]:h-11 max-[768px]:w-11`;

export function ScopeRow({
  items,
  activeIndex,
  onChange,
  viewMode = null,
  onToggleView,
  viewLocked = false,
  currentPage,
  totalPage,
  showPager = true,
  onPageChange,
  label = "范围",
}: ScopeRowProps) {
  const tablist = useRef<HTMLDivElement>(null);
  /** 共享下划线：量出选中标签的位置与宽度，切换时滑过去；第一次定位不滑。 */
  const [bar, setBar] = useState<{
    left: number;
    width: number;
    animate: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const tab =
        tablist.current?.querySelectorAll<HTMLElement>('[role="tab"]')[
          activeIndex
        ];
      if (!tab) {
        setBar(null);
        return;
      }
      setBar((prev) => ({
        left: tab.offsetLeft,
        width: tab.offsetWidth,
        animate: prev !== null,
      }));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex, items.length, items.map((item) => item.title).join("|")]);

  const total = Math.max(totalPage, 1);
  const page = Math.min(Math.max(currentPage, 1), total);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    if (items.length === 0) return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = (activeIndex + delta + items.length) % items.length;
    onChange(next);
    const buttons = (
      event.currentTarget as HTMLElement | null
    )?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };

  return (
    <div
      className={`mx-[36px] mt-[18px] flex items-end border-b border-solid ${deskRule} max-[768px]:mx-[20px] max-[768px]:mt-3 max-[768px]:flex-wrap max-[768px]:border-b-0`}
    >
      <div
        ref={tablist}
        role="tablist"
        aria-label={label}
        className={`no-scrollbar relative flex min-w-0 flex-1 items-end gap-[26px] overflow-x-auto overflow-y-hidden whitespace-nowrap max-[768px]:gap-[22px] max-[768px]:basis-full max-[768px]:border-b max-[768px]:border-solid ${deskRule} max-[768px]:[mask-image:linear-gradient(to_right,black_calc(100%_-_24px),transparent)]`}
        onKeyDown={handleKeyDown}
      >
        {items.map((item, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={`${index}:${item.title}`}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={`relative shrink-0 cursor-pointer border-0 bg-transparent px-0 pb-3 ${typeLabel} ${deskFocusRing} ${deskPress} ${active ? `font-semibold ${deskInk}` : deskInk3}`}
              onClick={() => onChange(index)}
            >
              {item.title}
              {item.count != null && (
                <span
                  className={`ml-1.5 font-normal ${typeMonoCaption} ${deskInk3}`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
        {bar && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-0 left-0 h-0.5 ${deskInkSurface} ${bar.animate ? "transition-[translate,width] duration-200 ease-[var(--imw-ease)] motion-reduce:transition-none" : "transition-none"}`}
            style={{ width: `${bar.width}px`, translate: `${bar.left}px 0` }}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 pb-2 pl-3 max-[768px]:w-full max-[768px]:justify-between max-[768px]:pl-0 max-[768px]:pt-2">
        {viewMode !== null && (
          <ViewToggle
            viewMode={viewMode}
            locked={viewLocked}
            onToggle={onToggleView}
          />
        )}

        {showPager && (
          <div className="ml-2 flex items-center gap-1 max-[768px]:ml-auto">
            <button
              type="button"
              aria-label="上一页"
              className={pagerButton}
              onClick={() => {
                if (page > 1) onPageChange(page - 1);
              }}
            >
              <DeskIcon name="left" size={16} />
            </button>
            <span
              className={`mx-1.5 whitespace-nowrap ${typeMonoNum} ${deskInk2}`}
            >
              {pad(page)} / {pad(total)}
            </span>
            <button
              type="button"
              aria-label="下一页"
              className={pagerButton}
              onClick={() => {
                if (page < total) onPageChange(page + 1);
              }}
            >
              <DeskIcon name="right" size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
