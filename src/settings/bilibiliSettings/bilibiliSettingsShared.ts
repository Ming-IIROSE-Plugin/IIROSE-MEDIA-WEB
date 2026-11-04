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
  api: "HK" | "Guangzhou" | "Dev";
}

export type BilibiliApiId = BilibiliVideoSettings["api"];

/** 默认 API 节点：线上构建里未知值与不可用的节点都回落到它。 */
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
  { id: "HK", label: "香港-海外优化", icon: "mdi-crosshairs-gps" },
  { id: "Guangzhou", label: "广州-中国优化", icon: "mdi-crosshairs-gps" },
  { id: "Dev", label: "开发者模式", icon: "mdi-dev-to" },
];

/**
 * 「开发者模式」指向 localhost:9000 且没有兜底节点，只有开发构建才可能连得上；
 * 线上构建既不提供该选项，也要把存档里残留的 Dev 归一化回默认节点。
 */
export function isDevApiAvailable(): boolean {
  return Boolean(import.meta.env.DEV);
}

/** 当前构建里可选的节点（线上构建不含 Dev）。 */
export function availableApiNodes() {
  return BILIBILI_API_NODES.filter(
    (node) => node.id !== "Dev" || isDevApiAvailable(),
  );
}

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
