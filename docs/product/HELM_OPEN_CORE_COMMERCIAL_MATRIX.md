---
status: planning
owner: helm-core
created: 2026-04-28
review_after: 2026-05-28
archive_trigger:
  - HELM_OPEN_CORE_COMMERCIAL_MATRIX_IMPLEMENTATION_REPORT 落地并完成 docs/README.md 索引切换后 30 天归档
  - 2026-07-31 之后若没有任何 commercial package 或 release readiness 文档引用本文件则归档
---

# Helm Open Core Commercial Matrix

## 1. Purpose

This matrix turns the open-source commercial boundary into a feature-by-feature packaging rule.

It answers:

> Is this capability open core, Helm Cloud, Helm Enterprise, custom delivery, or deferred?

It does not implement billing, entitlement checks, marketplace behavior, or official write authority.

## 2. Packaging Labels

| Label | Meaning |
| --- | --- |
| `open_core` | Apache-2.0 source, local runtime, standard contract, or basic demo capability |
| `cloud` | Helm-maintained managed service value |
| `enterprise` | Enterprise security, governance, support, deployment, audit, or official integration value |
| `custom` | Customer-specific implementation, workflow pack, connector, mapping, or delivery service |
| `deferred` | Not in the current release boundary |

## 3. Matrix

| Capability | Label | Boundary |
| --- | --- | --- |
| Object Graph contracts | `open_core` | Standard contract; not customer-specific data |
| MemoryItem / memory promotion schema | `open_core` | Review-first semantics; no automatic canonical promotion |
| ArtifactBundle contract | `open_core` | Provenance shape; not customer proof content |
| Approval Matrix contract | `open_core` | Contract and local review flow; not enterprise policy console |
| Local controlled-trial runtime | `open_core` | Local evaluation and demo; no managed uptime promise |
| Demo app and sample seed | `open_core` | Fictional data only |
| Meeting-to-Action basic worker | `open_core` | Basic action pack; no certified revenue workflow claim |
| Draft-only comms basic worker | `open_core` | Draft-only; no send authority |
| Opportunity Judge basic shadow runtime | `open_core` | Shadow judgement; no CRM stage update |
| Basic eval harness | `open_core` | Generic evals; no customer-specific goldens |
| Read-first connector SDK | `open_core` | SDK and provider contract; no official production connector guarantee |
| Policy Guard SDK | `open_core` | Local guard contract; no enterprise policy console |
| Helm Cloud workspace hosting | `cloud` | Managed runtime, upgrades, backup posture |
| Helm Cloud Team package | `cloud` | Small-team managed experience; no enterprise SLA by default |
| Business package | `cloud` | Managed workspace plus standard workflow packs |
| Managed eval reporting | `cloud` | Helm-maintained eval operations; customer-specific data stays private |
| Enterprise SSO / RBAC | `enterprise` | Enterprise procurement and identity boundary |
| Audit export | `enterprise` | Compliance evidence; not immutable ledger claim |
| Official connector production path | `enterprise` | Certified implementation plus review-first boundary |
| Official write guard production path | `enterprise` | Candidate, review, ack, reconciliation; no broad auto-write |
| Enterprise observability | `enterprise` | Runtime, connector, cost, model and review queue visibility |
| Sensitive data guard | `enterprise` | PII / secret / prompt injection guard; not complete security guarantee |
| Private deployment support | `enterprise` | Deployment support and runbook; no unsupported environment guarantee |
| Meeting-to-Action Certified Pack | `custom` | Needs proof pack and certification checklist |
| Revenue Operating Loop Certified Pack | `custom` | Needs customer proof and review boundary |
| CS Handoff Certified Pack | `custom` | Needs handoff proof and customer-success review |
| Governed CRM-CS Loop Certified Pack | `custom` | Needs official integration review and ack/reconciliation evidence |
| Customer-specific workflow pack | `custom` | Implementation / maintenance service; not open-core default |
| Customer-specific eval goldens | `custom` | Private customer asset; excluded from public mirror |
| Customer proof pack raw material | `custom` | Private by default; public use requires approval |
| Partner delivery workspace | `custom` | Internal / partner delivery coordination; not marketplace |
| Billing engine | `deferred` | No full billing platform in current release |
| Partner marketplace | `deferred` | Certification is manual review, not marketplace |
| Automatic external send | `deferred` | Out of scope for controlled trial |
| Broad CRM official write | `deferred` | Only narrow review-first candidates may enter design review |
| Plugin runtime sandbox | `deferred` | Known gap; future roadmap research |

## 4. Default Rule

When a capability is ambiguous:

1. put contracts and local demos in `open_core`
2. put managed operations in `cloud`
3. put security, audit, SSO and official production integration in `enterprise`
4. put customer-specific proof, packs and implementation in `custom`
5. put automation, marketplace, broad write and sandbox expansion in `deferred`

## 5. Change Log

| Date | Change |
| --- | --- |
| 2026-04-28 | Initial open-core commercial matrix |
