import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { encode } from "uqr";
import { renderQRCodeDataUrl } from "./qrCode";

const QR_TEXT =
  "https://passport.bilibili.com/h5-app/passport/login/scan?navhide=1&qrcode_key=0123456789abcdef0123456789abcdef";

function decodeSvg(dataUrl: string): string {
  expect(dataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);
  return atob(dataUrl.slice("data:image/svg+xml;base64,".length));
}

/**
 * 把 data URL 里的 SVG 还原成像素再交给 jsQR 解码：
 * 只信我们实际输出的 SVG，而不是重新跑一遍 uqr 的矩阵。
 */
function decodeDataUrl(dataUrl: string): string | null {
  const svg = decodeSvg(dataUrl);
  const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  if (!box) return null;
  const size = Number(box[1]);
  const path = /<path fill="black" d="([^"]*)"/.exec(svg);
  if (!path) return null;

  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  const segments = path[1].match(/M(\d+),(\d+)h(\d+)v(\d+)h-\3z/g) ?? [];
  for (const segment of segments) {
    const [, xs, ys, ws, hs] =
      /M(\d+),(\d+)h(\d+)v(\d+)h-\d+z/.exec(segment) ?? [];
    for (let y = Number(ys); y < Number(ys) + Number(hs); y++) {
      for (let x = Number(xs); x < Number(xs) + Number(ws); x++) {
        const offset = (y * size + x) * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
      }
    }
  }
  return jsQR(pixels, size, size)?.data ?? null;
}

describe("renderQRCodeDataUrl", () => {
  it("根 svg 带固有宽高，不依赖浏览器默认尺寸", () => {
    const { size } = encode(QR_TEXT, { ecc: "M", border: 4 });
    const svg = decodeSvg(renderQRCodeDataUrl(QR_TEXT));
    expect(svg).toContain(`<svg width="${size * 4}" height="${size * 4}" `);
    expect(svg).toContain('<path fill="black"');
  });

  it("静区为 4 个模块，与旧 qrcode 默认值一致", () => {
    const bare = encode(QR_TEXT, { ecc: "M", border: 0 }).size;
    const svg = decodeSvg(renderQRCodeDataUrl(QR_TEXT));
    expect(svg).toContain(`<svg width="${(bare + 8) * 4}" `);
  });

  it("解码回原始 URL", () => {
    expect(decodeDataUrl(renderQRCodeDataUrl(QR_TEXT))).toBe(QR_TEXT);
  });

  it("不同文本产生不同矩阵", () => {
    expect(renderQRCodeDataUrl(QR_TEXT)).not.toBe(
      renderQRCodeDataUrl(QR_TEXT.replace("0123456789", "9876543210")),
    );
  });
});
