---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Reserved Workspace Host Gating Baseline V1

更新时间：2026-04-12

## 已经完整成立

- `Workspace` 现在有显式 `workspaceClass / systemKey`，可以区分普通 customer workspace 与 `HELM_RESERVED` host workspace
- `public program catalog host 现在只解析 Helm reserved workspace`，不再靠 active workspace 数量 heuristic 猜 host
- `engineering delivery review 现在只在 Helm reserved workspace 渲染`，不再对所有租户共享同一份当前仓库 git 复盘
- `prisma/seed.ts` 现在会把 founder demo workspace 标记成 Helm reserved host，保证 `db:reset` 后 demo 路径仍可验证

## 已成形但仍需下一层

- settings 里的 commercial / settlement / participant portal / skill governance 还没有全部接入 reserved workspace gating
- production / existing local data 还需要显式 backfill，给 Helm first-party 数据绑定稳定 reserved host
- `WorkspaceRole` capability matrix 还没有叠加 reserved capability dimension；当前只是补了 host resolution 和页面 gating

## 刻意未做

- full RBAC / enterprise IAM
- schema-per-tenant / db-per-tenant
- generic multi-host workspace registry
- commercial data 全量迁移与自动 backfill
- `Helm平台` 或其它普通 customer workspace 复用 engineering delivery review

## 风险项

- 如果现有数据库里还没有 `HELM_RESERVED` + `helm_reserved_primary` workspace，`/programs` 会返回空 catalog，`/reports` 也不会显示 engineering delivery review
- 仍有 first-party surfaces 没有接入 reserved gating，本轮不能被写成“Helm 内部经营数据已经全部隔离”
- 当前 reserved host 仍是 single-host posture，不是完整 first-party / tenant custom / reusable extension registry

## 当前边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `public program catalog host 现在只解析 Helm reserved workspace`
- `engineering delivery review 现在只在 Helm reserved workspace 渲染`
- `reserved host gating != full multi-tenant platform`
