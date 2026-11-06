# 客户端集成 (client-integration.md)

SPEC.md 中 CAP-1…CAP-7 在本仓的落点。目标：**新增一个 `src/sync/` 模块 + 一次原地 schema 升级**，不触碰已有的播放、搜索、平台适配逻辑。

## 1. 新增模块 `src/sync/`

| 文件 | 职责 | 刻意做成 |
|---|---|---|
| `SyncCrypto.ts` | PBKDF2 派生、AES-GCM 加解密、信封编解码 | 无内部状态；只暴露 `deriveKey` / `encrypt` / `decrypt` |
| `SyncMerge.ts` | 并集合并、`createdAt` 取早、墓碑胜出判定 | **纯函数**，输入快照与本地数组，输出合并结果与统计 |
| `SyncClient.ts` | `GET` / `PUT` / `DELETE` 调用、409 冲突处理、重试与 `dirty` 标记 | 唯一出网处；`AbortSignal` 可控 |
| `SyncManager.ts` | 编排：解锁 → 拉取 → 合并 → 预览 → 上传 → 防抖；持有 `CryptoKey`（仅内存） | 单例；唯一与 UI 交互的入口 |

**密钥生命周期**：DEK 以**不可导出的 `CryptoKey` 句柄**按 uid 缓存在 IndexedDB（`IIROSE_MEDIA_SYNC_KEYS`），页面刷新后可自动解锁、无需重输口令；口令本身仍不落任何存储。清除缓存的入口是设置面板的「忘记本机密钥」。详见 `crypto-spec.md` §1.1。

## 2. IndexedDB 原地升级（关键改造）

`src/storage/FavoritesStorageService.ts`：

- `DB_VERSION` `1 → 2 → 3`：v2 补同步字段，v3 按账号隔离（主键改为 `<ownerUid>|<逻辑主键>` 并加 `ownerUid` 索引）；两次都在 `onupgradeneeded` 里原地完成，不重建 store。
- `FavoriteRecord` 新增：

| 字段 | 类型 | 用途 |
|---|---|---|
| `updatedAt` | `number` | 本条的最后修改时间；合并与 LWW 依据 |
| `deletedAt` | `number?` | 墓碑时间；有值即为已删除 |
| `dirty` | `boolean?` | 尚未同步到云端 |
| `syncedAt` | `number?` | 本条上次成功同步时间（诊断用） |

- **没有这些字段的旧记录必须在升级时补齐**：`onupgradeneeded` 里用游标遍历，为每条写入 `updatedAt = createdAt ?? Date.now()`、`deletedAt = undefined`、`dirty = true`（首次启用时全量上传的需要）。
- `remove()` 语义变更：**不物理删除**，改为写 `deletedAt + updatedAt + dirty`，并从 `cachedIds` 中移除（UI 的星标判定不受影响）。
- `add()` 需在写入时补 `updatedAt = Date.now()`、`dirty = true`；对已存在 `deletedAt` 的同键记录要清除墓碑（删除后重新收藏）。
- 新增读接口：`getAllForSync()`（含墓碑）、`applyRemoteMerge(merged)`（批量写回，一个事务内完成）。
- 新增物理清理：清理 `deletedAt` 早于 30 天的墓碑，在写事务中顺带执行。
- `isFavorited()` / `getAllIds()` 必须把墓碑视为「未收藏」——`cachedIds` 构建时跳过 `deletedAt` 有值的记录。
- `useFallback`（内存降级）路径同样要遵循新语义，否则隐私模式下行的行为与主路径不一致。

## 3. 设置项

`src/settings/pluginSettings/PluginSettings.ts` 的 `PluginSettingsInterface` 增加：

```ts
sync: {
  enabled: boolean;        // 是否启用同步
  salt: string | null;     // base64，首次启用时生成
  lastSyncAt: number | null;
  deviceId: string;        // 随机 hex，用于信封 writer 字段
  serverUrl: string;       // 函数 URL 基址
};
```

