// 主面板浅色主题的强调色，拆成两份（都由平台品牌色与黑色混合压深得到）：
// - fill：实底、描边、淡底、光晕用；只压到白字落在它上面 ≥4.5:1，尽量贴近品牌色。
// - ink：强调色文字/图标用；压到落在最深的实际底色（柔灰底 + 26% fill）上 ≥4.5:1。

type Rgb = [number, number, number];

/** 平台未给品牌色时的默认色（也是无法解析时的回退）。 */
export const DEFAULT_BRAND = "rgb(100, 149, 237)";

/** 柔灰底（主面板浅色底色）。 */
const PANEL_LIGHT: Rgb = [0xee, 0xf1, 0xf6];
/**
 * 强调色文字下方叠加的强调色比例上限：顶部光晕最高 16% + 选中/开启态 /10 淡底，
 * 合计按 26% 估（偏保守）。
 */
export const TEXT_BACKDROP_ACCENT = 0.26;
const WHITE: Rgb = [255, 255, 255];
const MIN_CONTRAST = 4.5;

const CHANNEL = "(\\d{1,3})";
const RGB_COMMA = new RegExp(
  `^\\s*rgba?\\(\\s*${CHANNEL}\\s*,\\s*${CHANNEL}\\s*,\\s*${CHANNEL}\\s*(?:,[^)]*)?\\)\\s*$`,
  "i",
);
const RGB_SPACE = new RegExp(
  `^\\s*rgba?\\(\\s*${CHANNEL}\\s+${CHANNEL}\\s+${CHANNEL}\\s*(?:/[^)]*)?\\)\\s*$`,
  "i",
);

/** 解析 `rgb(r, g, b)` / `rgb(r g b)` / `#rrggbb` / `#rgb`（可带 alpha，忽略）；无法解析返回 null。 */
export function parseColor(color: string): Rgb | null {
  const rgb = color.match(RGB_COMMA) ?? color.match(RGB_SPACE);
  if (rgb) {
    const channels = rgb.slice(1, 4).map(Number) as Rgb;
    return channels.every((c) => c <= 255) ? channels : null;
  }
  const hex = color.match(/^\s*#([0-9a-f]{3}|[0-9a-f]{6})\s*$/i);
  if (hex) {
    const digits =
      hex[1].length === 3 ? hex[1].replace(/./g, (d) => d + d) : hex[1];
    const n = parseInt(digits, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return null;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 对比度。 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** 强调色文字所处的最深底色：柔灰底上叠 TEXT_BACKDROP_ACCENT 比例的 fill 强调色。 */
export function textBackdrop(accent: Rgb): Rgb {
  const t = TEXT_BACKDROP_ACCENT;
  return PANEL_LIGHT.map((c, i) =>
    Math.round(c * (1 - t) + accent[i] * t),
  ) as Rgb;
}

/** 按 2% 步长与黑色混合，直到满足 ok（最多压到纯黑）。 */
function darkenUntil(base: Rgb, ok: (c: Rgb) => boolean): Rgb {
  let out = base;
  for (let t = 0; !ok(out) && t < 1;) {
    t = Math.min(1, t + 0.02);
    out = base.map((c) => Math.round(c * (1 - t))) as Rgb;
  }
  return out;
}

const toCss = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;

let warnedFallback = false;

/**
 * 由品牌色得出 fill 与 ink 两份强调色（均为 `rgb(r, g, b)`）。
 * 无法解析的输入退回 DEFAULT_BRAND（首次回退时 console.warn）。
 */
export function readableAccent(color: string): { fill: string; ink: string } {
  let base = parseColor(color);
  if (!base) {
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn(
        `[IIROSE-MEDIA-WEB] 无法解析的平台品牌色 ${JSON.stringify(color)}，改用默认色 ${DEFAULT_BRAND}`,
      );
    }
    base = parseColor(DEFAULT_BRAND)!;
  }
  const fill = darkenUntil(
    base,
    (c) => contrastRatio(c, WHITE) >= MIN_CONTRAST,
  );
  const backdrop = textBackdrop(fill);
  const ink = darkenUntil(
    base,
    (c) => contrastRatio(c, backdrop) >= MIN_CONTRAST,
  );
  return { fill: toCss(fill), ink: toCss(ink) };
}
