// 「房间正在播放」的唯一数据来源：宿站只在 DOM 暴露当前媒体标题（`#shareMediaSongName`），
// 没有 URL。结果区自建只读订阅（1s 轮询），不复用 `HostMediaBridge`——后者会给宿站
// shareMedia / seekDemandMedia 挂钩子，结果区不该成为第二个控制观察者。

const POLL_MS = 1000;

let timer: number | null = null;
const listeners = new Set<(title: string) => void>();

function readTitle(): string {
  return (
    document.getElementById("shareMediaSongName")?.textContent?.trim() || ""
  );
}

function emit() {
  const title = readTitle();
  for (const listener of listeners) listener(title);
}

/**
 * 订阅当前媒体标题；只在有人订阅时轮询，返回取消函数。
 * 第一次调用立即回读一次，面板打开时不必等满一个周期。
 */
export function subscribeNowPlayingTitle(
  listener: (title: string) => void,
): () => void {
  listeners.add(listener);
  listener(readTitle());
  if (timer === null) {
    timer = window.setInterval(emit, POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

/** 该条目是否就是房间正在放的那首（标题重复会一起高亮，可接受）。 */
export function isNowPlayingTitle(
  title: string,
  platformData: PlatformData,
): boolean {
  const current = title.trim();
  const own = platformData.title?.trim();
  return !!current && !!own && current === own;
}
