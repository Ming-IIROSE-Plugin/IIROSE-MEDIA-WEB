// B 站设置的类型、节点目录与读取接口。
//
// `BiliBiliSettings`（读写）与 `bilibiliSettingsMenus`（设置页的 UI 构造）共用这里，
// 菜单模块只依赖这份「读取面」，不 import 类，避免两者互相引用。

import type { BilibiliACC } from "../../Account/BiliBili/BilibiliAccountInterface";

export interface BilibiliVideoSettings {
  qn: number;
  streamqn: number;
  streamSeconds: number;
  videoStreamFormat: number;
  api: "HK" | "Guangzhou";
}

export type BilibiliApiId = BilibiliVideoSettings["api"];

/** 默认 API 节点：旧的开发者节点和未知值都回落到它。 */
export const DEFAULT_BILIBILI_API: BilibiliApiId = "Guangzhou";

/**
 * API 节点目录：id / 文案 / 图标**逐项绑定**，顺序即设置项展示顺序。
 * 以前是两份按下标对齐的数组，隐藏其中一项就会把图标错位到别的行上。
 */
export const BILIBILI_API_NODES: {
  id: BilibiliApiId;
  label: string;
  icon: string;
}[] = [
  { id: "HK", label: "香港-海外优化", icon: "imwApiNodeIcon" },
  { id: "Guangzhou", label: "广州-中国优化", icon: "imwApiNodeIcon" },
];

/** 菜单需要的读取面：`BiliBiliSettings` 结构性满足它。 */
export interface BilibiliSettingsReader {
  getBiliBiliAccount(): BilibiliACC | null;
  parseCookie(cookie: string): Record<string, string>;
  parseBilibiliVideoQn(qn: number): string;
  parseBilibiliLiveQn(qn: number): string;
  parseGetVideoFormat(format: number): string;
  parseBilibiliApi(api: BilibiliApiId): string;
  normalizeBilibiliApi(raw: unknown): BilibiliApiId;
}
