---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm WeCom Calendar Registry Seam Plan V1

更新时间：2026-04-07
结论：Completed

## 1. 目标

PR90 只做 WeCom calendar registry seam：

1. 复核现有 callback / meetings runtime truth
2. 建立 workspace-scoped `cal_id` registry
3. 做 registry validation truth
4. 在 settings/operator 第一屏只保留最关键的四个经营事实
5. 补 baseline / report / README / docs / guards / tests

它不是：

- native WeCom SCIM
- WeCom calendar runtime ingestion
- WeCom message notifications runtime ingestion
- send/write-back
- broader connector orchestration platform
- connector platformization
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_WECOM_OAUTH_CALLBACK_RUNTIME_FOUNDATION_BASELINE_V1.md`
- `HELM_WECOM_READONLY_INGESTION_SEAM_BASELINE_V1.md`
- `HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前已经成立：

- WeCom runtime OAuth callback foundation
- WeCom `meetings` runtime ingestion seam
- tenant-scoped callback / ingest audit truth

当前本轮要补齐：

- workspace-scoped `cal_id` registry
- registry validation truth
- `calendar runtime pending` 的明确 operator wording
- business-first settings/operator readout

当前仍未成立：

- native WeCom SCIM
- WeCom `calendar` runtime ingestion
- WeCom `message notifications` runtime ingestion
- send/write-back
- connector platformization

## 3. 本轮要证明什么

1. WeCom `calendar` 不再只是 `verified-but-unbound`，而是能进入 registry-backed 的下一层准备状态
2. Helm 可以在不新造平台表的前提下，用现有 connector metadata 持久化 workspace-scoped registry
3. settings/operator 可以先展示最关键的经营决策信息，而不是把 callback / scope / contract 全部挤在第一屏
4. current repo truth 仍不会把 `calendar runtime`、`message notifications runtime`、native WeCom SCIM 写成已成立

## 4. 精确闭环

`connected WeCom connector -> user enters cal_id list -> registry validation -> connector metadata persistence -> settings/operator readout -> later registry-backed runtime slice`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- current repo truth does not claim native WeCom SCIM
- current repo truth does not claim WeCom calendar runtime
- current repo truth does not claim WeCom message notifications runtime

## 6. 范围

- `lib/connectors/wecom.ts`
- `lib/connectors/wecom-ingestion.ts`
- `lib/connectors/wecom.test.ts`
- `lib/connectors/wecom-ingestion.test.ts`
- `features/connectors/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- PR90 baseline / report / README / docs / guards

## 7. 不做

- native WeCom SCIM
- WeCom calendar runtime ingestion
- WeCom message notifications runtime ingestion
- send/write-back
- broader connector orchestration platform
- connector platformization
- 自动执行动作

## 8. 风险

1. 如果没有先把 registry 和 runtime 拆开，页面文案很容易把 `calendar runtime` 写过头
2. 如果为 registry 新造大而全的数据层，PR90 会被误扩成 connector platform
3. 如果第一屏继续堆解释而不是给出最关键的经营动作，UI 简化目标会失败

## 9. 阶段计划

### Phase 0

- 复核 callback / meetings runtime / calendar contract
- 冻结 PR90 plan、baseline、report 骨架
- 状态：Completed

### Phase 1

- 建立 workspace-scoped `cal_id` registry
- 建立 registry validation truth
- 状态：Completed

### Phase 2

- settings/operator 第一屏收口
- tests / docs / guards
- 状态：Completed

### Phase 3

- 完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
- `npm run pilot:check`
