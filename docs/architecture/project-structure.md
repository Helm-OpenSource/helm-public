---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 项目结构与模块关系

本文描述的是**当前主干 reality**，不是旧本地 `helm/` 子目录里的实验性目录结构。

## 先讲当前主干 truth

1. 根目录 `app/` 仍然是当前主干真实 route owner
2. `data/queries.ts` 仍然是当前真实存在的查询兼容 façade / aggregation seam
3. 当前主干没有执行目录叫 `apps/helm-app`
4. 当前主干没有执行目录叫 `packages/helm-control`
5. route-level assembly 和 query/read-model ownership 可以继续下沉
6. `layout / loading / error / not-found` 的 shell thinning 必须晚于 route/query seam 稳定

## 顶层目录职责

```text
app/         当前主干的 App Router 路由入口、layout、loading、error、not-found、API handlers
components/  跨领域复用的 UI、layout 和 shared presentation
data/        当前主干的查询兼容 façade 与跨领域 aggregation seam
features/    按业务领域拆分的页面逻辑、客户端组件、actions、查询候选落点
hooks/       轻量通用 hooks
lib/         领域服务、记忆、推荐、导入、策略、审计、演进等底层能力
prisma/      schema、seed、本地数据库初始化
tests/       Playwright E2E 与其余回归测试
docs/        产品、架构、实现、验收与迁移文档
scripts/     self-check、boundary-check、pilot/readiness 等守卫脚本
```

## 当前推荐的理解顺序

1. [README.md](../../README.md)
2. [docs/README.md](../README.md)
3. `app/`
4. `features/`
5. `data/`
6. `lib/`
7. `prisma/`
8. `scripts/`

## 关键目录说明

### app/

负责：

- 当前主干的 route owner
- 顶层与 workspace 级 layout
- `loading.tsx / error.tsx / not-found.tsx`
- `page.tsx`
- `app/api/*`

规则：

- 页面负责 route entry 和页面组合
- 可以继续把 route-level server 装配抽薄
- 但在当前主干里，`app/` 仍然保留 owner 身份

### features/

负责：

- 页面级组件
- client 交互
- server actions
- 未来更细粒度 query seam 的优先落点

当前如果要 forward-port 旧本地 `helm-control/read-models` 的意图，优先考虑：

- `features/<domain>/queries.ts`
- 或该领域下更小的 loader / assembler / helper 模块

而不是强行恢复旧 `packages/` 结构。

### data/

当前仍负责：

- 查询兼容 façade
- 跨领域 aggregation seam
- 若干页面仍在直接消费的 read API

当前不应做的事：

- 不要把 `data/queries.ts` 当成永久最终结构
- 但也不要在 seam 尚未验证前就把它提前删除

当前推荐方向：

- 逐步把核心读模型组装下沉到 feature-first query seams 或当前主干可承载的 service seams
- `data/queries.ts` 逐步退化为 façade / bridge / compatibility surface

### lib/

负责：

- 审计、分析、推荐、记忆、导入、策略、连接器等领域能力
- `lib/operating-system/*` 这一层负责 current-main-friendly 的 operating model：
  - object state
  - skill catalog
  - event signals
  - recommendation context
  - approval boundary
  - audit reason chain
  - pilot readiness
  - dashboard arbitration
- query descent 时，如果某类读模型更贴近底层 service，也可以安全落在 `lib/<domain>/*`

规则：

- 迁移的是 ownership intent，不是旧路径名称
- 不要为了对齐旧本地提交，生造当前主干不存在的 package 层级
- `lib/operating-system/*` 是 current main 的语义层，不等于旧本地 `packages/helm-control`

### scripts/

负责：

- `self-check`
- `check:boundaries`
- `pilot/readiness` 级守卫

这些脚本要表达的是**当前主干 truth**：

- 根 `app/` 仍是 owner
- `data/queries.ts` 仍是兼容 façade
- shell thinning 是 late-stage

## 当前跨目录关系

### 页面查询链

```text
app/(workspace)/*
  -> data/queries.ts
  -> lib/* 或 features/* 里的底层能力
  -> prisma/db
```

当前要推进的方向是：

```text
app/(workspace)/*
  -> features/<domain>/queries.ts 或 lib/<domain>/query-service
  -> data/queries.ts 仅保留 façade
  -> prisma/db
```

### 页面装配链

```text
app/(workspace)/*.tsx
  -> 调 query seam
  -> 调 feature client / detail client
  -> 当前仍保留 route owner 身份
```

后续可继续推进的是：

- page 文件更薄
- route-level server 装配移入 co-located loader/helper
- 但不提前引入第二 app tree

## 当前迁移边界

可以继续推进：

1. query/read-model ownership 下沉
2. route-level assembly 抽薄
3. docs / guards / self-check 与当前 reality 对齐

当前不要提前推进：

1. 恢复旧 `apps/helm-app` 结构
2. 恢复旧 `packages/helm-control` 结构
3. 大规模 shell thinning
4. 在 seam 未验证前移除 `data/queries.ts`

## 参考文档

- [HELM_MIGRATION_RECONCILIATION_PLAN_20260329.md](../reviews/HELM_MIGRATION_RECONCILIATION_PLAN_20260329.md)
- [LOCAL_HELM_MIGRATION_CHECKLIST_20260329.md](../reviews/LOCAL_HELM_MIGRATION_CHECKLIST_20260329.md)
