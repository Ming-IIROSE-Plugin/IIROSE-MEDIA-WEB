// 真机验证：面板从胶囊长出来、缩回胶囊。jsdom 没有版面，起点和终点只能在真站量。
//
// 用法：先 `npm run build`，然后
//   node scripts/verify/grow.mjs
// 可选环境变量：IIROSE_PROFILE（持久化 profile，需已登录）、PLAYWRIGHT_CHROMIUM（浏览器路径）、
// GROW_CPU_THROTTLE（CPU 降速倍数，比如 4，模拟慢手机看帧间隔）。
// 退出码 0 = 全部通过，1 = 有失败；每项检查都打印实测数。
//
// 检查项（全部用 getBoundingClientRect 和计算样式量屏幕上的位置）：
//   1. 打开第一帧：露出的区域就是胶囊露出的那块（各边 ≤ 1px），胶囊还看得见、点不到
//   2. 收起最后一帧：露出的区域就是收起的胶囊（各边 ≤ 1px）；收完胶囊点得到
//   3. 停稳：容器的 clip-path、translate、transform、scale 都是 none，跟随元素已移除
//   4. 全屏贴右边、贴上边，窗口模式，手机尺寸各量一遍
//   5. 减少动态效果：任何一帧都没有裁切，直接到位
//   6. 交接：胶囊一开始淡出 / 淡入就把动画冻住，在同一帧里把胶囊透明度临时定成 0 和 0.5
//      各截一张：0.5 那张的字和图标要明显比 0 那张清楚（胶囊压在面板的底色上面）。
//      开合只有 100ms，淡出只占一两帧，帧与帧之间没有「半途」可冻，所以查的是层级，
//      不是某一帧的透明度；参照也不能用静止时的胶囊（背后是深色的宿站，交接时是浅色底）。
//   7. 双击胶囊：第一下之后把动画冻在交接中途再点第二下（开合只有 100ms，按墙钟隔几十毫秒点，
//      第二下会落在动画结束之后，测不到吞点击的那层）；第二下要落在盖住形状的底色上被吞掉，
//      宿站和面板内容都收不到点击，面板照常打开
//   8. 「点歌台入口」选「只用双指下滑」（没有胶囊）：收起最后一帧、打开第一帧都是胶囊本该在处的
//      中心点（宽高 0），全程没有胶囊；中心点取同一位置、同一尺寸下有胶囊那一轮量到的收起的胶囊
// 设置里的「点歌台入口」每次 boot 都写死成默认档，结束时还原：不吃 profile 里残留的档位。
// 另外打印每段动画里形状在动的那些帧的最长一帧（形状停着等的帧不算），以及面板打开后静止时最长的一帧。
// 帧间隔只打印、不判：这台机器没有显卡，全靠软件渲染，CPU 被别的任务占满时连静止的面板都会掉帧，
// 量出来的数反映的是机器，不是动画。桌面目标是每帧 ≤ 34ms，要在真机上看。
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
const SETTINGS_KEY = "imwPluginSetting";
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

/** 进房、按要求写好存档和设置、只注入一次 bundle。 */
async function boot({ dock, display, entry = "pillSwipe" }) {
  await page.goto("https://iirose.com/", { waitUntil: "load" });
  frame = undefined;
  for (let i = 0; i < 30 && !frame; i++) {
    frame = page.frames().find((f) => f.url().includes("messages.html"));
    if (!frame) await page.waitForTimeout(1000);
  }
  if (!frame) throw new Error("没找到 messages.html 框架");
  await page.waitForTimeout(7000);
  // 进房后点左上角返回，关掉房间公告，聊天输入框才可见
  await page.mouse.click(20, 20);
  await page.waitForTimeout(1500);
  await frame.evaluate(
    ([positionKey, settingsKey, dock, display, entry]) => {
      localStorage.setItem(positionKey, JSON.stringify(dock));
      const settings = JSON.parse(localStorage.getItem(settingsKey) ?? "{}");
      settings.panelDisplay = display;
      settings.panelEntry = entry;
      localStorage.setItem(settingsKey, JSON.stringify(settings));
    },
    [POSITION_KEY, SETTINGS_KEY, dock, display, entry],
  );
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
  const throttle = Number(process.env.GROW_CPU_THROTTLE);
  if (throttle > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  }
}

