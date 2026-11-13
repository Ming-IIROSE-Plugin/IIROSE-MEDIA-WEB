// 真机验证：设置「点歌台入口」四档，手机尺寸下模拟双指下滑开合，看胶囊在不在。
//
// 用法：先 `npm run build`，然后
//   node scripts/verify/entry.mjs
// 可选环境变量：IIROSE_PROFILE（持久化 profile，需已登录）、PLAYWRIGHT_CHROMIUM（浏览器路径）。
// 退出码 0 = 全部通过，1 = 有失败。
//
// 检查项（390×844、触屏，双指下滑用 CDP 发真实触摸事件）：
//   1. 默认（胶囊 + 双指下滑）：胶囊在；关着双指下滑打开，开着双指下滑收起
//   2. 从设置页选「胶囊 + 双指下滑只收起」：行文案和存档都变；开着能收起，关着没反应
//   3. 选「只用胶囊」：开、关都没反应；Alt+S 收起后胶囊在，点胶囊打开
//   4. 选「只用双指下滑」：收起后没有胶囊；双指下滑能开能关
//   5. 刷新后档位保持
// 然后换成桌面 1600×900、没有触屏（另开一次浏览器）：
//   6. 选择框只有「显示胶囊」「隐藏胶囊（Alt+S / @词 打开）」两项
//   7. 选「隐藏胶囊」：胶囊卸下；Alt+S 收起后没有胶囊，再按能打开
//   8. 选「显示胶囊」：原来隐藏的回到默认档，收起后胶囊在
// 桌面一开始存成「只用胶囊」：有胶囊的档在电脑上都说成「显示胶囊」。
// 档位都从面板里的设置页选（经宿站选择框），不刷新就要生效；结束时还原默认档。
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
const SETTINGS_KEY = "imwPluginSetting";
const PILL = "[data-imw-panel-dock]";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let ctx, page, cdp, frame;
/** 持久化 profile 同时只能开一个浏览器：换设备前先关上一个。 */
async function launch(device) {
  await ctx?.close();
  ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    executablePath: EXE,
    deviceScaleFactor: 1,
    locale: "zh-CN",
    ...device,
  });
  page = ctx.pages()[0] ?? (await ctx.newPage());
  cdp = await ctx.newCDPSession(page);
  frame = undefined;
}
const PHONE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
};
const DESKTOP = { viewport: { width: 1600, height: 900 } };

/** 进房、按要求写好档位（`null` 不动存档）、只注入一次 bundle。 */
async function boot(entry) {
  await page.goto("https://iirose.com/", { waitUntil: "load" });
  frame = undefined;
  for (let i = 0; i < 30 && !frame; i++) {
    frame = page.frames().find((f) => f.url().includes("messages.html"));
    if (!frame) await sleep(1000);
  }
  if (!frame) throw new Error("没找到 messages.html 框架");
  await sleep(7000);
  // 进房后点左上角返回，关掉房间公告，聊天输入框才可见
  await page.mouse.click(20, 20);
  await sleep(1500);
  if (entry) await frame.evaluate(writeEntry, [SETTINGS_KEY, entry]);
  const already = await frame.evaluate(
    () => document.querySelectorAll(".IIROSE_MEDIA_CONTAINER").length,
  );
  if (already) throw new Error("页面上已有插件实例：先 reload 再跑");
  await frame.evaluate((src) => new Function(src)(), BUNDLE);
  await sleep(1500);
  for (let i = 0; i < 4; i++) {
    const ok = frame.locator("#syncAlertHolder").getByText("确定", {
      exact: true,
    });
    if ((await ok.count()) && (await ok.first().isVisible())) {
      await ok.first().click();
      await sleep(500);
    }
  }
  await frame.evaluate(() => {
    document.getElementById("syncHolderOutside")?.remove();
    const holder = document.getElementById("syncHolder");
    if (holder) holder.style.display = "none";
  });
  await sleep(800);
}

/** 在 messages.html 里执行。 */
function writeEntry([key, entry]) {
  const settings = JSON.parse(localStorage.getItem(key) ?? "{}");
  settings.panelEntry = entry;
  localStorage.setItem(key, JSON.stringify(settings));
}

const isOpen = () =>
  frame.evaluate(
    () =>
      !!document.querySelector(
        "#IIROSE_MEDIA_CONTAINER.ShowIIROSE_MEDIA_CONTAINER",
      ),
  );
const hasPill = () =>
  frame.evaluate((sel) => !!document.querySelector(sel), PILL);
const stored = () =>
  frame.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "{}").panelEntry,
    SETTINGS_KEY,
  );

/** 两指在屏幕中部从 y=250 往下滑 450px（超过视口 1/5）。 */
async function swipe() {
  const points = (y) => [
    { x: 150, y, id: 1 },
    { x: 240, y, id: 2 },
  ];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points(250),
  });
  for (let y = 280; y <= 700; y += 30) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: points(y),
    });
    await sleep(16);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await sleep(700);
}

const altS = async () => {
  await frame.evaluate(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", altKey: true, bubbles: true }),
    ),
  );
  await sleep(700);
};

/** 打开面板（开着就不动）→ 设置 → 插件设置 → 点歌台入口，返回这一行。 */
async function openEntryRow() {
  if (!(await isOpen())) await altS();
  await frame
    .locator(".IIROSE_MEDIA_CONTAINER button:visible", { hasText: "设置" })
    .last()
    .click();
  await sleep(800);
  await frame
    .locator(".IIROSE_MEDIA_CONTAINER [role=tab]:visible", {
      hasText: "插件设置",
    })
    .first()
    .click();
  await sleep(1000);
  const row = frame
    .locator(".IIROSE_MEDIA_CONTAINER :is(button,[role=button]):visible", {
      hasText: "点歌台入口",
    })
    .first();
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await sleep(900);
  return row;
}

