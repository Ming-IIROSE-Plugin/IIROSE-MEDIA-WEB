---
id: epic-favorites-cloud-sync
type: epic
title: 收藏云同步规格说明书
parent: initiative-iirose-media-web
covers: []
after: []
refined: true
risk: low
status: done
---
# 收藏云同步规格说明书

## Description

要解决一个具体的痛点。 现有收藏系统（见 `spec-favorites-system`）纯本地 IndexedDB 持久化，用户在手机上收藏的歌，换到电脑上就没了；换浏览器、清缓存、重装，整库消失。用户已明确需要跨设备同步。

## Outcome

- 用户在手机上收藏一首歌，在电脑上打开插件（同一 iirose 账号 + 同一同步口令）即可看到该收藏并直接点播；手机端删除后，电脑端下次同步不再出现；整个过程中云端对象对服务端始终不可读。

## Requirements

1. R1 (spec): - 用户在手机上收藏一首歌，在电脑上打开插件（同一 iirose 账号 + 同一同步口令）即可看到该收藏并直接点播；手机端删除后，电脑端下次同步不再出现；整个过程中云端对象对服务端始终不可读。

## Constraints

- **服务端零知识。** 不得存储、记录、转发明文收藏或同步口令；函数不得把请求体写入 CLS 日志。
- **uid 是分区键，不是凭据。** 宿站 `localStorage.cookie.password`（账号口令 MD5）及任何宿站口令派生值，绝不可用作凭据、密钥或服务端秘密。
- **函数URL 必须使用「开放」鉴权。** CAM 鉴权要求浏览器持有腾讯云密钥，不可接受；因此全部抗滥用逻辑必须在函数内部自建。API 网关触发器已下线，HTTP 入口只能是函数URL。
- **对象键只能由服务端生成**，形如 `sync/{uid[0:2]}/{uid}.json`，uid 需通过十六进制白名单校验；函数不得接受客户端指定的任意键，从而不可能被当作通用文件或图床使用。
- **存储桶必须私有读写、不开公网直链**，函数角色权限仅限 `sync/` 前缀的 `PutObject` / `GetObject` / `HeadObject`（GET 路径每次都先 `HeadObject`，漏掉它会让读取全部 403）。
- **存储桶必须开启版本控制**，作为误覆盖与恶意清空的回滚兜底。
- **不得购买套餐包或资源包。** 所有频率上限必须按「零成本」目标设定，并配置费用与日调用量告警。
- **仅已登录账号可同步。** 没有稳定 uid 的游客态不得上传。
- **客户端请求不得经过 `window.iirosemedia.cors` 代理**——那是为第三方 API 跨域准备的，同步端点是自有的、自带 CORS 头，直连即可。
- **不做后台轮询、不做常驻连接、不做逐条端点。**唯一允许的定时请求是「插件 UI 打开期间的 5 分钟兜底拉取」——聊天站里页面常驻可见，仅靠可见性事件不足以维持最终一致。
- **不引入重型加密依赖**，走 WebCrypto 原生（PBKDF2 + AES-GCM）。
- **PBKDF2 迭代次数以「目标设备解锁 ≤1 秒」为准绳。** 上线前必须在至少一台中低端安卓真机实测；实测超标则下调迭代次数，但**不低于 100000**。信封已自带 `kdf.iter`，调整只影响新写入，不破坏已存在数据——这是刻意的设计冗余。
- **同步口令只存内存。** 不提供「记住同步口令」选项（落 localStorage 会削弱加密保证）；页面刷新即失锁，需重新输入。
- **成本口径：按量计费、无套餐。** 不购买套餐包/资源包，且必须实现「无变化不回传密文」的短路，因为**出网流量是主成本项**，请求次数与资源使用量都是零头。
- **快照体积上限 512KB，本期不设条目数上限。**
- **不提供口令找回**，UI 必须明示「忘记同步口令 = 云端收藏不可恢复」。
- **IndexedDB 必须原地从 version 1 升级到 2**（新增同步字段），不得重建或清空现有数据。
- **同步 UI 必须沿用本仓移动端约定**：44px / 48px 触控目标、`max-[768px]` 断点、`buildSelect2` 跨弹窗 300ms 延迟。
- **落地顺序先本地后云端。** 加密、合并、墓碑、防抖这条链必须先对本地 stub 端点验证通过，再接真实函数与 COS；基础设施不是风险大头，同步语义的正确性才是。

## Done when

- - 用户在手机上收藏一首歌，在电脑上打开插件（同一 iirose 账号 + 同一同步口令）即可看到该收藏并直接点播；手机端删除后，电脑端下次同步不再出现；整个过程中云端对象对服务端始终不可读。

## Boundaries

- 不做逐条增量 API（无 per-record CRUD 端点），v1 只做整包快照。
- 不做实时多端推送（WebSocket / 服务端推送）；不做后台轮询（UI 打开期间的 5 分钟兜底拉取不在此列）。
- 不做口令找回、邮箱绑定、插件自建账号体系。
- 不做服务端搜索、统计、推荐、分享或任何需要读明文的云端能力。
- 不做封面或音视频二进制的同步，只同步元数据（封面仍走 URL）。
- 不做从网易云 / B站 官方收藏夹的导入导出。
- 不做多用户共享收藏夹或房间级收藏池。

## References

- parent — _bmad-output/initiative-iirose-media-web/initiative-iirose-media-web.md
- spec (v6, archived) — _bmad-output/initiative-iirose-media-web/archive-v6/spec-favorites-cloud-sync/SPEC.md
- retrospective — epic-favorites-cloud-sync-retrospective.md
- companion — .memlog.md
- companion — backend-architecture.md
- companion — client-integration.md
- companion — crypto-spec.md
- companion — sync-protocol.md

## Notes

- Assumption: 假定 `window.uid` 在 `messages.html` 上下文长期可读，能扛住宿站前端迭代（用户已确认；实测：可在该上下文直接读取，且账号级稳定）。
- Assumption: 假定单用户收藏规模在数千条以内，512KB 信封足够（用户已确认；按条目平均约 150–300B 密文估算；若真超限则走 CAP-6 提示）。
- Assumption: 假定维护者已开通 COS 且桶与函数同地域：桶 `iirose-media-sync-1309510434`、地域 `ap-guangzhou`（见 `docs/deployment/tencent-cloud-functions.md`）；版本控制、生命周期与最小权限角色按该文档与 `backend-architecture.md` 第 7 节清单在控制台开启。
- Assumption: 假定用户使用强度不构成滥用，因而频率上限设置宽松、以提示代替硬拦截。
- Assumption: 假定腾讯云账号已过 SCF 三个月免费期，因此**按量计费而非零成本**；目标上限为「每月几元以内」，出网流量是主成本项。 <!-- 已裁定，不再待决： --> <!-- - SCF 免费期 → 用户确认已过，按量计费（见 Assumptions 与 backend-architecture.md 第 5 节） --> <!-- - 「联系铭」形式 → 用户裁定为纯文本昵称（见 CAP-6） --> <!-- - 记住同步口令 → 用户裁定不提供（见 Constraints） --> <!-- - COS 桶名与地域 → 桶 iirose-media-sync-1309510434、地域 ap-guangzhou（见 docs/deployment/tencent-cloud-functions.md） -->
- Decision: 2026-11-06 由 v6 迁入;Done when 取自 SPEC 的成功标准,未与用户重新确认。
