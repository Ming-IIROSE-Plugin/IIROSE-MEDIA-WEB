// 结果区真站验收（DW-4 / DW-14 的可重放脚本）：
// 登录 iirose.com → 进房间 → 注入 dist/bundle.js → 桌面（1280×720、浅 / 深）与手机（390×844）
// 逐项读几何与交互，最后打印 JSON。硬性违规（横向溢出、44px 目标、悬停无反馈）非零退出。
//
// 用法：npm run build && node scripts/verify/results-area-acceptance.mjs
// 依赖：全局 playwright（NODE_PATH=/usr/local/lib/node_modules）与 .secrets/iirose-test-account.txt
// 证据：把输出贴进 docs/reports/<日期>-results-area-acceptance.md
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire("/usr/local/lib/node_modules/");
const { chromium } = require("playwright");
const ROOT = join(import.meta.dirname, "..", "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function creds() {
  const text = readFileSync(`${ROOT}/.secrets/iirose-test-account.txt`, "utf8");
  const get = (key) =>
    (text.match(new RegExp(`^${key}\\s*[:：=]\\s*(.+)$`, "m")) ||
      [])[1]?.trim();
  return { user: get("用户名"), pass: get("密码") };
}

const msgFrame = (page) =>
  page.frames().find((frame) => frame.url().includes("messages.html"));

/** 登录态由本机 profile 记忆；首次运行需要人工登录一次。 */
async function open(viewport) {
  const ctx = await chromium.launchPersistentContext(
    "/root/.cache/iirose-verify-profile",
    {
      headless: true,
      executablePath:
        "/root/.cache/ms-playwright/chromium-1247/chrome-linux64/chrome",
      viewport,
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  );
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto("https://iirose.com/", { waitUntil: "load" });
  await sleep(7000);
  let frame = msgFrame(page);
  if (!(await frame.evaluate(() => window.mediaShareRoom))) {
    // 不在房间里就进热推第一个房间（点播必须有房间）
    await frame.locator("text=Harborage").first().click({ timeout: 5000 });
    await sleep(2000);
    await frame
      .locator("text=进入")
      .first()
      .click({ timeout: 5000 })
      .catch(() => {});
    await sleep(8000);
    frame = msgFrame(page);
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
  await sleep(2500);
  // 首启的用户协议 / 隐私政策弹窗
  for (let i = 0; i < 4; i += 1) {
    const clicked = await frame.evaluate(() => {
      const holder = document.getElementById("syncAlertHolder");
      const button =
        holder &&
        [...holder.querySelectorAll("*")].find(
          (el) => el.textContent.trim() === "确定" && el.children.length === 0,
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
  return { ctx, page, frame, injected };
}

const openPanel = async (frame) => {
  await frame.evaluate(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", altKey: true, bubbles: true }),
    ),
  );
  await sleep(1500);
};

const search = async (frame, keyword) => {
  const input = frame.locator(".IIROSE_MEDIA_CONTAINER input").first();
  await input.click();
  await input.type(keyword);
  await input.press("Enter");
  for (let i = 0; i < 12; i += 1) {
    const ready = await frame.evaluate(
      () =>
        document.querySelectorAll("[data-imw-tile], [data-imw-tracklist-row]")
          .length > 0,
    );
    if (ready) return true;
    await sleep(2500);
  }
  return false;
};

const geometry = (frame, view) =>
  frame.evaluate((want) => {
    const row = document.querySelector("[data-imw-tracklist-row]");
    const head = document.querySelector("[data-imw-tracklist-header]");
    const tile = document.querySelector("[data-imw-tile]");
    const panel = document.querySelector(".IIROSE_MEDIA_CONTAINER");
    const box = (el) => (el ? el.getBoundingClientRect() : null);
    return {
      view: want,
      theme: panel?.getAttribute("data-imw-theme"),
      panelW: panel?.clientWidth,
      docOverflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      rowH: row ? Math.round(box(row).height) : null,
      headH: head ? Math.round(box(head).height) : null,
      rowCols: row
        ? [...row.children].map((child) => Math.round(box(child).width))
        : null,
      tile: tile
        ? { w: Math.round(box(tile).width), h: Math.round(box(tile).height) }
        : null,
    };
  }, view);

const smallTargets = (frame) =>
  frame.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll(
      ".IIROSE_MEDIA_CONTAINER button, .IIROSE_MEDIA_CONTAINER [role=tab], .IIROSE_MEDIA_CONTAINER [role=radio]",
    )) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // 收藏星 / 点播钮用负 inset 的 ::after 扩到 44px，量命中区而不是视觉框
      const inset = Math.abs(
        parseFloat(getComputedStyle(el, "::after").inset) || 0,
      );
      if (rect.width + inset * 2 >= 43.5 && rect.height + inset * 2 >= 43.5)
        continue;
      bad.push({
        label:
          el.getAttribute("aria-label") || el.textContent.trim().slice(0, 10),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    }
    return bad;
  });

const report = { violations: [] };
try {
  const desktop = await open({ width: 1280, height: 720 });
  report.injected = desktop.injected;
  await desktop.frame.evaluate(() => {
    window.theme = "light";
  });
  await openPanel(desktop.frame);
  report.found = await search(desktop.frame, "陈绮贞");

  const root = desktop.frame.locator(".IIROSE_MEDIA_CONTAINER");
  await root.locator('[role="radio"][aria-label="列表"]').first().click();
  await sleep(1200);
  report.list = await geometry(desktop.frame, "list");

  const row = root.locator("[data-imw-tracklist-row]").first();
  if (await row.count()) {
    const before = await row.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await row.hover();
    await sleep(320);
    const hover = await row.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await desktop.page.mouse.move(2, 2);
    const play = row.locator("button").last();
    await play.focus();
    await sleep(250);
    report.interaction = {
      changed: before !== hover,
      focusWithin: await row.evaluate((el) => el.matches(":focus-within")),
    };
    if (before === hover) report.violations.push("悬停无底色反馈");
    if (!report.interaction.focusWithin)
      report.violations.push("行内按钮聚焦时没有 focus-within");
  }

  await root.locator('[role="radio"][aria-label="网格"]').first().click();
  await sleep(1200);
  report.grid = await geometry(desktop.frame, "grid");
  report.nowPlaying = await desktop.frame.evaluate(() => {
    const el = document.getElementById("shareMediaSongName");
    return el ? el.textContent.trim() : null;
  });
  await desktop.page.screenshot({
    path: "/tmp/iirose-verify/results-area-desktop.png",
  });
  await desktop.ctx.close();

  const phone = await open({ width: 390, height: 844 });
  await openPanel(phone.frame);
  await search(phone.frame, "周杰伦");
  report.phone = await geometry(phone.frame, "phone");
  report.phoneSmall = await smallTargets(phone.frame);
  await phone.page.screenshot({
    path: "/tmp/iirose-verify/results-area-phone.png",
  });
  await phone.ctx.close();
} catch (error) {
  report.error = String(error).split("\n")[0];
}

for (const view of [report.list, report.grid, report.phone]) {
  if (!view) continue;
  if (view.docOverflowX > 0) report.violations.push(`${view.view} 横向溢出`);
  if (view.panelW && view.panelW < 300)
    report.violations.push(`${view.view} 面板宽度异常`);
}
if (report.phoneSmall?.length) report.violations.push("手机可点区 < 44px");
if (report.error) report.violations.push(report.error);

console.log(JSON.stringify(report, null, 2));
process.exitCode = report.violations.length ? 1 : 0;
