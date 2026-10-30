// 「全部播放」的顺序菜单（DESIGN.md `order-menu`）：插件自有浮层，不经过宿站 `buildSelect2`。
// 桌面为贴在按钮下方右对齐的小浮层（宽 200px），手机为底部操作条（头部为专辑/歌单名 + 曲目数）。
// 透明拦截层：点外侧 = 取消不点播。`Esc` / 宿站返回键走层级栈（story 4）：打开即登记
// 一层并先收起别的面板内浮层，因此三种形态互斥、每次返回只关这一层。
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { trackCountLabel } from "./mediaFormat";
import { closePanelTier, pushOverlayLayer } from "../desk/overlayLayers";
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk3,
  deskRule,
  deskSheet,
  roundedXl,
  typeLabel,
  typeLabelStrong,
  typeMonoCaption,
} from "../floating-panel/tokens";

export type PlayOrder = "asc" | "shuffle";

export interface OrderMenuProps {
  /** 专辑 / 歌单名（手机操作条的头部）。 */
  title: string;
  /** 曲目数（等宽）。 */
  trackCount?: string | number | null;
  /** 桌面浮层贴住「全部播放」按钮。 */
  anchor?: HTMLElement | null;
  onSelect: (order: PlayOrder) => void;
  onCancel: () => void;
}

const OPTIONS: { order: PlayOrder; label: string; icon: "sort" | "shuffle" }[] =
  [
    { order: "asc", label: "正序播放", icon: "sort" },
    { order: "shuffle", label: "乱序播放", icon: "shuffle" },
  ];

export function OrderMenu({
  title,
  trackCount,
  anchor,
  onSelect,
  onCancel,
}: OrderMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number }>({
    top: 0,
    right: 12,
  });
  const [phone, setPhone] = useState(
    () => window.matchMedia?.("(max-width: 768px)").matches ?? false,
  );
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // 登记层级必须先于移动焦点：互斥收起别的层（如展开的底部条）会把焦点还给它的触发元素，
  // 顺序反过来会把焦点从菜单项上抢走。
  useEffect(() => {
    // 菜单是面板内最上层的一员：先收起别的面板层（操作条 / 展开的底部条），
    // 再把自己登记为一层，`Esc` 与宿站返回键由此只关菜单。
    closePanelTier("order");
    return pushOverlayLayer("order", () => onCancelRef.current());
  }, []);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const items =
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items?.[0]?.focus();
    return () => {
      // 关闭后焦点还给触发元素（「全部播放」）
      previous?.focus?.();
    };
  }, []);

  // 定位必须在浏览器绘制前算好，否则浮层会先闪在左上角再滑到按钮下方。
  useLayoutEffect(() => {
    if (phone) return;
    const rect = anchor?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, [anchor, phone]);

  const optionList = (
    <div role="menu" aria-label="播放顺序">
      {OPTIONS.map((option, index) => (
        <button
          key={option.order}
          type="button"
          role="menuitem"
          className={`flex min-h-[44px] w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 text-left ${typeLabel} ${deskInk} ${deskFocusRing} ${index > 0 ? `border-t border-solid ${deskRule}` : ""}`}
          onClick={() => onSelect(option.order)}
        >
          <DeskIcon name={option.icon} size={22} />
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-40"
      data-imw-order-menu="true"
      onClick={onCancel}
    >
      {phone ? (
        <div
          ref={menuRef}
          className={`absolute inset-x-0 bottom-0 overflow-hidden border-t border-solid ${deskRule} ${deskSheet} ${roundedXl}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={`flex items-baseline gap-2 border-b border-solid px-4 py-3 ${deskRule}`}
          >
            <span className={`min-w-0 truncate ${typeLabelStrong} ${deskInk}`}>
              {title}
            </span>
            <span className={`shrink-0 ${typeMonoCaption} ${deskInk3}`}>
              {trackCountLabel(trackCount)}
            </span>
          </div>
          {optionList}
        </div>
      ) : (
        <div
          ref={menuRef}
          className={`absolute w-[200px] overflow-hidden border border-solid ${roundedXl} ${deskRule} ${deskSheet} shadow-none`}
          style={{ top: `${position.top}px`, right: `${position.right}px` }}
          onClick={(event) => event.stopPropagation()}
        >
          {optionList}
        </div>
      )}
    </div>
  );
}
