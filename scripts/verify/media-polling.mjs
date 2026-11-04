// 真机验证：媒体轮询的两种节奏（空闲 1s / 面板打开后 250ms）。
//
// 用法：先 `npm run build`，然后
//   node scripts/verify/media-polling.mjs
// 可选环境变量：IIROSE_PROFILE（持久化 profile）、PLAYWRIGHT_CHROMIUM（浏览器路径）。
//
// 判据：`idle` 里只有 1000；打开面板后 `opened.intervals` 里出现 250；
// 两个开关的 aria 状态可读（房间能力不同，disabled 可能是 true）。

import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);
const { chromium } = require("/usr/local/lib/node_modules/playwright");

const BUNDLE = readFileSync(
  fileURLToPath(new URL("../../dist/bundle.js", import.meta.url)),
  "utf8",
);
const EXE =
  process.env.PLAYWRIGHT_CHROMIUM ||
  "/root/.cache/ms-playwright/chromium-1247/chrome-linux64/chrome";
const PROFILE =
  process.env.IIROSE_PROFILE || "/root/.cache/iirose-verify-profile";

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  executablePath: EXE,
  viewport: { width: 1400, height: 900 },
  locale: "zh-CN",
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
try {
  await page.goto("https://iirose.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(4000);
  const frame = page.frames().find((f) => f.url().includes("messages.html"));

  // 记录插件创建的定时器间隔
  await frame.evaluate(() => {
    const w = window;
    w.__imwIntervals = [];
    const orig = w.setInterval.bind(w);
    w.setInterval = (fn, ms, ...args) => {
      w.__imwIntervals.push(ms);
      return orig(fn, ms, ...args);
    };
  });

  const injected = await frame.evaluate((src) => {
    if (document.querySelectorAll(".IIROSE_MEDIA_CONTAINER").length)
      return "already";
    try {
      new Function(src)();
      return "ok";
    } catch (e) {
      return "ERR " + e.message;
    }
  }, BUNDLE);
  await frame.waitForTimeout(2500);
  const idle = await frame.evaluate(() => [...new Set(window.__imwIntervals)]);

  await frame.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", altKey: true, bubbles: true }),
    ),
  );
  await frame.waitForTimeout(1500);
  const opened = await frame.evaluate(() => {
    const el = document.getElementById("IIROSE_MEDIA_CONTAINER");
    const buttons = [
      ...document.querySelectorAll("#imw-playback-controls button"),
    ].map((b) => ({
      label: b.getAttribute("aria-label"),
      disabled: b.getAttribute("aria-disabled"),
      pressed: b.getAttribute("aria-pressed"),
    }));
    return {
      panel: !!el,
      open: el ? getComputedStyle(el).transform : null,
      intervals: [...new Set(window.__imwIntervals)],
      controls: buttons,
    };
  });

  const ok = idle.includes(1000) && opened.intervals.includes(250);
  console.log(JSON.stringify({ injected, idle, opened, ok }, null, 1));
  if (!ok) process.exitCode = 1;
} catch (e) {
  console.log("FATAL", e.message);
  process.exitCode = 1;
} finally {
  await ctx.close();
}
