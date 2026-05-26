---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Official Write Approval Matrix Report

## 总结

Sprint 6 已把 official write 的 approval matrix 单独收紧，不再复用 draft-only 的宽松规则。

## 当前 tier / reviewer / pilot gate

| Action | Tier | Required approvals | Mandatory reviewers | Pilot gate |
| --- | --- | --- | --- | --- |
| `crm.update_official_stage` | `A4` | `owner`, `manager` | `risk-promise-guard` | `pilotEnabled=false` |
| `crm.update_next_action` | `A3` | `owner` | `risk-promise-guard` | `pilotEnabled=true` |
| `crm.update_blockers` | `A3` | `owner` | `risk-promise-guard` | `pilotEnabled=true` |
| `crm.attach_note` | `A3` | `owner` | `risk-promise-guard` | `pilotEnabled=true` |
| `crm.attach_handoff_summary` | `A4` | `owner`, `manager` | `risk-promise-guard` | `pilotEnabled=false` |

## 当前边界

- official write path 的 approval matrix 已收紧
- owner approve / manager approve / risk-guard 必经 已明确
- pilot 期默认禁用的动作已明确

## 当前结论

已经完整成立：

- official write approval matrix
- A3 / A4 收紧

已成形但仍需下一层：

- role-specific reviewer expansion
- richer pilot gate configuration

刻意未做：

- auto-approved official write

风险项：

- 如果后续为了方便放松 owner / manager / risk-guard，整条 guarded path 会失真
