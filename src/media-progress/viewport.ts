// 宿站通过 zoom 缩放 iframe 文档：offset 尺寸与 client 坐标之间用实测比例换算。
// 播放进度浮窗与收藏随机面板共用这套换算，拖动与视口约束的口径一致。

export type ViewportMetrics = {
  scale: number;
  width: number;
  height: number;
};

export function viewportMetrics(element: HTMLElement): ViewportMetrics {
  const rect = element.getBoundingClientRect();
  // 量的是宿站缩放：元素自身的 `scale`（窗口开合、最小化的收缩）要除掉，否则视口会被算大。
  const ownScale = parseFloat(getComputedStyle(element).scale) || 1;
  const scale = rect.width / (element.offsetWidth * ownScale) || 1;
  const viewport = window.visualViewport;
  return {
    scale,
    width: (viewport?.width || window.innerWidth) / scale,
    height: (viewport?.height || window.innerHeight) / scale,
  };
}

/** 当前可见区域：缩放比例、尺寸与（页面滚动 + visualViewport 平移）偏移。 */
export function currentViewportPosition(element: HTMLElement) {
  const metrics = viewportMetrics(element);
  return {
    metrics,
    offsetLeft:
      (window.scrollX + (window.visualViewport?.offsetLeft || 0)) /
      metrics.scale,
    offsetTop:
      (window.scrollY + (window.visualViewport?.offsetTop || 0)) /
      metrics.scale,
  };
}

/** client 坐标换算成面板 left/top 所用的坐标。 */
export function pointerPosition(
  element: HTMLElement,
  clientX: number,
  clientY: number,
) {
  const { metrics } = currentViewportPosition(element);
  return {
    x:
      (clientX + window.scrollX + (window.visualViewport?.offsetLeft || 0)) /
      metrics.scale,
    y:
      (clientY + window.scrollY + (window.visualViewport?.offsetTop || 0)) /
      metrics.scale,
  };
}
