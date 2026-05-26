---
status: archived
owner: helm-core
created: 2026-04-25
review_after: 2026-10-22
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm GTM CustomerDemandBrief Draft Flow Implementation Report V1

更新时间：2026-04-25
状态：Validation Passed; Full DB-Backed E2E Not Run
当前切片：`Reserved-only CustomerDemandBrief draft candidate flow on /operating`

## 1. 目标

在已有 `/operating` GTM capability plan readout 上继续推进 Phase 5：

1. 从 Helm reserved tenant 的 `ProgramApplication` 生成 `CustomerDemandBrief` 内部草稿候选。
2. 草稿只写入现有 `ActionItem + ApprovalTask`，进入人工复核。
3. 保持 `trialInitializationPayload`、customer-visible summary、invite、workspace creation、external send、customer-system write 全部不执行。
4. 普通客户租户不可见、不可触发；非 Helm reserved workspace 不可触发。
5. 不新增 Prisma schema、公开 API、customer-facing GTM 页面、connector runtime、payment / settlement 执行或 marketplace 行为。

## 2. 影响面

- `lib/gtm-customer-demand-brief-draft.ts`
- `lib/gtm-customer-demand-brief-draft.test.ts`
- `features/internal-operating-workspace/gtm-actions.ts`
- `features/internal-operating-workspace/queries.ts`
- `features/internal-operating-workspace/internal-operating-home.tsx`
- `lib/gtm-capability-plan-readout.ts`
- `lib/gtm-capability-plan-readout.test.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/helm-self-check.ts`
- `README.md`
- `docs/README.md`
- `PLANS.md`

## 3. 当前已经完整成立

- 新增 `GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND` 元数据类型，明确该草稿只来自 `ProgramApplication`，source type 为 `program_application`。
- `buildGtmCustomerDemandBriefDraft` 会生成内部草稿内容、source trace、missing information、clean handoff checks 和边界元数据。
- `/operating` 新增 `data-gtm-demand-brief-draft-flow="true"` 区域，reserved operator 可从应用候选生成草稿，已有草稿则回到 `/approvals?approvalId=...#approval-preview`。
- `createGtmCustomerDemandBriefDraftAction` 只在 `isOperationalHelmReservedWorkspace + canManageProgramApplications` 成立时写入。
- 写入结果是 `ActionType.DRAFT_INTERNAL_NOTE`、`ActionExecutionMode.REQUIRES_APPROVAL`、`ActionStatus.PENDING_APPROVAL` 和 `ApprovalTask.PENDING`。
- action 明确写入 audit：`GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_CREATED`。
- 查询层会读取最近的 demand brief draft，并把它们回填到 readout，避免重复生成。

## 4. 已成形但仍需下一层

- 草稿候选已经进入审批队列；还没有“审批通过后进入 trial initialization planning”的后续 action。
- 客户确认 / 补充 / 申请修改仍是 read-only prototype；还没有 customer-facing submission。
- Control-line evidence review 和 proof-pack 仍是 read-only prototype；还没有独立 review queue 写入。

## 5. 刻意未做

- 不新增 Prisma schema。
- 不新增公开 API route。
- 不创建 workspace。
- 不启动 trial initialization。
- 不自动 invite。
- 不自动外发。
- 不写客户系统。
- 不把 referral、settlement 或 contribution attribution 带入客户 workspace。
- 不做 CRM、marketplace、payment rail 或完整 workflow engine。

## 6. 风险项

1. 草稿内容依赖 `ProgramApplication` 的现有字段质量；source 不完整时只能生成带缺口的内部候选。
2. Safari hard navigation 到 `/operating#gtm-demand-brief-draft` 仍会落入 loading recovery；Computer Use 证明这是浏览器 hard-load recovery 问题，不是 GTM readout 数据或权限问题。
3. 审批通过后的下一段仍未实现；本轮只能证明“生成 reviewable candidate”，不能证明试用初始化闭环。

## 7. 验证结果

- `npm run test -- lib/gtm-customer-demand-brief-draft.test.ts lib/gtm-capability-plan-readout.test.ts` passed；2 files / 5 tests。
- `npm run test -- lib/internal-operating-workspace/foundation.test.ts features/internal-operating-workspace/display-copy.test.ts` passed；2 files / 4 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；18/18。
- `npm run check:boundaries` passed。
- `npm run lint` passed；0 errors / 7 existing warnings。
- `npm run build` passed；保留既有 2 个 Turbopack NFT trace warnings。
- `npm run quality:regression` passed；51 files / 181 tests。
- `git diff --check` passed。
- Computer Use / Safari：从 dashboard 点击左侧 `经营总盘` 能进入真实 `/operating`；但硬跳 `/operating#gtm-demand-brief-draft` 后仍停在 loading recovery。这是既有 Safari hard navigation / recovery 问题，本轮未声称关闭。
- Playwright / Chromium：`/demo -> POST /demo/start founder -> /operating` passed；页面包含 `data-gtm-capability-plan-readout="true"` 与 `data-gtm-demand-brief-draft-flow="true"`，并显示 `ActionItem + ApprovalTask`、`不创建 workspace`、`不外发材料`、`不写客户系统`、`不启动试用初始化`。

## 8. 未运行验证

- `npm run db:reset` 未运行：会重置本地数据库，有破坏性副作用，本轮不需要 schema / migration 验证。
- `npm run e2e` 未运行：完整 DB-backed e2e 仍需要独立测试库前提；本轮用 targeted tests、typecheck、self-check、boundary、lint、build、quality regression、Computer Use 和 Playwright 收口。
