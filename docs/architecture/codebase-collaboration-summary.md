---
status: active
owner: helm-core
created: 2026-04-11
review_after: 2026-07-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 代码库协作摘要

这份文档给刚进入 Helm 仓库的人类协作者和新的 Codex session 用。

目标只有一个：用最短路径讲清 current-main reality，让大家知道这个仓库现在是什么、代码大概怎么分层、改东西时应该先看哪里，以及哪些边界不能被误写成外部承诺。

## 先用 6 句话理解 current main

1. Helm 当前不是一个通用聊天产品，也不是完整 workflow / BI / auto-execution 平台；它是一套面向受控试点的 AI 经营协同操作系统。
2. 当前主干仍然是 `workspace-first`、`membership-backed`、`controlled-trial`、`judgement-first`、`decision-first`。
3. 根目录 [app/](../../app/) 仍然是当前真实 route owner，不要按旧本地 `apps/helm-app` 的想象来读仓库。
4. [data/queries.ts](../../data/queries.ts) 仍然是当前真实存在的查询兼容 façade / aggregation seam，但它已经在变薄。
5. recommendation 不等于 commitment，proactive 不等于自动替人拍板、自动对外发送或 broad auto-write。
6. 当前很多能力已经成形，但只要代码、页面、测试、文档没有同时成立，就不能诚实地写成“完整平台能力”。

## 建议阅读顺序

1. [AGENTS.md](../../AGENTS.md)
2. [README.md](../../README.md)
3. [docs/README.md](../README.md)
4. [WORKING-CONTEXT.md](../../WORKING-CONTEXT.md)
5. [project-structure.md](./project-structure.md)
6. 如果要理解视觉与页面层级，再看 [DESIGN.md](../../DESIGN.md)

读完上面 5-6 份文件，基本就能知道 Helm 的 current-main truth、当前阶段边界和默认执行方式。

## 顶层结构怎么分工

| 目录 | 当前职责 | 先看哪里 |
| --- | --- | --- |
| [app/](../../app/) | App Router 入口、layout、page、loading、error、not-found、API handlers | [app/page.tsx](../../app/page.tsx)、[app/(workspace)/layout.tsx](<../../app/(workspace)/layout.tsx>)、[app/(workspace)/dashboard/page.tsx](<../../app/(workspace)/dashboard/page.tsx>) |
| [features/](../../features/) | 页面级 loader、query、client 交互、domain actions | [features/dashboard/page-loader.ts](../../features/dashboard/page-loader.ts)、[features/dashboard/queries.ts](../../features/dashboard/queries.ts)、[features/workspace/queries.ts](../../features/workspace/queries.ts) |
| [data/](../../data/) | 当前主干的查询兼容 façade 与跨领域 aggregation seam | [data/queries.ts](../../data/queries.ts) |
| [lib/](../../lib/) | 领域服务、auth、billing、memory、imports、operating model、Helm v2 runtime contracts | [lib/operating-system/foundation.ts](../../lib/operating-system/foundation.ts)、[lib/helm-v2/contracts.ts](../../lib/helm-v2/contracts.ts) |
| [prisma/](../../prisma/) | 数据模型、seed、本地数据库初始化 | [prisma/schema.prisma](../../prisma/schema.prisma) |
| [scripts/](../../scripts/) | self-check、boundary-check、pilot/readiness、eval harness | [scripts/helm-self-check.ts](../../scripts/helm-self-check.ts)、[scripts/decision-first-boundary-check.ts](../../scripts/decision-first-boundary-check.ts) |
| [tests/](../../tests/) | Playwright E2E 与关键回归入口 | [tests/e2e/formal-trial-flow.spec.ts](../../tests/e2e/formal-trial-flow.spec.ts)、[tests/e2e/demo-flows.spec.ts](../../tests/e2e/demo-flows.spec.ts) |

可以把它简单理解成：

```text
app/       负责路由 owner 和页面入口
features/  负责页面装配、domain query、client 交互
data/      负责当前兼容查询面
lib/       负责底层服务、治理、运行时合同
prisma/    负责持久化 truth
scripts/   负责守卫、自检、eval
```

## 一条请求通常怎么走

### 公开入口

```text
app/page.tsx
  -> features/auth/*
  -> lib/auth/*
  -> redirect to /dashboard or /setup
```

[app/page.tsx](../../app/page.tsx) 负责公开首页、语言切换、公开 SSO 入口和登录面板；它不是单纯 marketing page，而是正式 auth entry 的一部分。

### workspace 页面

```text
app/(workspace)/*
  -> features/<domain>/page-loader.ts
  -> features/<domain>/queries.ts
  -> data/queries.ts (current compatibility seam, only when needed)
  -> lib/<domain>/*
  -> prisma/db
```

[app/(workspace)/layout.tsx](<../../app/(workspace)/layout.tsx>) 先拿当前 session 和 layout data，再把用户、workspace、notification、quick create 等信息喂给 `AppShell`。像 [features/dashboard/page-loader.ts](../../features/dashboard/page-loader.ts) 这样的 loader，则负责把 session、story、today focus、operating home、business loop readout 等页面级数据拼起来。

