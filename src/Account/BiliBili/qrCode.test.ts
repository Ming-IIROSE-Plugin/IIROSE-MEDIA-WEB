import { describe, expect, it } from "vitest";
import { encode } from "uqr";
import { renderQRCodeDataUrl } from "./qrCode";

const QR_TEXT =
  "https://passport.bilibili.com/h5-app/passport/login/scan?navhide=1&qrcode_key=0123456789abcdef0123456789abcdef";

function decodeSvg(dataUrl: string): string {
  expect(dataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);
  return atob(dataUrl.slice("data:image/svg+xml;base64,".length));
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

  it("不同文本产生不同矩阵", () => {
    expect(renderQRCodeDataUrl(QR_TEXT)).not.toBe(
      renderQRCodeDataUrl(QR_TEXT.replace("0123456789", "9876543210")),
    );
  });
});
