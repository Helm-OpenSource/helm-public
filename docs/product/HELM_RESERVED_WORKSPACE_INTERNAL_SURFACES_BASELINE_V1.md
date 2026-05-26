---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Reserved Workspace Internal Surfaces Baseline V1

更新时间：2026-04-12

## 已经完整成立

- settings 里的 internal commercial / settlement / participant portal admin / program application review 现在都接入 reserved workspace gating
- `participant portal access stays anchored to the Helm reserved host workspace`：invite preview、portal data、onboarding、profile update 都只认 Helm reserved host
- `Formal skill review stays reserved for the Helm internal operating workspace`：formal review queue / decision 读取与写入现在只保留给 reserved workspace
- candidate skill suggestion 的接受 / 忽略仍保持 tenant-local，不把 tenant insight 和 platform formal review 再混成一条线

## 已成形但仍需下一层

- existing data 还没有做显式 backfill；历史上如果有非 reserved workspace 的 first-party records，本轮会收成不可见而不是自动迁移
- settings 之外的 remaining first-party surfaces 还没有全部收进 reserved workspace plane
- `WorkspaceRole` capability matrix 仍是 role-first；reserved dimension 目前主要落在 host gating helper 和 surface/action 守卫

## 刻意未做

- 自动 data migration / backfill
- full first-party extension registry
- generic multi-host reserved workspace routing
- 把所有 tenant-local capability governance 一并改成 Helm-only

## 风险项

- 现有数据库中若仍有 first-party commercial / portal / review 数据挂在 customer workspace，本轮会让这些数据变暗，需要人工 backfill
- 当前 reserved gating 仍是 single-host posture，不是 full multi-tenant first-party operating plane
- formal skill review 已收进 reserved workspace，但 formal promotion helper / catalog auto-write 仍未实现，也不该被写成已成立

## 当前边界

- `settings 里的 internal commercial / participant portal / formal skill review 现在都接入 reserved workspace gating`
- `Program application review and invite issuance stay reserved for the Helm internal operating workspace`
- `Participant portal access stays anchored to the Helm reserved host workspace`
- `Formal skill review stays reserved for the Helm internal operating workspace`
- `candidate capability adoption != reserved-only governance`
- `reserved surface gating != data migration complete`
