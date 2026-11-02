import { encode, renderSVG } from "uqr";

/** 与旧 `qrcode.toDataURL` 默认值对齐：纠错 M、静区 4 模块、每模块 4px。 */
const ECC = "M";
const BORDER = 4;
const PIXEL_SIZE = 4;

/**
 * 生成宿站 `window.showImg` 可直接使用的二维码 data URL。
 *
 * 宿站直接把字符串塞进 `img[src]`，SVG 必须带固有宽高，否则会按浏览器默认
 * 尺寸显示；`encode` 只算矩阵，用来拿到含静区的模块数，避免解析 SVG 字符串。
 */
export function renderQRCodeDataUrl(text: string): string {
  const { size } = encode(text, { ecc: ECC, border: BORDER });
  const svg = renderSVG(text, {
    ecc: ECC,
    border: BORDER,
    pixelSize: PIXEL_SIZE,
  });
  // uqr 的输出形态是这里唯一的外部假设：变了就让登录失败得明显一点，
  // 不要默默返回一张会按浏览器默认尺寸拉伸的图。
  const marker = "<svg ";
  if (!svg.includes(marker)) {
    throw new Error("二维码生成失败：uqr 输出了无法识别的 SVG");
  }
  const pixels = size * PIXEL_SIZE;
  const sized = svg.replace(
    marker,
    `<svg width="${pixels}" height="${pixels}" `,
  );
  const bytes = new TextEncoder().encode(sized);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