### Helm v2 运行时闭环

```text
meeting / connector signal
  -> structured facts / action pack
  -> review / approval
  -> human execution
  -> official write intent
  -> limited auto only in narrow whitelist
```

这条线主要落在 [lib/helm-v2/](../../lib/helm-v2/)。

[lib/helm-v2/contracts.ts](../../lib/helm-v2/contracts.ts) 把 memory、ingestion、retrieval、artifact、approval tier、human execution、official write、limited auto 的边界显式类型化。读这个目录时要默认记住：它描述的是“受控运行时闭环”，不是 broad auto-write platform。

## 当前最重要的对象

| 对象组 | 你应该怎么理解 |
| --- | --- |
| `Workspace / Membership / BillingAccount / TrialState / WorkerEntitlement` | 这是 Helm v1 商业与组织基础，`Workspace == Organization` 仍是当前商业边界。 |
| `Company / Contact / Opportunity / Meeting / ApprovalTask` | 这是页面上最常见的业务对象，也是 dashboard、operating、approvals、memory 等页面会围绕的主对象。 |
| `MemoryFact / Commitment / Blocker / BriefingSnapshot` | 这是“记忆、判断、跟进、证据”这一层的关键对象，很多页面不是只读 CRM，而是在读这层叠加过的经营记忆。 |
| `ConnectorIngestionRecord / HumanActionExecution / OfficialWriteIntent / LimitedAutoIntent` | 这是 Helm v2 运行时对象，负责把外部信号、人工执行和受控官方写入连成一条可审计链。 |

如果只想快速看模型名称，可以先跳到 [prisma/schema.prisma](../../prisma/schema.prisma) 里这些 model 定义。

## 常见任务应该从哪开始

| 想做的事 | 先看哪里 |
| --- | --- |
| 改公开首页、登录、setup | [app/page.tsx](../../app/page.tsx)、[features/auth/](../../features/auth/)、[lib/auth/](../../lib/auth/) |
| 改 workspace 壳层、导航、通知、quick create | [app/(workspace)/layout.tsx](<../../app/(workspace)/layout.tsx>)、[features/workspace/queries.ts](../../features/workspace/queries.ts) |
| 改 dashboard / operating / approvals / inbox 等主工作台页面 | 对应的 [app/(workspace)/.../page.tsx](<../../app/(workspace)/dashboard/page.tsx>) 和 [features/](../../features/) 里的同名 domain 目录 |
| 查一个页面的数据是怎么拼出来的 | 先看 `features/<domain>/page-loader.ts`，再看 `queries.ts`，最后看 `lib/*` 或 [data/queries.ts](../../data/queries.ts) |
| 改 auth、membership、tenant boundary | [lib/auth/](../../lib/auth/) 和相关 API route |
| 改 billing、trial、seat、payment rail | [lib/billing/](../../lib/billing/) |
| 改 memory / briefing / recommendation | [lib/memory/](../../lib/memory/) 和 `features/memory/*` |
| 改 imports / connectors / capture | [lib/imports/](../../lib/imports/)、[lib/connectors/](../../lib/connectors/)、[lib/conversation-capture/](../../lib/conversation-capture/) |
| 改 v2 runtime、approval、official write path | [lib/helm-v2/](../../lib/helm-v2/) |
| 查某个改动为什么会被 guard 卡住 | [scripts/helm-self-check.ts](../../scripts/helm-self-check.ts)、[scripts/decision-first-boundary-check.ts](../../scripts/decision-first-boundary-check.ts)、`scripts/codex-hooks/*` |

## 协作时最容易踩的坑

1. 把当前仓库误读成 Kubernetes Helm、通用 agent platform 或完整 enterprise suite。
2. 以为旧目录形状仍然存在，然后去找不存在的 `apps/helm-app` 或 `packages/helm-control`。
3. 看到 recommendation、proposal、package、proactive 这些词，就把它们误写成 commitment、合同、自动执行或外发权限。
4. 只改页面，不同步 docs、self-check、boundary-check、测试入口。
5. 在 [data/queries.ts](../../data/queries.ts) 还承担兼容职责时，过早把它当成“可以直接删掉的技术债”。
6. 把 Helm v2 运行时写成 broad auto-write；当前 limited auto 只在极窄白名单内验证。
7. 忽略长期硬边界：plugin runtime 还没有真正 sandbox，future-real auth 还不是完整生产级认证链，系统也还不是完整多组织/多权限/多租户平台。

## 默认交付与验证

Helm 仓库的大多数非微小任务默认都按：

```text
plan -> implementation -> validation -> report
```

除非用户明确豁免，否则默认验证链是：

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

如果某轮任务没有跑完整链路，结果里必须明确写出没跑什么、为什么没跑、剩余风险是什么。

## 一句话记住这套仓库

Helm 当前主干最适合被理解成：一套把经营对象、判断、记忆、审批、执行和审计收在同一条受控主线里的产品仓库；它已经比“几个页面 + 几个接口”复杂很多，但它仍然有意保持窄边界，不自称完整平台。
