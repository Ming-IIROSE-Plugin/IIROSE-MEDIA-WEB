// 封面 / 缩略图：`http://`→`https://` 安全升级、加载失败回退 thumb 底 + 自包含图标、
// `object-cover` 裁切填满并挂内环（DESIGN.md `video-tile` / `tracklist-row`）。
import { useEffect, useState } from "preact/hooks";
import {
  DeskIcon,
  type DeskIconName,
  deskCoverRing,
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
}

export function Cover({
  src,
  icon = "note",
  className = "",
  rounded = roundedXs,
  alt = "",
  onOpen,
}: CoverProps) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (typeof src === "string") {
      setUrl(src);
      return () => {
        alive = false;
      };
    }
    setUrl("");
    src.then(
      (value) => {
        if (alive) setUrl(value || "");
      },
      () => {
        if (alive) setUrl("");
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
          className="block h-full w-full object-cover object-center"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className={`grid h-full w-full place-items-center ${deskInk2}`}
          data-imw-cover-fallback="true"
        >
          <DeskIcon name={icon} size={20} />
        </div>
      )}
      {onOpen && (
        <button
          type="button"
          aria-label="打开来源页"
          title="打开来源页"
          className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent p-0"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        />
      )}
    </div>
  );
}
