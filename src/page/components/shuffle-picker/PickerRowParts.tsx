// 收藏随机面板的行内零件：三态勾选框与封面（https 升级 + 失败回退图标）。
import { useState } from "preact/hooks";
import type { FavoriteRecord } from "../../../storage/FavoritesStorageService";
import type { RowCheck } from "./pickerModel";
import { focusRing, Svg } from "../floating-panel/floatingPanel";
import {
  deskInk2,
  deskInk3Border,
  deskOnRose,
  deskRoseSolid,
  deskRoseSolidBorder,
  deskThumb,
} from "../floating-panel/tokens";
import { NoteIcon, VideoIcon } from "./pickerChrome";

export function Checkbox({
  check,
  disabled,
  label,
  onToggle,
}: {
  check: RowCheck;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  const on = check !== "none";
  return (
    <span
      role="checkbox"
      aria-checked={
        check === "all" ? "true" : check === "partial" ? "mixed" : "false"
      }
      aria-disabled={disabled ? "true" : undefined}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${focusRing} ${disabled ? "cursor-not-allowed opacity-35" : "cursor-pointer"}`}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onToggle();
      }}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 border-solid ${on ? `${deskRoseSolidBorder} ${deskRoseSolid} ${deskOnRose}` : `${deskInk3Border} bg-transparent`}`}
      >
        {check === "all" && (
          <Svg size={14} strokeWidth={3}>
            <path d="m5 12 5 5 9-10" />
          </Svg>
        )}
        {check === "partial" && (
          <Svg size={14} strokeWidth={3}>
            <path d="M6 12h12" />
          </Svg>
        )}
      </span>
    </span>
  );
}

export function Cover({ record }: { record: FavoriteRecord }) {
  const [failed, setFailed] = useState(false);
  const src = (record.coverImg || "").replace(/^http:\/\//, "https://");
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${deskThumb} ${deskInk2}`}
    >
      {src && !failed ? (
        <img
          className="block h-full w-full object-cover"
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : record.type === "video" ? (
        <VideoIcon />
      ) : (
        <NoteIcon />
      )}
    </span>
  );
}
