---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Broader Non-Route Sensitive Write Governance And Org-Admin Deeper Slice Plan V1

更新时间：2026-04-05

## 1. 当前 freeze truth

继承 PR42-PR55：

- `workspace-first`、`membership-backed` 是当前真实租户边界
- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- current-main session-backed sensitive write route 已补 tenant ownership helper
- payment webhook callback 已具备 authenticity、tenant mapping、callback-event follow-through truth
- 第一批 non-route tenant-sensitive service write 已进入 shared `service-governance seam`
- org-admin support-pack 已能显示 export / delete / retention latest marker，以及 webhook callback follow-through readout

当前仍未完整成立的点：

- remaining non-route tenant-sensitive service write 还没有形成完整 inventory truth，哪些已治理、哪些仍未治理、哪些是刻意例外还不够系统化
- org-admin support-pack 对 retention / delete 的治理视图仍偏 snapshot，缺少更深的 owner attribution、follow-through counter 和 exception posture
- webhook callback 已能 tenant-map，但 authenticity / anomaly / duplicate / unresolved 的治理表达还没有形成更明确的异常治理层
- tenant isolation 仍主要依赖 application-layer `workspace` scoping，不是 schema-per-tenant / db-per-tenant

## 2. PR56 要证明什么

PR56 证明三件事：

1. remaining non-route tenant-sensitive service write 可以被诚实盘点，并把下一批 high-risk seam 收进 capability / ownership governance
2. org-admin support-pack / settings governance surface 可以更完整地表达 export / retention / delete 的 owner、audit、follow-through 和 exception note
3. external webhook callback 可以在不扩 execution authority 的前提下，具备更清楚的 authenticity / tenancy anomaly governance truth

## 3. 精确 loop

### non-route service governance loop

1. 盘点 current-main remaining non-route write seam
2. 区分 user-initiated tenant-sensitive service write、system-owned runtime write、external callback write、telemetry write
3. 只把 high-risk tenant-sensitive service write 收进 capability / ownership governance
4. 把 system / telemetry / callback 例外诚实保留在 baseline / report 中

### export / retention / delete governance loop

1. export / delete / retention 主路径继续保持 workspace-scoped truth
2. org-admin support-pack 补齐 latest marker、owner attribution、follow-through counter、workspace isolation assertion、exception note
3. settings/operator surface 显示治理状态和 audit 统计，不把 explanation 写成 commitment

### webhook callback anomaly loop

1. provider callback 进入 `app/api/billing/*`
2. callback 先过 authenticity / verification
3. callback 再做 tenant mapping / workspace resolution
4. resolution 成功才进入 workspace-scoped billing sync 与 audit truth
5. duplicate / unresolved / exception / verification-failure posture 保持为 external callback governance truth
6. support-pack / settings governance surface 明确区分 workspace truth 与 external callback anomaly truth

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

PR56 第一轮只把以下 remaining non-route tenant-sensitive service seam 视为高优先治理对象：

- `lib/billing/manual-settlement.ts`
- `lib/billing/revenue-attribution.ts`
- `lib/billing/program-catalog.ts`
- `lib/imports/index.ts`
- `lib/imports/identity-resolution.service.ts`
- `lib/memory/meeting-memory-pipeline.service.ts`
- `lib/memory/briefing.service.ts`
- `lib/memory/blocker.service.ts`
- `lib/memory/commitment.service.ts`
- `lib/memory/memory-fact.service.ts`
- `lib/policies/engine.ts`

当前明确不在 PR56 主治理口径里的写入口：

- 纯 telemetry / analytics 写入，例如 `lib/analytics/index.ts`、`lib/observability/llm-call-log.service.ts`
- 已有独立 capability seam 且本轮不变的 route / server-action 写入
- 不携带 session-backed workspace business truth 的 external callback 例外
- Helm v2 runtime 内部 system-owned write，不被误记成 user-initiated tenant-sensitive service write

## 6. Phase plan

### Phase 0

- 固化 PR56 计划文档
- 更新 `PLANS.md`
- 冻结第一轮 remaining non-route tenant-sensitive write inventory

### Phase 1

- 为第一批 remaining non-route service write 增加 capability / ownership seam
- 保持 system-owned / telemetry / callback 例外口径诚实

### Phase 2

- 扩 org-admin support-pack / settings governance readout
- 增加 export / retention / delete deeper follow-through、owner attribution、latest marker、workspace isolation assertion 和 exception note

### Phase 3

- 扩 webhook callback authenticity / tenancy anomaly governance
- 强化 duplicate / unresolved / exception / verification-failure posture 的 operator-readable truth

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