/** iframe 里的坐标换成页面坐标（宿站 iframe 有缩放和偏移）。 */
async function toPage(x, y) {
  const box = await (await frame.frameElement()).boundingBox();
  const scale = box.width / (await frame.evaluate(() => window.innerWidth));
  return { x: box.x + x * scale, y: box.y + y * scale };
}

const rectOf = (selector) =>
  frame.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }, selector);

/** 每帧记下容器露出的区域、胶囊的可见程度和跟随元素。 */
async function startSampling() {
  await frame.evaluate(() => {
    const container = document.getElementById("IIROSE_MEDIA_CONTAINER");
    const state = { on: true, samples: [] };
    window.__imwGrowSamples = state;
    const read = (t) => {
      const cs = getComputedStyle(container);
      const r = container.getBoundingClientRect();
      const zoom = r.width / container.offsetWidth || 1;
      const inset = cs.clipPath.match(/inset\(([^)]*)\)/);
      let visible = null;
      if (inset) {
        const n = inset[1]
          .split(" round ")[0]
          .trim()
          .split(/\s+/)
          .map(parseFloat);
        const [top, right = top, bottom = top, left = right] = n;
        visible = {
          left: r.left + left * zoom,
          top: r.top + top * zoom,
          right: r.right - right * zoom,
          bottom: r.bottom - bottom * zoom,
        };
      }
      const root = document.getElementById("imw-panel-dock-root");
      const layer = root?.firstElementChild;
      state.samples.push({
        t,
        visible,
        visibility: cs.visibility,
        dock: layer ? parseFloat(getComputedStyle(layer).opacity) : null,
        inert: root ? root.hasAttribute("inert") : null,
        followers: document.querySelectorAll("[data-imw-grow]").length,
      });
    };
    const loop = (t) => {
      if (!state.on) return;
      read(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

const stopSampling = () =>
  frame.evaluate(() => {
    window.__imwGrowSamples.on = false;
    return window.__imwGrowSamples.samples;
  });

const restState = () =>
  frame.evaluate(() => {
    const container = document.getElementById("IIROSE_MEDIA_CONTAINER");
    const cs = getComputedStyle(container);
    return {
      clipPath: cs.clipPath,
      translate: cs.translate,
      transform: cs.transform,
      scale: cs.scale,
      visibility: cs.visibility,
      followers: document.querySelectorAll("[data-imw-grow]").length,
      dock: !!document.getElementById("imw-panel-dock-root"),
    };
  });

const gap = (a, b) =>
  Math.max(
    Math.abs(a.left - b.left),
    Math.abs(a.top - b.top),
    Math.abs(a.right - b.right),
    Math.abs(a.bottom - b.bottom),
  );
const fmt = (r) =>
  r
    ? `(${r.left.toFixed(1)}, ${r.top.toFixed(1)}) – (${r.right.toFixed(1)}, ${r.bottom.toFixed(1)})`
    : "无";
/**
 * 形状在动的那些帧里最长的一帧。形状没动的帧不算：首次打开要先把面板挂上，
 * 这段时间形状停在胶囊上等，不是卡顿。
 */
const motionGap = (samples) => {
  let worst = 0;
  let at = 0;
  for (let i = 1; i < samples.length; i++) {
    const same =
      JSON.stringify(samples[i].visible) ===
      JSON.stringify(samples[i - 1].visible);
    const gap = samples[i].t - samples[i - 1].t;
    if (!same && gap > worst) [worst, at] = [gap, i];
  }
  return {
    worst,
    text: `${worst.toFixed(1)}ms（第 ${at} 帧，共 ${samples.length} 帧）`,
  };
};

/** 截图的亮度离散程度：胶囊被底色盖住时整块是一个颜色，接近 0。 */
async function contrast(png) {
  const helper = await ctx.newPage();
  try {
    return await helper.evaluate(async (b64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${b64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const g = canvas.getContext("2d");
      g.drawImage(image, 0, 0);
      const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0;
      let squares = 0;
      const n = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const l =
          0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        sum += l;
        squares += l * l;
      }
      const mean = sum / n;
      return Math.sqrt(Math.max(squares / n - mean * mean, 0));
    }, png.toString("base64"));
  } finally {
    await helper.close();
  }
}

/** 胶囊一开始淡出 / 淡入就把动画冻住（截住后续帧），截图之后再放行。 */
const freezeWhen = (mode) =>
  frame.evaluate((mode) => {
    const original = window.requestAnimationFrame;
    window.__imwHeld = { original, callbacks: [] };
    window.requestAnimationFrame = (callback) => {
      const layer = document.getElementById(
        "imw-panel-dock-root",
      )?.firstElementChild;
      const raw = layer?.style.opacity;
      const value = raw ? parseFloat(raw) : null;
      // 打开：第一帧还是 1，之后开始淡出；收起：胶囊挂上时是 0，淡入前都算交接中
      const hold = value !== null && value < 1;
      if (!hold) return original.call(window, callback);
      window.__imwHeld.callbacks.push(callback);
      return 0;
    };
  }, mode);
/** 冻住后把胶囊透明度临时定成 `opacity`（返回冻住时的实际值），放行前还原。 */
const holdOpacity = (opacity) =>
  frame.evaluate((opacity) => {
    const layer = document.getElementById(
      "imw-panel-dock-root",
    )?.firstElementChild;
    if (!layer) return null;
    window.__imwHeld.opacity ??= layer.style.opacity;
    layer.style.opacity = opacity;
    return window.__imwHeld.opacity;
  }, opacity);

/** 冻住时胶囊确实在交接中：带 z-index 的那一层写着小于 1 的透明度（没冻住或写错了层都不算）。 */
const inHandover = (actual) =>
  typeof actual === "string" && actual !== "" && Number(actual) < 1;

/** 同一冻结帧里胶囊藏掉（0）和半透明（0.5）两张截图的亮度离散。 */
async function handoverContrast(rect) {
  const actual = await holdOpacity("0");
  const hidden = await contrast(await shotOf(rect));
  await holdOpacity("0.5");
  const shown = await contrast(await shotOf(rect));
  return { actual, hidden, shown };
}
const releaseFrames = () =>
  frame.evaluate(() => {
    const { original, callbacks, opacity } = window.__imwHeld;
    const layer = document.getElementById(
      "imw-panel-dock-root",
    )?.firstElementChild;
    if (layer && opacity !== undefined) layer.style.opacity = opacity;
    window.requestAnimationFrame = original;
    for (const callback of callbacks) original.call(window, callback);
  });

async function shotOf(rect) {
  const from = await toPage(rect.left + 2, rect.top + 2);
  const to = await toPage(rect.right - 2, rect.bottom - 2);
  return page.screenshot({
    clip: { x: from.x, y: from.y, width: to.x - from.x, height: to.y - from.y },
  });
}

/** 交接时胶囊压在面板的底色上面：冻在淡出 / 淡入的半途，胶囊的字和图标还看得见。 */
async function handoverOnTop(minimizeLabel) {
  await page.mouse.move(700, 450);
  await page.waitForTimeout(300);
  const pill = await rectOf(PILL);
  const center = await toPage(
    (pill.left + pill.right) / 2,
    (pill.top + pill.bottom) / 2,
  );
  await page.mouse.move(center.x, center.y);
  await page.waitForTimeout(500);
  const expanded = await rectOf(PILL);
  const resting = await contrast(await shotOf(expanded));
  await freezeWhen("open");
  await page.mouse.click(center.x, center.y);
  await page.waitForTimeout(400);
  const opening = await handoverContrast(expanded);
  await releaseFrames();
  await page.waitForTimeout(800);
  check(
    "打开头一段：胶囊在面板的底色上面淡出，冻住时（透明度定在 0.5）看得见",
    inHandover(opening.actual) &&
      opening.shown > 5 &&
      opening.shown > opening.hidden + 5,
    `冻住时胶囊透明度 ${opening.actual}，亮度离散：藏掉 ${opening.hidden.toFixed(1)}、0.5 时 ${opening.shown.toFixed(1)}（静止时 ${resting.toFixed(1)}）`,
  );

  const minimize = await rectOf(`[aria-label="${minimizeLabel}"]`);
  const button = await toPage(
    (minimize.left + minimize.right) / 2,
    (minimize.top + minimize.bottom) / 2,
  );
  await freezeWhen("close");
  await page.mouse.click(button.x, button.y);
  await page.waitForTimeout(500);
  const tucked = await rectOf(PILL);
  const closing = await handoverContrast(tucked);
  await releaseFrames();
  await page.waitForTimeout(800);
  check(
    "收起：胶囊在面板的底色上面淡入，冻住时（透明度定在 0.5）看得见",
    inHandover(closing.actual) &&
      closing.shown > 5 &&
      closing.shown > closing.hidden + 5,
    `冻住时胶囊透明度 ${closing.actual}，亮度离散：藏掉 ${closing.hidden.toFixed(1)}、0.5 时 ${closing.shown.toFixed(1)}`,
  );
}

/**
 * 双击胶囊：第一下之后冻在交接中途再点第二下，第二下落在正在长的形状上被吞掉，面板照常打开。
 * 用捕获阶段记下每一下点到了谁：底色吞掉点击时会停止冒泡，冒泡阶段看不到。
 */
async function doubleClick(minimizeLabel) {
  await page.mouse.move(700, 450);
  await page.waitForTimeout(300);
  const pill = await rectOf(PILL);
  const center = await toPage(
    (pill.left + pill.right) / 2,
    (pill.top + pill.bottom) / 2,
  );
  await page.mouse.move(center.x, center.y);
  await page.waitForTimeout(500);
  await frame.evaluate(() => {
    window.__imwClicks = [];
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        const where = target.closest?.("[data-imw-grow]")
          ? "veil"
          : target.closest?.("#IIROSE_MEDIA_CONTAINER")
            ? "panel"
            : target.closest?.("#imw-panel-dock-root")
              ? "dock"
              : `host ${target.tagName}#${target.id}`;
        window.__imwClicks.push(where);
      },
      true,
    );
    // 冒泡到 document 的点底色的点击：没被吞掉，宿站自己的监听会收到
    window.__imwLeaked = 0;
    document.addEventListener("click", (event) => {
      if (event.target.closest?.("[data-imw-grow]")) window.__imwLeaked++;
    });
  });
  await freezeWhen("open");
  await page.mouse.click(center.x, center.y);
  await page.waitForTimeout(400);
  const midway = await frame.evaluate(() => ({
    veil: !!document.querySelector('[data-imw-grow="veil"]'),
    opacity:
      document.getElementById("imw-panel-dock-root")?.firstElementChild?.style
        .opacity ?? null,
  }));
  await page.mouse.click(center.x, center.y);
  await page.waitForTimeout(100);
  await releaseFrames();
  await page.waitForTimeout(800);
  const result = await frame.evaluate(() => ({
    open: document
      .getElementById("IIROSE_MEDIA_CONTAINER")
      .classList.contains("ShowIIROSE_MEDIA_CONTAINER"),
    clicks: window.__imwClicks,
    leaked: window.__imwLeaked,
  }));
  const second = result.clicks[1];
  check(
    "双击胶囊：第二下（冻在交接中途）落在底色上被吞掉，面板照常打开，宿站和面板内容都没收到",
    midway.veil &&
      inHandover(midway.opacity) &&
      result.open &&
      second === "veil" &&
      result.leaked === 0 &&
      result.clicks.every((where) => where === "dock" || where === "veil"),
    `第二下时底色在 ${midway.veil}、胶囊透明度 ${midway.opacity}；${JSON.stringify(result)}`,
  );
  const minimize = await rectOf(`[aria-label="${minimizeLabel}"]`);
  const button = await toPage(
    (minimize.left + minimize.right) / 2,
    (minimize.top + minimize.bottom) / 2,
  );
  await page.mouse.click(button.x, button.y);
  await page.waitForTimeout(800);
}

/** Alt+S：宿站输入模块在 iframe 的 document 上听 keydown。 */
const altS = () =>
  frame.evaluate(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", altKey: true, bubbles: true }),
    ),
  );

/**
 * 「只用双指下滑」：面板开着时把档位改成没有胶囊，收起缩回胶囊本该在处的中心点；
 * 再打开从那个点长出来。`tucked` 是同一位置、同一尺寸下有胶囊那一轮量到的收起的胶囊。
 */
async function swipeOnlyRound(label, tucked) {
  const centre = {
    x: (tucked.left + tucked.right) / 2,
    y: (tucked.top + tucked.bottom) / 2,
  };
  const point = {
    left: centre.x,
    right: centre.x,
    top: centre.y,
    bottom: centre.y,
  };
  await altS();
  await page.waitForTimeout(800);
  await frame.evaluate((key) => {
    const settings = JSON.parse(localStorage.getItem(key) ?? "{}");
    settings.panelEntry = "swipe";
    localStorage.setItem(key, JSON.stringify(settings));
  }, SETTINGS_KEY);

  await startSampling();
  await altS();
  await page.waitForTimeout(800);
  const closing = await stopSampling();
  const last = closing.filter((s) => s.visible).at(-1);
  check(
    `${label}：只用双指下滑，收起最后一帧缩到胶囊本该在处的中心点，全程没有胶囊`,
    !!last &&
      gap(last.visible, point) <= 1 &&
      closing.every((s) => s.dock === null) &&
      !(await rectOf(PILL)),
    `中心 (${centre.x.toFixed(1)}, ${centre.y.toFixed(1)})，最后一帧 ${fmt(last?.visible)}，帧里出现胶囊 ${closing.filter((s) => s.dock !== null).length} 次`,
  );

  await startSampling();
  await altS();
  await page.waitForTimeout(800);
  const opening = await stopSampling();
  const first = opening.find((s) => s.visible);
  const opened = await restState();
  check(
    `${label}：只用双指下滑，打开第一帧从那个中心点长出，停稳后没有裁切`,
    !!first &&
      gap(first.visible, point) <= 1 &&
      opening.every((s) => s.dock === null) &&
      opened.clipPath === "none" &&
      opened.visibility === "visible" &&
      opened.followers === 0,
    `第一帧 ${fmt(first?.visible)}，停稳 ${JSON.stringify(opened)}`,
  );

  // 还原默认档，收起：胶囊重新挂上
  await frame.evaluate((key) => {
    const settings = JSON.parse(localStorage.getItem(key) ?? "{}");
    settings.panelEntry = "pillSwipe";
    localStorage.setItem(key, JSON.stringify(settings));
  }, SETTINGS_KEY);
  await altS();
  await page.waitForTimeout(800);
}

/**
 * 胶囊露出来的那块：贴边时就是胶囊的盒子，上边收起时盒子比露出的长一截（内容居中），
 * 改量轮廓的外框。
 */
async function silhouette(edge) {
  const pill = await rectOf(PILL);
  if (edge !== "top") return pill;
  const outline = await rectOf("[data-imw-dock-shape]");
  // 轮廓在边缘处有耳朵：左右取胶囊的盒子，上下取轮廓
  return {
    left: pill.left,
    right: pill.right,
    top: outline.top,
    bottom: outline.bottom,
  };
}

/** 一轮开合：悬停胶囊、真实点击打开、等长完；再点最小化、等缩回。 */
async function roundTrip(label, edge, minimizeLabel) {
  // 先把鼠标挪开再悬停：胶囊展开后才点
  await page.mouse.move(700, 450);
  await page.waitForTimeout(300);
  const before = await rectOf(PILL);
  const center = await toPage(
    (before.left + before.right) / 2,
    (before.top + before.bottom) / 2,
  );
  await page.mouse.move(center.x, center.y);
  await page.waitForTimeout(500);
  const start = await silhouette(edge);

  await startSampling();
  await page.mouse.click(center.x, center.y);
  await page.waitForTimeout(900);
  const opening = (await stopSampling()).filter((s) => s.visible);
  const first = opening[0];
  check(
    `${label}：打开第一帧就是展开的胶囊`,
    !!first && gap(first.visible, start) <= 1,
    `胶囊 ${fmt(start)}，第一帧 ${fmt(first?.visible)}`,
  );
  check(
    `${label}：打开时胶囊还在、点不到，长完才卸掉`,
    !!first && first.dock > 0.9 && first.inert === true,
    `第一帧胶囊透明度 ${first?.dock}，inert ${first?.inert}`,
  );
  const opened = await restState();
  const idle = await idleFrameGap();
  check(
    `${label}：打开停稳没有裁切和变换，跟随元素已移除`,
    opened.clipPath === "none" &&
      opened.translate === "none" &&
      opened.transform === "none" &&
      opened.scale === "none" &&
      opened.followers === 0 &&
      !opened.dock,
    JSON.stringify(opened),
  );

  const minimize = await rectOf(`[aria-label="${minimizeLabel}"]`);
  const button = await toPage(
    (minimize.left + minimize.right) / 2,
    (minimize.top + minimize.bottom) / 2,
  );
  await startSampling();
  await page.mouse.click(button.x, button.y);
  await page.waitForTimeout(800);
  const closing = (await stopSampling()).filter((s) => s.visible);
  const last = closing[closing.length - 1];
  const end = await silhouette(edge);
  check(
    `${label}：收起最后一帧落在收起的胶囊上`,
    !!last && gap(last.visible, end) <= 1,
    `胶囊 ${fmt(end)}，最后一帧 ${fmt(last?.visible)}`,
  );
  const closed = await restState();
  const hit = await frame.evaluate(
    ([sel, x, y]) => !!document.elementFromPoint(x, y)?.closest(sel),
    [PILL, (end.left + end.right) / 2, (end.top + end.bottom) / 2],
  );
  check(
    `${label}：收起停稳后面板藏好、胶囊点得到`,
    closed.clipPath === "none" &&
      closed.visibility === "hidden" &&
      closed.followers === 0 &&
      closed.dock &&
      hit,
    `${JSON.stringify(closed)}，点胶囊中心命中 ${hit}`,
  );
  const open = motionGap(opening);
  const close = motionGap(closing);
  console.log(
    `      帧间隔（只供参考）：打开最长 ${open.text}，收起最长 ${close.text}，静止最长 ${idle.toFixed(1)}ms`,
  );
  return end;
}

/** 面板打开后静止时最长的一帧：这台机器此刻本身有多卡。 */
async function idleFrameGap() {
  return frame.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        const loop = (t) => {
          times.push(t);
          if (times.length < 40) requestAnimationFrame(loop);
          else {
            let worst = 0;
            for (let i = 1; i < times.length; i++)
              worst = Math.max(worst, times[i] - times[i - 1]);
            resolve(worst);
          }
        };
        requestAnimationFrame(loop);
      }),
  );
}

