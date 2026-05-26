---
status: active
owner: helm-core
created: 2026-03-29
review_after: 2026-06-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 本地 Helm 12 提交迁移清单（2026-03-29）

> 注：本文档只保留为 **old-local intent archive / reference**。当前主干的真实迁移计划与落地状态，请以 [HELM_MIGRATION_RECONCILIATION_PLAN_20260329.md](HELM_MIGRATION_RECONCILIATION_PLAN_20260329.md) 为准。

## 背景

当前仓库根目录是 `../..`。  
本地此前的 12 个提交是在子目录 `helm/` 内完成的架构收口工作，而远端最新 `origin/main` 已经改为以仓库根目录作为主项目根。

这意味着：

1. 不能直接把这 12 个提交机械 `rebase` 到 `origin/main`
2. 需要按“意图迁移”而不是“结构重放”的方式处理
3. 优先迁移结构无关、长期有价值的守卫、验证和收口经验

## 分支

- 当前迁移分支：`codex/origin-main-migration`
- 本地备份分支：`codex/backup-main-before-origin-sync-20260329`

## 12 个本地提交清单

| 提交 | 主题 | 迁移判断 | 说明 |
|---|---|---|---|
| `1df6a9f` | main-chain partial route tree ownership | 不直接迁移 | 依赖 `apps/helm-app` 目录，不适合直接套到当前根目录结构 |
| `cfe4985` | dashboard read model 下沉 | 部分迁移 | 思路有价值，当前阶段先迁移“主链查询收口的守卫与清单”，不直接搬 `helm-control` 目录 |
| `3afa6c1` | collapse main-chain route-owner layer | 不直接迁移 | 依赖旧的 `helm-app` route-owner 架构 |
| `6eb7373` | expand route-owner sources | 不直接迁移 | 同上 |
| `862b048` | meetings route tree into helm-app | 不直接迁移 | 同上 |
| `dbae6b6` | object routes into helm-app | 不直接迁移 | 同上 |
| `eadd64c` | remaining pages through helm-app tree | 不直接迁移 | 同上 |
| `cd74a6d` | object queries into control read models | 部分迁移 | 思路有价值，当前先迁移主链查询的边界守卫，不直接引入 `packages/helm-control` |
| `f9a9815` | auxiliary route assembly into helm-app | 不直接迁移 | 依赖旧的 `apps/helm-app` 目录 |
| `0e07bf8` | supporting route queries into helm-control | 部分迁移 | 当前先迁移 read/query 收口的验证思路 |
| `42ead26` | remove data query bridge and inline app layouts | 部分迁移 | 当前先迁移“主链存在性 + 自检守卫”，不直接复刻目录拆分 |
| `09c638b` | loading/error entries into helm-app | 不直接迁移 | 依赖 `apps/helm-app` 的 entrypoint 结构 |

## 当前已开始迁移的高价值内容

### 已迁移

1. **迁移清单显式化**
   - 本文件把“哪些能迁、哪些不能迁、为什么不能直接迁”写清楚，避免后续重复做危险的机械 rebase。

2. **主链/演示链自检守卫**
   - 已把“Founder / Sales / Recruiter 三条演示链不能失踪”的思路接入当前 `scripts/helm-self-check.ts`。
   - 这部分与当前根目录结构兼容，长期有效。

3. **第二批：主链查询热路径守卫**
   - 已把首页、机会、会议、审批、记忆这 6 条主链页面继续绑定 `data/queries.ts` 当前主查询入口的要求接入 `scripts/decision-first-boundary-check.ts`。
   - 这意味着后续即使继续演进，也不会在不知情的情况下把这些核心入口拆散或改成隐性分叉。

4. **第三批：主链页面 render handoff 守卫**
   - 已把 dashboard / opportunities / approvals / memory / meetings / meetings/[id] 的 render handoff 绑定进边界脚本。
   - 这会保护这些页面继续把页面级编排交给当前约定的 client、detail client 和 helper，而不是悄悄回退成散乱的 page 内联实现。

5. **第四批：辅助查询与入口壳层守卫**
   - 已把 `workspace layout / search / settings / inbox` 的查询热路径也接进边界脚本。
   - 已把 `app/layout.tsx`、`app/loading.tsx`、`app/error.tsx`、`app/(workspace)/loading.tsx`、`app/(workspace)/not-found.tsx` 的安全 fallback 约束接进边界脚本。
   - 这部分对应本地旧提交里“查询桥接收薄”和“loading/error 壳层收口”的可迁移价值。

