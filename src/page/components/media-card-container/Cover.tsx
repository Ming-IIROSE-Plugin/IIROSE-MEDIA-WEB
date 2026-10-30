// 封面 / 缩略图：`http://`→`https://` 安全升级、加载失败回退 thumb 底 + 自包含图标、
// `object-cover` 裁切填满并挂内环（DESIGN.md `video-tile` / `tracklist-row`）。
// 异步封面（收藏恢复等）在落地前只画 thumb 底块，不先闪一个图标再跳成图片。
import { useEffect, useState } from "preact/hooks";
import {
  DeskIcon,
  type DeskIconName,
  deskCoverRing,
  deskFocusRing,
  deskInk2,
  deskThumb,
  roundedXs,
} from "../floating-panel/tokens";

/** 宿站是 HTTPS 上下文：第三方 `http://` 封面会被 Mixed Content 拦成破图。 */
export function upgradeCoverUrl(url: string): string {
  return url.replace(/^http:\/\//, "https://");
}

export interface CoverProps {
  src: string | Promise<string>;
  /** 加载失败时的占位图标（音乐 note、视频 film、电台 radio）。 */
  icon?: DeskIconName;
  /** 尺寸与盒模型（宽高、aspect 等）由使用处给。 */
  className?: string;
  /** 圆角令牌（默认曲目表封面的 xs）。 */
  rounded?: string;
  alt?: string;
  /** 点击封面打开来源页（曲目行 / 专辑行的既有能力）。 */
  onOpen?: () => void;
  /** 封面按钮的动作名（默认「打开来源页」；专辑 / 歌单行是「查看」）。 */
  openLabel?: string;
}

export function Cover({
  src,
  icon = "note",
  className = "",
  rounded = roundedXs,
  alt = "",
  onOpen,
  openLabel = "打开来源页",
}: CoverProps) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  /** 封面地址已定（字符串封面，或 Promise 已落地）。落地前的空地址不是「没有封面」。 */
  const [settled, setSettled] = useState(typeof src === "string");

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (typeof src === "string") {
      setUrl(src);
      setSettled(true);
      return () => {
        alive = false;
      };
    }
    setUrl("");
    setSettled(false);
    src.then(
      (value) => {
        if (!alive) return;
        setUrl(value || "");
        setSettled(true);
      },
      () => {
        if (!alive) return;
        setUrl("");
        setSettled(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [src]);

  const showImage = !!url && !failed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${rounded} ${deskThumb} ${deskCoverRing} ${className}`}
    >
      {showImage ? (
        <img
          src={upgradeCoverUrl(url)}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-cover object-center"
          onError={() => setFailed(true)}
        />
      ) : settled ? (
        <div
          className={`grid h-full w-full place-items-center ${deskInk2}`}
          data-imw-cover-fallback="true"
        >
          <DeskIcon name={icon} size={20} />
        </div>
      ) : (
        <div
          className="h-full w-full"
          aria-hidden="true"
          data-imw-cover-pending="true"
        />
      )}
      {onOpen && (
        <button
          type="button"
          aria-label={alt ? `${openLabel}：${alt}` : openLabel}
          title={openLabel}
          className={`absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent p-0 ${deskFocusRing}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        />
      )}
    </div>
  );
}
