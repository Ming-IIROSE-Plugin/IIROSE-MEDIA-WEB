// 面板内轻提示条：点播守卫的「已点播《…》」「刚刚点过了」。
// 浮在结果区底边（底部条 / 迷你条之上），约 2 秒后淡出；新提示直接替换旧的。
// 宿站提示条在面板打开时容易被盖住，面板里要有自己的反馈。
import { useEffect, useState } from "preact/hooks";
import {
  subscribeRequestToast,
  type RequestToast,
} from "../../../playback/RequestGuard";
import {
  deskInkSurface,
  deskPaperText,
  deskToastShadow,
  typeLabel,
} from "../floating-panel/tokens";

const SHOW_MS = 2_000;

export function DeskToast() {
  const [toast, setToast] = useState<RequestToast | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeRequestToast((next) => setToast(next)), []);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const hide = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(hide);
  }, [toast]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4"
    >
      {toast && (
        <div
          key={toast.id}
          className={`max-w-full truncate rounded-full px-4 py-2 ${deskToastShadow} ${deskInkSurface} ${deskPaperText} ${typeLabel} transition-[opacity,transform] duration-200! ease-out motion-reduce:transition-opacity ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"} animate-[imwToastIn_200ms_ease-out] motion-reduce:animate-none`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
