---
status: planning
owner: helm-core
created: 2026-04-28
review_after: 2026-05-28
archive_trigger:
  - HELM_TRADEMARK_AND_BRAND_USAGE_IMPLEMENTATION_REPORT 落地并完成 docs/README.md 索引切换后 30 天归档
  - 2026-07-31 之后若没有任何 release readiness report 或 partner agreement 文档引用本文件则归档
---

# Helm Trademark And Brand Usage Guide

## 1. Purpose

This guide defines first-pass product rules for Helm brand usage around Apache-2.0 open source, Helm Cloud, Helm Enterprise, and Helm Certified.

This is not legal advice. It does not replace trademark registration, outside counsel review, or signed partner agreements.

## 2. Reserved Names

The following names are reserved for maintainer-approved use:

- Helm
- Helm Core
- Helm Cloud
- Helm Enterprise
- Helm Official
- Helm Certified
- Certified Connector
- Certified Workflow Pack
- Certified Partner
- Certified Deployment

## 3. Open Source Compatibility

Third parties may describe their work as compatible with Helm Core when the statement is accurate and not misleading.

Allowed examples:

- "Compatible with Helm Core"
- "Built against Helm Core contracts"
- "Uses the Helm open-source connector SDK"

Not allowed without approval:

- "Helm Official"
- "Helm Certified"
- "Official Helm connector"
- "Helm Enterprise partner"
- "Endorsed by Helm"

## 4. Fork Naming

Forks may use the Apache-2.0 licensed code, but they should not present themselves as the official Helm product.

Forks should use names that clearly distinguish the fork from Helm-maintained releases.

Do not use a fork name, logo, domain, package name, or repository description that implies it is Helm Cloud, Helm Enterprise, Helm Official, or Helm Certified.

## 5. Product Names

| Name | Meaning | Usage Boundary |
| --- | --- | --- |
| Helm Core | Apache-2.0 open-source core and local runtime | May be referenced for open-source compatibility |
| Helm Cloud | Helm-maintained managed service | Maintainer-approved only |
| Helm Enterprise | Helm-maintained enterprise packaging and support | Maintainer-approved only |
| Helm Official | First-party or explicitly approved artifact | Maintainer-approved only |
| Helm Certified | Passed manual certification review | Maintainer-approved only |

## 6. Connector And Workflow Pack Claims

Third-party connectors and workflow packs must avoid overclaiming.

Allowed:

- "Community connector for Helm Core"
- "Experimental workflow pack for Helm Core"
- "Partner-maintained integration, not Helm Certified"

Requires approval:

- "Certified Connector"
- "Certified Workflow Pack"
- "Official connector"
- "Production-ready official write adapter"

No connector may imply automatic write authority, automatic sending, or external system commitment unless the matching review-first official integration contract exists and has been approved.

## 7. Partner Claims

Partners may not claim official partnership, certification, commercial endorsement, or customer outcome guarantees without a signed partner agreement or maintainer-approved certification record.

Allowed before approval:

- "We implement Helm Core-compatible workflows"
- "We provide custom services around Helm Core"

Not allowed before approval:

- "Official Helm partner"
- "Helm Certified Partner"
- "Authorized Helm Enterprise reseller"
- "Guaranteed by Helm"

## 8. Logo And Visual Use

Until a formal brand kit is published:

- do not create modified Helm logos that imply official status
- do not use Helm marks as the primary brand of a fork or third-party product
- do not place Helm marks in a way that suggests endorsement
- do not combine Helm marks with customer logos without written permission

## 9. Public Claims

Any public claim involving customer results, proof packs, certified status, official write reliability, audit compliance, or enterprise readiness requires review.

Default posture:

- recommendation is not commitment
- compatibility is not certification
- open source is not managed service
- demo proof is not customer proof
- partner delivery is not marketplace endorsement

## 10. Change Log

| Date | Change |
| --- | --- |
| 2026-04-28 | Initial planning guide for Helm brand and certification boundary |
