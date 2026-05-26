---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Founder / Sales / Delivery Conversation Variants Alignment

## 已对齐范围

- 页面：
  - founder / sales / delivery conversation detail routes
  - generic conversation detail handoff
  - unified detail navigation node types
- 文档：
  - [README.md](../../README.md)
  - [docs/README.md](../README.md)
  - [demo-script.md](../product/demo-script.md)
  - [manual-acceptance-paths.md](../pilot/manual-acceptance-paths.md)
  - [delivery-boundary.md](../pilot/delivery-boundary.md)
  - [product-principles.md](../product/product-principles.md)
- 守卫 / 自检：
  - [helm-self-check.ts](../../scripts/helm-self-check.ts)
  - [decision-first-boundary-check.ts](../../scripts/decision-first-boundary-check.ts)
  - [pilot-readiness-check.ts](../../scripts/pilot-readiness-check.ts)
- 回归：
  - founder / sales / delivery contract tests
  - role conversation pages sprint test
  - unified navigation node coverage

## 当前真实口径

- 已成立的是 role-based conversation detail contract 与三类 detail 页。
- 已成立的是 founder / sales / delivery conversation 与 generic conversation 的第一轮 chain 接入。
- 尚未成立的是完整 commercial conversation engine、battlecard、enablement 平台或自动发送平面。

## 继续保留的边界

- internal-only cue 仍不能直接抬到 customer-facing 语义。
- discussion-only、boundary-only、review-before-send、non-commitment 仍不能被写成 commitment。
- 当前仍默认以 recommendation、review、boundary、decision request 为主，不默认拥有高风险自动发送权限。
