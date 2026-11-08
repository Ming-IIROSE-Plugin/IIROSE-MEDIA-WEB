import { loadPluginSetting } from "../settings/pluginSettings/loadSettings";
import { panelEntryAllowsSwipe } from "../settings/pluginSettings/normalize";
import { isPanelOpen } from "./panelPresence";

export class Gesture {
  static startY: number = 0;
  // 重命名为通用的回调
  static onTrigger?: () => void;
  static ShowHideMainApp?: () => void;
  constructor(callback: () => void) {
    Gesture.onTrigger = callback;
  }
  public static IMCActiveEventHandler = (
    event: MouseEvent | TouchEvent,
  ): void => {
    event.stopImmediatePropagation();
    if (event instanceof TouchEvent) {
      this.handleTouchStart(event); // 这里的 this 指向 Gesture 类
    }
  };

  private static handleTouchMove = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      if (this.startY === 0) return;
      const deltaY = event.touches[0].clientY - this.startY;
      const threshold = window.innerHeight / 5;

      if (deltaY > threshold) {
        this.startY = 0;
        event.preventDefault();
        event.stopPropagation();

        // 执行 Preact 组件传过来的方法
        if (this.ShowHideMainApp) {
          this.ShowHideMainApp();
        }

        // 触发后移除监听，防止单次滑动重复触发
        this.touchEnd();
      }
    }
  };

  public static touchEnd = (): void => {
    this.startY = 0;
    // 注意：因为 handleTouchMove 是箭头函数，不需要 .bind(this)
    window.removeEventListener("touchmove", this.handleTouchMove);
  };

  public static handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      // 「点歌台入口」的档位：只用胶囊时不响应，只收起时面板关着不响应。
      // 不放行就不挂 touchmove，宿站的双指操作完全不受影响。
      const { panelEntry } = loadPluginSetting();
      if (!panelEntryAllowsSwipe(panelEntry, isPanelOpen())) return;
      this.startY = event.touches[0].clientY;
      window.addEventListener("touchmove", this.handleTouchMove);
    }
  };
}