/** 宿站选择框里文字完全相等的那一项（选择框不在插件容器里）。 */
const option = (label) =>
  frame
    .locator(":is(div,span):visible", {
      hasText: new RegExp(`^${label.replace(/[+()]/g, "\\$&")}$`),
    })
    .filter({ hasNot: frame.locator(".IIROSE_MEDIA_CONTAINER") })
    .last();

/** 选一项；返回设置行的文字。 */
async function choose(label) {
  const row = await openEntryRow();
  await option(label).click();
  await sleep(900);
  return row.textContent();
}

try {
  await launch(PHONE);
  // 1. 默认
  await boot("pillSwipe");
  check("默认：胶囊在", await hasPill());
  await swipe();
  check("默认：关着双指下滑打开", await isOpen());
  await swipe();
  check(
    "默认：开着双指下滑收起，胶囊回来",
    !(await isOpen()) && (await hasPill()),
  );

  // 2. 只收起
  let text = await choose("胶囊 + 双指下滑只收起");
  check(
    "设置行与存档：胶囊 + 双指下滑只收起",
    /只收起/.test(text) && (await stored()) === "pillSwipeClose",
    `${text} / ${await stored()}`,
  );
  await swipe();
  check("只收起：开着双指下滑收起", !(await isOpen()));
  check("只收起：胶囊在", await hasPill());
  await swipe();
  check("只收起：关着双指下滑没反应", !(await isOpen()));

  // 3. 只用胶囊
  text = await choose("只用胶囊");
  check(
    "设置行与存档：只用胶囊",
    /只用胶囊/.test(text) && (await stored()) === "pill",
    `${text} / ${await stored()}`,
  );
  await swipe();
  check("只用胶囊：开着双指下滑没反应", await isOpen());
  await altS();
  check("只用胶囊：Alt+S 收起，胶囊在", !(await isOpen()) && (await hasPill()));
  await swipe();
  check("只用胶囊：关着双指下滑没反应", !(await isOpen()));
  await frame.locator(PILL).click();
  await sleep(700);
  check("只用胶囊：点胶囊打开", await isOpen());

  // 4. 只用双指下滑
  text = await choose("只用双指下滑");
  check(
    "设置行与存档：只用双指下滑",
    /只用双指下滑/.test(text) && (await stored()) === "swipe",
    `${text} / ${await stored()}`,
  );
  await swipe();
  check(
    "只用双指下滑：双指下滑收起，不出现胶囊",
    !(await isOpen()) && !(await hasPill()),
  );
  await swipe();
  check("只用双指下滑：双指下滑打开", await isOpen());
  await swipe();

  // 5. 刷新后保持
  await boot(null);
  check(
    "刷新后仍是只用双指下滑：没有胶囊",
    (await stored()) === "swipe" && !(await hasPill()),
  );
  await swipe();
  check("刷新后双指下滑打开", await isOpen());

  // 6–8. 桌面、没有触屏
  await frame.evaluate(writeEntry, [SETTINGS_KEY, "pillSwipe"]);
  await launch(DESKTOP);
  await boot("pill");
  check(
    "桌面：没有触屏",
    !(await page.evaluate(() => navigator.maxTouchPoints)),
  );
  const HIDE = "隐藏胶囊（Alt+S / @词 打开）";
  let row = await openEntryRow();
  const shown = {};
  for (const label of [
    "显示胶囊",
    HIDE,
    "胶囊 + 双指下滑",
    "胶囊 + 双指下滑只收起",
    "只用胶囊",
    "只用双指下滑",
  ])
    shown[label] = await option(label).count();
  check(
    "桌面：设置行说「显示胶囊」，选择框只有两项",
    /显示胶囊/.test(await row.textContent()) &&
      shown["显示胶囊"] === 1 &&
      shown[HIDE] === 1 &&
      Object.values(shown).reduce((a, b) => a + b) === 2,
    JSON.stringify(shown),
  );
  await option(HIDE).click();
  await sleep(900);
  text = await row.textContent();
  check(
    "桌面：选「隐藏胶囊」后行文案和存档",
    text.includes(HIDE) && (await stored()) === "swipe",
    `${text} / ${await stored()}`,
  );
  await altS();
  check(
    "桌面隐藏胶囊：Alt+S 收起，没有胶囊",
    !(await isOpen()) && !(await hasPill()),
  );
  await altS();
  check("桌面隐藏胶囊：Alt+S 打开", await isOpen());
  text = await choose("显示胶囊");
  check(
    "桌面：选「显示胶囊」回到默认档",
    /显示胶囊/.test(text) && (await stored()) === "pillSwipe",
    `${text} / ${await stored()}`,
  );
  await altS();
  check("桌面显示胶囊：收起后胶囊在", !(await isOpen()) && (await hasPill()));
} catch (error) {
  check("脚本运行", false, String(error).slice(0, 300));
} finally {
  try {
    await frame?.evaluate(writeEntry, [SETTINGS_KEY, "pillSwipe"]);
  } catch {
    // 页面已关闭
  }
  await ctx?.close();
}
console.log(`${results.filter(Boolean).length} / ${results.length} 通过`);
process.exit(results.every(Boolean) ? 0 : 1);
