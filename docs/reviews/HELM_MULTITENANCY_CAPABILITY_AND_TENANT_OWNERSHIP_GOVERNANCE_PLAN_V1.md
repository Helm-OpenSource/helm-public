---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# PR53 - Capability And Tenant Ownership Governance

更新时间：2026-04-05  
状态：In Progress

## 1. 当前 freeze truth

继承 PR42-PR52：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / memory / imports / connector / commercial / workspace data / action / insight 多批高风险写路径已进入 capability seam
- org-admin support pack 已成立
- tenant-scoped export / delete / retention posture 已有前几层 readout

但当前仍存在两类缺口：

1. 部分 sensitive write route 虽然已有 capability gate，但缺少显式 tenant ownership 断言  
2. org-admin support pack 对 export / delete / retention 与 workspace isolation 的治理视图还不够深，owner attribution 与 isolation assertion 还不够清楚

## 2. PR53 证明什么

PR53 证明以下内容在 current-main 成立：

1. export / delete / retention 所涉及的数据都明确 scoped 到 active workspace  
2. 当前敏感 write route 在执行前要求 tenant ownership 断言，缺失处补齐  
3. org-admin support pack 能显示 export / delete / retention deeper governance、owner attribution、workspace isolation assertions  
4. settings/operator surface 能把治理状态和最近审计统计以 operator-readable 方式展示

## 3. 本轮精确范围

### 路由与写路径治理

- memory export / facts / commitments / blockers
- capture start / ingest / stop
- runtime direct mutation
- Helm v2 runtime mutate / review routes
- import mutate / conflict resolution
- insight feedback / suggestion adoption
- recommendations / meetings 中相关 server actions

### 治理视图

- org-admin support pack
- settings governance surface

## 4. 本轮高风险 write path inventory

本轮纳入治理盘点并补 guard 的主路径：

- `/api/memory/export`
- `/api/memory/facts/*`
- `/api/blockers/*`
- `/api/commitments/*`
- `/api/conversation-capture/*`
- `/api/runtime/events/meeting-ended`
- `/api/runtime/memory/meeting-facts/confirm`
- `/api/helm-v2/runtime/*` 中 mutate / review routes
- `/api/imports/*` 中 preview / run / sync / warmup / conflict resolve
- `/api/recommendations/[id]/feedback`
- `/api/evolution/strategy-suggestions/[id]/accept`
- `/api/evolution/strategy-suggestions/[id]/dismiss`
- `features/recommendations/actions.ts`
- `features/meetings/actions.ts`

明确不纳入 tenant ownership 断言的例外：

- payment webhook / notify callback
- recommendation track analytics route

这些路径不是用户持有 session 后直接对 workspace object 的高风险治理写入面。

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 6. 不做

- full RBAC
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform
- broader workflow / orchestration / execution surface

## 7. 风险

1. 如果 ownership helper 只补 route 不补 support-pack/readout，operator 仍无法看到治理 truth  
2. 如果 export / delete / retention 的 owner attribution 不落到 support-pack，审计只能停留在 count 层  
3. 如果把 callback / analytics route 强行塞进 tenant-object ownership 模型，会把非同类路径混淆成“覆盖率”

## 8. 阶段

### Phase 0

- 扩 plan scope 到 capability + tenant ownership governance
- 更新 `PLANS.md`

### Phase 1

- 补齐 remaining sensitive write route 的 tenant ownership 断言
- 规范 export route 的 workspace-scoped filter 语义

### Phase 2

- 扩 org-admin support pack deeper governance：
  - latest export / delete / retention marker
  - actor / target / sourcePage
  - workspace isolation assertions

### Phase 3

- 更新 settings/operator surface，显示治理状态和审计统计

### Phase 4

- 测试 / README / docs index / self-check / boundary guard / baseline / report

## 9. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 10. 明确延期项

- full RBAC / custom role builder
- enterprise IAM / SSO / SCIM
- org hierarchy / shared billing
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform / governance center
- execution authority expansion
