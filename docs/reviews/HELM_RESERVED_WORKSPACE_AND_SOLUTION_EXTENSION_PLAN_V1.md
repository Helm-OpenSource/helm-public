---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM Reserved Workspace And Solution Extension Plan V1

状态：Planned  
Owner：Helm Core  
日期：2026-04-12

## 1. 目标

这轮只做一条更基础的架构收口：

- 冻结 `Solution Extension` 分类
- 冻结 `Helm reserved workspace` 的系统边界
- 明确 Helm first-party 经营功能与 tenant custom 扩展的关系
- 为后续实现 reserved data isolation 提供稳定定义

它的目标不是：

- 立即重写所有 settings / reports / programs / portal
- 立即做完整 extension registry 平台
- 立即把 custom delivery 做成 marketplace
- 立即做完整 SI / project system

## 2. 为什么现在必须做

当前 main 已经出现了 3 条会继续拉扯边界的主线：

1. `worker / skill / capability governance` 主线已经成立
2. `program / application / participant portal / settlement` 主线已经成立
3. Helm first-party 自己的 internal operating / engineering review 也已经开始进入产品面

如果这时还没有明确分类，后续会出现两类错误：

- 把定制交付共性硬塞进 `Skill / Worker`
- 把 Helm first-party 保留数据继续当成普通 tenant data

## 3. 当前引用的产品 truth

本轮显式引用：

- [HELM_PRODUCT_PRINCIPLES_V1.md](../product/HELM_PRODUCT_PRINCIPLES_V1.md)
- [HELM_PRODUCT_PRIORITY_MAPPING_V1.md](../product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md)
- [HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md](../product/HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md)
- [HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md](../product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md)
- [HELM_PARTNER_REGISTRY_BASELINE_V1.md](../product/HELM_PARTNER_REGISTRY_BASELINE_V1.md)
- [HELM_PROGRAM_CATALOG_BASELINE_V1.md](../product/HELM_PROGRAM_CATALOG_BASELINE_V1.md)
- [HELM_MULTITENANCY_MULTIUSER_FOUNDATION_BASELINE_V1.md](../product/HELM_MULTITENANCY_MULTIUSER_FOUNDATION_BASELINE_V1.md)

本轮接到的真实业务闭环：

- `Helm first-party operating extension -> reserved data -> internal review / report / settlement`
- `public program catalog -> controlled application -> internal review -> invite / participant portal`
- `tenant custom scenario -> shared worker / skill / resource reuse -> bounded custom extension`

它服务的是：

- 决策
- 执行
- 审计
- 复盘

为什么应该现在做，而不是继续加功能：

- 当前继续扩功能，最容易先把对象边界写乱
- 一旦把 `Skill / Worker / Commercial / Extension` 混写，后续 schema、权限和升级路径都会一起变脏
- 先冻结定义，比继续扩页面更符合当前 correctness / maintainability / upgrade-safe 优先级

## 4. 当前代码缺口

当前 main 的主要缺口已经明确：

1. `Workspace` 还没有显式 `reserved / customer` 分类
2. capability matrix 只有 `workspace role`，没有 `reserved workspace` 维度
3. public program catalog 还在依赖“恰好只有一个 active workspace”的 heuristic
4. engineering delivery review 没有锚定 workspace host
5. settings 内 commercial / settlement / program / skill governance 仍只按当前 workspace + role 暴露

## 5. In Scope

### Task 1 - taxonomy freeze

目标文件：

- `docs/product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md`
- `docs/README.md`
- `PLANS.md`

本任务只做：

- 冻结 `Worker / Skill / Resource / Solution Extension / Commercial` 分类
- 明确 `FIRST_PARTY_RESERVED / TENANT_CUSTOM / REUSABLE_EXTENSION / CORE_PRODUCT`
- 明确“定制开发共性先归 extension，再提炼 skill / worker”

### Task 2 - reserved workspace model

下一步目标文件：

