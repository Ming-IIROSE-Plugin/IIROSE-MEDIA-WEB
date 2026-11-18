// npm run build && node scripts/verify/bilibili-live.mjs [主播名]
// 使用已登录的 Playwright profile。测试会在当前视频分享房实际发送一条点播。
// 可通过 IIROSE_VERIFY_PROFILE、IIROSE_VERIFY_CHROMIUM、IIROSE_VERIFY_ROOM 选择测试环境。
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire("/usr/local/lib/node_modules/");
const { chromium } = require("playwright");
const ROOT = join(import.meta.dirname, "..", "..");
const keyword = process.argv[2] || "舍长驾到";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const msgFrame = (page) =>
  page.frames().find((frame) => frame.url().includes("messages.html"));

/** 登录态由本机 profile 记忆；首次运行需要人工登录一次。 */
async function open(viewport) {
  const ctx = await chromium.launchPersistentContext(
    process.env.IIROSE_VERIFY_PROFILE || "/root/.cache/iirose-verify-profile",
    {
      headless: true,
      executablePath: process.env.IIROSE_VERIFY_CHROMIUM,
      viewport,
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  );
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    // The CDN can mark a live playlist cacheable for five minutes. Run the
    // acceptance check with a cold HTTP cache so old room media cannot reuse it.
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await page.goto("https://iirose.com/", { waitUntil: "load" });
    await sleep(7000);
    const frame = msgFrame(page);
    if (!frame) throw new Error("未找到 IIROSE 聊天页面，请先登录验证 profile");
    if (!(await frame.evaluate(() => window.mediaShareRoom))) {
      await frame
        .getByText(process.env.IIROSE_VERIFY_ROOM || "练歌房", { exact: true })
        .first()
        .click({ timeout: 5000 });
      await frame
        .getByText("进入", { exact: true })
        .first()
        .click({ timeout: 6000 });
      await sleep(5500);
      await frame
        .locator("body")
        .click({ position: { x: 20, y: 20 } })
        .catch(() => {});
    }
    const already = await frame.evaluate(
      () => document.querySelectorAll(".IIROSE_MEDIA_CONTAINER").length,
    );
    if (already !== 0) throw new Error("页面里已有插件实例，先 reload 再注入");
    const injected = await frame.evaluate(
      (src) => {
        try {
          new Function(src)();
          return "ok";
        } catch (error) {
          return `ERR ${error.message}`;
        }
      },
      readFileSync(join(ROOT, "dist/bundle.js"), "utf8"),
    );
    if (injected !== "ok") throw new Error(injected);
    await sleep(2500);
    // 首启的用户协议 / 隐私政策弹窗
    for (let i = 0; i < 4; i += 1) {
      const clicked = await frame.evaluate(() => {
        const holder = document.getElementById("syncAlertHolder");
        const button =
          holder &&
          [...holder.querySelectorAll("*")].find(
            (el) =>
              el.textContent.trim() === "确定" && el.children.length === 0,
          );
        button?.click();
        return !!button;
      });
      if (!clicked) break;
      await sleep(800);
    }
    await frame.evaluate(() => {
      document.getElementById("syncHolderOutside")?.remove();
      const holder = document.getElementById("syncHolder");
      if (holder) holder.style.display = "none";
    });
    return { ctx, frame };
  } catch (error) {
    await ctx.close();
    throw error;
  }
}

const { ctx, frame } = await open({ width: 1280, height: 850 });
try {
  await frame.evaluate(() => {
    window.__liveTest = [];
    const orig = socket.send.bind(socket);
    socket.send = (d, ...args) => {
      if (typeof d === "string" && d.startsWith("&1")) {
        window.__liveTest.push(d);
      }
      return orig(d, ...args);
    };
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", altKey: true, bubbles: true }),
    );
  });
  const panel = frame.locator(".IIROSE_MEDIA_CONTAINER");
  await panel
    .getByText("视频", { exact: true })
    .first()
    .click({ timeout: 5000 });
  await panel.getByRole("tab", { name: "直播" }).click({ timeout: 5000 });
  const input = panel.locator("input").first();
  await input.fill(keyword);
  await input.press("Enter");
  const row = panel
    .locator("[data-imw-tracklist-row], [data-imw-tile]")
    .filter({ hasText: keyword })
    .first();
  await row
    .getByRole("button", { name: /点播/ })
    .first()
    .click({ timeout: 14000 });
  const summary = await frame.evaluate(async () => {
    const start = Date.now();
    while (
      Date.now() - start < 10000 &&
      !window.__liveTest.some((x) => x.startsWith("&1"))
    )
      await new Promise((r) => setTimeout(r, 200));
    const event = window.__liveTest.find((x) => x.startsWith("&1"));
    const data = event && JSON.parse(event.slice(2));
    return {
      hasEvent: !!event,
      title: data?.n,
      duration: data?.d,
      protocol: data?.b,
      hls: data?.s?.includes(".m3u8"),
    };
  });
  console.log(summary);
  const sample = () =>
    frame.evaluate(() =>
      [...document.querySelectorAll("video")].map((v) => ({
        time: v.currentTime,
        width: v.videoWidth,
        ready: v.readyState,
        paused: v.paused,
        frames: v.getVideoPlaybackQuality().totalVideoFrames,
      })),
    );
  await frame.waitForFunction(
    () =>
      [...document.querySelectorAll("video")].some(
        (v) =>
          v.videoWidth > 0 &&
          !v.paused &&
          v.getVideoPlaybackQuality().totalVideoFrames > 0,
      ),
    undefined,
    { timeout: 18000 },
  );
  const before = await sample();
  let after = before;
  const advanced = () =>
    after.some(
      (video, index) =>
        video.width > 0 &&
        before[index] &&
        video.time > before[index].time &&
        video.frames > before[index].frames,
    );
  const deadline = Date.now() + 18000;
  while (!advanced() && Date.now() < deadline) {
    await sleep(500);
    after = await sample();
  }
  const chat = await frame.evaluate(
    (title) =>
      [...document.querySelectorAll(".msgholderBox")].some((el) =>
        el.textContent.includes(title),
      ),
    summary.title,
  );
  console.log({ before, after, chat });
  if (!summary.hls || !chat || !advanced()) process.exitCode = 1;
} finally {
  await ctx.close();
}
