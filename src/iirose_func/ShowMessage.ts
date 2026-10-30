export class ShowMessage {
  /** 已弹出的提示条数：点播守卫据此判断一次点播是否以失败提示收场。 */
  public static shownCount = 0;

  public static show(message: string) {
    if (!window._alert) return;
    ShowMessage.shownCount++;
    window._alert(message);
  }
}
