---
id: SPEC-standardization
companions: [] # files downstream MUST read alongside SPEC.md. Paths may point inside the spec folder (spec-authored) or outside it (adopted from an upstream skill).
sources: [] # files fully absorbed into the SPEC (audit only; downstream does NOT read these). Never the memlog.
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# 存储、分页、平台接口与错误提示的标准化

## Why

**一个机会：结构已经分层，缺的是「同一件事只写一遍」。** 两次大拆分之后，单文件规模与分层方向都健康——`src/page` 直连 `src/Api` 只剩 1 处，`platforms`、`services`、`playback`、`storage` 各自独立，产物 438.69 kB / gzip 132.49 kB，70 文件 / 1258 用例全绿。真正拖慢改动的换成了横向重复：生产代码约 50 处直连 `localStorage` 各写一套 key 与容错；7 个 Service 各自复制分页 Promise 包装；四个平台没有共同接口，新平台只能照着现有文件模仿；`ShowMessage.show((error as Error).message)` 抄了 18 次。这些不是设计问题，是缺一次收敛。

## Capabilities

- **CAP-1**
  - **intent:** 存储访问收敛到单一入口，模块不再各自拼 key、做 JSON 编解码与异常兜底；已有 key 与数据格式保持不变。
  - **success:** 生产代码里 `localStorage` 只出现在存储入口与迁移代码中；升级后老用户已存的配置、收藏选择、播放位置、点播历史都能原样读出。
- **CAP-2**
  - **intent:** 分页加载只有一份实现，7 个 Service 复用它，两份 `splitByPage` 合并为一处。
  - **success:** 新增来源时只需提供「取一页」的函数即可接入；`splitByPage` 全仓仅一处；现有分页用例全绿且行为不变。
- **CAP-3**
  - **intent:** 平台检索能力有类型约束，四个平台实现同一组接口签名，新平台按类型补齐。
  - **success:** 四个平台对象满足同一个 interface（类型层面可赋值），调用点与运行时行为不变；新增一个平台时编译期会提示缺失的方法。
- **CAP-4**
  - **intent:** 失败提示收敛为「分类 + 单一上报入口」，不再逐处复制同款 catch 与提示文案。
  - **success:** `ShowMessage.show((error as Error).message)` 这类同款调用在平台层不再成片出现；失败分类（网络 / 风控 / 解析 / 未知）由一处决定，用户可见文案与现在一致。

## Constraints

- 行为、用户可见文案、UI、宿站交互契约一律不变；不重写平台实现与网络层。
- 现有测试不得放宽或删除；重构导致失败只改实现。
- 存储 key 与已存数据格式不变，不允许为了整洁做破坏性迁移。
- 产物仍是单文件 UMD；不新增运行时依赖。
- 本轮不设产物体积阈值（维护者已取消守门），体积只作记录。

## Non-goals

- 给四个平台套统一基类或运行时分支：协议差异大，抽象后必然变成 `if (platform === ...)`，比现在更难读。
- 把 6 个 Service 抽象成泛型框架：它们各自只有一两个方法，抽象成本高于收益。
- 进一步抽 UI 组件：结果区与浮窗样式已经收敛，再往上抽会把布局耦合进来。
- 拆分剩余 ≤800 行的文件（`FavoritesStorageService`、`SettingsService`、`BiliBiliSettings`、`LoginAPI`、加密模块等）。

## Success signal

生产代码里找不到成片的 `localStorage` 直连、分页 Promise 包装与同款错误提示；新增一个来源或平台时，只需要写它独有的那部分，公共部分从现有入口取；1258 条现有用例全绿，真机点播、收藏、设置三条主路径行为不变。

## Assumptions

- 7 处分页包装的对外行为一致，差异只在取数函数本身；若发现不一致，收敛时以现有测试为准而不是统一成新语义。
- 存储层可以在不改 key 的前提下把编解码集中起来（现有值都是 JSON 字符串或纯字符串，两种形态需要入口区分）。

## Open Questions

- 错误分类的粒度定在哪一层（网络 / 风控 / 解析 / 未知）？——留给 CAP-4 的 story 按现有文案反推，不新增用户可见类别。
