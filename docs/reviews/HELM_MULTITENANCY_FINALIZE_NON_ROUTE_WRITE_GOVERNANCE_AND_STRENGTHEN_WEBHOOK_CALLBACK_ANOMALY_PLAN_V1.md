---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Finalize Non-Route Write Governance And Strengthen Webhook Callback Anomaly Plan V1

更新时间：2026-04-06

## 1. 当前 freeze truth

继承 PR42-PR57：

- `workspace-first`、`membership-backed` 是当前真实租户边界
- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- current-main session-backed sensitive write route 已补 tenant ownership helper
- 第一批 high-risk non-route tenant-sensitive service write 已进入 shared `service-governance` seam
- payment webhook callback 已具备 callback event substrate、authenticity 验证、tenant mapping 和 unresolved / duplicate / exception follow-through truth
- org-admin support-pack 与 settings governance surface 已能显示 export / delete / retention 和 webhook callback 的 deeper governance readout

当前仍未完整成立的点：

- remaining non-route tenant-sensitive service write 还没有最终 inventory truth；哪些已治理、哪些仍未治理、哪些属于 system / telemetry / callback 例外还需要最后一轮收口
- org-admin support-pack 对 `retention / delete / export` 仍偏 snapshot，缺少更深的 owner attribution、follow-through counter、latest marker 和 exception note
- webhook callback 虽已具备 tenant mapping truth，但 authenticity failure / duplicate / unresolved / exception 到 workspace audit truth 的边界仍需更强约束
- tenant isolation 仍主要依赖 application-layer `workspace` scoping，不是 schema-per-tenant / db-per-tenant

## 2. PR58 要证明什么

PR58 证明三件事：

1. remaining high-risk non-route tenant-sensitive service write 可以继续被诚实分类，并收进 capability / ownership governance
2. org-admin support-pack / settings governance surface 可以更完整表达 `export / retention / delete` 的 owner、audit、follow-through、exception posture 和 workspace isolation truth
3. external webhook callback 可以在不扩 execution authority 的前提下，具备更强的真实性异常治理、tenant mapping 分界和 workspace audit truth 约束

## 3. 精确 loop

### non-route service governance loop

1. 盘点 current-main remaining non-route write seam
2. 区分 user-initiated tenant-sensitive service write、system-owned runtime write、external callback write、telemetry write
3. 只把 remaining high-risk tenant-sensitive service write 收进 capability / ownership governance
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
5. verification failure / duplicate / unresolved / exception posture 保持为 external callback governance truth
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

## 5. Remaining inventory truth

PR58 当前冻结为高优先治理对象的 remaining non-route tenant-sensitive seam：

- `lib/billing/revenue-attribution.ts`
- `lib/billing/program-catalog.ts`
- `lib/imports/identity-resolution.service.ts`

当前明确不在 PR58 主治理口径里的写入口：

- 纯 telemetry / analytics 写入，例如 `lib/analytics/index.ts`
- 已有独立 capability seam 且本轮不变的 route / server-action 写入
- 不携带 session-backed workspace business truth 的 external callback 例外
- Helm v2 runtime 内部 system-owned write，不被误记成 user-initiated tenant-sensitive service write
- session substrate / onboarding foundation 这类系统级 provision write，不在本轮“remaining tenant-sensitive business write”口径里

## 6. Phase plan

### Phase 0

- 固化 PR58 计划文档
- 更新 `PLANS.md`
- 冻结 remaining non-route tenant-sensitive write inventory

### Phase 1

- 为 remaining high-risk non-route service write 增加 capability / ownership seam
- 保持 system-owned / telemetry / callback 例外口径诚实

### Phase 2

- 扩 org-admin support-pack / settings governance readout
- 增加 export / retention / delete deeper follow-through、owner attribution、latest marker、workspace isolation assertion 和 exception note

### Phase 3

- 扩 webhook callback authenticity / anomaly governance
- 强化 verification failure / duplicate / unresolved / exception posture 的 operator-readable truth

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
