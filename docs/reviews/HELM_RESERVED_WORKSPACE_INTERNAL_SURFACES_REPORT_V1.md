---
status: archived
owner: helm-core
created: 2026-04-12
review_after: 2026-10-09
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Reserved Workspace Internal Surfaces Report V1

更新时间：2026-04-12

## 1. 本轮完成内容

- 把 settings 内部 commercial 读路径从 role-only 收成 `reserved workspace + role`
- 把 program application review / invite issuance 收成 reserved host-only 写路径
- 把 participant portal preview、portal data、onboarding、profile update 一起锚定到 reserved host workspace
- 把 formal skill review queue / decision workflow 收成 reserved-only，同时保留 candidate suggestion 的 tenant-local adoption

## 2. 本轮变更清单

- reserved workspace helper:
  - `lib/workspace-reserved.ts`
- settings reserved gating:
  - `features/settings/queries.ts`
  - `features/settings/settings-client.tsx`
  - `features/settings/actions.ts`
- program / participant portal reserved gating:
  - `features/programs/actions.ts`
  - `features/participant-portal/queries.ts`
  - `features/participant-portal/actions.ts`
- docs / guards / tests:
  - `README.md`
  - `docs/README.md`
  - `PLANS.md`
  - `scripts/helm-self-check.ts`
  - `scripts/decision-first-boundary-check.ts`
  - `lib/workspace-reserved.test.ts`
  - `features/participant-portal/queries.test.ts`

## 3. 本轮没有过度声称的点

- 没有宣称 existing first-party data backfill 已完成
- 没有把 candidate skill suggestion adoption 也改成 reserved-only
- 没有把 reserved surface gating 写成 full first-party extension registry 或 full tenant isolation

## 4. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `Program application review and invite issuance stay reserved for the Helm internal operating workspace`
- `Participant portal access stays anchored to the Helm reserved host workspace`
- `Formal skill review stays reserved for the Helm internal operating workspace`
- `reserved surface gating != data migration complete`

## 5. 仍属下一层

- reserved host data backfill / migration execution
- settings 之外 remaining first-party operating surfaces 的 reserved plane 收口
- first-party solution extension registry
- reserved capability dimension 的进一步系统化整理

## 6. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- 其余整链验证见本轮最终交付说明
