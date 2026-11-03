// pagedLoader.ts

/**
 * 分页结果的公共编排：`mediaData` 一直是「当前页 + 总页数」的 Promise。
 * 导出三条路径——`showPage`（命中缓存只装 Promise）、`showLocalList`（整表切片）、
 * `loadPage`（翻页 + 票号 + 追加），取数语义（一次取全再切页 / 逐页累加 / 本地过滤）
 * 仍归各 Service。
 */

/** `mediaData` 的数据面：当前页与总页数。 */
export interface PagePayload {
  platformData: PlatformData[];
  totalPage: number;
}

/** 平台层分页结果的公共形状：多发出来的那一截留在本地缓存。 */
export interface PagedResult extends PagePayload {
  /** 本次新增的条目：落地后追加到 `allMediaData`；缺省表示没有可追加的内容（含失败），`loadPage` 会代为解除 `updating`。 */
  allPlatformData?: PlatformData[];
}

/** 当前页在完整列表里的切片（不夹页码：调用方已判定该页命中缓存）。 */
export function sliceCachedPage(
  allMediaData: PlatformData[],
  currentPage: number,
  itemsPerPage: number,
): PlatformData[] {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return allMediaData.slice(startIndex, startIndex + itemsPerPage);
}

/**
 * 缓存命中：把已经算好的当前页装进 `mediaData`。
 * 不动 `requestToken` / `updating`——没有发起新请求。
 * 返回装进去的那份 Promise（电台按承诺对象记「已加载过」）。
 */
export function showPage(
  ctx: MainAppContainerActionContext,
  page: PagePayload,
  onDemandPlay: (data: PlatformData) => void,
): Promise<PagePayload> {
  const pending = Promise.resolve(page);
  ctx.setState({
    mediaData: pending,
    currentOnDemandPlay: onDemandPlay,
  });
  return pending;
}

/**
 * 整张列表一次取全的场景（收藏 / 最近点播）：夹页码、切出当前页，
 * 再把列表与当前页一并落地，`updating` 收尾为 false。
 */
export function showLocalList(
  ctx: MainAppContainerActionContext,
  allMediaData: PlatformData[],
  options: {
    currentPage: number;
    itemsPerPage: number;
    onDemandPlay: (data: PlatformData) => void;
  },
): void {
  const { currentPage, itemsPerPage, onDemandPlay } = options;
  const totalPage = Math.ceil(allMediaData.length / itemsPerPage);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPage || 1);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;

  ctx.setState({
    updating: false,
    currentPage: safeCurrentPage,
    totalPage,
    allMediaData,
    mediaData: Promise.resolve({
      platformData: allMediaData.slice(startIndex, startIndex + itemsPerPage),
      totalPage,
    }),
    currentOnDemandPlay: onDemandPlay,
  });
}

export interface LoadPageOptions<R extends PagedResult> {
  /** 发起本页请求：页码口径由调用方按平台算好。 */
  fetch: () => Promise<R>;
  /** 本次落地的点播入口。 */
  onDemandPlay: (data: PlatformData) => void;
  /**
   * 落地成功的收尾（电台记「已加载过一次」）：拒绝时不调用，
   * 第二个参数就是装进 `mediaData` 的那份 Promise。
   */
  onFulfilled?: (res: R, pending: Promise<R>) => void;
}

/**
 * 翻页出网：置 `updating` 与新票号、把请求 Promise 装进 `mediaData`，
 * 落地后凭票号追加到 `allMediaData`（`pushAllData` 自己校验票号）。
 * `updating` 期间直接返回 null，不发第二次请求。
 */
export function loadPage<R extends PagedResult>(
  ctx: MainAppContainerActionContext,
  options: LoadPageOptions<R>,
): Promise<R> | null {
  const { updating, requestToken } = ctx.getState();
  if (updating) return null;

  const currentRequestToken = requestToken + 1;
  ctx.setState({ updating: true, requestToken: currentRequestToken });

  const pending = options.fetch();
  ctx.setState({
    mediaData: pending,
    currentOnDemandPlay: options.onDemandPlay,
    requestToken: currentRequestToken,
  });

  pending.then((res) => {
    options.onFulfilled?.(res, pending);
    if (res.allPlatformData) {
      ctx.pushAllData(currentRequestToken, res.allPlatformData, res.totalPage);
      return;
    }
    // 没有可追加的条目（失败或单页结果）：这里就是本次请求唯一的解除点，
    // 否则 updating 会一直挂着，之后所有翻页都会被守卫拦住。
    if (ctx.getState().requestToken === currentRequestToken)
      ctx.setState({ updating: false });
  });

  return pending;
}
