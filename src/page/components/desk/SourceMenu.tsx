// 来源菜单（DESIGN.md `source-switcher` 的展开态）：插件自有浮层，替代原生 `<select>`
// （原生下拉的展开样式由系统决定，深色主题下是白底蓝条，与面板格格不入）。
// 贴在切换器正下方左对齐；圆点 + 名称，当前项打勾。上下键移动、回车 / 空格选中，
// `Esc` 与宿站返回键走面板层级栈（只关菜单），点菜单外侧关闭，关闭后焦点还给切换器。
import { useEffect, useRef, useState } from "preact/hooks";
import { closePanelTier, pushOverlayLayer } from "./overlayLayers";
import { stopHostGestures } from "../floating-panel/floatingPanel";
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk2,
  deskMenuShadow,
  deskPressTone,
  deskRule,
  deskSheet,
  deskSourceDots,
  roundedMd,
  roundedXl,
  typeLabel,
  type DeskSourceKey,
} from "../floating-panel/tokens";

export interface SourceMenuItem {
  label: string;
  dot?: DeskSourceKey | null;
}

export interface SourceMenuProps {
  sources: SourceMenuItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export function SourceMenu({
  sources,
  selectedIndex,
  onSelect,
  onClose,
}: SourceMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(Math.max(selectedIndex, 0));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 先登记层级（会收起操作条 / 展开的底部条等互斥层），再移动焦点。
  useEffect(() => {
    closePanelTier("source");
    return pushOverlayLayer("source", () => onCloseRef.current());
  }, []);

  useEffect(() => {
    listRef.current
      ?.querySelectorAll<HTMLElement>('[role="option"]')
      [active]?.focus();
  }, [active]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return;
    const last = sources.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => (index >= last ? 0 : index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => (index <= 0 ? last : index - 1));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onSelect(active);
        break;
      case "Tab":
        // 菜单不困住焦点：Tab 离开即收起
        onClose();
        break;
    }
  };

  return (
    <>
      {/* 透明拦截层：点菜单外侧关闭，不把点击漏给下面的结果 */}
      <div
        className="fixed inset-0 z-30"
        data-imw-source-backdrop="true"
        onClick={onClose}
        {...stopHostGestures}
      />
      <div
        ref={listRef}
        role="listbox"
        aria-label="来源"
        data-imw-source-menu="true"
        className={`absolute top-[calc(100%+6px)] left-0 z-40 min-w-[220px] overflow-hidden border border-solid p-1.5 ${roundedXl} ${deskRule} ${deskSheet} ${deskMenuShadow} animate-[imwMenuIn_160ms_var(--imw-ease)] motion-reduce:animate-none max-[768px]:min-w-[200px]`}
        onKeyDown={handleKeyDown}
        {...stopHostGestures}
      >
        {sources.map((source, index) => {
          const selected = index === selectedIndex;
          return (
            <div
              key={source.label}
              role="option"
              aria-selected={selected}
              tabIndex={index === active ? 0 : -1}
              className={`flex min-h-10 cursor-pointer items-center gap-2.5 px-3 max-[768px]:min-h-11 ${roundedMd} ${typeLabel} ${deskPressTone} ${deskFocusRing} ${selected ? `font-semibold ${deskInk}` : deskInk2}`}
              onClick={() => onSelect(index)}
              onMouseEnter={() => setActive(index)}
            >
              <span
                aria-hidden="true"
                className={`h-[7px] w-[7px] shrink-0 rounded-full ${source.dot ? deskSourceDots[source.dot] : "bg-transparent"}`}
              />
              <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                {source.label}
              </span>
              {selected && <DeskIcon name="check" size={16} />}
            </div>
          );
        })}
      </div>
    </>
  );
}