- **口令绝不入此结构**（见 `crypto-spec.md` 第 6 节）。**不提供「记住同步口令」选项**——用户已明确裁定；口令只存内存，页面刷新即失锁。
- PBKDF2 迭代次数需**真机标定**：至少在一台中低端安卓上实测解锁耗时，超标则下调但不低于 100000（信封自带 `kdf.iter`，下调不破坏既有数据）。这是上线前的必做项，不是可选项。
- 同步改在 `src/settings/localStorageUtils/LocalStorageUtils.ts` 的 `setPluginSetting()` 里补默认值，否则老用户读到 `undefined`。
- `deviceId` 与 `salt` 首次启用时惰性生成，生成后不再变。

## 4. 隐私政策版本联动（易漏）

`src/settings/commonSettings/CommonSettings.ts` 的 `TOS` / `Privacy` 带版本号，`LocalStorageUtils.setCommonSetting()` 在版本变化时会**强制把同意状态重置为未同意**，用户必须重新点同意。

同步会改变数据出境事实（收藏密文上传到维护者的云存储），因此：

- 必须在隐私政策里新增一段说明：上传内容为密文、服务端可见 uid / 大小 / 时间、uid 为半公开标识。
- **必须 `PrivacyVersion` 递增**（如 `1.0.1 → 1.0.2`），老用户会被强制重新同意一次——这是有意为之，不是 bug；须在发布说明里提前告知，避免被当成弹窗故障。

## 5. 宿站全局的类型声明

`src/iirose_func/Global.ts` 的 `declare global { interface Window { ... } }` 目前只声明了 `Objs.mapHolder.Assets.userJson`，**未声明 `uid` / `myself`**。需要补：

```ts
uid?: string;      // 宿站账号标识；实测在 messages.html 上下文可读，13 位 hex
myself?: string;   // 宿站展示昵称（可改，禁止用作键）
```

不要直接读 `userJson` 去找自己的条目——索引语义未公开，`uid` 是唯一有实测支撑的入口。

## 6. UI 入口

- 设置面板新增「云端同步」项：启用开关、口令输入、上次同步时间、「立即同步」、「清空云端」、「重置口令」。
- 收藏视图（Row 2 工具栏）在同步启用且解锁后显示同步状态；失败时用宿站提示条（`window._alert` / `ShowMessage`）反馈。
- 首次合并预览为独立确认框，展示「云端 N / 本地 M / 合并后 K」。
- 必须遵守本仓移动端约定：44px / 48px 触控目标、`max-[768px]` 断点。
- **`buildSelect2` 跨弹窗流转必须在 `setTimeout(..., 300)` 内**，否则新弹窗会被宿站紧随其后的 `fadeOut` 清空（本仓已知陷阱）。合并预览后若接第二个确认框，务必遵守。
- 图标沿用自包含方案：新增元素 id + `src/app.css` 的 `#id::before { content: "\F0xxx"; font-family: "md" }`，**禁止借用宿站 `mdi-*` 类**。

## 7. 出网路径

`SyncClient` **不得**读取 `window.iirosemedia.cors`。该值由 `src/environment/Environment.ts` 通过 ipinfo.io 判定 CN/Global 后择一选择，服务对象是第三方 API 的跨域；同步端点是自有的函数 URL，自带 CORS 响应头，直连少一跳、少一个失败点。

若函数 URL 首次部署后出现跨域失败，优先核对函数返回的 `Access-Control-Allow-Origin` 与 `OPTIONS` 预检实现，而不是绕回 CORS 代理。

## 8. 验证方式

本仓已接入 vitest（`npm test`，CI 的 build job 会跑），覆盖 `SyncMerge` / `SyncCrypto` / `FavoritesStorageService` 与跨端信封一致性；`npm run build` 仍负责类型检查与打包。无浏览器依赖的纯逻辑应补单测，运行期行为仍以真机检查为准：

- `SyncMerge.ts` 做成纯函数，便于用临时脚本构造夹具（本地 89 / 云端 137 / 重叠 74）做人工验证后删除脚本。
- 运行时验证走既有 skill `.opencode/skills/iirose-plugin-verify/`：构建 → 登录 → 进房间 → 注入 `dist/bundle.js` → 呼出 UI → 操作收藏 → 检查网络请求与云端对象。
- 端到端验证必须用**两个独立浏览器 profile**（同一测试账号）来验证跨设备同步与删除传播。
- 注意宿站 `messages.html` iframe 的 1.13–1.19 倍视口缩放，移动端断点一律用 `max-[768px]`。
