---
status: active
owner: helm-core
created: 2026-04-22
review_after: 2026-07-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Capability Decision Trace Read-Only Adoption Plan V1

更新时间：2026-04-24
状态：Delivered on Branch

## 1. 当前 truth source

这份 plan 建立在以下 current-main 文档之上：

- [HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/reviews/HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md)
- [HELM_CAPABILITY_RESOLUTION_ENGINE_REQUIREMENTS_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_CAPABILITY_RESOLUTION_ENGINE_REQUIREMENTS_V1.md)
- [HELM_CAPABILITY_DECISION_TRACE_READ_MODEL_DRAFT_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_CAPABILITY_DECISION_TRACE_READ_MODEL_DRAFT_V1.md)
- [HELM_MULTITENANCY_CAPABILITY_AND_TENANT_OWNERSHIP_GOVERNANCE_BASELINE_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_MULTITENANCY_CAPABILITY_AND_TENANT_OWNERSHIP_GOVERNANCE_BASELINE_V1.md)

## 2. 为什么现在开这条 plan

当前 `Capability Resolution Engine` 已经完成：

- requirements freeze
- decision trace read model draft

下一步如果直接改 allow / deny 行为，风险过高。
因此这条 plan 只做一个更窄的 adoption：

- 先做 `read-only capability decision trace`

## 3. 这条 slice 要证明什么

本轮只证明：

`reserved-only / commercial-governed / review-first` 的高风险路径，可以先产出统一的 read-only capability decision trace，而不改变任何最终执行结果。

本轮不证明：

- capability engine 已经接管决策
- broad path coverage
- workflow graph
- public policy explorer

## 4. 精确范围

### 第一批 narrow cohort

当前仓库中最适合的 read-only adoption cohort：

- [features/programs/actions.ts](/Users/tommyqian/Documents/GitHub/helm2026/features/programs/actions.ts)
- [features/participant-portal/actions.ts](/Users/tommyqian/Documents/GitHub/helm2026/features/participant-portal/actions.ts)
- [lib/billing/manual-settlement.ts](/Users/tommyqian/Documents/GitHub/helm2026/lib/billing/manual-settlement.ts)

选择原因：

1. 都是 reserved / commercial / review-first 主线
2. 都带高风险写入或高风险治理后果
3. 当前 already has governance guards，但解释口径仍分散

### 第一批只读 trace 目标

本轮只要求 trace 覆盖以下 posture：

- workspace / membership truth
- reserved-only posture
- ownership / service governance posture
- review-required / manual-ack-required posture
- hard boundary posture

## 5. 保留边界

继续明确保留：

- `workspace-first`
- `membership-backed`
- `judgement-first`
- `review-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- trace 不等于 authority grant
- trace 不等于 execution timeline

## 6. phase plan

### Phase 1

- 盘点第一批 cohort 里的实际 guard source
- 把现有 guard 结果映射到统一 reason code / downgrade path vocabulary
- 不改任何 route / action 最终结果

### Phase 2

- 引入 read-only trace builder
- 在 selected cohort 上生成 trace payload
- trace 默认只给 operator / diagnostics 用

### Phase 3

- 增加最小 readout：
  - decision
  - primary reason
  - downgrade path
  - fallback
- source chain 保持二级展开

### Phase 4

- 运行 targeted tests / self-check / boundary wording check
- 冻结本轮 report
- 决定是否进入真实 capability engine adoption

## 7. 第一批映射要求

第一版至少映射：

1. `assertHelmReservedWorkspaceAccess` 一类 reserved-only gate
2. service-governance assertion
3. membership / manage posture denial
4. review-required / manual ack posture
5. hard boundary block

第一版不要求：

- 所有 legacy route 都接 trace
- 所有 helper 都被统一重写

## 8. operator readout 要求

默认只显示：

- 谁请求的
- 请求了什么 capability / effect posture
- 当前 decision
- primary reason
- 是否降级
- 下一步 fallback

默认不显示：

- 全量 source chain 明细
- 全量 policy tree
- customer-facing wording

## 9. 交付物

本轮 implementation 进入时，最小交付物应该是：

- read-only trace builder
- narrow cohort adapters
- targeted tests
- optional diagnostics/operator readout
- report / docs / index sync

## 10. 明确延期项

继续延期：

- capability engine 接管 allow / deny
- broad path rollout
- route rewrite
- execution authority expansion
- customer-facing trace
- public policy explorer

## 11. done definition

这条 plan 只有在以下条件同时成立时才算完成：

1. 第一批 narrow cohort 可以产出统一 trace payload
2. operator 能读懂 `decision / reason / downgrade / fallback`
3. 没有改变现有 allow / deny / review 行为
4. targeted verification 通过
5. docs / report / index 已同步

## 12. branch adoption result

当前分支已按本 plan 完成第一批 read-only adoption：

- 新增 [lib/capability-decision-trace.ts](/Users/tommyqian/Documents/GitHub/helm2026/lib/capability-decision-trace.ts)
- 新增 [lib/capability-decision-trace.test.ts](/Users/tommyqian/Documents/GitHub/helm2026/lib/capability-decision-trace.test.ts)
- `features/programs/actions.ts` 和 `features/participant-portal/actions.ts` 在 selected write actions 返回 `capabilityDecisionTrace`
- `features/settings/actions.ts` 在 manual settlement action wrapper 返回 `capabilityDecisionTrace`
- `lib/billing/manual-settlement.ts` 暴露 manual settlement trace resolver，同时保持底层 service 返回值不变
- 收口报告见 [HELM_CAPABILITY_DECISION_TRACE_READ_ONLY_ADOPTION_REPORT_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/reviews/HELM_CAPABILITY_DECISION_TRACE_READ_ONLY_ADOPTION_REPORT_V1.md)

仍然明确延期：

- capability engine 接管 allow / deny
- broad path rollout
- customer-facing trace
- public policy explorer
