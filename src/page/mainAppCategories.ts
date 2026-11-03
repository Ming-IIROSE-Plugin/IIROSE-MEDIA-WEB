// mainAppCategories.ts
//
// 视图层的映射：把「平台检索」的集中描述（`platforms/platformSearchSources`）翻成
// 点歌台要的 `Categories`。这里只做结构性映射，不写取数逻辑；平台与范围的增删改
// 全在描述表里完成，新增平台不改这一层。

import {
  PLATFORM_SEARCH_SOURCES,
  type PlatformSearchRange,
  type PlatformSearchSource,
} from "../platforms/platformSearchSources";

/**
 * 分类表向容器要的那一口：表里的 `searchAction` 会在任意时刻被用户触发，
 * 所以一律当场去问（上下文、每页条数、刷新计数、宿主回调），不在建表时取值。
 */
export interface MainAppCategoriesHost {
  getActionContext(): MainAppContainerActionContext;
  /** 按模式取每页条数（收藏跟随设置，其余固定）。 */
  pageSizeFor(mode: number): number;
  /** 收藏列表的每页条数（跟随设置项的收藏分页）。 */
  favoritesPageSize(): number;
  /** 哔哩哔哩「推荐」的刷新计数（每次刷新自增）。 */
  bilibiliRefreshCount: number;
  /** 宿站回调：直接给 props 上的函数引用（调用点会比对同一性）。 */
  readonly changeSearchKeyword: (keyword: string | null) => void;
  readonly showOrHideIMC: () => Promise<void>;
}

/** 把一个范围的取数动作包成点击时才取值的闭包（只取它声明的那一族入参）。 */
function searchAction(
  host: MainAppCategoriesHost,
  range: PlatformSearchRange,
  sizeOf: () => number,
): () => void {
  // 一个范围只应声明一族取数动作：多族同时出现时按优先级静默丢掉其余族，
  // 会让配置错误看起来一切正常，所以这里直接报错（开发期立刻暴露）。
  const families = ["ctx", "page", "refresh", "desk"].filter(
    (key) => key in range,
  );
  if (families.length > 1)
    throw new Error(
      `范围「${range.title}」声明了多族取数：${families.join("/")}`,
    );

  if ("ctx" in range) {
    const load = range.ctx;
    return () => load(host.getActionContext());
  }
  if ("page" in range) {
    const load = range.page;
    return () => load(host.getActionContext(), sizeOf());
  }
  if ("refresh" in range) {
    const load = range.refresh;
    return () =>
      load(host.getActionContext(), {
        get: () => host.bilibiliRefreshCount,
        increment: () => {
          host.bilibiliRefreshCount++;
        },
      });
  }
  const load = (range as { desk?: typeof range.desk }).desk;
  if (typeof load !== "function")
    throw new Error(`范围「${range.title}」没有声明取数动作`);
  return () =>
    load(host.getActionContext(), {
      changeSearchKeyword: host.changeSearchKeyword,
      showOrHideIMC: host.showOrHideIMC,
    });
}

/** 一个描述来源 → 一个 `Platform`（title / shortTitle / sourceKey / 范围行）。 */
function toPlatform(
  host: MainAppCategoriesHost,
  source: PlatformSearchSource,
  mode: number,
): Platform {
  return {
    title: source.title,
    shortTitle: source.shortTitle,
    ...(source.sourceKey ? { sourceKey: source.sourceKey } : {}),
    subNavBarItems: source.ranges.map((range) => ({
      title: range.title,
      ...(range.search ? { class: "search" } : {}),
      ...(range.phoneOnly ? { phoneOnly: true } : {}),
      searchAction: searchAction(host, range, () =>
        source.pageSizeOf === "favorites"
          ? host.favoritesPageSize()
          : host.pageSizeFor(mode),
      ),
    })),
  };
}

/** 六种模式各自的来源与范围；下标即模式下标（数据见 `platformSearchSources`）。 */
export function createCategories(host: MainAppCategoriesHost): Categories[] {
  return PLATFORM_SEARCH_SOURCES.map((sources, mode) => ({
    platform: sources.map((source) => toPlatform(host, source, mode)),
  }));
}