- `prisma/schema.prisma`
- `lib/auth/*`
- `lib/workspace-*`

下一步只做：

- 为 `Workspace` 增加显式 class / system key
- 新增 `resolveHelmReservedWorkspace()` / `isHelmReservedWorkspace()` helper
- 不顺手扩成 full org hierarchy 或 full RBAC

### Task 3 - reserved host gating

下一步目标文件：

- `lib/billing/program-catalog.ts`
- `features/programs/queries.ts`
- `app/(workspace)/reports/page.tsx`
- `lib/reports/engineering-delivery-review.ts`
- `features/settings/queries.ts`

下一步只做：

- 停止 single-active-workspace heuristic
- 把 first-party reserved surfaces 改成显式 host resolution
- 把 reserved-only card/readout 从普通 workspace 中收走

### Task 4 - data migration and backfill

下一步目标文件：

- `prisma/seed.ts`
- migration / backfill scripts
- 对应 tests / docs

下一步只做：

- 创建或标记 Helm reserved workspace
- 把 first-party 数据迁入 reserved host
- tenant custom 数据继续保持 tenant-owned

## 6. Out Of Scope

- full extension marketplace
- extension studio / app builder
- custom project ERP
- skill-to-revenue auto mapping
- creator payout platform
- payout execution
- route tree rewrite
- second app tree

## 7. 核心设计决定

### 决定 1

`Solution Extension` 是产品与运行组合层，不是 capability catalog。

### 决定 2

`Commercial / Delivery Line` 与 `Skill / Worker` 分开建模。

### 决定 3

Helm 自己的经营扩展属于 `FIRST_PARTY_RESERVED`，应显式锚定 reserved workspace。

### 决定 4

客户定制扩展属于 `TENANT_CUSTOM`，默认 tenant-owned，不因“有共性”就立刻进入 core。

### 决定 5

只有稳定、可复用、脱离客户专属数据模型仍然成立的执行能力，才允许提炼成 `Skill / Worker`。

## 8. 受影响组件

后续实现会直接影响：

- `prisma/schema.prisma`
- `lib/auth/authorization.ts`
- `lib/auth/service-governance.ts`
- `features/settings/queries.ts`
- `features/settings/actions.ts`
- `lib/billing/program-catalog.ts`
- `features/programs/queries.ts`
- `features/programs/actions.ts`
- `features/participant-portal/queries.ts`
- `features/participant-portal/actions.ts`
- `app/(workspace)/reports/page.tsx`
- `lib/reports/engineering-delivery-review.ts`
- `features/internal-operating-workspace/*`

## 9. 风险

### 风险 1 - classification drift

如果后续又把新的 custom delivery surface 直接记成 `Skill / Worker`，这轮定义就会失效。

### 风险 2 - migration misclassification

如果在 reserved workspace backfill 时误把 tenant custom 数据迁成 first-party data，会破坏 tenant ownership。

### 风险 3 - over-platformization

如果顺手把 extension 做成 full registry / builder / marketplace，会超出当前 repo 边界。

## 10. 验证方案

本轮 docs freeze 至少验证：

- docs 索引已接入
- repo-level plan 已接入
- 定义与现有 `worker / skill / resource`、`partner / settlement / program` 文档不冲突

下一步代码实现默认验证链：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

## 11. Done 定义

这条线真正完成时，repo 里应该同时成立：

1. `Solution Extension` 与 `reserved workspace` 定义已冻结
2. `Workspace` 已有显式 reserved/customer 分类
3. first-party reserved host surfaces 不再依赖 heuristic
4. tenant custom extension 与 first-party reserved extension 已有明确 ownership boundary
5. docs / tests / guards / validation 已同步

## 12. 当前结论

下一步正确路径不是：

- 把“定制开发共性”直接写进 `Skill / Worker`

下一步正确路径是：

- 先把它定义成 `Solution Extension`
- 再从 extension 内提炼真正稳定的 capability
- 同时用 reserved workspace 收住 first-party data host
