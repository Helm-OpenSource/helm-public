# Tenant Personalization Intelligence Failure Taxonomy

## 一、Failure 分类

| Failure Type | Description | Expected Handling | Not Allowed |
|---|---|---|---|
| cross_workspace_aggregation_attempted | crossWorkspaceAggregationAttempted is true | Escalate to `review_required`; workspace-first isolation is a hard boundary | Allow cross-workspace aggregation if tenant consents |
| unknown_tenant_alias | tenantAlias is not in the approved alias set (tenant-alpha, tenant-beta, tenant-gamma) | Escalate to `rejected`; unapproved aliases may reference real tenants | Auto-map unknown alias to nearest known tenant |
| empty_schema_version | usagePatternSchemaVersion is empty or whitespace | Escalate to `rejected`; schema version is required for schema migration tracking | Default to schema version 1.0 silently |
| schema_version_unsupported | usagePatternSchemaVersion references a version not yet defined in the schema registry | Escalate to `review_required`; unsupported version cannot be evaluated | Auto-upgrade to latest schema version |
| tenant_candidate_auto_applied | Any indication that a tenant learning candidate was applied without human approval | Escalate to `rejected`; tenant personalization changes are strictly review-first | Apply tenant candidates automatically if confidence is high |
| isolation_boundary_breach | Workspace ID in input does not correspond to the declared tenantAlias | Escalate to `rejected`; tenant-workspace binding must be consistent | Remap workspace to a valid tenant automatically |
| empty_evidence_refs_with_no_schema | No evidence refs and no schema version | Escalate to `rejected`; tenant case is fully unverifiable | Accept unverifiable tenant cases as baseline |
| sparse_usage_pattern | Usage pattern signal density is very low (watch_only condition, not a hard reject) | Downgrade to `watch_only`; insufficient data to form a reliable per-tenant learning candidate | Treat sparse pattern as equivalent to a full pattern |

## 二、边界保持

- 不改生产 prompt
- 不做 DB schema
- 不做 API
- 不做 UI
- review-first：租户个性化变更必须经人工复核
- workspace-first 隔离保持：不做跨 workspace 自动聚合
- no-auto-promote：租户 learning candidate 不自动晋升
