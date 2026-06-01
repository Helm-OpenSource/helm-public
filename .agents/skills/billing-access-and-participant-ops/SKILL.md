# billing-access-and-participant-ops

## 适用场景

用于：

- `lib/billing/`、`app/api/billing/`、`features/settings/`、`app/(workspace)/settings`
- `lib/auth/trial-onboarding.ts`、`lib/auth/participant-portal*.ts`、`features/participant-portal/`、`app/portal`
- billing / trial / grace / read_only / membership / active seat / worker entitlement / participant posture / settlement / payment rail 相关改动

## 默认 skill 叠加

先套：

- `helm-repo-default-workflow`
- `api-and-interface-design`
- `security-and-hardening`

按触发追加：

- settings / portal 页面与文案改动：`frontend-ui-engineering`
- 生命周期、状态表达或旧路径收缩：`deprecation-and-migration`
- narrow payment、trial onboarding、entitlement ops 推进：`readiness-sprint`
- billing foundation / portal / lifecycle freeze：`baseline-freeze`

## 默认工作流

1. 先判断本轮属于哪条商业主线：
   - billing foundation
   - trial / grace / read_only lifecycle
   - seat / membership / worker entitlement
   - participant portal / contributor posture
   - narrow payment rail / manual settlement proof
2. 明确 customer-facing truth 和 internal-only truth：
   - settings 仍是产品 billing overview，不是 finance console
   - participant portal 仍是 invited self-only / narrow self-serve，不是完整 marketplace
   - payment rail 仍是窄接线，不承诺完整 portal parity 或自动 payout execution
3. 先做最小代表性链路：
   - 一个生命周期变更
   - 一个 settings / portal surface
   - 一个 proof / audit / settlement 入口
4. 任何状态、entitlement 或 posture 变化都要同步检查：
   - 权限可见范围
   - 文案边界
   - audit / seed / demo posture
5. README / docs / self-check / regression 与商业边界一起收口

## 禁止事项

- 不把 settings 扩成 finance console
- 不把 contributor / participant 流程扩成 marketplace
- 不把局部 payment / portal 成立写成完整商业平台
- 不绕开 entitlement / membership / access boundary 直接放权

## 交付物

- 代码与文档改动
- 必要的 seed / demo posture / settings 或 portal 同步
- 商业边界说明或 sprint / freeze 报告
- 明确验证结果

## 验证清单

默认完整验证链：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

领域额外核验：

- trial / grace / read_only posture 是否仍与 access state 一致
- seat / membership / entitlement 是否仍与 settings truth 对齐
- participant portal invite / token / self-only scope 是否仍收窄
- payment / settlement 文案是否仍保留 narrow / non-finance-console 边界

## 常见风险

- 把 billing overview 写成 finance console
- 把 worker entitlement / participant posture 写成 marketplace 能力
- 把 trial / grace / read_only 的局部成立误写成完整 commercial platform
- 只改页面，不同步 access boundary、seed、audit 和 docs

## 模板引用

- [README.md](../../../docs/codex/README.md)
- [batch_task_master_template.md](../../../docs/codex/batch_task_master_template.md)
- [definition_of_done.md](../../../docs/codex/definition_of_done.md)
- [release_checklist.md](../../../docs/codex/release_checklist.md)
- [HELM_BILLING_FOUNDATION_BASELINE_V1.md](../../../docs/product/HELM_BILLING_FOUNDATION_BASELINE_V1.md)
- [SETTINGS_BILLING_OVERVIEW_POLISH_REPORT.md](../../../docs/product/SETTINGS_BILLING_OVERVIEW_POLISH_REPORT.md)
- [HELM_NARROW_PAYMENT_INTEGRATION_SPRINT_1_REPORT.md](../../../docs/product/HELM_NARROW_PAYMENT_INTEGRATION_SPRINT_1_REPORT.md)
- [HELM_CONTRIBUTOR_PORTAL_BASELINE_V1.md](../../../docs/product/HELM_CONTRIBUTOR_PORTAL_BASELINE_V1.md)
- [HELM_READONLY_GRACE_BOUNDARY_SPRINT_1_REPORT.md](../../../docs/product/HELM_READONLY_GRACE_BOUNDARY_SPRINT_1_REPORT.md)
- [HELM_TRIAL_ONBOARDING_SELF_SERVE_SIGNUP_SPRINT_1_REPORT.md](../../../docs/product/HELM_TRIAL_ONBOARDING_SELF_SERVE_SIGNUP_SPRINT_1_REPORT.md)
- [trial-readiness-checklist.md](../../../docs/reviews/trial-readiness-checklist.md)
