---
status: archived
owner: helm-core
created: 2026-04-24
review_after: 2026-10-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Capability Decision Trace Read-Only Adoption Report V1

更新时间：2026-04-24
状态：Delivered on Branch

## 1. 结论

本轮把 `Capability Resolution Engine` 的第一批最窄 adoption 从 plan-only 推进到 read-only implementation：

- 新增统一 `CapabilityDecisionTrace` builder
- 第一批 cohort 可以产出 `decision / primary reason / downgrade path / fallback`
- program application、participant portal、manual settlement 的现有 guard 仍是唯一 enforcement source
- 没有把 capability engine 接管 allow / deny
- 没有新增控制面、workflow graph、public policy explorer 或 execution authority

## 2. 本轮落点

### 2.1 Trace builder

- `lib/capability-decision-trace.ts`
  - `buildCapabilityDecisionTrace`
  - `buildCapabilityDecisionOperatorReadout`
  - `buildProgramApplicationCapabilityDecisionTrace`
  - `buildParticipantPortalCapabilityDecisionTrace`
  - `buildManualSettlementCapabilityDecisionTrace`

Trace 结构保持 read model draft 的七段式：

- actor
- request
- context
- evaluation
- result
- fallback
- audit

### 2.2 Narrow cohort adoption

- `features/programs/actions.ts`
  - `reviewProgramApplicationAction`
  - `issueProgramApplicationInviteAction`
  - 返回 `capabilityDecisionTrace`
- `features/participant-portal/actions.ts`
  - `issueParticipantPortalAccessAction`
  - `updateParticipantPortalAccessStatusAction`
  - 返回 `capabilityDecisionTrace`
- `features/settings/actions.ts`
  - manual settlement action wrapper 返回 `capabilityDecisionTrace`
- `lib/billing/manual-settlement.ts`
  - 重新导出 `buildManualSettlementCapabilityDecisionTrace`
  - 底层 service 返回值不变，避免影响 seed / existing settlement service caller

## 3. 当前已覆盖 posture

本轮 trace 已覆盖：

- `workspace_truth`
- `actor_posture`
- `target_ownership`
- `declaration_truth`
- `hard_boundary`
- `review_requirement`

当前 reason code 至少覆盖：

- `allowed`
- `workspace_missing`
- `membership_missing`
- `capability_not_granted`
- `ownership_mismatch`
- `reserved_only`
- `capability_not_declared`
- `effect_mode_exceeded`
- `customer_facing_review_required`
- `hard_boundary_blocked`
- `manual_ack_required`
- `unsupported_runtime_posture`

## 4. 保留边界

本轮继续明确：

- read-only capability decision trace 不是新控制面
- trace 不授予权限
- trace 不替代 `canManage*` helper
- trace 不替代 `assertHelmReservedWorkspaceAccess`
- trace 不替代 service-governance assertion
- trace 不做 public policy explorer
- trace 不做 customer-facing decision explanation
- trace 不创建 payout rail、marketplace 或 customer-visible send authority

## 5. 验证

本轮已执行：

```bash
npx vitest run lib/capability-decision-trace.test.ts
DATABASE_URL="mysql://root:***@${HELM_CI_DATABASE_HOST}:3306/helm2026_ci_verify?charset=utf8mb4" npm run self-check
npm run check:boundaries
npx eslint lib/capability-decision-trace.ts lib/capability-decision-trace.test.ts features/programs/actions.ts features/participant-portal/actions.ts features/settings/actions.ts lib/billing/manual-settlement.ts scripts/helm-self-check-refactored.ts scripts/helm-self-check.ts scripts/decision-first-boundary-check.ts
git diff --check
```

结果：

- reserved workspace + admin 允许态
- member 缺 capability 的 deny trace
- 非 reserved workspace 的 `reserved_only` deny trace
- manual ack 缺失时进入 human fallback
- system actor 不做 user capability re-check，但仍保留 reserved ownership gate
- `self-check` 13/13 通过
- `check:boundaries` 通过
- targeted ESLint 通过
- `git diff --check` 通过

仓库级 `npm run typecheck` 当前仍被 existing baseline 卡住，主要是：

- `.next/types/* d 2.ts` duplicate declaration
- Prisma Client 尚未包含 `biReport*` / `engineeringDelivery*` model delegate

这些失败不来自本轮 `capabilityDecisionTrace` 变更。

## 6. 下一步

下一阶段如果继续推进，应该只做其中一条：

1. 把 trace readout 接进 operator diagnostics UI，但仍保持 read-only
2. 扩第二批 cohort，并保持每批都有 targeted tests
3. 在进入真实 capability engine 接管前，先补 precedence contract test

不建议下一步直接让 engine 接管 allow / deny。
