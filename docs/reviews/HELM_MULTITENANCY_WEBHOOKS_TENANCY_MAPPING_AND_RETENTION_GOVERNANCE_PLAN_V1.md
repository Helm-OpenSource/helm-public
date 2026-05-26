---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Webhooks Tenancy Mapping And Retention Governance Plan V1

更新时间：2026-04-05

## 1. 当前 freeze truth

继承 PR42-PR53：

- `workspace-first`、`membership-backed` 是当前真实租户边界
- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- current-main session-backed sensitive write route 已补 tenant ownership helper
- org-admin support-pack 已能显示 export / delete / retention latest marker 与 isolation assertions

当前仍未完整成立的点：

- 支付 provider callback 仍是外部 webhook 例外，不适用 session-based ownership 断言
- 非 route 写入口的治理覆盖率还没有独立 inventory
- retention / delete governance 仍是 posture + audit snapshot，不是 deeper follow-through

## 2. PR54 要证明什么

PR54 证明三件事：

1. 外部 webhook 可以在不扩 execution authority 的前提下，具备更清楚的 tenant mapping / authenticity / unresolved governance truth
2. 剩余非 route sensitive write path 可以被诚实盘点并纳入 capability / ownership governance inventory
3. export / delete / retention 的 tenant-scoped governance 可以比 PR53 更深一层，支持 org-admin / operator 读到 owner、latest marker、workspace isolation assertion 和 unresolved posture

## 3. 精确 loop

1. provider callback 进入 `app/api/billing/*`
2. callback 先过签名校验 / notify verification
3. callback 再做 workspace resolution
4. resolution 成功才进入 `syncWorkspacePaymentStatusFromCallbackEvent(...)`
5. resolution 失败则进入 `ignored / unresolved` posture，并进入 governance readout
6. org-admin support-pack / settings governance surface 显示 webhook tenant mapping、export / delete / retention latest marker 和 isolation posture

同时并行一条 inventory loop：

1. 盘点非 route write entrypoint
2. 标注 capability seam / ownership seam / callback exception
3. 将缺失项纳入治理 inventory 或补 guard
4. 在 baseline/report 中诚实回答覆盖范围和例外

## 4. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 5. Phase plan

### Phase 0

- 盘点 Stripe / Alipay / WeChat Pay callback 当前 tenant mapping
- 盘点剩余非 route write entrypoint
- 更新 `PLANS.md`

### Phase 1

- 补 webhook tenant mapping / authenticity / unresolved governance posture
- 保持 external callback exception 口径诚实

### Phase 2

- 补 non-route write inventory 的 capability / ownership seam
- 明确哪些已覆盖、哪些仍是刻意例外

### Phase 3

- 扩 org-admin support-pack / settings governance readout
- 增加 export / delete / retention deeper governance、owner attribution、latest marker、workspace isolation assertions

### Phase 4

- baseline / report / README / docs index / self-check / boundary-check
- 全验证链

## 6. Eval / validation contract

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 7. 明确延期项

- full RBAC
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- full tenant-admin governance center
- execution authority expansion
- payment platform broadening beyond current narrow callback / lifecycle sync
