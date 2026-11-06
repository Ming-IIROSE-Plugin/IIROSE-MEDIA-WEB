// 窗口模式的外框控件：标题栏（名称、关闭钮）和八个缩放抓取区。
// 只在窗口态渲染，几何与手势都在 `PanelWindowPlacement`；尺寸见 `app.css` 的窗口态规则。
import { dragHandleClass } from "../floating-panel/floatingPanel";
import {
  DeskIcon,
  deskFocusRing,
  deskInk2,
  deskPressTone,
  deskRail,
  deskRule,
  typeButtonSm,
} from "../floating-panel/tokens";
import { RESIZE_EDGES } from "./geometry";
import type { PanelWindowPlacement } from "./PanelWindowPlacement";

export interface PanelWindowChromeProps {
  placement: PanelWindowPlacement;
  onClose: () => void;
}

export function PanelWindowChrome({
  placement,
  onClose,
}: PanelWindowChromeProps) {
  return (
    <>
      <div
        data-imw-panel-titlebar="true"
        className={`absolute inset-x-0 top-0 flex h-[var(--imw-titlebar)] items-center rounded-t-[11px] border-b border-solid pl-3 ${deskRail} ${deskRule} ${deskInk2} ${dragHandleClass(false)} active:cursor-grabbing`}
        {...placement.moveHandle}
      >
        <span className={`min-w-0 flex-1 truncate ${typeButtonSm}`}>
          点歌台
        </span>
        {/* 压在角落的抓取区之上（粗指针下抓取区会伸进标题栏） */}
        <button
          type="button"
          aria-label="关闭窗口"
          className={`relative z-[21] flex h-full w-11 shrink-0 cursor-pointer items-center justify-center rounded-tr-[11px] border-0 bg-transparent p-0 text-inherit ${deskPressTone} ${deskFocusRing}`}
          onClick={onClose}
        >
          <DeskIcon name="close" size={18} />
        </button>
      </div>
      {RESIZE_EDGES.map((edge) => (
        <div
          key={edge}
          aria-hidden="true"
          data-imw-grip={edge}
          className="imw-panel-grip select-none"
          {...placement.resizeHandle(edge)}
        />
      ))}
    </>
  );
}
