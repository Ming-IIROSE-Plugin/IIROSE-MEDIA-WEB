import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";

/**
 * 产物体积上限，与 `_bmad-output/specs/*` 里的 CAP 保持一致。
 * 改阈值前先确认 SPEC 也改了，不要在这里维护第二套数字。
 */
// 用十进制 kB（与 vite 构建报表同口径），不要用 1024 进制，否则两处数字对不上。
export const LIMITS = { size: 450_000, gzip: 134_000 };

/** 纯判定，便于在测试里覆盖边界。 */
export function evaluate({ size, gzip }, limits = LIMITS) {
  const problems = [];
  if (size > limits.size)
    problems.push(
      `bundle ${(size / 1024).toFixed(2)}kB > ${limits.size / 1024}kB`,
    );
  if (gzip > limits.gzip)
    problems.push(
      `gzip ${(gzip / 1024).toFixed(2)}kB > ${limits.gzip / 1024}kB`,
    );
  return { ok: problems.length === 0, problems };
}

function main(file) {
  const bytes = readFileSync(file);
  const gzip = gzipSync(bytes, { level: 9 }).length;
  const { ok, problems } = evaluate({ size: bytes.length, gzip });
  const report = `bundle ${(bytes.length / 1000).toFixed(2)}kB / gzip ${(gzip / 1000).toFixed(2)}kB（上限 ${LIMITS.size / 1000} / ${LIMITS.gzip / 1000}）`;
  if (ok) {
    console.log(report);
    return;
  }
  console.error(report);
  for (const problem of problems) console.error(`超限：${problem}`);
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv[2] ?? "dist/bundle.js");
}
