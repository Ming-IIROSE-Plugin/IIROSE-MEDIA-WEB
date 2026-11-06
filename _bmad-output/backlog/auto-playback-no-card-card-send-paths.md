# 媒体卡片发送点与压制归属

全部卡片发送都必须经 `Announce.sendMediaCard`（档位唯一判定点）。下表是当前所有调用点，以及本 SPEC 落地后它是否受「自动播放压制」影响。

| 发送点 | 触发场景 | 压制？ |
|---|---|---|
| `NetEasePlatform.sendSongs`（经 `MOD` / `playSongIds` / 整张播放 / 选集） | 手动单曲、整张、选集、收藏随机 | 仅当由收藏随机调用时压制（作用域包住 `prepared.play()`） |
| `NetEasePlatform.MVOD` | 手动点播 MV | 否 |
| `BilibiliPlatform.VOD` | 手动单曲 / 多 P；收藏随机走 `VOD(data, 1)` | 仅收藏随机调用时压制 |
| `BilibiliPlatform` 直播分支（`LOD`） | 手动点播直播间 | 否 |
| `AllVideosPlatform.sendVideoMedia` | 手动点播视频列表项 | 否 |
| `RadioPlatform.finalODSONG` | 手动点播电台 | 否 |
| `InputPlatformAnalysis`（`@` 直链） | 手动发直链点播 | 否 |
| `LoopController` 的 `io.sendCard`（`src/page/index.tsx` 接线） | 单曲循环重播缓存报文 | 是——本 SPEC 已删除该调用与 `LoopIo.sendCard` 接口方法 |

## 压制语义

- 压制是**显式参数**，不是全局状态：`NetEasePlatform.MOD(data, { cardless: true })` 与 `BilibiliPlatform.VOD(data, 1, { cardless: true })` 把 `cardless` 逐层传到 `sendSongs` / `prepareAndSendMedia`，那里跳过 `Announce.sendMediaCard` 但照发 mediaEvent。
- 不用作用域计数：`sendSongs` 的卡片在 `await` 详情与歌词之后才发，同步作用域罩不住；跨 `await` 的作用域一旦 Promise 不落地，就会把全局判定永久卡在静默。
- 只由 `src/playback/shuffleTargets.ts` 的 `play` 闭包传 `cardless: true`；手动入口一律不传，行为与改动前一致。
- 压制期间 `mediaEvent`（`&1` 报文）照发，这是起播的唯一前提。
- 不得通过临时修改 `PluginSettings.announceMode` 实现：那会写盘、污染用户选择，并与设置面板显示的档位不一致。

## 与既有契约的关系

- `spec-request-announce-modes` 定义的三档语义不变：静默档对所有点播都不发卡片；本 SPEC 只让两条自动路径在**任意档位**下都表现为静默。
- `spec-playback-loop-shuffle` CAP-4 原写「卡片发送遵循现有播报档位」，本 SPEC 将其收窄为「收藏随机自动起播永不发卡片」，需同轮改写该 SPEC 的对应句。
- `spec-playback-loop-shuffle/loop-mechanics.md` 中「重播发缓存卡片」的描述同样需要改写。
