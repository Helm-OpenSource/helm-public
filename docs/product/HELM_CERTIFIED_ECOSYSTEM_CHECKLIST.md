---
status: planning
owner: helm-core
created: 2026-04-28
review_after: 2026-05-28
archive_trigger:
  - HELM_CERTIFIED_ECOSYSTEM_IMPLEMENTATION_REPORT 落地并完成 docs/README.md 索引切换后 30 天归档
  - 2026-07-31 之后若没有任何 certified connector、workflow pack、partner 或 deployment review 引用本文件则归档
---

# Helm Certified Ecosystem Checklist / Helm 认证生态清单

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本清单定义 connector、workflow pack、partner 和 deployment 的第一层人工认证
gate。它不创建 marketplace、payout rail、reseller program、自动认证系统或客户
outcome guarantee。

所有认证候选都必须说明 owner、scope、supported / unsupported use case、version、
evidence refs、review boundary、rollback / withdrawal path、customer-visible claim
和 non-commitment note。任何候选都不得声称自动发送、广泛自动写入、自动审批、
自动结算或保证商业结果。

公开使用 **Helm Certified ...** 字样只能发生在 approval 之后。认证记录在 owner
批准公开使用前应保留在内部；如果 scope、安全姿态、客户可见 claim 或
review-first boundary 发生漂移，认证可以撤销。

## English Reference

## 1. Purpose

This checklist defines the first manual certification gate for connectors, workflow packs, partners, and deployments.

It does not create a marketplace, payout rail, reseller program, automated certification system, or customer outcome guarantee.

## 2. Shared Certification Rules

Every certification candidate must show:

- owner
- scope
- supported use case
- unsupported use case
- version
- evidence refs
- review boundary
- rollback or withdrawal path
- customer-visible claim
- non-commitment note

No candidate may claim automatic send, broad auto-write, automatic approval, automatic settlement, or guaranteed commercial outcome.

## 3. Certified Connector Checklist

Required:

- provider contract documented
- authentication and token handling reviewed
- least-privilege scopes listed
- read-first behavior verified
- write path disabled or review-first
- tenant/workspace boundary documented
- failure and stale-data posture defined
- audit events or evidence refs defined
- security reviewer approval captured
- regression eval or smoke test exists

Certification output:

- `certified_connector_candidate`
- `approved_certified_connector`
- `rejected`
- `withdrawn`

Public claim allowed only after approval:

**Helm Certified Connector for `<provider>`**

## 4. Certified Workflow Pack Checklist

Required:

- workflow pack purpose documented
- input objects and output artifacts listed
- review gates listed
- proof pack attached
- eval coverage attached
- customer-visible claims reviewed
- wrong commitment incident posture recorded
- audit trace coverage recorded
- rollback or deprecation path defined
- product owner approval captured

Certification output:

- `certified_workflow_pack_candidate`
- `approved_certified_workflow_pack`
- `rejected`
- `withdrawn`

Public claim allowed only after approval:

**Helm Certified Workflow Pack for `<workflow>`**

## 5. Certified Partner Checklist

Required:

- partner legal entity and owner recorded
- delivery capability described
- customer data handling posture reviewed
- connector and workflow experience listed
- partner training completed
- brand usage rules accepted
- no unauthorized official endorsement claim
- customer proof contribution process defined
- escalation and support boundary defined
- partner agreement or interim approval captured

Certification output:

- `certified_partner_candidate`
- `approved_certified_partner`
- `rejected`
- `withdrawn`

Public claim allowed only after approval:

**Helm Certified Partner**

## 6. Certified Deployment Checklist

Required:

- deployment target documented
- environment boundary documented
- secret management reviewed
- backup and restore posture defined
- upgrade path defined
- logging and audit posture defined
- data residency posture defined
- security baseline reviewed
- rollback path tested or documented
- operations owner accepted

Certification output:

- `certified_deployment_candidate`
- `approved_certified_deployment`
- `rejected`
- `withdrawn`

Public claim allowed only after approval:

**Helm Certified Deployment**

## 7. Manual Review Flow

```text
candidate submitted
  -> scope review
  -> evidence review
  -> security / boundary review
  -> product claim review
  -> approval / rejection / withdrawal
  -> certification record
```

Certification records should stay internal until the owner approves public use.

## 8. Revocation

Certification can be revoked when:

- scope changes without review
- security posture changes
- customer-visible claim overreaches evidence
- connector or workflow violates review-first boundaries
- partner misuses Helm marks
- deployment loses required operating evidence

Revocation should record reason, effective date, and public-claim handling.

## 9. Change Log

| Date | Change |
| --- | --- |
| 2026-04-28 | Initial manual certification checklist |
