import { ShowMessage } from "../../iirose_func/ShowMessage";
import { splitByPage } from "../shared/splitByPage";
import { getNeteasePlatformDataByIds, searchNetease } from "./search";

/**
 * 搜索歌单
 * @param keyword
 * @param page
 * @returns
 */
export const searchMusicsBasics = async (
  keyword: string,
  page: number,
  itemPerPage: number,
  /** 详情获取器：默认走模块实现，平台层传入类成员以便继续可被替换。 */
  fetchDetails: typeof getNeteasePlatformDataByIds = getNeteasePlatformDataByIds,
) => {
  try {
    const searchData = await searchNetease(keyword, page, "song", itemPerPage);

    if (!searchData)
      return { platformData: [], totalPage: 0, allPlatformData: [] };

    const ids = searchData.ids;
    const totalPage = searchData.totalPage;

    const pd = await fetchDetails(ids, "song");

    if (!pd) return { platformData: [], totalPage: 0, allPlatformData: [] };

    const { platformData, allPlatformData } = splitByPage(pd, itemPerPage);

    return { platformData, totalPage, allPlatformData };
  } catch (error) {
    ShowMessage.show((error as Error).message);
    ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
    return { platformData: [], totalPage: 0, allPlatformData: [] };
  }
};

/**
 * @description 搜索歌单
 * @param keyword
 * @param page
 * @returns
 */
export const searchMusicListBasics = async (
  keyword: string,
  page: number,
  itemPerPage: number,
) => {
  try {
    const searchData = await searchNetease(
      keyword,
      page,
      "playlist",
      itemPerPage,
    );
    if (!searchData)
      return { platformData: [], totalPage: 0, allPlatformData: [] };

    const mediaCardData = searchData.mediaCardData;

    const totalPage = searchData.totalPage;

    if (!mediaCardData)
      return { platformData: [], totalPage: 0, allPlatformData: [] };

    const { platformData, allPlatformData } = splitByPage(
      mediaCardData,
      itemPerPage,
    );

    return { platformData, totalPage, allPlatformData };
  } catch (error) {
    ShowMessage.show((error as Error).message);
    ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
    return { platformData: [], totalPage: 0, allPlatformData: [] };
  }
};

/**
 * @description 搜索专辑
 * @param keyword
 * @param page
 * @returns
 */
export const searchAlbumBasics = async (
  keyword: string,
  page: number,
  itemPerPage: number,
) => {
  try {
    const searchData = await searchNetease(keyword, page, "album", itemPerPage);
    if (!searchData)
      return { platformData: [], totalPage: 0, allPlatformData: [] };

    const totalPage = searchData.totalPage;

    const mediaCardData = searchData.mediaCardData;

    if (!mediaCardData)
      return { platformData: [], totalPage: 0, allPlatformData: [] };

    const { platformData, allPlatformData } = splitByPage(
      mediaCardData,
      itemPerPage,
    );

    return { platformData, totalPage, allPlatformData };
  } catch (error) {
    ShowMessage.show((error as Error).message);
    ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
    return { platformData: [], totalPage: 0, allPlatformData: [] };
  }
};

/**
 * @description 搜索MV
 * @param keyword
 * @param page
 * @returns
 */
export const searchMvBasics = async (
  keyword: string,
  page: number,
  itemPerPage: number,
) => {
  try {
    const searchData = await searchNetease(keyword, page, "mv", itemPerPage);

    if (!searchData)
      return { platformData: [], totalPage: 0, allPlatformData: [] };

    const totalPage = searchData.totalPage;

    const mediaCardData = searchData.mediaCardData;

    if (!mediaCardData)
      return { platformData: [], totalPage: 0, allPlatformData: [] };

    const { platformData, allPlatformData } = splitByPage(
      mediaCardData,
      itemPerPage,
    );

    return { platformData, totalPage, allPlatformData };
  } catch (error) {
    ShowMessage.show((error as Error).message);
    ShowMessage.show("遇到了一些问题，你可以在设置中切换API以解决");
    return { platformData: [], totalPage: 0, allPlatformData: [] };
  }
};
