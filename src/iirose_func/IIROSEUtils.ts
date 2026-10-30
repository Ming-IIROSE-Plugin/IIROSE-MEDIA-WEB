export class IIROSEUtils {
  /**
   * 开启输入框
   * @param e 模式, 0,1,2,3,4
   * @param t t[0] 为标题，t[1] 如果是数字，那就是字数限制，如果是'number'，那么开启的输入框会是数字输入框，t[2] 为字数限制
   * @param o 回调函数
   * @returns
   */
  public static sync(
    e: number,
    t: (number | string)[],
    o: (userInput: string | null) => void,
  ) {
    if (!window.Utils) return;
    window.Utils.sync(e, t, o);

    const syncHolder = document.getElementById("syncHolder");

    if (syncHolder) {
      let syncHolderOutside = document.getElementById("syncHolderOutside");
      if (!syncHolderOutside) {
        syncHolderOutside = document.createElement("div");
        syncHolderOutside.id = "syncHolderOutside";
        syncHolderOutside.onclick = () => {
          const syncPromptHolder = syncHolder.childNodes[0];
          const contentItemBtn = syncPromptHolder.childNodes[3];
          const cancelBtn = contentItemBtn.childNodes[0] as HTMLButtonElement;
          if (cancelBtn) cancelBtn.click();
        };
        syncHolder.appendChild(syncHolderOutside);
      }
    }
  }

  /**
   * 创建一个选择框（透传宿站实现）。
   *
   * 有序多选的接管（`selectedQueue` / 序号徽章 / 吸底确定钮 / 零延迟定时器补丁）已随
   * story 5 的选集面板（`episode-picker`）删除：选集不再经宿站弹窗，这里只服务设置 / 关于
   * 等取值类单选。`r` 仍原样传给宿站（宿站自身的多选行为不变）。
   */
  public static buildSelect2(
    i: HTMLElement | undefined | null,
    a: (string | number)[][],
    s: (t: HTMLElement, s: any) => void,
    e: boolean,
    t: boolean,
    o: string | undefined | null,
    r: boolean,
    l: string | undefined | null,
    n: () => void,
  ) {
    if (!window.Utils) return;
    window.Utils.buildSelect2(i, a, s, e, t, o, r, l, n);
  }

  public static getUserCard(uid: string) {
    if (!window.Utils) return;
    const a = document.createElement("span");
    a.innerHTML = uid;
    a.className = `followName2`;
    window.Utils.service.getUserCard.call(a, uid, 1);
  }
}
