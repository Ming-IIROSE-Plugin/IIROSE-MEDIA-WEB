---
ticket: 5
title: 启动时序与轮询启停
type: feature
status: done
baseline_revision: 10fa8c8
route: oneshot
review: quick
lenses_ran:
- quick
context:
- src/environment/Environment.ts
- src/media-progress/HostMediaBridge.ts
---
# Story 5 — 启动时序与轮询启停

## Intent

<frozen-after-approval>

IP 归属探测结果按天缓存，缓存命中时不再请求 `ipinfo.io`；探测失败或应答无效时回退到测速选代理，且不写缓存。媒体状态轮询在没有订阅者时停止（既有行为，用单测锁定）。

验收标准：

- Given 同一天第二次进入站点，When 插件初始化，Then 不再请求 `ipinfo.io`。
- Given 首次进入且网络不可用，When 探测失败或应答缺少 `country`，Then 回退到测速且不写缓存。
- Given 媒体桥没有订阅者，When 观察定时器，Then 不存在轮询；最后一个订阅者退订后定时器被清掉。
- Given `npm test` 与 `npm run build`，When 执行它们，Then 全部通过。

</frozen-after-approval>

## Implementation Notes

- `Environment.setEnv` 返回 `setCors()` 的 Promise；归属结果存 `localStorage.imwClientLocation`（`{location, at}`，24h TTL），命中即直接写 `ClientLocation` 与代理，不再请求 ipinfo。
- 探测失败判定修正：`!res.ok`、`res.json()` 抛错、`country` 非字符串都算失败，走测速且不缓存；此前会把一次坏应答钉死一天。
- 测速修正：只统计 `ok` 的响应，全部失败时兜底写入香港代理，避免后续拼出 `undefinedhttps://…`；`sendGet` 传 `warn=false`，不再弹失败提示。
- 未引入 `ready()` 就绪信号：调用方需要的是同步取代理（`UrlExtractor`）或请求前拼 URL（B 站 API），都不在可等待的位置；`SendFetch.cors` 的静态取值又与 `iirosemedia.cors` 属两套代理，贸然接通会改变既有出网路径。
- 轮询：`HostMediaBridge` 的「首个订阅者起表、末个订阅者停表」是既有行为，本次只补单测锁定（无订阅者时计时器数为 0，退订后归零）。
- 验证：`npm test` 69 文件 / 1252 用例全绿；`npm run build` 通过，产物 444.62 kB（gzip 133.60 kB）。

## Review Triage Log

- `selectCorsBySpeed` 未被 await，`ready()` 会在代理未写入时返回：patch，`setCors` 改为 await；随后的复核确认没有可等待的调用点，因此不再引入 `ready()`。
- 测速把失败也算作有效耗时、`requestTimes.length` 守卫是死代码：patch，只统计 `ok` 响应并给兜底值。
- 无效 ipinfo 应答被缓存 24 小时：patch，加 `res.ok`、JSON、`country` 三重校验，失败不写缓存。
- `ready()` 的超时定时器不回收、无法区分就绪与超时：patch，删除该 API（无调用点）。
- `Environment.ready()` 无调用点、启动竞态未修：patch，见上，改用缓存消除重复探测；代理取值分叉记为非目标。
- 常驻 250ms 轮询未触及，CAP-2 降级未写进 SPEC：patch，SPEC 的 Non-goals 已写明「按需订阅未实现」，`Why` 删去了轮询痛点。
- 失败回退用例断言过弱：patch，改为断言选中的具体代理、断言不写缓存、断言全部失败时的兜底值。