try {
  // ── 全屏：贴右边、贴上边 ─────────────────────────────────
  await boot({ dock: { x: 0, y: 400, edge: "right" }, display: "full" });
  await roundTrip("全屏贴右边（首次打开）", "right", "最小化点歌台");
  const fullTucked = await roundTrip(
    "全屏贴右边（再次打开）",
    "right",
    "最小化点歌台",
  );
  await swipeOnlyRound("全屏贴右边", fullTucked);
  await handoverOnTop("最小化点歌台");
  await doubleClick("最小化点歌台");
  await frame.evaluate(
    (key) =>
      localStorage.setItem(key, JSON.stringify({ x: 900, y: 0, edge: "top" })),
    POSITION_KEY,
  );
  await page.waitForTimeout(900);
  await roundTrip("全屏贴上边", "top", "最小化点歌台");

  // ── 减少动态效果：任何一帧都不裁 ─────────────────────────
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(300);
  const pill = await rectOf(PILL);
  const center = await toPage(
    (pill.left + pill.right) / 2,
    (pill.top + pill.bottom) / 2,
  );
  await startSampling();
  await page.mouse.click(center.x, center.y);
  await page.waitForTimeout(600);
  const reduced = await stopSampling();
  const reducedRest = await restState();
  check(
    "减少动态效果：没有一帧带裁切，直接到位",
    reduced.length > 0 &&
      reduced.every((s) => !s.visible) &&
      reducedRest.visibility === "visible" &&
      !reducedRest.dock,
    `${reduced.length} 帧里带裁切的 ${reduced.filter((s) => s.visible).length} 帧`,
  );
  await frame.evaluate(() =>
    document.querySelector('[aria-label="最小化点歌台"]')?.click(),
  );
  await page.waitForTimeout(400);
  await page.emulateMedia({ reducedMotion: null });

  // ── 手机尺寸 ──────────────────────────────────────────────
  await frame.evaluate(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({ x: 0, y: 300, edge: "right" }),
      ),
    POSITION_KEY,
  );
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(1500);
  const phoneTucked = await roundTrip("手机贴右边", "right", "最小化点歌台");
  await swipeOnlyRound("手机贴右边", phoneTucked);
  await page.setViewportSize({ width: 1400, height: 900 });

  // ── 窗口模式：胶囊在窗口外 ───────────────────────────────
  await boot({ dock: { x: 0, y: 400, edge: "right" }, display: "window" });
  await roundTrip("窗口贴右边（首次打开）", "right", "最小化窗口");
  const windowTucked = await roundTrip(
    "窗口贴右边（再次打开）",
    "right",
    "最小化窗口",
  );
  await swipeOnlyRound("窗口贴右边", windowTucked);
} catch (error) {
  check("脚本运行", false, String(error).slice(0, 300));
} finally {
  try {
    await frame?.evaluate(
      ([positionKey, settingsKey]) => {
        localStorage.removeItem(positionKey);
        const settings = JSON.parse(localStorage.getItem(settingsKey) ?? "{}");
        settings.panelDisplay = "full";
        settings.panelEntry = "pillSwipe";
        localStorage.setItem(settingsKey, JSON.stringify(settings));
      },
      [POSITION_KEY, SETTINGS_KEY],
    );
  } catch {
    // 页面已关闭
  }
  await ctx.close();
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
