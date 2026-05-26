---
status: archived
owner: helm-core
created: 2026-04-25
review_after: 2026-10-22
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm GTM Capability Plan Readout Implementation Report V1

更新时间：2026-04-25
状态：Validation Passed; Full DB-Backed E2E Not Run
当前切片：`Reserved-only GTM capability plan readout + guided intake / confirmation / evidence / proof-pack prototypes on /operating`

## 1. 目标

把 [HELM_GTM_CAPABILITY_PLAN_REQUIREMENTS_V1.md](../product/HELM_GTM_CAPABILITY_PLAN_REQUIREMENTS_V1.md) 的第一条可开发能力落成最小闭环：

1. 在 `/operating` 上显示 Helm reserved tenant 的 GTM capability plan readout。
2. 只读取现有 program / application / sales referral 数据，不新增 schema。
3. 只在 operational Helm reserved workspace 且成员具备 contribution registry read 权限时读取和渲染。
4. 首屏展示 top GTM work items、guided intake brief prototype、confirmation / evidence / proof-pack prototypes、能力计划状态和非执行边界。
5. 不做 CRM、marketplace、auto-send、workspace creation、connector runtime、payout execution 或 customer-visible commitment。

## 2. 影响面

- `lib/gtm-capability-plan-readout.ts`
- `lib/gtm-capability-plan-readout.test.ts`
- `lib/internal-operating-workspace/foundation.ts`
- `features/internal-operating-workspace/queries.ts`
- `features/internal-operating-workspace/page-loader.ts`
- `features/internal-operating-workspace/internal-operating-home.tsx`
- `features/dashboard/page-loader.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/helm-self-check.ts`
- `README.md`
- `docs/README.md`
- `PLANS.md`

## 3. 当前已经完整成立

- `/operating` server loader 会按 `isOperationalHelmReservedWorkspace + canReadContributionRegistry` 决定是否读取 GTM source。
- GTM readout 只从现有 `PartnerProgram`、`ProgramApplication`、`SalesReferral` 读取。
- readout 会优先排序：
  1. submitted application review
  2. accepted-but-no-invite
  3. active program terms gap
  4. referral proof candidate
- `/operating` 首屏新增 `data-gtm-capability-plan-readout="true"` 的 readout 卡，显示 counts、top work items、capability plan status 和 boundary。
- readout 内新增 `data-gtm-guided-intake-brief-prototype="true"` 的 Phase 2 原型，显示 sales-led / self-serve 共用 `CustomerDemandBrief` contract、5 个必填字段、每步不超过 5 个问题、source trace preview、clean handoff checks 和 trial initialization review gate。
- readout 内新增 `data-gtm-confirmation-evidence-prototype="true"` 和 `data-gtm-diagnostic-proof-pack-prototype="true"`，显示客户确认动作、material rewrite 规则、control-line evidence downgrade、first loop contract 和 proof-pack claim level。
- 非 reserved workspace 或无商业读权限时，readout 不读取、不渲染。

## 4. 已成形但仍需下一层

- Guided intake / CustomerDemandBrief 已形成 read-only prototype；仍未进入写入、客户提交或 trial initialization action。
- Customer confirmation / controlled rewrite 已形成 read-only prototype；仍未进入客户提交动作。
- Control-line evidence review 已形成 read-only prototype；仍未进入 review queue 写入。
- Diagnostic / first loop starter 已形成 read-only prototype；仍未进入执行动作。
- Proof pack / GTM asset candidate 已形成 read-only prototype；仍未进入公开使用审批或发布。

## 5. 刻意未做

- 不新增 Prisma schema。
- 不新增 API 或 action。
- 不新增 customer-facing GTM 页面。
- 不创建 workspace。
- 不自动 invite。
- 不自动外发。
- 不自动接入客户系统。
- 不自动结算或打款。

## 6. 风险项

1. 当前 readout 依赖现有 program / application / referral 数据质量；如果 seed 或 backfill 不完整，首屏只能显示空状态。
2. 这只是 Phase 1 readout，不代表 GTM capability plan 已全部实现。
3. 后续若进入 customer-facing intake 或提交动作，必须先写 implementation plan，明确 clean handoff、source trace、review gate、权限和回滚路径。

## 7. 验证结果

- `npm run test -- lib/gtm-capability-plan-readout.test.ts lib/internal-operating-workspace/foundation.test.ts features/internal-operating-workspace/display-copy.test.ts` passed；3 files / 7 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed。
- `npm run check:boundaries` passed。
- `npm run lint` passed with existing 7 warnings and 0 errors。
- `npm run build` passed with 2 existing Turbopack NFT trace warnings。
- `npm run quality:regression` passed；51 files / 181 tests。
- `git diff --check` passed。

## 8. 未运行验证

- `npm run db:reset` 未运行：本轮没有 schema / seed / migration 改动，且 DB reset 有破坏性副作用。
- `npm run e2e` 未运行：完整 DB-backed e2e 需要本地测试库前提，本轮已用 targeted tests、typecheck、self-check、boundary、lint、build、quality regression 和 diff check 收口。