6. **第五批：对象详情页与辅助导入路由的查询守卫**
   - 已把 `contacts/[id]`、`companies/[id]` 继续绑定到 `data/queries.ts` 里的对象详情查询热路径。
   - 已把 `imports`、`imports/crm` 继续绑定到 `features/imports/queries.ts` 的 CRM 导入查询热路径。
   - 这部分对应本地旧提交里“对象查询收口”和“辅助路由查询收口”的可迁移价值。

7. **第六批：辅助路由、对象详情页与壳层入口的存在性自检**
   - 已把 `imports / search / settings / inbox` 这批辅助路由的存在性接进 `scripts/helm-self-check.ts`。
   - 已把 `contacts/[id]`、`companies/[id]` 这批对象详情页的存在性接进 `scripts/helm-self-check.ts`。
   - 已把 `app/layout.tsx`、`app/loading.tsx`、`app/error.tsx`、`app/(workspace)/layout.tsx`、`app/(workspace)/loading.tsx`、`app/(workspace)/not-found.tsx` 的入口壳层存在性接进 `scripts/helm-self-check.ts`。
   - 这部分对应本地旧提交里“辅助 route tree 收口”和“入口壳层现实化”的可迁移价值。

8. **第七批：入口页与辅助工作台页面的存在性自检**
   - 已把 `app/page.tsx`、`app/setup/page.tsx`、`app/(auth)/login/page.tsx`、`app/(workspace)/page.tsx` 这批入口页面接进 `scripts/helm-self-check.ts`。
   - 已把 `analytics / capture / reports` 这批辅助工作台页面的存在性接进 `scripts/helm-self-check.ts`。
   - 这部分对应本地旧提交里“剩余 route tree 与 route module 接管”的可迁移价值，但在当前主干里只迁移为现实自检，不硬搬旧目录结构。

### 暂不直接迁移

1. `apps/helm-app` / `helm-control` / `helm-runtime` / `helm-protocol` 分层目录
2. route-owner source / partial route tree 那套目录结构
3. 以 `helm/` 子目录为项目根的文档与脚本布局

这些内容不是没有价值，而是**不能在当前远端主干结构上直接照搬**。

## 后续迁移优先级

### 第一优先级：继续迁移“验证与守卫”

适合继续迁移：

1. 主链 route / query hot path 的存在性和边界守卫
2. Founder / Sales / Recruiter 关键路径的脚本化验证
3. 关键边界说明文档的现实化、去模糊化

### 第二优先级：迁移“实现思路”，而不是迁移目录

适合按意图迁移：

1. 主链查询继续从 `data/queries.ts` 下沉
2. route-level server 逻辑从 page 文件中继续抽薄
3. legacy shim 的真实调用面继续缩小

### 第三优先级：暂缓

1. `apps/helm-app` 物理接管
2. `packages/helm-control` / `packages/helm-protocol` 目录级拆分
3. plugin runtime sandbox

## 结论

这 12 个本地提交里，**真正可立即迁移的不是目录结构本身，而是“如何收口、如何自检、如何避免边界回退”的经验和守卫**。  
因此当前迁移策略是：

1. 先迁移守卫和验收能力
2. 再按当前远端主干结构，逐步迁移读写路径收口思路
3. 不做危险的跨目录机械 rebase

## 当前收尾判断（2026-03-29）

当前这条迁移线里，**所有结构兼容、能直接落到当前远端主干的高价值守卫 / 自检 / 文档现实化项，已经全部迁完**。

已经迁完的类型：

1. 主链 / 演示链自检
2. 主链查询热路径守卫
3. 主链页面 render handoff 守卫
4. 辅助查询与入口壳层守卫
5. 对象详情页与导入页查询守卫
6. 辅助路由、对象详情页、入口壳层、入口页与辅助工作台页的存在性自检

当前仍保留、但**不应在这条迁移线上直接硬搬**的内容：

1. `apps/helm-app` route-owner / partial route tree 目录结构
2. `packages/helm-control` / `packages/helm-protocol` / `packages/helm-runtime` 的分层实现
3. 依赖这些包结构的 transport guard / control write-path 收口
4. plugin runtime sandbox

原因不是这些内容没有价值，而是它们已经超出了“把旧本地提交安全迁到当前远端主干”的边界；如果强行继续，会从“迁守卫”滑向“重做架构”。
