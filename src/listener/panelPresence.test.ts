import { afterEach, describe, expect, it } from "vitest";
import {
  isHostTextTarget,
  isPanelOpen,
  isPanelWindowed,
  setPanelPresence,
} from "./panelPresence";

afterEach(() => {
  setPanelPresence({ open: false, windowed: false });
  document.body.innerHTML = "";
});

const add = (html: string, selector: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host.querySelector(selector) as HTMLElement;
};

describe("isHostTextTarget", () => {
  it("只在窗口开着时为真", () => {
    const chat = add("<textarea id='moveinput'></textarea>", "textarea");
    expect(isHostTextTarget(chat)).toBe(false);
    setPanelPresence({ open: true });
    expect(isHostTextTarget(chat)).toBe(false);
    setPanelPresence({ open: false, windowed: true });
    expect(isHostTextTarget(chat)).toBe(false);
    setPanelPresence({ open: true, windowed: true });
    expect(isHostTextTarget(chat)).toBe(true);
    expect(isPanelOpen()).toBe(true);
    expect(isPanelWindowed()).toBe(true);
  });

  it("插件自己的输入框不算；非编辑元素和空目标不算", () => {
    setPanelPresence({ open: true, windowed: true });
    expect(
      isHostTextTarget(
        add("<div id='IIROSE_MEDIA_CONTAINER'><input></div>", "input"),
      ),
    ).toBe(false);
    expect(
      isHostTextTarget(
        add("<div id='imw-episode-picker-root'><input></div>", "input"),
      ),
    ).toBe(false);
    expect(isHostTextTarget(add("<button></button>", "button"))).toBe(false);
    expect(isHostTextTarget(document.body)).toBe(false);
    expect(isHostTextTarget(null)).toBe(false);
    expect(isHostTextTarget(window)).toBe(false);
  });
});
