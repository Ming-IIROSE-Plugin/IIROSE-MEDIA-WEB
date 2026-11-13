// 真机验证：加载骨架和数据落地后的行 / 卡平齐。jsdom 没有版面，只能在真站量。
//
// 用法：先 `npm run build`，然后
//   node scripts/verify/skeleton.mjs
// 可选环境变量：IIROSE_PROFILE（持久化 profile，需已登录）、PLAYWRIGHT_CHROMIUM（浏览器路径）、
// SKELETON_SHOTS（截图目录，给了才截：每个场景一张骨架、一张结果）。
// 退出码 0 = 全部通过，1 = 有失败；每项检查都打印实测数。
//
// 做法：拦住发往站外的 fetch / xhr，让骨架停在屏幕上量一遍，放行后再量结果，逐项比较
// getBoundingClientRect（差 ≤ 1px 算平齐）。桌面 1400×900 与手机 390×844 各跑四个场景：
//   音乐列表、音乐网格、视频网格、视频列表。
//   列表：表头加载中也在且位置不变，每一行外框一致，第一行逐格左右边一致（文字格在行里垂直居中，只比左右）。
//   音乐网格：每张卡的外框和封面一致。
//   视频网格：标题最多两行，骨架按两行留位；封面左右边、第一排封面顶边一致，
//     标题折成两行的那一排行高要和骨架一样（全是一行标题的那排矮一行，只打印）；
//     UP 主一行换成纯英文也要和骨架一样高（行高写死，不跟后备字体走）。
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
const SHOTS = process.env.SKELETON_SHOTS;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail ?? ""}`);
};
const round = (n) => Math.round(n * 10) / 10;
const diff = (a, b) => a.map((n, i) => round(b[i] - n));
const worst = (d) => Math.max(0, ...d.map(Math.abs));

const ROW = "[data-imw-tracklist-row],[data-imw-collection-row]";
const SKELETON_ROW = "[data-imw-skeleton-row]";
const TILE = "[data-imw-tile]";
const SKELETON_TILE = "[data-imw-skeleton-tile]";

async function run(viewport, label) {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    executablePath: EXE,
    viewport,
    locale: "zh-CN",
  });
  // 拦住站外请求（搜索走 CORS 代理）：hold 期间挂起，放行时一起继续
  let hold = false;
  const parked = [];
  const release = () => {
    hold = false;
    parked.splice(0).forEach((resume) => resume());
  };
  await ctx.route("**/*", async (route) => {
    const request = route.request();
    const type = request.resourceType();
    if (
      hold &&
      (type === "fetch" || type === "xhr") &&
      !/iirose\.com$/.test(new URL(request.url()).host)
    )
      await new Promise((resume) => parked.push(resume));
    await route.continue().catch(() => {});
  });

  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto("https://iirose.com/", { waitUntil: "load" });
    let frame;
    for (let i = 0; i < 30 && !frame; i++) {
      frame = page.frames().find((f) => f.url().includes("messages.html"));
      if (!frame) await sleep(1000);
    }
    if (!frame) throw new Error("没找到 messages.html 框架");
    await sleep(7000);
    // 进房后点左上角返回，关掉房间公告
    await page.mouse.click(20, 20);
    await sleep(1500);
    const already = await frame.evaluate(
      () => document.querySelectorAll(".IIROSE_MEDIA_CONTAINER").length,
    );
    if (already) throw new Error("页面上已有插件实例：先 reload 再跑");
    await frame.evaluate((src) => new Function(src)(), BUNDLE);
    await sleep(1500);
    for (let i = 0; i < 4; i++) {
      const ok = frame
        .locator("#syncAlertHolder")
        .getByText("确定", { exact: true });
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
    await frame.evaluate(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "s", altKey: true, bubbles: true }),
      ),
    );
    await sleep(1500);

    const measure = (selectors) =>
      frame.evaluate(([rowSel, tileSel]) => {
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return [r.left, r.top, r.right, r.bottom];
        };
        const header = document.querySelector("[data-imw-tracklist-header]");
        return {
          header: header && box(header),
          rows: [...document.querySelectorAll(rowSel)].map((row) => ({
            box: box(row),
            cells: [...row.children].map(box),
          })),
          tiles: [...document.querySelectorAll(tileSel)].map((tile) => {
            const title = tile.children[1];
            // 最后一行（视频卡的 UP 主）：另量一份纯英文的复制品，看行高跟不跟字体走
            const meta = tile.lastElementChild;
            const latin = meta.cloneNode(false);
            latin.textContent = "Abc";
            meta.after(latin);
            const metaHeights = [
              meta.getBoundingClientRect().height,
              latin.getBoundingClientRect().height,
            ];
            latin.remove();
            const lineHeight = title
              ? parseFloat(getComputedStyle(title).lineHeight)
              : 0;
            return {
              box: box(tile),
              cover: box(tile.firstElementChild),
              metaHeights,
              titleLines:
                title && lineHeight
                  ? Math.round(
                      title.getBoundingClientRect().height / lineHeight,
                    )
                  : 0,
            };
          }),
        };
      }, selectors);

    const waitFor = async (selector) => {
      for (let i = 0; i < 60; i++) {
        if (await frame.evaluate((s) => !!document.querySelector(s), selector))
          return true;
        await sleep(250);
      }
      return false;
    };
    const input = () => frame.locator(".IIROSE_MEDIA_CONTAINER input").first();
    const clickView = async (name) => {
      await frame
        .locator(`.IIROSE_MEDIA_CONTAINER button[aria-label="${name}"]`)
        .first()
        .click();
      await sleep(600);
    };
    const clickMode = async (text) => {
      await frame
        .locator(".IIROSE_MEDIA_CONTAINER button:visible", { hasText: text })
        .first()
        .click();
      await sleep(800);
    };

    /** 搜一次：骨架停住时量，放行后再量结果。 */
    const capture = async (name, keyword, kind) => {
      await input().click();
      await input().press("Control+a");
      await input().type(keyword);
      hold = true;
      await input().press("Enter");
      const rows = kind === "rows";
      if (!(await waitFor(rows ? SKELETON_ROW : SKELETON_TILE))) {
        release();
        check(`${name}：出现骨架`, false);
        return null;
      }
      await sleep(400);
      const skeleton = await measure([SKELETON_ROW, SKELETON_TILE]);
      if (SHOTS)
        await page.screenshot({ path: `${SHOTS}/${name}-skeleton.png` });
      release();
      if (!(await waitFor(rows ? ROW : TILE))) {
        check(`${name}：结果落地`, false);
        return null;
      }
      await sleep(600);
      const real = await measure([ROW, TILE]);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-real.png` });
      return { skeleton, real };
    };

    const checkRows = (name, { skeleton, real }) => {
      check(
        `${name}：加载中留着表头，位置不变`,
        !!skeleton.header === !!real.header &&
          (!real.header || worst(diff(skeleton.header, real.header)) <= 1),
        skeleton.header && real.header
          ? `差 [${diff(skeleton.header, real.header)}]`
          : `骨架有表头 ${!!skeleton.header}，结果有表头 ${!!real.header}`,
      );
      const n = Math.min(skeleton.rows.length, real.rows.length);
      let rowWorst = 0;
      for (let i = 0; i < n; i++)
        rowWorst = Math.max(
          rowWorst,
          worst(diff(skeleton.rows[i].box, real.rows[i].box)),
        );
      check(
        `${name}：每一行外框一致`,
        n > 0 && rowWorst <= 1,
        `骨架 ${skeleton.rows.length} 行、结果 ${real.rows.length} 行，最大差 ${rowWorst}px`,
      );
      const cells = skeleton.rows[0]?.cells ?? [];
      const cellDiffs = cells.map((cell, i) => {
        const other = real.rows[0]?.cells[i];
        return other ? worst([other[0] - cell[0], other[2] - cell[2]]) : 99;
      });
      check(
        `${name}：第一行逐格左右边一致`,
        cells.length > 0 &&
          cells.length === real.rows[0]?.cells.length &&
          Math.max(...cellDiffs) <= 1,
        `各格差 [${cellDiffs.map(round)}]px`,
      );
    };

    const checkMusicTiles = (name, { skeleton, real }) => {
      const n = Math.min(skeleton.tiles.length, real.tiles.length);
      let tileWorst = 0;
      for (let i = 0; i < n; i++)
        tileWorst = Math.max(
          tileWorst,
          worst(diff(skeleton.tiles[i].box, real.tiles[i].box)),
          worst(diff(skeleton.tiles[i].cover, real.tiles[i].cover)),
        );
      check(
        `${name}：每张卡的外框和封面一致`,
        n > 0 && tileWorst <= 1,
        `${n} 张，最大差 ${tileWorst}px`,
      );
    };

    const checkVideoTiles = (name, { skeleton, real }) => {
      const n = Math.min(skeleton.tiles.length, real.tiles.length);
      // UP 主一行：名字全是英文时行盒不能比骨架（汉字撑）矮，否则那一排矮几像素
      // （行高没写死时 11px 下中文 15px、英文 12px；只有搜到英文名才露出来）
      const metaSkeleton = skeleton.tiles[0]?.metaHeights[0] ?? 0;
      const metaLatin = real.tiles[0]?.metaHeights[1] ?? 0;
      check(
        `${name}：UP 主一行全英文也和骨架一样高`,
        n > 0 && Math.abs(metaLatin - metaSkeleton) <= 0.5,
        `骨架 ${round(metaSkeleton)}px，英文 ${round(metaLatin)}px`,
      );
      let sideWorst = 0;
      for (let i = 0; i < n; i++) {
        const s = skeleton.tiles[i].cover;
        const r = real.tiles[i].cover;
        sideWorst = Math.max(sideWorst, worst([r[0] - s[0], r[2] - s[2]]));
      }
      const firstTop =
        n > 0
          ? Math.abs(real.tiles[0].cover[1] - skeleton.tiles[0].cover[1])
          : 99;
      check(
        `${name}：封面左右边、第一排顶边一致`,
        n > 0 && sideWorst <= 1 && firstTop <= 1,
        `左右最大差 ${sideWorst}px，第一排顶边差 ${round(firstTop)}px`,
      );
      // 按排分组：同一排的卡顶边相同；标题折成两行的那排，行高要等于骨架
      const rowsByTop = new Map();
      real.tiles.slice(0, n).forEach((tile, i) => {
        const key = Math.round(tile.box[1]);
        rowsByTop.set(key, [...(rowsByTop.get(key) ?? []), i]);
      });
      const skeletonHeight =
        skeleton.tiles[0].box[3] - skeleton.tiles[0].box[1];
      let twoLineRows = 0;
      let heightWorst = 0;
      const notes = [];
      for (const indices of rowsByTop.values()) {
        const lines = Math.max(...indices.map((i) => real.tiles[i].titleLines));
        const height =
          real.tiles[indices[0]].box[3] - real.tiles[indices[0]].box[1];
        notes.push(`${lines} 行标题 ${round(height)}px`);
        if (lines >= 2) {
          twoLineRows++;
          heightWorst = Math.max(
            heightWorst,
            Math.abs(height - skeletonHeight),
          );
        }
      }
      check(
        `${name}：两行标题那排的行高等于骨架`,
        twoLineRows === 0 || heightWorst <= 1,
        `骨架 ${round(skeletonHeight)}px；结果各排 ${notes.join("、")}`,
      );
    };

    const scene = async (name, keyword, kind, verify) => {
      const measured = await capture(`${label}-${name}`, keyword, kind);
      if (measured) verify(`${label} ${name}`, measured);
    };

    await clickView("列表");
    await scene("音乐列表", "陈奕迅", "rows", checkRows);
    await clickView("网格");
    await scene("音乐网格", "孙燕姿", "tiles", checkMusicTiles);
    await clickMode("视频");
    await clickView("网格");
    await scene("视频网格", "初音未来", "tiles", checkVideoTiles);
    await clickView("列表");
    await scene("视频列表", "洛天依", "rows", checkRows);
  } finally {
    release();
    await ctx.close();
  }
}

await run({ width: 1400, height: 900 }, "桌面");
await run({ width: 390, height: 844 }, "手机");

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} / ${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
