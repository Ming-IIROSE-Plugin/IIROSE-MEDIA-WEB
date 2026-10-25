import { afterEach, describe, expect, it, vi } from "vitest";
import { PlaybackMode } from "../playback/PlaybackMode";
import { SidebarPlaybackRow } from "../playback/SidebarPlaybackRow";
import { snapshot } from "../playback/fixtures";
import { SidebarMediaEntry } from "./SidebarMediaEntry";

const markup = `<div id="functionHolderBox"><div class="functionButtonGroup"><span class="mdi-inbox"></span><span class="functionBtnFont">盒子</span></div><div id="functionHolderExtBox"><div class="functionButtonExt"><div id="radioHolder"><button id="radioPlayButton" class="mdi-pause"></button></div></div><div class="functionButtonExt"><div id="shareMediaBox"><a href="#media">当前媒体</a></div></div></div></div>`;
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
afterEach(() => {
  document.body.innerHTML = "";
});

describe("侧栏媒体入口", () => {
  it("延迟出现后定向更名，停止电台并保留原媒体事件，重复重建只一个入口", async () => {
    document.body.innerHTML = '<div class="functionBtnFont">盒子</div>';
    const open = vi.fn();
    const adapter = new SidebarMediaEntry(open);
    document.body.insertAdjacentHTML("beforeend", markup);
    const media = document.getElementById("shareMediaBox")!;
    const mediaClick = vi.fn();
    media.addEventListener("click", mediaClick);
    const stop = vi.fn(() => {
      document.getElementById("radioPlayButton")!.className = "mdi-play";
    });
    document.getElementById("radioPlayButton")!.onclick = stop;
    await flush();
    expect(
      document.querySelector("#functionHolderBox .functionBtnFont")!
        .textContent,
    ).toBe("IIROSE-MEDIA-WEB");
    expect(document.querySelector("body > .functionBtnFont")!.textContent).toBe(
      "盒子",
    );
    expect(
      document
        .querySelector("#radioHolder")!
        .parentElement!.classList.contains("imw-hidden-radio"),
    ).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(document.getElementById("shareMediaBox")).toBe(media);
    (media as HTMLElement).click();
    expect(mediaClick).toHaveBeenCalledOnce();
    const entry = document.getElementById("imw-media-progress-entry")!;
    expect(entry.textContent).toBe("播放进度");
    expect(entry.getAttribute("aria-haspopup")).toBe("dialog");
    expect(
      entry
        .querySelector("#imw-progress-entry-icon")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
    entry.click();
    expect(open).toHaveBeenCalledOnce();
    document.querySelector("#functionHolderBox")!.outerHTML = markup;
    await flush();
    expect(document.querySelectorAll("#imw-media-progress-entry")).toHaveLength(
      1,
    );
    document.getElementById("imw-media-progress-entry")!.click();
    expect(open).toHaveBeenCalledTimes(2);
    adapter.dispose();
    expect(document.querySelector("#imw-media-progress-entry")).toBeNull();
    expect(document.querySelector(".imw-hidden-radio")).toBeNull();
    expect(
      document.querySelector("#functionHolderBox .functionBtnFont")!
        .textContent,
    ).toBe("盒子");
  });
  it("入口主题跟随侧栏实际背景，重建后从深色更新为浅色", async () => {
    document.body.innerHTML = `<div id="functionHolder" style="background-color: rgb(16, 16, 16)">${markup}</div>`;
    const adapter = new SidebarMediaEntry(vi.fn());
    const entry = document.getElementById("imw-media-progress-entry")!;
    expect(entry.dataset.imwTheme).toBe("dark");
    document.getElementById("functionHolder")!.outerHTML =
      `<div id="functionHolder" style="background-color: rgb(224, 224, 224)">${markup}</div>`;
    await flush();
    expect(
      document.getElementById("imw-media-progress-entry")?.dataset.imwTheme,
    ).toBe("light");
    adapter.dispose();
  });

  it("真实宿站 functionHolder 中电台延迟展开后隐藏", async () => {
    document.body.innerHTML =
      '<div id="functionHolder"><div id="functionHolderExtBox"><div class="functionButtonExt"><div id="shareMediaBox"></div></div></div></div>';
    const adapter = new SidebarMediaEntry(vi.fn());
    document
      .getElementById("functionHolderExtBox")!
      .insertAdjacentHTML(
        "afterbegin",
        '<div class="functionButtonExt"><div id="radioHolder"></div></div>',
      );
    await flush();
    expect(
      document
        .getElementById("radioHolder")!
        .parentElement!.classList.contains("imw-hidden-radio"),
    ).toBe(true);
    adapter.dispose();
  });
  it("媒体移除清理入口，再插入媒体重新创建；时钟纯文本不触发扫描", async () => {
    document.body.innerHTML = markup;
    const open = vi.fn();
    const adapter = new SidebarMediaEntry(open);
    await flush();
    const box = document.getElementById("functionHolderExtBox")!;
    const scan = vi.spyOn(box, "querySelector");
    const media = document.getElementById("shareMediaBox")!;
    media.innerHTML = '<span id="shareMediaTime">0:01</span>';
    await flush();
    scan.mockClear();
    document.getElementById("shareMediaTime")!.textContent = "0:02";
    await flush();
    expect(scan).not.toHaveBeenCalled();
    const oldEntry = document.getElementById("imw-media-progress-entry")!;
    const card = media.parentElement!;
    media.remove();
    await flush();
    expect(document.getElementById("imw-media-progress-entry")).toBeNull();
    oldEntry.click();
    expect(open).not.toHaveBeenCalled();
    card.appendChild(media);
    await flush();
    expect(document.querySelectorAll("#imw-media-progress-entry")).toHaveLength(
      1,
    );
    expect(document.getElementById("imw-media-progress-entry")).not.toBe(
      oldEntry,
    );
    document.getElementById("imw-media-progress-entry")!.click();
    expect(open).toHaveBeenCalledOnce();
    adapter.dispose();
  });
  it("三次完整重建只保留当前恢复记录，删除侧栏后释放入口及所有记录", async () => {
    document.body.innerHTML = markup;
    const open = vi.fn();
    const adapter = new SidebarMediaEntry(open);
    const records = adapter as unknown as {
      renamed: Map<Element, string>;
      hidden: Set<HTMLElement>;
      entry?: HTMLButtonElement;
    };
    for (let index = 0; index < 3; index++) {
      const oldEntry = document.getElementById("imw-media-progress-entry")!;
      document.getElementById("functionHolderBox")!.outerHTML = markup;
      await flush();
      expect(records.renamed.size).toBe(1);
      expect(records.hidden.size).toBe(1);
      expect(
        [...records.renamed.keys(), ...records.hidden].every(
          (node) => node.isConnected,
        ),
      ).toBe(true);
      expect(records.entry?.isConnected).toBe(true);
      oldEntry.click();
      expect(open).not.toHaveBeenCalled();
    }
    const oldEntry = records.entry!;
    document.getElementById("functionHolderBox")!.remove();
    await flush();
    expect(records.renamed.size).toBe(0);
    expect(records.hidden.size).toBe(0);
    expect(records.entry).toBeUndefined();
    oldEntry.click();
    expect(open).not.toHaveBeenCalled();
    document.body.insertAdjacentHTML("beforeend", markup);
    await flush();
    const title = document.querySelector(".functionBtnFont")!;
    const radio = document.getElementById("radioHolder")!.parentElement!;
    expect(title.textContent).toBe("IIROSE-MEDIA-WEB");
    expect(radio.classList.contains("imw-hidden-radio")).toBe(true);
    adapter.dispose();
    expect(title.textContent).toBe("盒子");
    expect(radio.classList.contains("imw-hidden-radio")).toBe(false);
    expect(document.getElementById("imw-media-progress-entry")).toBeNull();
  });
  it("捕获非冒泡电台play调用宿站暂停，不影响房间媒体，dispose后停止拦截", async () => {
    document.body.innerHTML = `${markup}<audio id="radioPlayer"></audio><audio id="roomPlayer"></audio>`;
    const button = document.getElementById("radioPlayButton")!;
    button.className = "mdi-play";
    const radio = document.getElementById("radioPlayer") as HTMLAudioElement;
    const room = document.getElementById("roomPlayer") as HTMLAudioElement;
    const pauseRadio = vi.spyOn(radio, "pause").mockImplementation(() => {});
    const pauseRoom = vi.spyOn(room, "pause").mockImplementation(() => {});
    const stop = vi.fn(() => {
      radio.pause();
      button.className = "mdi-play";
    });
    button.onclick = stop;
    const adapter = new SidebarMediaEntry(vi.fn());
    await flush();
    expect(stop).not.toHaveBeenCalled();
    button.className = "mdi-pause";
    room.dispatchEvent(new Event("play", { bubbles: false }));
    expect(stop).not.toHaveBeenCalled();
    radio.dispatchEvent(new Event("play", { bubbles: false }));
    expect(stop).toHaveBeenCalledOnce();
    expect(pauseRadio).toHaveBeenCalledOnce();
    expect(pauseRoom).not.toHaveBeenCalled();
    adapter.dispose();
    button.className = "mdi-pause";
    radio.dispatchEvent(new Event("play", { bubbles: false }));
    expect(stop).toHaveBeenCalledOnce();
    expect(pauseRoom).not.toHaveBeenCalled();
    pauseRadio.mockRestore();
    pauseRoom.mockRestore();
  });
  it("dispose 取消已排队的适配", async () => {
    const adapter = new SidebarMediaEntry(vi.fn());
    document.body.innerHTML = markup;
    adapter.dispose();
    await flush();
    expect(document.querySelector("#imw-media-progress-entry")).toBeNull();
  });

  it("开关行常驻入口之后，媒体消失退回分组末尾，重建后唯一且保留点亮", async () => {
    document.body.innerHTML = markup;
    const mode = new PlaybackMode();
    mode.applySnapshot(snapshot());
    const row = new SidebarPlaybackRow(mode);
    const changes: boolean[] = [];
    const adapter = new SidebarMediaEntry(
      vi.fn(),
      document,
      row.element,
      (present) => {
        changes.push(present);
        mode.setMediaPresent(present);
      },
    );
    // 首次适配同步回调媒体存在性，后续每次重建都会再回报一次。
    expect(changes).toEqual([true]);
    await flush();
    expect(document.querySelectorAll("#imw-playback-controls")).toHaveLength(1);
    expect(row.element.previousElementSibling?.id).toBe(
      "imw-media-progress-entry",
    );
    document.getElementById("imw-toggle-loop")!.click();
    expect(
      document.getElementById("imw-toggle-loop")!.getAttribute("aria-pressed"),
    ).toBe("true");
    for (let index = 0; index < 2; index++) {
      document.getElementById("functionHolderBox")!.outerHTML = markup;
      await flush();
      expect(document.querySelectorAll("#imw-playback-controls")).toHaveLength(
        1,
      );
      expect(document.getElementById("imw-playback-controls")).toBe(
        row.element,
      );
      expect(row.element.previousElementSibling?.id).toBe(
        "imw-media-progress-entry",
      );
      expect(
        document
          .getElementById("imw-toggle-loop")!
          .getAttribute("aria-pressed"),
      ).toBe("true");
    }
    expect(changes.length).toBeGreaterThanOrEqual(3);
    expect(changes.filter((present) => !present)).toEqual([]);
    // 媒体行消失：行保留并退回分组末尾，两按钮灰化、点亮态清零。
    document
      .getElementById("shareMediaBox")!
      .closest(".functionButtonExt")!
      .remove();
    await flush();
    expect(changes.at(-1)).toBe(false);
    expect(document.getElementById("imw-media-progress-entry")).toBeNull();
    expect(document.querySelectorAll("#imw-playback-controls")).toHaveLength(1);
    const box = document.getElementById("functionHolderExtBox")!;
    expect(box.lastElementChild).toBe(row.element);
    // 媒体消失只禁循环；收藏随机不依赖当前媒体，仍可开启。
    expect(
      document.getElementById("imw-toggle-loop")!.getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      document.getElementById("imw-toggle-loop")!.getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      document
        .getElementById("imw-toggle-shuffle")!
        .getAttribute("aria-disabled"),
    ).toBe("false");
    box.insertAdjacentHTML(
      "beforeend",
      '<div class="functionButtonExt"><div id="shareMediaBox"></div></div>',
    );
    await flush();
    expect(changes.at(-1)).toBe(true);
    expect(row.element.previousElementSibling?.id).toBe(
      "imw-media-progress-entry",
    );
    expect(
      document.getElementById("imw-toggle-loop")!.getAttribute("aria-disabled"),
    ).toBe("false");
    // 适配器只解除适配，行元素归 SidebarPlaybackRow 自己移除。
    adapter.dispose();
    expect(document.querySelector("#imw-media-progress-entry")).toBeNull();
    expect(document.querySelector("#imw-playback-controls")).toBe(row.element);
    row.dispose();
    expect(document.querySelector("#imw-playback-controls")).toBeNull();
  });

  it("开关行继承侧栏主题，适配器卸载后仍由行自行移除", async () => {
    document.body.innerHTML = `<div id="functionHolder" style="background-color: rgb(16, 16, 16)">${markup}</div>`;
    const row = new SidebarPlaybackRow(new PlaybackMode());
    const adapter = new SidebarMediaEntry(vi.fn(), document, row.element);
    expect(row.element.dataset.imwTheme).toBe("dark");
    document.getElementById("functionHolder")!.outerHTML =
      `<div id="functionHolder" style="background-color: rgb(224, 224, 224)">${markup}</div>`;
    await flush();
    expect(document.getElementById("imw-playback-controls")).toBe(row.element);
    expect(row.element.dataset.imwTheme).toBe("light");
    adapter.dispose();
    expect(document.querySelector("#imw-media-progress-entry")).toBeNull();
    expect(document.getElementById("imw-playback-controls")).toBe(row.element);
    row.dispose();
    expect(document.getElementById("imw-playback-controls")).toBeNull();
  });

  it("分组缺失时不抛错、不创建行元素，并回报无当前媒体", () => {
    document.body.innerHTML =
      '<div class="functionBtnFont">盒子</div><div id="shareMediaBox"></div>';
    const row = new SidebarPlaybackRow(new PlaybackMode());
    const changes: boolean[] = [];
    let adapter: SidebarMediaEntry | undefined;
    expect(() => {
      adapter = new SidebarMediaEntry(
        vi.fn(),
        document,
        row.element,
        (present) => changes.push(present),
      );
    }).not.toThrow();
    expect(changes).toEqual([false]);
    expect(document.querySelector("#imw-playback-controls")).toBeNull();
    expect(document.querySelector("#imw-media-progress-entry")).toBeNull();
    adapter?.dispose();
    row.dispose();
  });
});
