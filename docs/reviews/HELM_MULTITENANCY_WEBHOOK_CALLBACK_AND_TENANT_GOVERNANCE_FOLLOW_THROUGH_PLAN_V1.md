---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Webhook Callback And Tenant Governance Follow-Through Plan V1

更新时间：2026-04-05

## 1. 当前 freeze truth

继承 PR42-PR54：

- `workspace-first`、`membership-backed` 是当前真实租户边界
- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- current-main session-backed sensitive write route 已补 tenant ownership helper
- payment webhook callback 已补 provider authenticity、tenant mapping、hint fallback / mismatch 与 unresolved posture
- connector OAuth callback GET write path 已补 workspace capability + membership ownership guard
- org-admin support-pack 已能显示 export / delete / retention latest marker、isolation assertion，以及 webhook governance latest marker

当前仍未完整成立的点：

- broader non-route sensitive write inventory 还没有被系统化冻结，仍缺一层“哪些 service write 已治理、哪些仍未治理、哪些是刻意例外”的诚实口径
- org-admin support-pack 对 export / delete / retention 的 readout 仍偏 snapshot，缺少更深的 owner attribution、follow-through 计数和 exception posture
- 外部 webhook 虽已 tenant-mapped，但 unresolved / replay / duplicate posture 仍缺更深一层 governance follow-through
- tenant isolation 仍主要依赖 application-layer `workspace` scoping，不是 schema-per-tenant / db-per-tenant

## 2. PR55 要证明什么

PR55 证明三件事：

1. webhook callback tenancy mapping 可以从“已可用”推进到“有 follow-through truth”，包括 unresolved / duplicate / exception posture 的治理表达
2. remaining non-route sensitive write path 可以被诚实盘点，并把第一批高风险 service seam 收进 capability / ownership governance
3. org-admin support-pack 和 settings/operator surface 可以更完整地表达 export / delete / retention 的 owner、audit、workspace isolation assertion 和 governance follow-through

## 3. 精确 loop

### webhook callback follow-through loop

1. provider callback 进入 `app/api/billing/*`
2. callback 先过 provider authenticity 校验
3. callback 再做 workspace resolution
4. resolution 成功才进入 workspace-scoped billing sync 与 audit
5. resolution 失败、冲突、重复或 exception posture 保持在外部 callback truth，不直接混入 workspace audit truth
6. org-admin support-pack / settings governance surface 只显示已断言 tenant mapping 的 workspace truth，同时明确 unresolved / external exception boundary

### non-route sensitive write inventory loop

1. 盘点 current-main tenant-sensitive non-route write seam
2. 区分 session-backed service write、external callback write、telemetry / analytics write 三类
3. 把第一批 high-risk service write 收进 capability / ownership seam
4. 把剩余仍未纳入治理的部分如实记入 baseline / report，不伪装成“全部完成”

### export / delete / retention follow-through loop

1. export / delete / retention 主路径继续保持 workspace-scoped truth
2. support-pack 补齐 latest marker、owner attribution、follow-through counter、workspace isolation assertion
3. settings/operator surface 显示治理状态、审计计数和 exception note

## 4. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 5. 第一轮 inventory truth

PR55 第一轮只把以下非 route tenant-sensitive write seam 视为高优先治理对象：

- `lib/billing/integration.ts`
- `lib/reports/index.ts`
- `lib/recommendations/recommendation.service.ts`
- `lib/recommendations/recommendation-feedback.service.ts`
- `lib/imports/crm-orchestrator.service.ts`
- `lib/imports/warmup.service.ts`
- `lib/conversation-capture/capture-session.service.ts`
- `lib/conversation-capture/conversation-understanding.service.ts`

当前明确不在 PR55 主治理口径里的写入口：

- 纯 telemetry / analytics 写入，例如 `lib/analytics/index.ts`
- 已有独立 capability seam 且本轮不变的 route/server-action 写入
- 不携带 workspace business truth 的外部 callback 例外

## 6. Phase plan

### Phase 0

- 固化 PR55 计划文档
- 更新 `PLANS.md`
- 冻结第一轮 non-route sensitive write inventory

### Phase 1

- 为 billing webhook callback 增加更深一层 duplicate / unresolved / exception governance follow-through
- 保持 external callback exception 口径诚实，不混成 session-backed ownership truth

### Phase 2

- 为第一批 tenant-sensitive non-route service write 增加 capability / ownership seam
- 明确哪些已覆盖、哪些仍是下一层

### Phase 3

- 扩 org-admin support-pack / settings governance readout
- 增加 export / delete / retention deeper follow-through、owner attribution、latest marker、workspace isolation assertion 和 exception note

### Phase 4

- baseline / report / README / docs index / self-check / boundary-check
- 全验证链
- stacked PR

## 7. 验证合同

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 明确延期项

- full RBAC
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- full tenant-admin governance center
- execution authority expansion
- payment platform broadening beyond current narrow callback / lifecycle sync
