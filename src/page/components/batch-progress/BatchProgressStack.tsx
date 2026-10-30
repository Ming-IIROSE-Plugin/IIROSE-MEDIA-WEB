// 批量点播进度浮窗（整张正序 / 乱序、选集多选）：挂在 body 上，关掉点播面板也还在。
// 每次批量一张卡：「正在点播《…》」+ 细进度条 + `已发 / 总数`，进行中可「停止」，
// 结束后显示结果并在几秒后淡出（也可点 × 立即关掉）。
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  dismissBatch,
  getBatches,
  stopBatch,
  subscribeBatches,
  type BatchRun,
} from "../../../playback/BatchProgress";
import { hostIsDark } from "../../../iirose_func/HostTheme";
import { stopHostGestures, themeAttr } from "../floating-panel/floatingPanel";
import {
  DeskIcon,
  deskFocusRing,
  deskInk,
  deskInk2,
  deskInk3,
  deskMenuShadow,
  deskMutedFill,
  deskPress,
  deskPressTone,
  deskRoseFill,
  deskRule,
  deskRuleFill,
  deskSheet,
  roundedMd,
  roundedXl,
  typeButtonSm,
  typeLabelStrong,
  typeMonoNumSm,
} from "../floating-panel/tokens";

export const BATCH_PROGRESS_ROOT_ID = "imw-batch-progress-root";

function headline(run: BatchRun): string {
  switch (run.status) {
    case "preparing":
      return `正在准备《${run.title}》`;
    case "running":
      return `正在点播《${run.title}》`;
    case "stopped":
      return `已停止《${run.title}》`;
    default:
      return `已点播完《${run.title}》`;
  }
}

function BatchCard({ run }: { run: BatchRun }) {
  const active = run.status === "preparing" || run.status === "running";
  const ratio = run.total > 0 ? Math.min(run.done / run.total, 1) : 0;
  return (
    <div
      data-imw-batch-card="true"
      data-imw-theme={themeAttr(hostIsDark())}
      className={`pointer-events-auto w-[320px] border border-solid px-4 pt-3 pb-3.5 ${roundedXl} ${deskRule} ${deskSheet} ${deskInk} ${deskMenuShadow} animate-[imwRiseIn_200ms_var(--imw-ease)] transition-[opacity,translate] duration-200 motion-reduce:animate-none max-[768px]:w-full ${run.leaving ? "translate-y-2 opacity-0" : ""}`}
      {...stopHostGestures}
    >
      <div className="flex items-center gap-2">
        <span className={`shrink-0 ${active ? deskInk2 : deskInk3}`}>
          <DeskIcon name={run.status === "done" ? "check" : "send"} size={16} />
        </span>
        <span
          className={`min-w-0 flex-1 truncate ${typeLabelStrong}`}
          title={headline(run)}
        >
          {headline(run)}
        </span>
        {active ? (
          <button
            type="button"
            className={`flex h-7 shrink-0 cursor-pointer items-center gap-1 border border-solid bg-transparent px-2.5 ${roundedMd} ${deskRule} ${deskInk2} ${typeButtonSm} ${deskPressTone} ${deskPress} ${deskFocusRing}`}
            onClick={() => stopBatch(run.id)}
          >
            停止
          </button>
        ) : (
          <button
            type="button"
            aria-label="关闭"
            className={`grid h-7 w-7 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 ${roundedMd} ${deskInk3} ${deskPressTone} ${deskPress} ${deskFocusRing}`}
            onClick={() => dismissBatch(run.id)}
          >
            <DeskIcon name="close" size={14} />
          </button>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={`《${run.title}》点播进度`}
          aria-valuemin={0}
          aria-valuemax={run.total}
          aria-valuenow={run.done}
          className={`relative h-1 min-w-0 flex-1 overflow-hidden rounded-full ${deskRuleFill}`}
        >
          {run.status === "preparing" ? (
            // 还在取歌单 / 曲目详情：不确定进度，来回流动
            <span
              className={`absolute inset-y-0 left-0 w-1/3 rounded-full ${deskRoseFill} animate-[imwIndeterminate_1.2s_ease-in-out_infinite] motion-reduce:animate-none`}
            />
          ) : (
            <span
              className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-[var(--imw-ease)] ${run.status === "stopped" ? deskMutedFill : deskRoseFill}`}
              style={{ width: `${ratio * 100}%` }}
            />
          )}
        </div>
        <span className={`shrink-0 ${typeMonoNumSm} ${deskInk2}`}>
          {run.done} / {run.total}
        </span>
      </div>
    </div>
  );
}

export function BatchProgressStack() {
  const [runs, setRuns] = useState(getBatches);
  useEffect(() => subscribeBatches(() => setRuns(getBatches())), []);
  if (runs.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-6 bottom-[80px] z-[90008] flex flex-col items-end gap-2 max-[768px]:inset-x-3 max-[768px]:bottom-[84px]"
    >
      {runs.map((run) => (
        <BatchCard key={run.id} run={run} />
      ))}
    </div>
  );
}

/** 挂到 body（宿站主容器与插件面板都会平移，独立挂载才不跟着走）。 */
export function mountBatchProgress(): () => void {
  releaseBatchProgress();
  const root = document.createElement("div");
  root.id = BATCH_PROGRESS_ROOT_ID;
  document.body.appendChild(root);
  render(<BatchProgressStack />, root);
  return () => {
    render(null, root);
    root.remove();
  };
}

export function releaseBatchProgress(): void {
  for (const node of document.querySelectorAll(`#${BATCH_PROGRESS_ROOT_ID}`))
    node.remove();
}
