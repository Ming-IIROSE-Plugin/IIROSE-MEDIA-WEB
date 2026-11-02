/**
 * 宿站页面上的 jQuery 对象。这里只声明插件实际调用的方法：
 * 引入 @types/jquery 会连带把宿站 DOM 的所有假定写进类型面，收益不值这个体积。
 */
interface HostJQuery {
  /** jQuery 对象可按下标取到 DOM 元素（宿站侧栏关闭逻辑依赖这一点）。 */
  [index: number]: HTMLElement;
  stop(): HostJQuery;
  fadeOut(duration?: number, complete?: () => void): HostJQuery;
  css(property: string, value: string): HostJQuery;
}

declare global {
  interface Window {
    _alert?: (message: string) => void;

    /**
     * 宿站账号标识；实测在 messages.html 上下文可直接读取，13 位 hex，
     * 跨登出/重登稳定不变。收藏云同步以它作为分区键（非凭据）。
     */
    uid?: string;

    /**
     * 宿站展示昵称（可改，仅供展示，禁止用作任何键）
     */
    myself?: string;

    Info?: {
      room?: {
        identity?: unknown;
      };
    };
    shareMediaCurrentTime?: unknown;
    shareMediaDuration?: unknown;
    mediaShareRoom?: boolean;
    theme?: unknown;
    rank?: unknown;
    roomnFull?: unknown;
    socket?: { readyState: number; send?: (command: string) => void };
    shareMedia?: (...args: unknown[]) => unknown;

    functionBtnDo(e: number, t?: undefined, o?: undefined): void;

    /**
     * 显示图片
     * @param e img的链接
     * @param t 布尔值
     */
    showImg(e: string, t?: boolean): void;

    /**
     * 一些工具函数
     */
    Utils?: {
      /**
       * 开启输入框
       * @param e 模式, 0,1,2,3,4
       * @param t
       * @param o 回调函数
       * @returns
       */
      sync: (
        e: number,
        t: (number | string)[],
        o: (a: string | null) => void,
      ) => void;
      /**
       * 创建一个选择框
       * @param i 触发元素
       * @param a 2D数组，结构为类似 [[0, "选项1", "HTML字符串"], [1, "选项2", "HTML字符串"]]
       * @param s 回调函数
       * @param e 是否禁止清空选项 (禁止点空白的地方返回)
       * @param t 是否显示图标
       * @param o 自定义HTML字符串，出现在顶端
       * @param r 是否启用多选功能
       * @param l 自定义HTML字符串，出现在底端
       * @param n 返回（点击空白处）的回调函数
       */
      buildSelect2: (
        i: HTMLElement | undefined | null,
        a: (string | number)[][],
        s: (t: HTMLElement, s: string) => void,
        e: boolean,
        t: boolean,
        o: string | undefined | null,
        r: boolean,
        l: string | undefined | null,
        n: () => void,
      ) => void;
      imgReady: {
        set: (e: HTMLImageElement, t?: string) => void;
      };

      service: {
        getUserCard: (uid: string, type: number) => void;
        moveinputDo: (e: string, t: undefined) => void;
      };
      IMW?: {
        backup: {
          moveinputDo: (e: string, t: undefined) => void;
        };
      };
    };

    Objs?: {
      repertory: {
        albumShowHolder: HostJQuery;
        albumShow: AlbumShow;
        albumShowHolderAnimate: HostJQuery;
      };

      mapHolder: {
        Assets: {
          userJson: string;
        };
      };
    };

    Constant?: {
      Others: {
        transform: string;
      };
    };
    Probe: {
      gestureMouseEvent: boolean; // 是否在处理手势事件
      getMediaLink: number; // 如果为1则获取媒体链接，经常用于更换背景音乐
      functionHolderAnimate: number;
    };

    functionHolder: HostJQuery;
    functionHolderDarker: HostJQuery;
    functionHolderP: number;
    isMobile: boolean;
    functionHolderSlider: HTMLDivElement;
  }
}

interface AlbumShow extends HTMLImageElement {
  resetScroll(): void;
}
