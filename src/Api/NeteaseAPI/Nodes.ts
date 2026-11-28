/**
 * 网易云优先节点的单一真源：读取端（`SendFetch.getNeteaseCors`）、
 * 设置写入端与展示文案都从这里派生，新增/改名节点只改这一处。
 */
export type NeteaseNodeId = "default" | "HK";

export interface NeteaseNode {
  id: NeteaseNodeId;
  /** 设置项展示文案（也是解析后回写设置标题的文本） */
  label: string;
  /** 宿站设置弹窗的元素图标 class（需配合 `font-family:md` 使用） */
  icon: string;
  /** 对应的 `SendFetch` 代理常量名 */
  cors: "cncors" | "malaysiacors";
}

export const NETEASE_NODES: NeteaseNode[] = [
  {
    id: "default",
    label: "广州-默认节点",
    icon: "imwApiNodeIcon",
    cors: "cncors",
  },
  {
    id: "HK",
    label: "香港-海外优化",
    icon: "imwApiNodeIcon",
    cors: "malaysiacors",
  },
];

/** 未知/缺失的存量值一律回落默认节点（广州） */
export function getNeteaseNode(api: string | undefined | null): NeteaseNode {
  return NETEASE_NODES.find((node) => node.id === api) ?? NETEASE_NODES[0];
}
