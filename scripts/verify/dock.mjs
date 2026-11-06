// 真机验证：常驻胶囊的手感与外观。jsdom 没有版面，下面这些只能在真站量。
//
// 用法：先 `npm run build`，然后
//   node scripts/verify/dock.mjs
// 可选环境变量：IIROSE_PROFILE（持久化 profile，需已登录）、PLAYWRIGHT_CHROMIUM（浏览器路径）。
// 退出码 0 = 全部通过，1 = 有失败；每项检查都打印实测数。
//
// 检查项（全部用 getBoundingClientRect 量屏幕上的位置，读 style.left 看不出过渡造成的滞后）：
//   1. 跟手：贴边的胶囊被拉出时，每一步中心都在指针下（误差 ≤ 2px）
//   2. 贴边收起：靠右时只露出一小截；悬停后展开
//   3. 宿站侧栏：body 平移 275px 时，贴左的胶囊被层的左缘裁住，不压到侧栏上
//   4. 尺寸：桌面 38px 高、展开 87px 宽；手机 54px 高（和代码里的标称尺寸是同一份数）
//   5. 宿站主题：浅色 / 深色下胶囊底色分别是纸色 / 墨色
//   6. 手机尺寸下宿站侧栏打开：贴左的胶囊仍被层的左缘裁住
//
// 前置：测试账号已在持久化 profile 里登录并能进房（凭据在 .secrets/，不进脚本）。

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
const POSITION_KEY = "imwPanelDockPosition";
const PILL = "[data-imw-panel-dock]";

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail ?? ""}`);
};

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  executablePath: EXE,
  viewport: { width: 1400, height: 900 },
  locale: "zh-CN",
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
let frame;
try {
  await page.goto("https://iirose.com/", { waitUntil: "load" });
  for (let i = 0; i < 30 && !frame; i++) {
    frame = page.frames().find((f) => f.url().includes("messages.html"));
    if (!frame) await page.waitForTimeout(1000);
  }
  if (!frame) throw new Error("没找到 messages.html 框架");
  await page.waitForTimeout(7000);
  // 进房后点左上角返回，关掉房间公告，聊天输入框才可见
  await page.mouse.click(20, 20);
  await page.waitForTimeout(1500);

  const store = (value) =>
    frame.evaluate(
      ([key, v]) => localStorage.setItem(key, JSON.stringify(v)),
      [POSITION_KEY, value],
    );
  await store({ x: 0, y: 400, edge: "right" });

  const already = await frame.evaluate(
    () => document.querySelectorAll(".IIROSE_MEDIA_CONTAINER").length,
  );
  if (already) throw new Error("页面上已有插件实例：先 reload 再跑");
  await frame.evaluate((src) => {
    new Function(src)();
  }, BUNDLE);
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    const ok = frame.locator("#syncAlertHolder").getByText("确定", {
      exact: true,
    });
    if ((await ok.count()) && (await ok.first().isVisible())) {
      await ok.first().click();
      await page.waitForTimeout(500);
    }
  }
  await frame.evaluate(() => {
    document.getElementById("syncHolderOutside")?.remove();
    const holder = document.getElementById("syncHolder");
    if (holder) holder.style.display = "none";
  });

  const pillRect = () =>
    frame.evaluate((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        width: r.width,
        height: r.height,
        viewport: window.innerWidth,
      };
    }, PILL);
  // iframe 里的坐标换成页面坐标（宿站 iframe 有缩放和偏移）
  const toPage = async (x, y) => {
    const box = await (await frame.frameElement()).boundingBox();
    const scale = box.width / (await frame.evaluate(() => window.innerWidth));
    return { x: box.x + x * scale, y: box.y + y * scale, scale };
  };

  // ── 2. 贴边收起 ────────────────────────────────────────────
  await page.mouse.move(5, 5);
  await page.waitForTimeout(800);
  const rest = await pillRect();
  const visibleAtRest = rest.viewport - rest.left;
  check(
    "贴右边：只露出一小截",
    visibleAtRest > 0 && visibleAtRest < 60,
    `露出 ${visibleAtRest.toFixed(1)}px`,
  );
  const center = await toPage(rest.left + 12, rest.top + rest.height / 2);
  await page.mouse.move(center.x, center.y);
  await page.waitForTimeout(700);
  const hovered = await pillRect();
  const visibleHovered = hovered.viewport - hovered.left;
  check(
    "悬停后展开",
    Math.abs(visibleHovered - 87) <= 1,
    `露出 ${visibleHovered.toFixed(1)}px（标称宽 87）`,
  );
  check(
    "桌面尺寸：胶囊高度 38px",
    Math.abs(hovered.height - 38) <= 0.5,
    `${hovered.height}px`,
  );

  // ── 5. 宿站主题 ────────────────────────────────────────────
  const pillBackground = () =>
    frame.evaluate(
      (sel) => getComputedStyle(document.querySelector(sel)).backgroundColor,
      PILL,
    );
  const light = await pillBackground();
  check("浅色主题：胶囊是纸色", light === "rgb(251, 250, 247)", light);
  await frame.evaluate(() => {
    window.theme = "";
  });
  await page.waitForTimeout(900);
  const dark = await pillBackground();
  check("深色主题：胶囊是墨色", dark === "rgb(28, 26, 24)", dark);
  await frame.evaluate(() => {
    window.theme = "theme/";
  });
  await page.waitForTimeout(900);

  // ── 1. 跟手 ────────────────────────────────────────────────
  const start = await pillRect();
  const startCenterX = start.left + start.width / 2;
  const startCenterY = start.top + start.height / 2;
  const grab = await toPage(startCenterX, startCenterY);
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  let worst = 0;
  for (let i = 1; i <= 10; i++) {
    const dx = i * 45;
    await page.mouse.move(grab.x - dx * grab.scale, grab.y, { steps: 1 });
    // 等两帧：量的是真正画到屏幕上的位置
    const cx = await frame.evaluate(
      (sel) =>
        new Promise((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const r = document.querySelector(sel).getBoundingClientRect();
              resolve(r.left + r.width / 2);
            }),
          ),
        ),
      PILL,
    );
    worst = Math.max(worst, Math.abs(startCenterX - dx - cx));
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  check("拉出时胶囊 1:1 跟手", worst <= 2, `最大偏差 ${worst.toFixed(2)}px`);

  // ── 3. 宿站侧栏 ────────────────────────────────────────────
  await store({ x: 0, y: 400, edge: "left" });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(800);
  await frame.evaluate(() => {
    document.body.style.transform = "translateX(275px)";
  });
  await page.waitForTimeout(800);
  const side = await frame.evaluate((sel) => {
    const layer = document
      .querySelector("[data-imw-dock-layer]")
      .getBoundingClientRect();
    const pill = document.querySelector(sel).getBoundingClientRect();
    return { layerLeft: layer.left, pillRight: pill.right };
  }, PILL);
  const visibleBesideSidebar = side.pillRight - side.layerLeft;
  check(
    "侧栏打开：层贴在侧栏右缘",
    Math.abs(side.layerLeft - 275) <= 1,
    `层左缘 ${side.layerLeft.toFixed(1)}px`,
  );
  check(
    "侧栏打开：贴左的胶囊仍只露一小截",
    visibleBesideSidebar > 0 && visibleBesideSidebar < 60,
    `从层左缘算露出 ${visibleBesideSidebar.toFixed(1)}px`,
  );
  await frame.evaluate(() => {
    document.body.style.transform = "";
  });

  // ── 4. 手机尺寸 ────────────────────────────────────────────
  await store(null);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(1500);
  const phone = await pillRect();
  check(
    "手机尺寸：胶囊高度 54px",
    Math.abs(phone.height - 54) <= 0.5,
    `${phone.height}px`,
  );

  // ── 6. 手机尺寸下宿站侧栏 ──────────────────────────────────
  await store({ x: 0, y: 400, edge: "left" });
  await page.waitForTimeout(900);
  await frame.evaluate(() => {
    document.body.style.transform = "translateX(275px)";
  });
  await page.waitForTimeout(900);
  const phoneSide = await frame.evaluate((sel) => {
    const layer = document
      .querySelector("[data-imw-dock-layer]")
      .getBoundingClientRect();
    const pill = document.querySelector(sel).getBoundingClientRect();
    return { layerLeft: layer.left, pillRight: pill.right };
  }, PILL);
  const phoneVisible = phoneSide.pillRight - phoneSide.layerLeft;
  check(
    "手机侧栏打开：贴左的胶囊仍只露一小截",
    Math.abs(phoneSide.layerLeft - 275) <= 1 &&
      phoneVisible > 0 &&
      phoneVisible < 80,
    `层左缘 ${phoneSide.layerLeft.toFixed(1)}px，露出 ${phoneVisible.toFixed(1)}px`,
  );
  await frame.evaluate(() => {
    document.body.style.transform = "";
  });
} catch (error) {
  check("脚本运行", false, String(error).slice(0, 300));
} finally {
  try {
    await frame?.evaluate((key) => localStorage.removeItem(key), POSITION_KEY);
  } catch {
    // 页面已关闭
  }
  await ctx.close();
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
