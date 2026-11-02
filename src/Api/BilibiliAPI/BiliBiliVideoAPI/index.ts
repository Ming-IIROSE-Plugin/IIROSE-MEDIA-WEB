import { BiliBiliWatchApi } from "./watch";

/**
 * B 站视频接口的统一出口。
 *
 * 实现按用途拆在同目录：`video`（详情 / 播放地址 / 分 P 与合集）、`interaction`
 * （点赞 / 投币 / 收藏 / 分享 / 投诉）、`tag`（标签）、`recommend`（推荐与互动视频）、
 * `watch`（进度 / 心跳 / 在线人数 / AI 总结）；共用响应解析在 `shared`。
 *
 * 五个模块以静态继承链相连（都派生自 `SendFetch`），这里继承链尾即可拿到全部静态成员，
 * 方法名只在各自模块里出现一次（用成员别名反而会重复一遍长方法名）；调用点仍是
 * `BiliBiliVideoApi.getXxx(...)`。
 *
 * 注意：链上任何一环都不要声明 `cors` / `cncors` / `malaysiacors` / `devcors` 同名静态字段，
 * `getBilibiliCors()` 是靠 `this` 沿链读到 `SendFetch` 上那四个值的。
 */
export class BiliBiliVideoApi extends BiliBiliWatchApi {}
